import { describe, expect, it } from "vitest";
import {
  getDraftEditorActionAvailability,
  getDraftEditorFieldDefinitions,
} from "./editor-fields";
import { sanitizeIntakePayload } from "./model";

describe("draft editor field definitions", () => {
  it("uses the project mode field set with non-software labels", () => {
    expect(
      getDraftEditorFieldDefinitions("project").map((field) => field.label),
    ).toEqual([
      "Title",
      "Objective",
      "Background or current situation",
      "Scope summary",
      "Stakeholders",
      "Constraints or conditions",
      "Free-form context",
    ]);
  });

  it("switches daily work mode to the deliverable field while keeping shared fields", () => {
    expect(
      getDraftEditorFieldDefinitions("daily_work").map((field) => field.name),
    ).toEqual([
      "title",
      "objective",
      "background_or_current_situation",
      "expected_outcome_or_deliverable",
      "constraints_or_conditions",
      "free_form_context",
    ]);
  });
});

describe("draft editor action availability", () => {
  it("enables save before review for the shared minimum intake scaffold", () => {
    const payload = sanitizeIntakePayload({
      planning_mode: "project",
      structured_input: {
        title: "Quarterly hiring reset",
        objective: "Create a realistic plan for next quarter",
        background_or_current_situation:
          "Leadership wants a lower-risk sequence before approving spend",
      },
      free_form_input: {
        body: "",
      },
    });

    expect(getDraftEditorActionAvailability(payload)).toEqual({
      canSaveDraft: true,
      canReview: false,
    });
  });

  it("requires the full daily work field set and free-form context before review", () => {
    const payload = sanitizeIntakePayload({
      planning_mode: "daily_work",
      structured_input: {
        title: "Weekly finance close prep",
        objective: "Stabilize the weekly handoff",
        background_or_current_situation:
          "The process varies depending on who is available",
        expected_outcome_or_deliverable:
          "A repeatable checklist and review packet handoff",
        constraints_or_conditions:
          "Must work with the current spreadsheet workflow",
      },
      free_form_input: {
        body: "I want the next refinement step to surface hidden dependencies.",
      },
    });

    expect(getDraftEditorActionAvailability(payload)).toEqual({
      canSaveDraft: true,
      canReview: true,
    });
  });
});
