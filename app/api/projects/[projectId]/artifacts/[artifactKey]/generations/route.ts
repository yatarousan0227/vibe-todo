import { NextResponse } from "next/server";
import {
  NotFoundError,
  ValidationError,
  SequenceGatingError,
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

interface GenerationRequest {
  generationTrigger?: string;
  userPrompt?: string;
  userEditBody?: string;
  changeReason?: string;
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

    const body = (await request.json()) as GenerationRequest;
    const trigger = body.generationTrigger ?? "generate";

    if (!["generate", "regenerate", "user_edit"].includes(trigger)) {
      return errorResponse({
        message: "generationTrigger must be generate, regenerate, or user_edit",
        status: 400,
        code: "invalid_trigger",
        recoverable: true,
      });
    }

    if (trigger === "user_edit" && !body.userEditBody) {
      return errorResponse({
        message: "userEditBody is required when generationTrigger is user_edit",
        status: 400,
        code: "missing_edit_body",
        recoverable: true,
      });
    }

    const result = await refinementApplicationModule.generateArtifactDraft({
      projectId,
      artifactKey,
      generationTrigger: trigger as "generate" | "regenerate" | "user_edit",
      userPrompt: body.userPrompt,
      userEditBody: body.userEditBody,
      changeReason: body.changeReason,
    });

    return NextResponse.json({
      artifactGenerationResult: {
        jobId: result.job.generation_job_id,
        jobStatus: result.job.status,
        errorMessage: result.job.error_message,
        artifactKey,
        projectId,
        snapshot: result.snapshot,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse({
        message: error.message,
        status: 404,
        code: "project_not_found",
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

    if (error instanceof SequenceGatingError) {
      return errorResponse({
        message: error.message,
        status: 422,
        code: "sequence_gating_error",
        recoverable: true,
      });
    }

    return errorResponse({
      message: "Artifact generation could not be completed.",
      status: 500,
      code: "generation_failed",
      recoverable: false,
    });
  }
}
