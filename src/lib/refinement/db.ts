export const refinementSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS artifact_snapshots (
    artifact_snapshot_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    artifact_key TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    body TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    generation_trigger TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'draft',
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    diff_from_previous TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS artifact_snapshots_one_current_per_key
    ON artifact_snapshots(project_id, artifact_key)
    WHERE is_current = TRUE`,

  `CREATE TABLE IF NOT EXISTS artifact_generation_jobs (
    generation_job_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    artifact_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    artifact_snapshot_id TEXT REFERENCES artifact_snapshots(artifact_snapshot_id),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS artifact_approval_audits (
    approval_audit_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    artifact_key TEXT NOT NULL,
    artifact_snapshot_id TEXT NOT NULL REFERENCES artifact_snapshots(artifact_snapshot_id),
    decision TEXT NOT NULL,
    decision_reason TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];
