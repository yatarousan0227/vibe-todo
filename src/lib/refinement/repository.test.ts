import { describe, expect, it, vi } from "vitest";
import {
  createArtifactRepository,
  createGenerationJobRepository,
} from "./repository";
import { refinementSchemaStatements } from "./db";
import type { ArtifactKey } from "./types";

function snapshotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    artifact_snapshot_id: "snap-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome" as ArtifactKey,
    version_number: 1,
    body: "Generated body content",
    change_reason: "first draft generated",
    generation_trigger: "generate",
    approval_status: "draft",
    is_current: true,
    diff_from_previous: null,
    created_at: new Date("2026-03-14T08:00:00.000Z"),
    ...overrides,
  };
}

function jobRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    generation_job_id: "job-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome" as ArtifactKey,
    status: "queued",
    artifact_snapshot_id: null,
    error_message: null,
    created_at: new Date("2026-03-14T08:00:00.000Z"),
    updated_at: new Date("2026-03-14T08:00:00.000Z"),
    ...overrides,
  };
}

describe("artifact_snapshots schema", () => {
  it("declares a partial unique index for one current snapshot per artifact key", () => {
    expect(
      refinementSchemaStatements.some(
        (s) =>
          s.includes("CREATE UNIQUE INDEX") &&
          s.includes("artifact_snapshots(project_id, artifact_key)") &&
          s.includes("WHERE is_current = TRUE"),
      ),
    ).toBe(true);
  });

  it("includes all required tables in schema statements", () => {
    const tables = ["artifact_snapshots", "artifact_generation_jobs", "artifact_approval_audits"];
    for (const table of tables) {
      expect(
        refinementSchemaStatements.some((s) => s.includes(table)),
      ).toBe(true);
    }
  });
});

describe("ArtifactRepository.getCurrentSnapshot", () => {
  it("returns null when no current snapshot exists", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = createArtifactRepository(executor as never);
    const result = await repo.getCurrentSnapshot("project-001", "objective_and_outcome");
    expect(result).toBeNull();
    const [sql] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("is_current = TRUE");
  });

  it("returns the mapped snapshot record when found", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [snapshotRow()] }),
    };
    const repo = createArtifactRepository(executor as never);
    const result = await repo.getCurrentSnapshot("project-001", "objective_and_outcome");
    expect(result).not.toBeNull();
    expect(result?.artifact_snapshot_id).toBe("snap-001");
    expect(result?.approval_status).toBe("draft");
    expect(result?.created_at).toBe("2026-03-14T08:00:00.000Z");
  });
});

describe("ArtifactRepository.createSnapshot", () => {
  it("demotes existing current snapshot and inserts a new draft with incremented version", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      query: vi.fn().mockImplementation((sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        if (sql.includes("MAX(version_number)")) {
          return Promise.resolve({ rows: [{ max: 2 }] });
        }
        if (sql.includes("UPDATE artifact_snapshots SET is_current = FALSE")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({
          rowCount: 1,
          rows: [snapshotRow({ version_number: 3 })],
        });
      }),
    };
    const repo = createArtifactRepository(executor as never);
    const result = await repo.createSnapshot({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      body: "New body",
      changeReason: "regenerated",
      generationTrigger: "regenerate",
      diffFromPrevious: "- old line\n+ new line",
    });

    const updateCall = calls.find((c) =>
      c.sql.includes("UPDATE artifact_snapshots SET is_current = FALSE"),
    );
    expect(updateCall).toBeDefined();
    const insertCall = calls.find((c) => c.sql.includes("INSERT INTO artifact_snapshots"));
    expect(insertCall).toBeDefined();
    expect(result.version_number).toBe(3);
  });
});

describe("ArtifactRepository.approveSnapshot", () => {
  it("updates approval_status to approved for the given snapshot", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [snapshotRow({ approval_status: "approved" })],
      }),
    };
    const repo = createArtifactRepository(executor as never);
    const result = await repo.approveSnapshot("snap-001");
    expect(result.approval_status).toBe("approved");
    const [sql, values] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("approval_status = 'approved'");
    expect(values[0]).toBe("snap-001");
  });
});

describe("ArtifactRepository.markDownstreamSnapshotsStale", () => {
  it("marks all specified downstream keys as stale where approved and current", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({ rowCount: 2, rows: [] }),
    };
    const repo = createArtifactRepository(executor as never);
    await repo.markDownstreamSnapshotsStale("project-001", [
      "background_and_current_situation",
      "scope_and_non_scope",
    ]);
    const [sql] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("approval_status = 'stale'");
    expect(sql).toContain("approval_status = 'approved'");
    expect(sql).toContain("is_current = TRUE");
  });

  it("is a no-op when downstream keys list is empty", async () => {
    const executor = { query: vi.fn() };
    const repo = createArtifactRepository(executor as never);
    await repo.markDownstreamSnapshotsStale("project-001", []);
    expect(executor.query).not.toHaveBeenCalled();
  });
});

describe("ArtifactRepository.createApprovalAudit", () => {
  it("inserts an audit record with the decision and reason", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            approval_audit_id: "audit-001",
            project_id: "project-001",
            artifact_key: "objective_and_outcome",
            artifact_snapshot_id: "snap-001",
            decision: "approve",
            decision_reason: "Looks correct",
            decided_at: new Date("2026-03-14T09:00:00.000Z"),
          },
        ],
      }),
    };
    const repo = createArtifactRepository(executor as never);
    const result = await repo.createApprovalAudit({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      artifactSnapshotId: "snap-001",
      decision: "approve",
      decisionReason: "Looks correct",
    });
    expect(result.decision).toBe("approve");
    expect(result.decision_reason).toBe("Looks correct");
    expect(result.decided_at).toBe("2026-03-14T09:00:00.000Z");
  });
});

describe("GenerationJobRepository", () => {
  it("creates a job with queued status", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [jobRow()] }),
    };
    const repo = createGenerationJobRepository(executor as never);
    const result = await repo.createJob("project-001", "objective_and_outcome");
    expect(result.status).toBe("queued");
    const [sql] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO artifact_generation_jobs");
    expect(sql).toContain("'queued'");
  });

  it("transitions job status to completed with a snapshot id", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [
          jobRow({ status: "completed", artifact_snapshot_id: "snap-001" }),
        ],
      }),
    };
    const repo = createGenerationJobRepository(executor as never);
    const result = await repo.updateJobStatus("job-001", "completed", {
      snapshotId: "snap-001",
    });
    expect(result.status).toBe("completed");
    expect(result.artifact_snapshot_id).toBe("snap-001");
  });

  it("transitions job status to retryable with an error message", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [
          jobRow({
            status: "retryable",
            error_message: "Provider timeout",
          }),
        ],
      }),
    };
    const repo = createGenerationJobRepository(executor as never);
    const result = await repo.updateJobStatus("job-001", "retryable", {
      errorMessage: "Provider timeout",
    });
    expect(result.status).toBe("retryable");
    expect(result.error_message).toBe("Provider timeout");
  });

  it("returns null when no job exists for the project and artifact key", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = createGenerationJobRepository(executor as never);
    const result = await repo.getLatestJob("project-001", "objective_and_outcome");
    expect(result).toBeNull();
  });
});
