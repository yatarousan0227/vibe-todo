import { randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { pool, withTransaction } from "../intake/db";
import type {
  ArtifactApprovalAuditRecord,
  ArtifactGenerationJobRecord,
  ArtifactKey,
  ArtifactSnapshotRecord,
  ApprovalDecision,
  ApprovalStatus,
  GenerationTrigger,
  JobStatus,
} from "./types";

type Queryable = Pick<Pool, "query"> | PoolClient;

interface ArtifactSnapshotRow {
  artifact_snapshot_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  version_number: number;
  body: string;
  change_reason: string;
  generation_trigger: GenerationTrigger;
  approval_status: ApprovalStatus;
  is_current: boolean;
  diff_from_previous: string | null;
  created_at: Date;
}

interface ArtifactGenerationJobRow {
  generation_job_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  status: JobStatus;
  artifact_snapshot_id: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ArtifactApprovalAuditRow {
  approval_audit_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  artifact_snapshot_id: string;
  decision: ApprovalDecision;
  decision_reason: string;
  decided_at: Date;
}

function mapSnapshotRow(row: ArtifactSnapshotRow): ArtifactSnapshotRecord {
  return {
    artifact_snapshot_id: row.artifact_snapshot_id,
    project_id: row.project_id,
    artifact_key: row.artifact_key,
    version_number: row.version_number,
    body: row.body,
    change_reason: row.change_reason,
    generation_trigger: row.generation_trigger,
    approval_status: row.approval_status,
    is_current: row.is_current,
    diff_from_previous: row.diff_from_previous,
    created_at: row.created_at.toISOString(),
  };
}

function mapJobRow(row: ArtifactGenerationJobRow): ArtifactGenerationJobRecord {
  return {
    generation_job_id: row.generation_job_id,
    project_id: row.project_id,
    artifact_key: row.artifact_key,
    status: row.status,
    artifact_snapshot_id: row.artifact_snapshot_id,
    error_message: row.error_message,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapAuditRow(row: ArtifactApprovalAuditRow): ArtifactApprovalAuditRecord {
  return {
    approval_audit_id: row.approval_audit_id,
    project_id: row.project_id,
    artifact_key: row.artifact_key,
    artifact_snapshot_id: row.artifact_snapshot_id,
    decision: row.decision,
    decision_reason: row.decision_reason,
    decided_at: row.decided_at.toISOString(),
  };
}

async function runQuery<T extends QueryResultRow>(
  executor: Queryable,
  sql: string,
  values: unknown[] = [],
) {
  return executor.query<T>(sql, values);
}

export interface ArtifactRepository {
  getCurrentSnapshot(
    projectId: string,
    artifactKey: ArtifactKey,
  ): Promise<ArtifactSnapshotRecord | null>;
  getPreviousSnapshot(
    projectId: string,
    artifactKey: ArtifactKey,
  ): Promise<ArtifactSnapshotRecord | null>;
  getSnapshotById(id: string): Promise<ArtifactSnapshotRecord | null>;
  getAllCurrentSnapshots(
    projectId: string,
  ): Promise<Map<ArtifactKey, ArtifactSnapshotRecord | null>>;
  getApprovedUpstreamSnapshots(
    projectId: string,
    upstreamKeys: ArtifactKey[],
  ): Promise<ArtifactSnapshotRecord[]>;
  createSnapshot(input: {
    projectId: string;
    artifactKey: ArtifactKey;
    body: string;
    changeReason: string;
    generationTrigger: GenerationTrigger;
    diffFromPrevious: string | null;
  }): Promise<ArtifactSnapshotRecord>;
  approveSnapshot(id: string): Promise<ArtifactSnapshotRecord>;
  markSnapshotStale(id: string): Promise<void>;
  markDownstreamSnapshotsStale(
    projectId: string,
    downstreamKeys: ArtifactKey[],
  ): Promise<void>;
  getApprovalHistory(
    projectId: string,
    artifactKey: ArtifactKey,
  ): Promise<ArtifactApprovalAuditRecord[]>;
  createApprovalAudit(input: {
    projectId: string;
    artifactKey: ArtifactKey;
    artifactSnapshotId: string;
    decision: ApprovalDecision;
    decisionReason: string;
  }): Promise<ArtifactApprovalAuditRecord>;
}

export interface GenerationJobRepository {
  createJob(
    projectId: string,
    artifactKey: ArtifactKey,
  ): Promise<ArtifactGenerationJobRecord>;
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    options?: { snapshotId?: string; errorMessage?: string },
  ): Promise<ArtifactGenerationJobRecord>;
  getLatestJob(
    projectId: string,
    artifactKey: ArtifactKey,
  ): Promise<ArtifactGenerationJobRecord | null>;
}

function createArtifactRepository(executor: Queryable = pool): ArtifactRepository {
  return {
    async getCurrentSnapshot(projectId, artifactKey) {
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `SELECT artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at
        FROM artifact_snapshots
        WHERE project_id = $1 AND artifact_key = $2 AND is_current = TRUE`,
        [projectId, artifactKey],
      );
      return result.rowCount === 0 ? null : mapSnapshotRow(result.rows[0]);
    },

    async getPreviousSnapshot(projectId, artifactKey) {
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `SELECT artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at
        FROM artifact_snapshots
        WHERE project_id = $1 AND artifact_key = $2 AND is_current = FALSE
        ORDER BY created_at DESC
        LIMIT 1`,
        [projectId, artifactKey],
      );
      return result.rowCount === 0 ? null : mapSnapshotRow(result.rows[0]);
    },

    async getSnapshotById(id) {
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `SELECT artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at
        FROM artifact_snapshots
        WHERE artifact_snapshot_id = $1`,
        [id],
      );
      return result.rowCount === 0 ? null : mapSnapshotRow(result.rows[0]);
    },

    async getAllCurrentSnapshots(projectId) {
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `SELECT artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at
        FROM artifact_snapshots
        WHERE project_id = $1 AND is_current = TRUE`,
        [projectId],
      );
      const map = new Map<ArtifactKey, ArtifactSnapshotRecord | null>();
      for (const row of result.rows) {
        map.set(row.artifact_key, mapSnapshotRow(row));
      }
      return map;
    },

    async getApprovedUpstreamSnapshots(projectId, upstreamKeys) {
      if (upstreamKeys.length === 0) return [];
      const placeholders = upstreamKeys.map((_, i) => `$${i + 2}`).join(", ");
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `SELECT artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at
        FROM artifact_snapshots
        WHERE project_id = $1 AND artifact_key IN (${placeholders})
          AND approval_status = 'approved' AND is_current = TRUE`,
        [projectId, ...upstreamKeys],
      );
      return result.rows.map(mapSnapshotRow);
    },

    async createSnapshot(input) {
      const snapshotId = randomUUID();
      const nextVersionResult = await runQuery<{ max: number | null }>(
        executor,
        `SELECT MAX(version_number) as max FROM artifact_snapshots
        WHERE project_id = $1 AND artifact_key = $2`,
        [input.projectId, input.artifactKey],
      );
      const nextVersion = (nextVersionResult.rows[0].max ?? 0) + 1;

      await runQuery(
        executor,
        `UPDATE artifact_snapshots SET is_current = FALSE
        WHERE project_id = $1 AND artifact_key = $2 AND is_current = TRUE`,
        [input.projectId, input.artifactKey],
      );

      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `INSERT INTO artifact_snapshots (
          artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current, diff_from_previous
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', TRUE, $8)
        RETURNING artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at`,
        [
          snapshotId,
          input.projectId,
          input.artifactKey,
          nextVersion,
          input.body,
          input.changeReason,
          input.generationTrigger,
          input.diffFromPrevious,
        ],
      );
      return mapSnapshotRow(result.rows[0]);
    },

    async approveSnapshot(id) {
      const result = await runQuery<ArtifactSnapshotRow>(
        executor,
        `UPDATE artifact_snapshots
        SET approval_status = 'approved'
        WHERE artifact_snapshot_id = $1
        RETURNING artifact_snapshot_id, project_id, artifact_key, version_number,
          body, change_reason, generation_trigger, approval_status, is_current,
          diff_from_previous, created_at`,
        [id],
      );
      return mapSnapshotRow(result.rows[0]);
    },

    async markSnapshotStale(id) {
      await runQuery(
        executor,
        `UPDATE artifact_snapshots SET approval_status = 'stale'
        WHERE artifact_snapshot_id = $1`,
        [id],
      );
    },

    async markDownstreamSnapshotsStale(projectId, downstreamKeys) {
      if (downstreamKeys.length === 0) return;
      const placeholders = downstreamKeys.map((_, i) => `$${i + 2}`).join(", ");
      await runQuery(
        executor,
        `UPDATE artifact_snapshots
        SET approval_status = 'stale'
        WHERE project_id = $1 AND artifact_key IN (${placeholders})
          AND is_current = TRUE AND approval_status = 'approved'`,
        [projectId, ...downstreamKeys],
      );
    },

    async getApprovalHistory(projectId, artifactKey) {
      const result = await runQuery<ArtifactApprovalAuditRow>(
        executor,
        `SELECT approval_audit_id, project_id, artifact_key, artifact_snapshot_id,
          decision, decision_reason, decided_at
        FROM artifact_approval_audits
        WHERE project_id = $1 AND artifact_key = $2
        ORDER BY decided_at DESC`,
        [projectId, artifactKey],
      );
      return result.rows.map(mapAuditRow);
    },

    async createApprovalAudit(input) {
      const auditId = randomUUID();
      const result = await runQuery<ArtifactApprovalAuditRow>(
        executor,
        `INSERT INTO artifact_approval_audits (
          approval_audit_id, project_id, artifact_key, artifact_snapshot_id,
          decision, decision_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING approval_audit_id, project_id, artifact_key, artifact_snapshot_id,
          decision, decision_reason, decided_at`,
        [
          auditId,
          input.projectId,
          input.artifactKey,
          input.artifactSnapshotId,
          input.decision,
          input.decisionReason,
        ],
      );
      return mapAuditRow(result.rows[0]);
    },
  };
}

function createGenerationJobRepository(
  executor: Queryable = pool,
): GenerationJobRepository {
  return {
    async createJob(projectId, artifactKey) {
      const jobId = randomUUID();
      const result = await runQuery<ArtifactGenerationJobRow>(
        executor,
        `INSERT INTO artifact_generation_jobs (
          generation_job_id, project_id, artifact_key, status
        )
        VALUES ($1, $2, $3, 'queued')
        RETURNING generation_job_id, project_id, artifact_key, status,
          artifact_snapshot_id, error_message, created_at, updated_at`,
        [jobId, projectId, artifactKey],
      );
      return mapJobRow(result.rows[0]);
    },

    async updateJobStatus(jobId, status, options) {
      const result = await runQuery<ArtifactGenerationJobRow>(
        executor,
        `UPDATE artifact_generation_jobs
        SET status = $2, artifact_snapshot_id = $3, error_message = $4, updated_at = NOW()
        WHERE generation_job_id = $1
        RETURNING generation_job_id, project_id, artifact_key, status,
          artifact_snapshot_id, error_message, created_at, updated_at`,
        [
          jobId,
          status,
          options?.snapshotId ?? null,
          options?.errorMessage ?? null,
        ],
      );
      return mapJobRow(result.rows[0]);
    },

    async getLatestJob(projectId, artifactKey) {
      const result = await runQuery<ArtifactGenerationJobRow>(
        executor,
        `SELECT generation_job_id, project_id, artifact_key, status,
          artifact_snapshot_id, error_message, created_at, updated_at
        FROM artifact_generation_jobs
        WHERE project_id = $1 AND artifact_key = $2
        ORDER BY created_at DESC
        LIMIT 1`,
        [projectId, artifactKey],
      );
      return result.rowCount === 0 ? null : mapJobRow(result.rows[0]);
    },
  };
}

export interface RefinementTransactionRepositories {
  artifactRepository: ArtifactRepository;
  generationJobRepository: GenerationJobRepository;
}

export async function withRefinementTransaction<T>(
  action: (repositories: RefinementTransactionRepositories) => Promise<T>,
): Promise<T> {
  return withTransaction((client) =>
    action({
      artifactRepository: createArtifactRepository(client),
      generationJobRepository: createGenerationJobRepository(client),
    }),
  );
}

export const artifactRepository = createArtifactRepository();
export const generationJobRepository = createGenerationJobRepository();
export { createArtifactRepository, createGenerationJobRepository };
