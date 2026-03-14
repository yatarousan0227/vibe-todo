export type LLMErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR";

export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMResult {
  text: string;
  usage?: LLMUsage;
}

export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly providerName: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface LLMProvider {
  generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult>;
}
