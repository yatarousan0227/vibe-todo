import type {
  TaskSynthesisEngineInput,
  TaskSynthesisEngineOutput,
  GeneratedTask,
} from "./types";
import {
  isValidTaskPriority,
  isValidTaskStatus,
} from "./model";
import { LLMProviderFactory } from "../llm/factory";
import type { LLMProvider } from "../llm/types";
import type { ArtifactKey } from "../refinement/types";
import type { IntakePayload } from "../intake/types";

export interface TaskSynthesisEngine {
  generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput>;
}

const KNOWN_PROVIDERS = ["openai", "anthropic", "azure_openai"] as const;
type ProviderName = (typeof KNOWN_PROVIDERS)[number];

type RawTaskPayload = Partial<{
  taskKey: unknown;
  title: unknown;
  description: unknown;
  executionSteps: unknown;
  priority: unknown;
  status: unknown;
  dueDate: unknown;
  estimate: unknown;
  assignee: unknown;
  dependsOnTaskKeys: unknown;
  relatedArtifactSnapshotIds: unknown;
  relationType: unknown;
}>;

const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  objective_and_outcome: "Objective and Outcome",
  background_and_current_situation: "Background and Current Situation",
  scope_and_non_scope: "Scope and Non-Scope",
  constraints_and_conditions: "Constraints and Conditions",
  stakeholders_and_roles: "Stakeholders and Roles",
  deliverables_and_milestones: "Deliverables and Milestones",
  work_breakdown: "Work Breakdown",
  risks_assumptions_and_open_questions: "Risks, Assumptions, and Open Questions",
};

const HEURISTIC_ARTIFACT_PRIORITY: ArtifactKey[] = [
  "work_breakdown",
  "deliverables_and_milestones",
  "constraints_and_conditions",
  "stakeholders_and_roles",
  "risks_assumptions_and_open_questions",
  "scope_and_non_scope",
  "objective_and_outcome",
  "background_and_current_situation",
];

function makePlaceholderDate(dayOffset = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split("T")[0];
}

function extractSentences(text: string, limit: number): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 16)
    .slice(0, limit);
}

function extractArtifactEvidenceLines(body: string): string[] {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitLines = lines
    .filter((line) =>
      /^(?:[-*+]\s+|\d+[.)]\s+|\[[ xX]\]\s+|#{1,6}\s+)/.test(line),
    )
    .map((line) =>
      line
        .replace(/^(?:[-*+]\s+|\d+[.)]\s+|\[[ xX]\]\s+|#{1,6}\s+)/, "")
        .trim(),
    )
    .filter((line) => line.length > 0);

  if (explicitLines.length > 0) {
    return Array.from(new Set(explicitLines)).slice(0, 8);
  }

  return Array.from(new Set(extractSentences(body, 6)));
}

function sortArtifactsForSynthesis(
  artifacts: TaskSynthesisEngineInput["approvedArtifacts"],
): TaskSynthesisEngineInput["approvedArtifacts"] {
  return [...artifacts].sort(
    (left, right) =>
      HEURISTIC_ARTIFACT_PRIORITY.indexOf(left.artifactKey) -
      HEURISTIC_ARTIFACT_PRIORITY.indexOf(right.artifactKey),
  );
}

function partitionArtifactsForSynthesis(
  artifacts: TaskSynthesisEngineInput["approvedArtifacts"],
): TaskSynthesisEngineInput["approvedArtifacts"][] {
  const sorted = sortArtifactsForSynthesis(artifacts);
  const batches: TaskSynthesisEngineInput["approvedArtifacts"][] = [];
  let currentBatch: TaskSynthesisEngineInput["approvedArtifacts"] = [];
  let currentChars = 0;

  for (const artifact of sorted) {
    const artifactChars = artifact.body.length;
    const wouldOverflow =
      currentBatch.length >= 3 || (currentBatch.length > 0 && currentChars + artifactChars > 2800);

    if (wouldOverflow) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(artifact);
    currentChars += artifactChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches.length > 0 ? batches : [sorted];
}

function buildArtifactEvidenceSummary(
  artifacts: TaskSynthesisEngineInput["approvedArtifacts"],
): string {
  return artifacts
    .map((artifact) => {
      const evidenceLines = extractArtifactEvidenceLines(artifact.body);
      return [
        `### ${buildArtifactLabel(artifact.artifactKey)}`,
        `artifact_snapshot_id: ${artifact.artifact_snapshot_id}`,
        ...evidenceLines.map((line) => `- ${line}`),
      ].join("\n");
    })
    .join("\n\n");
}

function computeSuggestedTaskRange(
  input: TaskSynthesisEngineInput,
): { min: number; max: number } {
  const evidenceCount = input.approvedArtifacts.reduce((count, artifact) => {
    const lines = extractArtifactEvidenceLines(artifact.body);
    const weight =
      artifact.artifactKey === "work_breakdown" ||
      artifact.artifactKey === "deliverables_and_milestones"
        ? 2
        : 1;
    return count + lines.length * weight;
  }, 0);

  const target = Math.min(18, Math.max(6, Math.ceil(evidenceCount / 2)));
  return {
    min: Math.max(5, target - 2),
    max: Math.min(20, target + 2),
  };
}

function buildArtifactLabel(key: ArtifactKey): string {
  return ARTIFACT_LABELS[key] ?? key.replace(/_/g, " ");
}

function buildStructuredContext(projectContext: IntakePayload): string {
  const { structured_input: structured, free_form_input: freeForm, planning_mode } = projectContext;
  return [
    `Planning mode: ${planning_mode}`,
    `Project title: ${structured.title || "(not set)"}`,
    `Objective: ${structured.objective || "(not set)"}`,
    `Background / current situation: ${structured.background_or_current_situation || "(not set)"}`,
    `Scope summary: ${structured.scope_summary || "(not set)"}`,
    `Stakeholders: ${structured.stakeholders || "(not set)"}`,
    `Expected outcome or deliverable: ${structured.expected_outcome_or_deliverable || "(not set)"}`,
    `Constraints or conditions: ${structured.constraints_or_conditions || "(not set)"}`,
    "",
    "Free-form input:",
    freeForm.body || "(not set)",
  ].join("\n");
}

function buildApprovedArtifactsContext(
  artifacts: TaskSynthesisEngineInput["approvedArtifacts"],
): string {
  return artifacts
    .map((artifact) =>
      [
        `### ${buildArtifactLabel(artifact.artifactKey)}`,
        `artifact_snapshot_id: ${artifact.artifact_snapshot_id}`,
        artifact.body,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildTaskSynthesisPrompt(
  input: TaskSynthesisEngineInput,
  promptArtifacts: TaskSynthesisEngineInput["approvedArtifacts"],
  batchInfo?: { index: number; total: number },
): string {
  const taskRange = computeSuggestedTaskRange({
    ...input,
    approvedArtifacts: promptArtifacts,
  });
  return [
    "You are generating a canonical task plan from approved planning artifacts.",
    "Return strict JSON only. Do not wrap the response in markdown or code fences.",
    "The response must match this schema exactly:",
    '{',
    '  "planningBasisNote": "short summary",',
    '  "tasks": [',
    "    {",
    '      "taskKey": "TASK-001",',
    '      "title": "string",',
    '      "description": "string",',
    '      "executionSteps": ["short imperative step", "short imperative step"],',
    '      "priority": "high|medium|low",',
    '      "status": "ready|in_progress|blocked|done|backlog",',
    '      "dueDate": "YYYY-MM-DD or null",',
    '      "estimate": "short text like 4h or 2d, or null",',
    '      "assignee": "person, role, or self, or null",',
    '      "dependsOnTaskKeys": ["TASK-000"],',
    '      "relatedArtifactSnapshotIds": ["artifact snapshot ids from the approved list"],',
    '      "relationType": "source"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    `- Aim for ${taskRange.min} to ${taskRange.max} tasks unless the source material clearly requires a narrower range.`,
    "- Break work down to roughly 0.5 to 1 person-day per task. If a task would exceed 1 person-day or bundles multiple deliverables, split it further.",
    "- Use the dominant language from the project context.",
    "- Use the approved artifacts aggressively. Prefer the work breakdown, deliverables, milestones, constraints, stakeholders, and risks as grounding evidence instead of summarizing the project at a high level.",
    "- Avoid umbrella tasks such as 'execute the project', 'build everything', or 'handle deliverables'. Each task should represent one concrete outcome with a clear finish condition.",
    "- `executionSteps` must contain 2 to 5 concrete steps that explain how to execute the task.",
    "- Use `dependsOnTaskKeys` to express task dependencies within this generated plan. Leave it empty only when the task can truly start immediately.",
    "- Keep every task directly traceable to at least one approved artifact snapshot id.",
    "- Fill due date, estimate, and assignee as aggressively as the artifacts allow. Use a provisional value when the exact value is unclear instead of keeping the field empty whenever a reasonable assumption exists.",
    "- Do not invent artifact snapshot ids that are not in the approved artifact list.",
    "- relationType must always be source.",
    "- Task keys must be unique within the response.",
    ...(batchInfo
      ? [
          `- This is batch ${batchInfo.index + 1} of ${batchInfo.total}. Generate only tasks grounded in the artifacts included in this batch.`,
          "- Do not emit generic summary tasks for artifacts that are not shown in this batch.",
        ]
      : []),
    "",
    "Project context:",
    buildStructuredContext(input.projectContext as IntakePayload),
    "",
    "Document-derived planning evidence:",
    buildArtifactEvidenceSummary(promptArtifacts),
    "",
    "Approved artifacts:",
    buildApprovedArtifactsContext(promptArtifacts),
  ].join("\n");
}

function buildPhaseTaskSynthesisPrompt(
  input: TaskSynthesisEngineInput,
  phase: PhaseBlueprint,
  milestones: MilestoneBlueprint[],
): string {
  const relatedMilestone =
    milestones.find((milestone) => milestone.order === phase.order) ?? null;
  const supportingArtifacts = sortArtifactsForSynthesis(
    input.approvedArtifacts.filter((artifact) => artifact.artifactKey !== "work_breakdown"),
  );

  return [
    "You are generating task breakdowns for one specific phase from an approved work breakdown.",
    "Return strict JSON only. Do not wrap the response in markdown or code fences.",
    "Generate tasks only for the current phase. Do not include tasks from earlier or later phases.",
    "The response must match this schema exactly:",
    '{',
    '  "planningBasisNote": "short summary",',
    '  "tasks": [',
    "    {",
    '      "taskKey": "TASK-001",',
    '      "title": "string",',
    '      "description": "string",',
    '      "executionSteps": ["short imperative step", "short imperative step"],',
    '      "priority": "high|medium|low",',
    '      "status": "ready|in_progress|blocked|done|backlog",',
    '      "dueDate": "YYYY-MM-DD or null",',
    '      "estimate": "short text like 4h or 1d, or null",',
    '      "assignee": "person, role, or self, or null",',
    '      "dependsOnTaskKeys": ["TASK-000"],',
    '      "relatedArtifactSnapshotIds": ["artifact snapshot ids from the approved list"],',
    '      "relationType": "source"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Create 2 to 6 tasks for this phase.",
    "- Break work down to roughly 0.5 to 1 person-day per task.",
    "- Task order within the response must follow execution order inside this phase.",
    "- `dependsOnTaskKeys` may reference only tasks inside this phase. Do not reference other phases yet.",
    "- Keep every task directly traceable to at least one approved artifact snapshot id.",
    "- Use the dominant language from the project context.",
    "",
    "Project context:",
    buildStructuredContext(input.projectContext as IntakePayload),
    "",
    `Current phase: Phase ${phase.order} - ${phase.title}`,
    `Phase dependency: ${phase.dependsOnPhaseOrders.length > 0 ? phase.dependsOnPhaseOrders.map((order) => `Phase ${order}`).join(", ") : "none"}`,
    "Phase detail:",
    phase.body,
    "",
    ...(relatedMilestone
      ? [
          `Related milestone: Milestone ${relatedMilestone.order} - ${relatedMilestone.title}`,
          ...relatedMilestone.clues.slice(0, 6).map((clue) => `- ${clue}`),
          "",
        ]
      : []),
    "Supporting artifact evidence:",
    buildArtifactEvidenceSummary(supportingArtifacts),
  ].join("\n");
}

function buildTaskSchedulingPrompt(
  input: TaskSynthesisEngineInput,
  phases: PhaseBlueprint[],
  milestones: MilestoneBlueprint[],
  tasks: Array<{ task: GeneratedTask; phaseOrder: number }>,
): string {
  const horizonDays = extractPlanningHorizonDays(input);
  return [
    "You are sequencing already-generated tasks into a coherent schedule.",
    "Return strict JSON only. Do not wrap the response in markdown or code fences.",
    "The response must match this schema exactly:",
    '{',
    '  "tasks": [',
    "    {",
    '      "taskKey": "TASK-001",',
    '      "dependsOnTaskKeys": ["TASK-000"],',
    '      "dueDate": "YYYY-MM-DD"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Return every task exactly once.",
    "- Respect phase order from the work breakdown. A later phase must never precede an earlier phase.",
    "- Respect explicit phase dependencies from the work breakdown.",
    "- Due dates must be monotonically non-decreasing in execution order.",
    `- Keep the full plan within approximately ${horizonDays} days from now unless the artifacts clearly justify a shorter window.`,
    "",
    "Phase plan:",
    ...phases.map(
      (phase) =>
        `- Phase ${phase.order}: ${phase.title} (depends on: ${phase.dependsOnPhaseOrders.length > 0 ? phase.dependsOnPhaseOrders.map((order) => `Phase ${order}`).join(", ") : "none"})`,
    ),
    "",
    ...(milestones.length > 0
      ? [
          "Milestones:",
          ...milestones.map((milestone) => `- Milestone ${milestone.order}: ${milestone.title}`),
          "",
        ]
      : []),
    "Tasks to schedule:",
    ...tasks.map(
      ({ task, phaseOrder }) =>
        `- ${task.taskKey} | phase=${phaseOrder} | title=${task.title} | current_dependencies=${task.dependencyTaskKeys.join(",") || "none"}`,
    ),
  ].join("\n");
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return trimmed;
}

function normalizeRelatedArtifactIds(
  value: unknown,
  approvedArtifactIds: string[],
  fallbackArtifactId: string,
): string[] {
  if (!Array.isArray(value)) {
    return [fallbackArtifactId];
  }

  const approvedSet = new Set(approvedArtifactIds);
  const validIds = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && approvedSet.has(item));

  return validIds.length > 0 ? Array.from(new Set(validIds)) : [fallbackArtifactId];
}

function parseProviderOutput(text: string): {
  planningBasisNote?: unknown;
  tasks?: unknown;
} {
  const normalized = stripJsonCodeFence(text);
  const parsed = JSON.parse(normalized) as { planningBasisNote?: unknown; tasks?: unknown };
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Task synthesis provider returned a non-object response");
  }
  return parsed;
}

function parseSchedulingOutput(text: string): {
  tasks?: unknown;
} {
  const normalized = stripJsonCodeFence(text);
  const parsed = JSON.parse(normalized) as { tasks?: unknown };
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Task scheduling provider returned a non-object response");
  }
  return parsed;
}

function normalizeTaskKey(value: unknown, index: number, usedKeys: Set<string>): string {
  const rawKey = normalizeText(value) ?? `TASK-${String(index + 1).padStart(3, "0")}`;
  const baseKey = rawKey.replace(/\s+/g, "-").toUpperCase();

  let uniqueKey = baseKey;
  let suffix = 2;
  while (usedKeys.has(uniqueKey)) {
    uniqueKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }
  usedKeys.add(uniqueKey);
  return uniqueKey;
}

function buildTaskDescription(description: string, executionSteps: string[]): string {
  if (executionSteps.length === 0) {
    return description;
  }

  return [
    description,
    "",
    "Execution steps:",
    ...executionSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
}

function collectTimelineHints(input: TaskSynthesisEngineInput): string[] {
  const textSources = [
    JSON.stringify(input.projectContext),
    ...input.approvedArtifacts.map((artifact) => artifact.body),
  ];

  const found = new Set<string>();
  for (const source of textSources) {
    const matches = source.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    for (const match of matches) {
      found.add(match);
    }
  }

  return Array.from(found).sort();
}

function inferDueDate(index: number, timelineHints: string[]): string {
  return timelineHints[index] ?? makePlaceholderDate(2 + index * 2);
}

function inferEstimate(executionSteps: string[], title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(review|align|confirm|kickoff|sync)\b/.test(text)) {
    return "2h";
  }
  if (executionSteps.length <= 2) {
    return "4h";
  }
  if (executionSteps.length <= 4) {
    return "6h";
  }
  return "1d";
}

function inferAssignee(): string {
  return "self";
}

interface PhaseBlueprint {
  order: number;
  title: string;
  body: string;
  clues: string[];
  dependsOnPhaseOrders: number[];
}

interface MilestoneBlueprint {
  order: number;
  title: string;
  clues: string[];
}

function normalizeClue(text: string): string {
  return text
    .replace(/[`*_#>-]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectClues(title: string, body: string): string[] {
  const rawLines = [title, ...body.split(/\r?\n/)]
    .map((line) => normalizeClue(line))
    .filter((line) => line.length >= 2);

  const clues = new Set<string>();
  for (const line of rawLines) {
    clues.add(line);
    for (const fragment of line.split(/[、,・/]/)) {
      const normalized = normalizeClue(fragment);
      if (normalized.length >= 2 && normalized.length <= 28) {
        clues.add(normalized);
      }
    }
  }

  return Array.from(clues);
}

function parsePhaseBlueprints(input: TaskSynthesisEngineInput): PhaseBlueprint[] {
  const workBreakdown = input.approvedArtifacts.find(
    (artifact) => artifact.artifactKey === "work_breakdown",
  );
  if (!workBreakdown) {
    return [];
  }

  const phases: PhaseBlueprint[] = [];
  const regex =
    /##\s*フェーズ\s*(\d+)[：:]\s*([^\n]+)\n([\s\S]*?)(?=\n##\s*フェーズ\s*\d+|\n##\s*全体的な流れ|$)/g;
  for (const match of workBreakdown.body.matchAll(regex)) {
    const order = Number(match[1]);
    const title = normalizeClue(match[2]);
    const body = match[3] ?? "";
    const dependsOnPhaseOrders = Array.from(
      new Set(
        [...body.matchAll(/フェーズ\s*(\d+)/g)].map((dependencyMatch) => Number(dependencyMatch[1])),
      ),
    ).filter((dependencyOrder) => dependencyOrder !== order);

    phases.push({
      order,
      title,
      body,
      clues: collectClues(title, body),
      dependsOnPhaseOrders,
    });
  }

  return phases.sort((left, right) => left.order - right.order);
}

function parseMilestoneBlueprints(input: TaskSynthesisEngineInput): MilestoneBlueprint[] {
  const milestoneArtifact = input.approvedArtifacts.find(
    (artifact) => artifact.artifactKey === "deliverables_and_milestones",
  );
  if (!milestoneArtifact) {
    return [];
  }

  const milestones: MilestoneBlueprint[] = [];
  const regex =
    /###\s*Milestone\s*(\d+)[：:]\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*Milestone\s*\d+|$)/g;
  for (const match of milestoneArtifact.body.matchAll(regex)) {
    const order = Number(match[1]);
    const title = normalizeClue(match[2]);
    const body = match[3] ?? "";
    milestones.push({
      order,
      title,
      clues: collectClues(title, body),
    });
  }

  return milestones.sort((left, right) => left.order - right.order);
}

function scoreClueMatch(text: string, clues: string[]): number {
  return clues.reduce((score, clue) => {
    if (clue.length < 2) {
      return score;
    }
    return text.includes(clue.toLowerCase()) ? score + clue.length : score;
  }, 0);
}

function inferPhaseOrderFromText(text: string): number | null {
  if (/メイン言語|開発環境|基本文法|教材/.test(text)) return 1;
  if (/html|css|api|json|http|小規模アプリ|github公開|web開発基礎/.test(text)) return 2;
  if (/技術スタック|設計|実装|デプロイ|中規模アプリ|レビュー/.test(text)) return 3;
  if (/ポートフォリオサイト|プロフィール|作品一覧/.test(text)) return 4;
  if (/履歴書|職務経歴書|エージェント|面談|応募書類/.test(text)) return 5;
  if (/応募企業|書類選考|面接|コーディングテスト|応募開始/.test(text)) return 6;
  if (/内定|条件調整|受諾|入社/.test(text)) return 7;
  return null;
}

function inferMilestoneOrderFromText(text: string): number | null {
  if (/学習基盤|メイン言語|基本文法/.test(text)) return 1;
  if (/web開発基礎|小規模アプリ|github公開/.test(text)) return 2;
  if (/中規模アプリ|技術スタック|デプロイ/.test(text)) return 3;
  if (/ポートフォリオサイト|プロフィール|作品一覧/.test(text)) return 4;
  if (/履歴書|職務経歴書|エージェント|応募書類/.test(text)) return 5;
  if (/応募企業|書類選考|応募開始/.test(text)) return 6;
  if (/面接|コーディングテスト|模擬面接/.test(text)) return 7;
  if (/内定|条件調整|受諾/.test(text)) return 8;
  return null;
}

function inferPhaseOrder(task: GeneratedTask, phases: PhaseBlueprint[]): number {
  const text = `${task.title} ${task.description}`.toLowerCase();
  const ranked = phases
    .map((phase) => ({ order: phase.order, score: scoreClueMatch(text, phase.clues) }))
    .sort((left, right) => right.score - left.score);

  if (ranked[0] && ranked[0].score > 0) {
    return ranked[0].order;
  }

  return inferPhaseOrderFromText(text) ?? Math.max(1, task.executionOrder + 1);
}

function inferMilestoneOrder(task: GeneratedTask, milestones: MilestoneBlueprint[]): number | null {
  const text = `${task.title} ${task.description}`.toLowerCase();
  const ranked = milestones
    .map((milestone) => ({
      order: milestone.order,
      score: scoreClueMatch(text, milestone.clues),
    }))
    .sort((left, right) => right.score - left.score);

  if (ranked[0] && ranked[0].score > 0) {
    return ranked[0].order;
  }

  return inferMilestoneOrderFromText(text);
}

function extractPlanningHorizonDays(input: TaskSynthesisEngineInput): number {
  const textSources = [
    JSON.stringify(input.projectContext),
    ...input.approvedArtifacts.map((artifact) => artifact.body),
  ];
  let maxMonths = 0;

  for (const source of textSources) {
    for (const match of source.matchAll(/(\d+)\s*[〜~]\s*(\d+)\s*ヶ月/g)) {
      maxMonths = Math.max(maxMonths, Number(match[2]));
    }
  }

  return Math.max(90, (maxMonths || 6) * 30);
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function resequenceTasksFromArtifacts(
  tasks: GeneratedTask[],
  input: TaskSynthesisEngineInput,
): GeneratedTask[] {
  if (tasks.length === 0) {
    return tasks;
  }

  const phases = parsePhaseBlueprints(input);
  const milestones = parseMilestoneBlueprints(input);
  const horizonDays = extractPlanningHorizonDays(input);

  const decorated = tasks.map((task) => {
    const phaseOrder = inferPhaseOrder(task, phases);
    const milestoneOrder = inferMilestoneOrder(task, milestones) ?? phaseOrder;
    return { task, phaseOrder, milestoneOrder };
  });

  decorated.sort((left, right) => {
    if (left.phaseOrder !== right.phaseOrder) {
      return left.phaseOrder - right.phaseOrder;
    }
    if (left.milestoneOrder !== right.milestoneOrder) {
      return left.milestoneOrder - right.milestoneOrder;
    }
    return left.task.executionOrder - right.task.executionOrder;
  });

  const oldToNewKey = new Map(
    decorated.map(({ task }, index) => [
      task.taskKey,
      `TASK-${String(index + 1).padStart(3, "0")}`,
    ]),
  );

  const stageCount = Math.max(
    phases.length,
    milestones.length,
    decorated[decorated.length - 1]?.phaseOrder ?? 1,
  );
  const projectStart = addDays(new Date(), 2);
  const lastTaskKeyByPhase = new Map<number, string>();
  const taskCountByPhase = new Map<number, number>();

  return decorated.map(({ task, phaseOrder, milestoneOrder }, index) => {
    const taskKey = oldToNewKey.get(task.taskKey)!;
    const explicitDependencies = task.dependencyTaskKeys
      .map((dependencyTaskKey) => oldToNewKey.get(dependencyTaskKey) ?? dependencyTaskKey)
      .filter((dependencyTaskKey) => dependencyTaskKey !== taskKey);

    let dependencyTaskKeys = explicitDependencies;
    if (dependencyTaskKeys.length === 0) {
      const dependentPhaseOrders =
        phases.find((phase) => phase.order === phaseOrder)?.dependsOnPhaseOrders ?? [];
      const upstreamPhase = dependentPhaseOrders[dependentPhaseOrders.length - 1] ?? phaseOrder - 1;
      const upstreamTaskKey = lastTaskKeyByPhase.get(upstreamPhase);

      if (upstreamTaskKey) {
        dependencyTaskKeys = [upstreamTaskKey];
      } else if (index > 0) {
        dependencyTaskKeys = [oldToNewKey.get(decorated[index - 1].task.taskKey)!];
      }
    }

    const phaseTaskIndex = taskCountByPhase.get(phaseOrder) ?? 0;
    taskCountByPhase.set(phaseOrder, phaseTaskIndex + 1);
    const stageProgress = (Math.max(milestoneOrder, phaseOrder) - 1) / Math.max(stageCount, 1);
    const baseStageOffset = Math.round(stageProgress * horizonDays);
    const dueDate = toIsoDate(addDays(projectStart, baseStageOffset + phaseTaskIndex * 3));

    lastTaskKeyByPhase.set(phaseOrder, taskKey);

    return {
      ...task,
      taskKey,
      executionOrder: index,
      dependencyTaskKeys: Array.from(new Set(dependencyTaskKeys)),
      dueDate,
      isDueDatePlaceholder: true,
      placeholderReasons: {
        ...task.placeholderReasons,
        due_date:
          "Due date was aligned to artifact-defined phase and milestone order; reviewer should confirm",
      },
    };
  });
}

function applySchedulingResult(
  tasks: Array<{ task: GeneratedTask; phaseOrder: number }>,
  phases: PhaseBlueprint[],
  schedulingOutput: { tasks?: unknown },
  input: TaskSynthesisEngineInput,
): GeneratedTask[] {
  if (!Array.isArray(schedulingOutput.tasks)) {
    throw new Error("Task scheduling provider returned no tasks");
  }

  const taskMap = new Map(tasks.map(({ task }) => [task.taskKey, task]));
  const phaseOrderByTaskKey = new Map(
    tasks.map(({ task, phaseOrder }) => [task.taskKey, phaseOrder]),
  );
  const outputMap = new Map<
    string,
    { dependsOnTaskKeys: string[]; dueDate: string | null }
  >();

  for (const rawTask of schedulingOutput.tasks as Array<{
    taskKey?: unknown;
    dependsOnTaskKeys?: unknown;
    dueDate?: unknown;
  }>) {
    const taskKey = normalizeText(rawTask.taskKey);
    if (!taskKey || !taskMap.has(taskKey)) {
      continue;
    }
    outputMap.set(taskKey, {
      dependsOnTaskKeys: normalizeStringArray(rawTask.dependsOnTaskKeys),
      dueDate: normalizeDate(rawTask.dueDate),
    });
  }

  if (outputMap.size !== tasks.length) {
    throw new Error("Task scheduling provider omitted one or more tasks");
  }

  const stageCount = Math.max(
    phases.length,
    tasks[tasks.length - 1]?.phaseOrder ?? 1,
  );
  const horizonDays = extractPlanningHorizonDays(input);
  const projectStart = addDays(new Date(), 2);
  const lastTaskKeyByPhase = new Map<number, string>();
  const taskCountByPhase = new Map<number, number>();
  let lastDueDate = projectStart;

  return tasks.map(({ task, phaseOrder }, index) => {
    const scheduling = outputMap.get(task.taskKey)!;
    const dependentPhaseOrders =
      phases.find((phase) => phase.order === phaseOrder)?.dependsOnPhaseOrders ?? [];
    const remappedDependencies = scheduling.dependsOnTaskKeys.filter((dependencyTaskKey) =>
      taskMap.has(dependencyTaskKey),
    );

    let dependencyTaskKeys = remappedDependencies;
    if (dependencyTaskKeys.length === 0) {
      const upstreamPhase = dependentPhaseOrders[dependentPhaseOrders.length - 1] ?? phaseOrder - 1;
      const upstreamTaskKey = lastTaskKeyByPhase.get(upstreamPhase);
      if (upstreamTaskKey) {
        dependencyTaskKeys = [upstreamTaskKey];
      } else if (index > 0) {
        dependencyTaskKeys = [tasks[index - 1].task.taskKey];
      }
    }

    const phaseTaskIndex = taskCountByPhase.get(phaseOrder) ?? 0;
    taskCountByPhase.set(phaseOrder, phaseTaskIndex + 1);
    const stageProgress = (phaseOrder - 1) / Math.max(stageCount, 1);
    const minimumDueDate = addDays(
      projectStart,
      Math.round(stageProgress * horizonDays) + phaseTaskIndex * 3,
    );
    const candidateDueDate = scheduling.dueDate
      ? new Date(`${scheduling.dueDate}T00:00:00.000Z`)
      : minimumDueDate;
    const stabilizedDueDate =
      candidateDueDate > lastDueDate ? candidateDueDate : addDays(lastDueDate, 3);

    lastDueDate = stabilizedDueDate;
    lastTaskKeyByPhase.set(phaseOrder, task.taskKey);

    return {
      ...task,
      executionOrder: index,
      dependencyTaskKeys: Array.from(new Set(dependencyTaskKeys)),
      dueDate: toIsoDate(stabilizedDueDate),
      isDueDatePlaceholder: true,
      placeholderReasons: {
        ...task.placeholderReasons,
        due_date:
          "Due date was aligned by a scheduling pass that respected phase order and phase dependencies; reviewer should confirm",
      },
    };
  });
}

function clipText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function titleFromEvidence(line: string, artifactLabel: string): string {
  const normalized = line
    .replace(/^[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+/, "")
    .trim();

  if (normalized.length === 0) {
    return `Review ${artifactLabel}`;
  }

  const sentence = normalized.replace(/[.。:]$/, "");
  const words = sentence.split(/\s+/);
  if (words.length <= 8) {
    return clipText(sentence, 72);
  }
  return clipText(`${sentence} (${artifactLabel})`, 72);
}

function buildHeuristicExecutionSteps(line: string, artifactLabel: string): string[] {
  return [
    `Review the approved ${artifactLabel} artifact and isolate the exact requirement or work item.`,
    `Execute the concrete action implied by "${clipText(line, 80)}".`,
    "Record the outcome and confirm any follow-up dependency before moving to the next task.",
  ];
}

function buildHeuristicTasks(input: TaskSynthesisEngineInput): GeneratedTask[] {
  const taskRange = computeSuggestedTaskRange(input);
  const sortedArtifacts = sortArtifactsForSynthesis(input.approvedArtifacts);

  const candidates: Array<{
    artifact_snapshot_id: string;
    artifactKey: ArtifactKey;
    artifactLabel: string;
    line: string;
  }> = [];

  for (const artifact of sortedArtifacts) {
    const evidenceLines = extractArtifactEvidenceLines(artifact.body);
    const lineLimit =
      artifact.artifactKey === "work_breakdown" ||
      artifact.artifactKey === "deliverables_and_milestones"
        ? 3
        : 2;

    for (const line of evidenceLines.slice(0, lineLimit)) {
      candidates.push({
        artifact_snapshot_id: artifact.artifact_snapshot_id,
        artifactKey: artifact.artifactKey,
        artifactLabel: buildArtifactLabel(artifact.artifactKey),
        line,
      });
    }
  }

  const selected = candidates.slice(0, taskRange.max);
  const timelineHints = collectTimelineHints(input);

  return selected.map((candidate, index) => {
    const taskKey = `TASK-${String(index + 1).padStart(3, "0")}`;
    const executionSteps = buildHeuristicExecutionSteps(
      candidate.line,
      candidate.artifactLabel,
    );
    const title = titleFromEvidence(candidate.line, candidate.artifactLabel);
    const description = buildTaskDescription(
      `Execute the work item derived from the approved ${candidate.artifactLabel} artifact: ${clipText(candidate.line, 160)}`,
      executionSteps,
    );

    return {
      taskKey,
      title,
      description,
      priority:
        candidate.artifactKey === "work_breakdown" ||
        candidate.artifactKey === "deliverables_and_milestones"
          ? "high"
          : "medium",
      status: index === 0 ? "ready" : "backlog",
      dueDate: inferDueDate(index, timelineHints),
      dependencyTaskKeys: index === 0 ? [] : [`TASK-${String(index).padStart(3, "0")}`],
      estimate:
        candidate.artifactKey === "work_breakdown" ||
        candidate.artifactKey === "deliverables_and_milestones"
          ? "6h"
          : "4h",
      assignee: "self",
      executionOrder: index,
      isDueDatePlaceholder: true,
      isEstimatePlaceholder: true,
      isAssigneePlaceholder: true,
      placeholderReasons: {
        due_date:
          "Due date was inferred provisionally from artifact order because the provider response was unavailable or incomplete",
        estimate:
          "Estimate was inferred provisionally from document evidence because the provider response was unavailable or incomplete",
        assignee:
          "Assignee defaulted provisionally to self because the provider response was unavailable or incomplete",
      },
      relatedArtifactSnapshotIds: [candidate.artifact_snapshot_id],
      relationType: "source",
    };
  });
}

function normalizeDependencyTaskKeys(
  value: unknown,
  taskKey: string,
  allTaskKeys: string[],
  index: number,
  title: string,
  description: string,
): string[] {
  const validKeys = new Set(allTaskKeys);
  const explicit = normalizeStringArray(value)
    .map((item) => item.replace(/\s+/g, "-").toUpperCase())
    .filter((item) => item !== taskKey && validKeys.has(item));

  if (explicit.length > 0) {
    return explicit;
  }

  if (index === 0) {
    return [];
  }

  const text = `${title} ${description}`.toLowerCase();
  if (
    /\b(implement|build|execute|finalize|launch|publish|test|validate|deploy|handoff|release)\b/.test(
      text,
    )
  ) {
    return [allTaskKeys[index - 1]];
  }

  return [];
}

function normalizeGeneratedTask(
  task: RawTaskPayload,
  index: number,
  taskKey: string,
  allTaskKeys: string[],
  approvedArtifactIds: string[],
  timelineHints: string[],
): GeneratedTask {
  const title = normalizeText(task.title);
  const description = normalizeText(task.description);

  if (!title) {
    throw new Error(`Task synthesis provider returned task ${index + 1} without a title`);
  }
  if (!description) {
    throw new Error(`Task synthesis provider returned task ${index + 1} without a description`);
  }

  const executionSteps = normalizeStringArray(task.executionSteps).slice(0, 5);
  const normalizedDescription = buildTaskDescription(description, executionSteps);
  const normalizedDueDate = normalizeDate(task.dueDate);
  const normalizedEstimate = normalizeText(task.estimate);
  const normalizedAssignee = normalizeText(task.assignee);
  const dueDate = normalizedDueDate ?? inferDueDate(index, timelineHints);
  const estimate = normalizedEstimate ?? inferEstimate(executionSteps, title, description);
  const assignee = normalizedAssignee ?? inferAssignee();
  const fallbackArtifactId =
    approvedArtifactIds[Math.min(index, approvedArtifactIds.length - 1)] ??
    approvedArtifactIds[0];
  const relatedArtifactSnapshotIds = normalizeRelatedArtifactIds(
    task.relatedArtifactSnapshotIds,
    approvedArtifactIds,
    fallbackArtifactId,
  );
  const dependencyTaskKeys = normalizeDependencyTaskKeys(
    task.dependsOnTaskKeys,
    taskKey,
    allTaskKeys,
    index,
    title,
    description,
  );

  return {
    taskKey,
    title,
    description: normalizedDescription,
    priority: isValidTaskPriority(task.priority) ? task.priority : "medium",
    status: isValidTaskStatus(task.status) ? task.status : index === 0 ? "ready" : "backlog",
    dueDate,
    dependencyTaskKeys,
    estimate,
    assignee,
    executionOrder: index,
    isDueDatePlaceholder: normalizedDueDate === null,
    isEstimatePlaceholder: normalizedEstimate === null,
    isAssigneePlaceholder: normalizedAssignee === null,
    placeholderReasons: {
      ...(normalizedDueDate === null
        ? {
            due_date:
              "Due date was inferred provisionally from artifact timeline hints or execution order; reviewer should confirm",
          }
        : {}),
      ...(normalizedEstimate === null
        ? {
            estimate:
              "Estimate was inferred provisionally from task granularity and execution steps; reviewer should confirm",
          }
        : {}),
      ...(normalizedAssignee === null
        ? {
            assignee:
              "Assignee defaulted provisionally because the approved artifacts did not name a clear owner",
          }
        : {}),
    },
    relatedArtifactSnapshotIds,
    relationType:
      normalizeText(task.relationType) === "source" ? "source" : "source",
  };
}

class ProviderBackedTaskSynthesisEngine implements TaskSynthesisEngine {
  constructor(
    private readonly providerName: ProviderName,
    private readonly provider: LLMProvider,
  ) {}

  async generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput> {
    try {
      const approvedArtifactIds = input.approvedArtifacts.map(
        (artifact) => artifact.artifact_snapshot_id,
      );
      const timelineHints = collectTimelineHints(input);
      const planningNotes: string[] = [];
      const phases = parsePhaseBlueprints(input);
      const milestones = parseMilestoneBlueprints(input);
      const phaseTasks: Array<{ task: GeneratedTask; phaseOrder: number }> = [];

      if (phases.length > 0) {
        for (const phase of phases) {
          const result = await this.provider.generateText(
            buildPhaseTaskSynthesisPrompt(input, phase, milestones),
            {
              maxTokens: 1800,
              temperature: 0.2,
            },
          );
          const parsed = parseProviderOutput(result.text);
          if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
            throw new Error(`Task synthesis provider returned no tasks for phase ${phase.order}`);
          }

          const rawTasks = parsed.tasks as RawTaskPayload[];
          const usedTaskKeys = new Set<string>();
          const localTaskKeys = rawTasks.map((task, index) =>
            normalizeTaskKey(task.taskKey, index, usedTaskKeys),
          );
          const globalOffset = phaseTasks.length;
          const rebasedTaskKeys = localTaskKeys.map(
            (_, index) => `TASK-${String(globalOffset + index + 1).padStart(3, "0")}`,
          );
          const localToGlobalKeyMap = new Map(
            localTaskKeys.map((taskKey, index) => [taskKey, rebasedTaskKeys[index]]),
          );

          for (const [index, rawTask] of rawTasks.entries()) {
            const task = normalizeGeneratedTask(
              rawTask,
              globalOffset + index,
              rebasedTaskKeys[index],
              rebasedTaskKeys,
              approvedArtifactIds,
              timelineHints,
            );
            const dependencyTaskKeys = normalizeDependencyTaskKeys(
              rawTask.dependsOnTaskKeys,
              localTaskKeys[index],
              localTaskKeys,
              index,
              task.title,
              task.description,
            ).map((taskKey) => localToGlobalKeyMap.get(taskKey) ?? taskKey);

            phaseTasks.push({
              task: {
                ...task,
                dependencyTaskKeys,
              },
              phaseOrder: phase.order,
            });
          }

          const planningNote = normalizeText(parsed.planningBasisNote);
          if (planningNote) {
            planningNotes.push(`phase ${phase.order}: ${planningNote}`);
          }
        }

        const schedulingResponse = await this.provider.generateText(
          buildTaskSchedulingPrompt(input, phases, milestones, phaseTasks),
          {
            maxTokens: 2200,
            temperature: 0.1,
          },
        );
        const scheduledTasks = applySchedulingResult(
          phaseTasks,
          phases,
          parseSchedulingOutput(schedulingResponse.text),
          input,
        );
        const planningBasisNote =
          planningNotes.length > 0
            ? planningNotes.join(" | ")
            : `Generated from ${input.approvedArtifacts.length} approved artifacts using ${this.providerName}`;

        return {
          tasks: scheduledTasks,
          planningBasisNote,
        };
      }

      const artifactBatches = partitionArtifactsForSynthesis(input.approvedArtifacts);
      const allTasks: GeneratedTask[] = [];
      let previousBatchLastTaskKey: string | null = null;

      for (const [batchIndex, batchArtifacts] of artifactBatches.entries()) {
        const result = await this.provider.generateText(
          buildTaskSynthesisPrompt(input, batchArtifacts, {
            index: batchIndex,
            total: artifactBatches.length,
          }),
          {
            maxTokens: 3200,
            temperature: 0.2,
          },
        );

        const parsed = parseProviderOutput(result.text);
        if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          throw new Error(`Task synthesis provider returned no tasks for batch ${batchIndex + 1}`);
        }

        const rawTasks = parsed.tasks as RawTaskPayload[];
        const usedTaskKeys = new Set<string>();
        const localTaskKeys = rawTasks.map((task, index) =>
          normalizeTaskKey(task.taskKey, index, usedTaskKeys),
        );
        const rebasedTaskKeys = localTaskKeys.map(
          (_, index) => `TASK-${String(allTasks.length + index + 1).padStart(3, "0")}`,
        );
        const localToGlobalKeyMap = new Map(
          localTaskKeys.map((taskKey, index) => [taskKey, rebasedTaskKeys[index]]),
        );

        const batchTasks = rawTasks.map((task, index) => {
          const globalTaskKey = rebasedTaskKeys[index];
          const normalizedTask = normalizeGeneratedTask(
            task,
            allTasks.length + index,
            globalTaskKey,
            rebasedTaskKeys,
            approvedArtifactIds,
            timelineHints,
          );
          const rebasedDependencies = normalizeDependencyTaskKeys(
            task.dependsOnTaskKeys,
            localTaskKeys[index],
            localTaskKeys,
            index,
            normalizedTask.title,
            normalizedTask.description,
          ).map((taskKey) => localToGlobalKeyMap.get(taskKey) ?? taskKey);

          return {
            ...normalizedTask,
            dependencyTaskKeys:
              index === 0 && previousBatchLastTaskKey
                ? Array.from(new Set([previousBatchLastTaskKey, ...rebasedDependencies]))
                : rebasedDependencies,
          };
        });

        allTasks.push(...batchTasks);
        previousBatchLastTaskKey =
          batchTasks[batchTasks.length - 1]?.taskKey ?? previousBatchLastTaskKey;

        const planningNote = normalizeText(parsed.planningBasisNote);
        if (planningNote) {
          planningNotes.push(planningNote);
        }
      }

      const planningBasisNote =
        planningNotes.length > 0
          ? planningNotes.join(" | ")
          : `Generated from ${input.approvedArtifacts.length} approved artifacts using ${this.providerName}`;

      return {
        tasks: resequenceTasksFromArtifacts(allTasks, input),
        planningBasisNote,
      };
    } catch (error) {
      if (error instanceof Error) {
        const fallbackTasks = buildHeuristicTasks(input);
        if (fallbackTasks.length > 0) {
          return {
            tasks: resequenceTasksFromArtifacts(fallbackTasks, input),
            planningBasisNote: `Fell back to document-derived task synthesis because the ${this.providerName} response could not be normalized: ${error.message}`,
          };
        }
      }

      throw error;
    }
  }
}

export class StubTaskSynthesisEngine implements TaskSynthesisEngine {
  async generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput> {
    const artifactIds = input.approvedArtifacts.map((a) => a.artifact_snapshot_id);

    const tasks: GeneratedTask[] = [
      {
        taskKey: "TASK-001",
        title: "Confirm the concrete success criteria",
        description:
          "Review the approved objective artifact and rewrite it into measurable success criteria that can be checked during execution.\n\nExecution steps:\n1. Extract the core outcome from the approved objective artifact.\n2. Rewrite it as measurable acceptance criteria.\n3. Capture open questions that could change the definition of success.",
        priority: "high",
        status: "ready",
        dueDate: makePlaceholderDate(2),
        dependencyTaskKeys: [],
        estimate: "4h",
        assignee: "self",
        executionOrder: 0,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "No deadline specified in approved artifacts; reviewer must confirm",
        },
        relatedArtifactSnapshotIds: artifactIds.slice(0, Math.min(2, artifactIds.length)),
        relationType: "source",
      },
      {
        taskKey: "TASK-002",
        title: "Turn scope and constraints into execution guardrails",
        description:
          "Convert the approved scope, non-scope, and constraint artifacts into a concise set of rules that will constrain downstream work.\n\nExecution steps:\n1. List explicit in-scope and out-of-scope items.\n2. Pull timeline, budget, and policy constraints into one checklist.\n3. Note the guardrails that later implementation tasks must respect.",
        priority: "high",
        status: "ready",
        dueDate: makePlaceholderDate(3),
        dependencyTaskKeys: ["TASK-001"],
        estimate: "3h",
        assignee: "self",
        executionOrder: 1,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "No deadline specified in approved artifacts; reviewer must confirm",
        },
        relatedArtifactSnapshotIds: artifactIds.slice(0, Math.min(3, artifactIds.length)),
        relationType: "source",
      },
      {
        taskKey: "TASK-003",
        title: "Assign owners for the initial work packages",
        description:
          "Translate the stakeholder and role artifact into explicit ownership for the first wave of work packages.\n\nExecution steps:\n1. Match each near-term work package to a responsible role.\n2. Flag packages with no obvious owner.\n3. Record the provisional assignment assumptions for review.",
        priority: "medium",
        status: "ready",
        dueDate: makePlaceholderDate(4),
        dependencyTaskKeys: ["TASK-002"],
        estimate: "4h",
        assignee: "self",
        executionOrder: 2,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "No explicit deadline was stated in the approved artifacts; reviewer should confirm this provisional date",
        },
        relatedArtifactSnapshotIds: artifactIds.slice(0, Math.min(3, artifactIds.length)),
        relationType: "source",
      },
      {
        taskKey: "TASK-004",
        title: "Prepare the first deliverable package",
        description:
          "Assemble the materials, inputs, and decisions required to complete the first deliverable or milestone in the approved plan.\n\nExecution steps:\n1. Pull the prerequisite inputs named in the deliverables artifact.\n2. Draft the deliverable package in a reviewable form.\n3. Check the package against the scope and constraint guardrails.",
        priority: "high",
        status: "backlog",
        dueDate: makePlaceholderDate(6),
        dependencyTaskKeys: ["TASK-002", "TASK-003"],
        estimate: "6h",
        assignee: "self",
        executionOrder: 3,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "Milestone timing was inferred provisionally from the current planning order",
        },
        relatedArtifactSnapshotIds: artifactIds,
        relationType: "source",
      },
      {
        taskKey: "TASK-005",
        title: "Run validation against risks and open questions",
        description:
          "Validate the draft deliverable and execution plan against the approved risks, assumptions, and open questions artifact before finalizing it.\n\nExecution steps:\n1. Review the unresolved risks and assumptions.\n2. Check whether the draft deliverable introduces new blockers.\n3. Record follow-ups needed before execution continues.",
        priority: "medium",
        status: "backlog",
        dueDate: makePlaceholderDate(7),
        dependencyTaskKeys: ["TASK-004"],
        estimate: "4h",
        assignee: "self",
        executionOrder: 4,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "Risk review timing was inferred provisionally from the current planning order",
        },
        relatedArtifactSnapshotIds: artifactIds,
        relationType: "source",
      },
      {
        taskKey: "TASK-006",
        title: "Finalize the ready-to-execute handoff",
        description:
          "Package the validated plan into a handoff that can be executed without reopening the synthesis artifacts immediately.\n\nExecution steps:\n1. Confirm the deliverable package and ownership list are complete.\n2. Capture the next executable step and its dependency chain.\n3. Publish the ready-to-execute handoff summary.",
        priority: "medium",
        status: "backlog",
        dueDate: makePlaceholderDate(8),
        dependencyTaskKeys: ["TASK-005"],
        estimate: "4h",
        assignee: "self",
        executionOrder: 5,
        isDueDatePlaceholder: true,
        isEstimatePlaceholder: false,
        isAssigneePlaceholder: false,
        placeholderReasons: {
          due_date: "Handoff timing was inferred provisionally from the current planning order",
        },
        relatedArtifactSnapshotIds: artifactIds,
        relationType: "source",
      },
    ];

    return {
      tasks: resequenceTasksFromArtifacts(tasks, input),
      planningBasisNote: `Generated from ${input.approvedArtifacts.length} approved artifacts using deterministic stub engine`,
    };
  }
}

export class OpenAITaskSynthesisEngine implements TaskSynthesisEngine {
  private readonly delegate: ProviderBackedTaskSynthesisEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedTaskSynthesisEngine(
      "openai",
      provider ??
        LLMProviderFactory.create({ ...process.env, LLM_PROVIDER: "openai" }),
    );
  }

  async generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput> {
    return this.delegate.generateTasks(input);
  }
}

export class AnthropicTaskSynthesisEngine implements TaskSynthesisEngine {
  private readonly delegate: ProviderBackedTaskSynthesisEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedTaskSynthesisEngine(
      "anthropic",
      provider ??
        LLMProviderFactory.create({ ...process.env, LLM_PROVIDER: "anthropic" }),
    );
  }

  async generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput> {
    return this.delegate.generateTasks(input);
  }
}

export class AzureOpenAITaskSynthesisEngine implements TaskSynthesisEngine {
  private readonly delegate: ProviderBackedTaskSynthesisEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedTaskSynthesisEngine(
      "azure_openai",
      provider ??
        LLMProviderFactory.create({
          ...process.env,
          LLM_PROVIDER: "azure_openai",
        }),
    );
  }

  async generateTasks(input: TaskSynthesisEngineInput): Promise<TaskSynthesisEngineOutput> {
    return this.delegate.generateTasks(input);
  }
}

export function resolveConfiguredTaskSynthesisProvider(
  env: Record<string, string | undefined>,
): ProviderName | "stub" {
  const provider = env["LLM_PROVIDER"];
  if (!provider) {
    return "stub";
  }
  if ((KNOWN_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as ProviderName;
  }
  throw new Error(
    `LLM_PROVIDER must be one of: ${KNOWN_PROVIDERS.join(", ")}`,
  );
}

function resolveTaskSynthesisEngine(
  env: Record<string, string | undefined> = process.env,
): TaskSynthesisEngine {
  const provider = resolveConfiguredTaskSynthesisProvider(env);
  switch (provider) {
    case "openai":
      return new OpenAITaskSynthesisEngine();
    case "anthropic":
      return new AnthropicTaskSynthesisEngine();
    case "azure_openai":
      return new AzureOpenAITaskSynthesisEngine();
    default:
      return new StubTaskSynthesisEngine();
  }
}

export const taskSynthesisEngine: TaskSynthesisEngine = resolveTaskSynthesisEngine();
