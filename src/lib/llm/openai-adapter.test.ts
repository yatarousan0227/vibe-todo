import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAILLMAdapter } from "./openai-adapter";
import { LLMError } from "./types";

const DEFAULT_CONFIG = {
  apiKey: "test-openai-key",
  model: "gpt-4o",
  baseUrl: "https://api.openai.com/v1",
};

function makeSuccessResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeErrorResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenAILLMAdapter", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("normal cases", () => {
    it("returns LLMResult with text and usage on success", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("Hello from OpenAI!"));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("Hi");

      expect(result.text).toBe("Hello from OpenAI!");
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it("sends request to OPENAI_API_BASE_URL when configured", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new OpenAILLMAdapter({
        ...DEFAULT_CONFIG,
        baseUrl: "https://custom.proxy.example.com/v1",
      });
      await adapter.generateText("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.proxy.example.com/v1/chat/completions",
        expect.anything(),
      );
    });

    it("uses default https://api.openai.com/v1 when no base URL override", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.anything(),
      );
    });

    it("works when options is omitted", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("no options"));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("prompt without options");

      expect(result.text).toBe("no options");
    });

    it("returns result without usage when usage field is absent", async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "text" } }] }),
          { status: 200 },
        ),
      );
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("prompt");

      expect(result.usage).toBeUndefined();
    });
  });

  describe("error cases", () => {
    it("throws LLMError AUTH_ERROR on 401", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toThrow(LLMError);
      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "AUTH_ERROR",
        providerName: "openai",
      });
    });

    it("throws LLMError RATE_LIMITED on 429", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(429));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "RATE_LIMITED",
        providerName: "openai",
      });
    });

    it("throws LLMError NETWORK_ERROR on fetch failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        providerName: "openai",
      });
    });

    it("throws LLMError PROVIDER_ERROR on other non-2xx status", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        providerName: "openai",
      });
    });

    it("does not expose OpenAI-specific error fields in thrown LLMError", async () => {
      mockFetch.mockResolvedValue(
        makeErrorResponse(401, {
          error: { type: "invalid_api_key", param: null, code: "invalid_api_key" },
        }),
      );
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      const err = await adapter.generateText("test").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LLMError);
      const llmErr = err as LLMError;
      expect(llmErr).not.toHaveProperty("error");
      expect(llmErr.code).toBe("AUTH_ERROR");
    });
  });

  describe("boundary cases", () => {
    it("passes empty prompt without validation error", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("response to empty"));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("");

      expect(result.text).toBe("response to empty");
    });

    it("normalizes error response for very long prompt (provider error)", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(400, { error: { message: "too long" } }));
      const adapter = new OpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("x".repeat(100000))).rejects.toBeInstanceOf(LLMError);
    });
  });
});
