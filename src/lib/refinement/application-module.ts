import {
  artifactRepository as defaultArtifactRepository,
  generationJobRepository as defaultGenerationJobRepository,
  withRefinementTransaction,
  type ArtifactRepository,
  type GenerationJobRepository,
} from "./repository";
import {
  refinementEngine as defaultRefinementEngine,
  type RefinementEngine,
} from "./engine";
import {
  CANONICAL_ARTIFACT_SEQUENCE,
  buildArtifactSummaries,
  computeRefinementReadiness,
  getDownstreamKeys,
  getUpstreamKeys,
} from "./model";
import type {
  ArtifactKey,
  ApproveOrRejectArtifactInput,
  ApproveOrRejectArtifactResult,
  GenerateArtifactDraftInput,
  GenerateArtifactDraftResult,
  RefinementWorkspaceContext,
  ArtifactApprovalReviewContext,
  StaleImpactSummary,
  ArtifactSnapshotRecord,
} from "./types";
import {
  projectRepository as defaultProjectRepository,
  refinementSessionRepository as defaultRefinementSessionRepository,
  type ProjectRepository,
  type RefinementSessionRepository,
} from "../intake/repository";

export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class SequenceGatingError extends Error {}

interface RefinementApplicationModuleDependencies {
  projectRepository: ProjectRepository;
  refinementSessionRepository: RefinementSessionRepository;
  artifactRepository: ArtifactRepository;
  generationJobRepository: GenerationJobRepository;
  refinementEngine: RefinementEngine;
  withTransaction: typeof withRefinementTransaction;
}

function computeStaleImpactSummary(
  downstreamSnapshots: Map<ArtifactKey, ArtifactSnapshotRecord | null>,
  downstreamKeys: ArtifactKey[],
  taskPlanFreshnessStatus: string | null,
): StaleImpactSummary {
  const downstreamArtifacts = downstreamKeys
    .filter((k) => {
      const snap = downstreamSnapshots.get(k);
      return snap !== null && snap !== undefined;
    })
    .map((k) => ({
      artifactKey: k,
      reason: "Upstream artifact was approved with changes",
    }));

  return {
    downstreamArtifacts,
    taskPlanAffected: taskPlanFreshnessStatus !== null,
    taskPlanFreshnessStatus,
  };
}

function computeSimpleStaleImpact(
  downstreamKeys: ArtifactKey[],
  allCurrentSnapshots: Map<ArtifactKey, ArtifactSnapshotRecord | null>,
): StaleImpactSummary {
  const affectedDownstream = downstreamKeys
    .filter((k) => {
      const snap = allCurrentSnapshots.get(k);
      return snap !== null && snap !== undefined;
    })
    .map((k) => ({
      artifactKey: k,
      reason: "Upstream artifact approved with changes will require regeneration",
    }));

  return {
    downstreamArtifacts: affectedDownstream,
    taskPlanAffected: false,
    taskPlanFreshnessStatus: null,
  };
}

export class RefinementApplicationModule {
  constructor(
    private readonly dependencies: RefinementApplicationModuleDependencies,
  ) {}

  async getProjectWorkspaceContext(
    projectId: string,
  ): Promise<RefinementWorkspaceContext> {
    const project =
      await this.dependencies.projectRepository.getById(projectId);
    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    const session =
      await this.dependencies.refinementSessionRepository.getActiveByProjectId(
        projectId,
      );

    const allCurrentRaw =
      await this.dependencies.artifactRepository.getAllCurrentSnapshots(projectId);

    const allCurrent = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, allCurrentRaw.get(k) ?? null]),
    );

    const summaries = buildArtifactSummaries(allCurrent);
    const readiness = computeRefinementReadiness(summaries);

    const activeKey: ArtifactKey =
      (session?.active_artifact_key as ArtifactKey | undefined) ??
      "objective_and_outcome";
    const activeSnap = allCurrent.get(activeKey) ?? null;

    const downstreamKeys = getDownstreamKeys(activeKey);
    const staleDependencies = computeSimpleStaleImpact(downstreamKeys, allCurrent);

    return {
      project: {
        projectId: project.project_id,
        title: project.title,
        planningMode: project.planning_mode,
        lifecycleStatus: project.lifecycle_status,
      },
      refinementSession: session
        ? {
            refinementSessionId: session.refinement_session_id,
            projectId: session.project_id,
            status: session.status,
            activeArtifactKey: session.active_artifact_key as ArtifactKey,
            lastGenerationAt: session.last_generation_at,
          }
        : null,
      artifactSummaries: summaries,
      allowedActions: {
        canGenerate:
          activeSnap === null &&
          summaries.find((s) => s.artifactKey === activeKey)
            ?.isReadyForGeneration === true,
        canRegenerate:
          activeSnap !== null &&
          summaries.find((s) => s.artifactKey === activeKey)
            ?.isReadyForGeneration === true,
        canOpenApproval:
          activeSnap !== null && activeSnap.approval_status === "draft",
        canProceedToTaskSynthesis: readiness.isReady,
      },
      staleDependencies,
      readiness,
    };
  }

  async generateArtifactDraft(
    input: GenerateArtifactDraftInput,
  ): Promise<GenerateArtifactDraftResult> {
    const project = await this.dependencies.projectRepository.getById(
      input.projectId,
    );
    if (!project) {
      throw new NotFoundError(`Project not found: ${input.projectId}`);
    }

    if (!project.confirmed_intake_snapshot) {
      throw new ValidationError(
        "Project intake must be confirmed before generating artifacts.",
      );
    }

    const upstreamKeys = getUpstreamKeys(input.artifactKey);
    const currentSnapshots =
      await this.dependencies.artifactRepository.getAllCurrentSnapshots(
        input.projectId,
      );
    const upstreamSnapshots = upstreamKeys
      .map((key) => currentSnapshots.get(key) ?? null)
      .filter((snapshot): snapshot is ArtifactSnapshotRecord => snapshot !== null);

    if (upstreamKeys.length > 0 && upstreamSnapshots.length < upstreamKeys.length) {
      throw new SequenceGatingError(
        `Cannot generate ${input.artifactKey}: upstream artifacts must all have drafts first.`,
      );
    }

    const previousSnapshot =
      await this.dependencies.artifactRepository.getPreviousSnapshot(
        input.projectId,
        input.artifactKey,
      );

    const job = await this.dependencies.generationJobRepository.createJob(
      input.projectId,
      input.artifactKey,
    );

    try {
      await this.dependencies.generationJobRepository.updateJobStatus(
        job.generation_job_id,
        "running",
      );

      let body: string;
      let changeReason: string;

      if (input.generationTrigger === "user_edit" && input.userEditBody) {
        body = input.userEditBody;
        changeReason = input.changeReason ?? "User edited the artifact directly";
      } else {
        const output =
          await this.dependencies.refinementEngine.generateArtifactContent({
            artifactKey: input.artifactKey,
            projectContext: project.confirmed_intake_snapshot,
            upstreamSnapshots,
            userPrompt: input.userPrompt,
          });
        body = output.content;
        changeReason = output.changeReason;
      }

      const diffFromPrevious = previousSnapshot
        ? computeSimpleDiff(previousSnapshot.body, body)
        : null;

      const snapshot =
        await this.dependencies.artifactRepository.createSnapshot({
          projectId: input.projectId,
          artifactKey: input.artifactKey,
          body,
          changeReason,
          generationTrigger: input.generationTrigger,
          diffFromPrevious,
        });

      const completedJob =
        await this.dependencies.generationJobRepository.updateJobStatus(
          job.generation_job_id,
          "completed",
          { snapshotId: snapshot.artifact_snapshot_id },
        );

      return { job: completedJob, snapshot };
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("rate_limit") ||
          error.message.includes("503") ||
          error.message.includes("502"));

      const failedJob =
        await this.dependencies.generationJobRepository.updateJobStatus(
          job.generation_job_id,
          isRetryable ? "retryable" : "failed",
          {
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        );

      return { job: failedJob, snapshot: null };
    }
  }

  async approveOrRejectArtifact(
    input: ApproveOrRejectArtifactInput,
  ): Promise<ApproveOrRejectArtifactResult> {
    if (!input.decisionReason.trim()) {
      throw new ValidationError("A decision reason is required.");
    }

    const snapshot = await this.dependencies.artifactRepository.getSnapshotById(
      input.artifactSnapshotId,
    );
    if (
      !snapshot ||
      snapshot.project_id !== input.projectId ||
      snapshot.artifact_key !== input.artifactKey
    ) {
      throw new NotFoundError(
        `Snapshot not found for the given project and artifact key.`,
      );
    }

    const audit = await this.dependencies.artifactRepository.createApprovalAudit({
      projectId: input.projectId,
      artifactKey: input.artifactKey,
      artifactSnapshotId: input.artifactSnapshotId,
      decision: input.decision,
      decisionReason: input.decisionReason,
    });

    let updatedSnapshot = snapshot;

    if (input.decision === "approve") {
      updatedSnapshot =
        await this.dependencies.artifactRepository.approveSnapshot(
          input.artifactSnapshotId,
        );

      const downstreamKeys = getDownstreamKeys(input.artifactKey);
      await this.dependencies.artifactRepository.markDownstreamSnapshotsStale(
        input.projectId,
        downstreamKeys,
      );
    }

    const allCurrent =
      await this.dependencies.artifactRepository.getAllCurrentSnapshots(
        input.projectId,
      );
    const allCurrentFull = new Map<ArtifactKey, import("./types").ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, allCurrent.get(k) ?? null]),
    );

    const summaries = buildArtifactSummaries(allCurrentFull);
    const readiness = computeRefinementReadiness(summaries);

    const downstreamKeys = getDownstreamKeys(input.artifactKey);
    const staleDependencies = computeStaleImpactSummary(
      allCurrentFull,
      downstreamKeys,
      null,
    );

    return { audit, snapshot: updatedSnapshot, staleDependencies, readiness };
  }

  async getArtifactApprovalReviewContext(
    projectId: string,
    artifactKey: ArtifactKey,
    artifactSnapshotId: string,
  ): Promise<ArtifactApprovalReviewContext> {
    const snapshot =
      await this.dependencies.artifactRepository.getSnapshotById(
        artifactSnapshotId,
      );
    if (
      !snapshot ||
      snapshot.project_id !== projectId ||
      snapshot.artifact_key !== artifactKey
    ) {
      throw new NotFoundError(
        `Snapshot not found for the given project and artifact key.`,
      );
    }

    const previousSnapshot =
      await this.dependencies.artifactRepository.getPreviousSnapshot(
        projectId,
        artifactKey,
      );

    const approvalHistory =
      await this.dependencies.artifactRepository.getApprovalHistory(
        projectId,
        artifactKey,
      );

    const allCurrent =
      await this.dependencies.artifactRepository.getAllCurrentSnapshots(projectId);
    const allCurrentFull = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, allCurrent.get(k) ?? null]),
    );

    const summaries = buildArtifactSummaries(allCurrentFull);
    const readiness = computeRefinementReadiness(summaries);

    const downstreamKeys = getDownstreamKeys(artifactKey);
    const staleDependencies = computeSimpleStaleImpact(downstreamKeys, allCurrentFull);

    return {
      snapshot,
      previousSnapshot,
      approvalHistory,
      staleDependencies,
      readiness,
    };
  }
}

function computeSimpleDiff(previous: string, current: string): string {
  if (previous === current) return "";
  const prevLines = previous.split("\n");
  const currLines = current.split("\n");
  const diff: string[] = [];

  for (const line of prevLines) {
    if (!currLines.includes(line)) {
      diff.push(`- ${line}`);
    }
  }
  for (const line of currLines) {
    if (!prevLines.includes(line)) {
      diff.push(`+ ${line}`);
    }
  }

  return diff.join("\n");
}

export const refinementApplicationModule = new RefinementApplicationModule({
  projectRepository: defaultProjectRepository,
  refinementSessionRepository: defaultRefinementSessionRepository,
  artifactRepository: defaultArtifactRepository,
  generationJobRepository: defaultGenerationJobRepository,
  refinementEngine: defaultRefinementEngine,
  withTransaction: withRefinementTransaction,
});
