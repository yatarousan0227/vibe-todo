# VibeToDo Task Plan Synthesis

- brief_id: 003-vibetodo-task-plan-synthesis
- status: draft

## Background
VibeToDo は精緻化された文書を読むだけで終わらず、そこから実行可能な ToDo を自動生成して管理可能にする必要がある。承認済み artifact を task 化する工程は、ユーザーが細かい分解作業を手作業で行わなくても、優先度、期限、依存関係を持った実行計画へ移行できる品質を左右する。加えて、task plan は management workspace の source of truth になる前に review と publish の境界を持ち、上流文書変更時には stale 判定が一貫して伝播しなければならない。

## Goal
承認済み artifact 群から canonical task shape を満たす Task Plan を生成し、`SCR-004 Task Synthesis` で review と publish を行った上で、kanban や gantt がそのまま利用できる canonical task データを供給する。

## Scope In
- 承認済み artifact を入力にした task 生成
- `SCR-004` における task plan review、軽微な補正、publish 境界
- canonical task shape に沿った task 構造化
- 依存関係、期限、優先度、担当、見積もりの生成と保存
- task plan snapshot と artifact snapshot 参照関係の保持
- 上流文書変更時の stale 判定と再生成制御
- management workspace へ handoff する current task plan の公開

## Scope Out
- artifact 自体の生成や承認 UI
- カンバン、ガント、その他管理ビューの描画
- publish 後の継続的な task 実行管理
- 認証やユーザー権限による task 可視性制御
- 外部 PM SaaS との同期連携

## Users And External Actors
- 承認済み文書から実行計画を作りたい個人ユーザー
- Spec Refinement アプリケーションサービス
- Task Planning アプリケーションサービス
- PostgreSQL
- Management Workspace アプリケーションサービス
- LLM provider adapter

## Constraints
- task 生成は `002-vibetodo-spec-refinement-workbench` で定義された required artifact sequence の current approved snapshot が同一 `project_id` 内で揃っている場合にのみ実行できなければならない
- task synthesis は `project` と `daily_work` の両 planning mode で同じ required artifact set を前提に扱わなければならない
- `SCR-004` は publish boundary として機能し、生成済み task plan はユーザーが明示的に publish するまで management workspace の current plan として扱ってはならない
- `SCR-004` で許可する軽微な補正は、既存 task の canonical field 値と dependency 設定の修正に限定し、task の traceability と canonical task shape を壊してはならない
- 各 task は canonical task shape を source of truth として維持し、`Related Artifacts` は 1 件以上の `artifact_snapshot_id` link から取得できなければならない
- `Due Date`、`Estimate`、`Assignee` は publish 対象 task で必須とし、artifact 群から確定できない場合は synthesize 処理で暫定値を生成するか、生成不能理由を返して publish を拒否しなければならない
- task 保存は PostgreSQL に行い、将来的な DB 差し替えに備えて永続化アクセスは抽象インターフェース越しに扱う必要がある
- 上流 artifact 変更後の stale task plan は current planning basis として扱ってはならず、再生成または再 publish 前に task 更新可能状態へ戻してはならない
- task synthesis が AI 支援を使う場合も workflow 契約は provider 固有に依存してはならず、進捗表示と再試行可能性を持つ非同期処理として扱う必要がある

## Domain Alignment
- primary_domain: DOM-003
- related_briefs:
  - 002-vibetodo-spec-refinement-workbench
  - 004-vibetodo-management-workspace
- upstream_domains:
  - DOM-002
- downstream_domains:
  - DOM-004

## Common Design References
- CD-DATA-001
- CD-API-001
- CD-MOD-001
- CD-UI-001

## Requirements
### REQ-001 Approved Artifact Set Eligibility
- priority: must
- description: システムは、同一 `project_id` に属する required artifact sequence の current approved snapshot がすべて存在し、かつ stale snapshot を含まない場合にのみ Task Plan 生成 command を受理し、条件を満たさない場合は不足または stale の `artifact_key` 一覧を返して生成を拒否しなければならない。
- rationale: 信頼できる planning basis からのみ task plan を生成するため。

### REQ-002 SCR-004 Review And Publish Boundary
- priority: must
- description: システムは `SCR-004 Task Synthesis` 上で生成済み task plan を review 可能に表示し、ユーザーが task plan を明示的に publish するまで management workspace の current plan として公開してはならない。`SCR-004` 上の補正操作は既存 task の field 値と dependency 修正に限定し、task の追加削除や traceability link の喪失を許してはならない。
- rationale: 生成結果を無条件に公開せず、workspace へ渡る source of truth をユーザー確認付きで確定するため。

### REQ-003 Canonical Task Shape And Missing Field Policy
- priority: must
- description: システムは、publish 対象の各 task に `Title`、`Description`、`Priority`、`Status`、`Due Date`、`Dependencies`、`Estimate`、`Assignee` を非 null で保持し、`Related Artifacts` は共有設計で定義された artifact link 群から取得可能にしなければならない。task synthesis 時に `Due Date`、`Estimate`、`Assignee` を確定できない場合、システムは暫定値を生成して review 対象として提示するか、当該 task と理由を明示して publish を拒否しなければならない。
- rationale: canonical task shape を保ちながら、欠損値を黙って流通させないため。

### REQ-004 Dependency-Ready Task Plan Output
- priority: must
- description: システムは、各 task について dependency task ID 一覧と execution-order 判定に必要な構造化メタデータを保存し、同一 Task Plan snapshot から gantt 表示、blocked 判定、優先実行判断に利用できる順序付き task 集合を返せなければならない。
- rationale: 単なる ToDo 列挙ではなく、実行可能な計画として扱うため。

### REQ-005 Artifact Snapshot Traceability
- priority: must
- description: システムは、各 task に対して 1 件以上の approved `artifact_snapshot_id` への traceability link を保持し、task 詳細または query response から生成根拠の snapshot を参照できなければならない。`Related Artifacts` 表示はこれらの link から導出され、task 更新後も削除してはならない。
- rationale: task の妥当性レビューと再生成判断を artifact snapshot 単位で辿れるようにするため。

### REQ-006 Regeneration And Stale Handling
- priority: must
- description: システムは、Task Plan の source artifact set に含まれる current approved snapshot のいずれかが変更または再承認された時点で、その Task Plan snapshot を `stale` に更新し、stale reason と不足アクションを返さなければならない。stale task plan は read-only で参照できても current planning basis や更新対象として扱ってはならず、再生成と再 publish が完了するまで management workspace の active editable plan にしてはならない。
- rationale: 古い前提で作られた task を実行用 source of truth に残さないため。

### REQ-007 Immutable Snapshot Persistence
- priority: should
- description: システムは、Task Plan 生成ごとに immutable `TaskPlanSnapshot` を保存し、`generated_at`、source artifact snapshot IDs、生成された task IDs を記録して、任意の 2 snapshot 間の task 差分を取得できるべきである。
- rationale: 生成結果の改善、比較、監査を可能にするため。

### REQ-008 Provider-Neutral Task Planning Ports
- priority: must
- description: システムは、Task Plan と Task の保存、取得、stale 更新を `TaskPlanRepository` などの domain-defined port 経由で実行し、task planning module 内に PostgreSQL 固有の schema または query 依存を持ち込んではならない。task synthesis engine も provider 固有 API ではなく replaceable port 経由で呼び出されなければならない。
- rationale: persistence と provider を差し替えても task planning logic を維持するため。

### REQ-009 Async Synthesis Progress And Retry
- priority: should
- description: task synthesis が長時間の AI 支援または重い計画処理を伴う場合、システムは synthesis job ごとに少なくとも `queued`、`running`、`failed`、`retryable`、`completed` の進捗状態を返し、失敗時も直前の published task plan を失わずに再試行できるべきである。
- rationale: task synthesis をブラックボックス化せず、失敗時も current plan を保護するため。

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
