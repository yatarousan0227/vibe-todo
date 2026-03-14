import type { IntakePayload, PlanningMode, StructuredInput } from "./types";

const PLANNING_MODES: PlanningMode[] = ["project", "daily_work"];

const EMPTY_STRUCTURED_INPUT: StructuredInput = {
  title: "",
  objective: "",
  background_or_current_situation: "",
  scope_summary: "",
  stakeholders: "",
  expected_outcome_or_deliverable: "",
  constraints_or_conditions: "",
};

const SHARED_REQUIRED_FIELDS: Array<keyof StructuredInput> = [
  "title",
  "objective",
  "background_or_current_situation",
];

const MODE_REQUIRED_FIELDS: Record<PlanningMode, Array<keyof StructuredInput>> = {
  project: [
    ...SHARED_REQUIRED_FIELDS,
    "scope_summary",
    "stakeholders",
    "constraints_or_conditions",
  ],
  daily_work: [
    ...SHARED_REQUIRED_FIELDS,
    "expected_outcome_or_deliverable",
    "constraints_or_conditions",
  ],
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFreeFormBody(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function isPlanningMode(value: unknown): value is PlanningMode {
  return typeof value === "string" && PLANNING_MODES.includes(value as PlanningMode);
}

export function sanitizeIntakePayload(input: {
  planning_mode?: unknown;
  structured_input?: Partial<StructuredInput> | null;
  free_form_input?: { body?: unknown } | null;
}): IntakePayload {
  const structuredInput = {
    ...EMPTY_STRUCTURED_INPUT,
    ...(input.structured_input ?? {}),
  };

  return {
    planning_mode: isPlanningMode(input.planning_mode) ? input.planning_mode : "project",
    structured_input: {
      title: normalizeText(structuredInput.title),
      objective: normalizeText(structuredInput.objective),
      background_or_current_situation: normalizeText(
        structuredInput.background_or_current_situation,
      ),
      scope_summary: normalizeText(structuredInput.scope_summary),
      stakeholders: normalizeText(structuredInput.stakeholders),
      expected_outcome_or_deliverable: normalizeText(
        structuredInput.expected_outcome_or_deliverable,
      ),
      constraints_or_conditions: normalizeText(
        structuredInput.constraints_or_conditions,
      ),
    },
    free_form_input: {
      body: normalizeFreeFormBody(input.free_form_input?.body),
    },
  };
}

function hasRequiredStructuredFields(
  structuredInput: StructuredInput,
  fields: Array<keyof StructuredInput>,
): boolean {
  return fields.every((fieldName) => structuredInput[fieldName].length > 0);
}

export function hasMinimumSharedFields(payload: IntakePayload): boolean {
  return hasRequiredStructuredFields(payload.structured_input, SHARED_REQUIRED_FIELDS);
}

export function hasAllRequiredFields(payload: IntakePayload): boolean {
  return (
    hasRequiredStructuredFields(
      payload.structured_input,
      MODE_REQUIRED_FIELDS[payload.planning_mode],
    ) && payload.free_form_input.body.trim().length > 0
  );
}

export function getModeRequiredFieldNames(
  planningMode: PlanningMode,
): Array<keyof StructuredInput | "free_form_context"> {
  return [...MODE_REQUIRED_FIELDS[planningMode], "free_form_context"];
}
