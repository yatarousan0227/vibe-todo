import type { ArtifactKey, ArtifactSnapshotRecord } from "./types";
import type { IntakePayload } from "../intake/types";
import { LLMProviderFactory } from "../llm/factory";
import type { LLMProvider } from "../llm/types";

export interface RefinementEngineInput {
  artifactKey: ArtifactKey;
  projectContext: IntakePayload;
  upstreamSnapshots: ArtifactSnapshotRecord[];
  userPrompt?: string;
}

export interface RefinementEngineOutput {
  content: string;
  changeReason: string;
}

export interface RefinementEngine {
  generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput>;
}

const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  objective_and_outcome: "Objective and Outcome",
  background_and_current_situation: "Background and Current Situation",
  scope_and_non_scope: "Scope and Non-Scope",
  constraints_and_conditions: "Constraints and Conditions",
  stakeholders_and_roles: "Stakeholders and Roles",
  deliverables_and_milestones: "Deliverables and Milestones",
  work_breakdown: "Work Breakdown",
  risks_assumptions_and_open_questions: "Risks, Assumptions, and Open Questions",
};

function buildArtifactLabel(key: ArtifactKey): string {
  return ARTIFACT_LABELS[key] ?? key.replace(/_/g, " ");
}

function buildUpstreamContext(snapshots: ArtifactSnapshotRecord[]): string {
  if (snapshots.length === 0) return "";
  return snapshots
    .map((s) => `### ${buildArtifactLabel(s.artifact_key)}\n${s.body}`)
    .join("\n\n");
}

const ARTIFACT_GUIDANCE: Record<ArtifactKey, string[]> = {
  objective_and_outcome: [
    "Clarify the business or work objective in concrete terms.",
    "State the intended outcome, success signals, and what good looks like.",
    "Keep the scope high-level; do not drift into task breakdowns yet.",
  ],
  background_and_current_situation: [
    "Summarize the current state, recent context, and why this work matters now.",
    "Call out existing pain points, constraints, or relevant history.",
    "Tie the background back to the approved objective and outcome.",
  ],
  scope_and_non_scope: [
    "Separate what is explicitly in scope from what is out of scope.",
    "Make boundary decisions clear enough to reduce later ambiguity.",
    "Avoid inventing implementation detail that is not supported by the context.",
  ],
  constraints_and_conditions: [
    "List operational, timeline, budget, policy, or dependency constraints.",
    "Distinguish hard constraints from softer working assumptions when possible.",
    "Note conditions that must remain true for the plan to succeed.",
  ],
  stakeholders_and_roles: [
    "Identify the key stakeholders, decision makers, contributors, and affected parties.",
    "Explain each role in terms of responsibility or influence.",
    "Keep the list focused on actors who materially affect delivery or approval.",
  ],
  deliverables_and_milestones: [
    "Describe the tangible deliverables and the major milestones toward them.",
    "Prefer milestone descriptions that can be reviewed or approved.",
    "Sequence milestones logically without turning this into a full task plan.",
  ],
  work_breakdown: [
    "Organize the work into a small number of coherent workstreams or phases.",
    "Describe major chunks of work, dependencies, and likely sequencing.",
    "Do not invent low-level tasks beyond what the context supports.",
  ],
  risks_assumptions_and_open_questions: [
    "List the main risks, assumptions, and unanswered questions separately when possible.",
    "Prioritize items that materially affect planning confidence or delivery.",
    "Include mitigations or follow-up actions when the context supports them.",
  ],
};

const KNOWN_PROVIDERS = ["openai", "anthropic", "azure_openai"] as const;
type ProviderName = (typeof KNOWN_PROVIDERS)[number];

function buildStructuredContext(projectContext: IntakePayload): string {
  const { structured_input: structured, free_form_input: freeForm, planning_mode } = projectContext;
  return [
    `Planning mode: ${planning_mode}`,
    `Project title: ${structured.title || "(not set)"}`,
    `Objective: ${structured.objective || "(not set)"}`,
    `Background / current situation: ${structured.background_or_current_situation || "(not set)"}`,
    `Scope summary: ${structured.scope_summary || "(not set)"}`,
    `Stakeholders: ${structured.stakeholders || "(not set)"}`,
    `Expected outcome or deliverable: ${structured.expected_outcome_or_deliverable || "(not set)"}`,
    `Constraints or conditions: ${structured.constraints_or_conditions || "(not set)"}`,
    "",
    "Free-form input:",
    freeForm.body || "(not set)",
  ].join("\n");
}

function buildRefinementPrompt(input: RefinementEngineInput): string {
  const label = buildArtifactLabel(input.artifactKey);
  const artifactGuidance = ARTIFACT_GUIDANCE[input.artifactKey]
    .map((item) => `- ${item}`)
    .join("\n");

  return [
    "You are generating one planning artifact for a structured refinement workflow.",
    "Return markdown only.",
    `Start the document with exactly this heading: # ${label}`,
    "Write in the dominant language used in the provided project context.",
    "Use the project context and approved upstream artifacts as the source of truth.",
    "When information is missing, make a conservative assumption and label it clearly.",
    "Do not mention the model, provider, or that this text was generated by AI.",
    "",
    `Artifact to produce: ${label}`,
    "",
    "Artifact-specific guidance:",
    artifactGuidance,
    "",
    "Project context:",
    buildStructuredContext(input.projectContext),
    "",
    "Approved upstream artifacts:",
    buildUpstreamContext(input.upstreamSnapshots) || "(none)",
    "",
    "Optional user guidance:",
    input.userPrompt || "(none)",
  ].join("\n");
}

function normalizeGeneratedContent(content: string, artifactKey: ArtifactKey): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error(`LLM returned empty content for ${artifactKey}`);
  }

  const heading = `# ${buildArtifactLabel(artifactKey)}`;
  if (trimmed.startsWith("#")) {
    return trimmed;
  }
  return `${heading}\n\n${trimmed}`;
}

function buildChangeReason(providerName: ProviderName, input: RefinementEngineInput): string {
  const label = buildArtifactLabel(input.artifactKey);
  return input.userPrompt
    ? `Generated draft for ${label} using ${providerName} with user guidance`
    : `Generated draft for ${label} using ${providerName}`;
}

class ProviderBackedRefinementEngine implements RefinementEngine {
  constructor(
    private readonly providerName: ProviderName,
    private readonly provider: LLMProvider,
  ) {}

  async generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput> {
    const result = await this.provider.generateText(buildRefinementPrompt(input), {
      maxTokens: 1400,
      temperature: 0.2,
    });

    return {
      content: normalizeGeneratedContent(result.text, input.artifactKey),
      changeReason: buildChangeReason(this.providerName, input),
    };
  }
}

export class StubRefinementEngine implements RefinementEngine {
  async generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput> {
    const label = buildArtifactLabel(input.artifactKey);
    const upstreamSummary =
      input.upstreamSnapshots.length > 0
        ? ` building on ${input.upstreamSnapshots.length} approved upstream artifact(s)`
        : "";
    const promptNote = input.userPrompt
      ? ` incorporating the user prompt`
      : "";

    const content = [
      `# ${label}`,
      "",
      `This is a generated draft for the **${label}** artifact${upstreamSummary}${promptNote}.`,
      "",
      `**Project**: ${input.projectContext.structured_input.title}`,
      `**Objective**: ${input.projectContext.structured_input.objective || "(not set)"}`,
      "",
      buildUpstreamContext(input.upstreamSnapshots) || `*No upstream artifacts yet.*`,
      "",
      `---`,
      `*Stub content — replace with a real LLM provider adapter.*`,
    ]
      .join("\n")
      .trim();

    return {
      content,
      changeReason: `Stub-generated draft for ${label}`,
    };
  }
}

export class OpenAIRefinementEngine implements RefinementEngine {
  private readonly delegate: ProviderBackedRefinementEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedRefinementEngine(
      "openai",
      provider ??
        LLMProviderFactory.create({ ...process.env, LLM_PROVIDER: "openai" }),
    );
  }

  async generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput> {
    return this.delegate.generateArtifactContent(input);
  }
}

export class AnthropicRefinementEngine implements RefinementEngine {
  private readonly delegate: ProviderBackedRefinementEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedRefinementEngine(
      "anthropic",
      provider ??
        LLMProviderFactory.create({ ...process.env, LLM_PROVIDER: "anthropic" }),
    );
  }

  async generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput> {
    return this.delegate.generateArtifactContent(input);
  }
}

export class AzureOpenAIRefinementEngine implements RefinementEngine {
  private readonly delegate: ProviderBackedRefinementEngine;

  constructor(provider?: LLMProvider) {
    this.delegate = new ProviderBackedRefinementEngine(
      "azure_openai",
      provider ??
        LLMProviderFactory.create({
          ...process.env,
          LLM_PROVIDER: "azure_openai",
        }),
    );
  }

  async generateArtifactContent(
    input: RefinementEngineInput,
  ): Promise<RefinementEngineOutput> {
    return this.delegate.generateArtifactContent(input);
  }
}

export function resolveConfiguredRefinementProvider(
  env: Record<string, string | undefined>,
): ProviderName | "stub" {
  const provider = env["LLM_PROVIDER"] ?? env["REFINEMENT_PROVIDER"];
  if (!provider) {
    return "stub";
  }
  if ((KNOWN_PROVIDERS as readonly string[]).includes(provider)) {
    return provider as ProviderName;
  }
  throw new Error(
    `LLM_PROVIDER must be one of: ${KNOWN_PROVIDERS.join(", ")}`,
  );
}

function resolveRefinementEngine(
  env: Record<string, string | undefined> = process.env,
): RefinementEngine {
  const provider = resolveConfiguredRefinementProvider(env);
  switch (provider) {
    case "openai":
      return new OpenAIRefinementEngine();
    case "anthropic":
      return new AnthropicRefinementEngine();
    case "azure_openai":
      return new AzureOpenAIRefinementEngine();
    default:
      return new StubRefinementEngine();
  }
}

export const refinementEngine: RefinementEngine = resolveRefinementEngine();
