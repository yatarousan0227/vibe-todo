import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import type { ApproveOrRejectArtifactResult } from "@/src/lib/refinement/types";

vi.mock("@/src/lib/refinement/application-module", () => ({
  refinementApplicationModule: {
    approveOrRejectArtifact: vi.fn(),
  },
  NotFoundError: class NotFoundError extends Error {},
  ValidationError: class ValidationError extends Error {},
  SequenceGatingError: class SequenceGatingError extends Error {},
}));

import {
  refinementApplicationModule,
  NotFoundError,
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

const approveResult: ApproveOrRejectArtifactResult = {
  audit: {
    approval_audit_id: "audit-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    artifact_snapshot_id: "snap-001",
    decision: "approve",
    decision_reason: "Looks good",
    decided_at: "2026-03-14T09:00:00.000Z",
  },
  snapshot: {
    artifact_snapshot_id: "snap-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    version_number: 1,
    body: "Content",
    change_reason: "First draft",
    generation_trigger: "generate",
    approval_status: "approved",
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:00:00.000Z",
  },
  staleDependencies: {
    downstreamArtifacts: [],
    taskPlanAffected: false,
    taskPlanFreshnessStatus: null,
  },
  readiness: { isReady: false, blockedBy: ["background_and_current_situation"] },
};

describe("POST /api/projects/[projectId]/artifacts/[artifactKey]/approvals", () => {
  beforeEach(() => {
    vi.mocked(refinementApplicationModule.approveOrRejectArtifact).mockResolvedValue(
      approveResult,
    );
  });

  it("approves a snapshot and returns the result", async () => {
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "approve",
        decisionReason: "All objectives are clear and measurable",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { artifactApprovalResult: { audit: { decision: string } } };
    expect(body.artifactApprovalResult.audit.decision).toBe("approve");
  });

  it("returns 400 for an unknown artifact key", async () => {
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "approve",
        decisionReason: "Reason",
      }),
      makeContext("project-001", "not_a_real_artifact"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("invalid_artifact_key");
  });

  it("returns 400 when artifactSnapshotId is missing", async () => {
    const response = await POST(
      makeRequest({
        approvalDecision: "approve",
        decisionReason: "Reason",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("missing_snapshot_id");
  });

  it("returns 400 when approvalDecision is invalid", async () => {
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "auto",
        decisionReason: "Reason",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("invalid_approval_decision");
  });

  it("returns 400 when decisionReason is missing", async () => {
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "approve",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { errorCode: string };
    expect(body.errorCode).toBe("missing_decision_reason");
  });

  it("returns 404 when the snapshot does not exist", async () => {
    vi.mocked(refinementApplicationModule.approveOrRejectArtifact).mockRejectedValue(
      new NotFoundError("Snapshot not found"),
    );
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "nonexistent",
        approvalDecision: "approve",
        decisionReason: "Reason",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 when the module raises a validation error for empty reason", async () => {
    vi.mocked(refinementApplicationModule.approveOrRejectArtifact).mockRejectedValue(
      new ValidationError("A decision reason is required."),
    );
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "approve",
        decisionReason: "   ",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a snapshot without triggering downstream stale propagation", async () => {
    vi.mocked(refinementApplicationModule.approveOrRejectArtifact).mockResolvedValue({
      ...approveResult,
      audit: { ...approveResult.audit, decision: "reject", decision_reason: "Needs rework" },
      snapshot: { ...approveResult.snapshot, approval_status: "draft" },
      staleDependencies: { downstreamArtifacts: [], taskPlanAffected: false, taskPlanFreshnessStatus: null },
    });
    const response = await POST(
      makeRequest({
        artifactSnapshotId: "snap-001",
        approvalDecision: "reject",
        decisionReason: "Needs rework",
      }),
      makeContext("project-001", "objective_and_outcome"),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { artifactApprovalResult: { audit: { decision: string } } };
    expect(body.artifactApprovalResult.audit.decision).toBe("reject");
  });
});
