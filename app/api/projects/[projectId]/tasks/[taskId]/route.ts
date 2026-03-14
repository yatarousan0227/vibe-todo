import { NextResponse } from "next/server";
import {
  NotFoundError,
  ValidationError,
  planningApplicationModule,
} from "@/src/lib/planning/application-module";
import type { TaskPriority, TaskStatus } from "@/src/lib/planning/types";

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

interface TaskPatchRequest {
  taskPlanSnapshotId: string;
  taskPatch: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    dependencies?: string[];
    estimate?: string | null;
    assignee?: string | null;
  };
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ projectId: string; taskId: string }>;
  },
) {
  try {
    const { projectId, taskId } = await context.params;
    const body = (await request.json()) as TaskPatchRequest;

    if (!body.taskPlanSnapshotId) {
      return errorResponse({
        message: "taskPlanSnapshotId is required",
        status: 400,
        code: "missing_snapshot_id",
        recoverable: true,
      });
    }

    if (!body.taskPatch || typeof body.taskPatch !== "object") {
      return errorResponse({
        message: "taskPatch is required",
        status: 400,
        code: "missing_patch",
        recoverable: true,
      });
    }

    const result = await planningApplicationModule.updateTask({
      projectId,
      taskId,
      taskPlanSnapshotId: body.taskPlanSnapshotId,
      patch: body.taskPatch,
    });

    return NextResponse.json({
      taskUpdateResult: {
        task: result.task,
        publishBlockers: result.publishBlockers,
        publishBlockerCount: result.publishBlockers.length,
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

    return errorResponse({
      message: "Task update could not be completed.",
      status: 500,
      code: "task_update_failed",
      recoverable: false,
    });
  }
}
