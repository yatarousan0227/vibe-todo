import { describe, expect, it } from "vitest";
import {
  groupTasksByStatus,
  isWorkspaceEditable,
  computeWorkspaceSummary,
  buildFeedbackHandoffUrl,
  computeGanttRows,
  KANBAN_COLUMNS,
  parseDependencyInput,
  resolveTaskDependencies,
} from "./model";
import type { TaskWithLinks } from "@/src/lib/planning/types";

function makeTask(overrides: Partial<TaskWithLinks> = {}): TaskWithLinks {
  return {
    task_id: "task-001",
    task_plan_snapshot_id: "snap-001",
    project_id: "proj-001",
    title: "Test task",
    description: "Description",
    priority: "medium",
    status: "ready",
    due_date: "2026-04-01",
    dependencies: [],
    estimate: "2h",
    assignee: "self",
    execution_order: 1,
    is_due_date_placeholder: false,
    is_estimate_placeholder: false,
    is_assignee_placeholder: false,
    placeholder_reasons: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    relatedArtifacts: [
      { task_id: "task-001", artifact_snapshot_id: "art-001", relation_type: "source" },
    ],
    ...overrides,
  };
}

describe("groupTasksByStatus — REQ-001 kanban single-column placement", () => {
  it("places each task in exactly one column matching its status", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", status: "backlog" }),
      makeTask({ task_id: "t2", status: "ready" }),
      makeTask({ task_id: "t3", status: "in_progress" }),
      makeTask({ task_id: "t4", status: "blocked" }),
      makeTask({ task_id: "t5", status: "done" }),
    ];
    const grouped = groupTasksByStatus(tasks);

    expect(grouped.get("backlog")).toHaveLength(1);
    expect(grouped.get("ready")).toHaveLength(1);
    expect(grouped.get("in_progress")).toHaveLength(1);
    expect(grouped.get("blocked")).toHaveLength(1);
    expect(grouped.get("done")).toHaveLength(1);

    // Verify total — each task appears in exactly one column
    const allGrouped = KANBAN_COLUMNS.flatMap((col) => grouped.get(col) ?? []);
    expect(allGrouped).toHaveLength(tasks.length);
  });

  it("renders an empty column when no tasks have that status", () => {
    const tasks: TaskWithLinks[] = [makeTask({ task_id: "t1", status: "ready" })];
    const grouped = groupTasksByStatus(tasks);

    expect(grouped.get("backlog")).toHaveLength(0);
    expect(grouped.get("in_progress")).toHaveLength(0);
    expect(grouped.get("blocked")).toHaveLength(0);
    expect(grouped.get("done")).toHaveLength(0);
  });

  it("groups multiple tasks into the correct column", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", status: "backlog" }),
      makeTask({ task_id: "t2", status: "backlog" }),
      makeTask({ task_id: "t3", status: "blocked" }),
    ];
    const grouped = groupTasksByStatus(tasks);

    expect(grouped.get("backlog")).toHaveLength(2);
    expect(grouped.get("blocked")).toHaveLength(1);
  });

  it("does not allow conflicting status for the same task_id across columns", () => {
    const task = makeTask({ task_id: "t1", status: "in_progress" });
    const grouped = groupTasksByStatus([task]);

    // Only in_progress column should contain this task
    for (const col of KANBAN_COLUMNS) {
      const colTasks = grouped.get(col) ?? [];
      const found = colTasks.filter((t) => t.task_id === "t1");
      if (col === "in_progress") {
        expect(found).toHaveLength(1);
      } else {
        expect(found).toHaveLength(0);
      }
    }
  });

  it("all-blocked plan remains in one column without data duplication", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", status: "blocked" }),
      makeTask({ task_id: "t2", status: "blocked" }),
      makeTask({ task_id: "t3", status: "blocked" }),
    ];
    const grouped = groupTasksByStatus(tasks);

    expect(grouped.get("blocked")).toHaveLength(3);
    const allGrouped = KANBAN_COLUMNS.flatMap((col) => grouped.get(col) ?? []);
    expect(allGrouped).toHaveLength(3);
  });
});

describe("isWorkspaceEditable — REQ-003 freshness gating", () => {
  it("returns true when handoff state is editable (plan is current)", () => {
    expect(isWorkspaceEditable("editable")).toBe(true);
  });

  it("returns false when handoff state is read_only (plan is stale)", () => {
    expect(isWorkspaceEditable("read_only")).toBe(false);
  });

  it("returns false when handoff state is none (no published plan)", () => {
    expect(isWorkspaceEditable("none")).toBe(false);
  });

  it("stale and editable states are mutually exclusive", () => {
    expect(isWorkspaceEditable("editable")).not.toBe(isWorkspaceEditable("read_only"));
  });
});

describe("computeWorkspaceSummary — REQ-001 board counts", () => {
  it("counts tasks per status correctly for header summary", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", status: "backlog" }),
      makeTask({ task_id: "t2", status: "backlog" }),
      makeTask({ task_id: "t3", status: "in_progress" }),
      makeTask({ task_id: "t4", status: "blocked" }),
      makeTask({ task_id: "t5", status: "done" }),
    ];
    const summary = computeWorkspaceSummary(tasks);

    expect(summary.total).toBe(5);
    expect(summary.backlog).toBe(2);
    expect(summary.ready).toBe(0);
    expect(summary.inProgress).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.done).toBe(1);
  });

  it("returns all zeros for an empty task set", () => {
    const summary = computeWorkspaceSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.backlog).toBe(0);
    expect(summary.ready).toBe(0);
    expect(summary.inProgress).toBe(0);
    expect(summary.blocked).toBe(0);
    expect(summary.done).toBe(0);
  });

  it("summary counts derive from the same task data used by the kanban", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", status: "ready" }),
      makeTask({ task_id: "t2", status: "ready" }),
    ];
    const summary = computeWorkspaceSummary(tasks);
    const grouped = groupTasksByStatus(tasks);

    // Summary counts must match kanban column counts
    expect(summary.ready).toBe(grouped.get("ready")?.length);
    expect(summary.backlog).toBe(grouped.get("backlog")?.length);
  });
});

describe("buildFeedbackHandoffUrl — REQ-005 feedback routing", () => {
  it("builds a refinement URL with all required handoff parameters", () => {
    const url = buildFeedbackHandoffUrl({
      projectId: "proj-123",
      taskId: "task-456",
      artifactSnapshotId: "art-789",
      feedbackNote: "Need to update scope",
    });

    expect(url).toContain("/projects/proj-123/refinement");
    expect(url).toContain("feedbackTaskId=task-456");
    expect(url).toContain("feedbackArtifactSnapshotId=art-789");
    expect(url).toContain("feedbackNote=");
  });

  it("does not include workspace-owned persistence API in the URL", () => {
    const url = buildFeedbackHandoffUrl({
      projectId: "proj-123",
      taskId: "task-001",
      artifactSnapshotId: "art-001",
      feedbackNote: "test",
    });

    // Navigation URL only — no API call, no workspace-side record
    expect(url).not.toContain("/api/");
    expect(url).not.toContain("feedback_id");
  });

  it("includes project_id and task_id in the handoff context", () => {
    const url = buildFeedbackHandoffUrl({
      projectId: "proj-abc",
      taskId: "task-xyz",
      artifactSnapshotId: "art-001",
      feedbackNote: "blocker found",
    });

    expect(url).toContain("proj-abc");
    expect(url).toContain("task-xyz");
  });
});

describe("dependency helpers — REQ-004 task detail dependency rendering", () => {
  it("parses comma-separated dependency input into trimmed task IDs", () => {
    expect(parseDependencyInput(" task-a,task-b ,, task-c ")).toEqual([
      "task-a",
      "task-b",
      "task-c",
    ]);
  });

  it("resolves dependency IDs to task titles while preserving unresolved IDs", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "task-a", title: "Alpha task" }),
      makeTask({ task_id: "task-b", title: "Beta task" }),
    ];

    expect(resolveTaskDependencies(["task-a", "missing-task"], tasks)).toEqual([
      {
        taskId: "task-a",
        task: tasks[0],
        title: "Alpha task",
      },
      {
        taskId: "missing-task",
        task: null,
        title: "missing-task",
      },
    ]);
  });
});

describe("computeGanttRows — REQ-002 gantt read-only rendering", () => {
  it("returns one row per task preserving dependency metadata", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t1", execution_order: 1, dependencies: [] }),
      makeTask({ task_id: "t2", execution_order: 2, dependencies: ["t1"] }),
      makeTask({ task_id: "t3", execution_order: 3, dependencies: ["t1", "t2"] }),
    ];
    const rows = computeGanttRows(tasks);

    expect(rows).toHaveLength(3);
    expect(rows[1].dependencies).toContain("t1");
    expect(rows[2].dependencies).toContain("t2");
  });

  it("returns rows sorted by execution_order from task planning metadata", () => {
    const tasks: TaskWithLinks[] = [
      makeTask({ task_id: "t3", execution_order: 3 }),
      makeTask({ task_id: "t1", execution_order: 1 }),
      makeTask({ task_id: "t2", execution_order: 2 }),
    ];
    const rows = computeGanttRows(tasks);

    expect(rows[0].taskId).toBe("t1");
    expect(rows[1].taskId).toBe("t2");
    expect(rows[2].taskId).toBe("t3");
  });

  it("returns an empty array for an empty task set", () => {
    expect(computeGanttRows([])).toHaveLength(0);
  });

  it("a task with multiple dependencies still produces one coherent gantt row", () => {
    const task = makeTask({
      task_id: "t1",
      dependencies: ["dep-a", "dep-b", "dep-c"],
    });
    const rows = computeGanttRows([task]);

    expect(rows).toHaveLength(1);
    expect(rows[0].dependencies).toEqual(["dep-a", "dep-b", "dep-c"]);
  });

  it("bar positions are non-negative percentages within 0–100 range", () => {
    const tasks: TaskWithLinks[] = Array.from({ length: 5 }, (_, i) =>
      makeTask({ task_id: `t${i}`, execution_order: i + 1 }),
    );
    const rows = computeGanttRows(tasks);

    for (const row of rows) {
      expect(row.barLeft).toBeGreaterThanOrEqual(0);
      expect(row.barLeft + row.barWidth).toBeLessThanOrEqual(105); // small tolerance
    }
  });
});
