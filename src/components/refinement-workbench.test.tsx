import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RefinementWorkbench } from "./refinement-workbench";
import { getDictionary } from "@/src/lib/i18n";
import type { ArtifactApprovalReviewContext, ArtifactSummary } from "@/src/lib/refinement/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const artifactSummaries: ArtifactSummary[] = [
  {
    artifactKey: "work_breakdown",
    displayStatus: "draft",
    currentSnapshotId: "snapshot-2",
    versionNumber: 2,
    isReadyForGeneration: true,
  },
];

function renderWorkbench(reviewContext: ArtifactApprovalReviewContext) {
  return renderToStaticMarkup(
    <RefinementWorkbench
      locale="en"
      dictionary={getDictionary("en")}
      projectId="project-123"
      projectTitle="Project 123"
      planningMode="project"
      sessionId="session-123"
      activeKey="work_breakdown"
      artifactSummaries={artifactSummaries}
      reviewContext={reviewContext}
      feedbackContext={{
        taskId: null,
        artifactSnapshotId: null,
        feedbackNote: null,
      }}
    />,
  );
}

describe("RefinementWorkbench", () => {
  it("uses a single-column draft layout when there is no previous snapshot", () => {
    const html = renderWorkbench({
      snapshot: {
        artifact_snapshot_id: "snapshot-2",
        project_id: "project-123",
        artifact_key: "work_breakdown",
        version_number: 2,
        body: "Current draft",
        change_reason: "Generated",
        generation_trigger: "generate",
        approval_status: "draft",
        is_current: true,
        diff_from_previous: null,
        created_at: "2026-03-15T00:00:00.000Z",
      },
      previousSnapshot: null,
      approvalHistory: [],
      staleDependencies: {
        downstreamArtifacts: [],
        taskPlanAffected: false,
        taskPlanFreshnessStatus: null,
      },
      readiness: {
        isReady: false,
        blockedBy: [],
      },
    });

    expect(html).toContain('class="journeyDiffGrid journeyDiffGrid--single"');
  });

  it("keeps the side-by-side draft layout when a previous snapshot exists", () => {
    const html = renderWorkbench({
      snapshot: {
        artifact_snapshot_id: "snapshot-2",
        project_id: "project-123",
        artifact_key: "work_breakdown",
        version_number: 2,
        body: "Current draft",
        change_reason: "Generated",
        generation_trigger: "generate",
        approval_status: "draft",
        is_current: true,
        diff_from_previous: "Updated section",
        created_at: "2026-03-15T00:00:00.000Z",
      },
      previousSnapshot: {
        artifact_snapshot_id: "snapshot-1",
        project_id: "project-123",
        artifact_key: "work_breakdown",
        version_number: 1,
        body: "Previous draft",
        change_reason: "Generated",
        generation_trigger: "generate",
        approval_status: "draft",
        is_current: false,
        diff_from_previous: null,
        created_at: "2026-03-14T00:00:00.000Z",
      },
      approvalHistory: [],
      staleDependencies: {
        downstreamArtifacts: [],
        taskPlanAffected: false,
        taskPlanFreshnessStatus: null,
      },
      readiness: {
        isReady: false,
        blockedBy: [],
      },
    });

    expect(html).toContain('class="journeyDiffGrid"');
    expect(html).not.toContain("journeyDiffGrid--single");
  });
});
