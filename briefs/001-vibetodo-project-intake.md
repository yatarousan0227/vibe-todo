# VibeToDo Project Intake

- brief_id: 001-vibetodo-project-intake
- status: draft

## Background
VibeToDo は、ユーザーが持つ曖昧なプロジェクト構想や日々の仕事内容を AI と一緒に精緻化し、最終的に実行可能な ToDo と管理ビューへ変換する Web アプリである。精緻化品質は最初の入力品質に大きく依存するため、ユーザーが負担を感じずに必要最小限の構造化情報と自由文の文脈を同時に渡せる intake 体験が必要になる。

## Goal
ユーザーがプロジェクトまたは自分の仕事内容を短時間で登録し、その内容を PostgreSQL に保存した上で、後続の AI 精緻化フローを開始できる初期入力基盤を提供する。

## Scope In
- テンプレート入力と自由文入力を組み合わせたプロジェクト登録フォーム
- プロジェクト種別や仕事種別に応じた最低限の入力テンプレート
- 初期入力内容の保存、再編集、精緻化開始前の確認
- 精緻化セッション開始に必要なコンテキストの生成と保存
- ローカル Docker 環境で動作する intake 機能

## Scope Out
- AI による文書の段階生成や承認フロー
- 承認済み文書からの task 生成
- カンバンやガントなどの管理ビュー
- 認証、権限管理、マルチテナント機能

## Users And External Actors
- プロジェクト計画を始めたい個人ユーザー
- 日々の仕事を整理して ToDo 化したい個人ユーザー
- Spec Refinement アプリケーションサービス（downstream consumer）
- PostgreSQL

## Constraints
- システムはローカル環境で動作し、Docker で起動と運用ができなければならない
- 初期データは PostgreSQL に保存しなければならない
- 認証機能は MVP に含めない
- 入力モデルはソフトウェア開発専用ではなく、一般的な仕事やプロジェクト記述に対応しなければならない
- Intake 層は後続の精緻化ロジックを埋め込まず、精緻化開始に必要なコンテキスト生成までに責務を限定しなければならない

## Domain Alignment
- primary_domain: DOM-001
- related_briefs:
  - 002-vibetodo-spec-refinement-workbench
- upstream_domains:
  - none
- downstream_domains:
  - DOM-002

## Common Design References
- CD-DATA-001
- CD-API-001
- CD-MOD-001
- CD-UI-001

## Requirements
### REQ-001 Mixed Input Registration
- priority: must
- description: システムは単一の intake フロー上で、構造化テンプレート入力と自由文入力を同時に扱えなければならず、refinement 開始前の確定時には両入力を 1 つの intake snapshot として関連付けて保存できなければならない。
- rationale: 構造化情報と文脈情報の両方が揃わないと、後続の AI 精緻化が不安定になるため。

### REQ-002 Planning-Friendly Template Set
- priority: must
- description: システムは少なくとも `project` と `daily_work` の 2 種類の intake モードを提供し、各モードで次の最小入力項目を提示しなければならない。`project` モードの必須項目は `title`、`objective`、`background_or_current_situation`、`scope_summary`、`constraints_or_conditions`、`stakeholders` とし、`daily_work` モードの必須項目は `title`、`objective`、`background_or_current_situation`、`expected_outcome_or_deliverable`、`constraints_or_conditions` とする。どちらのモードでもソフトウェア開発専用語を必須にしてはならない。
- rationale: 特定ドメインに偏らない intake を作ることで、VibeToDo の汎用的な仕事整理体験を成立させるため。

### REQ-003 Draft Persistence
- priority: must
- description: システムは最初の下書き保存時に `lifecycle_status=draft_intake` の `Project` を作成し、同じ `project_id` に対して構造化入力と自由文入力を PostgreSQL へ再保存できなければならない。また、認証なしのローカル前提でも複数の intake 下書きを保持し、`project_id` を使って再開できなければならない。
- rationale: 入力が長文化しやすいため、一度で完了しなくても作業継続できる必要があるため。

### REQ-004 Refinement Session Initialization
- priority: must
- description: ユーザーが review step で登録を確定した時点で、システムは `project_id`、`title`、`planning_mode`、確認済みテンプレート入力、確認済み自由文、`confirmed_at` を含む intake snapshot を current project context として保存し、`active_artifact_key=objective_and_outcome` を持つ active な `RefinementSession` を 1 件初期化しなければならない。
- rationale: 後続の文書生成が入力の何を根拠に始まったかを追跡できるようにするため。

### REQ-005 Pre-Start Review And Edit
- priority: must
- description: システムは refinement 開始前に必ず review step を表示し、ユーザーが構造化テンプレート入力と自由文入力の全内容を確認し、必要に応じてその場で両方を修正したうえで開始確定できなければならない。
- rationale: 最初の入力ミスを早期に補正することで、以降の AI 出力ずれを減らせるため。

### REQ-006 Local Deployment Readiness
- priority: must
- description: Intake 機能はアプリケーション本体と PostgreSQL を含む Docker 構成で起動でき、認証設定なしでローカル利用者が画面にアクセスできなければならない。
- rationale: MVP の利用前提がローカル運用であり、初期セットアップの複雑さを下げる必要があるため。

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
