import { hasAllRequiredFields, hasMinimumSharedFields } from "./model";
import {
  ConflictError,
  NotFoundError,
  intakeApplicationModule,
} from "./application-module";
import type {
  InitializeProjectFromIntakeInput,
  SaveProjectDraftInput,
  WorkspaceProjectContext,
  WorkspaceContext,
} from "./types";

export class ValidationError extends Error {}

function buildWorkspaceContext(input: {
  workspace: WorkspaceProjectContext;
}): WorkspaceContext {
  return {
    ...input.workspace,
    allowedActions: {
      canSaveDraft: hasMinimumSharedFields(
        input.workspace.project.draftIntakePayload,
      ),
      canReview: hasAllRequiredFields(input.workspace.project.draftIntakePayload),
      canConfirm:
        hasAllRequiredFields(input.workspace.project.draftIntakePayload) &&
        input.workspace.project.lifecycleStatus !== "confirmed",
    },
  };
}

export async function handleSaveProjectDraft(
  input: SaveProjectDraftInput,
): Promise<WorkspaceContext> {
  return buildWorkspaceContext({
    workspace: await intakeApplicationModule.saveProjectDraft(input),
  });
}

export async function handleInitializeProjectFromIntake(
  input: InitializeProjectFromIntakeInput,
): Promise<WorkspaceContext> {
  return buildWorkspaceContext({
    workspace: await intakeApplicationModule.initializeProjectFromIntake(input),
  });
}

export async function getWorkspaceContext(projectId: string): Promise<WorkspaceContext> {
  return buildWorkspaceContext({
    workspace: await intakeApplicationModule.getWorkspaceContext(projectId),
  });
}

export { ConflictError, NotFoundError };
