import { describe, expect, it } from "vitest";
import {
  computePublishBlockers,
  computeTaskPlanEligibility,
  computeTasksWithLinksMap,
  isTaskPlanStale,
  validateTaskPatch,
  isValidTaskPriority,
  isValidTaskStatus,
  CANONICAL_TASK_PRIORITIES,
  CANONICAL_TASK_STATUSES,
} from "./model";
import type { ArtifactSummary } from "../refinement/types";
import type { TaskRecord, TaskWithLinks } from "./types";

function makeArtifactSummary(
  artifactKey: string,
  displayStatus: "blocked" | "draft" | "approved" | "stale",
): import("../refinement/types").ArtifactSummary {
  return {
    artifactKey: artifactKey as import("../refinement/types").ArtifactKey,
    displayStatus,
    currentSnapshotId: displayStatus === "approved" ? `snap-${artifactKey}` : null,
    versionNumber: displayStatus === "approved" ? 1 : null,
    isReadyForGeneration: displayStatus === "approved",
  };
}

function makeTask(
  overrides: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    task_id: "task-001",
    task_plan_snapshot_id: "snap-001",
    project_id: "project-001",
    title: "Test task",
    description: "Test description",
    priority: "high",
    status: "ready",
    due_date: "2026-03-20",
    dependencies: [],
    estimate: "4h",
    assignee: "self",
    execution_order: 0,
    is_due_date_placeholder: false,
    is_estimate_placeholder: false,
    is_assignee_placeholder: false,
    placeholder_reasons: {},
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:00:00.000Z",
    ...overrides,
  };
}

function makeTaskWithLinks(
  overrides: Partial<TaskRecord> = {},
  links: { artifact_snapshot_id: string; relation_type: string }[] = [
    { artifact_snapshot_id: "art-001", relation_type: "source" },
  ],
): TaskWithLinks {
  const task = makeTask(overrides);
  return {
    ...task,
    relatedArtifacts: links.map((l) => ({
      task_id: task.task_id,
      artifact_snapshot_id: l.artifact_snapshot_id,
      relation_type: l.relation_type,
    })),
  };
}

describe("computeTaskPlanEligibility", () => {
  it("returns eligible when all artifacts are approved", () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("background_and_current_situation", "approved"),
      makeArtifactSummary("scope_and_non_scope", "approved"),
    ];
    const result = computeTaskPlanEligibility(summaries);
    expect(result.isEligible).toBe(true);
    expect(result.missingOrStaleArtifacts).toHaveLength(0);
  });

  it("returns not eligible when any artifact is missing", () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("background_and_current_situation", "draft"),
    ];
    const result = computeTaskPlanEligibility(summaries);
    expect(result.isEligible).toBe(false);
    expect(result.missingOrStaleArtifacts).toHaveLength(1);
    expect(result.missingOrStaleArtifacts[0].artifactKey).toBe(
      "background_and_current_situation",
    );
    expect(result.missingOrStaleArtifacts[0].state).toBe("missing");
  });

  it("returns not eligible and names stale artifact with stale state", () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("scope_and_non_scope", "stale"),
    ];
    const result = computeTaskPlanEligibility(summaries);
    expect(result.isEligible).toBe(false);
    expect(result.missingOrStaleArtifacts).toHaveLength(1);
    expect(result.missingOrStaleArtifacts[0].state).toBe("stale");
  });

  it("keeps synthesis disabled when final artifact is not approved", () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("background_and_current_situation", "approved"),
      makeArtifactSummary("risks_assumptions_and_open_questions", "draft"),
    ];
    const result = computeTaskPlanEligibility(summaries);
    expect(result.isEligible).toBe(false);
  });
});

describe("computePublishBlockers", () => {
  it("returns no blockers when all tasks have required fields and at least one artifact link", () => {
    const tasks = [makeTaskWithLinks()];
    const blockers = computePublishBlockers(tasks);
    expect(blockers).toHaveLength(0);
  });

  it("blocks when title is empty", () => {
    const tasks = [makeTaskWithLinks({ title: "" })];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "title")).toBe(true);
  });

  it("blocks when description is empty", () => {
    const tasks = [makeTaskWithLinks({ description: "" })];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "description")).toBe(true);
  });

  it("blocks when due_date is null", () => {
    const tasks = [makeTaskWithLinks({ due_date: null })];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "due_date")).toBe(true);
  });

  it("blocks when estimate is null", () => {
    const tasks = [makeTaskWithLinks({ estimate: null })];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "estimate")).toBe(true);
  });

  it("blocks when assignee is null", () => {
    const tasks = [makeTaskWithLinks({ assignee: null })];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "assignee")).toBe(true);
  });

  it("blocks when task has no related artifact links", () => {
    const tasks = [makeTaskWithLinks({}, [])];
    const blockers = computePublishBlockers(tasks);
    expect(blockers.some((b) => b.field === "related_artifacts")).toBe(true);
  });

  it("includes placeholder reason when due_date is placeholder", () => {
    const tasks = [
      makeTaskWithLinks({
        due_date: null,
        is_due_date_placeholder: true,
        placeholder_reasons: { due_date: "No deadline specified" },
      }),
    ];
    const blockers = computePublishBlockers(tasks);
    const dueDateBlocker = blockers.find((b) => b.field === "due_date");
    expect(dueDateBlocker?.reason).toContain("No deadline specified");
  });
});

describe("validateTaskPatch", () => {
  it("rejects empty title", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(task, { title: "  " }, ["task-001"]);
    expect(error).not.toBeNull();
    expect(error).toContain("Title");
  });

  it("rejects empty description", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(task, { description: "" }, ["task-001"]);
    expect(error).not.toBeNull();
    expect(error).toContain("Description");
  });

  it("rejects self-dependency", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(task, { dependencies: ["task-001"] }, [
      "task-001",
    ]);
    expect(error).not.toBeNull();
    expect(error).toContain("self");
  });

  it("rejects cross-snapshot dependency", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(task, { dependencies: ["task-999"] }, [
      "task-001",
      "task-002",
    ]);
    expect(error).not.toBeNull();
    expect(error).toContain("task-999");
  });

  it("rejects invalid priority", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(
      task,
      { priority: "critical" as import("./types").TaskPriority },
      ["task-001"],
    );
    expect(error).not.toBeNull();
  });

  it("accepts valid patch", () => {
    const task = makeTaskWithLinks();
    const error = validateTaskPatch(
      task,
      {
        title: "New title",
        priority: "medium",
        dependencies: ["task-002"],
      },
      ["task-001", "task-002"],
    );
    expect(error).toBeNull();
  });
});

describe("isTaskPlanStale", () => {
  it("returns false when all source artifacts are in current approved set", () => {
    const isStale = isTaskPlanStale(
      ["art-001", "art-002"],
      ["art-001", "art-002", "art-003"],
    );
    expect(isStale).toBe(false);
  });

  it("returns true when any source artifact is no longer in current approved set", () => {
    const isStale = isTaskPlanStale(
      ["art-001", "art-002"],
      ["art-001", "art-003"],
    );
    expect(isStale).toBe(true);
  });

  it("returns true when source artifacts were replaced by newer snapshots", () => {
    const isStale = isTaskPlanStale(
      ["art-v1"],
      ["art-v2"],
    );
    expect(isStale).toBe(true);
  });

  it("returns false with empty source set", () => {
    const isStale = isTaskPlanStale([], ["art-001"]);
    expect(isStale).toBe(false);
  });
});

describe("computeTasksWithLinksMap", () => {
  it("returns tasks with empty links when not in map", () => {
    const tasks = [makeTask()];
    const linksMap = new Map<string, import("./types").TaskArtifactLinkRecord[]>();
    const result = computeTasksWithLinksMap(tasks, linksMap);
    expect(result[0].relatedArtifacts).toHaveLength(0);
  });

  it("returns tasks with matching links from map", () => {
    const tasks = [makeTask()];
    const links = [{ task_id: "task-001", artifact_snapshot_id: "art-001", relation_type: "source" }];
    const linksMap = new Map([["task-001", links]]);
    const result = computeTasksWithLinksMap(tasks, linksMap);
    expect(result[0].relatedArtifacts).toHaveLength(1);
    expect(result[0].relatedArtifacts[0].artifact_snapshot_id).toBe("art-001");
  });
});

describe("isValidTaskPriority", () => {
  it("returns true for valid priorities", () => {
    for (const p of CANONICAL_TASK_PRIORITIES) {
      expect(isValidTaskPriority(p)).toBe(true);
    }
  });

  it("returns false for invalid values", () => {
    expect(isValidTaskPriority("critical")).toBe(false);
    expect(isValidTaskPriority(null)).toBe(false);
    expect(isValidTaskPriority(undefined)).toBe(false);
  });
});

describe("isValidTaskStatus", () => {
  it("returns true for all canonical statuses", () => {
    for (const s of CANONICAL_TASK_STATUSES) {
      expect(isValidTaskStatus(s)).toBe(true);
    }
  });

  it("returns false for invalid values", () => {
    expect(isValidTaskStatus("cancelled")).toBe(false);
    expect(isValidTaskStatus("")).toBe(false);
  });
});
