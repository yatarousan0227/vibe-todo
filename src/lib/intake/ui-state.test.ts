import { describe, expect, it } from "vitest";
import { sanitizeIntakePayload } from "./model";
import {
  buildEditorStateFromWorkspaceContext,
  buildRefinementPath,
  getIntakeActionAvailability,
  getReviewStructuredSummaryItems,
} from "./ui-state";
import type { WorkspaceContext } from "./types";

const sampleWorkspaceContext: WorkspaceContext = {
  project: {
    projectId: "project-123",
    title: "Community garden launch",
    planningMode: "project",
    lifecycleStatus: "draft_intake",
    draftIntakePayload: {
      planning_mode: "project",
      structured_input: {
        title: "Community garden launch",
        objective: "Prepare a neighborhood garden opening plan",
        background_or_current_situation:
          "The lot is available, but volunteers and permit timing are not aligned yet.",
        scope_summary: "Beds, volunteer shifts, supply pickup, and opening-day setup",
        stakeholders: "Neighbors, school staff, city permit office",
        expected_outcome_or_deliverable: "",
        constraints_or_conditions:
          "Stay within the donated materials list and finish before the school festival.",
      },
      free_form_input: {
        body:
          "We want this to feel welcoming for families and first-time volunteers.\nThe first refinement step should keep the plan concrete without turning it into software jargon.",
      },
    },
    confirmedIntakeSnapshot: null,
    confirmedAt: null,
  },
  refinementSession: null,
  allowedActions: {
    canSaveDraft: true,
    canReview: true,
    canConfirm: true,
  },
};

describe("intake UI state helpers", () => {
  it("restores both structured and free-form draft data from workspace context", () => {
    expect(buildEditorStateFromWorkspaceContext(sampleWorkspaceContext)).toEqual({
      planningMode: "project",
      projectId: "project-123",
      structuredInput: sampleWorkspaceContext.project.draftIntakePayload.structured_input,
      freeFormBody:
        sampleWorkspaceContext.project.draftIntakePayload.free_form_input.body,
    });
  });

  it("maps draft and confirmed lifecycles into review and confirm availability", () => {
    const confirmablePayload = sanitizeIntakePayload({
      planning_mode: "daily_work",
      structured_input: {
        title: "Weekly pantry prep",
        objective: "Make the weekly pantry opening more predictable",
        background_or_current_situation:
          "Volunteers and donated items change every week.",
        expected_outcome_or_deliverable:
          "A repeatable prep checklist and pickup handoff plan",
        constraints_or_conditions:
          "Need to fit around the school pickup window and donation drop-off schedule.",
      },
      free_form_input: {
        body:
          "The flow should work for community volunteers, not just experienced organizers.",
      },
    });

    expect(
      getIntakeActionAvailability({
        lifecycleStatus: "draft_intake",
        payload: confirmablePayload,
      }),
    ).toEqual({
      canSaveDraft: true,
      canReview: true,
      canConfirm: true,
    });

    expect(
      getIntakeActionAvailability({
        lifecycleStatus: "confirmed",
        payload: confirmablePayload,
      }),
    ).toEqual({
      canSaveDraft: true,
      canReview: true,
      canConfirm: false,
    });
  });

  it("builds the review summary from only the active mode fields", () => {
    expect(
      getReviewStructuredSummaryItems({
        planningMode: "project",
        structuredInput:
          sampleWorkspaceContext.project.draftIntakePayload.structured_input,
      }),
    ).toEqual([
      {
        label: "Title",
        value: "Community garden launch",
      },
      {
        label: "Objective",
        value: "Prepare a neighborhood garden opening plan",
      },
      {
        label: "Background or current situation",
        value:
          "The lot is available, but volunteers and permit timing are not aligned yet.",
      },
      {
        label: "Scope summary",
        value: "Beds, volunteer shifts, supply pickup, and opening-day setup",
      },
      {
        label: "Stakeholders",
        value: "Neighbors, school staff, city permit office",
      },
      {
        label: "Constraints or conditions",
        value:
          "Stay within the donated materials list and finish before the school festival.",
      },
    ]);
  });

  it("builds the SCR-002 handoff path with the active artifact key", () => {
    expect(
      buildRefinementPath({
        projectId: "project-123",
        activeArtifactKey: "objective_and_outcome",
      }),
    ).toBe(
      "/projects/project-123/refinement?artifactKey=objective_and_outcome",
    );
  });
});
