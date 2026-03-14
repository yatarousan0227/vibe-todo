import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceContext } from "@/src/lib/intake/types";

const serviceMocks = vi.hoisted(() => {
  class MockNotFoundError extends Error {}

  return {
    NotFoundError: MockNotFoundError,
    getWorkspaceContext: vi.fn(),
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

async function readJson<T>(response: Response) {
  return response.json() as Promise<T>;
}

interface WorkspaceContextResponseBody {
  project: {
    projectId: string;
    lifecycleStatus: string;
    draftIntakePayload?: {
      free_form_input?: {
        body?: string;
      };
    };
  };
  allowedActions: {
    canReview: boolean;
    canConfirm: boolean;
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/[projectId]/workspace-context", () => {
  it("returns the resumable workspace context for an existing draft", async () => {
    serviceMocks.getWorkspaceContext.mockResolvedValue(sampleWorkspaceContext);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost:3000"), {
      params: Promise.resolve({
        projectId: "project-123",
      }),
    });
    const body = await readJson<WorkspaceContextResponseBody>(response);

    expect(response.status).toBe(200);
    expect(serviceMocks.getWorkspaceContext).toHaveBeenCalledWith("project-123");
    expect(body.project).toMatchObject({
      projectId: "project-123",
      lifecycleStatus: "draft_intake",
    });
    expect(body.project.draftIntakePayload).toMatchObject({
      free_form_input: {
        body: "Line one\nLine two",
      },
    });
    expect(body.allowedActions).toMatchObject({
      canReview: true,
      canConfirm: true,
    });
  });

  it("returns a recoverable not-found error when the draft does not exist", async () => {
    serviceMocks.getWorkspaceContext.mockRejectedValue(
      new serviceMocks.NotFoundError("Draft not found for the supplied project ID."),
    );
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost:3000"), {
      params: Promise.resolve({
        projectId: "missing-project",
      }),
    });
    const body = await readJson<Record<string, unknown>>(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      error: "Draft not found for the supplied project ID.",
      errorCode: "project_not_found",
      recoverable: true,
    });
  });
});
