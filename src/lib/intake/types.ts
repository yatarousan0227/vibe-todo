export type PlanningMode = "project" | "daily_work";

export type LifecycleStatus = "draft_intake" | "confirmed";

export interface StructuredInput {
  title: string;
  objective: string;
  background_or_current_situation: string;
  scope_summary: string;
  stakeholders: string;
  expected_outcome_or_deliverable: string;
  constraints_or_conditions: string;
}

export interface FreeFormInput {
  body: string;
}

export interface IntakePayload {
  planning_mode: PlanningMode;
  structured_input: StructuredInput;
  free_form_input: FreeFormInput;
}

export interface ProjectRecord {
  project_id: string;
  title: string;
  planning_mode: PlanningMode;
  lifecycle_status: LifecycleStatus;
  draft_intake_payload: IntakePayload;
  confirmed_intake_snapshot: IntakePayload | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export interface RefinementSessionRecord {
  refinement_session_id: string;
  project_id: string;
  status: string;
  active_artifact_key: string;
  last_generation_at: string | null;
  created_at: string;
}

export interface WorkspaceProjectContext {
  project: {
    projectId: string;
    title: string;
    planningMode: PlanningMode;
    lifecycleStatus: LifecycleStatus;
    draftIntakePayload: IntakePayload;
    confirmedIntakeSnapshot: IntakePayload | null;
    confirmedAt: string | null;
  };
  refinementSession: RefinementSessionRecord | null;
}

export interface WorkspaceContext extends WorkspaceProjectContext {
  allowedActions: {
    canSaveDraft: boolean;
    canReview: boolean;
    canConfirm: boolean;
  };
}

export interface SaveProjectDraftInput {
  projectId?: string;
  payload: IntakePayload;
}

export interface InitializeProjectFromIntakeInput {
  projectId?: string;
  payload: IntakePayload;
}
