import { randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { pool, withTransaction } from "./db";
import type {
  IntakePayload,
  LifecycleStatus,
  PlanningMode,
  ProjectRecord,
  RefinementSessionRecord,
} from "./types";

export interface ProjectRepository {
  getById(projectId: string): Promise<ProjectRecord | null>;
  upsertDraft(options: { projectId?: string; payload: IntakePayload }): Promise<ProjectRecord>;
  confirmIntake(options: { projectId: string; payload: IntakePayload }): Promise<ProjectRecord>;
}

export interface RefinementSessionRepository {
  getActiveByProjectId(projectId: string): Promise<RefinementSessionRecord | null>;
  createActiveSession(projectId: string): Promise<RefinementSessionRecord>;
}

type Queryable = Pick<Pool, "query"> | PoolClient;

interface ProjectRow {
  project_id: string;
  title: string;
  planning_mode: PlanningMode;
  lifecycle_status: LifecycleStatus;
  draft_intake_payload: IntakePayload;
  confirmed_intake_snapshot: IntakePayload | null;
  created_at: Date;
  updated_at: Date;
  confirmed_at: Date | null;
}

interface RefinementSessionRow {
  refinement_session_id: string;
  project_id: string;
  status: string;
  active_artifact_key: string;
  last_generation_at: Date | null;
  created_at: Date;
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    project_id: row.project_id,
    title: row.title,
    planning_mode: row.planning_mode,
    lifecycle_status: row.lifecycle_status,
    draft_intake_payload: row.draft_intake_payload,
    confirmed_intake_snapshot: row.confirmed_intake_snapshot,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    confirmed_at: row.confirmed_at?.toISOString() ?? null,
  };
}

function mapSessionRow(row: RefinementSessionRow): RefinementSessionRecord {
  return {
    refinement_session_id: row.refinement_session_id,
    project_id: row.project_id,
    status: row.status,
    active_artifact_key: row.active_artifact_key,
    last_generation_at: row.last_generation_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

async function runQuery<T extends QueryResultRow>(
  executor: Queryable,
  sql: string,
  values: unknown[] = [],
) {
  return executor.query<T>(sql, values);
}

async function getProjectByIdInExecutor(
  executor: Queryable,
  projectId: string,
): Promise<ProjectRecord | null> {
  const result = await runQuery<ProjectRow>(
    executor,
    `SELECT
      project_id,
      title,
      planning_mode,
      lifecycle_status,
      draft_intake_payload,
      confirmed_intake_snapshot,
      created_at,
      updated_at,
      confirmed_at
    FROM projects
    WHERE project_id = $1`,
    [projectId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapProjectRow(result.rows[0]);
}

async function getActiveSessionByProjectIdInExecutor(
  executor: Queryable,
  projectId: string,
): Promise<RefinementSessionRecord | null> {
  const result = await runQuery<RefinementSessionRow>(
    executor,
    `SELECT
      refinement_session_id,
      project_id,
      status,
      active_artifact_key,
      last_generation_at,
      created_at
    FROM refinement_sessions
    WHERE project_id = $1 AND status = 'active'`,
    [projectId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapSessionRow(result.rows[0]);
}

async function upsertProjectDraftInExecutor(
  executor: Queryable,
  options: {
    projectId?: string;
    payload: IntakePayload;
  },
): Promise<ProjectRecord> {
  const projectId = options.projectId ?? randomUUID();
  const title = options.payload.structured_input.title;

  const result = await runQuery<ProjectRow>(
    executor,
    `INSERT INTO projects (
      project_id,
      title,
      planning_mode,
      lifecycle_status,
      draft_intake_payload
    )
    VALUES ($1, $2, $3, 'draft_intake', $4::jsonb)
    ON CONFLICT (project_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      planning_mode = EXCLUDED.planning_mode,
      lifecycle_status = 'draft_intake',
      draft_intake_payload = EXCLUDED.draft_intake_payload,
      updated_at = NOW()
    RETURNING
      project_id,
      title,
      planning_mode,
      lifecycle_status,
      draft_intake_payload,
      confirmed_intake_snapshot,
      created_at,
      updated_at,
      confirmed_at`,
    [
      projectId,
      title,
      options.payload.planning_mode,
      JSON.stringify(options.payload),
    ],
  );

  return mapProjectRow(result.rows[0]);
}

async function confirmProjectInExecutor(
  executor: Queryable,
  options: {
    projectId: string;
    payload: IntakePayload;
  },
): Promise<ProjectRecord> {
  const title = options.payload.structured_input.title;

  const result = await runQuery<ProjectRow>(
    executor,
    `UPDATE projects
    SET
      title = $2,
      planning_mode = $3,
      lifecycle_status = 'confirmed',
      draft_intake_payload = $4::jsonb,
      confirmed_intake_snapshot = $4::jsonb,
      confirmed_at = NOW(),
      updated_at = NOW()
    WHERE project_id = $1
    RETURNING
      project_id,
      title,
      planning_mode,
      lifecycle_status,
      draft_intake_payload,
      confirmed_intake_snapshot,
      created_at,
      updated_at,
      confirmed_at`,
    [
      options.projectId,
      title,
      options.payload.planning_mode,
      JSON.stringify(options.payload),
    ],
  );

  return mapProjectRow(result.rows[0]);
}

async function createActiveSessionInExecutor(
  executor: Queryable,
  projectId: string,
): Promise<RefinementSessionRecord> {
  const result = await runQuery<RefinementSessionRow>(
    executor,
    `INSERT INTO refinement_sessions (
      refinement_session_id,
      project_id,
      status,
      active_artifact_key
    )
    VALUES ($1, $2, 'active', 'objective_and_outcome')
    RETURNING
      refinement_session_id,
      project_id,
      status,
      active_artifact_key,
      last_generation_at,
      created_at`,
    [randomUUID(), projectId],
  );

  return mapSessionRow(result.rows[0]);
}

export function createProjectRepository(executor: Queryable = pool): ProjectRepository {
  return {
    async getById(projectId: string) {
      return getProjectByIdInExecutor(executor, projectId);
    },
    async upsertDraft(options) {
      return upsertProjectDraftInExecutor(executor, options);
    },
    async confirmIntake(options) {
      return confirmProjectInExecutor(executor, options);
    },
  };
}

export function createRefinementSessionRepository(
  executor: Queryable = pool,
): RefinementSessionRepository {
  return {
    async getActiveByProjectId(projectId: string) {
      return getActiveSessionByProjectIdInExecutor(executor, projectId);
    },
    async createActiveSession(projectId: string) {
      return createActiveSessionInExecutor(executor, projectId);
    },
  };
}

export async function withIntakeTransaction<T>(
  action: (repositories: {
    projectRepository: ProjectRepository;
    refinementSessionRepository: RefinementSessionRepository;
  }) => Promise<T>,
): Promise<T> {
  return withTransaction((client) =>
    action({
      projectRepository: createProjectRepository(client),
      refinementSessionRepository: createRefinementSessionRepository(client),
    }),
  );
}

export const projectRepository = createProjectRepository();
export const refinementSessionRepository = createRefinementSessionRepository();
