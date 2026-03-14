"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Dictionary,
  type Locale,
} from "@/src/lib/i18n";
import type { TaskPriority, TaskStatus, TaskWithLinks } from "@/src/lib/planning/types";
import {
  groupTasksByStatus,
  isWorkspaceEditable,
  computeWorkspaceSummary,
  buildFeedbackHandoffUrl,
  computeGanttRows,
  KANBAN_COLUMNS,
  parseDependencyInput,
  resolveTaskDependencies,
} from "@/src/lib/workspace/model";

// ── Types ──────────────────────────────────────────────────────────────────

interface PublishedSnapshotSummary {
  taskPlanSnapshotId: string;
  freshnessStatus: string;
  generatedAt: string;
  publishedAt: string | null;
  generatedFromArtifactSet: string[];
}

interface TaskPlanSummaryData {
  workspaceHandoffState: "editable" | "read_only" | "none";
  currentPublishedSnapshot: PublishedSnapshotSummary | null;
  staleDependencies: { affectedSourceSnapshotIds: string[] } | null;
}

interface ManagementWorkspaceProps {
  locale: Locale;
  dictionary: Dictionary;
  projectId: string;
  projectTitle: string;
  taskPlanSummaryData: TaskPlanSummaryData | null;
}

type ViewMode = "kanban" | "gantt";

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ locale, status }: { locale: Locale; status: TaskStatus }) {
  const cls =
    status === "blocked"
      ? "mw-badge mw-badge-blocked"
      : status === "done"
        ? "mw-badge mw-badge-done"
        : status === "in_progress"
          ? "mw-badge mw-badge-progress"
          : "mw-badge mw-badge-ready";
  return <span className={cls}>{TASK_STATUS_LABELS[locale][status]}</span>;
}

function PriorityBadge({ locale, priority }: { locale: Locale; priority: TaskPriority }) {
  return (
    <span className="mw-badge mw-badge-ready" style={{ fontSize: "0.7rem" }}>
      {TASK_PRIORITY_LABELS[locale][priority]}
    </span>
  );
}

function KanbanBoard({
  locale,
  dictionary,
  tasks,
  isReadOnly,
  onSelectTask,
}: {
  locale: Locale;
  dictionary: Dictionary;
  tasks: TaskWithLinks[];
  isReadOnly: boolean;
  onSelectTask: (task: TaskWithLinks) => void;
}) {
  const grouped = groupTasksByStatus(tasks);

  return (
    <div className="mw-board" data-testid="kanban-board">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = grouped.get(col) ?? [];
        return (
          <section key={col} className="mw-board-column" data-testid={`kanban-column-${col}`}>
            <div className="mw-column-header">
              <strong>{TASK_STATUS_LABELS[locale][col]}</strong>
              <span className="mw-column-count">{colTasks.length}</span>
            </div>
            {colTasks.map((task) => (
              <article
                key={task.task_id}
                className="mw-task-card"
                style={{ cursor: isReadOnly ? "default" : "pointer" }}
                onClick={() => !isReadOnly && onSelectTask(task)}
                data-testid={`task-card-${task.task_id}`}
              >
                <p className="mw-task-title">{task.title}</p>
                <p className="mw-task-meta">
                  {task.due_date ? `${dictionary.fields.dueDate} ${task.due_date}.` : ""}
                  {task.assignee ? ` ${task.assignee}.` : ""}
                  {task.dependencies.length > 0
                    ? ` ${task.dependencies.length} deps.`
                    : ""}
                </p>
                <div className="mw-task-badges">
                  <PriorityBadge locale={locale} priority={task.priority} />
                  {task.relatedArtifacts.length > 0 && (
                    <span className="mw-badge mw-badge-ready" style={{ fontSize: "0.7rem" }}>
                      {dictionary.taskSynthesis.relatedArtifacts}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function GanttChart({
  locale,
  dictionary,
  tasks,
  onSelectTask,
}: {
  locale: Locale;
  dictionary: Dictionary;
  tasks: TaskWithLinks[];
  onSelectTask: (task: TaskWithLinks) => void;
}) {
  const rows = computeGanttRows(tasks);

  return (
    <div data-testid="gantt-chart">
      <div className="mw-banner mw-banner-warn">
        {dictionary.workspace.ganttReadonly}
      </div>
      <div className="mw-timeline" style={{ marginTop: "12px" }}>
        <div className="mw-timeline-header">
          <span>{dictionary.workspace.taskDetail}</span>
          <span>{dictionary.fields.dueDate}</span>
          <span>{dictionary.fields.status}</span>
        </div>
        {rows.map((row) => {
          const task = tasks.find((t) => t.task_id === row.taskId);
          const isBlocked = row.status === "blocked";
          return (
            <div
              key={row.taskId}
              className="mw-timeline-row"
              style={{ cursor: "pointer" }}
              onClick={() => task && onSelectTask(task)}
              data-testid={`gantt-row-${row.taskId}`}
            >
              <strong style={{ fontSize: "0.9rem" }}>{row.title}</strong>
              <div className="mw-timeline-track">
                <div
                  className={`mw-timeline-bar${isBlocked ? " mw-timeline-bar-blocked" : ""}`}
                  style={{
                    left: `${row.barLeft}%`,
                    width: `${row.barWidth}%`,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <StatusBadge locale={locale} status={row.status} />
                {row.dueDate && (
                  <span style={{ fontSize: "0.75rem", color: "var(--mw-muted)" }}>
                    {row.dueDate}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="mw-copy">{dictionary.common.noData}</p>
        )}
      </div>
    </div>
  );
}

interface TaskDetailDrawerProps {
  locale: Locale;
  dictionary: Dictionary;
  task: TaskWithLinks;
  snapshotId: string;
  projectId: string;
  isReadOnly: boolean;
  allTasks: TaskWithLinks[];
  onClose: () => void;
  onSelectTask: (task: TaskWithLinks) => void;
  onSaved: (updatedTask: TaskWithLinks) => void;
}

function createTaskPatch(task: TaskWithLinks) {
  return {
    status: task.status,
    description: task.description,
    priority: task.priority,
    dueDate: task.due_date ?? "",
    dependencies: task.dependencies.join(", "),
    estimate: task.estimate ?? "",
    assignee: task.assignee ?? "",
  };
}

function TaskDetailDrawer({
  locale,
  dictionary,
  task,
  snapshotId,
  projectId,
  isReadOnly,
  allTasks,
  onClose,
  onSelectTask,
  onSaved,
}: TaskDetailDrawerProps) {
  const [patch, setPatch] = useState(() => createTaskPatch(task));
  const [selectedArtifactId, setSelectedArtifactId] = useState(
    task.relatedArtifacts[0]?.artifact_snapshot_id ?? "",
  );
  const [feedbackNote, setFeedbackNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);

  useEffect(() => {
    setPatch(createTaskPatch(task));
    setSelectedArtifactId(task.relatedArtifacts[0]?.artifact_snapshot_id ?? "");
    setFeedbackNote("");
    setIsSaving(false);
    setErrorMessage("");
    setShowFeedbackPanel(false);
  }, [task]);

  const dependencyIds = isReadOnly ? task.dependencies : parseDependencyInput(patch.dependencies);
  const resolvedDependencies = resolveTaskDependencies(dependencyIds, allTasks);

  const handleSave = async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.task_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskPlanSnapshotId: snapshotId,
          taskPatch: {
            status: patch.status,
            description: patch.description,
            priority: patch.priority,
            dueDate: patch.dueDate || null,
            estimate: patch.estimate || null,
            assignee: patch.assignee || null,
            dependencies: parseDependencyInput(patch.dependencies),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? dictionary.common.error);
        return;
      }
      onSaved(data.taskUpdateResult.task);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : dictionary.common.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnToRefinement = () => {
    if (!selectedArtifactId || !feedbackNote.trim()) return;
    const url = buildFeedbackHandoffUrl({
      projectId,
      taskId: task.task_id,
      artifactSnapshotId: selectedArtifactId,
      feedbackNote: feedbackNote.trim(),
    });
    window.location.href = url;
  };

  return (
    <div
      data-testid="task-detail-drawer"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "420px",
        background: "var(--mw-surface, #fffdf8)",
        borderLeft: "1px solid var(--mw-border, #d8ceb8)",
        boxShadow: "-8px 0 32px rgba(21,32,43,0.12)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div className="mw-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="mw-section-label">{dictionary.workspace.taskDetail}</p>
            <h2 className="mw-section-title" style={{ marginTop: "4px" }}>{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={dictionary.workspace.closeTaskDetail}
            className="mw-button mw-button-secondary"
            data-testid="close-drawer-button"
            style={{ marginTop: 0 }}
          >
            {dictionary.workspace.closeTaskDetail}
          </button>
        </div>
        {isReadOnly && (
          <div className="mw-banner mw-banner-danger" style={{ marginTop: "8px" }}>
            {dictionary.workspace.staleBanner}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mw-detail-list" style={{ padding: "16px", overflowY: "auto" }}>
        {/* Status */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.status}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.status}</p>
          ) : (
            <select
              data-testid="drawer-status-select"
              value={patch.status}
              onChange={(e) => setPatch((p) => ({ ...p, status: e.target.value as TaskStatus }))}
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)" }}
            >
              {KANBAN_COLUMNS.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[locale][s]}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Description */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.description}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.description}</p>
          ) : (
            <textarea
              data-testid="drawer-description-input"
              value={patch.description}
              onChange={(e) => setPatch((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              style={{
                padding: "6px",
                borderRadius: "8px",
                border: "1px solid var(--mw-border)",
                width: "100%",
                resize: "vertical",
              }}
            />
          )}
        </div>

        {/* Priority */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.priority}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.priority}</p>
          ) : (
            <select
              data-testid="drawer-priority-select"
              value={patch.priority}
              onChange={(e) => setPatch((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)" }}
            >
              <option value="high">{TASK_PRIORITY_LABELS[locale].high}</option>
              <option value="medium">{TASK_PRIORITY_LABELS[locale].medium}</option>
              <option value="low">{TASK_PRIORITY_LABELS[locale].low}</option>
            </select>
          )}
        </div>

        {/* Due date */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.dueDate}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.due_date ?? "—"}</p>
          ) : (
            <input
              data-testid="drawer-due-date-input"
              type="date"
              value={patch.dueDate}
              onChange={(e) => setPatch((p) => ({ ...p, dueDate: e.target.value }))}
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)" }}
            />
          )}
        </div>

        {/* Estimate */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.estimate}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.estimate ?? "—"}</p>
          ) : (
            <input
              data-testid="drawer-estimate-input"
              type="text"
              value={patch.estimate}
              onChange={(e) => setPatch((p) => ({ ...p, estimate: e.target.value }))}
              placeholder="e.g. 2h, 3d"
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)", width: "100%" }}
            />
          )}
        </div>

        {/* Assignee */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.assignee}</span>
          {isReadOnly ? (
            <p className="mw-field-value">{task.assignee ?? "—"}</p>
          ) : (
            <input
              data-testid="drawer-assignee-input"
              type="text"
              value={patch.assignee}
              onChange={(e) => setPatch((p) => ({ ...p, assignee: e.target.value }))}
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)", width: "100%" }}
            />
          )}
        </div>

        {/* Dependencies */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.fields.dependencies}</span>
          {isReadOnly ? (
            <p className="mw-field-value">
              {task.dependencies.length > 0 ? task.dependencies.join(", ") : dictionary.common.none}
            </p>
          ) : (
            <input
              data-testid="drawer-dependencies-input"
              type="text"
              value={patch.dependencies}
              onChange={(e) => setPatch((p) => ({ ...p, dependencies: e.target.value }))}
              placeholder="task-id-1, task-id-2"
              style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)", width: "100%" }}
            />
          )}
          {allTasks.length > 0 && !isReadOnly && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--mw-muted)" }}>
              {dictionary.workspace.dependenciesMustResolve}
            </p>
          )}
          {resolvedDependencies.length > 0 && (
            <div
              className="mw-note"
              data-testid="dependency-list"
              style={{ gap: "10px", padding: "12px", marginTop: "4px" }}
            >
              <p className="mw-section-label" style={{ margin: 0 }}>
                {dictionary.workspace.dependencyNavigator}
              </p>
              {resolvedDependencies.map((dependency) => (
                <div
                  key={dependency.taskId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: "2px" }}>
                    <strong style={{ fontSize: "0.92rem" }}>{dependency.title}</strong>
                    <span style={{ fontSize: "0.78rem", color: "var(--mw-muted)" }}>
                      {dependency.taskId}
                    </span>
                    {!dependency.task && (
                      <span style={{ fontSize: "0.78rem", color: "var(--mw-rust)" }}>
                        {dictionary.workspace.unresolvedDependency}
                      </span>
                    )}
                  </div>
                  {dependency.task && dependency.task.task_id !== task.task_id && (
                    <button
                      type="button"
                      className="mw-button mw-button-secondary"
                      data-testid={`dependency-detail-button-${dependency.taskId}`}
                      onClick={() => onSelectTask(dependency.task!)}
                    >
                      {dictionary.workspace.openDependencyDetail}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related artifacts — always visible, never stripped */}
        <div className="mw-detail-row">
          <span className="mw-field-label">{dictionary.taskSynthesis.relatedArtifacts}</span>
          <ul data-testid="related-artifacts" style={{ margin: 0, padding: "0 0 0 16px" }}>
            {task.relatedArtifacts.map((link) => (
              <li key={link.artifact_snapshot_id} style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                {link.artifact_snapshot_id}
                <span style={{ color: "var(--mw-muted)", marginLeft: "4px" }}>
                  ({link.relation_type})
                </span>
              </li>
            ))}
            {task.relatedArtifacts.length === 0 && (
              <li style={{ color: "var(--mw-rust)" }}>{dictionary.common.noData}</li>
            )}
          </ul>
        </div>

        {errorMessage && (
          <div className="mw-banner mw-banner-danger" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Feedback panel — REQ-005 */}
        {showFeedbackPanel && (
          <div className="mw-note" style={{ marginTop: "8px" }}>
            <p className="mw-section-label">{dictionary.workspace.returnToRefinement}</p>
            <div style={{ display: "grid", gap: "8px" }}>
              <label>
                <span className="mw-field-label">{dictionary.workspace.feedbackArtifact}</span>
                <select
                  data-testid="feedback-artifact-select"
                  value={selectedArtifactId}
                  onChange={(e) => setSelectedArtifactId(e.target.value)}
                  style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--mw-border)", width: "100%" }}
                >
                  {task.relatedArtifacts.map((link) => (
                    <option key={link.artifact_snapshot_id} value={link.artifact_snapshot_id}>
                      {link.artifact_snapshot_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mw-field-label">{dictionary.workspace.feedbackNote}</span>
                <textarea
                  data-testid="feedback-note-input"
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  rows={2}
                  placeholder={dictionary.workspace.feedbackPlaceholder}
                  style={{
                    padding: "6px",
                    borderRadius: "8px",
                    border: "1px solid var(--mw-border)",
                    width: "100%",
                    resize: "vertical",
                  }}
                />
              </label>
              <button
                data-testid="confirm-feedback-button"
                onClick={handleReturnToRefinement}
                disabled={!selectedArtifactId || !feedbackNote.trim()}
                className="mw-button mw-button-secondary"
                style={{ width: "100%" }}
              >
                {dictionary.workspace.openRefinementWithContext}
              </button>
              <p className="mw-note-copy" style={{ margin: 0, fontSize: "0.78rem" }}>
                {dictionary.workspace.noFeedbackRecord}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="mw-action-row"
        style={{
          padding: "16px",
          borderTop: "1px solid var(--mw-border)",
          background: "var(--mw-panel)",
        }}
      >
        <button
          data-testid="save-task-button"
          onClick={handleSave}
          disabled={isReadOnly || isSaving}
          className="mw-button mw-button-primary"
          style={{ flex: 1 }}
        >
          {isSaving ? dictionary.common.loading : dictionary.workspace.saveTaskUpdate}
        </button>
        <button
          data-testid="return-to-refinement-button"
          onClick={() => setShowFeedbackPanel((v) => !v)}
          className="mw-button mw-button-ghost"
        >
          {dictionary.workspace.returnToRefinement}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ManagementWorkspace({
  locale,
  dictionary,
  projectId,
  projectTitle,
  taskPlanSummaryData,
}: ManagementWorkspaceProps) {
  const [view, setView] = useState<ViewMode>("kanban");
  const [tasks, setTasks] = useState<TaskWithLinks[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskWithLinks | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const workspaceHandoffState = taskPlanSummaryData?.workspaceHandoffState ?? "none";
  const currentSnapshot = taskPlanSummaryData?.currentPublishedSnapshot ?? null;
  const snapshotId = currentSnapshot?.taskPlanSnapshotId ?? null;
  const isEditable = isWorkspaceEditable(workspaceHandoffState);
  const isStale = workspaceHandoffState === "read_only";
  const hasPublishedPlan = workspaceHandoffState !== "none";

  const loadTasks = useCallback(async () => {
    if (!snapshotId) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/task-plans/${snapshotId}/tasks`,
      );
      if (!res.ok) {
        setLoadError(dictionary.workspace.loadFailed);
        return;
      }
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      setLoadError(dictionary.workspace.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [dictionary.workspace.loadFailed, projectId, snapshotId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleTaskSaved = useCallback(
    async (updatedTask: TaskWithLinks) => {
      setTasks((prev) =>
        prev.map((t) => (t.task_id === updatedTask.task_id ? updatedTask : t)),
      );
      setSelectedTask(updatedTask);
      // Refresh all views from server to keep kanban, gantt, and detail in sync
      await loadTasks();
    },
    [loadTasks],
  );

  const summary = computeWorkspaceSummary(tasks);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    const refreshedTask = tasks.find((task) => task.task_id === selectedTask.task_id) ?? null;
    if (!refreshedTask) {
      setSelectedTask(null);
      return;
    }

    if (refreshedTask !== selectedTask) {
      setSelectedTask(refreshedTask);
    }
  }, [tasks, selectedTask]);

  // ── EMPTY STATE ────────────────────────────────────────────────────────
  if (!hasPublishedPlan) {
    return (
      <div className="mw-storybook-frame" data-testid="workspace-empty-state">
        <div className="mw-shell">
          <div className="mw-card mw-main">
            <div className="mw-kicker">
              <span className="mw-kicker-state mw-kicker-state-warn">{dictionary.workspace.nextStep}</span>
              <p className="mw-kicker-copy">{dictionary.workspace.screenId}</p>
            </div>
            <div className="mw-empty">
              <p className="mw-section-label">{projectTitle}</p>
              <h2 className="mw-section-title">
                {dictionary.workspace.emptyTitle}
              </h2>
              <p className="mw-copy">
                {dictionary.workspace.emptyBody}
              </p>
              <div className="mw-action-row" style={{ marginTop: "8px" }}>
                <a
                  href={`/projects/${projectId}/task-synthesis`}
                  className="mw-button mw-button-primary"
                  data-testid="open-task-synthesis-link"
                >
                  {dictionary.workspace.openTaskSynthesis}
                </a>
              </div>
            </div>
            <div className="mw-banner mw-banner-warn">
              {dictionary.workspace.nextStepBody}
            </div>
          </div>
          <div className="mw-card mw-side">
            <p className="mw-section-label">{dictionary.workspace.nextStep}</p>
            <h2 className="mw-section-title">{dictionary.workspace.openTaskSynthesis}</h2>
            <div className="mw-note">
              <p className="mw-note-copy">
                {dictionary.workspace.emptyBody}
              </p>
            </div>
            <div className="mw-link-card">
              <strong>Boundary preserved</strong>
              <p className="mw-note-copy">
                SCR-005 never promotes draft task data to current. Publish remains a
                distinct user decision in task synthesis.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mw-storybook-frame" data-testid="management-workspace">
      {/* Stale banner — TASK-005 / SCR-005-READONLY */}
      {isStale && (
        <div
          className="mw-banner mw-banner-danger"
          role="alert"
          data-testid="stale-banner"
          style={{ marginBottom: "16px" }}
        >
          <strong>{dictionary.workspace.staleBanner}</strong>
          {taskPlanSummaryData?.staleDependencies?.affectedSourceSnapshotIds?.length ? (
            <div style={{ marginTop: "6px", fontSize: "0.88rem" }}>
              Affected source snapshots:{" "}
              {taskPlanSummaryData.staleDependencies.affectedSourceSnapshotIds.join(", ")}
            </div>
          ) : null}
        </div>
      )}

      {/* Header — FLD-001 workspace_header_summary */}
      <div className="mw-strip" style={{ marginBottom: "16px" }} data-testid="workspace-header">
        <div className="mw-chip">
          <strong>{dictionary.workspace.projectLabel}</strong>
          {projectId}
        </div>
        {snapshotId && (
          <div className="mw-chip">
            <strong>{dictionary.workspace.publishedPlanLabel}</strong>
            {snapshotId.slice(0, 8)}…
            {" "}
            <span style={{ color: isStale ? "var(--mw-rust)" : "var(--mw-success)" }}>
              {isStale ? "stale" : "current"}
            </span>
          </div>
        )}
        <div className="mw-chip">
          <strong>{dictionary.workspace.activeViewLabel}</strong>
          {view === "kanban" ? dictionary.workspace.kanban : dictionary.workspace.gantt}
        </div>
        <div className="mw-chip">
          <strong>{dictionary.workspace.allowedActionsLabel}</strong>
          {isEditable ? dictionary.workspace.editableActions : dictionary.workspace.readOnlyActions}
        </div>
      </div>

      {/* View switcher — FLD-002 management_view_switcher */}
      <div
        style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
        data-testid="view-switcher"
      >
        <button
          className={`mw-button ${view === "kanban" ? "mw-button-primary" : "mw-button-secondary"}`}
          onClick={() => setView("kanban")}
          data-testid="view-kanban-button"
        >
          {dictionary.workspace.kanban}
        </button>
        <button
          className={`mw-button ${view === "gantt" ? "mw-button-primary" : "mw-button-secondary"}`}
          onClick={() => setView("gantt")}
          data-testid="view-gantt-button"
        >
          {dictionary.workspace.gantt}
        </button>
      </div>

      {/* Summary pulse — header counts derived from same task data */}
      <div className="mw-stat-grid" style={{ marginBottom: "16px" }} data-testid="workspace-summary">
        <article className="mw-stat-card">
          <span className="mw-field-label">{dictionary.workspace.backlog}</span>
          <strong>{summary.backlog}</strong>
        </article>
        <article className="mw-stat-card">
          <span className="mw-field-label">{dictionary.workspace.ready}</span>
          <strong>{summary.ready}</strong>
        </article>
        <article className="mw-stat-card">
          <span className="mw-field-label">{dictionary.workspace.inProgress}</span>
          <strong>{summary.inProgress}</strong>
        </article>
        <article className="mw-stat-card">
          <span className="mw-field-label">{dictionary.workspace.blocked}</span>
          <strong>{summary.blocked}</strong>
        </article>
      </div>

      {/* Loading / error */}
      {isLoading && (
        <p className="mw-copy" style={{ marginBottom: "12px" }}>
          {dictionary.common.loading}
        </p>
      )}
      {loadError && (
        <div className="mw-banner mw-banner-danger" role="alert">
          {loadError}
        </div>
      )}

      {/* Current plan banner */}
      {isEditable && !isLoading && (
        <div className="mw-banner mw-banner-success" style={{ marginBottom: "16px" }}>
          {dictionary.workspace.editableBanner}
        </div>
      )}

      {/* Main views */}
      {!isLoading && tasks.length > 0 && (
        <>
          {view === "kanban" && (
            <KanbanBoard
              locale={locale}
              dictionary={dictionary}
              tasks={tasks}
              isReadOnly={!isEditable}
              onSelectTask={setSelectedTask}
            />
          )}
          {view === "gantt" && (
            <GanttChart locale={locale} dictionary={dictionary} tasks={tasks} onSelectTask={setSelectedTask} />
          )}
        </>
      )}

      {/* Stale read-only action — SCR-005-READONLY reopen-refinement-action */}
      {isStale && (
        <div
          className="mw-action-row"
          style={{ marginTop: "16px" }}
          data-testid="stale-actions"
        >
          <a
            href={`/projects/${projectId}/refinement`}
            className="mw-button mw-button-primary"
            data-testid="reopen-refinement-link"
          >
            {dictionary.workspace.reopenRefinement}
          </a>
          <a
            href={`/projects/${projectId}/task-synthesis`}
            className="mw-button mw-button-secondary"
            data-testid="open-task-synthesis-link"
          >
            {dictionary.workspace.taskSynthesis}
          </a>
        </div>
      )}

      {/* Task detail drawer — SCR-005-DETAIL */}
      {selectedTask && snapshotId && (
        <TaskDetailDrawer
          locale={locale}
          dictionary={dictionary}
          task={selectedTask}
          snapshotId={snapshotId}
          projectId={projectId}
          isReadOnly={!isEditable}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
          onSaved={handleTaskSaved}
        />
      )}
    </div>
  );
}
