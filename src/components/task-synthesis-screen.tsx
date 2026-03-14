"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dictionary, Locale } from "@/src/lib/i18n";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  getArtifactLabel,
} from "@/src/lib/i18n";
import type { TaskPriority, TaskStatus, TaskWithLinks } from "@/src/lib/planning/types";

interface ArtifactSummary {
  artifactKey: string;
  displayStatus: "blocked" | "ready" | "draft" | "approved" | "stale";
  currentSnapshotId: string | null;
}

interface TaskPlanEligibility {
  isEligible: boolean;
  missingOrStaleArtifacts: Array<{ artifactKey: string; state: "missing" | "stale" }>;
}

interface SnapshotSummary {
  taskPlanSnapshotId: string;
  freshnessStatus: string;
  publishStatus: string;
  generatedAt: string;
  publishBlockerCount: number;
}

interface PublishedSnapshotSummary {
  taskPlanSnapshotId: string;
  freshnessStatus: string;
  generatedAt: string;
  publishedAt: string | null;
  generatedFromArtifactSet: string[];
}

interface StaleDependencies {
  affectedSourceSnapshotIds: string[];
}

interface TaskPlanSummaryData {
  eligibility: TaskPlanEligibility;
  jobStatus: string | null;
  workspaceHandoffState: "editable" | "read_only" | "none";
  latestSnapshot: SnapshotSummary | null;
  currentPublishedSnapshot: PublishedSnapshotSummary | null;
  staleDependencies: StaleDependencies | null;
}

interface PublishBlocker {
  taskId: string;
  taskTitle: string;
  field: string;
  reason: string;
}

interface TaskSynthesisScreenProps {
  locale: Locale;
  dictionary: Dictionary;
  projectId: string;
  artifactSummaries: ArtifactSummary[];
  taskPlanSummaryData: TaskPlanSummaryData | null;
}

export function TaskSynthesisScreen({
  locale,
  dictionary: dict,
  projectId,
  artifactSummaries,
  taskPlanSummaryData,
}: TaskSynthesisScreenProps) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    taskPlanSummaryData?.latestSnapshot?.taskPlanSnapshotId ?? null,
  );
  const [allSnapshots, setAllSnapshots] = useState<SnapshotSummary[]>(
    taskPlanSummaryData?.latestSnapshot ? [taskPlanSummaryData.latestSnapshot] : [],
  );
  const [tasks, setTasks] = useState<TaskWithLinks[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [publishBlockers, setPublishBlockers] = useState<PublishBlocker[]>([]);
  const [jobStatus, setJobStatus] = useState<string | null>(
    taskPlanSummaryData?.jobStatus ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [taskPatch, setTaskPatch] = useState<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string;
    estimate: string;
    assignee: string;
    dependencies: string;
  } | null>(null);

  const selectedTask = tasks.find((task) => task.task_id === selectedTaskId) ?? null;
  const eligibility = taskPlanSummaryData?.eligibility ?? {
    isEligible: false,
    missingOrStaleArtifacts: artifactSummaries
      .filter((summary) => summary.displayStatus !== "approved")
      .map((summary) => ({
        artifactKey: summary.artifactKey,
        state: summary.displayStatus === "stale" ? ("stale" as const) : ("missing" as const),
      })),
  };
  const currentPublished = taskPlanSummaryData?.currentPublishedSnapshot ?? null;
  const isStale = currentPublished?.freshnessStatus === "stale";
  const selectedSnapshot =
    allSnapshots.find((snapshot) => snapshot.taskPlanSnapshotId === selectedSnapshotId) ?? null;
  const selectedSnapshotIsStale = selectedSnapshot?.freshnessStatus === "stale";

  const loadTasks = useCallback(async (snapshotId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/task-plans/${snapshotId}/tasks`);
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? dict.common.error);
        return;
      }
      setTasks(data.tasks ?? []);
      setPublishBlockers(data.publishBlockers ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.common.error);
    } finally {
      setIsLoading(false);
    }
  }, [dict.common.error, projectId]);

  useEffect(() => {
    if (selectedSnapshotId) {
      setSelectedTaskId(null);
      void loadTasks(selectedSnapshotId);
    }
  }, [selectedSnapshotId, loadTasks]);

  useEffect(() => {
    if (!selectedTask) {
      setTaskPatch(null);
      return;
    }
    setTaskPatch({
      title: selectedTask.title,
      description: selectedTask.description,
      priority: selectedTask.priority,
      status: selectedTask.status,
      dueDate: selectedTask.due_date ?? "",
      estimate: selectedTask.estimate ?? "",
      assignee: selectedTask.assignee ?? "",
      dependencies: (selectedTask.dependencies ?? []).join(", "),
    });
  }, [selectedTask]);

  async function handleSynthesize(trigger: "synthesize" | "regenerate") {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/task-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationTrigger: trigger }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? dict.common.error);
        return;
      }
      const result = data.taskPlanSynthesisResult;
      setJobStatus(result.jobStatus);
      if (result.jobStatus === "failed" || result.jobStatus === "retryable") {
        setErrorMessage(result.errorMessage ?? dict.common.error);
      }
      if (result.snapshot) {
        const nextSnapshot: SnapshotSummary = {
          taskPlanSnapshotId: result.snapshot.taskPlanSnapshotId,
          freshnessStatus: result.snapshot.freshnessStatus,
          publishStatus: result.snapshot.publishStatus,
          generatedAt: result.snapshot.generatedAt,
          publishBlockerCount: result.snapshot.publishBlockerCount,
        };
        setAllSnapshots((current) => {
          const filtered = current.filter(
            (snapshot) => snapshot.taskPlanSnapshotId !== nextSnapshot.taskPlanSnapshotId,
          );
          return [nextSnapshot, ...filtered];
        });
        setSelectedSnapshotId(nextSnapshot.taskPlanSnapshotId);
        setStatusMessage(
          `${dict.taskSynthesis.generatedTasks}: ${result.taskCount}`,
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.common.error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTaskCorrection() {
    if (!selectedTask || !taskPatch || !selectedSnapshotId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${selectedTask.task_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskPlanSnapshotId: selectedSnapshotId,
          taskPatch: {
            title: taskPatch.title,
            description: taskPatch.description,
            priority: taskPatch.priority,
            status: taskPatch.status,
            dueDate: taskPatch.dueDate || null,
            estimate: taskPatch.estimate || null,
            assignee: taskPatch.assignee || null,
            dependencies: taskPatch.dependencies
              ? taskPatch.dependencies
                  .split(",")
                  .map((dependency) => dependency.trim())
                  .filter(Boolean)
              : [],
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? dict.common.error);
        return;
      }
      const updatedTask = data.taskUpdateResult.task as TaskWithLinks;
      setTasks((current) =>
        current.map((task) => (task.task_id === updatedTask.task_id ? updatedTask : task)),
      );
      setSelectedTaskId(updatedTask.task_id);
      setPublishBlockers(data.taskUpdateResult.publishBlockers ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.common.error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePublish() {
    if (!selectedSnapshotId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/task-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskPlanSnapshotId: selectedSnapshotId,
          approvalDecision: "publish",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? dict.common.error);
        return;
      }
      setStatusMessage(dict.taskSynthesis.publishSuccess);
      window.location.assign(`/projects/${projectId}/workspace`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dict.common.error);
    } finally {
      setIsLoading(false);
    }
  }

  const canPublish =
    selectedSnapshotId !== null &&
    publishBlockers.length === 0 &&
    !selectedSnapshotIsStale &&
    eligibility.isEligible;

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">{dict.taskSynthesis.screenId}</span>
        <h1>{dict.taskSynthesis.title}</h1>
        <p>{dict.taskSynthesis.description}</p>
      </section>

      {isStale ? (
        <section className="journeyBanner journeyBanner--warn">
          <strong>{dict.taskSynthesis.staleBanner}</strong>
          {taskPlanSummaryData?.staleDependencies?.affectedSourceSnapshotIds?.length ? (
            <p>{taskPlanSummaryData.staleDependencies.affectedSourceSnapshotIds.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {!eligibility.isEligible ? (
        <section className="journeyBanner journeyBanner--danger">
          <strong>{dict.taskSynthesis.synthesisBlocked}</strong>
          <p>{dict.taskSynthesis.synthesisBlockedBody}</p>
          <ul className="journeyList">
            {eligibility.missingOrStaleArtifacts.map((artifact) => (
              <li key={artifact.artifactKey}>
                {getArtifactLabel(locale, artifact.artifactKey)}: {artifact.state}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="journeyLayout">
        <div className="journeyMain">
          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <div>
                <p className="journeyKicker">{dict.taskSynthesis.snapshotLabel}</p>
                <h2>{dict.taskSynthesis.candidateSnapshots}</h2>
              </div>
              <div className="journeyActions">
                <button
                  type="button"
                  className="button"
                  disabled={!eligibility.isEligible || isLoading}
                  onClick={() => handleSynthesize("synthesize")}
                >
                  {dict.taskSynthesis.synthesize}
                </button>
                {isStale ? (
                  <button
                    type="button"
                    className="buttonGhost"
                    disabled={!eligibility.isEligible || isLoading}
                    onClick={() => handleSynthesize("regenerate")}
                  >
                    {dict.taskSynthesis.regenerate}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="buttonWarm"
                  disabled={!canPublish || isLoading}
                  onClick={handlePublish}
                >
                  {dict.taskSynthesis.publish}
                </button>
              </div>
            </div>

            <div className="journeyMetaGrid">
              <label className="fieldWide">
                <span className="label">{dict.taskSynthesis.snapshotLabel}</span>
                <select
                  className="input"
                  value={selectedSnapshotId ?? ""}
                  onChange={(event) => setSelectedSnapshotId(event.target.value || null)}
                >
                  {allSnapshots.map((snapshot) => (
                    <option key={snapshot.taskPlanSnapshotId} value={snapshot.taskPlanSnapshotId}>
                      {snapshot.taskPlanSnapshotId.slice(0, 8)} · {snapshot.freshnessStatus} · {snapshot.publishStatus}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="journeyTableWrapper">
              <table className="journeyTable">
                <thead>
                  <tr>
                    <th>{dict.fields.title}</th>
                    <th>{dict.fields.priority}</th>
                    <th>{dict.fields.status}</th>
                    <th>{dict.fields.dueDate}</th>
                    <th>{dict.fields.assignee}</th>
                    <th>{dict.taskSynthesis.relatedArtifacts}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.task_id}
                      className={selectedTaskId === task.task_id ? "journeyTableRow--active" : ""}
                      onClick={() => setSelectedTaskId(task.task_id)}
                    >
                      <td>{task.title}</td>
                      <td>{TASK_PRIORITY_LABELS[locale][task.priority]}</td>
                      <td>{TASK_STATUS_LABELS[locale][task.status]}</td>
                      <td>{task.due_date ?? "-"}</td>
                      <td>{task.assignee ?? "-"}</td>
                      <td>{task.relatedArtifacts.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="journeySide">
          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.taskSynthesis.detailEditor}</h3>
            </div>
            {selectedTask && taskPatch ? (
              <div className="journeyForm">
                <label className="fieldWide">
                  <span className="label">{dict.fields.title}</span>
                  <input
                    className="input"
                    value={taskPatch.title}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, title: event.target.value })
                    }
                  />
                </label>
                <label className="fieldWide">
                  <span className="label">{dict.fields.description}</span>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={taskPatch.description}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, description: event.target.value })
                    }
                  />
                </label>
                <div className="journeyMetaGrid">
                  <label className="field">
                    <span className="label">{dict.fields.priority}</span>
                    <select
                      className="input"
                      value={taskPatch.priority}
                      onChange={(event) =>
                        setTaskPatch((current) =>
                          current ? { ...current, priority: event.target.value as TaskPriority } : current,
                        )
                      }
                    >
                      <option value="high">{TASK_PRIORITY_LABELS[locale].high}</option>
                      <option value="medium">{TASK_PRIORITY_LABELS[locale].medium}</option>
                      <option value="low">{TASK_PRIORITY_LABELS[locale].low}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">{dict.fields.status}</span>
                    <select
                      className="input"
                      value={taskPatch.status}
                      onChange={(event) =>
                        setTaskPatch((current) =>
                          current ? { ...current, status: event.target.value as TaskStatus } : current,
                        )
                      }
                    >
                      {Object.entries(TASK_STATUS_LABELS[locale]).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="fieldWide">
                  <span className="label">{dict.fields.dueDate}</span>
                  <input
                    className="input"
                    type="date"
                    value={taskPatch.dueDate}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, dueDate: event.target.value })
                    }
                  />
                </label>
                <label className="fieldWide">
                  <span className="label">{dict.fields.estimate}</span>
                  <input
                    className="input"
                    value={taskPatch.estimate}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, estimate: event.target.value })
                    }
                  />
                </label>
                <label className="fieldWide">
                  <span className="label">{dict.fields.assignee}</span>
                  <input
                    className="input"
                    value={taskPatch.assignee}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, assignee: event.target.value })
                    }
                  />
                </label>
                <label className="fieldWide">
                  <span className="label">{dict.fields.dependencies}</span>
                  <input
                    className="input"
                    value={taskPatch.dependencies}
                    onChange={(event) =>
                      setTaskPatch((current) => current && { ...current, dependencies: event.target.value })
                    }
                  />
                </label>
                <button type="button" className="buttonGhost" onClick={handleSaveTaskCorrection}>
                  {dict.workspace.saveTaskUpdate}
                </button>
              </div>
            ) : (
              <p className="subtle">{dict.taskSynthesis.noSelection}</p>
            )}
          </section>

          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.taskSynthesis.publishBlockers}</h3>
            </div>
            {publishBlockers.length > 0 ? (
              <ul className="journeyList">
                {publishBlockers.map((blocker, index) => (
                  <li key={`${blocker.taskId}-${index}`}>
                    {blocker.taskTitle}: {blocker.field} / {blocker.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle">{dict.taskSynthesis.routeHint}</p>
            )}
          </section>

          <section className="journeyPanel">
            <div className="journeySectionHeader">
              <h3>{dict.taskSynthesis.workspaceNext}</h3>
            </div>
            <p className="subtle">{dict.taskSynthesis.workspaceNextBody}</p>
            <a href={`/projects/${projectId}/workspace`} className="journeyCta">
              {dict.taskSynthesis.openWorkspace}
            </a>
            {currentPublished ? (
              <p className="subtle">{dict.taskSynthesis.readyForWorkspace}</p>
            ) : null}
          </section>

          {statusMessage ? <p className="note">{statusMessage}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
          {isLoading ? <p className="subtle">{dict.taskSynthesis.loadingTasks}</p> : null}
          {jobStatus ? <p className="subtle">Job: {jobStatus}</p> : null}
        </aside>
      </section>
    </main>
  );
}
