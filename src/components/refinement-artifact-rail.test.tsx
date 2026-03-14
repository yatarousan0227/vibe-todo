import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RefinementArtifactRail } from "./refinement-artifact-rail";
import type { ArtifactSummary } from "@/src/lib/refinement/types";

describe("RefinementArtifactRail", () => {
  it("renders links for blocked artifacts so users can navigate to them", () => {
    const summaries: ArtifactSummary[] = [
      {
        artifactKey: "objective_and_outcome",
        displayStatus: "approved",
        currentSnapshotId: "snap-1",
        versionNumber: 1,
        isReadyForGeneration: true,
      },
      {
        artifactKey: "background_and_current_situation",
        displayStatus: "blocked",
        currentSnapshotId: null,
        versionNumber: null,
        isReadyForGeneration: true,
      },
    ];

    const html = renderToStaticMarkup(
      <RefinementArtifactRail
        summaries={summaries}
        activeKey="objective_and_outcome"
        projectId="project-123"
        locale="en"
      />,
    );

    expect(html).toContain(
      '/projects/project-123/refinement?artifactKey=background_and_current_situation',
    );
    expect(html).toContain("Background and Current Situation");
  });
});
