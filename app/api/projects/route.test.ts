import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceContext } from "@/src/lib/intake/types";

const serviceMocks = vi.hoisted(() => {
  class MockValidationError extends Error {}
  class MockConflictError extends Error {}

  return {
    ValidationError: MockValidationError,
    ConflictError: MockConflictError,
    handleSaveProjectDraft: vi.fn(),
    handleInitializeProjectFromIntake: vi.fn(),
  };
});

vi.mock("@/src/lib/intake/service", () => serviceMocks);

const sampleWorkspaceContext: WorkspaceContext = {
  project: {
    projectId: "project-123",
    title: "Neighborhood clean-up",
    planningMode: "project",
    lifecycleStatus: "draft_intake",
    draftIntakePayload: {
      planning_mode: "project",
      structured_input: {
        title: "Neighborhood clean-up",
        objective: "Coordinate volunteers",
        background_or_current_situation: "Park cleanup is overdue",
        scope_summary: "Clean the park and sort donated tools",
        stakeholders: "Neighbors, city staff, community lead",
        expected_outcome_or_deliverable: "",
        constraints_or_conditions: "Finish before the weekend market",
      },
      free_form_input: {
        body: "Line one\nLine two",
      },
    },
    confirmedIntakeSnapshot: null,
    confirmedAt: null,
  },
  refinementSession: null,
  allowedActions: {
    canSaveDraft: true,
    canReview: true,
    canConfirm: true,
  },
};

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/projects", () => {
  it("delegates draft saves and returns lifecycle plus allowed actions", async () => {
    serviceMocks.handleSaveProjectDraft.mockResolvedValue(sampleWorkspaceContext);
    const { POST } = await import("./route");

    const response = await POST(
      createRequest({
        projectId: "project-123",
        generationTrigger: "draft_save",
        project: {
          planning_mode: "project",
          structuredInput: sampleWorkspaceContext.project.draftIntakePayload.structured_input,
          freeFormInput: sampleWorkspaceContext.project.draftIntakePayload.free_form_input,
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(serviceMocks.handleSaveProjectDraft).toHaveBeenCalledWith({
      projectId: "project-123",
      payload: sampleWorkspaceContext.project.draftIntakePayload,
    });
    expect(body.project).toMatchObject({
      projectId: "project-123",
      lifecycleStatus: "draft_intake",
    });
    expect(body.allowedActions).toMatchObject({
      canReview: true,
      canConfirm: true,
    });
  });

  it("delegates intake confirmation to the application module command", async () => {
    serviceMocks.handleInitializeProjectFromIntake.mockResolvedValue({
      ...sampleWorkspaceContext,
      project: {
        ...sampleWorkspaceContext.project,
        lifecycleStatus: "confirmed",
        confirmedIntakeSnapshot: sampleWorkspaceContext.project.draftIntakePayload,
        confirmedAt: "2026-03-14T09:00:00.000Z",
      },
      refinementSession: {
        refinement_session_id: "session-123",
        project_id: "project-123",
        status: "active",
        active_artifact_key: "objective_and_outcome",
        last_generation_at: null,
        created_at: "2026-03-14T09:00:00.000Z",
      },
      allowedActions: {
        canSaveDraft: true,
        canReview: true,
        canConfirm: false,
      },
    });
    const { POST } = await import("./route");

    const response = await POST(
      createRequest({
        projectId: "project-123",
        generationTrigger: "intake_confirm",
        project: {
          planning_mode: "project",
          structuredInput: sampleWorkspaceContext.project.draftIntakePayload.structured_input,
          freeFormInput: sampleWorkspaceContext.project.draftIntakePayload.free_form_input,
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(serviceMocks.handleInitializeProjectFromIntake).toHaveBeenCalledWith({
      projectId: "project-123",
      payload: sampleWorkspaceContext.project.draftIntakePayload,
    });
    expect(body.project).toMatchObject({
      lifecycleStatus: "confirmed",
    });
    expect(body.refinementSession).toMatchObject({
      active_artifact_key: "objective_and_outcome",
    });
    expect(body.allowedActions).toMatchObject({
      canConfirm: false,
    });
  });

  it("returns a recoverable validation error for invalid draft payloads", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      createRequest({
        generationTrigger: "draft_save",
        project: {
          planning_mode: "project",
          structuredInput: {
            title: "Only title",
            objective: "",
            background_or_current_situation: "",
          },
          freeFormInput: {
            body: "",
          },
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(serviceMocks.handleSaveProjectDraft).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      errorCode: "validation_error",
      recoverable: true,
    });
  });

  it("returns a recoverable conflict error when confirmation finds an active session", async () => {
    serviceMocks.handleInitializeProjectFromIntake.mockRejectedValue(
      new serviceMocks.ConflictError(
        "An active refinement session already exists for this project.",
      ),
    );
    const { POST } = await import("./route");

    const response = await POST(
      createRequest({
        projectId: "project-123",
        generationTrigger: "intake_confirm",
        project: {
          planning_mode: "project",
          structuredInput: sampleWorkspaceContext.project.draftIntakePayload.structured_input,
          freeFormInput: sampleWorkspaceContext.project.draftIntakePayload.free_form_input,
        },
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      errorCode: "active_session_conflict",
      recoverable: true,
    });
  });
});
