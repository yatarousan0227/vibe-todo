"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArtifactKey } from "@/src/lib/refinement/types";

interface ArtifactGenerationActionProps {
  projectId: string;
  artifactKey: ArtifactKey;
  generationTrigger: "generate" | "regenerate";
}

interface GenerationApiResponse {
  artifactGenerationResult?: {
    jobStatus: string;
    errorMessage: string | null;
    snapshot: { artifact_snapshot_id: string } | null;
  };
  error?: string;
}

export function ArtifactGenerationAction({
  projectId,
  artifactKey,
  generationTrigger,
}: ArtifactGenerationActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isInitialGeneration = generationTrigger === "generate";

  const handleClick = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/artifacts/${artifactKey}/generations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationTrigger }),
        },
      );

      const data = (await response.json()) as GenerationApiResponse;

      if (!response.ok) {
        setErrorMessage(data.error ?? "Artifact generation could not be completed.");
        return;
      }

      const result = data.artifactGenerationResult;
      if (!result?.snapshot || result.jobStatus !== "completed") {
        setErrorMessage(
          result?.errorMessage ?? "Artifact generation could not be completed.",
        );
        return;
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Artifact generation request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className={`btn ${isInitialGeneration ? "btn-primary" : "btn-secondary"}`}
        data-testid={isInitialGeneration ? "generate-btn" : "regenerate-btn"}
        onClick={handleClick}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? isInitialGeneration
            ? "Generating..."
            : "Regenerating..."
          : isInitialGeneration
            ? "Generate draft"
            : "Regenerate draft"}
      </button>
      {errorMessage && (
        <div className="alertPanel" role="alert" data-testid="generation-error-banner">
          <strong>Generation failed</strong>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
