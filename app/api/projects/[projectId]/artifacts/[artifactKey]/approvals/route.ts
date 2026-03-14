import { NextResponse } from "next/server";
import {
  NotFoundError,
  ValidationError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { isValidArtifactKey } from "@/src/lib/refinement/model";

export const runtime = "nodejs";

function errorResponse(input: {
  message: string;
  status: number;
  code: string;
  recoverable: boolean;
}) {
  return NextResponse.json(
    {
      error: input.message,
      errorCode: input.code,
      recoverable: input.recoverable,
    },
    { status: input.status },
  );
}

interface ApprovalRequest {
  artifactSnapshotId?: string;
  approvalDecision?: string;
  decisionReason?: string;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ projectId: string; artifactKey: string }>;
  },
) {
  try {
    const { projectId, artifactKey } = await context.params;

    if (!isValidArtifactKey(artifactKey)) {
      return errorResponse({
        message: `Unknown artifact key: ${artifactKey}`,
        status: 400,
        code: "invalid_artifact_key",
        recoverable: true,
      });
    }

    const body = (await request.json()) as ApprovalRequest;

    if (!body.artifactSnapshotId) {
      return errorResponse({
        message: "artifactSnapshotId is required",
        status: 400,
        code: "missing_snapshot_id",
        recoverable: true,
      });
    }

    if (!body.approvalDecision || !["approve", "reject"].includes(body.approvalDecision)) {
      return errorResponse({
        message: "approvalDecision must be approve or reject",
        status: 400,
        code: "invalid_approval_decision",
        recoverable: true,
      });
    }

    if (!body.decisionReason?.trim()) {
      return errorResponse({
        message: "decisionReason is required",
        status: 400,
        code: "missing_decision_reason",
        recoverable: true,
      });
    }

    const result = await refinementApplicationModule.approveOrRejectArtifact({
      projectId,
      artifactKey,
      artifactSnapshotId: body.artifactSnapshotId,
      decision: body.approvalDecision as "approve" | "reject",
      decisionReason: body.decisionReason,
    });

    return NextResponse.json({
      artifactApprovalResult: {
        audit: result.audit,
        snapshot: result.snapshot,
        staleDependencies: result.staleDependencies,
        readiness: result.readiness,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse({
        message: error.message,
        status: 404,
        code: "snapshot_not_found",
        recoverable: true,
      });
    }

    if (error instanceof ValidationError) {
      return errorResponse({
        message: error.message,
        status: 400,
        code: "validation_error",
        recoverable: true,
      });
    }

    return errorResponse({
      message: "Artifact approval could not be completed.",
      status: 500,
      code: "approval_failed",
      recoverable: false,
    });
  }
}
