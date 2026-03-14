import type { LLMCallOptions, LLMProvider, LLMResult, LLMUsage } from "./types";
import { LLMError } from "./types";

interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
}

interface AzureOpenAISuccessResponse {
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

interface AzureOpenAIErrorPayload {
  error?: {
    message?: string;
    param?: string;
    code?: string;
  };
}

interface AzureRequestMode {
  tokenField: "max_tokens" | "max_completion_tokens";
  includeTemperature: boolean;
}

export class AzureOpenAILLMAdapter implements LLMProvider {
  constructor(private readonly config: AzureOpenAIConfig) {}

  private buildUrl(): string {
    const base = this.config.endpoint.replace(/\/$/, "");
    return `${base}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;
  }

  private buildBody(
    prompt: string,
    options: LLMCallOptions | undefined,
    mode: AzureRequestMode,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messages: [{ role: "user", content: prompt }],
    };
    if (options?.maxTokens !== undefined) body[mode.tokenField] = options.maxTokens;
    if (mode.includeTemperature && options?.temperature !== undefined) {
      body["temperature"] = options.temperature;
    }
    return body;
  }

  private async post(url: string, body: Record<string, unknown>): Promise<Response> {
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.config.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMError(
        "NETWORK_ERROR",
        err instanceof Error ? err.message : "Network error",
        "azure_openai",
      );
    }
  }

  private async parseErrorResponse(response: Response): Promise<{
    code?: string;
    message?: string;
    param?: string;
  }> {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      const data = JSON.parse(text) as AzureOpenAIErrorPayload;
      return {
        code: data.error?.code,
        message: data.error?.message,
        param: data.error?.param,
      };
    } catch {
      return {
        message: text,
      };
    }
  }

  private buildRetryMode(
    mode: AzureRequestMode,
    options: LLMCallOptions | undefined,
    error: { code?: string; message?: string; param?: string },
  ): AzureRequestMode | null {
    if (
      options?.maxTokens !== undefined &&
      mode.tokenField === "max_tokens" &&
      (error.param === "max_tokens" ||
        error.code === "unsupported_parameter" ||
        error.message?.includes("Use 'max_completion_tokens' instead."))
    ) {
      return {
        ...mode,
        tokenField: "max_completion_tokens",
      };
    }

    if (
      options?.temperature !== undefined &&
      mode.includeTemperature &&
      error.param === "temperature"
    ) {
      return {
        ...mode,
        includeTemperature: false,
      };
    }

    return null;
  }

  async generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult> {
    const url = this.buildUrl();
    let mode: AzureRequestMode = {
      tokenField: "max_tokens",
      includeTemperature: true,
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.post(url, this.buildBody(prompt, options, mode));

      if (response.ok) {
        const data = (await response.json()) as AzureOpenAISuccessResponse;
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

      const error = await this.parseErrorResponse(response);
      const retryMode = response.status === 400
        ? this.buildRetryMode(mode, options, error)
        : null;
      if (retryMode) {
        mode = retryMode;
        continue;
      }

      if (response.status === 401) {
        throw new LLMError(
          "AUTH_ERROR",
          "Azure OpenAI authentication failed",
          "azure_openai",
        );
      }
      if (response.status === 429) {
        throw new LLMError(
          "RATE_LIMITED",
          "Azure OpenAI rate limit exceeded",
          "azure_openai",
        );
      }
      throw new LLMError(
        "PROVIDER_ERROR",
        error.message
          ? `Azure OpenAI API error: ${response.status} - ${error.message}`
          : `Azure OpenAI API error: ${response.status}`,
        "azure_openai",
      );
    }

    throw new LLMError(
      "PROVIDER_ERROR",
      "Azure OpenAI API error: retry limit exceeded",
      "azure_openai",
    );
  }
}
