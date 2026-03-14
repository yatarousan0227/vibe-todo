/**
 * Contract tests: verify that all three adapters satisfy the LLMProvider interface,
 * both at the type level (compile-time) and at runtime behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LLMProvider } from "./types";
import { LLMError } from "./types";
import { OpenAILLMAdapter } from "./openai-adapter";
import { AnthropicLLMAdapter } from "./anthropic-adapter";
import { AzureOpenAILLMAdapter } from "./azure-openai-adapter";

// ── Type-level contract: these assignments must compile without errors ──────
const _openai: LLMProvider = new OpenAILLMAdapter({
  apiKey: "k",
  model: "gpt-4o",
  baseUrl: "https://api.openai.com/v1",
});
const _anthropic: LLMProvider = new AnthropicLLMAdapter({
  apiKey: "k",
  model: "claude-sonnet-4-6",
  baseUrl: "https://api.anthropic.com",
});
const _azure: LLMProvider = new AzureOpenAILLMAdapter({
  apiKey: "k",
  endpoint: "https://my-resource.openai.azure.com",
  deploymentName: "dep",
  apiVersion: "2024-02-01",
});
void _openai;
void _anthropic;
void _azure;

// ── Runtime contract ──────────────────────────────────────────────────────

interface AdapterFactory {
  name: string;
  create: () => LLMProvider;
}

const adapters: AdapterFactory[] = [
  {
    name: "OpenAILLMAdapter",
    create: () =>
      new OpenAILLMAdapter({
        apiKey: "test-key",
        model: "gpt-4o",
        baseUrl: "https://api.openai.com/v1",
      }),
  },
  {
    name: "AnthropicLLMAdapter",
    create: () =>
      new AnthropicLLMAdapter({
        apiKey: "test-key",
        model: "claude-sonnet-4-6",
        baseUrl: "https://api.anthropic.com",
      }),
  },
  {
    name: "AzureOpenAILLMAdapter",
    create: () =>
      new AzureOpenAILLMAdapter({
        apiKey: "test-key",
        endpoint: "https://my-resource.openai.azure.com",
        deploymentName: "dep",
        apiVersion: "2024-02-01",
      }),
  },
];

describe.each(adapters)("LLMProvider contract — $name", ({ create }) => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a generateText method", () => {
    const adapter = create();
    expect(typeof adapter.generateText).toBe("function");
  });

  it("generateText returns a Promise<LLMResult> with text string on success", async () => {
    // Build the appropriate success fixture depending on provider
    const adapterInstance = create();
    const isAnthropic = adapterInstance instanceof AnthropicLLMAdapter;

    if (isAnthropic) {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "contract result" }],
            usage: { input_tokens: 1, output_tokens: 2 },
          }),
          { status: 200 },
        ),
      );
    } else {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "contract result" } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          }),
          { status: 200 },
        ),
      );
    }

    const result = await adapterInstance.generateText("hello");
    expect(typeof result.text).toBe("string");
    expect(result.text).toBe("contract result");
  });

  it("generateText with no options argument still resolves to LLMResult", async () => {
    const adapterInstance = create();
    const isAnthropic = adapterInstance instanceof AnthropicLLMAdapter;

    if (isAnthropic) {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "ok" }],
          }),
          { status: 200 },
        ),
      );
    } else {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200 },
        ),
      );
    }

    const result = await adapterInstance.generateText("prompt");
    expect(result).toHaveProperty("text");
  });

  it("generateText throws LLMError on API failure, not a raw provider error", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "provider specific payload" }), {
        status: 401,
      }),
    );
    const adapterInstance = create();

    await expect(adapterInstance.generateText("test")).rejects.toBeInstanceOf(LLMError);
  });
});
