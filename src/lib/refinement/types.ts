export type ArtifactKey =
  | "objective_and_outcome"
  | "background_and_current_situation"
  | "scope_and_non_scope"
  | "constraints_and_conditions"
  | "stakeholders_and_roles"
  | "deliverables_and_milestones"
  | "work_breakdown"
  | "risks_assumptions_and_open_questions";

export type ApprovalStatus = "draft" | "approved" | "stale";
export type ArtifactDisplayStatus =
  | "blocked"
  | "ready"
  | "draft"
  | "approved"
  | "stale";
export type JobStatus = "queued" | "running" | "failed" | "retryable" | "completed";
export type ApprovalDecision = "approve" | "reject";
export type GenerationTrigger = "generate" | "regenerate" | "user_edit";

export interface ArtifactSnapshotRecord {
  artifact_snapshot_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  version_number: number;
  body: string;
  change_reason: string;
  generation_trigger: GenerationTrigger;
  approval_status: ApprovalStatus;
  is_current: boolean;
  diff_from_previous: string | null;
  created_at: string;
}

export interface ArtifactGenerationJobRecord {
  generation_job_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  status: JobStatus;
  artifact_snapshot_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactApprovalAuditRecord {
  approval_audit_id: string;
  project_id: string;
  artifact_key: ArtifactKey;
  artifact_snapshot_id: string;
  decision: ApprovalDecision;
  decision_reason: string;
  decided_at: string;
}

export interface ArtifactSummary {
  artifactKey: ArtifactKey;
  displayStatus: ArtifactDisplayStatus;
  currentSnapshotId: string | null;
  versionNumber: number | null;
  isReadyForGeneration: boolean;
}

export interface StaleImpactEntry {
  artifactKey: ArtifactKey;
  reason: string;
}

export interface StaleImpactSummary {
  downstreamArtifacts: StaleImpactEntry[];
  taskPlanAffected: boolean;
  taskPlanFreshnessStatus: string | null;
}

export interface RefinementReadinessSummary {
  isReady: boolean;
  blockedBy: ArtifactKey[];
}

export interface RefinementWorkspaceContext {
  project: {
    projectId: string;
    title: string;
    planningMode: string;
    lifecycleStatus: string;
  };
  refinementSession: {
    refinementSessionId: string;
    projectId: string;
    status: string;
    activeArtifactKey: ArtifactKey;
    lastGenerationAt: string | null;
  } | null;
  artifactSummaries: ArtifactSummary[];
  allowedActions: {
    canGenerate: boolean;
    canRegenerate: boolean;
    canOpenApproval: boolean;
    canProceedToTaskSynthesis: boolean;
  };
  staleDependencies: StaleImpactSummary;
  readiness: RefinementReadinessSummary;
}

export interface ArtifactApprovalReviewContext {
  snapshot: ArtifactSnapshotRecord;
  previousSnapshot: ArtifactSnapshotRecord | null;
  approvalHistory: ArtifactApprovalAuditRecord[];
  staleDependencies: StaleImpactSummary;
  readiness: RefinementReadinessSummary;
}

export interface GenerateArtifactDraftInput {
  projectId: string;
  artifactKey: ArtifactKey;
  generationTrigger: GenerationTrigger;
  userPrompt?: string;
  userEditBody?: string;
  changeReason?: string;
}

export interface GenerateArtifactDraftResult {
  job: ArtifactGenerationJobRecord;
  snapshot: ArtifactSnapshotRecord | null;
}

export interface ApproveOrRejectArtifactInput {
  projectId: string;
  artifactKey: ArtifactKey;
  artifactSnapshotId: string;
  decision: ApprovalDecision;
  decisionReason: string;
}

export interface ApproveOrRejectArtifactResult {
  audit: ArtifactApprovalAuditRecord;
  snapshot: ArtifactSnapshotRecord;
  staleDependencies: StaleImpactSummary;
  readiness: RefinementReadinessSummary;
}
