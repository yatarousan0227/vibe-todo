export const LOCALE_COOKIE = "vibe_locale";

export const SUPPORTED_LOCALES = ["en", "ja"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(value?: string | null): Locale {
  if (value && SUPPORTED_LOCALES.includes(value as Locale)) {
    return value as Locale;
  }
  return "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type ArtifactStatusTone = "blocked" | "ready" | "draft" | "approved" | "stale";

export const ARTIFACT_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    objective_and_outcome: "Objective and Outcome",
    background_and_current_situation: "Background and Current Situation",
    scope_and_non_scope: "Scope and Non-Scope",
    constraints_and_conditions: "Constraints and Conditions",
    stakeholders_and_roles: "Stakeholders and Roles",
    deliverables_and_milestones: "Deliverables and Milestones",
    work_breakdown: "Work Breakdown",
    risks_assumptions_and_open_questions: "Risks, Assumptions, and Open Questions",
  },
  ja: {
    objective_and_outcome: "目的と成果",
    background_and_current_situation: "背景と現状",
    scope_and_non_scope: "スコープ / 非スコープ",
    constraints_and_conditions: "制約と前提条件",
    stakeholders_and_roles: "関係者と役割",
    deliverables_and_milestones: "成果物とマイルストーン",
    work_breakdown: "作業分解",
    risks_assumptions_and_open_questions: "リスク・仮説・未解決事項",
  },
};

export function getArtifactLabel(locale: Locale, artifactKey: string): string {
  return ARTIFACT_LABELS[locale][artifactKey] ?? artifactKey;
}

export const STATUS_LABELS: Record<Locale, Record<ArtifactStatusTone, string>> = {
  en: {
    blocked: "Blocked",
    ready: "Ready to draft",
    draft: "Draft",
    approved: "Approved",
    stale: "Stale",
  },
  ja: {
    blocked: "待機中",
    ready: "下書き可能",
    draft: "ドラフト",
    approved: "承認済み",
    stale: "古い状態",
  },
};

export const TASK_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    backlog: "Backlog",
    ready: "Ready",
    in_progress: "In progress",
    blocked: "Blocked",
    done: "Done",
  },
  ja: {
    backlog: "バックログ",
    ready: "準備完了",
    in_progress: "進行中",
    blocked: "ブロック中",
    done: "完了",
  },
};

export const TASK_PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    high: "High",
    medium: "Medium",
    low: "Low",
  },
  ja: {
    high: "高",
    medium: "中",
    low: "低",
  },
};

export const PLANNING_MODE_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    project: "Project planning",
    daily_work: "Daily work planning",
  },
  ja: {
    project: "プロジェクト計画",
    daily_work: "日次業務計画",
  },
};

const dictionaries = {
  en: {
    appName: "VibeTodo",
    localeLabel: "Language",
    intake: {
      screenId: "SCR-001 Intake Start",
      title: "Start planning with one saved source of truth.",
      description:
        "Capture the project context once, keep it editable, and move straight into refinement without losing any intake detail.",
      editorTitle: "Intake editor",
      editorDescription:
        "The shared scaffold stays stable. Mode-specific fields switch without discarding what you already wrote.",
      modeLabel: "Mode",
      stateLabel: "State",
      draftIdLabel: "Draft ID",
      draftIdPlaceholder: "Assigned on first save",
      projectModeHint: "Keeps scope summary and stakeholders visible.",
      dailyModeHint: "Switches to expected outcome or deliverable.",
      draftIdHint: "Resume manually or open this screen with ?projectId=...",
      draftIdInputPlaceholder: "Resume an existing draft",
      saveDraft: "Save draft",
      resumeDraft: "Resume draft",
      reviewBeforeRefinement: "Review before refinement",
      reviewBanner:
        "Review still happens inside SCR-001. Structured fields and the full narrative stay visible before the transition into refinement.",
      structuredSummaryTitle: "Structured input summary",
      structuredSummaryDescription:
        "Every value shown here becomes the intake seed for the first refinement draft.",
      freeFormSummaryTitle: "Free-form context summary",
      freeFormSummaryDescription:
        "The full narrative remains readable before refinement starts.",
      editBeforeStart: "Edit before start",
      confirmAndStart: "Confirm and start refinement",
      readinessTitle: "Draft readiness",
      latestApiResult: "Latest API result",
      composeTargets: "Compose verification targets",
      composeTargetsDescription:
        "Save uses POST /api/projects, resume uses GET /api/projects/{projectId}/workspace-context, and confirmation starts one refinement session.",
      screenStateDraft: "Draft editor",
      screenStateReview: "Review inside SCR-001",
      reviewSummaryFields: "Review summary fields",
      visibleRequiredFields: "Visible required fields",
      confirmReadiness: "Confirm and start",
      saveReadiness: "Save draft",
      editReturn: "Edit return",
      reviewAvailability: "Review availability",
      noApiRoundTrip: "No API round-trip yet.",
      statusReviewReady:
        "Review before refinement is ready inside SCR-001. The draft stays on this screen until confirmation.",
      statusReturnedToEdit: "Returned to the draft editor with all current values preserved.",
      statusMissingRefinementSession:
        "Intake confirmation finished without an active refinement session.",
    },
    refinement: {
      screenId: "SCR-002 Refinement Loop",
      intakeNotConfirmed: "Intake not yet confirmed",
      intakeNotConfirmedBody:
        "Complete and confirm the project intake before entering the refinement workbench.",
      workbenchDescription:
        "Draft everything upfront, edit directly in place, and move through approval without leaving this screen.",
      approvedContext: "Approved planning context",
      approvedContextBody: "Approved artifacts stay visible as planning evidence for later work.",
      draftBody: "Draft body",
      previousVersion: "Previous version",
      currentVersion: "Current version",
      changes: "Changes",
      noDraftYet: "No draft exists for this artifact yet.",
      noDraftHint: "Generate the current artifact or draft the full sequence in one pass.",
      generateDraft: "Generate draft",
      regenerateDraft: "Regenerate draft",
      draftAll: "Draft all remaining",
      saveEditedDraft: "Save edited draft",
      approveAndNext: "Approve and next",
      rejectDraft: "Reject draft",
      openTaskSynthesis: "Open task synthesis",
      taskSynthesisLocked: "Task synthesis is still locked",
      taskSynthesisReady: "Task synthesis is unlocked",
      taskSynthesisLockedBody:
        "Approve every required artifact first. You can still prebuild drafts for the rest of the sequence now.",
      taskSynthesisReadyBody:
        "All required artifacts are approved and current. Task synthesis is ready.",
      decisionReason: "Decision reason",
      decisionReasonPlaceholder: "Explain the approval or revision call...",
      defaultDecisionReason: "Reviewed and approved in the workbench.",
      feedbackContext: "Execution feedback returned from the workspace",
      feedbackTask: "Task",
      feedbackArtifact: "Artifact snapshot",
      feedbackNote: "Feedback note",
      staleImpact: "Downstream impact",
      generationStatus: "Generation status",
      reviewQueue: "Review queue",
      reviewQueueBody:
        "Move artifact by artifact, but keep draft generation and approval on one surface.",
      approvalHistory: "Approval history",
      noApprovalHistory: "No prior decisions for this artifact yet.",
      stepHintReady: "Ready to draft next",
      stepHintBlocked: "Blocked by missing upstream draft",
      stepHintDraft: "Needs approval",
      stepHintApproved: "Already approved",
      stepHintStale: "Needs refresh after upstream changes",
      draftAllProgress: "Generating draft {current} of {total}: {label}",
      statusDraftedAll: "Drafted all remaining artifacts.",
      statusSavedDraft: "Saved the current draft.",
      statusApprovedNext: "Artifact approved. Moving to the next review step.",
      statusRejected: "Artifact rejected. The draft stays editable in this screen.",
      statusGenerated: "Draft generated.",
      failedAction: "The refinement action could not be completed.",
      projectLabel: "Project",
      modeLabel: "Mode",
      sessionLabel: "Session",
    },
    taskSynthesis: {
      screenId: "SCR-004 Task Synthesis",
      title: "Review the published task candidate before it becomes the workspace source of truth.",
      description:
        "Synthesize from approved artifacts, patch canonical fields in place, and publish directly into kanban and gantt.",
      synthesisBlocked: "Task synthesis is blocked",
      synthesisBlockedBody: "These artifacts still need approval or regeneration first.",
      candidateSnapshots: "Candidate snapshots",
      generatedTasks: "Generated tasks",
      detailEditor: "Task detail",
      publishBlockers: "Publish blockers",
      workspaceHandoff: "Workspace handoff",
      synthesize: "Synthesize task plan",
      regenerate: "Regenerate from latest artifacts",
      publish: "Publish and open workspace",
      openWorkspace: "Open workspace",
      workspaceNext: "What happens next",
      workspaceNextBody:
        "Publishing hands the current snapshot to SCR-005, where the same task data appears in kanban and gantt.",
      staleBanner:
        "The published plan is stale because the approved artifact set changed. Regenerate and publish a fresh snapshot to reopen the workspace for editing.",
      loadingTasks: "Loading tasks...",
      snapshotLabel: "Candidate snapshot",
      summaryLabel: "Task plan summary",
      relatedArtifacts: "Related artifacts",
      noSelection: "Select a task to review its canonical fields.",
      readyForWorkspace: "The latest published snapshot is already available in the workspace.",
      viewWorkspace: "View kanban and gantt",
      publishSuccess: "Task plan published. Opening the workspace...",
      routeHint: "Kanban and gantt live together in SCR-005 after publish.",
    },
    workspace: {
      screenId: "SCR-005 Management Workspace",
      emptyTitle: "No published task plan is available yet",
      emptyBody:
        "Return to task synthesis, review the candidate snapshot, and publish it before using kanban or gantt.",
      openTaskSynthesis: "Open task synthesis",
      nextStep: "Next step",
      nextStepBody:
        "SCR-005 only manages published task data. Draft task plans stay in SCR-004 until you publish them.",
      staleBanner:
        "The task plan is stale. Board, gantt, and detail stay read-only until a fresh snapshot is regenerated and published.",
      projectLabel: "Project",
      publishedPlanLabel: "Published plan",
      activeViewLabel: "Active view",
      allowedActionsLabel: "Allowed actions",
      editableActions: "Update tasks and return to refinement",
      readOnlyActions: "Inspect tasks and return to refinement",
      kanban: "Kanban",
      gantt: "Gantt",
      backlog: "Backlog",
      ready: "Ready",
      inProgress: "In progress",
      blocked: "Blocked",
      done: "Done",
      editableBanner:
        "The current published task plan is editable. Any save updates board, gantt, and detail from the same task source of truth.",
      reopenRefinement: "Reopen refinement",
      taskSynthesis: "Open task synthesis",
      ganttReadonly:
        "Gantt stays read-only in the MVP. Schedule changes still come from canonical task edits in the detail drawer.",
      taskDetail: "Task detail",
      closeTaskDetail: "Close detail",
      saveTaskUpdate: "Save task update",
      returnToRefinement: "Return to refinement",
      dependencyNavigator: "Dependency tasks",
      openDependencyDetail: "Open detail",
      unresolvedDependency: "Task not found in the current plan.",
      dependenciesMustResolve: "Must resolve to task IDs in the current plan.",
      feedbackArtifact: "Select artifact",
      feedbackNote: "Feedback note",
      feedbackPlaceholder: "Describe the blocker or follow-up needed",
      openRefinementWithContext: "Open refinement with this context",
      noFeedbackRecord: "This is a navigation handoff only; no extra feedback record is stored.",
      loadFailed: "Could not load tasks for the current plan.",
    },
    common: {
      current: "current",
      stale: "stale",
      published: "published",
      none: "none",
      noData: "No data yet.",
      loading: "Working...",
      error: "Error",
      placeholder: "Placeholder",
      lastUpdated: "Last updated",
    },
    fields: {
      title: "Title",
      objective: "Objective",
      background_or_current_situation: "Background or current situation",
      scope_summary: "Scope summary",
      stakeholders: "Stakeholders",
      expected_outcome_or_deliverable: "Expected outcome or deliverable",
      constraints_or_conditions: "Constraints or conditions",
      free_form_context: "Free-form context",
      description: "Description",
      status: "Status",
      priority: "Priority",
      dueDate: "Due date",
      estimate: "Estimate",
      assignee: "Assignee",
      dependencies: "Dependencies",
    },
  },
  ja: {
    appName: "VibeTodo",
    localeLabel: "言語",
    intake: {
      screenId: "SCR-001 Intake Start",
      title: "最初の入力を、そのまま後工程の土台にする。",
      description:
        "最初に文脈をまとめて保存し、内容を失わずに refinement へつなげます。",
      editorTitle: "初期入力エディタ",
      editorDescription:
        "共通の入力骨格は固定しつつ、モード固有の項目だけを切り替えます。すでに書いた内容は保持されます。",
      modeLabel: "モード",
      stateLabel: "状態",
      draftIdLabel: "ドラフトID",
      draftIdPlaceholder: "初回保存時に採番",
      projectModeHint: "スコープ概要と関係者を表示したままにします。",
      dailyModeHint: "期待成果物 / アウトプット項目に切り替えます。",
      draftIdHint: "手動再開、または ?projectId=... 付きでこの画面を開けます。",
      draftIdInputPlaceholder: "既存ドラフトを再開",
      saveDraft: "ドラフト保存",
      resumeDraft: "ドラフト再開",
      reviewBeforeRefinement: "refinement 前に確認",
      reviewBanner:
        "確認は SCR-001 の中で完結します。構造化入力と自由文の両方を見たまま refinement に進めます。",
      structuredSummaryTitle: "構造化入力サマリー",
      structuredSummaryDescription:
        "ここに表示される値が、最初の refinement ドラフトの入力になります。",
      freeFormSummaryTitle: "自由文コンテキスト",
      freeFormSummaryDescription:
        "refinement 開始前に、全文をそのまま確認できます。",
      editBeforeStart: "編集に戻る",
      confirmAndStart: "確定して refinement 開始",
      readinessTitle: "ドラフト準備状況",
      latestApiResult: "最新 API 結果",
      composeTargets: "確認対象 API",
      composeTargetsDescription:
        "保存は POST /api/projects、再開は GET /api/projects/{projectId}/workspace-context、確定で refinement session を開始します。",
      screenStateDraft: "ドラフト編集中",
      screenStateReview: "SCR-001 内で確認中",
      reviewSummaryFields: "確認中の項目",
      visibleRequiredFields: "表示中の必須項目",
      confirmReadiness: "開始可否",
      saveReadiness: "保存可否",
      editReturn: "編集へ戻る",
      reviewAvailability: "確認画面への遷移",
      noApiRoundTrip: "まだ API の往復はありません。",
      statusReviewReady:
        "SCR-001 の中で refinement 前レビューに入りました。確定するまでこの画面のままです。",
      statusReturnedToEdit: "現在の入力内容を保持したまま編集画面に戻りました。",
      statusMissingRefinementSession:
        "初期入力の確定は完了しましたが、refinement session を開始できませんでした。",
    },
    refinement: {
      screenId: "SCR-002 Refinement Loop",
      intakeNotConfirmed: "初期入力が未確定です",
      intakeNotConfirmedBody:
        "refinement workbench に入る前に、初期入力を確定してください。",
      workbenchDescription:
        "最初に一括でドラフトを作り、その場で編集しながら、同じ画面で順番に承認を進められます。",
      approvedContext: "承認済みコンテキスト",
      approvedContextBody: "承認済み artifact は後続工程の根拠として常に参照できます。",
      draftBody: "ドラフト本文",
      previousVersion: "前バージョン",
      currentVersion: "現在バージョン",
      changes: "差分",
      noDraftYet: "この artifact にはまだドラフトがありません。",
      noDraftHint: "現在の artifact だけ生成するか、残りをまとめてドラフト化できます。",
      generateDraft: "ドラフト生成",
      regenerateDraft: "ドラフト再生成",
      draftAll: "残りを一括ドラフト化",
      saveEditedDraft: "編集内容を保存",
      approveAndNext: "承認して次へ",
      rejectDraft: "差し戻し",
      openTaskSynthesis: "task synthesis を開く",
      taskSynthesisLocked: "task synthesis はまだ開けません",
      taskSynthesisLockedBody:
        "必須 artifact をすべて承認する必要があります。下書きだけ先に一括作成することはできます。",
      taskSynthesisReady: "task synthesis に進めます",
      taskSynthesisReadyBody:
        "必須 artifact はすべて current かつ承認済みです。task synthesis を開始できます。",
      decisionReason: "判断理由",
      decisionReasonPlaceholder: "承認または差し戻しの理由を書いてください...",
      defaultDecisionReason: "workbench 上で確認し、承認しました。",
      feedbackContext: "workspace から戻された実行フィードバック",
      feedbackTask: "タスク",
      feedbackArtifact: "artifact snapshot",
      feedbackNote: "フィードバック内容",
      staleImpact: "下流への影響",
      generationStatus: "生成状態",
      reviewQueue: "レビューキュー",
      reviewQueueBody:
        "artifact ごとに判断しつつ、ドラフト作成と承認は同じ画面で連続して進めます。",
      approvalHistory: "承認履歴",
      noApprovalHistory: "この artifact にはまだ承認履歴がありません。",
      stepHintReady: "次の下書き作成が可能",
      stepHintBlocked: "上流ドラフト待ち",
      stepHintDraft: "承認待ち",
      stepHintApproved: "承認済み",
      stepHintStale: "上流変更により更新が必要",
      draftAllProgress: "{total} 件中 {current} 件目をドラフト中: {label}",
      statusDraftedAll: "残りの artifact をまとめてドラフト化しました。",
      statusSavedDraft: "現在のドラフトを保存しました。",
      statusApprovedNext: "artifact を承認し、次のレビューに移動します。",
      statusRejected: "artifact を差し戻しました。この画面でそのまま編集を続けられます。",
      statusGenerated: "ドラフトを生成しました。",
      failedAction: "refinement 操作に失敗しました。",
      projectLabel: "プロジェクト",
      modeLabel: "モード",
      sessionLabel: "セッション",
    },
    taskSynthesis: {
      screenId: "SCR-004 Task Synthesis",
      title: "task plan を公開前に確認し、そのまま workspace の正本にする。",
      description:
        "承認済み artifact から task を生成し、canonical field をその場で補正してから kanban / gantt に公開します。",
      synthesisBlocked: "task synthesis はブロックされています",
      synthesisBlockedBody: "先に承認または再生成が必要な artifact があります。",
      candidateSnapshots: "候補 snapshot",
      generatedTasks: "生成されたタスク",
      detailEditor: "タスク詳細",
      publishBlockers: "公開ブロッカー",
      workspaceHandoff: "workspace handoff",
      synthesize: "task plan を生成",
      regenerate: "最新 artifact から再生成",
      publish: "公開して workspace を開く",
      openWorkspace: "workspace を開く",
      workspaceNext: "このあとどうなるか",
      workspaceNextBody:
        "公開すると current snapshot が SCR-005 に渡され、同じ task data が kanban と gantt に表示されます。",
      staleBanner:
        "公開済み plan は stale です。承認済み artifact セットが変わったため、workspace を再編集するには再生成と再公開が必要です。",
      loadingTasks: "タスクを読み込み中...",
      snapshotLabel: "候補 snapshot",
      summaryLabel: "task plan サマリー",
      relatedArtifacts: "関連 artifact",
      noSelection: "タスクを選ぶと canonical field を編集できます。",
      readyForWorkspace: "最新の公開 snapshot はすでに workspace で利用できます。",
      viewWorkspace: "kanban / gantt を見る",
      publishSuccess: "task plan を公開しました。workspace を開きます...",
      routeHint: "kanban と gantt は公開後に SCR-005 で使えます。",
    },
    workspace: {
      screenId: "SCR-005 Management Workspace",
      emptyTitle: "公開済み task plan がまだありません",
      emptyBody:
        "task synthesis に戻り、候補 snapshot を確認して公開してから kanban / gantt を使ってください。",
      openTaskSynthesis: "task synthesis を開く",
      nextStep: "次の手順",
      nextStepBody:
        "SCR-005 が扱うのは公開済み task data のみです。ドラフトの task plan は公開されるまで SCR-004 に留まります。",
      staleBanner:
        "task plan が stale です。board / gantt / detail は、最新 snapshot を再生成して再公開するまで読み取り専用です。",
      projectLabel: "プロジェクト",
      publishedPlanLabel: "公開中 plan",
      activeViewLabel: "表示中ビュー",
      allowedActionsLabel: "可能な操作",
      editableActions: "タスク更新 + refinement へ戻る",
      readOnlyActions: "閲覧 + refinement へ戻る",
      kanban: "カンバン",
      gantt: "ガント",
      backlog: "バックログ",
      ready: "準備完了",
      inProgress: "進行中",
      blocked: "ブロック中",
      done: "完了",
      editableBanner:
        "現在の公開 task plan は編集可能です。保存すると board / gantt / detail が同じ source of truth から更新されます。",
      reopenRefinement: "refinement を開く",
      taskSynthesis: "task synthesis を開く",
      ganttReadonly:
        "MVP では gantt は読み取り専用です。日程変更は detail drawer の canonical task 編集から行います。",
      taskDetail: "タスク詳細",
      closeTaskDetail: "詳細を閉じる",
      saveTaskUpdate: "タスク更新を保存",
      returnToRefinement: "refinement に戻る",
      dependencyNavigator: "依存先タスク",
      openDependencyDetail: "詳細を開く",
      unresolvedDependency: "現在の plan に存在しないタスクです。",
      dependenciesMustResolve: "現在の plan にある task ID を指定してください。",
      feedbackArtifact: "artifact を選択",
      feedbackNote: "フィードバックメモ",
      feedbackPlaceholder: "ブロッカーや見直し点を書いてください",
      openRefinementWithContext: "この内容で refinement を開く",
      noFeedbackRecord:
        "これはナビゲーション用 handoff のみで、追加の feedback record は保存しません。",
      loadFailed: "現在の plan のタスクを読み込めませんでした。",
    },
    common: {
      current: "current",
      stale: "stale",
      published: "published",
      none: "なし",
      noData: "まだデータがありません。",
      loading: "処理中...",
      error: "エラー",
      placeholder: "仮置き",
      lastUpdated: "更新日時",
    },
    fields: {
      title: "タイトル",
      objective: "目的",
      background_or_current_situation: "背景 / 現状",
      scope_summary: "スコープ概要",
      stakeholders: "関係者",
      expected_outcome_or_deliverable: "期待成果物 / アウトプット",
      constraints_or_conditions: "制約 / 条件",
      free_form_context: "自由文コンテキスト",
      description: "説明",
      status: "状態",
      priority: "優先度",
      dueDate: "期限",
      estimate: "見積もり",
      assignee: "担当",
      dependencies: "依存関係",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
