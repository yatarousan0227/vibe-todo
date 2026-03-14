# VibeToDo Management Workspace

- brief_id: 004-vibetodo-management-workspace
- status: draft

## Background
VibeToDo の最終成果は、AI が精緻化した文書から作られた ToDo を実際に消化し、管理できることである。そのためには task plan を一覧するだけでなく、カンバンやガントのような視覚的ビューで進行状況を扱い、必要に応じて再精緻化へ戻せる management workspace が必要になる。

## Goal
canonical task データを単一の source of truth として、kanban と gantt を中心に task 実行と進行管理を行える Web ワークスペースを提供する。

## Scope In
- task 一覧、詳細、更新を行う管理ワークスペース
- カンバンボード表示
- ガントチャート表示
- stale task plan の可視化と read-only 制御
- 複数ビュー間で同期された task 状態更新
- 実行中 task から refinement へ戻るフィードバック導線

## Scope Out
- artifact 生成と承認フローの詳細実装
- task 生成そのもののロジック
- 認証、権限管理、複数ユーザー同時編集
- 外部プロジェクト管理ツールへのエクスポートや同期

## Users And External Actors
- 生成された ToDo を実行、追跡、更新したい個人ユーザー
- Task Planning アプリケーションサービス
- Spec Refinement アプリケーションサービス

## Constraints
- management workspace は current published `TaskPlanSnapshot` を唯一の編集対象とし、未 publish の task plan は表示対象に含めてはならない
- current published `TaskPlanSnapshot` が `stale` になった場合、workspace は stale 理由と再生成導線を表示できても task 更新操作は read-only に切り替えなければならない
- カンバンとガントは同一 task source of truth を参照し、別々の計画ロジックを持ってはならない
- kanban の task state は `backlog`、`ready`、`in_progress`、`blocked`、`done` の固定 enum を用いなければならない
- gantt は MVP では current published task plan の read-only 可視化とし、drag や resize による直接編集を持ち込んではならない
- task 更新は精緻化由来の関連 artifact 参照を失わない形で保持しなければならない
- single-user MVP では `Assignee` は非空文字列を維持し、初期値は実行中の単一ユーザーを表す `self` として扱う
- refinement feedback は workspace 側で独立した永続 record を持たず、`project_id`、`task_id`、関連 `artifact_snapshot_id` を持つ context handoff として refinement フローへ戻さなければならない
- MVP の管理ビューはローカル環境で Docker 起動できなければならない
- 認証機能は MVP に含めない
- 追加の管理ツールは将来的に拡張できる余地を持たせるが、MVP では kanban と gantt を優先する

## Domain Alignment
- primary_domain: DOM-004
- related_briefs:
  - 002-vibetodo-spec-refinement-workbench
  - 003-vibetodo-task-plan-synthesis
- upstream_domains:
  - DOM-002
  - DOM-003
- downstream_domains:
  - none

## Common Design References
- CD-DATA-001
- CD-API-001
- CD-MOD-001
- CD-UI-001

## Requirements
### REQ-001 Kanban Task Management
- priority: must
- description: システムは current published `TaskPlanSnapshot` の全 task を `backlog`、`ready`、`in_progress`、`blocked`、`done` の Status 列に表示し、task plan の `freshness_status` が current の場合に限りユーザーが task の Status を更新できなければならない。更新後は同一 `task_id` の canonical record が保存されなければならない。
- rationale: 実行フェーズでの直感的な進捗管理を支えるため。

### REQ-002 Gantt Schedule Visualization
- priority: must
- description: システムは current published `TaskPlanSnapshot` の各 task について `Due Date`、`Estimate`、`Dependencies`、および task planning が返す execution-order metadata を用いた read-only gantt chart を表示し、依存関係 conflict または blocked 状態の task を識別表示できなければならない。
- rationale: タイムラインベースで仕事全体の順序と遅延影響を把握できるようにするため。

### REQ-003 Shared Task Source Of Truth And Stale Handling
- priority: must
- description: kanban、gantt、task detail、artifact health の各表示は同一 current published `TaskPlanSnapshot` とその task record 群を参照し、いずれかの編集ビューで行った更新が他ビューにも整合して反映されなければならない。上流 artifact 変更により current published task plan が `stale` になった場合、システムは stale reason と再生成要求を表示しつつ workspace を read-only に切り替えなければならない。
- rationale: ビューごとに task 状態が食い違うと管理ワークスペースとして成立しないため。

### REQ-004 Task Detail Editing
- priority: should
- description: ユーザーは current published かつ non-stale task plan 上の task detail から `Description`、`Priority`、`Status`、`Due Date`、`Dependencies`、`Estimate`、`Assignee` を編集でき、保存時には canonical task shape の必須項目を non-null で維持し、`Related Artifacts` link を 1 件以上保持しなければならない。`Assignee` は single-user MVP では初期値 `self` を持ちつつ、非空文字列として編集できるべきである。
- rationale: 実行フェーズでは AI 生成後の微修正が継続的に必要になるため。

### REQ-005 Refinement Feedback Entry Point
- priority: should
- description: ユーザーは task detail または artifact health 表示から refinement feedback を開始でき、その際システムは少なくとも `project_id`、`task_id`、関連 `artifact_snapshot_id`、および user-entered feedback note を `SCR-002 Refinement Loop` の開始 context として渡さなければならない。workspace 側で独立した feedback 永続化を前提にしてはならない。
- rationale: 管理と再精緻化のループを閉じ、VibeToDo の継続改善体験を作るため。

### REQ-006 Workspace Extension Boundary
- priority: could
- description: システムは kanban と gantt を共通 workspace shell 内で切り替え可能にし、将来的な追加管理ビューを canonical task schema、shared API contract、既存 refinement feedback 導線を変更せずに追加できる画面構造またはモジュール境界を持つことが望ましい。
- rationale: ユーザー要求にある「そのほかのマネジメントツール」へ無理なく拡張できるようにするため。

### REQ-007 Local Docker Operation
- priority: must
- description: management workspace は web application と PostgreSQL を含む Docker 構成でローカル起動でき、認証なしで単一利用者が task 管理を開始できなければならない。current published task plan が存在する場合はその workspace を表示し、存在しない場合は task plan 未 publish の empty state と次の導線を表示しなければならない。
- rationale: 製品全体のローカル MVP 前提を満たすため。

## Source References
- `.specify/project/tech-stack.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
