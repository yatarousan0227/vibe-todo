import { NextResponse } from "next/server";
import {
  NotFoundError,
  planningApplicationModule,
} from "@/src/lib/planning/application-module";
import { taskPlanRepository } from "@/src/lib/planning/repository";

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
    params: Promise<{ projectId: string; snapshotId: string }>;
  },
) {
  try {
    const { projectId, snapshotId } = await context.params;

    const snapshot = await taskPlanRepository.getSnapshotById(snapshotId);
    if (!snapshot || snapshot.project_id !== projectId) {
      return errorResponse({
        message: `Task plan snapshot not found: ${snapshotId}`,
        status: 404,
        code: "snapshot_not_found",
        recoverable: true,
      });
    }

    const tasks = await planningApplicationModule.getTasksForSnapshot(snapshotId);

    return NextResponse.json({
      tasks,
      publishBlockers: snapshot.publish_blockers,
      publishBlockerCount: snapshot.publish_blockers.length,
      snapshotId,
      freshnessStatus: snapshot.freshness_status,
      publishStatus: snapshot.publish_status,
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

    return errorResponse({
      message: "Tasks could not be loaded.",
      status: 500,
      code: "tasks_load_failed",
      recoverable: false,
    });
  }
}
