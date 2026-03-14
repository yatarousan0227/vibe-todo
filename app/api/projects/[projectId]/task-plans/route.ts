import { NextResponse } from "next/server";
import {
  NotFoundError,
  ValidationError,
  EligibilityError,
  PublishBlockedError,
  planningApplicationModule,
} from "@/src/lib/planning/application-module";
import { refinementApplicationModule } from "@/src/lib/refinement/application-module";

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

interface TaskPlanRequest {
  generationTrigger?: string;
  taskPlanSnapshotId?: string;
  approvalDecision?: string;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ projectId: string }>;
  },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as TaskPlanRequest;

    if (body.approvalDecision === "publish") {
      if (!body.taskPlanSnapshotId) {
        return errorResponse({
          message: "taskPlanSnapshotId is required when approvalDecision is publish",
          status: 400,
          code: "missing_snapshot_id",
          recoverable: true,
        });
      }

      const result = await planningApplicationModule.publishTaskPlan({
        projectId,
        taskPlanSnapshotId: body.taskPlanSnapshotId,
      });

      return NextResponse.json({
        taskPlanPublishResult: {
          snapshot: result.snapshot,
          previousSnapshotId: result.previousSnapshotId,
          workspaceHandoffState:
            result.snapshot.freshness_status === "published" ? "editable" : "read_only",
        },
      });
    }

    const trigger = body.generationTrigger ?? "synthesize";
    if (!["synthesize", "regenerate"].includes(trigger)) {
      return errorResponse({
        message: "generationTrigger must be synthesize or regenerate",
        status: 400,
        code: "invalid_trigger",
        recoverable: true,
      });
    }

    const refinementContext =
      await refinementApplicationModule.getProjectWorkspaceContext(projectId);

    const approvedSnapshots = refinementContext.artifactSummaries
      .filter(
        (s) => s.displayStatus === "approved" && s.currentSnapshotId !== null,
      )
      .map((s) => s.currentSnapshotId as string);

    if (!refinementContext.readiness.isReady) {
      return errorResponse({
        message: `Cannot synthesize task plan: required artifacts are not all approved. Blocked by: ${refinementContext.readiness.blockedBy.join(", ")}`,
        status: 422,
        code: "eligibility_error",
        recoverable: true,
      });
    }

    const result = await planningApplicationModule.synthesizeTaskPlan({
      projectId,
      generationTrigger: trigger as "synthesize" | "regenerate",
      sourceArtifactSnapshotIds: approvedSnapshots,
    });

    return NextResponse.json({
      taskPlanSynthesisResult: {
        jobId: result.job.synthesis_job_id,
        jobStatus: result.job.status,
        errorMessage: result.job.error_message,
        snapshot: result.snapshot
          ? {
              taskPlanSnapshotId: result.snapshot.task_plan_snapshot_id,
              freshnessStatus: result.snapshot.freshness_status,
              publishStatus: result.snapshot.publish_status,
              generatedAt: result.snapshot.generated_at,
              generatedFromArtifactSet:
                result.snapshot.generated_from_artifact_set,
              publishBlockerCount: result.snapshot.publish_blockers.length,
              publishBlockers: result.snapshot.publish_blockers,
            }
          : null,
        taskCount: result.tasks.length,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse({
        message: error.message,
        status: 404,
        code: "not_found",
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

    if (error instanceof EligibilityError) {
      return errorResponse({
        message: error.message,
        status: 422,
        code: "eligibility_error",
        recoverable: true,
      });
    }

    if (error instanceof PublishBlockedError) {
      return errorResponse({
        message: error.message,
        status: 422,
        code: "publish_blocked",
        recoverable: true,
      });
    }

    return errorResponse({
      message: "Task plan operation could not be completed.",
      status: 500,
      code: "task_plan_failed",
      recoverable: false,
    });
  }
}
