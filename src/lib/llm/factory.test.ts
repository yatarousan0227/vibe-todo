import { describe, it, expect } from "vitest";
import { LLMProviderFactory } from "./factory";
import { OpenAILLMAdapter } from "./openai-adapter";
import { AnthropicLLMAdapter } from "./anthropic-adapter";
import { AzureOpenAILLMAdapter } from "./azure-openai-adapter";

const OPENAI_ENV = {
  LLM_PROVIDER: "openai",
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-4o",
};

const ANTHROPIC_ENV = {
  LLM_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
};

const AZURE_ENV = {
  LLM_PROVIDER: "azure_openai",
  AZURE_OPENAI_API_KEY: "azure-key",
  AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com",
  AZURE_OPENAI_DEPLOYMENT_NAME: "gpt-4o-deployment",
  AZURE_OPENAI_API_VERSION: "2024-02-01",
};

describe("LLMProviderFactory", () => {
  describe("normal cases", () => {
    it("returns OpenAILLMAdapter when LLM_PROVIDER=openai", () => {
      const provider = LLMProviderFactory.create(OPENAI_ENV);
      expect(provider).toBeInstanceOf(OpenAILLMAdapter);
    });

    it("returns AnthropicLLMAdapter when LLM_PROVIDER=anthropic", () => {
      const provider = LLMProviderFactory.create(ANTHROPIC_ENV);
      expect(provider).toBeInstanceOf(AnthropicLLMAdapter);
    });

    it("returns AzureOpenAILLMAdapter when LLM_PROVIDER=azure_openai", () => {
      const provider = LLMProviderFactory.create(AZURE_ENV);
      expect(provider).toBeInstanceOf(AzureOpenAILLMAdapter);
    });

    it("uses OPENAI_API_BASE_URL when provided", () => {
      const provider = LLMProviderFactory.create({
        ...OPENAI_ENV,
        OPENAI_API_BASE_URL: "https://custom-proxy.example.com/v1",
      });
      expect(provider).toBeInstanceOf(OpenAILLMAdapter);
    });

    it("uses ANTHROPIC_API_BASE_URL when provided", () => {
      const provider = LLMProviderFactory.create({
        ...ANTHROPIC_ENV,
        ANTHROPIC_API_BASE_URL: "https://custom-anthropic.example.com",
      });
      expect(provider).toBeInstanceOf(AnthropicLLMAdapter);
    });
  });

  describe("error cases — LLM_PROVIDER validation", () => {
    it("throws when LLM_PROVIDER is not set", () => {
      expect(() => LLMProviderFactory.create({})).toThrow(
        /LLM_PROVIDER must be one of/,
      );
    });

    it("throws when LLM_PROVIDER is an invalid value", () => {
      expect(() =>
        LLMProviderFactory.create({ LLM_PROVIDER: "cohere" }),
      ).toThrow(/LLM_PROVIDER must be one of/);
    });

    it("error message includes valid provider names", () => {
      let message = "";
      try {
        LLMProviderFactory.create({ LLM_PROVIDER: "invalid" });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain("openai");
      expect(message).toContain("anthropic");
      expect(message).toContain("azure_openai");
    });
  });

  describe("error cases — missing required vars", () => {
    it("throws with missing var names when OPENAI_API_KEY is absent", () => {
      expect(() =>
        LLMProviderFactory.create({ LLM_PROVIDER: "openai", OPENAI_MODEL: "gpt-4o" }),
      ).toThrow(/OPENAI_API_KEY/);
    });

    it("throws with missing var names when OPENAI_MODEL is absent", () => {
      expect(() =>
        LLMProviderFactory.create({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }),
      ).toThrow(/OPENAI_MODEL/);
    });

    it("throws with missing var names when ANTHROPIC_API_KEY is absent", () => {
      expect(() =>
        LLMProviderFactory.create({
          LLM_PROVIDER: "anthropic",
          ANTHROPIC_MODEL: "claude-sonnet-4-6",
        }),
      ).toThrow(/ANTHROPIC_API_KEY/);
    });

    it("throws with missing var name when AZURE_OPENAI_ENDPOINT is absent", () => {
      expect(() =>
        LLMProviderFactory.create({
          LLM_PROVIDER: "azure_openai",
          AZURE_OPENAI_API_KEY: "key",
          AZURE_OPENAI_DEPLOYMENT_NAME: "dep",
          AZURE_OPENAI_API_VERSION: "2024-02-01",
        }),
      ).toThrow(/AZURE_OPENAI_ENDPOINT/);
    });

    it("lists all missing var names in error message", () => {
      let message = "";
      try {
        LLMProviderFactory.create({ LLM_PROVIDER: "openai" });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain("OPENAI_API_KEY");
      expect(message).toContain("OPENAI_MODEL");
    });
  });

  describe("boundary cases", () => {
    it("does not throw when optional OPENAI_API_BASE_URL is absent", () => {
      expect(() => LLMProviderFactory.create(OPENAI_ENV)).not.toThrow();
    });

    it("does not throw when optional ANTHROPIC_API_BASE_URL is absent", () => {
      expect(() => LLMProviderFactory.create(ANTHROPIC_ENV)).not.toThrow();
    });

    it("treats empty string OPENAI_API_KEY as missing (validation error)", () => {
      expect(() =>
        LLMProviderFactory.create({
          LLM_PROVIDER: "openai",
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "gpt-4o",
        }),
      ).toThrow(/OPENAI_API_KEY/);
    });

    it("treats empty string OPENAI_MODEL as missing (validation error)", () => {
      expect(() =>
        LLMProviderFactory.create({
          LLM_PROVIDER: "openai",
          OPENAI_API_KEY: "sk-test",
          OPENAI_MODEL: "",
        }),
      ).toThrow(/OPENAI_MODEL/);
    });

    it("treats empty string AZURE_OPENAI_API_KEY as missing", () => {
      expect(() =>
        LLMProviderFactory.create({
          ...AZURE_ENV,
          AZURE_OPENAI_API_KEY: "",
        }),
      ).toThrow(/AZURE_OPENAI_API_KEY/);
    });
  });
});
