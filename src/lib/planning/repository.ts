import { randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { pool, withTransaction } from "../intake/db";
import type {
  FreshnessStatus,
  GenerationTrigger,
  PublishBlocker,
  PublishStatus,
  SynthesisJobStatus,
  TaskArtifactLinkRecord,
  TaskPlanSnapshotRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TaskSynthesisJobRecord,
  TaskWithLinks,
} from "./types";

type Queryable = Pick<Pool, "query"> | PoolClient;

interface TaskSynthesisJobRow {
  synthesis_job_id: string;
  project_id: string;
  status: SynthesisJobStatus;
  generation_trigger: GenerationTrigger;
  source_artifact_snapshot_ids: string[];
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TaskPlanSnapshotRow {
  task_plan_snapshot_id: string;
  project_id: string;
  synthesis_job_id: string | null;
  freshness_status: FreshnessStatus;
  publish_status: PublishStatus;
  is_current_published: boolean;
  generated_from_artifact_set: string[];
  generated_at: Date;
  published_at: Date | null;
  publish_blockers: PublishBlocker[];
}

interface TaskRow {
  task_id: string;
  task_plan_snapshot_id: string;
  project_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  dependencies: string[];
  estimate: string | null;
  assignee: string | null;
  execution_order: number;
  is_due_date_placeholder: boolean;
  is_estimate_placeholder: boolean;
  is_assignee_placeholder: boolean;
  placeholder_reasons: Partial<Record<"due_date" | "estimate" | "assignee", string>>;
  created_at: Date;
  updated_at: Date;
}

interface TaskArtifactLinkRow {
  task_id: string;
  artifact_snapshot_id: string;
  relation_type: string;
}

function mapJobRow(row: TaskSynthesisJobRow): TaskSynthesisJobRecord {
  return {
    synthesis_job_id: row.synthesis_job_id,
    project_id: row.project_id,
    status: row.status,
    generation_trigger: row.generation_trigger,
    source_artifact_snapshot_ids: row.source_artifact_snapshot_ids,
    error_message: row.error_message,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapSnapshotRow(row: TaskPlanSnapshotRow): TaskPlanSnapshotRecord {
  return {
    task_plan_snapshot_id: row.task_plan_snapshot_id,
    project_id: row.project_id,
    synthesis_job_id: row.synthesis_job_id,
    freshness_status: row.freshness_status,
    publish_status: row.publish_status,
    is_current_published: row.is_current_published,
    generated_from_artifact_set: row.generated_from_artifact_set,
    generated_at: row.generated_at.toISOString(),
    published_at: row.published_at ? row.published_at.toISOString() : null,
    publish_blockers: row.publish_blockers,
  };
}

function mapTaskRow(row: TaskRow): TaskRecord {
  return {
    task_id: row.task_id,
    task_plan_snapshot_id: row.task_plan_snapshot_id,
    project_id: row.project_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    due_date: row.due_date,
    dependencies: row.dependencies,
    estimate: row.estimate,
    assignee: row.assignee,
    execution_order: row.execution_order,
    is_due_date_placeholder: row.is_due_date_placeholder,
    is_estimate_placeholder: row.is_estimate_placeholder,
    is_assignee_placeholder: row.is_assignee_placeholder,
    placeholder_reasons: row.placeholder_reasons,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function runQuery<T extends QueryResultRow>(
  executor: Queryable,
  sql: string,
  values: unknown[] = [],
) {
  return executor.query<T>(sql, values);
}

export interface TaskSynthesisJobRepository {
  createJob(input: {
    projectId: string;
    generationTrigger: GenerationTrigger;
    sourceArtifactSnapshotIds: string[];
  }): Promise<TaskSynthesisJobRecord>;
  updateJobStatus(
    jobId: string,
    status: SynthesisJobStatus,
    options?: { errorMessage?: string },
  ): Promise<TaskSynthesisJobRecord>;
  getLatestJobForProject(
    projectId: string,
  ): Promise<TaskSynthesisJobRecord | null>;
  getJobById(jobId: string): Promise<TaskSynthesisJobRecord | null>;
}

export interface TaskPlanRepository {
  createSnapshot(input: {
    projectId: string;
    synthesisJobId: string | null;
    generatedFromArtifactSet: string[];
    publishBlockers: PublishBlocker[];
  }): Promise<TaskPlanSnapshotRecord>;
  getSnapshotById(
    snapshotId: string,
  ): Promise<TaskPlanSnapshotRecord | null>;
  getCurrentPublishedSnapshot(
    projectId: string,
  ): Promise<TaskPlanSnapshotRecord | null>;
  getAllSnapshotsForProject(
    projectId: string,
  ): Promise<TaskPlanSnapshotRecord[]>;
  publishSnapshot(
    snapshotId: string,
    previousPublishedId: string | null,
  ): Promise<TaskPlanSnapshotRecord>;
  markSnapshotStale(snapshotId: string): Promise<void>;
  updatePublishBlockers(
    snapshotId: string,
    publishBlockers: PublishBlocker[],
  ): Promise<TaskPlanSnapshotRecord>;
}

export interface TaskRepository {
  createTask(input: {
    taskPlanSnapshotId: string;
    projectId: string;
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;
    dependencies: string[];
    estimate: string | null;
    assignee: string | null;
    executionOrder: number;
    isDueDatePlaceholder: boolean;
    isEstimatePlaceholder: boolean;
    isAssigneePlaceholder: boolean;
    placeholderReasons: Partial<Record<"due_date" | "estimate" | "assignee", string>>;
  }): Promise<TaskRecord>;
  getTaskById(taskId: string): Promise<TaskRecord | null>;
  getTasksBySnapshotId(
    snapshotId: string,
  ): Promise<TaskRecord[]>;
  updateTask(
    taskId: string,
    patch: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      dueDate?: string | null;
      dependencies?: string[];
      estimate?: string | null;
      assignee?: string | null;
    },
  ): Promise<TaskRecord>;
  createArtifactLink(
    taskId: string,
    artifactSnapshotId: string,
    relationType: string,
  ): Promise<TaskArtifactLinkRecord>;
  getArtifactLinksForTask(
    taskId: string,
  ): Promise<TaskArtifactLinkRecord[]>;
  getArtifactLinksForSnapshot(
    snapshotId: string,
  ): Promise<Map<string, TaskArtifactLinkRecord[]>>;
}

function createTaskSynthesisJobRepository(
  executor: Queryable = pool,
): TaskSynthesisJobRepository {
  return {
    async createJob(input) {
      const jobId = randomUUID();
      const result = await runQuery<TaskSynthesisJobRow>(
        executor,
        `INSERT INTO task_synthesis_jobs (
          synthesis_job_id, project_id, status, generation_trigger, source_artifact_snapshot_ids
        )
        VALUES ($1, $2, 'queued', $3, $4::jsonb)
        RETURNING synthesis_job_id, project_id, status, generation_trigger,
          source_artifact_snapshot_ids, error_message, created_at, updated_at`,
        [
          jobId,
          input.projectId,
          input.generationTrigger,
          JSON.stringify(input.sourceArtifactSnapshotIds),
        ],
      );
      return mapJobRow(result.rows[0]);
    },

    async updateJobStatus(jobId, status, options) {
      const result = await runQuery<TaskSynthesisJobRow>(
        executor,
        `UPDATE task_synthesis_jobs
        SET status = $2, error_message = $3, updated_at = NOW()
        WHERE synthesis_job_id = $1
        RETURNING synthesis_job_id, project_id, status, generation_trigger,
          source_artifact_snapshot_ids, error_message, created_at, updated_at`,
        [jobId, status, options?.errorMessage ?? null],
      );
      return mapJobRow(result.rows[0]);
    },

    async getLatestJobForProject(projectId) {
      const result = await runQuery<TaskSynthesisJobRow>(
        executor,
        `SELECT synthesis_job_id, project_id, status, generation_trigger,
          source_artifact_snapshot_ids, error_message, created_at, updated_at
        FROM task_synthesis_jobs
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
        [projectId],
      );
      return result.rowCount === 0 ? null : mapJobRow(result.rows[0]);
    },

    async getJobById(jobId) {
      const result = await runQuery<TaskSynthesisJobRow>(
        executor,
        `SELECT synthesis_job_id, project_id, status, generation_trigger,
          source_artifact_snapshot_ids, error_message, created_at, updated_at
        FROM task_synthesis_jobs
        WHERE synthesis_job_id = $1`,
        [jobId],
      );
      return result.rowCount === 0 ? null : mapJobRow(result.rows[0]);
    },
  };
}

function createTaskPlanRepository(executor: Queryable = pool): TaskPlanRepository {
  return {
    async createSnapshot(input) {
      const snapshotId = randomUUID();
      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `INSERT INTO task_plan_snapshots (
          task_plan_snapshot_id, project_id, synthesis_job_id,
          generated_from_artifact_set, publish_blockers
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        RETURNING task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers`,
        [
          snapshotId,
          input.projectId,
          input.synthesisJobId,
          JSON.stringify(input.generatedFromArtifactSet),
          JSON.stringify(input.publishBlockers),
        ],
      );
      return mapSnapshotRow(result.rows[0]);
    },

    async getSnapshotById(snapshotId) {
      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `SELECT task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers
        FROM task_plan_snapshots
        WHERE task_plan_snapshot_id = $1`,
        [snapshotId],
      );
      return result.rowCount === 0 ? null : mapSnapshotRow(result.rows[0]);
    },

    async getCurrentPublishedSnapshot(projectId) {
      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `SELECT task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers
        FROM task_plan_snapshots
        WHERE project_id = $1 AND is_current_published = TRUE
        LIMIT 1`,
        [projectId],
      );
      return result.rowCount === 0 ? null : mapSnapshotRow(result.rows[0]);
    },

    async getAllSnapshotsForProject(projectId) {
      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `SELECT task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers
        FROM task_plan_snapshots
        WHERE project_id = $1
        ORDER BY generated_at DESC`,
        [projectId],
      );
      return result.rows.map(mapSnapshotRow);
    },

    async publishSnapshot(snapshotId, previousPublishedId) {
      if (previousPublishedId) {
        await runQuery(
          executor,
          `UPDATE task_plan_snapshots
          SET is_current_published = FALSE, freshness_status = 'stale'
          WHERE task_plan_snapshot_id = $1`,
          [previousPublishedId],
        );
      }

      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `UPDATE task_plan_snapshots
        SET is_current_published = TRUE, publish_status = 'published',
            freshness_status = 'published', published_at = NOW()
        WHERE task_plan_snapshot_id = $1
        RETURNING task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers`,
        [snapshotId],
      );
      return mapSnapshotRow(result.rows[0]);
    },

    async markSnapshotStale(snapshotId) {
      await runQuery(
        executor,
        `UPDATE task_plan_snapshots
        SET freshness_status = 'stale'
        WHERE task_plan_snapshot_id = $1`,
        [snapshotId],
      );
    },

    async updatePublishBlockers(snapshotId, publishBlockers) {
      const result = await runQuery<TaskPlanSnapshotRow>(
        executor,
        `UPDATE task_plan_snapshots
        SET publish_blockers = $2::jsonb
        WHERE task_plan_snapshot_id = $1
        RETURNING task_plan_snapshot_id, project_id, synthesis_job_id,
          freshness_status, publish_status, is_current_published,
          generated_from_artifact_set, generated_at, published_at, publish_blockers`,
        [snapshotId, JSON.stringify(publishBlockers)],
      );
      return mapSnapshotRow(result.rows[0]);
    },
  };
}

function createTaskRepository(executor: Queryable = pool): TaskRepository {
  return {
    async createTask(input) {
      const taskId = randomUUID();
      const result = await runQuery<TaskRow>(
        executor,
        `INSERT INTO tasks (
          task_id, task_plan_snapshot_id, project_id, title, description,
          priority, status, due_date, dependencies, estimate, assignee,
          execution_order, is_due_date_placeholder, is_estimate_placeholder,
          is_assignee_placeholder, placeholder_reasons
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16::jsonb)
        RETURNING task_id, task_plan_snapshot_id, project_id, title, description,
          priority, status, due_date, dependencies, estimate, assignee,
          execution_order, is_due_date_placeholder, is_estimate_placeholder,
          is_assignee_placeholder, placeholder_reasons, created_at, updated_at`,
        [
          taskId,
          input.taskPlanSnapshotId,
          input.projectId,
          input.title,
          input.description,
          input.priority,
          input.status,
          input.dueDate,
          JSON.stringify(input.dependencies),
          input.estimate,
          input.assignee,
          input.executionOrder,
          input.isDueDatePlaceholder,
          input.isEstimatePlaceholder,
          input.isAssigneePlaceholder,
          JSON.stringify(input.placeholderReasons),
        ],
      );
      return mapTaskRow(result.rows[0]);
    },

    async getTaskById(taskId) {
      const result = await runQuery<TaskRow>(
        executor,
        `SELECT task_id, task_plan_snapshot_id, project_id, title, description,
          priority, status, due_date, dependencies, estimate, assignee,
          execution_order, is_due_date_placeholder, is_estimate_placeholder,
          is_assignee_placeholder, placeholder_reasons, created_at, updated_at
        FROM tasks
        WHERE task_id = $1`,
        [taskId],
      );
      return result.rowCount === 0 ? null : mapTaskRow(result.rows[0]);
    },

    async getTasksBySnapshotId(snapshotId) {
      const result = await runQuery<TaskRow>(
        executor,
        `SELECT task_id, task_plan_snapshot_id, project_id, title, description,
          priority, status, due_date, dependencies, estimate, assignee,
          execution_order, is_due_date_placeholder, is_estimate_placeholder,
          is_assignee_placeholder, placeholder_reasons, created_at, updated_at
        FROM tasks
        WHERE task_plan_snapshot_id = $1
        ORDER BY execution_order ASC`,
        [snapshotId],
      );
      return result.rows.map(mapTaskRow);
    },

    async updateTask(taskId, patch) {
      const setClauses: string[] = ["updated_at = NOW()"];
      const values: unknown[] = [taskId];
      let paramIndex = 2;

      if (patch.title !== undefined) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(patch.title);
      }
      if (patch.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(patch.description);
      }
      if (patch.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex++}`);
        values.push(patch.priority);
      }
      if (patch.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(patch.status);
      }
      if ("dueDate" in patch) {
        setClauses.push(`due_date = $${paramIndex++}`);
        values.push(patch.dueDate ?? null);
        if (patch.dueDate !== null) {
          setClauses.push(`is_due_date_placeholder = FALSE`);
        }
      }
      if (patch.dependencies !== undefined) {
        setClauses.push(`dependencies = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(patch.dependencies));
      }
      if ("estimate" in patch) {
        setClauses.push(`estimate = $${paramIndex++}`);
        values.push(patch.estimate ?? null);
        if (patch.estimate !== null) {
          setClauses.push(`is_estimate_placeholder = FALSE`);
        }
      }
      if ("assignee" in patch) {
        setClauses.push(`assignee = $${paramIndex++}`);
        values.push(patch.assignee ?? null);
        if (patch.assignee !== null) {
          setClauses.push(`is_assignee_placeholder = FALSE`);
        }
      }

      const result = await runQuery<TaskRow>(
        executor,
        `UPDATE tasks SET ${setClauses.join(", ")}
        WHERE task_id = $1
        RETURNING task_id, task_plan_snapshot_id, project_id, title, description,
          priority, status, due_date, dependencies, estimate, assignee,
          execution_order, is_due_date_placeholder, is_estimate_placeholder,
          is_assignee_placeholder, placeholder_reasons, created_at, updated_at`,
        values,
      );
      return mapTaskRow(result.rows[0]);
    },

    async createArtifactLink(taskId, artifactSnapshotId, relationType) {
      const result = await runQuery<TaskArtifactLinkRow>(
        executor,
        `INSERT INTO task_artifact_links (task_id, artifact_snapshot_id, relation_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, artifact_snapshot_id) DO NOTHING
        RETURNING task_id, artifact_snapshot_id, relation_type`,
        [taskId, artifactSnapshotId, relationType],
      );
      return result.rows[0] ?? { task_id: taskId, artifact_snapshot_id: artifactSnapshotId, relation_type: relationType };
    },

    async getArtifactLinksForTask(taskId) {
      const result = await runQuery<TaskArtifactLinkRow>(
        executor,
        `SELECT task_id, artifact_snapshot_id, relation_type
        FROM task_artifact_links
        WHERE task_id = $1`,
        [taskId],
      );
      return result.rows;
    },

    async getArtifactLinksForSnapshot(snapshotId) {
      const result = await runQuery<TaskArtifactLinkRow & { task_plan_snapshot_id: string }>(
        executor,
        `SELECT tal.task_id, tal.artifact_snapshot_id, tal.relation_type
        FROM task_artifact_links tal
        JOIN tasks t ON tal.task_id = t.task_id
        WHERE t.task_plan_snapshot_id = $1`,
        [snapshotId],
      );
      const map = new Map<string, TaskArtifactLinkRecord[]>();
      for (const row of result.rows) {
        const existing = map.get(row.task_id) ?? [];
        existing.push({ task_id: row.task_id, artifact_snapshot_id: row.artifact_snapshot_id, relation_type: row.relation_type });
        map.set(row.task_id, existing);
      }
      return map;
    },
  };
}

export interface PlanningTransactionRepositories {
  taskSynthesisJobRepository: TaskSynthesisJobRepository;
  taskPlanRepository: TaskPlanRepository;
  taskRepository: TaskRepository;
}

export async function withPlanningTransaction<T>(
  action: (repositories: PlanningTransactionRepositories) => Promise<T>,
): Promise<T> {
  return withTransaction((client) =>
    action({
      taskSynthesisJobRepository: createTaskSynthesisJobRepository(client),
      taskPlanRepository: createTaskPlanRepository(client),
      taskRepository: createTaskRepository(client),
    }),
  );
}

export const taskSynthesisJobRepository = createTaskSynthesisJobRepository();
export const taskPlanRepository = createTaskPlanRepository();
export const taskRepository = createTaskRepository();
export {
  createTaskSynthesisJobRepository,
  createTaskPlanRepository,
  createTaskRepository,
};
