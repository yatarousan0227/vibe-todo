import { OpenAILLMAdapter } from "./openai-adapter";
import { AnthropicLLMAdapter } from "./anthropic-adapter";
import { AzureOpenAILLMAdapter } from "./azure-openai-adapter";
import type { LLMProvider } from "./types";

type Env = Record<string, string | undefined>;

const VALID_PROVIDERS = ["openai", "anthropic", "azure_openai"] as const;
type ProviderName = (typeof VALID_PROVIDERS)[number];

function requireVars(env: Env, keys: string[]): void {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

export class LLMProviderFactory {
  static create(env: Env): LLMProvider {
    const provider = env["LLM_PROVIDER"];

    if (!provider || !(VALID_PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(
        `LLM_PROVIDER must be one of: ${VALID_PROVIDERS.join(", ")}`,
      );
    }

    const validProvider = provider as ProviderName;

    if (validProvider === "openai") {
      requireVars(env, ["OPENAI_API_KEY", "OPENAI_MODEL"]);
      return new OpenAILLMAdapter({
        apiKey: env["OPENAI_API_KEY"]!,
        model: env["OPENAI_MODEL"]!,
        baseUrl: env["OPENAI_API_BASE_URL"] ?? "https://api.openai.com/v1",
      });
    }

    if (validProvider === "anthropic") {
      requireVars(env, ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]);
      return new AnthropicLLMAdapter({
        apiKey: env["ANTHROPIC_API_KEY"]!,
        model: env["ANTHROPIC_MODEL"]!,
        baseUrl: env["ANTHROPIC_API_BASE_URL"] ?? "https://api.anthropic.com",
      });
    }

    // azure_openai
    requireVars(env, [
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_ENDPOINT",
      "AZURE_OPENAI_DEPLOYMENT_NAME",
      "AZURE_OPENAI_API_VERSION",
    ]);
    return new AzureOpenAILLMAdapter({
      apiKey: env["AZURE_OPENAI_API_KEY"]!,
      endpoint: env["AZURE_OPENAI_ENDPOINT"]!,
      deploymentName: env["AZURE_OPENAI_DEPLOYMENT_NAME"]!,
      apiVersion: env["AZURE_OPENAI_API_VERSION"]!,
    });
  }
}
