import { hasAllRequiredFields, hasMinimumSharedFields } from "./model";
import { getDraftEditorFieldDefinitions } from "./editor-fields";
import type {
  LifecycleStatus,
  PlanningMode,
  StructuredInput,
  WorkspaceContext,
} from "./types";

export type ScreenState = "draft" | "review";

export interface IntakeEditorState {
  planningMode: PlanningMode;
  projectId: string;
  structuredInput: StructuredInput;
  freeFormBody: string;
}

export interface ReviewSummaryItem {
  label: string;
  value: string;
}

export function buildEditorStateFromWorkspaceContext(
  workspaceContext: WorkspaceContext,
): IntakeEditorState {
  return {
    planningMode: workspaceContext.project.planningMode,
    projectId: workspaceContext.project.projectId,
    structuredInput: workspaceContext.project.draftIntakePayload.structured_input,
    freeFormBody: workspaceContext.project.draftIntakePayload.free_form_input.body,
  };
}

export function getIntakeActionAvailability(input: {
  lifecycleStatus: LifecycleStatus;
  payload: WorkspaceContext["project"]["draftIntakePayload"];
}) {
  const hasRequiredFields = hasAllRequiredFields(input.payload);

  return {
    canSaveDraft: hasMinimumSharedFields(input.payload),
    canReview: hasRequiredFields,
    canConfirm: hasRequiredFields && input.lifecycleStatus !== "confirmed",
  };
}

export function getReviewStructuredSummaryItems(input: {
  planningMode: PlanningMode;
  structuredInput: StructuredInput;
}): ReviewSummaryItem[] {
  return getDraftEditorFieldDefinitions(input.planningMode)
    .flatMap((field) =>
      field.name === "free_form_context"
        ? []
        : [
            {
              label: field.label,
              value: input.structuredInput[field.name],
            },
          ],
    );
}

export function buildRefinementPath(input: {
  projectId: string;
  activeArtifactKey: string;
}) {
  const projectId = encodeURIComponent(input.projectId);
  const artifactKey = encodeURIComponent(input.activeArtifactKey);

  return `/projects/${projectId}/refinement?artifactKey=${artifactKey}`;
}
