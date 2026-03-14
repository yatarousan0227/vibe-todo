import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import type { GenerateArtifactDraftResult } from "@/src/lib/refinement/types";

vi.mock("@/src/lib/refinement/application-module", () => ({
  refinementApplicationModule: {
    generateArtifactDraft: vi.fn(),
  },
  NotFoundError: class NotFoundError extends Error {},
  ValidationError: class ValidationError extends Error {},
  SequenceGatingError: class SequenceGatingError extends Error {},
}));

import {
  refinementApplicationModule,
  NotFoundError,
  SequenceGatingError,
  ValidationError,
} from "@/src/lib/refinement/application-module";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeContext(projectId: string, artifactKey: string) {
  return { params: Promise.resolve({ projectId, artifactKey }) };
}

const completedJobResult: GenerateArtifactDraftResult = {
  job: {
    generation_job_id: "job-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    status: "completed",
    artifact_snapshot_id: "snap-001",
    error_message: null,
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:01:00.000Z",
  },
  snapshot: {
    artifact_snapshot_id: "snap-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    version_number: 1,
    body: "Generated content",
    change_reason: "First draft",
    generation_trigger: "generate",
    approval_status: "draft",
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:00:00.000Z",
  },
};

describe("POST /api/projects/[projectId]/artifacts/[artifactKey]/generations", () => {
  beforeEach(() => {
    vi.mocked(refinementApplicationModule.generateArtifactDraft).mockResolvedValue(
      completedJobResult,
    );
  });

  it("returns a completed job result for a valid first generation", async () => {
    const response = await POST(
      makeRequest({ generationTrigger: "generate" }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { artifactGenerationResult: { jobStatus: string } };
    expect(body.artifactGenerationResult.jobStatus).toBe("completed");
  });

  it("returns 400 for an unknown artifact key", async () => {
    const response = await POST(
      makeRequest({ generationTrigger: "generate" }),
      makeContext("project-001", "invalid_artifact"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("invalid_artifact_key");
  });

  it("returns 400 for an invalid generation trigger", async () => {
    const response = await POST(
      makeRequest({ generationTrigger: "auto_approve" }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("invalid_trigger");
  });

  it("returns 400 when user_edit trigger is missing userEditBody", async () => {
    const response = await POST(
      makeRequest({ generationTrigger: "user_edit" }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("missing_edit_body");
  });

  it("returns 404 when project is not found", async () => {
    vi.mocked(refinementApplicationModule.generateArtifactDraft).mockRejectedValue(
      new NotFoundError("Project not found"),
    );
    const response = await POST(
      makeRequest({ generationTrigger: "generate" }),
      makeContext("missing-project", "objective_and_outcome"),
    );
    expect(response.status).toBe(404);
  });

  it("returns 422 when upstream sequence gate is not satisfied", async () => {
    vi.mocked(refinementApplicationModule.generateArtifactDraft).mockRejectedValue(
      new SequenceGatingError("Upstream not approved"),
    );
    const response = await POST(
      makeRequest({ generationTrigger: "generate" }),
      makeContext("project-001", "background_and_current_situation"),
    );
    expect(response.status).toBe(422);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("sequence_gating_error");
  });

  it("accepts user_edit trigger with userEditBody", async () => {
    const response = await POST(
      makeRequest({
        generationTrigger: "user_edit",
        userEditBody: "My custom content",
        changeReason: "User wrote manually",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(200);
    expect(
      vi.mocked(refinementApplicationModule.generateArtifactDraft),
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        generationTrigger: "user_edit",
        userEditBody: "My custom content",
      }),
    );
  });
});
