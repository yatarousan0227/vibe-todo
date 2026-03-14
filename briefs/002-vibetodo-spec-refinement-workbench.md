# VibeToDo Spec Refinement Workbench

- brief_id: 002-vibetodo-spec-refinement-workbench
- status: draft

## Background
VibeToDo の中核価値は、ユーザーが入力した粗いプロジェクト情報を AI が段階的に文書化し、ユーザーの確認と修正を通して計画品質を高めることにある。SpecKit や SDD に近い体験を一般的な仕事やプロジェクト向けに再構成し、ユーザーが細部を意識しすぎずに計画を前進させられる refinement workbench が必要である。

## Goal
AI が project 精緻化専用のワークフローとして標準文書群を順番に生成し、ユーザーが各文書境界で確認、修正、承認しながら task synthesis へ安全に handoff できる readiness 状態まで到達できるようにする。

## Scope In
- AI による段階的な文書生成フロー
- 文書単位の確認、編集、承認 UI
- プロジェクト文脈に限定した AI 対話ループ
- 文書バージョン管理、承認状態、差分の保持
- LLM プロバイダ抽象を介した精緻化処理
- task synthesis 開始条件の提示と `SCR-004` への handoff

## Scope Out
- 初回 intake フォームの詳細実装
- task の具体的な生成アルゴリズム
- カンバンやガントなど task 管理ビューの詳細実装
- 汎用チャットボットや雑談用途の AI 体験

## Users And External Actors
- プロジェクト計画を精緻化したい個人ユーザー
- LLM provider adapter
- Task Planning アプリケーションサービス（handoff 先の downstream consumer）
- PostgreSQL（永続化基盤）

## Constraints
- AI 対話は project 精緻化支援に限定し、汎用アシスタントとして振る舞ってはならない
- 文書生成は artifact ごとの境界を持ち、ユーザー承認前に次工程へ自動確定してはならない
- ユーザー編集内容は第一級データとして保持し、後続生成で黙って上書きしてはならない
- LLM 接続は差し替え可能な抽象インターフェース越しに扱わなければならない
- 長時間の AI 処理は進捗と再試行可能性を持つ非同期処理として扱う必要がある
- MVP では `project` と `daily_work` の両 planning mode で同一の canonical artifact sequence を required artifact set として扱わなければならない
- approval authority は明示的なユーザー操作に限定し、system auto-approval を前提にしてはならない
- AI chat は artifact 本文を暗黙更新してはならず、本文変更は明示的な generate、regenerate、edit 操作でのみ確定できなければならない

## Domain Alignment
- primary_domain: DOM-002
- related_briefs:
  - 001-vibetodo-project-intake
  - 003-vibetodo-task-plan-synthesis
  - 004-vibetodo-management-workspace
- upstream_domains:
  - DOM-001
- downstream_domains:
  - DOM-003
  - DOM-004

## Common Design References
- CD-DATA-001
- CD-API-001
- CD-MOD-001
- CD-UI-001

## Requirements
### REQ-001 Canonical Artifact Sequence
- priority: must
- description: システムは `project` と `daily_work` の両 planning mode に対して、Objective and Outcome、Background and Current Situation、Scope and Non-Scope、Constraints and Conditions、Stakeholders and Roles、Deliverables and Milestones、Work Breakdown、Risks, Assumptions, and Open Questions の required artifact sequence を保持し、同一 `project_id` 内で current artifact が approved になるまで次の artifact 生成を開始してはならない。
- rationale: task 生成前に必要な計画情報を揃え、精緻化工程を透明にするため。

### REQ-002 Artifact-Level Review And Approval
- priority: must
- description: システムは各 artifact について current draft、直前 snapshot との差分、変更理由を表示し、ユーザーが edit、approve、reject を明示操作できなければならない。required artifact のいずれかが unapproved または stale の間は task synthesis ready 状態へ遷移してはならない。
- rationale: ユーザー意図から外れた文書を途中で補正できる体験が VibeToDo の中心価値であるため。

### REQ-003 Context-Bound AI Conversation
- priority: must
- description: システムは active `project_id`、active `artifact_key`、approved かつ current な upstream artifact snapshot のみを refinement prompt context として使う AI 対話を提供し、当該 project に紐づかない汎用相談や無関係な提案を受け付けてはならない。また、chat 応答だけで artifact 本文を更新してはならない。
- rationale: 汎用チャット化を防ぎ、精緻化の精度と再現性を保つため。

### REQ-004 Version And Diff Tracking
- priority: must
- description: システムは各 artifact について generate と user edit のたびに immutable snapshot を保存し、approval または reject decision は対象 snapshot、決定者、決定時刻、理由とともに監査可能に保持しなければならない。任意の current snapshot に対して、直前版との差分と更新理由を取得できなければならない。
- rationale: 計画がどの判断で変わったかを監査できるようにするため。

### REQ-005 Staleness Propagation
- priority: must
- description: required artifact sequence 上で上流 artifact の current approved snapshot が変更または再承認された場合、システムはその後段に位置する downstream artifact と最新 task plan snapshot を同一 `project_id` 内で stale として記録し、再生成または再承認されるまで current planning basis として扱ってはならない。
- rationale: 古い前提に基づく文書や tasks が使われ続けることを防ぐため。

### REQ-006 Replaceable LLM Provider Integration
- priority: must
- description: 精緻化処理は LLM provider adapter を通じて実行され、OpenAI、Anthropic、Azure OpenAI などの実装差し替えを domain logic の変更なしで行えなければならない。
- rationale: LLM 接続差し替え可能という製品制約を満たすため。

### REQ-007 Async Generation Feedback
- priority: should
- description: 長時間の文書生成や再生成処理では、システムは artifact generation job ごとに少なくとも `queued`、`running`、`failed`、`retryable`、`completed` の進捗状態をユーザーに表示できるべきであり、失敗時も current approved snapshot を失わずに再試行できるべきである。
- rationale: AI 処理待ち時間を操作不能なブラックボックスにしないため。

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
