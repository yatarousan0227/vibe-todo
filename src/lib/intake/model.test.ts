import { describe, expect, it } from "vitest";
import {
  hasAllRequiredFields,
  hasMinimumSharedFields,
  sanitizeIntakePayload,
} from "./model";

describe("intake model", () => {
  it("preserves free-form line breaks while normalizing structured input", () => {
    const payload = sanitizeIntakePayload({
      planning_mode: "project",
      structured_input: {
        title: "  Neighborhood clean-up  ",
        objective: "Coordinate volunteers",
        background_or_current_situation: "The park is overdue for a reset",
      },
      free_form_input: {
        body: "Line one\nLine two\nLine three",
      },
    });

    expect(payload.structured_input.title).toBe("Neighborhood clean-up");
    expect(payload.free_form_input.body).toBe("Line one\nLine two\nLine three");
  });

  it("enforces shared save requirements separately from confirm requirements", () => {
    const draftPayload = sanitizeIntakePayload({
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

    expect(hasMinimumSharedFields(draftPayload)).toBe(true);
    expect(hasAllRequiredFields(draftPayload)).toBe(false);
  });
});
