import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnthropicLLMAdapter } from "./anthropic-adapter";
import { LLMError } from "./types";

const DEFAULT_CONFIG = {
  apiKey: "test-anthropic-key",
  model: "claude-sonnet-4-6",
  baseUrl: "https://api.anthropic.com",
};

function makeSuccessResponse(text: string) {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeErrorResponse(status: number) {
  return new Response(JSON.stringify({ error: { type: "error" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AnthropicLLMAdapter", () => {
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
      mockFetch.mockResolvedValue(makeSuccessResponse("Hello from Anthropic!"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("Hi");

      expect(result.text).toBe("Hello from Anthropic!");
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it("sends request to ANTHROPIC_API_BASE_URL when configured", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AnthropicLLMAdapter({
        ...DEFAULT_CONFIG,
        baseUrl: "https://custom.anthropic.proxy.example.com",
      });
      await adapter.generateText("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.anthropic.proxy.example.com/v1/messages",
        expect.anything(),
      );
    });

    it("uses default https://api.anthropic.com when no base URL override", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.anything(),
      );
    });

    it("works when options is omitted", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("no options"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("prompt");

      expect(result.text).toBe("no options");
    });
  });

  describe("error cases", () => {
    it("throws LLMError AUTH_ERROR on 401", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "AUTH_ERROR",
        providerName: "anthropic",
      });
    });

    it("throws LLMError RATE_LIMITED on 429", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(429));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "RATE_LIMITED",
        providerName: "anthropic",
      });
    });

    it("throws LLMError NETWORK_ERROR on fetch failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        providerName: "anthropic",
      });
    });

    it("does not expose Anthropic-specific error fields in thrown LLMError", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);

      const err = await adapter.generateText("test").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LLMError);
      const llmErr = err as LLMError;
      expect(llmErr).not.toHaveProperty("anthropic_error");
      expect(llmErr.code).toBe("AUTH_ERROR");
    });
  });

  describe("boundary cases", () => {
    it("includes max_tokens in request body from options", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("prompt", { maxTokens: 512 });

      const callArgs = mockFetch.mock.calls[0];
      const reqBody = JSON.parse(callArgs[1].body as string) as Record<string, unknown>;
      expect(reqBody["max_tokens"]).toBe(512);
    });

    it("uses default max_tokens when options is omitted", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("prompt");

      const callArgs = mockFetch.mock.calls[0];
      const reqBody = JSON.parse(callArgs[1].body as string) as Record<string, unknown>;
      expect(typeof reqBody["max_tokens"]).toBe("number");
      expect(reqBody["max_tokens"]).toBeGreaterThan(0);
    });

    it("includes anthropic-version header in every request", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AnthropicLLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("prompt");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers["anthropic-version"]).toBeDefined();
    });
  });
});
