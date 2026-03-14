import type { LLMCallOptions, LLMProvider, LLMResult, LLMUsage } from "./types";
import { LLMError } from "./types";

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface OpenAISuccessResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAILLMAdapter implements LLMProvider {
  constructor(private readonly config: OpenAIConfig) {}

  async generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
    };
    if (options?.maxTokens !== undefined) body["max_tokens"] = options.maxTokens;
    if (options?.temperature !== undefined) body["temperature"] = options.temperature;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMError(
        "NETWORK_ERROR",
        err instanceof Error ? err.message : "Network error",
        "openai",
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new LLMError("AUTH_ERROR", "OpenAI authentication failed", "openai");
      }
      if (response.status === 429) {
        throw new LLMError("RATE_LIMITED", "OpenAI rate limit exceeded", "openai");
      }
      throw new LLMError("PROVIDER_ERROR", `OpenAI API error: ${response.status}`, "openai");
    }

    const data = (await response.json()) as OpenAISuccessResponse;
    const text = data.choices[0]?.message?.content ?? "";
    const usage: LLMUsage | undefined = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined;

    return { text, usage };
  }
}
