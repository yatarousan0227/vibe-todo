import type { ArtifactKey } from "../refinement/types";

export type SynthesisJobStatus =
  | "queued"
  | "running"
  | "failed"
  | "retryable"
  | "completed";

export type GenerationTrigger = "synthesize" | "regenerate";

export type FreshnessStatus = "candidate" | "published" | "stale";

export type PublishStatus = "unpublished" | "published";

export type TaskPriority = "high" | "medium" | "low";

export type TaskStatus =
  | "ready"
  | "in_progress"
  | "blocked"
  | "done"
  | "backlog";

export interface TaskSynthesisJobRecord {
  synthesis_job_id: string;
  project_id: string;
  status: SynthesisJobStatus;
  generation_trigger: GenerationTrigger;
  source_artifact_snapshot_ids: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskPlanSnapshotRecord {
  task_plan_snapshot_id: string;
  project_id: string;
  synthesis_job_id: string | null;
  freshness_status: FreshnessStatus;
  publish_status: PublishStatus;
  is_current_published: boolean;
  generated_from_artifact_set: string[];
  generated_at: string;
  published_at: string | null;
  publish_blockers: PublishBlocker[];
}

export interface PublishBlocker {
  taskId: string;
  taskTitle: string;
  field: string;
  reason: string;
}

export interface TaskRecord {
  task_id: string;
  task_plan_snapshot_id: string;
  project_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  dependencies: string[];
  estimate: string | null;
  assignee: string | null;
  execution_order: number;
  is_due_date_placeholder: boolean;
  is_estimate_placeholder: boolean;
  is_assignee_placeholder: boolean;
  placeholder_reasons: Partial<Record<"due_date" | "estimate" | "assignee", string>>;
  created_at: string;
  updated_at: string;
}

export interface TaskArtifactLinkRecord {
  task_id: string;
  artifact_snapshot_id: string;
  relation_type: string;
}

export interface TaskWithLinks extends TaskRecord {
  relatedArtifacts: TaskArtifactLinkRecord[];
}

export interface TaskPlanEligibilityResult {
  isEligible: boolean;
  missingOrStaleArtifacts: Array<{
    artifactKey: ArtifactKey;
    state: "missing" | "stale";
  }>;
}

export interface TaskPlanSummary {
  latestSnapshot: TaskPlanSnapshotRecord | null;
  currentPublishedSnapshot: TaskPlanSnapshotRecord | null;
  allCandidateSnapshots: TaskPlanSnapshotRecord[];
  eligibility: TaskPlanEligibilityResult;
  jobStatus: SynthesisJobStatus | null;
  latestJobId: string | null;
  workspaceHandoffState: "editable" | "read_only" | "none";
}

export interface SynthesizeTaskPlanInput {
  projectId: string;
  generationTrigger: GenerationTrigger;
  sourceArtifactSnapshotIds: string[];
}

export interface SynthesizeTaskPlanResult {
  job: TaskSynthesisJobRecord;
  snapshot: TaskPlanSnapshotRecord | null;
  tasks: TaskWithLinks[];
}

export interface PublishTaskPlanInput {
  projectId: string;
  taskPlanSnapshotId: string;
}

export interface PublishTaskPlanResult {
  snapshot: TaskPlanSnapshotRecord;
  previousSnapshotId: string | null;
}

export interface UpdateTaskInput {
  projectId: string;
  taskId: string;
  taskPlanSnapshotId: string;
  patch: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    dependencies?: string[];
    estimate?: string | null;
    assignee?: string | null;
  };
}

export interface UpdateTaskResult {
  task: TaskWithLinks;
  publishBlockers: PublishBlocker[];
}

export interface GeneratedTask {
  taskKey: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  dependencyTaskKeys: string[];
  estimate: string | null;
  assignee: string | null;
  executionOrder: number;
  isDueDatePlaceholder: boolean;
  isEstimatePlaceholder: boolean;
  isAssigneePlaceholder: boolean;
  placeholderReasons: Partial<Record<"due_date" | "estimate" | "assignee", string>>;
  relatedArtifactSnapshotIds: string[];
  relationType: string;
}

export interface TaskSynthesisEngineInput {
  projectId: string;
  projectContext: unknown;
  approvedArtifacts: Array<{
    artifact_snapshot_id: string;
    artifactKey: ArtifactKey;
    body: string;
  }>;
}

export interface TaskSynthesisEngineOutput {
  tasks: GeneratedTask[];
  planningBasisNote: string;
}
