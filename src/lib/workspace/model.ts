import type { TaskStatus, TaskWithLinks } from "@/src/lib/planning/types";

export const KANBAN_COLUMNS: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "done",
];

export const KANBAN_COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function groupTasksByStatus(
  tasks: TaskWithLinks[],
): Map<TaskStatus, TaskWithLinks[]> {
  const grouped = new Map<TaskStatus, TaskWithLinks[]>();
  for (const col of KANBAN_COLUMNS) {
    grouped.set(col, []);
  }
  for (const task of tasks) {
    const col = grouped.get(task.status);
    if (col) {
      col.push(task);
    } else {
      grouped.get("backlog")!.push(task);
    }
  }
  return grouped;
}

export function isWorkspaceEditable(
  workspaceHandoffState: "editable" | "read_only" | "none",
): boolean {
  return workspaceHandoffState === "editable";
}

export function computeWorkspaceSummary(tasks: TaskWithLinks[]): {
  total: number;
  backlog: number;
  ready: number;
  inProgress: number;
  blocked: number;
  done: number;
} {
  return {
    total: tasks.length,
    backlog: tasks.filter((t) => t.status === "backlog").length,
    ready: tasks.filter((t) => t.status === "ready").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}

export function buildFeedbackHandoffUrl(params: {
  projectId: string;
  taskId: string;
  artifactSnapshotId: string;
  feedbackNote: string;
}): string {
  const query = new URLSearchParams({
    feedbackTaskId: params.taskId,
    feedbackArtifactSnapshotId: params.artifactSnapshotId,
    feedbackNote: params.feedbackNote,
  });
  return `/projects/${params.projectId}/refinement?${query.toString()}`;
}

export function parseDependencyInput(value: string): string[] {
  return value
    .split(",")
    .map((dependencyId) => dependencyId.trim())
    .filter(Boolean);
}

export interface ResolvedTaskDependency {
  taskId: string;
  task: TaskWithLinks | null;
  title: string;
}

export function resolveTaskDependencies(
  dependencyIds: string[],
  tasks: TaskWithLinks[],
): ResolvedTaskDependency[] {
  const taskMap = new Map(tasks.map((task) => [task.task_id, task]));

  return dependencyIds.map((dependencyId) => {
    const task = taskMap.get(dependencyId) ?? null;

    return {
      taskId: dependencyId,
      task,
      title: task?.title ?? dependencyId,
    };
  });
}

export interface GanttRow {
  taskId: string;
  title: string;
  status: TaskStatus;
  executionOrder: number;
  dependencies: string[];
  assignee: string | null;
  dueDate: string | null;
  estimate: string | null;
  barLeft: number;
  barWidth: number;
}

export function computeGanttRows(tasks: TaskWithLinks[]): GanttRow[] {
  if (tasks.length === 0) return [];

  const sorted = [...tasks].sort((a, b) => a.execution_order - b.execution_order);
  const total = sorted.length;

  return sorted.map((task, index) => ({
    taskId: task.task_id,
    title: task.title,
    status: task.status,
    executionOrder: task.execution_order,
    dependencies: task.dependencies,
    assignee: task.assignee,
    dueDate: task.due_date,
    estimate: task.estimate,
    barLeft: Math.round((index / total) * 80),
    barWidth: Math.round((1 / total) * 80) + 4,
  }));
}
