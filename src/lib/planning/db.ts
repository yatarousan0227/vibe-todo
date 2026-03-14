export const planningSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS task_synthesis_jobs (
    synthesis_job_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    generation_trigger TEXT NOT NULL,
    source_artifact_snapshot_ids JSONB NOT NULL DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS task_plan_snapshots (
    task_plan_snapshot_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    synthesis_job_id TEXT REFERENCES task_synthesis_jobs(synthesis_job_id),
    freshness_status TEXT NOT NULL DEFAULT 'candidate',
    publish_status TEXT NOT NULL DEFAULT 'unpublished',
    is_current_published BOOLEAN NOT NULL DEFAULT FALSE,
    generated_from_artifact_set JSONB NOT NULL DEFAULT '[]',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    publish_blockers JSONB NOT NULL DEFAULT '[]'
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS task_plan_snapshots_one_current_published_per_project
    ON task_plan_snapshots(project_id)
    WHERE is_current_published = TRUE`,

  `CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    task_plan_snapshot_id TEXT NOT NULL REFERENCES task_plan_snapshots(task_plan_snapshot_id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    due_date TEXT,
    dependencies JSONB NOT NULL DEFAULT '[]',
    estimate TEXT,
    assignee TEXT,
    execution_order INTEGER NOT NULL DEFAULT 0,
    is_due_date_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
    is_estimate_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
    is_assignee_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
    placeholder_reasons JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS task_artifact_links (
    task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    artifact_snapshot_id TEXT NOT NULL REFERENCES artifact_snapshots(artifact_snapshot_id),
    relation_type TEXT NOT NULL DEFAULT 'source',
    PRIMARY KEY (task_id, artifact_snapshot_id)
  )`,
];
