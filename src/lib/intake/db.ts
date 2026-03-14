import { Pool, type PoolClient, type QueryResultRow } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://vibetodo:vibetodo@localhost:5432/vibetodo";

declare global {
  // eslint-disable-next-line no-var
  var __vibetodoPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: DATABASE_URL,
    max: 10,
  });
}

export const pool = global.__vibetodoPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__vibetodoPool = pool;
}

function isRetryableConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const retryableMessages = [
    "ECONNREFUSED",
    "ENOTFOUND",
    "Connection terminated unexpectedly",
    "the database system is starting up",
    "timeout expired",
  ];

  return retryableMessages.some((message) => error.message.includes(message));
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function withDbRetry<T>(
  action: () => Promise<T>,
  options?: {
    attempts?: number;
    delayMs?: number;
  },
): Promise<T> {
  const attempts = options?.attempts ?? 8;
  const delayMs = options?.delayMs ?? 750;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectionError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function query<T extends QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) {
  return withDbRetry(() => pool.query<T>(sql, values));
}

export async function withTransaction<T>(
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withDbRetry(async () => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    planning_mode TEXT NOT NULL,
    lifecycle_status TEXT NOT NULL,
    draft_intake_payload JSONB NOT NULL,
    confirmed_intake_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS refinement_sessions (
    refinement_session_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    active_artifact_key TEXT NOT NULL,
    last_generation_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS refinement_sessions_one_active_per_project
    ON refinement_sessions(project_id)
    WHERE status = 'active'`,
];
