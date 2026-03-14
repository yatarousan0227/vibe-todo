import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AzureOpenAILLMAdapter } from "./azure-openai-adapter";
import { LLMError } from "./types";

const DEFAULT_CONFIG = {
  apiKey: "test-azure-key",
  endpoint: "https://my-resource.openai.azure.com",
  deploymentName: "gpt-4o-deployment",
  apiVersion: "2024-02-01",
};

function makeSuccessResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeErrorResponse(
  status: number,
  error: { code?: string; message?: string; param?: string } = { code: "Error" },
) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AzureOpenAILLMAdapter", () => {
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
      mockFetch.mockResolvedValue(makeSuccessResponse("Hello from Azure!"));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("Hi");

      expect(result.text).toBe("Hello from Azure!");
      expect(result.usage).toEqual({
        promptTokens: 5,
        completionTokens: 15,
        totalTokens: 20,
      });
    });

    it("builds correct endpoint URL", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      await adapter.generateText("test");

      const expectedUrl =
        "https://my-resource.openai.azure.com/openai/deployments/gpt-4o-deployment/chat/completions?api-version=2024-02-01";
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.anything());
    });

    it("works when options is omitted", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("no opts"));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("prompt");

      expect(result.text).toBe("no opts");
    });
  });

  describe("error cases", () => {
    it("throws LLMError AUTH_ERROR on 401", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "AUTH_ERROR",
        providerName: "azure_openai",
      });
    });

    it("throws LLMError PROVIDER_ERROR on 404 (DeploymentNotFound)", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        providerName: "azure_openai",
      });
    });

    it("throws LLMError PROVIDER_ERROR on 500", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        providerName: "azure_openai",
      });
    });

    it("throws LLMError NETWORK_ERROR on fetch failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        providerName: "azure_openai",
      });
    });

    it("does not expose Azure-specific error fields in thrown LLMError", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      const err = await adapter.generateText("test").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LLMError);
      const llmErr = err as LLMError;
      expect(llmErr.code).toBe("AUTH_ERROR");
      expect(llmErr).not.toHaveProperty("azure_error");
    });

    it("includes the Azure error message in provider errors", async () => {
      mockFetch.mockResolvedValue(
        makeErrorResponse(400, {
          code: "unsupported_parameter",
          param: "max_tokens",
          message: "Use 'max_completion_tokens' instead.",
        }),
      );
      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);

      await expect(adapter.generateText("test")).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        message: expect.stringContaining("Use 'max_completion_tokens' instead."),
      });
    });
  });

  describe("boundary cases", () => {
    it("strips trailing slash from endpoint before building URL", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse("ok"));
      const adapter = new AzureOpenAILLMAdapter({
        ...DEFAULT_CONFIG,
        endpoint: "https://my-resource.openai.azure.com/",
      });
      await adapter.generateText("test");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("//openai");
      expect(calledUrl).toMatch(
        /^https:\/\/my-resource\.openai\.azure\.com\/openai\/deployments\//,
      );
    });

    it("produces same URL regardless of trailing slash on endpoint", async () => {
      const withSlash = vi.fn().mockResolvedValue(makeSuccessResponse("ok"));
      const withoutSlash = vi.fn().mockResolvedValue(makeSuccessResponse("ok"));

      vi.stubGlobal("fetch", withSlash);
      const adapterWith = new AzureOpenAILLMAdapter({
        ...DEFAULT_CONFIG,
        endpoint: "https://my-resource.openai.azure.com/",
      });
      await adapterWith.generateText("test");

      vi.stubGlobal("fetch", withoutSlash);
      const adapterWithout = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      await adapterWithout.generateText("test");

      expect(withSlash.mock.calls[0][0]).toBe(withoutSlash.mock.calls[0][0]);
    });

    it("retries with max_completion_tokens when max_tokens is rejected", async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeErrorResponse(400, {
            code: "unsupported_parameter",
            param: "max_tokens",
            message:
              "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse("ok"));

      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("test", { maxTokens: 10 });

      expect(result.text).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(firstBody.max_tokens).toBe(10);
      expect(firstBody.max_completion_tokens).toBeUndefined();
      expect(secondBody.max_tokens).toBeUndefined();
      expect(secondBody.max_completion_tokens).toBe(10);
    });

    it("drops temperature after Azure rejects non-default values", async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeErrorResponse(400, {
            code: "unsupported_parameter",
            param: "max_tokens",
            message:
              "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
          }),
        )
        .mockResolvedValueOnce(
          makeErrorResponse(400, {
            code: "unsupported_value",
            param: "temperature",
            message:
              "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.",
          }),
        )
        .mockResolvedValueOnce(makeSuccessResponse("ok"));

      const adapter = new AzureOpenAILLMAdapter(DEFAULT_CONFIG);
      const result = await adapter.generateText("test", {
        maxTokens: 10,
        temperature: 0.2,
      });

      expect(result.text).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      const thirdBody = JSON.parse(mockFetch.mock.calls[2][1].body as string);
      expect(secondBody.temperature).toBe(0.2);
      expect(secondBody.max_completion_tokens).toBe(10);
      expect(thirdBody.temperature).toBeUndefined();
      expect(thirdBody.max_completion_tokens).toBe(10);
    });
  });
});
