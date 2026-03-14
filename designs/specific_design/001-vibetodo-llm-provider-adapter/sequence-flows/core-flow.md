# Sequence Flow: Core Flow

- sequence_id: SEQ-001
- requirement_ids:
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
  - REQ-006
  - REQ-007

## SEQ-001-A: Provider Initialization at App Startup

アプリケーション起動時に `LLMProviderFactory` が環境変数を読み取り、バリデーションを行い、対応する adapter インスタンスを生成して返すフロー。

```mermaid
sequenceDiagram
    participant App as Next.js App
    participant Factory as LLMProviderFactory
    participant Env as process.env
    participant Adapter as [OpenAI|Anthropic|AzureOpenAI]LLMAdapter
    participant Domain as RefinementEngine (CD-MOD-001)

    App->>Factory: create(process.env)
    Factory->>Env: read LLM_PROVIDER
    alt LLM_PROVIDER is missing or invalid
        Factory-->>App: startup error: "LLM_PROVIDER must be one of: openai, anthropic, azure_openai"
    end
    Factory->>Env: read provider-specific required vars
    alt required vars are missing
        Factory-->>App: startup error: "Missing env vars: [OPENAI_API_KEY, ...]"
    end
    Factory->>Adapter: new [Provider]LLMAdapter(config)
    Adapter-->>Factory: adapter instance
    Factory-->>App: LLMProvider (port interface)
    App->>Domain: inject LLMProvider via DI
```

### SEQ-001-A Steps

1. Next.js アプリケーション起動時に `LLMProviderFactory.create(process.env)` が呼び出される
2. Factory は `LLM_PROVIDER` を読み取り、`openai`・`anthropic`・`azure_openai` のいずれかであることを確認する
3. 値が未設定または無効な場合、起動を中断して許容値一覧を含むエラーメッセージを出力する
4. 選択されたプロバイダーに対応する必須環境変数一覧を検証する
5. 欠損がある場合は欠損変数名を列挙したエラーで起動を中断する
6. バリデーション通過後に対応する adapter インスタンスを生成する
7. 生成した adapter を `LLMProvider` インターフェースとして返し、`RefinementEngine` へ DI する

---

## SEQ-001-B: Text Generation Call Flow

`RefinementEngine` が artifact 生成のために `LLMProvider.generateText` を呼び出すフロー。

```mermaid
sequenceDiagram
    participant Domain as RefinementEngine (CD-MOD-001)
    participant Port as LLMProvider (port)
    participant Adapter as [Provider]LLMAdapter
    participant ExtAPI as External LLM API

    Domain->>Port: generateText(prompt, options?)
    Port->>Adapter: generateText(prompt, options?)
    Adapter->>Adapter: build provider-specific request
    Adapter->>ExtAPI: POST /completions (or Messages API)
    alt API call succeeds
        ExtAPI-->>Adapter: provider-specific response
        Adapter->>Adapter: normalize to LLMResult
        Adapter-->>Port: LLMResult { text, usage? }
        Port-->>Domain: LLMResult
    else API call fails
        ExtAPI-->>Adapter: provider-specific error
        Adapter->>Adapter: normalize to LLMError
        Adapter-->>Port: LLMError { code, message, providerName }
        Port-->>Domain: LLMError
    end
```

### SEQ-001-B Steps

1. `RefinementEngine` が `llmProvider.generateText(prompt, options)` を呼び出す
2. 実行時 adapter（OpenAI・Anthropic・Azure OpenAI のいずれか）がプロバイダー固有のリクエスト形式に変換する
3. 外部 LLM API へ HTTP リクエストを送信する
4. 成功時はプロバイダー固有レスポンスを `LLMResult { text: string; usage?: LLMUsage }` に正規化して返す
5. 失敗時はプロバイダー固有エラーを `LLMError { code: LLMErrorCode; message: string; providerName: string }` に正規化して返す
6. `RefinementEngine` は `LLMResult` または `LLMError` を受け取り、artifact 生成ロジックに従って処理する

---

## External Dependencies

- OpenAI API：Chat Completions API（`POST https://api.openai.com/v1/chat/completions` または `OPENAI_API_BASE_URL` で指定したエンドポイント）
- Anthropic API：Messages API（`POST https://api.anthropic.com/v1/messages` または `ANTHROPIC_API_BASE_URL` で指定したエンドポイント）
- Azure OpenAI Service：`POST {AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}`
