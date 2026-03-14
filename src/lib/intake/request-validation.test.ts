import { describe, expect, it } from "vitest";
import { sanitizeIntakePayload } from "./model";
import { ValidationError } from "./service";
import { assertConfirmPayload, assertDraftSavePayload } from "./request-validation";

describe("intake request validation", () => {
  it("allows draft saves with only the shared minimum fields", () => {
    const payload = sanitizeIntakePayload({
      planning_mode: "daily_work",
      structured_input: {
        title: "Weekly finance close",
        objective: "Stabilize the weekly handoff",
        background_or_current_situation: "The process varies each week",
      },
      free_form_input: {
        body: "",
      },
    });

    expect(() => assertDraftSavePayload(payload)).not.toThrow();
    expect(() => assertConfirmPayload(payload)).toThrow(ValidationError);
  });

  it("rejects draft saves when the shared intake scaffolding is missing", () => {
    const payload = sanitizeIntakePayload({
      planning_mode: "project",
      structured_input: {
        title: "Neighborhood clean-up",
        objective: "",
        background_or_current_situation: "",
      },
      free_form_input: {
        body: "Need volunteers and city coordination",
      },
    });

    expect(() => assertDraftSavePayload(payload)).toThrow(ValidationError);
  });
});
