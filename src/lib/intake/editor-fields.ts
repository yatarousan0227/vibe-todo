import { hasAllRequiredFields, hasMinimumSharedFields } from "./model";
import type { IntakePayload, PlanningMode, StructuredInput } from "./types";

export type DraftEditorFieldName = keyof StructuredInput | "free_form_context";
type DraftEditorFieldType = "text" | "textarea";

export interface DraftEditorFieldDefinition {
  name: DraftEditorFieldName;
  label: string;
  type: DraftEditorFieldType;
}

const SHARED_FIELD_DEFINITIONS: DraftEditorFieldDefinition[] = [
  {
    name: "title",
    label: "Title",
    type: "text",
  },
  {
    name: "objective",
    label: "Objective",
    type: "textarea",
  },
  {
    name: "background_or_current_situation",
    label: "Background or current situation",
    type: "textarea",
  },
];

const MODE_FIELD_DEFINITIONS: Record<
  PlanningMode,
  DraftEditorFieldDefinition[]
> = {
  project: [
    {
      name: "scope_summary",
      label: "Scope summary",
      type: "textarea",
    },
    {
      name: "stakeholders",
      label: "Stakeholders",
      type: "textarea",
    },
  ],
  daily_work: [
    {
      name: "expected_outcome_or_deliverable",
      label: "Expected outcome or deliverable",
      type: "textarea",
    },
  ],
};

const SHARED_REVIEW_FIELD_DEFINITIONS: DraftEditorFieldDefinition[] = [
  {
    name: "constraints_or_conditions",
    label: "Constraints or conditions",
    type: "textarea",
  },
  {
    name: "free_form_context",
    label: "Free-form context",
    type: "textarea",
  },
];

export function getDraftEditorFieldDefinitions(
  planningMode: PlanningMode,
): DraftEditorFieldDefinition[] {
  return [
    ...SHARED_FIELD_DEFINITIONS,
    ...MODE_FIELD_DEFINITIONS[planningMode],
    ...SHARED_REVIEW_FIELD_DEFINITIONS,
  ];
}

export function getDraftEditorActionAvailability(payload: IntakePayload) {
  return {
    canSaveDraft: hasMinimumSharedFields(payload),
    canReview: hasAllRequiredFields(payload),
  };
}
