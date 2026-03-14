import type { LLMCallOptions, LLMProvider, LLMResult, LLMUsage } from "./types";
import { LLMError } from "./types";

interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicSuccessResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicLLMAdapter implements LLMProvider {
  constructor(private readonly config: AnthropicConfig) {}

  async generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    };
    if (options?.temperature !== undefined) body["temperature"] = options.temperature;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMError(
        "NETWORK_ERROR",
        err instanceof Error ? err.message : "Network error",
        "anthropic",
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new LLMError("AUTH_ERROR", "Anthropic authentication failed", "anthropic");
      }
      if (response.status === 429) {
        throw new LLMError("RATE_LIMITED", "Anthropic rate limit exceeded", "anthropic");
      }
      throw new LLMError(
        "PROVIDER_ERROR",
        `Anthropic API error: ${response.status}`,
        "anthropic",
      );
    }

    const data = (await response.json()) as AnthropicSuccessResponse;
    const textBlock = data.content.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";
    const usage: LLMUsage | undefined = data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined;

    return { text, usage };
  }
}
