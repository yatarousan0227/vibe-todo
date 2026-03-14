import type {
  PublishBlocker,
  TaskPlanEligibilityResult,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TaskWithLinks,
} from "./types";
import type { ArtifactSummary } from "../refinement/types";

export const CANONICAL_TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const CANONICAL_TASK_STATUSES: TaskStatus[] = [
  "ready",
  "in_progress",
  "blocked",
  "done",
  "backlog",
];

export function isValidTaskPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === "string" &&
    CANONICAL_TASK_PRIORITIES.includes(value as TaskPriority)
  );
}

export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    CANONICAL_TASK_STATUSES.includes(value as TaskStatus)
  );
}

export function computeTaskPlanEligibility(
  artifactSummaries: ArtifactSummary[],
): TaskPlanEligibilityResult {
  const missingOrStale: Array<{
    artifactKey: ArtifactSummary["artifactKey"];
    state: "missing" | "stale";
  }> = [];

  for (const summary of artifactSummaries) {
    if (summary.displayStatus === "stale") {
      missingOrStale.push({ artifactKey: summary.artifactKey, state: "stale" });
    } else if (summary.displayStatus !== "approved") {
      missingOrStale.push({ artifactKey: summary.artifactKey, state: "missing" });
    }
  }

  return {
    isEligible: missingOrStale.length === 0,
    missingOrStaleArtifacts: missingOrStale,
  };
}

export function computePublishBlockers(
  tasks: TaskWithLinks[],
): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  for (const task of tasks) {
    if (!task.title || !task.title.trim()) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title || "(untitled)",
        field: "title",
        reason: "Title must not be empty",
      });
    }
    if (!task.description || !task.description.trim()) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "description",
        reason: "Description must not be empty",
      });
    }
    if (!task.priority) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "priority",
        reason: "Priority must not be null",
      });
    }
    if (!task.status) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "status",
        reason: "Status must not be null",
      });
    }
    if (!task.due_date || !task.due_date.trim()) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "due_date",
        reason: task.is_due_date_placeholder
          ? `Due date is a placeholder: ${task.placeholder_reasons.due_date ?? "review required"}`
          : "Due date must not be empty",
      });
    }
    if (!task.estimate || !task.estimate.trim()) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "estimate",
        reason: task.is_estimate_placeholder
          ? `Estimate is a placeholder: ${task.placeholder_reasons.estimate ?? "review required"}`
          : "Estimate must not be empty",
      });
    }
    if (!task.assignee || !task.assignee.trim()) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "assignee",
        reason: task.is_assignee_placeholder
          ? `Assignee is a placeholder: ${task.placeholder_reasons.assignee ?? "review required"}`
          : "Assignee must not be empty",
      });
    }
    if (task.relatedArtifacts.length === 0) {
      blockers.push({
        taskId: task.task_id,
        taskTitle: task.title,
        field: "related_artifacts",
        reason: "Task must have at least one related artifact link",
      });
    }
  }

  return blockers;
}

export function computeTasksWithLinksMap(
  tasks: TaskRecord[],
  linksMap: Map<string, import("../planning/types").TaskArtifactLinkRecord[]>,
): TaskWithLinks[] {
  return tasks.map((task) => ({
    ...task,
    relatedArtifacts: linksMap.get(task.task_id) ?? [],
  }));
}

export function validateTaskPatch(
  task: TaskWithLinks,
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
  allTaskIdsInSnapshot: string[],
): string | null {
  if (patch.title !== undefined && !patch.title.trim()) {
    return "Title must not be empty after trim";
  }
  if (patch.description !== undefined && !patch.description.trim()) {
    return "Description must not be empty after trim";
  }
  if (patch.priority !== undefined && !isValidTaskPriority(patch.priority)) {
    return `Priority must be one of: ${CANONICAL_TASK_PRIORITIES.join(", ")}`;
  }
  if (patch.status !== undefined && !isValidTaskStatus(patch.status)) {
    return `Status must be one of: ${CANONICAL_TASK_STATUSES.join(", ")}`;
  }
  if (patch.dependencies !== undefined) {
    for (const depId of patch.dependencies) {
      if (depId === task.task_id) {
        return "A task cannot depend on itself";
      }
      if (!allTaskIdsInSnapshot.includes(depId)) {
        return `Dependency task ${depId} does not belong to the same snapshot`;
      }
    }
  }
  return null;
}

export function isTaskPlanStale(
  generatedFromArtifactSet: string[],
  currentApprovedArtifactSnapshotIds: string[],
): boolean {
  const currentSet = new Set(currentApprovedArtifactSnapshotIds);
  for (const sourceId of generatedFromArtifactSet) {
    if (!currentSet.has(sourceId)) {
      return true;
    }
  }
  return false;
}
