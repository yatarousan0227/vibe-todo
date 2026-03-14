# Test Plan

## Test Levels

- unit
- integration
- end-to-end

## Scope

- `LLMProvider` 抽象インターフェースの型レベル検証（コンパイルチェック）
- 各 adapter（OpenAI・Anthropic・Azure OpenAI）のユニットテスト（外部 API をモック）
- `LLMProviderFactory` のユニットテスト（各プロバイダー設定・バリデーションエラーケース）
- adapter の contract テスト（`LLMProvider` インターフェースを満たす振る舞い検証）
- Docker Compose + `.env` による起動統合確認
- shared_ui_design_refs:
  - none

## Test Environments

- unit/integration: ローカル Node.js 環境（Docker 不要）。外部 LLM API はモックまたはテスト用スタブを使用する
- contract: ローカル Node.js 環境。各 provider SDK のモックライブラリを使用する
- end-to-end（optional MVP 後）: 実際の外部 LLM API キーを使用した smoke test

## Execution Order

1. unit（LLMProvider インターフェース定義、各 adapter の単体テスト、factory バリデーションテスト）
2. integration（adapter の contract テスト、factory と adapter の組み合わせテスト）
3. end-to-end（Docker Compose 起動確認、optional: 実 API smoke test）

## Test Implementation Notes

- coding-rules.md の要件「Adapters for PostgreSQL and each LLM provider must be covered by contract-oriented tests」に従い、各 adapter が `LLMProvider` インターフェースの contract を満たすことをテストで保証する
- AI 依存フローは「deterministic fixtures or mocks at the integration boundary」でテストする。実際の LLM 呼び出しは unit/integration テストには含めない
- coding-rules.md の要件「External integration failures from PostgreSQL, OpenAI, Anthropic, or Azure OpenAI must be normalized into application-level error categories」を検証するため、各 adapter のエラー変換テストを必須とする
- 環境変数バリデーションは各プロバイダーの必須変数欠損・`LLM_PROVIDER` 未設定・無効値の組み合わせをすべてカバーする
- logging rules 準拠の確認：テストログに API キーや接続文字列が含まれないことを確認する

## Ownership

- 開発者（ローカル環境でのユニット・インテグレーションテスト実行）
- CI パイプライン（unit・integration テストの自動実行）
