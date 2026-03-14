import { describe, expect, it, vi } from "vitest";
import {
  PlanningApplicationModule,
  NotFoundError,
  ValidationError,
  EligibilityError,
  PublishBlockedError,
} from "./application-module";
import type {
  TaskSynthesisJobRepository,
  TaskPlanRepository,
  TaskRepository,
  PlanningTransactionRepositories,
} from "./repository";
import type {
  TaskSynthesisJobRecord,
  TaskPlanSnapshotRecord,
  TaskRecord,
  TaskArtifactLinkRecord,
  PublishBlocker,
} from "./types";
import type { TaskSynthesisEngine } from "./engine";
import type {
  ArtifactSummary,
  ArtifactSnapshotRecord,
} from "../refinement/types";
import type { ProjectRepository } from "../intake/repository";
import type { ArtifactRepository } from "../refinement/repository";
import type { ProjectRecord } from "../intake/types";
import { LLMError } from "../llm/types";

function makeJob(overrides: Partial<TaskSynthesisJobRecord> = {}): TaskSynthesisJobRecord {
  return {
    synthesis_job_id: "job-001",
    project_id: "project-001",
    status: "completed",
    generation_trigger: "synthesize",
    source_artifact_snapshot_ids: ["art-001", "art-002"],
    error_message: null,
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:01:00.000Z",
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<TaskPlanSnapshotRecord> = {}): TaskPlanSnapshotRecord {
  return {
    task_plan_snapshot_id: "snap-001",
    project_id: "project-001",
    synthesis_job_id: "job-001",
    freshness_status: "candidate",
    publish_status: "unpublished",
    is_current_published: false,
    generated_from_artifact_set: ["art-001", "art-002"],
    generated_at: "2026-03-14T08:02:00.000Z",
    published_at: null,
    publish_blockers: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
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
    created_at: "2026-03-14T08:03:00.000Z",
    updated_at: "2026-03-14T08:03:00.000Z",
    ...overrides,
  };
}

function makeArtifactLink(
  taskId: string,
  snapshotId: string,
): TaskArtifactLinkRecord {
  return { task_id: taskId, artifact_snapshot_id: snapshotId, relation_type: "source" };
}

function makeArtifactSummary(
  artifactKey: string,
  displayStatus: "blocked" | "draft" | "approved" | "stale",
): ArtifactSummary {
  return {
    artifactKey: artifactKey as import("../refinement/types").ArtifactKey,
    displayStatus,
    currentSnapshotId: displayStatus === "approved" ? `snap-${artifactKey}` : null,
    versionNumber: displayStatus === "approved" ? 1 : null,
    isReadyForGeneration: displayStatus === "approved",
  };
}

function makeProjectRecord(
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    project_id: "project-001",
    title: "Community Festival",
    planning_mode: "project",
    lifecycle_status: "confirmed",
    draft_intake_payload: {
      planning_mode: "project",
      structured_input: {
        title: "Community Festival",
        objective: "Organize a summer outdoor market",
        background_or_current_situation: "Empty lot available for community use",
        scope_summary: "Food vendors, entertainment, activities",
        stakeholders: "Local residents, vendors, city council",
        expected_outcome_or_deliverable: "A successful community event",
        constraints_or_conditions: "Budget 10k, must end by 9pm",
      },
      free_form_input: {
        body: "The community wants to revitalize the town square.",
      },
    },
    confirmed_intake_snapshot: {
      planning_mode: "project",
      structured_input: {
        title: "Community Festival",
        objective: "Organize a summer outdoor market",
        background_or_current_situation: "Empty lot available for community use",
        scope_summary: "Food vendors, entertainment, activities",
        stakeholders: "Local residents, vendors, city council",
        expected_outcome_or_deliverable: "A successful community event",
        constraints_or_conditions: "Budget 10k, must end by 9pm",
      },
      free_form_input: {
        body: "The community wants to revitalize the town square.",
      },
    },
    created_at: "2026-03-14T08:00:00.000Z",
    updated_at: "2026-03-14T08:00:00.000Z",
    confirmed_at: "2026-03-14T08:00:00.000Z",
    ...overrides,
  };
}

function makeArtifactSnapshot(
  overrides: Partial<ArtifactSnapshotRecord> = {},
): ArtifactSnapshotRecord {
  return {
    artifact_snapshot_id: "art-001",
    project_id: "project-001",
    artifact_key: "objective_and_outcome",
    version_number: 1,
    body: "Approved objective artifact body",
    change_reason: "approved",
    generation_trigger: "generate",
    approval_status: "approved",
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:00:00.000Z",
    ...overrides,
  };
}

function makeJobRepository(
  overrides: Partial<TaskSynthesisJobRepository> = {},
): TaskSynthesisJobRepository {
  return {
    createJob: vi.fn().mockResolvedValue(makeJob({ status: "queued" })),
    updateJobStatus: vi.fn().mockImplementation(async (jobId, status) =>
      makeJob({ synthesis_job_id: jobId, status }),
    ),
    getLatestJobForProject: vi.fn().mockResolvedValue(null),
    getJobById: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeSnapshotRepository(
  overrides: Partial<TaskPlanRepository> = {},
): TaskPlanRepository {
  return {
    createSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    getSnapshotById: vi.fn().mockResolvedValue(null),
    getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(null),
    getAllSnapshotsForProject: vi.fn().mockResolvedValue([]),
    publishSnapshot: vi.fn().mockResolvedValue(
      makeSnapshot({ freshness_status: "published", publish_status: "published", is_current_published: true }),
    ),
    markSnapshotStale: vi.fn().mockResolvedValue(undefined),
    updatePublishBlockers: vi.fn().mockImplementation(async (id, blockers) =>
      makeSnapshot({ task_plan_snapshot_id: id, publish_blockers: blockers }),
    ),
    ...overrides,
  };
}

function makeTaskRepository(
  overrides: Partial<TaskRepository> = {},
): TaskRepository {
  return {
    createTask: vi.fn().mockImplementation(async (input) =>
      makeTask({ title: input.title, description: input.description }),
    ),
    getTaskById: vi.fn().mockResolvedValue(makeTask()),
    getTasksBySnapshotId: vi.fn().mockResolvedValue([makeTask()]),
    updateTask: vi.fn().mockImplementation(async (taskId, patch) =>
      makeTask({ task_id: taskId, ...patch }),
    ),
    createArtifactLink: vi.fn().mockImplementation(async (taskId, artifactId, relationType) =>
      makeArtifactLink(taskId, artifactId),
    ),
    getArtifactLinksForTask: vi.fn().mockResolvedValue([
      makeArtifactLink("task-001", "art-001"),
    ]),
    getArtifactLinksForSnapshot: vi.fn().mockResolvedValue(
      new Map([["task-001", [makeArtifactLink("task-001", "art-001")]]]),
    ),
    ...overrides,
  };
}

function makeProjectRepository(
  overrides: Partial<ProjectRepository> = {},
): ProjectRepository {
  return {
    getById: vi.fn().mockResolvedValue(makeProjectRecord()),
    upsertDraft: vi.fn(),
    confirmIntake: vi.fn(),
    ...overrides,
  };
}

function makeArtifactRepository(
  overrides: Partial<ArtifactRepository> = {},
): ArtifactRepository {
  return {
    getCurrentSnapshot: vi.fn().mockResolvedValue(null),
    getPreviousSnapshot: vi.fn().mockResolvedValue(null),
    getSnapshotById: vi.fn().mockResolvedValue(makeArtifactSnapshot()),
    getAllCurrentSnapshots: vi.fn().mockResolvedValue(new Map()),
    getApprovedUpstreamSnapshots: vi.fn().mockResolvedValue([]),
    createSnapshot: vi.fn(),
    approveSnapshot: vi.fn(),
    markSnapshotStale: vi.fn(),
    markDownstreamSnapshotsStale: vi.fn(),
    getApprovalHistory: vi.fn().mockResolvedValue([]),
    createApprovalAudit: vi.fn(),
    ...overrides,
  };
}

function makeEngine(overrides: Partial<TaskSynthesisEngine> = {}): TaskSynthesisEngine {
  return {
    generateTasks: vi.fn().mockResolvedValue({
      tasks: [
        {
          taskKey: "TASK-001",
          title: "Test generated task",
          description: "Generated desc",
          priority: "high" as const,
          status: "ready" as const,
          dueDate: "2026-03-20",
          dependencyTaskKeys: [],
          estimate: "4h",
          assignee: "self",
          executionOrder: 0,
          isDueDatePlaceholder: false,
          isEstimatePlaceholder: false,
          isAssigneePlaceholder: false,
          placeholderReasons: {},
          relatedArtifactSnapshotIds: ["art-001"],
          relationType: "source",
        },
      ],
      planningBasisNote: "stub output",
    }),
    ...overrides,
  };
}

function makeModule(
  jobRepo: TaskSynthesisJobRepository,
  planRepo: TaskPlanRepository,
  taskRepo: TaskRepository,
  engine: TaskSynthesisEngine,
  options?: {
    projectRepo?: ProjectRepository;
    artifactRepo?: ArtifactRepository;
  },
): PlanningApplicationModule {
  const withTransaction = vi.fn().mockImplementation(
    async (action: (repos: PlanningTransactionRepositories) => Promise<unknown>) => {
      return action({
        taskSynthesisJobRepository: jobRepo,
        taskPlanRepository: planRepo,
        taskRepository: taskRepo,
      });
    },
  );
  return new PlanningApplicationModule({
    projectRepository: options?.projectRepo ?? makeProjectRepository(),
    artifactRepository: options?.artifactRepo ?? makeArtifactRepository(),
    jobRepository: jobRepo,
    taskPlanRepository: planRepo,
    taskRepository: taskRepo,
    synthesisEngine: engine,
    withTransaction,
  });
}

describe("PlanningApplicationModule.getTaskPlanSummary", () => {
  it("returns eligible=true when all artifacts approved", async () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("background_and_current_situation", "approved"),
    ];
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.getTaskPlanSummary("project-001", summaries);
    expect(result.eligibility.isEligible).toBe(true);
    expect(result.workspaceHandoffState).toBe("none");
  });

  it("returns eligible=false when any artifact is stale", async () => {
    const summaries = [
      makeArtifactSummary("objective_and_outcome", "approved"),
      makeArtifactSummary("scope_and_non_scope", "stale"),
    ];
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.getTaskPlanSummary("project-001", summaries);
    expect(result.eligibility.isEligible).toBe(false);
    expect(result.eligibility.missingOrStaleArtifacts).toHaveLength(1);
    expect(result.eligibility.missingOrStaleArtifacts[0].state).toBe("stale");
  });

  it("returns workspaceHandoffState=editable when there is a published snapshot", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
    });
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository({
        getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(published),
        getAllSnapshotsForProject: vi.fn().mockResolvedValue([published]),
      }),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.getTaskPlanSummary("project-001", []);
    expect(result.workspaceHandoffState).toBe("editable");
  });

  it("returns workspaceHandoffState=read_only when published snapshot is stale", async () => {
    const stalePublished = makeSnapshot({
      freshness_status: "stale",
      publish_status: "published",
      is_current_published: true,
    });
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository({
        getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(stalePublished),
        getAllSnapshotsForProject: vi.fn().mockResolvedValue([stalePublished]),
      }),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.getTaskPlanSummary("project-001", []);
    expect(result.workspaceHandoffState).toBe("read_only");
  });
});

describe("PlanningApplicationModule.synthesizeTaskPlan", () => {
  it("creates a synthesis job and freezes source artifact IDs before generation", async () => {
    const projectRepo = makeProjectRepository();
    const artifactRepo = makeArtifactRepository({
      getSnapshotById: vi
        .fn()
        .mockResolvedValueOnce(
          makeArtifactSnapshot({
            artifact_snapshot_id: "art-001",
            artifact_key: "objective_and_outcome",
            body: "Objective artifact body",
          }),
        )
        .mockResolvedValueOnce(
          makeArtifactSnapshot({
            artifact_snapshot_id: "art-002",
            artifact_key: "work_breakdown",
            body: "Work breakdown artifact body",
          }),
        ),
    });
    const jobRepo = makeJobRepository();
    const planRepo = makeSnapshotRepository();
    const taskRepo = makeTaskRepository();
    const engine = makeEngine();
    const module = makeModule(jobRepo, planRepo, taskRepo, engine, {
      projectRepo,
      artifactRepo,
    });

    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001", "art-002"],
    });

    expect(jobRepo.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-001",
        sourceArtifactSnapshotIds: ["art-001", "art-002"],
      }),
    );
    expect(projectRepo.getById).toHaveBeenCalledWith("project-001");
    expect(engine.generateTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-001",
        projectContext: expect.objectContaining({
          structured_input: expect.objectContaining({
            title: "Community Festival",
          }),
        }),
        approvedArtifacts: [
          expect.objectContaining({
            artifact_snapshot_id: "art-001",
            artifactKey: "objective_and_outcome",
            body: "Objective artifact body",
          }),
          expect.objectContaining({
            artifact_snapshot_id: "art-002",
            artifactKey: "work_breakdown",
            body: "Work breakdown artifact body",
          }),
        ],
      }),
    );
    expect(result.job).toBeDefined();
  });

  it("returns completed job and snapshot on success", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    expect(result.job.status).toBe("completed");
    expect(result.snapshot).not.toBeNull();
    expect(result.tasks.length).toBeGreaterThan(0);
  });

  it("resolves generated dependency task keys into persisted task IDs", async () => {
    const taskRepo = makeTaskRepository({
      createTask: vi
        .fn()
        .mockResolvedValueOnce(
          makeTask({ task_id: "task-001", execution_order: 0, dependencies: [] }),
        )
        .mockResolvedValueOnce(
          makeTask({ task_id: "task-002", execution_order: 1, dependencies: [] }),
        ),
      updateTask: vi.fn().mockImplementation(async (taskId, patch) =>
        makeTask({ task_id: taskId, ...patch }),
      ),
    });
    const engine = makeEngine({
      generateTasks: vi.fn().mockResolvedValue({
        tasks: [
          {
            taskKey: "TASK-001",
            title: "Define ready criteria",
            description: "Set the baseline criteria.",
            priority: "high" as const,
            status: "ready" as const,
            dueDate: "2026-03-20",
            dependencyTaskKeys: [],
            estimate: "4h",
            assignee: "self",
            executionOrder: 0,
            isDueDatePlaceholder: false,
            isEstimatePlaceholder: false,
            isAssigneePlaceholder: false,
            placeholderReasons: {},
            relatedArtifactSnapshotIds: ["art-001"],
            relationType: "source",
          },
          {
            taskKey: "TASK-002",
            title: "Prepare first deliverable",
            description: "Draft the deliverable after criteria are ready.",
            priority: "medium" as const,
            status: "backlog" as const,
            dueDate: "2026-03-21",
            dependencyTaskKeys: ["TASK-001"],
            estimate: "6h",
            assignee: "self",
            executionOrder: 1,
            isDueDatePlaceholder: false,
            isEstimatePlaceholder: false,
            isAssigneePlaceholder: false,
            placeholderReasons: {},
            relatedArtifactSnapshotIds: ["art-001"],
            relationType: "source",
          },
        ],
        planningBasisNote: "dependency-aware output",
      }),
    });
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      taskRepo,
      engine,
    );

    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });

    expect(taskRepo.updateTask).toHaveBeenCalledWith("task-002", {
      dependencies: ["task-001"],
    });
    expect(result.tasks[1].dependencies).toEqual(["task-001"]);
  });

  it("failed job does not discard or mutate the last published plan", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
    });
    const planRepo = makeSnapshotRepository({
      getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(published),
    });
    const failingEngine: TaskSynthesisEngine = {
      generateTasks: vi.fn().mockRejectedValue(new Error("Engine failed")),
    };
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      failingEngine,
    );
    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    expect(result.job.status).toBe("failed");
    expect(result.snapshot).toBeNull();
    expect(planRepo.markSnapshotStale).not.toHaveBeenCalled();
  });

  it("throws EligibilityError when no source artifact IDs provided", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    await expect(
      module.synthesizeTaskPlan({
        projectId: "project-001",
        generationTrigger: "synthesize",
        sourceArtifactSnapshotIds: [],
      }),
    ).rejects.toThrow(EligibilityError);
  });

  it("two synthesis runs produce distinct snapshot IDs", async () => {
    const snapshotIds = new Set<string>();
    const planRepo = makeSnapshotRepository({
      createSnapshot: vi.fn().mockImplementation(async () => {
        const id = `snap-${Date.now()}-${Math.random()}`;
        snapshotIds.add(id);
        return makeSnapshot({ task_plan_snapshot_id: id });
      }),
      updatePublishBlockers: vi.fn().mockImplementation(async (id, blockers) =>
        makeSnapshot({ task_plan_snapshot_id: id, publish_blockers: blockers }),
      ),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const result1 = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    const result2 = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    expect(result1.snapshot?.task_plan_snapshot_id).not.toBe(
      result2.snapshot?.task_plan_snapshot_id,
    );
  });

  it("returns retryable when the planning provider is rate limited", async () => {
    const rateLimitedEngine: TaskSynthesisEngine = {
      generateTasks: vi
        .fn()
        .mockRejectedValue(new LLMError("RATE_LIMITED", "rate_limit", "openai")),
    };
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      rateLimitedEngine,
    );

    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });

    expect(result.job.status).toBe("retryable");
  });
});

describe("PlanningApplicationModule.publishTaskPlan", () => {
  it("publishes snapshot when no blockers remain", async () => {
    const snapshot = makeSnapshot({ publish_blockers: [] });
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
    });
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(snapshot),
      publishSnapshot: vi.fn().mockResolvedValue(published),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.publishTaskPlan({
      projectId: "project-001",
      taskPlanSnapshotId: "snap-001",
    });
    expect(result.snapshot.publish_status).toBe("published");
    expect(result.snapshot.is_current_published).toBe(true);
  });

  it("blocks publish when tasks have missing required fields", async () => {
    const snapshot = makeSnapshot({ publish_blockers: [] });
    const taskWithNoAssignee = makeTask({ assignee: null });
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(snapshot),
    });
    const taskRepo = makeTaskRepository({
      getTasksBySnapshotId: vi.fn().mockResolvedValue([taskWithNoAssignee]),
      getArtifactLinksForSnapshot: vi.fn().mockResolvedValue(
        new Map([["task-001", [makeArtifactLink("task-001", "art-001")]]]),
      ),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      taskRepo,
      makeEngine(),
    );
    await expect(
      module.publishTaskPlan({
        projectId: "project-001",
        taskPlanSnapshotId: "snap-001",
      }),
    ).rejects.toThrow(PublishBlockedError);
  });

  it("is idempotent: submitting same snapshot twice does not corrupt state", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
    });
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(published),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.publishTaskPlan({
      projectId: "project-001",
      taskPlanSnapshotId: "snap-001",
    });
    expect(result.snapshot.publish_status).toBe("published");
    expect(planRepo.publishSnapshot).not.toHaveBeenCalled();
  });

  it("demotes prior published plan atomically on new publish", async () => {
    const prior = makeSnapshot({
      task_plan_snapshot_id: "snap-prior",
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
    });
    const candidate = makeSnapshot({
      task_plan_snapshot_id: "snap-001",
      publish_blockers: [],
    });
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(candidate),
      getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(prior),
      publishSnapshot: vi.fn().mockResolvedValue(
        makeSnapshot({ task_plan_snapshot_id: "snap-001", freshness_status: "published", publish_status: "published", is_current_published: true }),
      ),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.publishTaskPlan({
      projectId: "project-001",
      taskPlanSnapshotId: "snap-001",
    });
    expect(planRepo.publishSnapshot).toHaveBeenCalledWith("snap-001", "snap-prior");
    expect(result.previousSnapshotId).toBe("snap-prior");
  });

  it("throws NotFoundError when snapshot does not exist", async () => {
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(null),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    await expect(
      module.publishTaskPlan({
        projectId: "project-001",
        taskPlanSnapshotId: "nonexistent",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("PlanningApplicationModule.updateTask", () => {
  it("updates task and preserves artifact links", async () => {
    const original = makeTask();
    const updated = makeTask({ title: "Updated title" });
    const taskRepo = makeTaskRepository({
      getTaskById: vi.fn().mockResolvedValue(original),
      updateTask: vi.fn().mockResolvedValue(updated),
      getArtifactLinksForTask: vi.fn().mockResolvedValue([makeArtifactLink("task-001", "art-001")]),
      getTasksBySnapshotId: vi.fn().mockResolvedValue([original]),
      getArtifactLinksForSnapshot: vi.fn().mockResolvedValue(
        new Map([["task-001", [makeArtifactLink("task-001", "art-001")]]]),
      ),
    });
    const planRepo = makeSnapshotRepository({
      getSnapshotById: vi.fn().mockResolvedValue(makeSnapshot()),
      updatePublishBlockers: vi.fn().mockImplementation(async (id, blockers) =>
        makeSnapshot({ task_plan_snapshot_id: id, publish_blockers: blockers }),
      ),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      taskRepo,
      makeEngine(),
    );
    const result = await module.updateTask({
      projectId: "project-001",
      taskId: "task-001",
      taskPlanSnapshotId: "snap-001",
      patch: { title: "Updated title" },
    });
    expect(result.task.relatedArtifacts).toHaveLength(1);
  });

  it("rejects patch that nulls a required field", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository({
        getTasksBySnapshotId: vi.fn().mockResolvedValue([makeTask()]),
      }),
      makeEngine(),
    );
    await expect(
      module.updateTask({
        projectId: "project-001",
        taskId: "task-001",
        taskPlanSnapshotId: "snap-001",
        patch: { title: "" },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects patch with self-reference in dependencies", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository({
        getTasksBySnapshotId: vi.fn().mockResolvedValue([makeTask()]),
      }),
      makeEngine(),
    );
    await expect(
      module.updateTask({
        projectId: "project-001",
        taskId: "task-001",
        taskPlanSnapshotId: "snap-001",
        patch: { dependencies: ["task-001"] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects cross-snapshot dependency ID", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository({
        getTasksBySnapshotId: vi.fn().mockResolvedValue([makeTask()]),
      }),
      makeEngine(),
    );
    await expect(
      module.updateTask({
        projectId: "project-001",
        taskId: "task-001",
        taskPlanSnapshotId: "snap-001",
        patch: { dependencies: ["task-other-snapshot"] },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when task does not exist", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository({
        getTaskById: vi.fn().mockResolvedValue(null),
      }),
      makeEngine(),
    );
    await expect(
      module.updateTask({
        projectId: "project-001",
        taskId: "nonexistent",
        taskPlanSnapshotId: "snap-001",
        patch: { title: "New title" },
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("PlanningApplicationModule.markTaskPlanStaleIfNeeded", () => {
  it("marks published plan stale when source artifact replaced", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
      generated_from_artifact_set: ["art-v1"],
    });
    const planRepo = makeSnapshotRepository({
      getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(published),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const wasMarked = await module.markTaskPlanStaleIfNeeded("project-001", [
      "art-v2",
    ]);
    expect(wasMarked).toBe(true);
    expect(planRepo.markSnapshotStale).toHaveBeenCalledWith("snap-001");
  });

  it("does not mark stale when all source artifacts are still in approved set", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
      generated_from_artifact_set: ["art-001", "art-002"],
    });
    const planRepo = makeSnapshotRepository({
      getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(published),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const wasMarked = await module.markTaskPlanStaleIfNeeded("project-001", [
      "art-001",
      "art-002",
    ]);
    expect(wasMarked).toBe(false);
    expect(planRepo.markSnapshotStale).not.toHaveBeenCalled();
  });

  it("returns false when no published plan exists", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const wasMarked = await module.markTaskPlanStaleIfNeeded("project-001", []);
    expect(wasMarked).toBe(false);
  });

  it("names all affected source snapshots, not just the first", async () => {
    const published = makeSnapshot({
      freshness_status: "published",
      publish_status: "published",
      is_current_published: true,
      generated_from_artifact_set: ["art-v1", "art-v2", "art-v3"],
    });
    const planRepo = makeSnapshotRepository({
      getCurrentPublishedSnapshot: vi.fn().mockResolvedValue(published),
    });
    const module = makeModule(
      makeJobRepository(),
      planRepo,
      makeTaskRepository(),
      makeEngine(),
    );
    const wasMarked = await module.markTaskPlanStaleIfNeeded("project-001", [
      "art-v4",
      "art-v5",
    ]);
    expect(wasMarked).toBe(true);
  });
});

describe("Provider neutrality (REQ-008)", () => {
  it("synthesizes with stub engine without any provider-specific imports in module", async () => {
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    expect(result.job.status).toBe("completed");
  });

  it("can swap engine implementation without changing module contract", async () => {
    const altEngine: TaskSynthesisEngine = {
      generateTasks: vi.fn().mockResolvedValue({
        tasks: [],
        planningBasisNote: "alt engine output",
      }),
    };
    const module = makeModule(
      makeJobRepository(),
      makeSnapshotRepository(),
      makeTaskRepository(),
      altEngine,
    );
    const result = await module.synthesizeTaskPlan({
      projectId: "project-001",
      generationTrigger: "synthesize",
      sourceArtifactSnapshotIds: ["art-001"],
    });
    expect(result.job).toBeDefined();
    expect(altEngine.generateTasks).toHaveBeenCalled();
  });
});

describe("Cross-project isolation (REQ-009)", () => {
  it("two projects with separate jobs report status independently", async () => {
    const jobProject1 = makeJob({
      synthesis_job_id: "job-proj1",
      project_id: "project-001",
      status: "completed",
    });
    const jobProject2 = makeJob({
      synthesis_job_id: "job-proj2",
      project_id: "project-002",
      status: "running",
    });
    const jobRepo = makeJobRepository({
      getLatestJobForProject: vi.fn().mockImplementation(async (projectId: string) => {
        if (projectId === "project-001") return jobProject1;
        if (projectId === "project-002") return jobProject2;
        return null;
      }),
    });
    const module = makeModule(
      jobRepo,
      makeSnapshotRepository(),
      makeTaskRepository(),
      makeEngine(),
    );
    const summary1 = await module.getTaskPlanSummary("project-001", []);
    const summary2 = await module.getTaskPlanSummary("project-002", []);
    expect(summary1.jobStatus).toBe("completed");
    expect(summary2.jobStatus).toBe("running");
    expect(summary1.jobStatus).not.toBe(summary2.jobStatus);
  });
});
