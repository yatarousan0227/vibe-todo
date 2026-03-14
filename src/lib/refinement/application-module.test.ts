import { describe, expect, it, vi } from "vitest";
import {
  NotFoundError,
  RefinementApplicationModule,
  SequenceGatingError,
  ValidationError,
} from "./application-module";
import { CANONICAL_ARTIFACT_SEQUENCE } from "./model";
import type {
  ArtifactKey,
  ArtifactSnapshotRecord,
  ArtifactGenerationJobRecord,
  ArtifactApprovalAuditRecord,
} from "./types";
import type { ProjectRecord, RefinementSessionRecord } from "../intake/types";
import type { IntakePayload } from "../intake/types";

const sampleIntakePayload: IntakePayload = {
  planning_mode: "project",
  structured_input: {
    title: "Community Event Planning",
    objective: "Organize a neighborhood fair",
    background_or_current_situation: "Annual fair has been on hiatus",
    scope_summary: "Food stalls, entertainment, and volunteer coordination",
    stakeholders: "Residents, local businesses, city council",
    expected_outcome_or_deliverable: "",
    constraints_or_conditions: "Budget of 5000, venue permit required",
  },
  free_form_input: {
    body: "We want to bring the community together for a day of celebration.",
  },
};

function makeProject(
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    project_id: "project-001",
    title: "Community Event Planning",
    planning_mode: "project",
    lifecycle_status: "confirmed",
    draft_intake_payload: sampleIntakePayload,
    confirmed_intake_snapshot: sampleIntakePayload,
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:01:00.000Z",
    confirmed_at: "2026-03-14T08:02:00.000Z",
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<RefinementSessionRecord> = {},
): RefinementSessionRecord {
  return {
    refinement_session_id: "session-001",
    project_id: "project-001",
    status: "active",
    active_artifact_key: "objective_and_outcome",
    last_generation_at: null,
    created_at: "2026-03-14T08:03:00.000Z",
    ...overrides,
  };
}

function makeSnapshot(
  key: ArtifactKey,
  status: "draft" | "approved" | "stale",
  overrides: Partial<ArtifactSnapshotRecord> = {},
): ArtifactSnapshotRecord {
  return {
    artifact_snapshot_id: `snap-${key}`,
    project_id: "project-001",
    artifact_key: key,
    version_number: 1,
    body: `Body for ${key}`,
    change_reason: "generated",
    generation_trigger: "generate",
    approval_status: status,
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:05:00.000Z",
    ...overrides,
  };
}

function makeJob(
  status: "queued" | "running" | "completed" | "failed" | "retryable" = "queued",
  overrides: Partial<ArtifactGenerationJobRecord> = {},
): ArtifactGenerationJobRecord {
  return {
    generation_job_id: "job-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    status,
    artifact_snapshot_id: null,
    error_message: null,
    created_at: "2026-03-14T08:06:00.000Z",
    updated_at: "2026-03-14T08:06:00.000Z",
    ...overrides,
  };
}

function makeAudit(overrides: Partial<ArtifactApprovalAuditRecord> = {}): ArtifactApprovalAuditRecord {
  return {
    approval_audit_id: "audit-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    artifact_snapshot_id: "snap-objective_and_outcome",
    decision: "approve",
    decision_reason: "Looks good",
    decided_at: "2026-03-14T09:00:00.000Z",
    ...overrides,
  };
}

function makeEmptyCurrentSnapshots(): Map<ArtifactKey, ArtifactSnapshotRecord | null> {
  return new Map(CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, null]));
}

function makeDependencies() {
  const emptySnapshots = makeEmptyCurrentSnapshots();
  return {
    projectRepository: {
      getById: vi.fn().mockResolvedValue(makeProject()),
      upsertDraft: vi.fn(),
      confirmIntake: vi.fn(),
    },
    refinementSessionRepository: {
      getActiveByProjectId: vi.fn().mockResolvedValue(makeSession()),
      createActiveSession: vi.fn(),
    },
    artifactRepository: {
      getCurrentSnapshot: vi.fn().mockResolvedValue(null),
      getPreviousSnapshot: vi.fn().mockResolvedValue(null),
      getSnapshotById: vi.fn().mockResolvedValue(null),
      getAllCurrentSnapshots: vi.fn().mockResolvedValue(emptySnapshots),
      getApprovedUpstreamSnapshots: vi.fn().mockResolvedValue([]),
      createSnapshot: vi.fn(),
      approveSnapshot: vi.fn(),
      markSnapshotStale: vi.fn(),
      markDownstreamSnapshotsStale: vi.fn().mockResolvedValue(undefined),
      getApprovalHistory: vi.fn().mockResolvedValue([]),
      createApprovalAudit: vi.fn().mockResolvedValue(makeAudit()),
    },
    generationJobRepository: {
      createJob: vi.fn().mockResolvedValue(makeJob("queued")),
      updateJobStatus: vi.fn().mockResolvedValue(makeJob("completed")),
      getLatestJob: vi.fn().mockResolvedValue(null),
    },
    refinementEngine: {
      generateArtifactContent: vi.fn().mockResolvedValue({
        content: "Generated content",
        changeReason: "First draft generated",
      }),
    },
    withTransaction: vi.fn(),
  };
}

describe("RefinementApplicationModule.getProjectWorkspaceContext", () => {
  it("returns workspace context with all artifact summaries", async () => {
    const deps = makeDependencies();
    const module = new RefinementApplicationModule(deps);
    const context = await module.getProjectWorkspaceContext("project-001");

    expect(context.project.projectId).toBe("project-001");
    expect(context.artifactSummaries).toHaveLength(8);
    expect(context.artifactSummaries[0].artifactKey).toBe("objective_and_outcome");
    expect(context.artifactSummaries[0].displayStatus).toBe("ready");
    expect(context.readiness.isReady).toBe(false);
  });

  it("returns summaries matching the same ordering for both planning modes", async () => {
    const deps = makeDependencies();
    const module = new RefinementApplicationModule(deps);

    const context = await module.getProjectWorkspaceContext("project-001");
    const keys = context.artifactSummaries.map((s) => s.artifactKey);
    expect(keys).toEqual(CANONICAL_ARTIFACT_SEQUENCE);
  });

  it("raises NotFoundError when the project does not exist", async () => {
    const deps = makeDependencies();
    deps.projectRepository.getById.mockResolvedValue(null);
    const module = new RefinementApplicationModule(deps);

    await expect(
      module.getProjectWorkspaceContext("missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("marks canProceedToTaskSynthesis true when all artifacts are approved", async () => {
    const deps = makeDependencies();
    const allApproved = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, makeSnapshot(k, "approved")]),
    );
    deps.artifactRepository.getAllCurrentSnapshots.mockResolvedValue(allApproved);
    const module = new RefinementApplicationModule(deps);

    const context = await module.getProjectWorkspaceContext("project-001");
    expect(context.allowedActions.canProceedToTaskSynthesis).toBe(true);
    expect(context.readiness.isReady).toBe(true);
  });
});

describe("RefinementApplicationModule.generateArtifactDraft", () => {
  it("creates a job and snapshot for the first artifact without upstream gating", async () => {
    const deps = makeDependencies();
    const snapshot = makeSnapshot("objective_and_outcome", "draft");
    deps.artifactRepository.createSnapshot.mockResolvedValue(snapshot);
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("completed", { artifact_snapshot_id: snapshot.artifact_snapshot_id }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      generationTrigger: "generate",
    });

    expect(result.job.status).toBe("completed");
    expect(result.snapshot).not.toBeNull();
    expect(deps.refinementEngine.generateArtifactContent).toHaveBeenCalledWith(
      expect.objectContaining({ artifactKey: "objective_and_outcome" }),
    );
  });

  it("rejects generation when upstream artifacts do not have drafts yet", async () => {
    const deps = makeDependencies();
    deps.artifactRepository.getAllCurrentSnapshots.mockResolvedValue(
      makeEmptyCurrentSnapshots(),
    );
    const module = new RefinementApplicationModule(deps);

    await expect(
      module.generateArtifactDraft({
        projectId: "project-001",
        artifactKey: "background_and_current_situation",
        generationTrigger: "generate",
      }),
    ).rejects.toBeInstanceOf(SequenceGatingError);
  });

  it("allows second artifact generation when first has a current draft", async () => {
    const deps = makeDependencies();
    const upstreamSnap = makeSnapshot("objective_and_outcome", "draft");
    const currentSnapshots = makeEmptyCurrentSnapshots();
    currentSnapshots.set("objective_and_outcome", upstreamSnap);
    deps.artifactRepository.getAllCurrentSnapshots.mockResolvedValue(currentSnapshots);
    const newSnap = makeSnapshot("background_and_current_situation", "draft");
    deps.artifactRepository.createSnapshot.mockResolvedValue(newSnap);
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("completed", {
        artifact_key: "background_and_current_situation",
        artifact_snapshot_id: newSnap.artifact_snapshot_id,
      }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "background_and_current_situation",
      generationTrigger: "generate",
    });

    expect(result.job.status).toBe("completed");
    expect(result.snapshot).not.toBeNull();
  });

  it("returns retryable job status on provider timeout without destroying existing snapshot", async () => {
    const deps = makeDependencies();
    deps.refinementEngine.generateArtifactContent.mockRejectedValue(
      new Error("timeout after 30s"),
    );
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("retryable", { error_message: "timeout after 30s" }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      generationTrigger: "generate",
    });

    expect(result.job.status).toBe("retryable");
    expect(result.snapshot).toBeNull();
    expect(deps.artifactRepository.createSnapshot).not.toHaveBeenCalled();
  });

  it("stores user edits as first-class snapshots with user_edit trigger", async () => {
    const deps = makeDependencies();
    const editedSnap = makeSnapshot("objective_and_outcome", "draft", {
      generation_trigger: "user_edit",
      body: "User-written content",
    });
    deps.artifactRepository.createSnapshot.mockResolvedValue(editedSnap);
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("completed", { artifact_snapshot_id: editedSnap.artifact_snapshot_id }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      generationTrigger: "user_edit",
      userEditBody: "User-written content",
      changeReason: "Revised by user",
    });

    expect(result.snapshot?.generation_trigger).toBe("user_edit");
    expect(deps.refinementEngine.generateArtifactContent).not.toHaveBeenCalled();
  });

  it("raises ValidationError when intake is not confirmed", async () => {
    const deps = makeDependencies();
    deps.projectRepository.getById.mockResolvedValue(
      makeProject({ confirmed_intake_snapshot: null }),
    );
    const module = new RefinementApplicationModule(deps);

    await expect(
      module.generateArtifactDraft({
        projectId: "project-001",
        artifactKey: "objective_and_outcome",
        generationTrigger: "generate",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("RefinementApplicationModule.approveOrRejectArtifact", () => {
  it("requires an explicit decision reason", async () => {
    const deps = makeDependencies();
    const module = new RefinementApplicationModule(deps);

    await expect(
      module.approveOrRejectArtifact({
        projectId: "project-001",
        artifactKey: "objective_and_outcome",
        artifactSnapshotId: "snap-001",
        decision: "approve",
        decisionReason: "   ",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("approves a snapshot and marks downstream artifacts stale", async () => {
    const deps = makeDependencies();
    const snap = makeSnapshot("objective_and_outcome", "draft");
    deps.artifactRepository.getSnapshotById.mockResolvedValue(snap);
    deps.artifactRepository.approveSnapshot.mockResolvedValue(
      makeSnapshot("objective_and_outcome", "approved"),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.approveOrRejectArtifact({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      artifactSnapshotId: snap.artifact_snapshot_id,
      decision: "approve",
      decisionReason: "Objectives are clear and measurable",
    });

    expect(result.audit.decision).toBe("approve");
    expect(result.snapshot.approval_status).toBe("approved");
    expect(deps.artifactRepository.markDownstreamSnapshotsStale).toHaveBeenCalledWith(
      "project-001",
      expect.arrayContaining(["background_and_current_situation"]),
    );
  });

  it("preserves the last approved snapshot on rejection without marking downstream stale", async () => {
    const deps = makeDependencies();
    const snap = makeSnapshot("objective_and_outcome", "draft");
    deps.artifactRepository.getSnapshotById.mockResolvedValue(snap);
    deps.artifactRepository.createApprovalAudit.mockResolvedValue(
      makeAudit({ decision: "reject", decision_reason: "Needs more clarity" }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.approveOrRejectArtifact({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      artifactSnapshotId: snap.artifact_snapshot_id,
      decision: "reject",
      decisionReason: "Needs more clarity",
    });

    expect(result.audit.decision).toBe("reject");
    expect(deps.artifactRepository.approveSnapshot).not.toHaveBeenCalled();
    expect(deps.artifactRepository.markDownstreamSnapshotsStale).not.toHaveBeenCalled();
  });

  it("raises NotFoundError when the snapshot does not match the project and artifact", async () => {
    const deps = makeDependencies();
    deps.artifactRepository.getSnapshotById.mockResolvedValue(null);
    const module = new RefinementApplicationModule(deps);

    await expect(
      module.approveOrRejectArtifact({
        projectId: "project-001",
        artifactKey: "objective_and_outcome",
        artifactSnapshotId: "nonexistent",
        decision: "approve",
        decisionReason: "Reason",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not mark the last artifact downstream stale when it is approved", async () => {
    const deps = makeDependencies();
    const snap = makeSnapshot("risks_assumptions_and_open_questions", "draft");
    deps.artifactRepository.getSnapshotById.mockResolvedValue(snap);
    deps.artifactRepository.approveSnapshot.mockResolvedValue(
      makeSnapshot("risks_assumptions_and_open_questions", "approved"),
    );

    const module = new RefinementApplicationModule(deps);
    await module.approveOrRejectArtifact({
      projectId: "project-001",
      artifactKey: "risks_assumptions_and_open_questions",
      artifactSnapshotId: snap.artifact_snapshot_id,
      decision: "approve",
      decisionReason: "All risks accounted for",
    });

    expect(deps.artifactRepository.markDownstreamSnapshotsStale).toHaveBeenCalledWith(
      "project-001",
      [],
    );
  });
});

describe("Provider-neutral generation", () => {
  it("normalizes a non-timeout engine error into a failed job", async () => {
    const deps = makeDependencies();
    deps.refinementEngine.generateArtifactContent.mockRejectedValue(
      new Error("Unexpected error from provider"),
    );
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("failed", { error_message: "Unexpected error from provider" }),
    );

    const module = new RefinementApplicationModule(deps);
    const result = await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "objective_and_outcome",
      generationTrigger: "generate",
    });

    expect(result.job.status).toBe("failed");
    expect(result.snapshot).toBeNull();
  });

  it("passes current upstream drafts into generation context", async () => {
    const deps = makeDependencies();
    const approvedSnap = makeSnapshot("objective_and_outcome", "approved");
    const currentSnapshots = makeEmptyCurrentSnapshots();
    currentSnapshots.set("objective_and_outcome", approvedSnap);
    deps.artifactRepository.getAllCurrentSnapshots.mockResolvedValue(currentSnapshots);
    const newSnap = makeSnapshot("background_and_current_situation", "draft");
    deps.artifactRepository.createSnapshot.mockResolvedValue(newSnap);
    deps.generationJobRepository.updateJobStatus.mockResolvedValue(
      makeJob("completed", { artifact_snapshot_id: newSnap.artifact_snapshot_id }),
    );

    const module = new RefinementApplicationModule(deps);
    await module.generateArtifactDraft({
      projectId: "project-001",
      artifactKey: "background_and_current_situation",
      generationTrigger: "generate",
    });

    expect(deps.refinementEngine.generateArtifactContent).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamSnapshots: [approvedSnap],
      }),
    );
  });
});
