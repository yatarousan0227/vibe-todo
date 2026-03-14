import { NextResponse } from "next/server";
import { NotFoundError as IntakeNotFoundError, getWorkspaceContext } from "@/src/lib/intake/service";
import {
  NotFoundError as RefinementNotFoundError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { planningApplicationModule } from "@/src/lib/planning/application-module";

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

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      projectId: string;
    }>;
  },
) {
  try {
    const { projectId } = await context.params;

    const intakeContext = await getWorkspaceContext(projectId);

    if (intakeContext.project.lifecycleStatus !== "confirmed") {
      return NextResponse.json(intakeContext);
    }

    try {
      const refinementContext =
        await refinementApplicationModule.getProjectWorkspaceContext(projectId);

      const currentApprovedSnapshotIds = refinementContext.artifactSummaries
        .filter((s) => s.displayStatus === "approved" && s.currentSnapshotId)
        .map((s) => s.currentSnapshotId as string);

      await planningApplicationModule.markTaskPlanStaleIfNeeded(
        projectId,
        currentApprovedSnapshotIds,
      );

      const taskPlanSummary = await planningApplicationModule.getTaskPlanSummary(
        projectId,
        refinementContext.artifactSummaries,
      );

      return NextResponse.json({
        ...intakeContext,
        artifactSummaries: refinementContext.artifactSummaries,
        allowedActions: {
          ...intakeContext.allowedActions,
          canGenerate: refinementContext.allowedActions.canGenerate,
          canRegenerate: refinementContext.allowedActions.canRegenerate,
          canOpenApproval: refinementContext.allowedActions.canOpenApproval,
          canProceedToTaskSynthesis:
            refinementContext.allowedActions.canProceedToTaskSynthesis,
          canSynthesizeTaskPlan: taskPlanSummary.eligibility.isEligible,
          canRegenerateTaskPlan:
            taskPlanSummary.eligibility.isEligible &&
            taskPlanSummary.currentPublishedSnapshot !== null,
        },
        staleDependencies: refinementContext.staleDependencies,
        readiness: refinementContext.readiness,
        taskPlanSummary: {
          eligibility: taskPlanSummary.eligibility,
          jobStatus: taskPlanSummary.jobStatus,
          latestJobId: taskPlanSummary.latestJobId,
          workspaceHandoffState: taskPlanSummary.workspaceHandoffState,
          latestSnapshot: taskPlanSummary.latestSnapshot
            ? {
                taskPlanSnapshotId:
                  taskPlanSummary.latestSnapshot.task_plan_snapshot_id,
                freshnessStatus: taskPlanSummary.latestSnapshot.freshness_status,
                publishStatus: taskPlanSummary.latestSnapshot.publish_status,
                generatedAt: taskPlanSummary.latestSnapshot.generated_at,
                publishBlockerCount:
                  taskPlanSummary.latestSnapshot.publish_blockers.length,
              }
            : null,
          currentPublishedSnapshot: taskPlanSummary.currentPublishedSnapshot
            ? {
                taskPlanSnapshotId:
                  taskPlanSummary.currentPublishedSnapshot.task_plan_snapshot_id,
                freshnessStatus:
                  taskPlanSummary.currentPublishedSnapshot.freshness_status,
                generatedAt:
                  taskPlanSummary.currentPublishedSnapshot.generated_at,
                publishedAt:
                  taskPlanSummary.currentPublishedSnapshot.published_at,
                generatedFromArtifactSet:
                  taskPlanSummary.currentPublishedSnapshot
                    .generated_from_artifact_set,
              }
            : null,
          staleDependencies: taskPlanSummary.currentPublishedSnapshot
            ? {
                affectedSourceSnapshotIds:
                  taskPlanSummary.currentPublishedSnapshot.freshness_status ===
                  "stale"
                    ? taskPlanSummary.currentPublishedSnapshot.generated_from_artifact_set.filter(
                        (id) => !currentApprovedSnapshotIds.includes(id),
                      )
                    : [],
              }
            : null,
        },
      });
    } catch (refinementError) {
      if (refinementError instanceof RefinementNotFoundError) {
        return NextResponse.json(intakeContext);
      }
      throw refinementError;
    }
  } catch (error) {
    if (error instanceof IntakeNotFoundError) {
      return errorResponse({
        message: error.message,
        status: 404,
        code: "project_not_found",
        recoverable: true,
      });
    }

    return errorResponse({
      message: "The workspace context could not be loaded.",
      status: 500,
      code: "workspace_context_failed",
      recoverable: false,
    });
  }
}
