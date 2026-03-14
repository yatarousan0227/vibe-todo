import {
  taskSynthesisJobRepository as defaultJobRepository,
  taskPlanRepository as defaultTaskPlanRepository,
  taskRepository as defaultTaskRepository,
  withPlanningTransaction,
  type TaskSynthesisJobRepository,
  type TaskPlanRepository,
  type TaskRepository,
} from "./repository";
import {
  taskSynthesisEngine as defaultEngine,
  type TaskSynthesisEngine,
} from "./engine";
import {
  computePublishBlockers,
  computeTaskPlanEligibility,
  computeTasksWithLinksMap,
  isTaskPlanStale,
  validateTaskPatch,
} from "./model";
import type {
  GenerationTrigger,
  PublishTaskPlanInput,
  PublishTaskPlanResult,
  SynthesizeTaskPlanInput,
  SynthesizeTaskPlanResult,
  TaskPlanSummary,
  TaskWithLinks,
  UpdateTaskInput,
  UpdateTaskResult,
} from "./types";
import {
  projectRepository as defaultProjectRepository,
  type ProjectRepository,
} from "../intake/repository";
import {
  artifactRepository as defaultArtifactRepository,
  type ArtifactRepository,
} from "../refinement/repository";
import type { ArtifactSummary } from "../refinement/types";
import { LLMError } from "../llm/types";

export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class EligibilityError extends Error {}
export class PublishBlockedError extends Error {}

interface PlanningApplicationModuleDependencies {
  projectRepository: ProjectRepository;
  artifactRepository: ArtifactRepository;
  jobRepository: TaskSynthesisJobRepository;
  taskPlanRepository: TaskPlanRepository;
  taskRepository: TaskRepository;
  synthesisEngine: TaskSynthesisEngine;
  withTransaction: typeof withPlanningTransaction;
}

export class PlanningApplicationModule {
  constructor(
    private readonly deps: PlanningApplicationModuleDependencies,
  ) {}

  async getTaskPlanSummary(
    projectId: string,
    artifactSummaries: ArtifactSummary[],
  ): Promise<TaskPlanSummary> {
    const eligibility = computeTaskPlanEligibility(artifactSummaries);

    const allSnapshots =
      await this.deps.taskPlanRepository.getAllSnapshotsForProject(projectId);
    const currentPublished =
      await this.deps.taskPlanRepository.getCurrentPublishedSnapshot(projectId);
    const latestJob = await this.deps.jobRepository.getLatestJobForProject(projectId);

    const latestSnapshot = allSnapshots.length > 0 ? allSnapshots[0] : null;

    let workspaceHandoffState: "editable" | "read_only" | "none" = "none";
    if (currentPublished) {
      workspaceHandoffState =
        currentPublished.freshness_status === "published" ? "editable" : "read_only";
    }

    return {
      latestSnapshot,
      currentPublishedSnapshot: currentPublished,
      allCandidateSnapshots: allSnapshots,
      eligibility,
      jobStatus: latestJob?.status ?? null,
      latestJobId: latestJob?.synthesis_job_id ?? null,
      workspaceHandoffState,
    };
  }

  async synthesizeTaskPlan(
    input: SynthesizeTaskPlanInput,
  ): Promise<SynthesizeTaskPlanResult> {
    if (input.sourceArtifactSnapshotIds.length === 0) {
      throw new EligibilityError(
        "Cannot synthesize task plan: no approved artifact snapshot IDs provided",
      );
    }

    return this.deps.withTransaction(async (repos) => {
      const job = await repos.taskSynthesisJobRepository.createJob({
        projectId: input.projectId,
        generationTrigger: input.generationTrigger,
        sourceArtifactSnapshotIds: input.sourceArtifactSnapshotIds,
      });

      try {
        await repos.taskSynthesisJobRepository.updateJobStatus(
          job.synthesis_job_id,
          "running",
        );

        const project = await this.deps.projectRepository.getById(input.projectId);
        if (!project) {
          throw new NotFoundError(`Project not found: ${input.projectId}`);
        }
        if (!project.confirmed_intake_snapshot) {
          throw new ValidationError(
            "Project intake must be confirmed before synthesizing a task plan.",
          );
        }

        const approvedArtifacts = await Promise.all(
          input.sourceArtifactSnapshotIds.map(async (artifactSnapshotId) => {
            const snapshot =
              await this.deps.artifactRepository.getSnapshotById(artifactSnapshotId);

            if (!snapshot) {
              throw new ValidationError(
                `Approved artifact snapshot not found: ${artifactSnapshotId}`,
              );
            }
            if (snapshot.project_id !== input.projectId) {
              throw new ValidationError(
                `Artifact snapshot ${artifactSnapshotId} does not belong to project ${input.projectId}`,
              );
            }
            if (snapshot.approval_status !== "approved" || !snapshot.is_current) {
              throw new ValidationError(
                `Artifact snapshot ${artifactSnapshotId} is not a current approved artifact`,
              );
            }

            return {
              artifact_snapshot_id: snapshot.artifact_snapshot_id,
              artifactKey: snapshot.artifact_key,
              body: snapshot.body,
            };
          }),
        );

        const engineOutput = await this.deps.synthesisEngine.generateTasks({
          projectId: input.projectId,
          projectContext: project.confirmed_intake_snapshot,
          approvedArtifacts,
        });

        const snapshot = await repos.taskPlanRepository.createSnapshot({
          projectId: input.projectId,
          synthesisJobId: job.synthesis_job_id,
          generatedFromArtifactSet: input.sourceArtifactSnapshotIds,
          publishBlockers: [],
        });

        const createdTasks: Array<TaskWithLinks & { generatedTaskKey: string }> = [];
        for (const generatedTask of engineOutput.tasks) {
          const createdTask = await repos.taskRepository.createTask({
            taskPlanSnapshotId: snapshot.task_plan_snapshot_id,
            projectId: input.projectId,
            title: generatedTask.title,
            description: generatedTask.description,
            priority: generatedTask.priority,
            status: generatedTask.status,
            dueDate: generatedTask.dueDate,
            dependencies: [],
            estimate: generatedTask.estimate,
            assignee: generatedTask.assignee,
            executionOrder: generatedTask.executionOrder,
            isDueDatePlaceholder: generatedTask.isDueDatePlaceholder,
            isEstimatePlaceholder: generatedTask.isEstimatePlaceholder,
            isAssigneePlaceholder: generatedTask.isAssigneePlaceholder,
            placeholderReasons: generatedTask.placeholderReasons,
          });

          const relatedArtifacts = [];
          for (const artifactId of generatedTask.relatedArtifactSnapshotIds) {
            const link = await repos.taskRepository.createArtifactLink(
              createdTask.task_id,
              artifactId,
              generatedTask.relationType,
            );
            relatedArtifacts.push(link);
          }

          createdTasks.push({
            ...createdTask,
            relatedArtifacts,
            generatedTaskKey: generatedTask.taskKey,
          });
        }

        const taskIdByGeneratedKey = new Map(
          createdTasks.map((task) => [task.generatedTaskKey, task.task_id]),
        );
        const resolvedTasks: TaskWithLinks[] = [];

        for (const [index, createdTask] of createdTasks.entries()) {
          const generatedTask = engineOutput.tasks[index];
          const dependencyIds = Array.from(
            new Set(
              generatedTask.dependencyTaskKeys
                .map((taskKey) => taskIdByGeneratedKey.get(taskKey))
                .filter((taskId): taskId is string => Boolean(taskId))
                .filter((taskId) => taskId !== createdTask.task_id),
            ),
          );

          if (dependencyIds.length === 0) {
            resolvedTasks.push({
              ...createdTask,
              dependencies: [],
              relatedArtifacts: createdTask.relatedArtifacts,
            });
            continue;
          }

          const updatedTask = await repos.taskRepository.updateTask(
            createdTask.task_id,
            { dependencies: dependencyIds },
          );
          resolvedTasks.push({
            ...updatedTask,
            relatedArtifacts: createdTask.relatedArtifacts,
          });
        }

        const blockers = computePublishBlockers(resolvedTasks);
        const updatedSnapshot = await repos.taskPlanRepository.updatePublishBlockers(
          snapshot.task_plan_snapshot_id,
          blockers,
        );

        const completedJob = await repos.taskSynthesisJobRepository.updateJobStatus(
          job.synthesis_job_id,
          "completed",
        );

        return { job: completedJob, snapshot: updatedSnapshot, tasks: resolvedTasks };
      } catch (error) {
        const isRetryable =
          (error instanceof LLMError &&
            (error.code === "RATE_LIMITED" || error.code === "NETWORK_ERROR")) ||
          (error instanceof Error &&
            (error.message.includes("timeout") ||
              error.message.includes("rate_limit") ||
              error.message.includes("503") ||
              error.message.includes("502")));

        const failedJob = await repos.taskSynthesisJobRepository.updateJobStatus(
          job.synthesis_job_id,
          isRetryable ? "retryable" : "failed",
          {
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        );

        return { job: failedJob, snapshot: null, tasks: [] };
      }
    });
  }

  async publishTaskPlan(
    input: PublishTaskPlanInput,
  ): Promise<PublishTaskPlanResult> {
    const snapshot = await this.deps.taskPlanRepository.getSnapshotById(
      input.taskPlanSnapshotId,
    );
    if (!snapshot || snapshot.project_id !== input.projectId) {
      throw new NotFoundError(
        `Task plan snapshot not found: ${input.taskPlanSnapshotId}`,
      );
    }

    if (snapshot.publish_status === "published") {
      return {
        snapshot,
        previousSnapshotId: null,
      };
    }

    const tasks = await this.deps.taskRepository.getTasksBySnapshotId(
      input.taskPlanSnapshotId,
    );
    const linksMap = await this.deps.taskRepository.getArtifactLinksForSnapshot(
      input.taskPlanSnapshotId,
    );
    const tasksWithLinks = computeTasksWithLinksMap(tasks, linksMap);
    const blockers = computePublishBlockers(tasksWithLinks);

    if (blockers.length > 0) {
      throw new PublishBlockedError(
        `Cannot publish: ${blockers.length} blocker(s) remain. First blocker: ${blockers[0].field} on task "${blockers[0].taskTitle}"`,
      );
    }

    const currentPublished =
      await this.deps.taskPlanRepository.getCurrentPublishedSnapshot(input.projectId);
    const previousId = currentPublished?.task_plan_snapshot_id ?? null;

    const published = await this.deps.taskPlanRepository.publishSnapshot(
      input.taskPlanSnapshotId,
      previousId,
    );

    return { snapshot: published, previousSnapshotId: previousId };
  }

  async updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
    const task = await this.deps.taskRepository.getTaskById(input.taskId);
    if (!task) {
      throw new NotFoundError(`Task not found: ${input.taskId}`);
    }
    if (task.project_id !== input.projectId) {
      throw new NotFoundError(`Task does not belong to this project`);
    }
    if (task.task_plan_snapshot_id !== input.taskPlanSnapshotId) {
      throw new ValidationError(
        `Task does not belong to snapshot ${input.taskPlanSnapshotId}`,
      );
    }

    const links = await this.deps.taskRepository.getArtifactLinksForTask(
      input.taskId,
    );
    const taskWithLinks: TaskWithLinks = { ...task, relatedArtifacts: links };

    const snapshotTasks = await this.deps.taskRepository.getTasksBySnapshotId(
      input.taskPlanSnapshotId,
    );
    const allTaskIds = snapshotTasks.map((t) => t.task_id);

    const validationError = validateTaskPatch(
      taskWithLinks,
      input.patch,
      allTaskIds,
    );
    if (validationError) {
      throw new ValidationError(validationError);
    }

    const updatedTask = await this.deps.taskRepository.updateTask(
      input.taskId,
      input.patch,
    );
    const updatedTaskWithLinks: TaskWithLinks = {
      ...updatedTask,
      relatedArtifacts: links,
    };

    const linksMap = await this.deps.taskRepository.getArtifactLinksForSnapshot(
      input.taskPlanSnapshotId,
    );
    const fullTasksWithLinks = computeTasksWithLinksMap(
      [...snapshotTasks.filter((t) => t.task_id !== input.taskId), updatedTask],
      new Map([...linksMap, [input.taskId, links]]),
    );

    const blockers = computePublishBlockers(fullTasksWithLinks);
    await this.deps.taskPlanRepository.updatePublishBlockers(
      input.taskPlanSnapshotId,
      blockers,
    );

    return { task: updatedTaskWithLinks, publishBlockers: blockers };
  }

  async markTaskPlanStaleIfNeeded(
    projectId: string,
    currentApprovedSnapshotIds: string[],
  ): Promise<boolean> {
    const currentPublished =
      await this.deps.taskPlanRepository.getCurrentPublishedSnapshot(projectId);

    if (!currentPublished) return false;
    if (currentPublished.freshness_status === "stale") return false;
    if (currentPublished.freshness_status !== "published") return false;

    const isStale = isTaskPlanStale(
      currentPublished.generated_from_artifact_set,
      currentApprovedSnapshotIds,
    );

    if (isStale) {
      await this.deps.taskPlanRepository.markSnapshotStale(
        currentPublished.task_plan_snapshot_id,
      );
      return true;
    }

    return false;
  }

  async getTasksForSnapshot(snapshotId: string): Promise<TaskWithLinks[]> {
    const tasks = await this.deps.taskRepository.getTasksBySnapshotId(snapshotId);
    const linksMap =
      await this.deps.taskRepository.getArtifactLinksForSnapshot(snapshotId);
    return computeTasksWithLinksMap(tasks, linksMap);
  }
}

export const planningApplicationModule = new PlanningApplicationModule({
  projectRepository: defaultProjectRepository,
  artifactRepository: defaultArtifactRepository,
  jobRepository: defaultJobRepository,
  taskPlanRepository: defaultTaskPlanRepository,
  taskRepository: defaultTaskRepository,
  synthesisEngine: defaultEngine,
  withTransaction: withPlanningTransaction,
});
