import { describe, expect, it, vi } from "vitest";
import { schemaStatements } from "./db";
import {
  createProjectRepository,
  createRefinementSessionRepository,
} from "./repository";
import type { IntakePayload } from "./types";

const samplePayload: IntakePayload = {
  planning_mode: "project",
  structured_input: {
    title: "Neighborhood clean-up",
    objective: "Coordinate volunteers",
    background_or_current_situation: "The park is overdue for a reset",
    scope_summary: "Clean the park and sort donated tools",
    stakeholders: "Neighbors, city staff, community lead",
    expected_outcome_or_deliverable: "",
    constraints_or_conditions: "Finish before the weekend market",
  },
  free_form_input: {
    body: "Line one\nLine two",
  },
};

function createProjectRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    project_id: "project-123",
    title: samplePayload.structured_input.title,
    planning_mode: samplePayload.planning_mode,
    lifecycle_status: "draft_intake",
    draft_intake_payload: samplePayload,
    confirmed_intake_snapshot: null,
    created_at: new Date("2026-03-14T08:00:00.000Z"),
    updated_at: new Date("2026-03-14T08:05:00.000Z"),
    confirmed_at: null,
    ...overrides,
  };
}

function createSessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    refinement_session_id: "session-123",
    project_id: "project-123",
    status: "active",
    active_artifact_key: "objective_and_outcome",
    last_generation_at: null,
    created_at: new Date("2026-03-14T08:06:00.000Z"),
    ...overrides,
  };
}

describe("intake repositories", () => {
  it("upserts a project draft by project_id", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [createProjectRow()],
      }),
    };

    const repository = createProjectRepository(executor as never);
    const result = await repository.upsertDraft({
      projectId: "project-123",
      payload: samplePayload,
    });

    expect(executor.query).toHaveBeenCalledOnce();
    const [sql, values] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT (project_id)");
    expect(sql).toContain("lifecycle_status = 'draft_intake'");
    expect(values[0]).toBe("project-123");
    expect(values[3]).toBe(JSON.stringify(samplePayload));
    expect(result.project_id).toBe("project-123");
    expect(result.lifecycle_status).toBe("draft_intake");
  });

  it("marks the project as confirmed when intake is confirmed", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [
          createProjectRow({
            lifecycle_status: "confirmed",
            confirmed_intake_snapshot: samplePayload,
            confirmed_at: new Date("2026-03-14T08:07:00.000Z"),
          }),
        ],
      }),
    };

    const repository = createProjectRepository(executor as never);
    const result = await repository.confirmIntake({
      projectId: "project-123",
      payload: samplePayload,
    });

    expect(executor.query).toHaveBeenCalledOnce();
    const [sql] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("lifecycle_status = 'confirmed'");
    expect(result.lifecycle_status).toBe("confirmed");
    expect(result.confirmed_intake_snapshot).toEqual(samplePayload);
    expect(result.confirmed_at).toBe("2026-03-14T08:07:00.000Z");
  });

  it("creates an active refinement session anchored to objective_and_outcome", async () => {
    const executor = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [createSessionRow()],
      }),
    };

    const repository = createRefinementSessionRepository(executor as never);
    const result = await repository.createActiveSession("project-123");

    expect(executor.query).toHaveBeenCalledOnce();
    const [sql, values] = executor.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO refinement_sessions");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'objective_and_outcome'");
    expect(values[1]).toBe("project-123");
    expect(result.project_id).toBe("project-123");
    expect(result.active_artifact_key).toBe("objective_and_outcome");
  });

  it("declares a partial unique index so only one active session exists per project", () => {
    expect(
      schemaStatements.some(
        (statement) =>
          statement.includes("CREATE UNIQUE INDEX") &&
          statement.includes("refinement_sessions(project_id)") &&
          statement.includes("WHERE status = 'active'"),
      ),
    ).toBe(true);
  });
});
