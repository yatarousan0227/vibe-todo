"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary, Locale } from "@/src/lib/i18n";
import { sanitizeIntakePayload } from "@/src/lib/intake/model";
import {
  getDraftEditorFieldDefinitions,
  type DraftEditorFieldName,
} from "@/src/lib/intake/editor-fields";
import type {
  PlanningMode,
  StructuredInput,
  WorkspaceContext,
} from "@/src/lib/intake/types";
import {
  buildEditorStateFromWorkspaceContext,
  buildRefinementPath,
  getIntakeActionAvailability,
  getReviewStructuredSummaryItems,
  type ScreenState,
} from "@/src/lib/intake/ui-state";

const initialStructuredInput: StructuredInput = {
  title: "",
  objective: "",
  background_or_current_situation: "",
  scope_summary: "",
  stakeholders: "",
  expected_outcome_or_deliverable: "",
  constraints_or_conditions: "",
};

function getPlanningModeTitle(locale: Locale, planningMode: PlanningMode) {
  return planningMode === "project"
    ? locale === "ja"
      ? "プロジェクト計画"
      : "Project planning"
    : locale === "ja"
      ? "日次業務計画"
      : "Daily work planning";
}

export function IntakeApp(props: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { locale, dictionary: dict } = props;
  const autoResumeAttemptedRef = useRef(false);
  const [planningMode, setPlanningMode] = useState<PlanningMode>("project");
  const [projectId, setProjectId] = useState("");
  const [structuredInput, setStructuredInput] =
    useState<StructuredInput>(initialStructuredInput);
  const [freeFormBody, setFreeFormBody] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("draft");
  const [statusMessage, setStatusMessage] = useState<string>(
    dict.intake.composeTargetsDescription,
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const payload = sanitizeIntakePayload({
    planning_mode: planningMode,
    structured_input: structuredInput,
    free_form_input: {
      body: freeFormBody,
    },
  });

  const { canSaveDraft, canReview, canConfirm } = getIntakeActionAvailability({
    lifecycleStatus: workspaceContext?.project.lifecycleStatus ?? "draft_intake",
    payload,
  });
  const fieldDefinitions = getDraftEditorFieldDefinitions(planningMode);
  const labelForField = (fieldName: DraftEditorFieldName) =>
    dict.fields[fieldName as keyof typeof dict.fields] ?? fieldName;

  const reviewSummaryItems = getReviewStructuredSummaryItems({
    planningMode,
    structuredInput,
  }).map((item, index) => ({
    ...item,
    label: labelForField(fieldDefinitions[index]?.name ?? "title"),
  }));

  async function runRequest(requestFactory: () => Promise<Response>) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await requestFactory();
      const data = (await response.json()) as WorkspaceContext | { error: string };

      if (!response.ok) {
        setErrorMessage("error" in data ? data.error : `${dict.common.error}.`);
        return null;
      }

      const nextContext = data as WorkspaceContext;
      const nextEditorState = buildEditorStateFromWorkspaceContext(nextContext);
      setWorkspaceContext(nextContext);
      setProjectId(nextEditorState.projectId);
      setPlanningMode(nextEditorState.planningMode);
      setStructuredInput(nextEditorState.structuredInput);
      setFreeFormBody(nextEditorState.freeFormBody);
      return nextContext;
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDraftById(
    nextProjectId: string,
    source: "auto" | "manual",
  ) {
    const trimmedProjectId = nextProjectId.trim();

    if (!trimmedProjectId) {
      setErrorMessage(`${dict.intake.draftIdLabel} is required.`);
      return;
    }

    const result = await runRequest(() =>
      fetch(`/api/projects/${trimmedProjectId}/workspace-context`),
    );

    if (result) {
      setScreenState("draft");
      setStatusMessage(
        source === "auto"
          ? `${dict.intake.resumeDraft}: ${result.project.projectId}`
          : `${dict.intake.resumeDraft}: ${result.project.projectId}`,
      );
    }
  }

  useEffect(() => {
    if (autoResumeAttemptedRef.current) {
      return;
    }

    autoResumeAttemptedRef.current = true;
    const resumeProjectId = new URLSearchParams(window.location.search)
      .get("projectId")
      ?.trim();

    if (!resumeProjectId) {
      return;
    }

    setProjectId(resumeProjectId);
    void loadDraftById(resumeProjectId, "auto");
  }, []);

  async function saveDraft() {
    const result = await runRequest(() =>
      fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectId || undefined,
          generationTrigger: "draft_save",
          project: {
            planning_mode: planningMode,
            structuredInput,
            freeFormInput: {
              body: freeFormBody,
            },
          },
        }),
      }),
    );

    if (result) {
      setScreenState("draft");
      setStatusMessage(`${dict.intake.saveDraft}: ${result.project.lifecycleStatus}`);
    }
  }

  async function loadDraft() {
    await loadDraftById(projectId, "manual");
  }

  function updateStructuredInput(fieldName: keyof StructuredInput, value: string) {
    setStructuredInput((current) => ({
      ...current,
      [fieldName]: value,
    }));
    setScreenState("draft");
  }

  function updatePlanningMode(nextPlanningMode: PlanningMode) {
    setPlanningMode(nextPlanningMode);
    setScreenState("draft");
  }

  function updateFreeFormBody(value: string) {
    setFreeFormBody(value);
    setScreenState("draft");
  }

  function updateFieldValue(fieldName: DraftEditorFieldName, value: string) {
    if (fieldName === "free_form_context") {
      updateFreeFormBody(value);
      return;
    }

    updateStructuredInput(fieldName, value);
  }

  function getFieldValue(fieldName: DraftEditorFieldName) {
    if (fieldName === "free_form_context") {
      return freeFormBody;
    }

    return structuredInput[fieldName];
  }

  function enterReviewState() {
    setScreenState("review");
    setStatusMessage(dict.intake.statusReviewReady);
  }

  function returnToEditing() {
    setScreenState("draft");
    setStatusMessage(dict.intake.statusReturnedToEdit);
  }

  async function confirmAndStart() {
    const result = await runRequest(() =>
      fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectId || undefined,
          generationTrigger: "intake_confirm",
          project: {
            planning_mode: planningMode,
            structuredInput,
            freeFormInput: {
              body: freeFormBody,
            },
          },
        }),
      }),
    );

    if (!result) {
      return;
    }

    if (!result.refinementSession) {
      setErrorMessage(dict.intake.statusMissingRefinementSession);
      return;
    }

    window.location.assign(
      buildRefinementPath({
        projectId: result.project.projectId,
        activeArtifactKey: result.refinementSession.active_artifact_key,
      }),
    );
  }

  const requiredFieldLabels = fieldDefinitions.map((field) => labelForField(field.name)).join(", ");
  const reviewSummaryLabels = reviewSummaryItems.map((item) => item.label).join(", ");

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">{dict.intake.screenId}</span>
        <h1>{dict.intake.title}</h1>
        <p>{dict.intake.description}</p>
      </section>

      <section className="grid">
        <div className="panel editor">
          <div className="stack">
            <div className="headerRow">
              <div>
                <h2>{dict.intake.editorTitle}</h2>
                <p className="subtle">{dict.intake.editorDescription}</p>
              </div>
              <div className="statusStrip">
                <span className="statusPill">
                  <strong>{dict.intake.modeLabel}</strong>
                  {getPlanningModeTitle(locale, planningMode)}
                </span>
                <span className="statusPill">
                  <strong>{dict.intake.stateLabel}</strong>
                  {screenState === "review"
                    ? dict.intake.screenStateReview
                    : dict.intake.screenStateDraft}
                </span>
                <span className="statusPill">
                  <strong>{dict.intake.draftIdLabel}</strong>
                  <span data-testid="draft-id">
                    {projectId || dict.intake.draftIdPlaceholder}
                  </span>
                </span>
              </div>
            </div>

            {screenState === "draft" ? (
              <>
                <div className="modeSwitch">
                  <button
                    className={`modeButton ${planningMode === "project" ? "modeButtonActive" : ""}`}
                    type="button"
                    onClick={() => updatePlanningMode("project")}
                  >
                    <span className="modeButtonTitle">
                      {getPlanningModeTitle(locale, "project")}
                    </span>
                    {dict.intake.projectModeHint}
                  </button>
                  <button
                    className={`modeButton ${planningMode === "daily_work" ? "modeButtonActive" : ""}`}
                    type="button"
                    onClick={() => updatePlanningMode("daily_work")}
                  >
                    <span className="modeButtonTitle">
                      {getPlanningModeTitle(locale, "daily_work")}
                    </span>
                    {dict.intake.dailyModeHint}
                  </button>
                </div>

                <div className="fields">
                  <label className="field">
                    <span className="label">{dict.intake.draftIdLabel}</span>
                    <span className="hint">{dict.intake.draftIdHint}</span>
                    <input
                      className="input"
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      placeholder={dict.intake.draftIdInputPlaceholder}
                    />
                  </label>
                  {fieldDefinitions.map((field) => (
                    <label
                      className={field.type === "text" ? "field" : "fieldWide"}
                      key={field.name}
                    >
                      <span className="label">{labelForField(field.name)}</span>
                      {field.type === "text" ? (
                        <input
                          className="input"
                          value={getFieldValue(field.name)}
                          onChange={(event) =>
                            updateFieldValue(field.name, event.target.value)
                          }
                        />
                      ) : (
                        <textarea
                          className="textarea"
                          value={getFieldValue(field.name)}
                          onChange={(event) =>
                            updateFieldValue(field.name, event.target.value)
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>

                <div className="actions">
                  <button
                    className="button"
                    type="button"
                    disabled={!canSaveDraft || isLoading}
                    onClick={saveDraft}
                  >
                    {isLoading ? dict.common.loading : dict.intake.saveDraft}
                  </button>
                  <button
                    className="buttonGhost"
                    type="button"
                    disabled={!projectId.trim() || isLoading}
                    onClick={loadDraft}
                  >
                    {dict.intake.resumeDraft}
                  </button>
                  <button
                    className="buttonGhost"
                    type="button"
                    disabled={!canReview || isLoading}
                    onClick={enterReviewState}
                  >
                    {dict.intake.reviewBeforeRefinement}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="reviewBanner">{dict.intake.reviewBanner}</div>

                <div className="reviewGrid">
                  <section className="reviewPanel" data-testid="review-structured-summary">
                    <div className="reviewPanelHeader">
                      <h3>{dict.intake.structuredSummaryTitle}</h3>
                      <p>{dict.intake.structuredSummaryDescription}</p>
                    </div>
                    <dl className="reviewSummaryList">
                      {reviewSummaryItems.map((item) => (
                        <div className="reviewSummaryRow" key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="reviewPanel" data-testid="review-free-form-summary">
                    <div className="reviewPanelHeader">
                      <h3>{dict.intake.freeFormSummaryTitle}</h3>
                      <p>{dict.intake.freeFormSummaryDescription}</p>
                    </div>
                    <div className="reviewNarrative">{freeFormBody}</div>
                  </section>
                </div>

                <div className="actions">
                  <button
                    className="buttonGhost"
                    type="button"
                    disabled={isLoading}
                    onClick={returnToEditing}
                  >
                    {dict.intake.editBeforeStart}
                  </button>
                  <button
                    className="buttonWarm"
                    type="button"
                    disabled={!canConfirm || isLoading}
                    onClick={confirmAndStart}
                  >
                    {isLoading ? dict.common.loading : dict.intake.confirmAndStart}
                  </button>
                </div>
              </>
            )}

            <p className="note">{statusMessage}</p>
            {errorMessage ? <p className="error">{errorMessage}</p> : null}
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel railCard">
            <h3>{dict.intake.composeTargets}</h3>
            <p>{dict.intake.composeTargetsDescription}</p>
          </section>

          <section className="panel summaryCard">
            <h3>{dict.intake.readinessTitle}</h3>
            <div className="summaryList">
              <dl>
                <dt>{dict.intake.stateLabel}</dt>
                <dd>
                  {screenState === "review"
                    ? dict.intake.screenStateReview
                    : dict.intake.screenStateDraft}
                </dd>
              </dl>
              <dl>
                <dt>
                  {screenState === "review"
                    ? dict.intake.reviewSummaryFields
                    : dict.intake.visibleRequiredFields}
                </dt>
                <dd>
                  {screenState === "review"
                    ? reviewSummaryLabels
                    : requiredFieldLabels}
                </dd>
              </dl>
              <dl>
                <dt>
                  {screenState === "review"
                    ? dict.intake.confirmReadiness
                    : dict.intake.saveReadiness}
                </dt>
                <dd>{screenState === "review" ? (canConfirm ? "Enabled." : "Disabled.") : (canSaveDraft ? "Enabled." : "Disabled.")}</dd>
              </dl>
              <dl>
                <dt>
                  {screenState === "review"
                    ? dict.intake.editReturn
                    : dict.intake.reviewAvailability}
                </dt>
                <dd>
                  {screenState === "review"
                    ? dict.intake.statusReturnedToEdit
                    : canReview
                      ? dict.intake.statusReviewReady
                      : "Disabled."}
                </dd>
              </dl>
            </div>
          </section>

          <section className="panel resultCard">
            <h3>{dict.intake.latestApiResult}</h3>
            <div className="resultBlock">
              <pre>
                {workspaceContext
                  ? JSON.stringify(workspaceContext, null, 2)
                  : dict.intake.noApiRoundTrip}
              </pre>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
