"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArtifactKey } from "@/src/lib/refinement/types";

interface ArtifactApprovalActionProps {
  projectId: string;
  artifactKey: ArtifactKey;
  snapshotId: string;
}

interface ApprovalApiResponse {
  error?: string;
}

export function ArtifactApprovalAction({
  projectId,
  artifactKey,
  snapshotId,
}: ArtifactApprovalActionProps) {
  const router = useRouter();
  const [decisionReason, setDecisionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submitDecision = async (approvalDecision: "approve" | "reject") => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/artifacts/${artifactKey}/approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactSnapshotId: snapshotId,
            approvalDecision,
            decisionReason,
          }),
        },
      );

      const data = (await response.json()) as ApprovalApiResponse;
      if (!response.ok) {
        setErrorMessage(data.error ?? "Artifact approval could not be completed.");
        return;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Artifact approval request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="formGroup">
        <label htmlFor="decisionReason">Decision reason</label>
        <textarea
          id="decisionReason"
          required
          placeholder="Explain why you are approving or rejecting this artifact..."
          rows={4}
          className="decisionReasonInput"
          data-testid="decision-reason-input"
          value={decisionReason}
          onChange={(event) => setDecisionReason(event.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="actionBar">
        <button
          type="button"
          className="btn btn-primary"
          data-testid="approve-btn"
          onClick={() => submitDecision("approve")}
          disabled={isSubmitting}
        >
          Approve snapshot
        </button>
        <button
          type="button"
          className="btn btn-danger"
          data-testid="reject-btn"
          onClick={() => submitDecision("reject")}
          disabled={isSubmitting}
        >
          Reject snapshot
        </button>
        <a
          href={`/projects/${projectId}/refinement?artifactKey=${artifactKey}`}
          className="btn btn-ghost"
        >
          ← Back to refinement
        </a>
      </div>
      {errorMessage && (
        <div className="alertPanel" role="alert" data-testid="approval-error-banner">
          <strong>Approval failed</strong>
          <p>{errorMessage}</p>
        </div>
      )}
    </>
  );
}
