import { describe, expect, it } from "vitest";
import {
  CANONICAL_ARTIFACT_SEQUENCE,
  buildArtifactSummaries,
  computeDisplayStatus,
  computeRefinementReadiness,
  getDownstreamKeys,
  getUpstreamKeys,
  isReadyForGeneration,
  isValidArtifactKey,
} from "./model";
import type { ArtifactKey, ArtifactSnapshotRecord } from "./types";

function makeSnapshot(
  key: ArtifactKey,
  status: "draft" | "approved" | "stale",
  version = 1,
): ArtifactSnapshotRecord {
  return {
    artifact_snapshot_id: `snap-${key}-${version}`,
    project_id: "project-001",
    artifact_key: key,
    version_number: version,
    body: "Sample body",
    change_reason: "generated",
    generation_trigger: "generate",
    approval_status: status,
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:00:00.000Z",
  };
}

describe("CANONICAL_ARTIFACT_SEQUENCE", () => {
  it("contains exactly eight required artifacts", () => {
    expect(CANONICAL_ARTIFACT_SEQUENCE).toHaveLength(8);
    expect(CANONICAL_ARTIFACT_SEQUENCE[0]).toBe("objective_and_outcome");
    expect(CANONICAL_ARTIFACT_SEQUENCE[7]).toBe(
      "risks_assumptions_and_open_questions",
    );
  });

  it("starts with objective_and_outcome and ends with risks_assumptions_and_open_questions", () => {
    expect(CANONICAL_ARTIFACT_SEQUENCE.at(0)).toBe("objective_and_outcome");
    expect(CANONICAL_ARTIFACT_SEQUENCE.at(-1)).toBe(
      "risks_assumptions_and_open_questions",
    );
  });
});

describe("getUpstreamKeys", () => {
  it("returns empty for the first artifact", () => {
    expect(getUpstreamKeys("objective_and_outcome")).toEqual([]);
  });

  it("returns all preceding artifacts for the last one", () => {
    const upstream = getUpstreamKeys("risks_assumptions_and_open_questions");
    expect(upstream).toHaveLength(7);
    expect(upstream[0]).toBe("objective_and_outcome");
  });

  it("returns only the first artifact as upstream for the second", () => {
    const upstream = getUpstreamKeys("background_and_current_situation");
    expect(upstream).toEqual(["objective_and_outcome"]);
  });
});

describe("getDownstreamKeys", () => {
  it("returns all subsequent artifacts for the first one", () => {
    const downstream = getDownstreamKeys("objective_and_outcome");
    expect(downstream).toHaveLength(7);
    expect(downstream[0]).toBe("background_and_current_situation");
  });

  it("returns empty for the last artifact", () => {
    expect(getDownstreamKeys("risks_assumptions_and_open_questions")).toEqual([]);
  });
});

describe("isReadyForGeneration", () => {
  it("is always ready for the first artifact since it has no upstream", () => {
    expect(
      isReadyForGeneration("objective_and_outcome", new Set()),
    ).toBe(true);
  });

  it("is ready for the second artifact when the first has a current draft", () => {
    expect(
      isReadyForGeneration(
        "background_and_current_situation",
        new Set<ArtifactKey>(["objective_and_outcome"]),
      ),
    ).toBe(true);
  });

  it("is not ready when upstream is missing", () => {
    expect(
      isReadyForGeneration("background_and_current_situation", new Set()),
    ).toBe(false);
  });

  it("requires all upstream artifacts to exist for later artifacts", () => {
    const draftedOnly = new Set<ArtifactKey>(["objective_and_outcome"]);
    expect(isReadyForGeneration("scope_and_non_scope", draftedOnly)).toBe(
      false,
    );
  });
});

describe("computeDisplayStatus", () => {
  it("returns ready when no snapshot exists but upstream drafts exist", () => {
    const status = computeDisplayStatus(
      "background_and_current_situation",
      null,
      new Set<ArtifactKey>(["objective_and_outcome"]),
    );
    expect(status).toBe("ready");
  });

  it("returns blocked when no snapshot exists and upstream drafts are missing", () => {
    const status = computeDisplayStatus(
      "background_and_current_situation",
      null,
      new Set(),
    );
    expect(status).toBe("blocked");
  });

  it("returns approved for an approved current snapshot", () => {
    const snap = makeSnapshot("objective_and_outcome", "approved");
    const status = computeDisplayStatus(
      "objective_and_outcome",
      snap,
      new Set(),
    );
    expect(status).toBe("approved");
  });

  it("returns stale for a stale snapshot", () => {
    const snap = makeSnapshot("background_and_current_situation", "stale");
    const approvedKeys = new Set<ArtifactKey>(["objective_and_outcome"]);
    const status = computeDisplayStatus(
      "background_and_current_situation",
      snap,
      approvedKeys,
    );
    expect(status).toBe("stale");
  });

  it("returns draft for a draft snapshot when upstream is ready", () => {
    const snap = makeSnapshot("objective_and_outcome", "draft");
    const status = computeDisplayStatus(
      "objective_and_outcome",
      snap,
      new Set(),
    );
    expect(status).toBe("draft");
  });

  it("returns blocked for a draft snapshot when upstream drafts are missing", () => {
    const snap = makeSnapshot("background_and_current_situation", "draft");
    const status = computeDisplayStatus(
      "background_and_current_situation",
      snap,
      new Set(),
    );
    expect(status).toBe("blocked");
  });
});

describe("buildArtifactSummaries", () => {
  it("returns summaries for all eight canonical artifacts in order", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, null]),
    );
    const summaries = buildArtifactSummaries(snapshots);
    expect(summaries).toHaveLength(8);
    expect(summaries[0].artifactKey).toBe("objective_and_outcome");
    expect(summaries[7].artifactKey).toBe("risks_assumptions_and_open_questions");
  });

  it("marks only the first artifact as ready-for-generation when none are drafted", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, null]),
    );
    const summaries = buildArtifactSummaries(snapshots);
    expect(summaries[0].isReadyForGeneration).toBe(true);
    expect(summaries[1].isReadyForGeneration).toBe(false);
  });

  it("shows a project with only objective drafted: second artifact unlocked, rest blocked", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, null]),
    );
    snapshots.set(
      "objective_and_outcome",
      makeSnapshot("objective_and_outcome", "draft"),
    );
    const summaries = buildArtifactSummaries(snapshots);
    expect(summaries[0].displayStatus).toBe("draft");
    expect(summaries[1].isReadyForGeneration).toBe(true);
    expect(summaries[2].isReadyForGeneration).toBe(false);
  });
});

describe("computeRefinementReadiness", () => {
  it("is not ready when no artifacts are approved", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [k, null]),
    );
    const summaries = buildArtifactSummaries(snapshots);
    const readiness = computeRefinementReadiness(summaries);
    expect(readiness.isReady).toBe(false);
    expect(readiness.blockedBy).toHaveLength(8);
  });

  it("is ready only when every required artifact is approved", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [
        k,
        makeSnapshot(k, "approved"),
      ]),
    );
    const summaries = buildArtifactSummaries(snapshots);
    const readiness = computeRefinementReadiness(summaries);
    expect(readiness.isReady).toBe(true);
    expect(readiness.blockedBy).toHaveLength(0);
  });

  it("is not ready when one artifact is stale even if others are approved", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [
        k,
        makeSnapshot(k, "approved"),
      ]),
    );
    snapshots.set(
      "deliverables_and_milestones",
      makeSnapshot("deliverables_and_milestones", "stale"),
    );
    const summaries = buildArtifactSummaries(snapshots);
    const readiness = computeRefinementReadiness(summaries);
    expect(readiness.isReady).toBe(false);
    expect(readiness.blockedBy).toContain("deliverables_and_milestones");
  });

  it("does not block task synthesis readiness for the final artifact approval", () => {
    const snapshots = new Map<ArtifactKey, ArtifactSnapshotRecord | null>(
      CANONICAL_ARTIFACT_SEQUENCE.map((k) => [
        k,
        makeSnapshot(k, "approved"),
      ]),
    );
    const summaries = buildArtifactSummaries(snapshots);
    const readiness = computeRefinementReadiness(summaries);
    expect(readiness.isReady).toBe(true);
  });
});

describe("isValidArtifactKey", () => {
  it("accepts all canonical keys", () => {
    for (const key of CANONICAL_ARTIFACT_SEQUENCE) {
      expect(isValidArtifactKey(key)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isValidArtifactKey("deliverables_and_milestones_extra")).toBe(false);
    expect(isValidArtifactKey("")).toBe(false);
    expect(isValidArtifactKey(42)).toBe(false);
  });
});
