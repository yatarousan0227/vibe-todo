import assert from "node:assert/strict";
import { pool, withTransaction } from "../src/lib/intake/db";
import { IntakeApplicationModule } from "../src/lib/intake/application-module";
import {
  createProjectRepository,
  createRefinementSessionRepository,
} from "../src/lib/intake/repository";
import {
  assertObject,
  createProjectPayload,
  ensureSchema,
  getWorkspace,
  postProjectCommand,
  resetDatabase,
  waitForApp,
} from "./intake-test-support";

interface ApiProjectShape {
  projectId: string;
  lifecycleStatus: string;
  confirmedAt: string | null;
  draftIntakePayload: {
    free_form_input: {
      body: string;
    };
  };
  confirmedIntakeSnapshot: unknown;
}

interface ApiRefinementSessionShape {
  active_artifact_key: string;
}

async function main() {
  try {
    await ensureSchema();
    await resetDatabase();
    await waitForApp();

    const firstDraft = await postProjectCommand({
      generationTrigger: "draft_save",
      project: createProjectPayload(),
    });
    assert.equal(firstDraft.response.status, 200);
    assertObject(firstDraft.body.project, "Expected a project payload from save");

    const firstProject = firstDraft.body.project as unknown as ApiProjectShape;
    assert.equal(firstProject.lifecycleStatus, "draft_intake");
    assert.match(String(firstProject.projectId), /^[0-9a-f-]{36}$/i);

    const firstProjectId = String(firstProject.projectId);
    const updatedFreeFormBody =
      "The neighborhood wants a launch plan that works for families and school volunteers.\nPreserve the detailed setup notes when the draft resumes.";

    const updatedDraft = await postProjectCommand({
      projectId: firstProjectId,
      generationTrigger: "draft_save",
      project: createProjectPayload({
        constraints: "Keep costs within donated supplies and city permit timing.",
        freeFormBody: updatedFreeFormBody,
      }),
    });
    assert.equal(updatedDraft.response.status, 200);
    assertObject(updatedDraft.body.project, "Expected an updated project payload");
    const updatedProject =
      updatedDraft.body.project as unknown as ApiProjectShape;
    assert.equal(updatedProject.projectId, firstProjectId);
    assert.equal(
      updatedProject.draftIntakePayload.free_form_input.body,
      updatedFreeFormBody,
    );

    const resumedDraft = await getWorkspace(firstProjectId);
    assert.equal(resumedDraft.response.status, 200);
    assertObject(resumedDraft.body.project, "Expected a resumable workspace context");
    const resumedProject = resumedDraft.body.project as unknown as ApiProjectShape;
    assert.equal(
      resumedProject.draftIntakePayload.free_form_input.body,
      updatedFreeFormBody,
    );

    const missingDraft = await getWorkspace("missing-project");
    assert.equal(missingDraft.response.status, 404);
    assert.equal(missingDraft.body.errorCode, "project_not_found");
    assert.equal(missingDraft.body.recoverable, true);

    const secondDraft = await postProjectCommand({
      generationTrigger: "draft_save",
      project: createProjectPayload({
        title: "School festival setup",
        objective: "Create a practical setup plan for the festival day",
        background:
          "Volunteers arrive in waves and equipment handoff is inconsistent each year.",
        scope: "Booths, signage, stage setup, and volunteer check-in",
        stakeholders: "Parents, school staff, stage volunteers",
      }),
    });
    assert.equal(secondDraft.response.status, 200);
    assertObject(secondDraft.body.project, "Expected a second project payload");
    const secondProject = secondDraft.body.project as unknown as ApiProjectShape;
    assert.notEqual(secondProject.projectId, firstProjectId);

    const confirmedDraft = await postProjectCommand({
      projectId: firstProjectId,
      generationTrigger: "intake_confirm",
      project: createProjectPayload({
        constraints: "Keep costs within donated supplies and city permit timing.",
        freeFormBody: updatedFreeFormBody,
      }),
    });
    assert.equal(confirmedDraft.response.status, 200);
    assertObject(
      confirmedDraft.body.project,
      "Expected a confirmed project payload from confirmation",
    );
    assertObject(
      confirmedDraft.body.refinementSession,
      "Expected an active refinement session from confirmation",
    );
    const confirmedProject =
      confirmedDraft.body.project as unknown as ApiProjectShape;
    const confirmedSession =
      confirmedDraft.body.refinementSession as unknown as ApiRefinementSessionShape;
    assert.equal(confirmedProject.lifecycleStatus, "confirmed");
    assert.ok(confirmedProject.confirmedAt);
    assert.equal(
      confirmedSession.active_artifact_key,
      "objective_and_outcome",
    );

    const confirmedProjectRows = await pool.query<{
      lifecycle_status: string;
      confirmed_at: Date | null;
    }>(
      "SELECT lifecycle_status, confirmed_at FROM projects WHERE project_id = $1",
      [firstProjectId],
    );
    assert.equal(confirmedProjectRows.rowCount, 1);
    assert.equal(confirmedProjectRows.rows[0].lifecycle_status, "confirmed");
    assert.ok(confirmedProjectRows.rows[0].confirmed_at);

    const sessionRows = await pool.query<{ session_count: string }>(
      "SELECT COUNT(*)::text AS session_count FROM refinement_sessions WHERE project_id = $1 AND status = 'active'",
      [firstProjectId],
    );
    assert.equal(sessionRows.rows[0].session_count, "1");

    const secondConfirm = await postProjectCommand({
      projectId: firstProjectId,
      generationTrigger: "intake_confirm",
      project: createProjectPayload({
        constraints: "Keep costs within donated supplies and city permit timing.",
        freeFormBody: updatedFreeFormBody,
      }),
    });
    assert.equal(secondConfirm.response.status, 409);
    assert.equal(secondConfirm.body.errorCode, "active_session_conflict");

    const rollbackDraft = await postProjectCommand({
      generationTrigger: "draft_save",
      project: createProjectPayload({
        title: "Library volunteer orientation",
      }),
    });
    assert.equal(rollbackDraft.response.status, 200);
    assertObject(rollbackDraft.body.project, "Expected a rollback test project");
    const rollbackProject =
      rollbackDraft.body.project as unknown as ApiProjectShape;
    const rollbackProjectId = rollbackProject.projectId;

    const rollbackModule = new IntakeApplicationModule({
      projectRepository: createProjectRepository(),
      refinementSessionRepository: createRefinementSessionRepository(),
      withTransaction: (action) =>
        withTransaction((client) =>
          action({
            projectRepository: createProjectRepository(client),
            refinementSessionRepository: {
              getActiveByProjectId:
                createRefinementSessionRepository(client).getActiveByProjectId,
              createActiveSession: async () => {
                throw new Error("Simulated session creation failure");
              },
            },
          }),
        ),
    });

    await assert.rejects(
      rollbackModule.initializeProjectFromIntake({
        projectId: rollbackProjectId,
        payload: {
          planning_mode: "project",
          structured_input: {
            title: "Library volunteer orientation",
            objective: "Stabilize the weekly volunteer orientation flow",
            background_or_current_situation:
              "Volunteers arrive with different levels of context and the handoff is inconsistent.",
            scope_summary: "Room setup, role walkthrough, and closing recap",
            stakeholders: "Library staff, volunteer leads, new volunteers",
            expected_outcome_or_deliverable: "",
            constraints_or_conditions:
              "The room must be reset before the reading program begins.",
          },
          free_form_input: {
            body:
              "The first refinement step should preserve the human details volunteers need, not just the room logistics.",
          },
        },
      }),
      /Simulated session creation failure/,
    );

    const rolledBackProject = await createProjectRepository().getById(rollbackProjectId);
    assert.ok(rolledBackProject);
    assert.equal(rolledBackProject.lifecycle_status, "draft_intake");
    assert.equal(rolledBackProject.confirmed_intake_snapshot, null);
    assert.equal(rolledBackProject.confirmed_at, null);

    console.log("Integration checks passed.");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
