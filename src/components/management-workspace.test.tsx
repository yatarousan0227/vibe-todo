// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { ManagementWorkspace } from "./management-workspace";
import { getDictionary } from "@/src/lib/i18n";
import type { TaskWithLinks } from "@/src/lib/planning/types";

function makeTask(overrides: Partial<TaskWithLinks> = {}): TaskWithLinks {
  return {
    task_id: "task-001",
    task_plan_snapshot_id: "snap-001",
    project_id: "proj-001",
    title: "Test task",
    description: "Description",
    priority: "medium",
    status: "ready",
    due_date: "2026-04-01",
    dependencies: [],
    estimate: "2h",
    assignee: "self",
    execution_order: 1,
    is_due_date_placeholder: false,
    is_estimate_placeholder: false,
    is_assignee_placeholder: false,
    placeholder_reasons: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    relatedArtifacts: [
      { task_id: "task-001", artifact_snapshot_id: "art-001", relation_type: "source" },
    ],
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ManagementWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("syncs drawer fields when another task is selected and exposes a close button", async () => {
    const tasks = [
      makeTask({
        task_id: "task-a",
        title: "Alpha task",
        description: "Alpha description",
        dependencies: [],
      }),
      makeTask({
        task_id: "task-b",
        title: "Beta task",
        description: "Beta description",
        dependencies: ["task-a"],
        execution_order: 2,
      }),
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tasks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <ManagementWorkspace
          locale="en"
          dictionary={getDictionary("en")}
          projectId="proj-001"
          projectTitle="Workspace project"
          taskPlanSummaryData={{
            workspaceHandoffState: "editable",
            currentPublishedSnapshot: {
              taskPlanSnapshotId: "snap-001",
              freshnessStatus: "current",
              generatedAt: "2026-03-15T00:00:00Z",
              publishedAt: "2026-03-15T00:00:00Z",
              generatedFromArtifactSet: ["art-001"],
            },
            staleDependencies: null,
          }}
        />,
      );
    });

    await flush();
    await flush();

    const betaCard = container.querySelector('[data-testid="task-card-task-b"]');
    expect(betaCard).not.toBeNull();

    await act(async () => {
      betaCard?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="close-drawer-button"]')?.textContent).toContain(
      "Close detail",
    );
    expect(container.querySelector("h2")?.textContent).toContain("Beta task");
    expect(
      (container.querySelector('[data-testid="drawer-description-input"]') as HTMLTextAreaElement)
        .value,
    ).toBe("Beta description");
    expect(container.querySelector('[data-testid="dependency-list"]')?.textContent).toContain(
      "Alpha task",
    );

    const alphaCard = container.querySelector('[data-testid="task-card-task-a"]');
    expect(alphaCard).not.toBeNull();

    await act(async () => {
      alphaCard?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("h2")?.textContent).toContain("Alpha task");
    expect(
      (container.querySelector('[data-testid="drawer-description-input"]') as HTMLTextAreaElement)
        .value,
    ).toBe("Alpha description");
    expect(container.querySelector('[data-testid="dependency-list"]')).toBeNull();
  });

  it("opens dependency task detail from the dependency navigator", async () => {
    const tasks = [
      makeTask({
        task_id: "task-a",
        title: "Alpha task",
        description: "Alpha description",
        dependencies: [],
      }),
      makeTask({
        task_id: "task-b",
        title: "Beta task",
        description: "Beta description",
        dependencies: ["task-a"],
        execution_order: 2,
      }),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tasks }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await act(async () => {
      root.render(
        <ManagementWorkspace
          locale="en"
          dictionary={getDictionary("en")}
          projectId="proj-001"
          projectTitle="Workspace project"
          taskPlanSummaryData={{
            workspaceHandoffState: "editable",
            currentPublishedSnapshot: {
              taskPlanSnapshotId: "snap-001",
              freshnessStatus: "current",
              generatedAt: "2026-03-15T00:00:00Z",
              publishedAt: "2026-03-15T00:00:00Z",
              generatedFromArtifactSet: ["art-001"],
            },
            staleDependencies: null,
          }}
        />,
      );
    });

    await flush();
    await flush();

    await act(async () => {
      container
        .querySelector('[data-testid="task-card-task-b"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      container
        .querySelector('[data-testid="dependency-detail-button-task-a"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("h2")?.textContent).toContain("Alpha task");
    expect(
      (container.querySelector('[data-testid="drawer-description-input"]') as HTMLTextAreaElement)
        .value,
    ).toBe("Alpha description");
  });
});
