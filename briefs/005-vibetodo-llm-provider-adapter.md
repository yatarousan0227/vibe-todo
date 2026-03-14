# VibeToDo LLM Provider Adapter

- brief_id: 005-vibetodo-llm-provider-adapter
- status: draft

## Background
VibeToDo の中核機能である Spec Refinement と Task Plan Synthesis は、AI による文書生成・精緻化を必要とする。tech-stack.md では OpenAI・Anthropic・Azure OpenAI の 3 プロバイダーをサポート対象として定めており、architecture principles は「LLM プロバイダーは差し替え可能な provider adapter の背後に隔離し、コアワークフローを書き換えずにモデルベンダーを変更できなければならない」と明示している。現状、LLM 呼び出しの具体実装が未整備であり、API キーや接続先 URL などの可変設定が環境変数として管理されていないため、refinement ワークフローを実際に動作させることができない。

## Goal
OpenAI・Anthropic・Azure OpenAI の 3 プロバイダー向け adapter を実装し、domain 層が呼び出す抽象ポート（LLMProvider）として隠蔽する。プロバイダー選択・API キー・接続先 URL などの可変設定はすべて環境変数で管理し、コードを変更せずにプロバイダーを切り替えられる状態にする。これにより CD-MOD-001 の `RefinementEngine` コラボレーターが実際の LLM を使って artifact 生成を行えるようにする。

## Scope In
- 抽象 LLMProvider ポートインターフェース定義（domain 層が依存するもの）
- OpenAI adapter 実装（Chat Completions API）
- Anthropic adapter 実装（Messages API）
- Azure OpenAI adapter 実装（Azure-hosted Chat Completions API）
- プロバイダー選択・API キー・モデル名・エンドポイント URL を管理する環境変数スキーマの定義
- 環境変数から適切な adapter を生成する provider factory
- ローカル Docker 開発用の `.env.example` ファイル整備
- 環境変数バリデーション（起動時に必須変数の欠損を検出してエラーを出す）

## Scope Out
- プロンプトテンプレートの設計・管理（DOM-002 の責務）
- artifact 生成ロジックや refinement ワークフロー本体
- ストリーミングレスポンス対応（MVP 後の拡張として扱う）
- レート制限・リトライの高度な制御（基本的なエラー伝播のみ対象とする）
- プロバイダーの UI 上でのランタイム切り替え
- 認証・マルチテナント機能
- LLM 以外の外部 AI サービス（画像生成・埋め込み等）

## Users And External Actors
- Spec Refinement アプリケーションサービス（CD-MOD-001 の RefinementEngine コラボレーター経由で LLMProvider を呼び出す）
- Task Plan Synthesis アプリケーションサービス（同上）
- OpenAI API（外部サービス）
- Anthropic API（外部サービス）
- Azure OpenAI Service（外部サービス）
- ローカル開発者（Docker Compose で環境変数を設定して起動する）

## Constraints
- API キー・エンドポイント URL・モデル名などの可変設定は環境変数でのみ保持し、ソースコード内にハードコードしてはならない
- プロバイダー固有の情報（キー名・ヘッダー形式・ペイロード差異）は adapter 内に閉じ、domain 層やアプリケーション層に露出させてはならない
- CD-API-001 の不変条件「provider 固有情報は request/response の必須契約に含めない」に準拠しなければならない
- CD-MOD-001 の `LLMProvider` コラボレーター境界を守り、module が直接 SDK を import する構造を禁止する
- tech-stack.md に記載の 3 プロバイダー（OpenAI・Anthropic・Azure OpenAI）を初期 MVP でサポートしなければならない
- 環境変数の欠損や不整合はアプリケーション起動時に検出してエラーを発生させ、サイレントに無効な状態で動作継続しない
- ローカル環境は Docker Compose で動作しなければならない

## Domain Alignment
- primary_domain: DOM-002
- related_briefs:
  - 002-vibetodo-spec-refinement-workbench
  - 003-vibetodo-task-plan-synthesis
- upstream_domains:
  - none
- downstream_domains:
  - DOM-002
  - DOM-003

## Common Design References
- CD-API-001
- CD-MOD-001

## Requirements

### REQ-001 抽象 LLMProvider ポート定義
- priority: must
- description: システムは domain 層が依存できる `LLMProvider` 抽象インターフェースを定義しなければならない。このインターフェースは少なくとも `generateText(prompt: string, options?: LLMCallOptions): Promise<LLMResult>` に相当するメソッドを持ち、OpenAI・Anthropic・Azure OpenAI のいずれの adapter も同一インターフェースを実装することを保証できなければならない。インターフェースは provider 固有の型（SDK クラス・ヘッダー構造等）を参照してはならない。
- rationale: domain 層を特定 SDK に依存させないことで、プロバイダー変更時にコアロジックの書き換えを防ぐため。

### REQ-002 OpenAI adapter 実装
- priority: must
- description: システムは OpenAI の Chat Completions API を呼び出す `OpenAILLMAdapter` を実装し、`LLMProvider` インターフェースを満たさなければならない。adapter は `OPENAI_API_KEY` と `OPENAI_MODEL` の環境変数を使用し、`OPENAI_API_BASE_URL` が設定されている場合はデフォルトのエンドポイントを上書きしなければならない。API 呼び出しが失敗した場合は provider 固有のエラーを domain が扱える共通エラー型に変換して返さなければならない。
- rationale: OpenAI は最初に利用されるプロバイダーであり、refinement ワークフローの初期動作確認に必要なため。

### REQ-003 Anthropic adapter 実装
- priority: must
- description: システムは Anthropic の Messages API を呼び出す `AnthropicLLMAdapter` を実装し、`LLMProvider` インターフェースを満たさなければならない。adapter は `ANTHROPIC_API_KEY` と `ANTHROPIC_MODEL` の環境変数を使用し、`ANTHROPIC_API_BASE_URL` が設定されている場合はデフォルトのエンドポイントを上書きしなければならない。API 呼び出しが失敗した場合は共通エラー型に変換して返さなければならない。
- rationale: tech-stack.md でサポート対象として明示されており、プロバイダー選択の柔軟性を確保するため。

### REQ-004 Azure OpenAI adapter 実装
- priority: must
- description: システムは Azure OpenAI Service の Chat Completions API を呼び出す `AzureOpenAILLMAdapter` を実装し、`LLMProvider` インターフェースを満たさなければならない。adapter は `AZURE_OPENAI_API_KEY`・`AZURE_OPENAI_ENDPOINT`・`AZURE_OPENAI_DEPLOYMENT_NAME`・`AZURE_OPENAI_API_VERSION` の環境変数を使用しなければならない。API 呼び出しが失敗した場合は共通エラー型に変換して返さなければならない。
- rationale: tech-stack.md でサポート対象として明示されており、企業環境での Azure 経由利用を可能にするため。

### REQ-005 環境変数スキーマ定義
- priority: must
- description: システムは全プロバイダーの設定を網羅した環境変数スキーマを定義し、`.env.example` ファイルとして repository に含めなければならない。スキーマは少なくとも次の変数を定義する：`LLM_PROVIDER`（`openai` | `anthropic` | `azure_openai`）、OpenAI 用 `OPENAI_API_KEY`・`OPENAI_MODEL`・`OPENAI_API_BASE_URL`（省略可）、Anthropic 用 `ANTHROPIC_API_KEY`・`ANTHROPIC_MODEL`・`ANTHROPIC_API_BASE_URL`（省略可）、Azure OpenAI 用 `AZURE_OPENAI_API_KEY`・`AZURE_OPENAI_ENDPOINT`・`AZURE_OPENAI_DEPLOYMENT_NAME`・`AZURE_OPENAI_API_VERSION`。各変数には説明コメントを付与しなければならない。
- rationale: 可変設定を一元化してコードへのハードコードを防ぎ、環境ごとの差し替えを安全かつ明示的に行えるようにするため。

### REQ-006 プロバイダー factory と起動時バリデーション
- priority: must
- description: システムは `LLM_PROVIDER` 環境変数の値に基づいて対応する adapter のインスタンスを返す provider factory を実装しなければならない。factory はアプリケーション起動時に選択されたプロバイダーに必要な環境変数が揃っているかを検証し、必須変数が欠損している場合は起動を中断して欠損変数名を含むエラーメッセージを出力しなければならない。`LLM_PROVIDER` が未設定または無効な値の場合も同様にエラーとして扱わなければならない。
- rationale: 設定ミスを起動時に早期発見することで、実行中の不正 API 呼び出しや無言の障害を防ぐため。

### REQ-007 ローカル Docker 動作確認
- priority: must
- description: Docker Compose 構成は `.env` ファイルから環境変数を読み込み、Next.js アプリケーションコンテナに渡す仕組みを持たなければならない。ローカル開発者が `.env.example` をコピーして API キーを埋めれば、コードを変更せずに任意のプロバイダーで起動できなければならない。
- rationale: MVP の運用前提がローカル Docker 環境であり、開発者の初期セットアップ負荷を最小化するため。

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
