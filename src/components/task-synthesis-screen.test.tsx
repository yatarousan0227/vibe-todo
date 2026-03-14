import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskSynthesisScreen } from "./task-synthesis-screen";
import { getDictionary } from "@/src/lib/i18n";

describe("TaskSynthesisScreen", () => {
  it("keeps publish enabled for a fresh candidate even when the current published snapshot is stale", () => {
    const html = renderToStaticMarkup(
      <TaskSynthesisScreen
        locale="en"
        dictionary={getDictionary("en")}
        projectId="project-123"
        artifactSummaries={[
          {
            artifactKey: "objective_and_outcome",
            displayStatus: "approved",
            currentSnapshotId: "artifact-snapshot-1",
          },
        ]}
        taskPlanSummaryData={{
          eligibility: {
            isEligible: true,
            missingOrStaleArtifacts: [],
          },
          jobStatus: null,
          workspaceHandoffState: "read_only",
          latestSnapshot: {
            taskPlanSnapshotId: "candidate-snapshot-1",
            freshnessStatus: "candidate",
            publishStatus: "unpublished",
            generatedAt: "2026-03-15T00:00:00.000Z",
            publishBlockerCount: 0,
          },
          currentPublishedSnapshot: {
            taskPlanSnapshotId: "published-snapshot-1",
            freshnessStatus: "stale",
            generatedAt: "2026-03-10T00:00:00.000Z",
            publishedAt: "2026-03-11T00:00:00.000Z",
            generatedFromArtifactSet: ["artifact-snapshot-0"],
          },
          staleDependencies: {
            affectedSourceSnapshotIds: ["artifact-snapshot-1"],
          },
        }}
      />,
    );

    expect(html).toContain(">Publish and open workspace</button>");
    expect(html).not.toContain('class="buttonWarm" disabled=""');
  });
});
