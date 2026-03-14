import { notFound } from "next/navigation";
import {
  NotFoundError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { isValidArtifactKey } from "@/src/lib/refinement/model";
import type { ArtifactKey } from "@/src/lib/refinement/types";
import { ArtifactApprovalAction } from "@/src/components/artifact-approval-action";

interface ApprovalPageProps {
  params: Promise<{
    projectId: string;
    artifactKey: string;
  }>;
  searchParams: Promise<{
    snapshotId?: string;
  }>;
}

const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  objective_and_outcome: "Objective and Outcome",
  background_and_current_situation: "Background and Current Situation",
  scope_and_non_scope: "Scope and Non-Scope",
  constraints_and_conditions: "Constraints and Conditions",
  stakeholders_and_roles: "Stakeholders and Roles",
  deliverables_and_milestones: "Deliverables and Milestones",
  work_breakdown: "Work Breakdown",
  risks_assumptions_and_open_questions: "Risks, Assumptions, and Open Questions",
};

export default async function ArtifactApprovalPage(props: ApprovalPageProps) {
  const { projectId, artifactKey } = await props.params;
  const searchParams = await props.searchParams;
  const snapshotId = searchParams.snapshotId;

  if (!isValidArtifactKey(artifactKey)) {
    notFound();
  }

  if (!snapshotId) {
    return (
      <main className="shell">
        <section className="hero">
          <span className="eyebrow">SCR-003 Artifact Approval</span>
          <h1>Snapshot required</h1>
          <p>A snapshotId query parameter is required to open the approval screen.</p>
          <a href={`/projects/${projectId}/refinement?artifactKey=${artifactKey}`}>
            ← Back to refinement
          </a>
        </section>
      </main>
    );
  }

  try {
    const reviewContext =
      await refinementApplicationModule.getArtifactApprovalReviewContext(
        projectId,
        artifactKey as ArtifactKey,
        snapshotId,
      );

    const { snapshot, previousSnapshot, approvalHistory, staleDependencies, readiness } =
      reviewContext;

    const artifactLabel = ARTIFACT_LABELS[artifactKey as ArtifactKey];

    return (
      <main className="shell">
        <header className="approvalHeader">
          <span className="eyebrow">SCR-003 Artifact Approval</span>
          <h1>{artifactLabel}</h1>
          <div className="statusStrip">
            <span className="statusPill">
              <strong>Project</strong> {projectId}
            </span>
            <span className="statusPill">
              <strong>Snapshot</strong> {snapshotId.slice(0, 8)}
            </span>
            <span className="statusPill">
              <strong>Version</strong> v{snapshot.version_number}
            </span>
            <span className="statusPill" data-testid="snapshot-status">
              <strong>Status</strong> {snapshot.approval_status}
            </span>
          </div>
        </header>

        <section className="approvalGrid">
          <div className="panel approvalMain">
            <section className="diffPanel" data-testid="diff-panel">
              <h2>Current vs previous</h2>
              {previousSnapshot ? (
                <div className="diffView">
                  <div className="diffPane diffPane--previous">
                    <h3>Previous (v{previousSnapshot.version_number})</h3>
                    <pre className="diffBody">{previousSnapshot.body}</pre>
                  </div>
                  <div className="diffPane diffPane--current">
                    <h3>Current (v{snapshot.version_number})</h3>
                    <pre className="diffBody">{snapshot.body}</pre>
                  </div>
                  {snapshot.diff_from_previous && (
                    <div className="diffDelta" data-testid="diff-delta">
                      <h3>Changes</h3>
                      <pre>{snapshot.diff_from_previous}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="firstVersionNote" data-testid="first-version-note">
                  <p>This is the first version of this artifact. No previous snapshot to compare.</p>
                  <pre className="draftBody" data-testid="current-draft-body">
                    {snapshot.body}
                  </pre>
                </div>
              )}
            </section>

            <section className="changeReasonPanel" data-testid="change-reason-panel">
              <h2>Change reason</h2>
              <p className="changeReasonText">{snapshot.change_reason}</p>
              <span className="triggerBadge">Trigger: {snapshot.generation_trigger}</span>
            </section>

            {snapshot.approval_status === "draft" && (
              <section className="approvalActionPanel" data-testid="approval-actions">
                <h2>Decision</h2>
                <p className="subtle">
                  An explicit decision reason is required for both approve and reject.
                </p>
                <ArtifactApprovalAction
                  projectId={projectId}
                  artifactKey={artifactKey as ArtifactKey}
                  snapshotId={snapshotId}
                />
              </section>
            )}

            {snapshot.approval_status !== "draft" && (
              <div className="alreadyDecided" data-testid="already-decided">
                <p>
                  This snapshot has already been{" "}
                  <strong>{snapshot.approval_status}</strong>.
                </p>
                <a
                  href={`/projects/${projectId}/refinement?artifactKey=${artifactKey}`}
                  className="btn btn-ghost"
                >
                  ← Back to refinement
                </a>
              </div>
            )}
          </div>

          <aside className="sidebar">
            <section className="panel approvalHistoryPanel" data-testid="approval-history">
              <h3>Approval history</h3>
              {approvalHistory.length === 0 ? (
                <p className="subtle">No prior decisions for this artifact.</p>
              ) : (
                <ul className="auditTimeline">
                  {approvalHistory.map((entry) => (
                    <li key={entry.approval_audit_id} className="auditEntry">
                      <div className="auditDecision">
                        <strong className={`decision-${entry.decision}`}>
                          {entry.decision}
                        </strong>
                        <span className="auditTime">
                          {new Date(entry.decided_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="auditReason">{entry.decision_reason}</div>
                      <div className="auditSnapshot subtle">
                        Snapshot: {entry.artifact_snapshot_id.slice(0, 8)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {staleDependencies.downstreamArtifacts.length > 0 && (
              <section
                className="panel staleImpactPanel"
                data-testid="stale-downstream-impact"
              >
                <h3>Downstream stale impact</h3>
                <ul className="impactList">
                  {staleDependencies.downstreamArtifacts.map((entry) => (
                    <li key={entry.artifactKey} className="impactEntry">
                      <strong>{ARTIFACT_LABELS[entry.artifactKey]}</strong>
                      <p>{entry.reason}</p>
                    </li>
                  ))}
                </ul>
                {staleDependencies.taskPlanAffected && (
                  <p className="taskPlanImpact">
                    Task plan freshness:{" "}
                    <strong>{staleDependencies.taskPlanFreshnessStatus}</strong>
                  </p>
                )}
              </section>
            )}

            <section className="panel readinessSummary" data-testid="readiness-summary">
              <h3>Task synthesis readiness</h3>
              {readiness.isReady ? (
                <div>
                  <p className="readiness-ready">
                    All required artifacts are approved and current.
                  </p>
                  <a
                    href={`/projects/${projectId}/task-synthesis`}
                    className="btn btn-success"
                    data-testid="proceed-task-synthesis"
                  >
                    Proceed to Task Synthesis
                  </a>
                </div>
              ) : (
                <div>
                  <p>Still blocked by {readiness.blockedBy.length} artifact(s).</p>
                  <ul>
                    {readiness.blockedBy.slice(0, 3).map((key) => (
                      <li key={key}>{ARTIFACT_LABELS[key as ArtifactKey]}</li>
                    ))}
                    {readiness.blockedBy.length > 3 && (
                      <li>…and {readiness.blockedBy.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}
