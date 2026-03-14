import { describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  IntakeApplicationModule,
  NotFoundError,
} from "./application-module";
import type {
  IntakePayload,
  ProjectRecord,
  RefinementSessionRecord,
} from "./types";

const samplePayload: IntakePayload = {
  planning_mode: "project",
  structured_input: {
    title: "Neighborhood clean-up",
    objective: "Coordinate volunteers",
    background_or_current_situation: "The park is overdue for a reset",
    scope_summary: "Clean the park and sort donated tools",
    stakeholders: "Neighbors, city staff, community lead",
    expected_outcome_or_deliverable: "",
    constraints_or_conditions: "Finish before the weekend market",
  },
  free_form_input: {
    body: "Line one\nLine two",
  },
};

function createProjectRecord(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    project_id: "project-123",
    title: samplePayload.structured_input.title,
    planning_mode: samplePayload.planning_mode,
    lifecycle_status: "draft_intake",
    draft_intake_payload: samplePayload,
    confirmed_intake_snapshot: null,
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:05:00.000Z",
    confirmed_at: null,
    ...overrides,
  };
}

function createSessionRecord(
  overrides: Partial<RefinementSessionRecord> = {},
): RefinementSessionRecord {
  return {
    refinement_session_id: "session-123",
    project_id: "project-123",
    status: "active",
    active_artifact_key: "objective_and_outcome",
    last_generation_at: null,
    created_at: "2026-03-14T08:06:00.000Z",
    ...overrides,
  };
}

function createModuleDependencies() {
  return {
    projectRepository: {
      getById: vi.fn(),
      upsertDraft: vi.fn(),
      confirmIntake: vi.fn(),
    },
    refinementSessionRepository: {
      getActiveByProjectId: vi.fn(),
      createActiveSession: vi.fn(),
    },
    withTransaction: vi.fn(),
  };
}

describe("IntakeApplicationModule", () => {
  it("saves a draft and returns the resumable workspace state", async () => {
    const dependencies = createModuleDependencies();
    dependencies.projectRepository.upsertDraft.mockResolvedValue(createProjectRecord());
    dependencies.refinementSessionRepository.getActiveByProjectId.mockResolvedValue(
      createSessionRecord(),
    );

    const module = new IntakeApplicationModule(dependencies);
    const result = await module.saveProjectDraft({
      projectId: "project-123",
      payload: samplePayload,
    });

    expect(dependencies.projectRepository.upsertDraft).toHaveBeenCalledWith({
      projectId: "project-123",
      payload: samplePayload,
    });
    expect(
      dependencies.refinementSessionRepository.getActiveByProjectId,
    ).toHaveBeenCalledWith("project-123");
    expect(result.project.projectId).toBe("project-123");
    expect(result.refinementSession?.active_artifact_key).toBe(
      "objective_and_outcome",
    );
  });

  it("confirms intake inside one transaction and creates the first active session", async () => {
    const dependencies = createModuleDependencies();
    const steps: string[] = [];
    const confirmedProject = createProjectRecord({
      lifecycle_status: "confirmed",
      confirmed_intake_snapshot: samplePayload,
      confirmed_at: "2026-03-14T08:07:00.000Z",
    });
    const transactionRepositories = {
      projectRepository: {
        getById: vi.fn(),
        upsertDraft: vi.fn(async () => {
          steps.push("upsertDraft");
          return createProjectRecord();
        }),
        confirmIntake: vi.fn(async () => {
          steps.push("confirmIntake");
          return confirmedProject;
        }),
      },
      refinementSessionRepository: {
        getActiveByProjectId: vi.fn(async () => {
          steps.push("getActiveByProjectId");
          return null;
        }),
        createActiveSession: vi.fn(async () => {
          steps.push("createActiveSession");
          return createSessionRecord();
        }),
      },
    };

    dependencies.withTransaction.mockImplementation(async (action) =>
      action(transactionRepositories),
    );

    const module = new IntakeApplicationModule(dependencies);
    const result = await module.initializeProjectFromIntake({
      projectId: "project-123",
      payload: samplePayload,
    });

    expect(dependencies.withTransaction).toHaveBeenCalledOnce();
    expect(steps).toEqual([
      "upsertDraft",
      "getActiveByProjectId",
      "confirmIntake",
      "createActiveSession",
    ]);
    expect(result.project.lifecycleStatus).toBe("confirmed");
    expect(result.project.confirmedIntakeSnapshot).toEqual(samplePayload);
    expect(result.refinementSession?.active_artifact_key).toBe(
      "objective_and_outcome",
    );
  });

  it("rejects a second intake initialization when an active session already exists", async () => {
    const dependencies = createModuleDependencies();
    const transactionRepositories = {
      projectRepository: {
        getById: vi.fn(),
        upsertDraft: vi.fn().mockResolvedValue(createProjectRecord()),
        confirmIntake: vi.fn(),
      },
      refinementSessionRepository: {
        getActiveByProjectId: vi.fn().mockResolvedValue(createSessionRecord()),
        createActiveSession: vi.fn(),
      },
    };

    dependencies.withTransaction.mockImplementation(async (action) =>
      action(transactionRepositories),
    );

    const module = new IntakeApplicationModule(dependencies);

    await expect(
      module.initializeProjectFromIntake({
        projectId: "project-123",
        payload: samplePayload,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(transactionRepositories.projectRepository.confirmIntake).not.toHaveBeenCalled();
    expect(
      transactionRepositories.refinementSessionRepository.createActiveSession,
    ).not.toHaveBeenCalled();
  });

  it("normalizes unique-index collisions into a workflow conflict", async () => {
    const dependencies = createModuleDependencies();
    const transactionRepositories = {
      projectRepository: {
        getById: vi.fn(),
        upsertDraft: vi.fn().mockResolvedValue(createProjectRecord()),
        confirmIntake: vi.fn().mockResolvedValue(
          createProjectRecord({
            lifecycle_status: "confirmed",
            confirmed_intake_snapshot: samplePayload,
            confirmed_at: "2026-03-14T08:07:00.000Z",
          }),
        ),
      },
      refinementSessionRepository: {
        getActiveByProjectId: vi.fn().mockResolvedValue(null),
        createActiveSession: vi.fn().mockRejectedValue(
          Object.assign(
            new Error(
              'duplicate key value violates unique constraint "refinement_sessions_one_active_per_project"',
            ),
            {
              code: "23505",
              constraint: "refinement_sessions_one_active_per_project",
            },
          ),
        ),
      },
    };

    dependencies.withTransaction.mockImplementation(async (action) =>
      action(transactionRepositories),
    );

    const module = new IntakeApplicationModule(dependencies);

    await expect(
      module.initializeProjectFromIntake({
        projectId: "project-123",
        payload: samplePayload,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("raises not found when the requested workspace context does not exist", async () => {
    const dependencies = createModuleDependencies();
    dependencies.projectRepository.getById.mockResolvedValue(null);

    const module = new IntakeApplicationModule(dependencies);

    await expect(module.getWorkspaceContext("missing-project")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
