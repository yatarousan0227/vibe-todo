# Test Design

## Requirement Coverage

### REQ-001 抽象 LLMProvider ポート定義
- normal_cases:
  - `LLMProvider` インターフェースを実装したクラスが `generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult>` を正しく公開できる
  - 3 つの adapter すべてが `LLMProvider` 型として代入可能である（型レベル検証）
  - `LLMCallOptions` に provider 固有の型（SDK クラス・ヘッダー構造）が含まれていない
- error_cases:
  - `LLMProvider` インターフェースを満たさない adapter はコンパイルエラーになる
- boundary_cases:
  - `options` を省略した呼び出しでも `LLMResult` が返る
- references:
  - overview.md
  - common-design-refs.yaml
  - sequence-flows/core-flow.md

### REQ-002 OpenAI adapter 実装
- normal_cases:
  - `OPENAI_API_KEY` と `OPENAI_MODEL` が設定された状態で `generateText` を呼び出すと Chat Completions API に正しいリクエストが送信される
  - 成功レスポンスが `LLMResult { text: string; usage?: LLMUsage }` に正規化される
  - `OPENAI_API_BASE_URL` が設定されている場合はそのエンドポイントが使用される
  - `OPENAI_API_BASE_URL` が未設定の場合は `https://api.openai.com/v1` が使用される
- error_cases:
  - 401 エラー（認証失敗）が `LLMError { code: "AUTH_ERROR" }` に変換される
  - 429 エラー（レート制限）が `LLMError { code: "RATE_LIMITED" }` に変換される
  - ネットワークエラーが `LLMError { code: "NETWORK_ERROR" }` に変換される
  - provider 固有の error フィールド（OpenAI 固有）が `LLMError` に含まれない
- boundary_cases:
  - 空のプロンプト文字列での呼び出し（adapter はバリデーションしない。呼び出し元の責務）
  - 非常に長いプロンプト（エラーレスポンスが正規化されること）
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-003 Anthropic adapter 実装
- normal_cases:
  - `ANTHROPIC_API_KEY` と `ANTHROPIC_MODEL` が設定された状態で `generateText` を呼び出すと Messages API に正しいリクエストが送信される
  - 成功レスポンスが `LLMResult` に正規化される
  - `ANTHROPIC_API_BASE_URL` が設定されている場合はそのエンドポイントが使用される
- error_cases:
  - 認証エラーが `LLMError { code: "AUTH_ERROR" }` に変換される
  - レート制限エラーが `LLMError { code: "RATE_LIMITED" }` に変換される
  - provider 固有の error フィールド（Anthropic 固有）が `LLMError` に含まれない
- boundary_cases:
  - Anthropic API 固有の `max_tokens` 必須パラメータが adapter 内で適切に補完される
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-004 Azure OpenAI adapter 実装
- normal_cases:
  - 4 つの必須変数（`AZURE_OPENAI_API_KEY`・`AZURE_OPENAI_ENDPOINT`・`AZURE_OPENAI_DEPLOYMENT_NAME`・`AZURE_OPENAI_API_VERSION`）が設定された状態で正しいエンドポイント URL が組み立てられる
  - 成功レスポンスが `LLMResult` に正規化される
- error_cases:
  - 認証エラーが `LLMError { code: "AUTH_ERROR" }` に変換される
  - Azure 固有エラー（`DeploymentNotFound` 等）が `LLMError { code: "PROVIDER_ERROR" }` に変換される
- boundary_cases:
  - `AZURE_OPENAI_ENDPOINT` の末尾スラッシュの有無によらず正しい URL が生成される
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-005 環境変数スキーマ定義
- normal_cases:
  - `.env.example` にすべてのプロバイダーの変数が説明コメント付きで含まれている
  - `LLM_PROVIDER`・各プロバイダーの必須変数・省略可能変数がそれぞれ明記されている
- error_cases:
  - `.env.example` に定義されていない変数が factory で参照されていない（スキーマとコードの乖離なし）
- boundary_cases:
  - OpenAI の `OPENAI_API_BASE_URL` など省略可能変数がコメントアウトの形式でサンプルに含まれている
- references:
  - ui-fields.yaml
  - test-plan.md

### REQ-006 プロバイダー factory と起動時バリデーション
- normal_cases:
  - `LLM_PROVIDER=openai` で `OPENAI_API_KEY` と `OPENAI_MODEL` が設定されているとき、`OpenAILLMAdapter` インスタンスが返る
  - `LLM_PROVIDER=anthropic` で `ANTHROPIC_API_KEY` と `ANTHROPIC_MODEL` が設定されているとき、`AnthropicLLMAdapter` インスタンスが返る
  - `LLM_PROVIDER=azure_openai` で 4 変数すべてが設定されているとき、`AzureOpenAILLMAdapter` インスタンスが返る
- error_cases:
  - `LLM_PROVIDER` が未設定の場合にエラーがスローされ、メッセージに「LLM_PROVIDER」が含まれる
  - `LLM_PROVIDER=invalid` の場合にエラーがスローされ、許容値一覧がメッセージに含まれる
  - `LLM_PROVIDER=openai` で `OPENAI_API_KEY` が欠損している場合に欠損変数名を含むエラーがスローされる
  - `LLM_PROVIDER=azure_openai` で `AZURE_OPENAI_ENDPOINT` が欠損している場合にエラーがスローされる
- boundary_cases:
  - 省略可能変数（`OPENAI_API_BASE_URL` 等）が欠損していてもエラーにならない
  - 空文字列の必須変数は未設定と同様にエラーとして扱われる
- references:
  - overview.md
  - sequence-flows/core-flow.md
  - test-plan.md

### REQ-007 ローカル Docker 動作確認
- normal_cases:
  - `docker-compose.yml` が `env_file: .env` または `environment` セクションで環境変数を Next.js コンテナに渡している
  - `.env.example` をコピーして API キーを埋めれば `docker compose up` で起動できる
- error_cases:
  - 環境変数未設定で `docker compose up` した場合にコンテナが起動エラーを出力して停止する（サイレント失敗しない）
- boundary_cases:
  - `LLM_PROVIDER` の値を変えて再起動すると別の adapter が使用される
- references:
  - overview.md
  - test-plan.md
