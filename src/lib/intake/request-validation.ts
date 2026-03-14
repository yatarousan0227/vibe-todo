import { hasAllRequiredFields, hasMinimumSharedFields } from "./model";
import { ValidationError } from "./service";
import type { IntakePayload } from "./types";

export function assertDraftSavePayload(payload: IntakePayload) {
  if (!hasMinimumSharedFields(payload)) {
    throw new ValidationError(
      "Save draft requires title, objective, and background or current situation.",
    );
  }
}

export function assertConfirmPayload(payload: IntakePayload) {
  if (!hasAllRequiredFields(payload)) {
    throw new ValidationError(
      "Confirm and start refinement requires all mode-specific required fields and free-form context.",
    );
  }
}
