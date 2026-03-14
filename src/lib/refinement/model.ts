import type {
  ArtifactKey,
  ArtifactSummary,
  ArtifactDisplayStatus,
  ArtifactSnapshotRecord,
  RefinementReadinessSummary,
} from "./types";

export const CANONICAL_ARTIFACT_SEQUENCE: ArtifactKey[] = [
  "objective_and_outcome",
  "background_and_current_situation",
  "scope_and_non_scope",
  "constraints_and_conditions",
  "stakeholders_and_roles",
  "deliverables_and_milestones",
  "work_breakdown",
  "risks_assumptions_and_open_questions",
];

export function getArtifactIndex(key: ArtifactKey): number {
  return CANONICAL_ARTIFACT_SEQUENCE.indexOf(key);
}

export function getUpstreamKeys(key: ArtifactKey): ArtifactKey[] {
  const index = getArtifactIndex(key);
  return CANONICAL_ARTIFACT_SEQUENCE.slice(0, index);
}

export function getDownstreamKeys(key: ArtifactKey): ArtifactKey[] {
  const index = getArtifactIndex(key);
  return CANONICAL_ARTIFACT_SEQUENCE.slice(index + 1);
}

export function isReadyForGeneration(
  artifactKey: ArtifactKey,
  approvedKeys: Set<ArtifactKey>,
): boolean {
  const upstream = getUpstreamKeys(artifactKey);
  return upstream.every((key) => approvedKeys.has(key));
}

export function computeDisplayStatus(
  artifactKey: ArtifactKey,
  currentSnapshot: ArtifactSnapshotRecord | null,
  draftedKeys: Set<ArtifactKey>,
): ArtifactDisplayStatus {
  const readyForGeneration = isReadyForGeneration(artifactKey, draftedKeys);

  if (!currentSnapshot) {
    return readyForGeneration ? "ready" : "blocked";
  }
  if (currentSnapshot.approval_status === "approved") {
    return "approved";
  }
  if (currentSnapshot.approval_status === "stale") {
    return "stale";
  }
  if (!readyForGeneration) {
    return "blocked";
  }
  return "draft";
}

export function buildArtifactSummaries(
  currentSnapshots: Map<ArtifactKey, ArtifactSnapshotRecord | null>,
): ArtifactSummary[] {
  const draftedKeys = new Set<ArtifactKey>();
  for (const [key, snapshot] of currentSnapshots) {
    if (snapshot) {
      draftedKeys.add(key);
    }
  }

  return CANONICAL_ARTIFACT_SEQUENCE.map((key) => {
    const snapshot = currentSnapshots.get(key) ?? null;
    const displayStatus = computeDisplayStatus(key, snapshot, draftedKeys);
    const readyForGen = isReadyForGeneration(key, draftedKeys);

    return {
      artifactKey: key,
      displayStatus,
      currentSnapshotId: snapshot?.artifact_snapshot_id ?? null,
      versionNumber: snapshot?.version_number ?? null,
      isReadyForGeneration: readyForGen,
    };
  });
}

export function computeRefinementReadiness(
  summaries: ArtifactSummary[],
): RefinementReadinessSummary {
  const blockedBy = summaries
    .filter((s) => s.displayStatus !== "approved")
    .map((s) => s.artifactKey);

  return {
    isReady: blockedBy.length === 0,
    blockedBy,
  };
}

export function isValidArtifactKey(value: unknown): value is ArtifactKey {
  return (
    typeof value === "string" &&
    CANONICAL_ARTIFACT_SEQUENCE.includes(value as ArtifactKey)
  );
}

export function getNextArtifactKey(key: ArtifactKey): ArtifactKey | null {
  const index = getArtifactIndex(key);
  if (index < 0 || index >= CANONICAL_ARTIFACT_SEQUENCE.length - 1) {
    return null;
  }
  return CANONICAL_ARTIFACT_SEQUENCE[index + 1];
}
