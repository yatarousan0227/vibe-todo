import assert from "node:assert/strict";
import { query, schemaStatements } from "../src/lib/intake/db";

export const BASE_URL =
  process.env.APP_URL ?? "http://localhost:3000";

export async function ensureSchema() {
  for (const statement of schemaStatements) {
    await query(statement);
  }
}

export async function resetDatabase() {
  await query("TRUNCATE TABLE refinement_sessions, projects RESTART IDENTITY CASCADE");
}

export async function waitForApp(options?: {
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = options?.attempts ?? 30;
  const delayMs = options?.delayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        return;
      }

      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw lastError;
}

export async function postProjectCommand(body: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function getWorkspace(projectId: string) {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/workspace-context`,
  );

  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export function createProjectPayload(overrides?: {
  title?: string;
  objective?: string;
  background?: string;
  scope?: string;
  stakeholders?: string;
  constraints?: string;
  freeFormBody?: string;
}) {
  return {
    planning_mode: "project",
    structuredInput: {
      title: overrides?.title ?? "Community garden launch",
      objective:
        overrides?.objective ??
        "Prepare a neighborhood garden opening plan",
      background_or_current_situation:
        overrides?.background ??
        "The lot is available, but volunteers and permit timing are not aligned yet.",
      scope_summary:
        overrides?.scope ??
        "Beds, volunteer shifts, supply pickup, and opening-day setup",
      stakeholders:
        overrides?.stakeholders ??
        "Neighbors, school staff, city permit office",
      constraints_or_conditions:
        overrides?.constraints ??
        "Stay within the donated materials list and finish before the school festival.",
    },
    freeFormInput: {
      body:
        overrides?.freeFormBody ??
        "We want the first refinement artifact to clarify priorities without turning this into software-delivery language.\nKeep the plan friendly for family volunteers.",
    },
  };
}

export function assertObject(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  assert.ok(value && typeof value === "object", message);
}
