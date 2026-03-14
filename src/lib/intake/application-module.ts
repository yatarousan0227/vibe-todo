import { sanitizeIntakePayload } from "./model";
import {
  projectRepository as defaultProjectRepository,
  refinementSessionRepository as defaultRefinementSessionRepository,
  withIntakeTransaction,
  type ProjectRepository,
  type RefinementSessionRepository,
} from "./repository";
import type {
  InitializeProjectFromIntakeInput,
  ProjectRecord,
  RefinementSessionRecord,
  SaveProjectDraftInput,
  WorkspaceProjectContext,
} from "./types";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

interface TransactionRepositories {
  projectRepository: ProjectRepository;
  refinementSessionRepository: RefinementSessionRepository;
}

type TransactionRunner = <T>(
  action: (repositories: TransactionRepositories) => Promise<T>,
) => Promise<T>;

interface IntakeApplicationModuleDependencies {
  projectRepository: ProjectRepository;
  refinementSessionRepository: RefinementSessionRepository;
  withTransaction: TransactionRunner;
}

function buildWorkspaceProjectContext(input: {
  project: ProjectRecord;
  refinementSession: RefinementSessionRecord | null;
}): WorkspaceProjectContext {
  return {
    project: {
      projectId: input.project.project_id,
      title: input.project.title,
      planningMode: input.project.planning_mode,
      lifecycleStatus: input.project.lifecycle_status,
      draftIntakePayload: input.project.draft_intake_payload,
      confirmedIntakeSnapshot: input.project.confirmed_intake_snapshot,
      confirmedAt: input.project.confirmed_at,
    },
    refinementSession: input.refinementSession,
  };
}

function isActiveSessionConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeDatabaseError = error as Error & {
    code?: string;
    constraint?: string;
  };

  return (
    maybeDatabaseError.constraint ===
      "refinement_sessions_one_active_per_project" ||
    (maybeDatabaseError.code === "23505" &&
      error.message.includes("refinement_sessions_one_active_per_project"))
  );
}

export class IntakeApplicationModule {
  constructor(private readonly dependencies: IntakeApplicationModuleDependencies) {}

  async saveProjectDraft(
    input: SaveProjectDraftInput,
  ): Promise<WorkspaceProjectContext> {
    const payload = sanitizeIntakePayload(input.payload);
    const project = await this.dependencies.projectRepository.upsertDraft({
      projectId: input.projectId,
      payload,
    });

    return buildWorkspaceProjectContext({
      project,
      refinementSession:
        await this.dependencies.refinementSessionRepository.getActiveByProjectId(
          project.project_id,
        ),
    });
  }

  async initializeProjectFromIntake(
    input: InitializeProjectFromIntakeInput,
  ): Promise<WorkspaceProjectContext> {
    const payload = sanitizeIntakePayload(input.payload);

    try {
      return await this.dependencies.withTransaction(
        async ({ projectRepository, refinementSessionRepository }) => {
          const draftProject = await projectRepository.upsertDraft({
            projectId: input.projectId,
            payload,
          });
          const activeSession =
            await refinementSessionRepository.getActiveByProjectId(
              draftProject.project_id,
            );

          if (activeSession) {
            throw new ConflictError(
              "An active refinement session already exists for this project.",
            );
          }

          const project = await projectRepository.confirmIntake({
            projectId: draftProject.project_id,
            payload,
          });
          const refinementSession =
            await refinementSessionRepository.createActiveSession(
              project.project_id,
            );

          return buildWorkspaceProjectContext({
            project,
            refinementSession,
          });
        },
      );
    } catch (error) {
      if (error instanceof ConflictError || isActiveSessionConflict(error)) {
        throw new ConflictError(
          "An active refinement session already exists for this project.",
        );
      }

      throw error;
    }
  }

  async getWorkspaceContext(projectId: string): Promise<WorkspaceProjectContext> {
    const project = await this.dependencies.projectRepository.getById(projectId);

    if (!project) {
      throw new NotFoundError("Draft not found for the supplied project ID.");
    }

    return buildWorkspaceProjectContext({
      project,
      refinementSession:
        await this.dependencies.refinementSessionRepository.getActiveByProjectId(
          projectId,
        ),
    });
  }
}

export const intakeApplicationModule = new IntakeApplicationModule({
  projectRepository: defaultProjectRepository,
  refinementSessionRepository: defaultRefinementSessionRepository,
  withTransaction: withIntakeTransaction,
});
