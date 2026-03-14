import { NextResponse } from "next/server";
import {
  ConflictError,
  ValidationError,
  handleInitializeProjectFromIntake,
  handleSaveProjectDraft,
} from "@/src/lib/intake/service";
import { sanitizeIntakePayload } from "@/src/lib/intake/model";
import {
  assertConfirmPayload,
  assertDraftSavePayload,
} from "@/src/lib/intake/request-validation";

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

interface ProjectCommandRequest {
  projectId?: string;
  generationTrigger?: string;
  project?: {
    planning_mode?: unknown;
    structuredInput?: Record<string, unknown>;
    freeFormInput?: {
      body?: unknown;
    };
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProjectCommandRequest;
    const payload = sanitizeIntakePayload({
      planning_mode: body.project?.planning_mode,
      structured_input: body.project?.structuredInput,
      free_form_input: body.project?.freeFormInput,
    });

    if (body.generationTrigger === "intake_confirm") {
      assertConfirmPayload(payload);
      const response = await handleInitializeProjectFromIntake({
        projectId: body.projectId,
        payload,
      });

      return NextResponse.json(response);
    }

    assertDraftSavePayload(payload);
    const response = await handleSaveProjectDraft({
      projectId: body.projectId,
      payload,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse({
        message: error.message,
        status: 400,
        code: "validation_error",
        recoverable: true,
      });
    }

    if (error instanceof ConflictError) {
      return errorResponse({
        message: error.message,
        status: 409,
        code: "active_session_conflict",
        recoverable: true,
      });
    }

    return errorResponse({
      message: "The project command could not be completed.",
      status: 500,
      code: "project_command_failed",
      recoverable: false,
    });
  }
}
