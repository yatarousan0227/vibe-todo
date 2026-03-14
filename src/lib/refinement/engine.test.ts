import { describe, expect, it, vi } from "vitest";
import {
  StubRefinementEngine,
  OpenAIRefinementEngine,
  AnthropicRefinementEngine,
  AzureOpenAIRefinementEngine,
  resolveConfiguredRefinementProvider,
} from "./engine";
import type { RefinementEngineInput } from "./engine";
import type { ArtifactSnapshotRecord } from "./types";
import type { IntakePayload } from "../intake/types";
import type { LLMProvider } from "../llm/types";

const sampleIntakePayload: IntakePayload = {
  planning_mode: "project",
  structured_input: {
    title: "Community Festival",
    objective: "Organize a summer outdoor market",
    background_or_current_situation: "Empty lot available for community use",
    scope_summary: "Food vendors, entertainment, activities",
    stakeholders: "Local residents, vendors, city council",
    expected_outcome_or_deliverable: "",
    constraints_or_conditions: "Budget 10k, must end by 9pm",
  },
  free_form_input: {
    body: "The community wants to revitalize the town square.",
  },
};

function makeUpstreamSnapshot(key: string, body: string): ArtifactSnapshotRecord {
  return {
    artifact_snapshot_id: `snap-${key}`,
    project_id: "project-001",
    artifact_key: key as ArtifactSnapshotRecord["artifact_key"],
    version_number: 1,
    body,
    change_reason: "approved",
    generation_trigger: "generate",
    approval_status: "approved",
    is_current: true,
    diff_from_previous: null,
    created_at: "2026-03-14T08:00:00.000Z",
  };
}

function makeFakeProvider(text: string): LLMProvider {
  return {
    generateText: vi.fn().mockResolvedValue({ text }),
  };
}

const baseInput: RefinementEngineInput = {
  artifactKey: "objective_and_outcome",
  projectContext: sampleIntakePayload,
  upstreamSnapshots: [],
};

describe("StubRefinementEngine", () => {
  it("generates content for the first artifact without upstream snapshots", async () => {
    const engine = new StubRefinementEngine();
    const result = await engine.generateArtifactContent(baseInput);
    expect(result.content).toBeTruthy();
    expect(result.changeReason).toBeTruthy();
    expect(result.content).toContain("Objective and Outcome");
  });

  it("includes the project title from the intake context", async () => {
    const engine = new StubRefinementEngine();
    const result = await engine.generateArtifactContent(baseInput);
    expect(result.content).toContain("Community Festival");
  });

  it("includes upstream snapshot context in the generated content", async () => {
    const engine = new StubRefinementEngine();
    const upstream = [
      makeUpstreamSnapshot(
        "objective_and_outcome",
        "The main goal is community revitalization.",
      ),
    ];
    const result = await engine.generateArtifactContent({
      ...baseInput,
      artifactKey: "background_and_current_situation",
      upstreamSnapshots: upstream,
    });
    expect(result.content).toContain("The main goal is community revitalization.");
  });

  it("mentions the user prompt in the output when one is supplied", async () => {
    const engine = new StubRefinementEngine();
    const result = await engine.generateArtifactContent({
      ...baseInput,
      artifactKey: "scope_and_non_scope",
      userPrompt: "Focus on vendor requirements",
    });
    expect(result.content).toContain("prompt");
  });
});

describe("Provider-backed refinement engines", () => {
  it("OpenAIRefinementEngine delegates to the configured provider", async () => {
    const provider = makeFakeProvider("## Draft\n\nGenerated body");
    const engine = new OpenAIRefinementEngine(provider);

    const result = await engine.generateArtifactContent(baseInput);

    expect(result.content).toContain("Generated body");
    expect(result.changeReason).toContain("openai");
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Artifact to produce: Objective and Outcome"),
      expect.objectContaining({ maxTokens: 1400, temperature: 0.2 }),
    );
  });

  it("prepends the canonical heading when the provider omits one", async () => {
    const provider = makeFakeProvider("Generated body without heading");
    const engine = new AnthropicRefinementEngine(provider);

    const result = await engine.generateArtifactContent({
      ...baseInput,
      artifactKey: "background_and_current_situation",
      userPrompt: "Keep it concise",
    });

    expect(result.content.startsWith("# Background and Current Situation")).toBe(true);
    expect(result.changeReason).toContain("anthropic");
    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Optional user guidance:\nKeep it concise"),
      expect.any(Object),
    );
  });

  it("includes approved upstream snapshots in the prompt", async () => {
    const provider = makeFakeProvider("# Work Breakdown\n\n- Track 1");
    const engine = new AzureOpenAIRefinementEngine(provider);

    await engine.generateArtifactContent({
      ...baseInput,
      artifactKey: "work_breakdown",
      upstreamSnapshots: [
        makeUpstreamSnapshot("objective_and_outcome", "Approved objective text"),
      ],
    });

    expect(provider.generateText).toHaveBeenCalledWith(
      expect.stringContaining("Approved objective text"),
      expect.any(Object),
    );
  });

  it("throws when the provider returns empty content", async () => {
    const provider = makeFakeProvider("   ");
    const engine = new OpenAIRefinementEngine(provider);

    await expect(engine.generateArtifactContent(baseInput)).rejects.toThrow(
      /empty content/i,
    );
  });
});

describe("resolveConfiguredRefinementProvider", () => {
  it("prefers LLM_PROVIDER when present", () => {
    expect(
      resolveConfiguredRefinementProvider({ LLM_PROVIDER: "openai" }),
    ).toBe("openai");
  });

  it("falls back to legacy REFINEMENT_PROVIDER when needed", () => {
    expect(
      resolveConfiguredRefinementProvider({ REFINEMENT_PROVIDER: "anthropic" }),
    ).toBe("anthropic");
  });

  it("returns stub when no provider is configured", () => {
    expect(resolveConfiguredRefinementProvider({})).toBe("stub");
  });

  it("throws on an invalid provider value", () => {
    expect(() =>
      resolveConfiguredRefinementProvider({ LLM_PROVIDER: "cohere" }),
    ).toThrow(/LLM_PROVIDER must be one of/);
  });
});
