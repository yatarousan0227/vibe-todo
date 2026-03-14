# VibeToDo

このリポジトリは、speckit-for-projectsを使用しています。
https://github.com/yatarousan0227/speckit-for-projects

> **ぼんやりしたアイデアを、実行できる計画に変える。**

VibeToDo は、ローカル優先の Web アプリです。あなたが持つ曖昧なプロジェクト構想や日々の仕事内容を受け取り、AI と一緒に整理・精緻化して、実行可能なタスクへと変換します。

---

## なぜ VibeToDo なのか

多くの計画ツールは、「やりたいことがすでに明確」であることを前提にしています。VibeToDo はその手前、「なんとなくやりたいことがある」という状態からスタートします。構造化されたインテーク → AI による精緻化 → タスク生成というフローで、考えをかたちにします。

```
ぼんやりしたアイデア  →  構造化インテーク  →  AI 精緻化  →  実行可能タスク
```

![インテーク画面](images/intake.png)

---

## 主な機能

- **2 つの計画モード** — `project`（プロジェクト）と `daily_work`（日常業務）を状況に合わせて切り替え可能
- **ハイブリッド入力** — 構造化フィールド（タイトル・目的・スコープ）と自由文コンテキストを同じドラフトにまとめて入力
- **下書き保存と再開** — いつでも保存し、`projectId` URL パラメータで続きから再開
- **確認してから確定** — レビュー画面で入力内容を確認し、必要なら編集してから確定
- **精緻化への引き渡し** — 確定すると、後続の AI 精緻化フローに必要なワークスペースコンテキストが初期化
- **LLM プロバイダ切り替え対応** — OpenAI・Anthropic・Azure OpenAI を環境変数で切り替え可能

---

## 技術スタック

| 層 | 技術 |
|----|------|
| フレームワーク | Next.js 16 + React 19 |
| 言語 | TypeScript |
| データベース | PostgreSQL |
| テスト | Vitest |
| インフラ | Docker / Docker Compose |

---

## クイックスタート

### 1. 依存関係をインストール

```bash
npm ci
```

### 2. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を編集してデータベース URL と LLM プロバイダを設定します:

```env
# データベース
DATABASE_URL=postgres://vibetodo:vibetodo@localhost:5432/vibetodo

# LLM プロバイダ — openai | anthropic | azure_openai から選択
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 3. PostgreSQL を起動

```bash
docker compose up -d db
```

### 4. スキーマを初期化

```bash
npm run db:init
```

### 5. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

---

## Docker でまとめて起動

アプリと PostgreSQL を同時に起動:

```bash
docker compose up --build
```

| サービス | ポート |
|---------|--------|
| アプリ | `3000` |
| PostgreSQL | `5432` |

---

## テスト

```bash
npm test
```

`vitest run` を使用します。インテグレーション・E2E テストも利用可能:

```bash
npm run test:integration
npm run test:e2e
```

---

## API リファレンス

### `POST /api/projects`

ドラフト保存またはインテーク確定を行います。

| `generationTrigger` | 動作 |
|---------------------|------|
| `"draft_save"`（または省略） | ドラフトとして保存 |
| `"intake_confirm"` | インテーク確定、精緻化セッションを初期化 |

**例 — ドラフト保存:**

```json
{
  "generationTrigger": "draft_save",
  "project": {
    "planning_mode": "project",
    "structuredInput": {
      "title": "新オンボーディングフロー",
      "objective": "セットアップの摩擦を減らす",
      "background_or_current_situation": "最初の成功体験前にユーザーが離脱している",
      "scope_summary": "初回体験に集中する",
      "stakeholders": "PM、デザイン、サポート",
      "expected_outcome_or_deliverable": "",
      "constraints_or_conditions": "ロールアウトのリスクを低く保つ"
    },
    "freeFormInput": {
      "body": "自由記述の計画コンテキストをここに書く。"
    }
  }
}
```

### `GET /api/projects/:projectId/workspace-context`

保存済みドラフトまたは確定済みプロジェクトのワークスペースコンテキストを返します。UI 右ペインにはこのレスポンスが表示されます。

---

## UI 仕様メモ

- ドラフト ID は初回保存まで採番されません
- `?projectId=<id>` を URL に付けると自動的にセッションを再開します
- レビュー状態は同一画面内で完結します（ページ遷移なし）
- `allowedActions.canConfirm` は現在の状態を反映します

---

## ディレクトリ構成

```
app/
  api/projects/          Next.js Route Handlers
  page.tsx               ホーム画面
src/
  components/
    intake-app.tsx       インテーク UI
  lib/intake/            ドメインロジック、バリデーション、永続化
scripts/
  init-db.ts             DB スキーマ初期化
briefs/                  要件ブリーフ
designs/                 設計成果物
```

---

## ロードマップ

| フェーズ | 機能 | 状態 |
|---------|------|------|
| SCR-001 | プロジェクトインテーク・ドラフト管理 | ✅ 実装済み |
| SCR-002 | AI による仕様精緻化ワークベンチ | ✅ 実装済み |
| SCR-003 | タスク計画の合成 | ✅ 実装済み |
| SCR-004 | 管理ワークスペース（カンバン / タイムライン） | ✅ 実装済み |

**SCR-002 — 仕様精緻化ワークベンチ**
各成果物をその場で編集し、画面を離れずに承認フローを進められます。

![精緻化ワークベンチ](images/refinement.png)

**SCR-004 — 管理ワークスペース**
承認済み成果物を単一のソースとして、カンバン・ガントビューをリアルタイムに反映。

![カンバンビュー](images/kanban.png)

---

## 注意事項

- 認証は未実装です — ローカル利用を前提にした MVP です
- ソフトウェア開発専用ではなく、一般的な仕事やプロジェクト記述に対応しています

---

## ドキュメント

- [ブリーフ: プロジェクトインテーク](briefs/001-vibetodo-project-intake.md)
- [ブリーフ: 仕様精緻化ワークベンチ](briefs/002-vibetodo-spec-refinement-workbench.md)
- [ブリーフ: タスク計画合成](briefs/003-vibetodo-task-plan-synthesis.md)
- [ブリーフ: 管理ワークスペース](briefs/004-vibetodo-management-workspace.md)
- [設計概要](designs/specific_design/001-vibetodo-project-intake/overview.md)

---

## コントリビューション

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)

---

*VibeToDo は MVP です。荒削りな部分は意図的なものです。*
