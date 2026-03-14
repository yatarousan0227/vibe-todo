"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_LABELS,
  getArtifactLabel,
  type Dictionary,
  type Locale,
} from "@/src/lib/i18n";
import { CANONICAL_ARTIFACT_SEQUENCE } from "@/src/lib/refinement/model";
import type {
  ArtifactApprovalReviewContext,
  ArtifactKey,
  ArtifactSummary,
} from "@/src/lib/refinement/types";
import { RefinementArtifactRail } from "@/src/components/refinement-artifact-rail";

interface RefinementWorkbenchProps {
  locale: Locale;
  dictionary: Dictionary;
  projectId: string;
  projectTitle: string;
  planningMode: string;
  sessionId: string | null;
  activeKey: ArtifactKey;
  artifactSummaries: ArtifactSummary[];
  reviewContext: ArtifactApprovalReviewContext | null;
  feedbackContext: {
    taskId: string | null;
    artifactSnapshotId: string | null;
    feedbackNote: string | null;
  };
}

interface GenerationResponse {
  artifactGenerationResult?: {
    jobStatus: string;
    errorMessage: string | null;
    snapshot: { artifact_snapshot_id: string } | null;
  };
  error?: string;
}

interface ApprovalResponse {
  artifactApprovalResult?: {
    readiness: {
      isReady: boolean;
    };
  };
  error?: string;
}

export function RefinementWorkbench(props: RefinementWorkbenchProps) {
  const {
    locale,
    dictionary: dict,
    projectId,
    projectTitle,
    planningMode,
    sessionId,
    activeKey,
    artifactSummaries,
    reviewContext,
    feedbackContext,
  } = props;
  const router = useRouter();
  const [draftBody, setDraftBody] = useState(reviewContext?.snapshot.body ?? "");
  const [decisionReason, setDecisionReason] = useState<string>(
    dict.refinement.defaultDecisionReason,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const activeSummary = artifactSummaries.find((summary) => summary.artifactKey === activeKey) ?? null;
  const isDirty = reviewContext?.snapshot ? draftBody !== reviewContext.snapshot.body : draftBody.trim().length > 0;
  const nextArtifactKey = useMemo(() => {
    const currentIndex = CANONICAL_ARTIFACT_SEQUENCE.indexOf(activeKey);
    return currentIndex >= 0 && currentIndex < CANONICAL_ARTIFACT_SEQUENCE.length - 1
      ? CANONICAL_ARTIFACT_SEQUENCE[currentIndex + 1]
      : null;
  }, [activeKey]);
  const diffGridClassName = reviewContext?.previousSnapshot
    ? "journeyDiffGrid"
    : "journeyDiffGrid journeyDiffGrid--single";

  async function postGeneration(input: {
    artifactKey: ArtifactKey;
    generationTrigger: "generate" | "regenerate" | "user_edit";
    userEditBody?: string;
    changeReason?: string;
  }) {
    const response = await fetch(
      `/api/projects/${projectId}/artifacts/${input.artifactKey}/generations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const data = (await response.json()) as GenerationResponse;
    if (!response.ok) {
      throw new Error(data.error ?? dict.refinement.failedAction);
    }
    if (
      data.artifactGenerationResult?.jobStatus !== "completed" ||
      !data.artifactGenerationResult.snapshot
    ) {
      throw new Error(
        data.artifactGenerationResult?.errorMessage ?? dict.refinement.failedAction,
      );
    }
    return data.artifactGenerationResult.snapshot.artifact_snapshot_id;
  }

  async function saveEditedDraft(options?: { silent?: boolean }) {
    if (!draftBody.trim()) {
      throw new Error(dict.refinement.noDraftYet);
    }

    const snapshotId = await postGeneration({
      artifactKey: activeKey,
      generationTrigger: "user_edit",
      userEditBody: draftBody,
      changeReason:
        locale === "ja"
          ? "workbench でドラフトを手編集"
          : "Draft edited directly in the workbench",
    });

    if (!options?.silent) {
      setStatusMessage(dict.refinement.statusSavedDraft);
      router.refresh();
    }

    return snapshotId;
  }

  async function handleGenerateCurrent() {
    setIsBusy(true);
    setErrorMessage("");
    try {
      await postGeneration({
        artifactKey: activeKey,
        generationTrigger: reviewContext?.snapshot ? "regenerate" : "generate",
      });
      setStatusMessage(dict.refinement.statusGenerated);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.refinement.failedAction);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDraftAll() {
    setIsBusy(true);
    setErrorMessage("");
    try {
      for (const summary of artifactSummaries) {
        if (summary.currentSnapshotId) {
          continue;
        }
        await postGeneration({
          artifactKey: summary.artifactKey,
          generationTrigger: "generate",
        });
      }
      setStatusMessage(dict.refinement.statusDraftedAll);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.refinement.failedAction);
    } finally {
      setIsBusy(false);
    }
  }

  async function submitApproval(decision: "approve" | "reject") {
    const snapshotId = isDirty ? await saveEditedDraft({ silent: true }) : reviewContext?.snapshot?.artifact_snapshot_id;
    if (!snapshotId) {
      throw new Error(dict.refinement.noDraftYet);
    }

    const response = await fetch(
      `/api/projects/${projectId}/artifacts/${activeKey}/approvals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactSnapshotId: snapshotId,
          approvalDecision: decision,
          decisionReason: decisionReason.trim() || dict.refinement.defaultDecisionReason,
        }),
      },
    );
    const data = (await response.json()) as ApprovalResponse;
    if (!response.ok) {
      throw new Error(data.error ?? dict.refinement.failedAction);
    }
    return data.artifactApprovalResult;
  }

  async function handleApproveAndNext() {
    setIsBusy(true);
    setErrorMessage("");
    try {
      const result = await submitApproval("approve");
      setStatusMessage(dict.refinement.statusApprovedNext);
      if (result?.readiness.isReady) {
        window.location.assign(`/projects/${projectId}/task-synthesis`);
        return;
      }
      if (nextArtifactKey) {
        window.location.assign(
          `/projects/${projectId}/refinement?artifactKey=${nextArtifactKey}`,
        );
        return;
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.refinement.failedAction);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReject() {
    setIsBusy(true);
    setErrorMessage("");
    try {
      await submitApproval("reject");
      setStatusMessage(dict.refinement.statusRejected);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.refinement.failedAction);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="workbenchHeader">
        <div className="workbenchHeaderInner">
          <span className="eyebrow">{dict.refinement.screenId}</span>
          <h1>{projectTitle}</h1>
          <p className="workbenchLead">{dict.refinement.workbenchDescription}</p>
          <div className="statusStrip">
            <span className="statusPill">
              <strong>{dict.refinement.projectLabel}</strong>
              {projectId}
            </span>
            <span className="statusPill">
              <strong>{dict.refinement.modeLabel}</strong>
              {planningMode}
            </span>
            {sessionId ? (
              <span className="statusPill">
                <strong>{dict.refinement.sessionLabel}</strong>
                {sessionId.slice(0, 8)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="sequenceRail" data-testid="sequence-rail">
          <RefinementArtifactRail
            summaries={artifactSummaries}
            activeKey={activeKey}
            projectId={projectId}
            locale={locale}
          />
        </div>
      </header>

      {feedbackContext.feedbackNote ? (
        <section className="journeyBanner journeyBanner--info">
          <strong>{dict.refinement.feedbackContext}</strong>
          <div className="journeyMetaList">
            {feedbackContext.taskId ? (
              <span>{dict.refinement.feedbackTask}: {feedbackContext.taskId}</span>
            ) : null}
            {feedbackContext.artifactSnapshotId ? (
              <span>{dict.refinement.feedbackArtifact}: {feedbackContext.artifactSnapshotId.slice(0, 8)}</span>
            ) : null}
          </div>
          <p>{feedbackContext.feedbackNote}</p>
        </section>
      ) : null}

      <section className="journeyLayout">
        <div className="journeyMain">
          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <div>
                <p className="journeyKicker">
                  {STATUS_LABELS[locale][(activeSummary?.displayStatus ?? "blocked") as keyof typeof STATUS_LABELS.en]}
                </p>
                <h2>{getArtifactLabel(locale, activeKey)}</h2>
              </div>
              <div className="journeyActions">
                <button
                  type="button"
                  className="button"
                  onClick={handleGenerateCurrent}
                  disabled={isBusy}
                >
                  {isBusy
                    ? dict.common.loading
                    : reviewContext?.snapshot
                      ? dict.refinement.regenerateDraft
                      : dict.refinement.generateDraft}
                </button>
                <button
                  type="button"
                  className="buttonGhost"
                  onClick={handleDraftAll}
                  disabled={isBusy}
                >
                  {dict.refinement.draftAll}
                </button>
              </div>
            </div>

            {!reviewContext?.snapshot && !draftBody.trim() ? (
              <div className="emptyDraft" data-testid="empty-draft">
                <p>{dict.refinement.noDraftYet}</p>
                <p className="subtle">{dict.refinement.noDraftHint}</p>
              </div>
            ) : null}

            <div className={diffGridClassName}>
              {reviewContext?.previousSnapshot ? (
                <div className="journeyPanel journeyPanel--nested">
                  <div className="journeySectionHeader">
                    <h3>{dict.refinement.previousVersion}</h3>
                    <span className="versionBadge">
                      v{reviewContext.previousSnapshot.version_number}
                    </span>
                  </div>
                  <pre className="draftBody">{reviewContext.previousSnapshot.body}</pre>
                </div>
              ) : null}

              <div className="journeyPanel journeyPanel--nested journeyPanel--accent">
                <div className="journeySectionHeader">
                  <h3>{dict.refinement.draftBody}</h3>
                  {reviewContext?.snapshot ? (
                    <span className="versionBadge">
                      v{reviewContext.snapshot.version_number}
                    </span>
                  ) : null}
                </div>
                <textarea
                  className="journeyTextarea"
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  rows={18}
                />
              </div>
            </div>

            {reviewContext?.snapshot?.diff_from_previous ? (
              <div className="journeyPanel journeyPanel--nested">
                <div className="journeySectionHeader">
                  <h3>{dict.refinement.changes}</h3>
                </div>
                <pre className="draftBody">{reviewContext.snapshot.diff_from_previous}</pre>
              </div>
            ) : null}

            <div className="journeyPanel journeyPanel--nested">
              <label className="fieldWide">
                <span className="label">{dict.refinement.decisionReason}</span>
                <textarea
                  className="textarea"
                  rows={4}
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  placeholder={dict.refinement.decisionReasonPlaceholder}
                />
              </label>
            </div>

            {statusMessage ? <p className="note">{statusMessage}</p> : null}
            {errorMessage ? <p className="error">{errorMessage}</p> : null}

            <div className="actions">
              <button
                type="button"
                className="buttonGhost"
                onClick={() => void saveEditedDraft()}
                disabled={isBusy || !draftBody.trim()}
              >
                {dict.refinement.saveEditedDraft}
              </button>
              <button
                type="button"
                className="buttonWarm"
                onClick={handleApproveAndNext}
                disabled={isBusy || !draftBody.trim()}
              >
                {dict.refinement.approveAndNext}
              </button>
              <button
                type="button"
                className="buttonGhost"
                onClick={handleReject}
                disabled={isBusy || !draftBody.trim()}
              >
                {dict.refinement.rejectDraft}
              </button>
            </div>
          </section>
        </div>

        <aside className="journeySide">
          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.refinement.reviewQueue}</h3>
            </div>
            <p className="subtle">{dict.refinement.reviewQueueBody}</p>
            <div className="journeyQueue">
              {artifactSummaries.map((summary) => (
                <a
                  key={summary.artifactKey}
                  href={`/projects/${projectId}/refinement?artifactKey=${summary.artifactKey}`}
                  className={`journeyQueueItem ${summary.artifactKey === activeKey ? "journeyQueueItem--active" : ""}`}
                >
                  <strong>{getArtifactLabel(locale, summary.artifactKey)}</strong>
                  <span>
                    {STATUS_LABELS[locale][summary.displayStatus]}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.refinement.approvedContext}</h3>
            </div>
            <p className="subtle">{dict.refinement.approvedContextBody}</p>
            <ul className="journeyList">
              {artifactSummaries
                .filter((summary) => summary.displayStatus === "approved")
                .map((summary) => (
                  <li key={summary.artifactKey}>
                    {getArtifactLabel(locale, summary.artifactKey)}
                  </li>
                ))}
            </ul>
          </section>

          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.refinement.taskSynthesisReady}</h3>
            </div>
            <p className="subtle">
              {artifactSummaries.every((summary) => summary.displayStatus === "approved")
                ? dict.refinement.taskSynthesisReadyBody
                : dict.refinement.taskSynthesisLockedBody}
            </p>
            <a
              href={`/projects/${projectId}/task-synthesis`}
              className={`journeyCta ${artifactSummaries.every((summary) => summary.displayStatus === "approved") ? "" : "journeyCta--disabled"}`}
            >
              {dict.refinement.openTaskSynthesis}
            </a>
          </section>

          {reviewContext?.approvalHistory?.length ? (
            <section className="journeyPanel">
              <div className="journeySectionHeader">
                <h3>{dict.refinement.approvalHistory}</h3>
              </div>
              <ul className="journeyList">
                {reviewContext.approvalHistory.map((entry) => (
                  <li key={entry.approval_audit_id}>
                    <strong>{entry.decision}</strong> {new Date(entry.decided_at).toLocaleString(locale)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
