import { describe, expect, it, vi } from "vitest";
import {
  AnthropicTaskSynthesisEngine,
  OpenAITaskSynthesisEngine,
  StubTaskSynthesisEngine,
  resolveConfiguredTaskSynthesisProvider,
} from "./engine";
import type { TaskSynthesisEngineInput } from "./types";
import type { LLMProvider } from "../llm/types";

const baseInput: TaskSynthesisEngineInput = {
  projectId: "project-001",
  projectContext: {
    planning_mode: "project",
    structured_input: {
      title: "Community Festival",
      objective: "Organize a summer outdoor market",
      background_or_current_situation: "Empty lot available for community use",
      scope_summary: "Food vendors, entertainment, activities",
      stakeholders: "Local residents, vendors, city council",
      expected_outcome_or_deliverable: "A successful community event",
      constraints_or_conditions: "Budget 10k, must end by 9pm",
    },
    free_form_input: {
      body: "The community wants to revitalize the town square.",
    },
  },
  approvedArtifacts: [
    {
      artifact_snapshot_id: "art-001",
      artifactKey: "objective_and_outcome",
      body: "Organize the event and define what success looks like.",
    },
    {
      artifact_snapshot_id: "art-002",
      artifactKey: "work_breakdown",
      body: "Vendor outreach, permits, logistics, and launch-day operations.",
    },
  ],
};

function makeProvider(text: string): LLMProvider {
  return {
    generateText: vi.fn().mockResolvedValue({ text }),
  };
}

describe("StubTaskSynthesisEngine", () => {
  it("returns deterministic fixture tasks", async () => {
    const engine = new StubTaskSynthesisEngine();

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks).toHaveLength(6);
    expect(result.tasks[0].taskKey).toBe("TASK-001");
    expect(result.tasks[3].dependencyTaskKeys).toEqual(["TASK-002", "TASK-003"]);
    expect(result.planningBasisNote).toContain("deterministic stub engine");
  });
});

describe("Provider-backed task synthesis engines", () => {
  it("passes project context and approved artifacts into the provider prompt", async () => {
    const provider = makeProvider(
      JSON.stringify({
        planningBasisNote: "Generated from approved artifacts",
        tasks: [
          {
            taskKey: "TASK-001",
            title: "Confirm event success criteria",
            description: "Turn the approved objective into measurable success signals.",
            executionSteps: [
              "Review the approved objective artifact",
              "Rewrite the outcome into measurable acceptance criteria",
            ],
            priority: "high",
            status: "ready",
            dueDate: "2026-03-20",
            estimate: "4h",
            assignee: "self",
            dependsOnTaskKeys: [],
            relatedArtifactSnapshotIds: ["art-001"],
            relationType: "source",
          },
        ],
      }),
    );
    const engine = new OpenAITaskSynthesisEngine(provider);

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe("Confirm event success criteria");
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Community Festival"),
      expect.objectContaining({ maxTokens: 3200, temperature: 0.2 }),
    );
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("art-002"),
      expect.any(Object),
    );
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Vendor outreach, permits, logistics"),
      expect.any(Object),
    );
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("0.5 to 1 person-day per task"),
      expect.any(Object),
    );
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Document-derived planning evidence"),
      expect.any(Object),
    );
    expect(result.tasks[0].description).toContain("Execution steps:");
  });

  it("splits large artifact sets into multiple provider calls", async () => {
    const provider = makeProvider(
      JSON.stringify({
        planningBasisNote: "batch output",
        tasks: [
          {
            taskKey: "TASK-001",
            title: "Batch task",
            description: "Generated from the current batch.",
            executionSteps: ["Review batch input", "Generate task"],
            priority: "high",
            status: "ready",
            dueDate: "2026-03-20",
            estimate: "4h",
            assignee: "self",
            dependsOnTaskKeys: [],
            relatedArtifactSnapshotIds: ["art-001"],
            relationType: "source",
          },
        ],
      }),
    );
    const engine = new OpenAITaskSynthesisEngine(provider);
    const largeInput: TaskSynthesisEngineInput = {
      ...baseInput,
      approvedArtifacts: Array.from({ length: 5 }, (_, index) => ({
        artifact_snapshot_id: `art-${index + 1}`,
        artifactKey: (index === 4
          ? "risks_assumptions_and_open_questions"
          : index === 3
            ? "stakeholders_and_roles"
            : index === 2
              ? "constraints_and_conditions"
              : index === 1
                ? "deliverables_and_milestones"
                : "work_breakdown") as TaskSynthesisEngineInput["approvedArtifacts"][number]["artifactKey"],
        body: `- item ${index + 1}\n- detail ${"x".repeat(1400)}`,
      })),
    };

    const result = await engine.generateTasks(largeInput);

    expect(provider.generateText).toHaveBeenCalledTimes(5);
    expect(result.tasks.length).toBe(5);
    expect(result.tasks[1].dependencyTaskKeys).toContain("TASK-001");
    expect(result.tasks[4].dependencyTaskKeys).toContain("TASK-004");
  });

  it("normalizes missing due date, estimate, and assignee into placeholders", async () => {
    const provider = makeProvider(
      JSON.stringify({
        tasks: [
          {
            taskKey: "TASK-001",
            title: "Assign permit owner",
            description: "Clarify who owns the city permit process.",
            executionSteps: [
              "Review the stakeholder artifact",
              "Map the permit task to an owner",
            ],
            priority: "high",
            status: "ready",
            dueDate: null,
            estimate: null,
            assignee: null,
            dependsOnTaskKeys: [],
            relatedArtifactSnapshotIds: [],
            relationType: "source",
          },
        ],
      }),
    );
    const engine = new AnthropicTaskSynthesisEngine(provider);

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.tasks[0].estimate).toBe("4h");
    expect(result.tasks[0].assignee).toBe("self");
    expect(result.tasks[0].isDueDatePlaceholder).toBe(true);
    expect(result.tasks[0].isEstimatePlaceholder).toBe(true);
    expect(result.tasks[0].isAssigneePlaceholder).toBe(true);
    expect(result.tasks[0].placeholderReasons.due_date).toContain("artifact-defined phase and milestone order");
    expect(result.tasks[0].relatedArtifactSnapshotIds).toEqual(["art-001"]);
  });

  it("keeps dependency task keys and embeds execution steps in the description", async () => {
    const provider = makeProvider(
      JSON.stringify({
        tasks: [
          {
            taskKey: "task 1",
            title: "Define the checklist",
            description: "Create the initial checklist.",
            executionSteps: ["List the checks", "Review the checks"],
            priority: "high",
            status: "ready",
            dueDate: "2026-03-20",
            estimate: "4h",
            assignee: "self",
            dependsOnTaskKeys: [],
            relatedArtifactSnapshotIds: ["art-001"],
            relationType: "source",
          },
          {
            taskKey: "task 2",
            title: "Validate the checklist",
            description: "Run the initial validation.",
            executionSteps: ["Apply the checklist", "Capture gaps"],
            priority: "medium",
            status: "backlog",
            dueDate: "2026-03-21",
            estimate: "4h",
            assignee: "self",
            dependsOnTaskKeys: ["task 1"],
            relatedArtifactSnapshotIds: ["art-002"],
            relationType: "source",
          },
        ],
      }),
    );
    const engine = new OpenAITaskSynthesisEngine(provider);

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks[0].taskKey).toBe("TASK-001");
    expect(result.tasks[1].taskKey).toBe("TASK-002");
    expect(result.tasks[1].dependencyTaskKeys).toEqual(["TASK-001"]);
    expect(result.tasks[1].description).toContain("1. Apply the checklist");
  });

  it("reorders tasks and due dates to match artifact-defined phase order", async () => {
    const provider: LLMProvider = {
      generateText: vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            planningBasisNote: "phase 1 output",
            tasks: [
              {
                taskKey: "phase1-task1",
                title: "メイン言語を決定する",
                description: "Python か JavaScript を選ぶ。",
                executionSteps: ["選定基準を整理する", "メイン言語を決定する"],
                priority: "high",
                status: "ready",
                dueDate: null,
                estimate: "2h",
                assignee: "self",
                dependsOnTaskKeys: [],
                relatedArtifactSnapshotIds: ["art-001"],
                relationType: "source",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            planningBasisNote: "phase 6 output",
            tasks: [
              {
                taskKey: "phase6-task1",
                title: "応募企業リストを作成する",
                description: "応募先を整理する。",
                executionSteps: ["求人条件を整理する", "応募企業を一覧化する"],
                priority: "medium",
                status: "backlog",
                dueDate: null,
                estimate: "4h",
                assignee: "self",
                dependsOnTaskKeys: [],
                relatedArtifactSnapshotIds: ["art-002"],
                relationType: "source",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            tasks: [
              {
                taskKey: "TASK-001",
                dependsOnTaskKeys: [],
                dueDate: "2026-03-18",
              },
              {
                taskKey: "TASK-002",
                dependsOnTaskKeys: ["TASK-001"],
                dueDate: "2026-06-01",
              },
            ],
          }),
        }),
    };
    const engine = new OpenAITaskSynthesisEngine(provider);
    const orderedInput: TaskSynthesisEngineInput = {
      ...baseInput,
      approvedArtifacts: [
        {
          artifact_snapshot_id: "art-001",
          artifactKey: "work_breakdown",
          body: [
            "## フェーズ1：学習基盤の構築",
            "- 内容",
            "  - メイン言語の選定",
            "",
            "## フェーズ6：転職活動",
            "- 内容",
            "  - 応募企業リストの作成",
          ].join("\n"),
        },
        {
          artifact_snapshot_id: "art-002",
          artifactKey: "deliverables_and_milestones",
          body: [
            "### Milestone 1：学習基盤の整備",
            "- メイン言語の決定",
            "### Milestone 6：転職活動の開始",
            "- 応募企業リストの確定",
          ].join("\n"),
        },
      ],
    };

    const result = await engine.generateTasks(orderedInput);

    expect(result.tasks[0].title).toContain("メイン言語");
    expect(result.tasks[1].title).toContain("応募企業");
    expect(result.tasks[1].dependencyTaskKeys).toContain("TASK-001");
    expect(result.tasks[0].dueDate).not.toBeNull();
    expect(result.tasks[1].dueDate).not.toBeNull();
    expect(result.tasks[0].dueDate! <= result.tasks[1].dueDate!).toBe(true);
    expect(provider.generateText).toHaveBeenCalledTimes(3);
  });

  it("accepts JSON wrapped in code fences", async () => {
    const provider = makeProvider(
      [
        "```json",
        JSON.stringify({
          tasks: [
            {
              taskKey: "TASK-001",
              title: "Finalize vendor shortlist",
              description: "Select the initial vendor shortlist for outreach.",
              executionSteps: ["Review candidate vendors", "Pick the shortlist"],
              priority: "medium",
              status: "backlog",
              dueDate: "2026-03-22",
              estimate: "3h",
              assignee: "operations lead",
              dependsOnTaskKeys: [],
              relatedArtifactSnapshotIds: ["art-002"],
              relationType: "source",
            },
          ],
        }),
        "```",
      ].join("\n"),
    );
    const engine = new OpenAITaskSynthesisEngine(provider);

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks[0].relatedArtifactSnapshotIds).toEqual(["art-002"]);
  });

  it("falls back to document-derived tasks when the provider returns invalid JSON", async () => {
    const provider = makeProvider("not-json");
    const engine = new OpenAITaskSynthesisEngine(provider);

    const result = await engine.generateTasks(baseInput);

    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.planningBasisNote).toContain("Fell back to document-derived task synthesis");
    expect(result.tasks[0].taskKey).toBe("TASK-001");
    expect(result.tasks[0].relatedArtifactSnapshotIds.length).toBeGreaterThan(0);
  });
});

describe("resolveConfiguredTaskSynthesisProvider", () => {
  it("returns the configured provider when LLM_PROVIDER is valid", () => {
    expect(
      resolveConfiguredTaskSynthesisProvider({ LLM_PROVIDER: "openai" }),
    ).toBe("openai");
  });

  it("returns stub when no provider is configured", () => {
    expect(resolveConfiguredTaskSynthesisProvider({})).toBe("stub");
  });

  it("throws on an invalid provider value", () => {
    expect(() =>
      resolveConfiguredTaskSynthesisProvider({ LLM_PROVIDER: "cohere" }),
    ).toThrow(/LLM_PROVIDER must be one of/);
  });
});
