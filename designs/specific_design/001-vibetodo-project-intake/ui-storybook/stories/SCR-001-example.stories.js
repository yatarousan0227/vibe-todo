import template from "../components/SCR-001-example.html?raw";

const renderTemplate = (tokens) =>
  Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`__${key}__`, value),
    template,
  );

export default {
  title: "Screens/SCR-001 Intake Start",
  parameters: {
    layout: "fullscreen",
  },
};

export const ProjectDraft = () =>
  renderTemplate({
    STATE_PILL: "Draft",
    STATE_PILL_CLASS: "",
    STATE_META: "Project mode with mixed structured and narrative input",
    PAGE_TITLE: "Capture enough context to start planning without front-loading the burden",
    PAGE_COPY:
      "The intake screen keeps structure light. Users can still add the nuance that drives a good first refinement artifact.",
    MODE_PROJECT_CLASS: "intake-mode-option-active",
    MODE_DAILY_CLASS: "",
    MODE_LABEL: "Project planning",
    STATUS_STRIP: `
      <div class="intake-chip"><strong>Lifecycle</strong>draft_intake</div>
      <div class="intake-chip"><strong>Project ID</strong>Assigned on first save</div>
      <div class="intake-chip"><strong>Next handoff</strong>SCR-002 after review</div>
    `,
    FORM_FIELDS: `
      <label class="intake-field">
        <span class="intake-label">Title</span>
        <input class="intake-input" type="text" value="Quarterly hiring reset" />
      </label>
      <label class="intake-field">
        <span class="intake-label">Objective</span>
        <input class="intake-input" type="text" value="Create a concrete hiring plan for next quarter" />
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Background or current situation</span>
        <textarea class="intake-textarea">The team has several open roles, interview capacity is inconsistent, and leadership wants a more realistic plan before approving new recruiting spend.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Scope summary</span>
        <textarea class="intake-textarea">Clarify target roles, interview sequencing, weekly owner check-ins, and dependencies on budget approval.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Constraints or conditions</span>
        <textarea class="intake-textarea">Keep the plan within current recruiter bandwidth and avoid assuming new headcount operations tools.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Stakeholders</span>
        <textarea class="intake-textarea">VP of People, hiring managers, recruiting coordinator, finance approver</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Free-form context</span>
        <textarea class="intake-textarea">We have a rough sense of which teams need people, but the intake quality is uneven. I want the next AI step to help me stabilize priorities, success criteria, and a sane delivery sequence before we talk about tasks.</textarea>
      </label>
    `,
    REVIEW_PANEL: `
      <div class="intake-rail-card">
        <strong>What review will check</strong>
        <p class="intake-copy">Structured fields and the long-form narrative must both appear again before refinement starts.</p>
      </div>
    `,
    PRIMARY_ACTION: "Save draft",
    SECONDARY_ACTION: "Open review step",
    SIDEBAR_TITLE: "Why this screen stays narrow",
    SIDEBAR_COPY:
      "Intake owns capture, resume, and confirmation. It does not generate artifacts or hide downstream planning rules inside the form.",
    SIDEBAR_LIST: `
      <li>Project and daily work use the same entry screen but different minimum field sets.</li>
      <li>The same project stays resumable through project_id in the local environment.</li>
      <li>Confirmation is the only point where SCR-002 becomes available.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="intake-rail-card">
        <strong>Shared ref</strong>
        <p class="intake-copy">CD-UI-001 / SCR-001 Intake Start</p>
      </div>
    `,
  });

export const DailyWorkDraft = () =>
  renderTemplate({
    STATE_PILL: "Draft",
    STATE_PILL_CLASS: "",
    STATE_META: "Daily work mode with a lighter mode-specific template",
    PAGE_TITLE: "Turn repeating work into a refinement-ready daily planning snapshot",
    PAGE_COPY:
      "The mode switch changes the minimum prompts but keeps the same shared screen and the same review gate.",
    MODE_PROJECT_CLASS: "",
    MODE_DAILY_CLASS: "intake-mode-option-active",
    MODE_LABEL: "Daily work planning",
    STATUS_STRIP: `
      <div class="intake-chip"><strong>Lifecycle</strong>draft_intake</div>
      <div class="intake-chip"><strong>Mode</strong>daily_work</div>
      <div class="intake-chip"><strong>Resume rule</strong>same project_id can be reopened</div>
    `,
    FORM_FIELDS: `
      <label class="intake-field">
        <span class="intake-label">Title</span>
        <input class="intake-input" type="text" value="Weekly finance close prep" />
      </label>
      <label class="intake-field">
        <span class="intake-label">Objective</span>
        <input class="intake-input" type="text" value="Create a reliable weekly close routine" />
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Background or current situation</span>
        <textarea class="intake-textarea">The work happens every week, but steps change depending on who is available and whether source numbers arrive on time.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Expected outcome or deliverable</span>
        <textarea class="intake-textarea">A repeatable checklist and sequencing plan for the close packet, stakeholder review, and final handoff.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Constraints or conditions</span>
        <textarea class="intake-textarea">Must work with the existing spreadsheet process and accommodate late-arriving data from operations.</textarea>
      </label>
      <label class="intake-field-wide">
        <span class="intake-label">Free-form context</span>
        <textarea class="intake-textarea">I often carry the process in my head and rewrite the same notes each week. I want the next AI refinement to tease out hidden dependencies, missing owners, and a clearer success condition without forcing engineering-specific terms.</textarea>
      </label>
    `,
    REVIEW_PANEL: `
      <div class="intake-rail-card">
        <strong>Mode-specific rule</strong>
        <p class="intake-copy">Daily work replaces project-only fields with one required deliverable/outcome field.</p>
      </div>
    `,
    PRIMARY_ACTION: "Save draft",
    SECONDARY_ACTION: "Review before start",
    SIDEBAR_TITLE: "Shared behavior still applies",
    SIDEBAR_COPY:
      "The screen keeps mixed input, draft resume, and review confirmation semantics even when the template becomes lighter.",
    SIDEBAR_LIST: `
      <li>No software-delivery terminology is required to complete the form.</li>
      <li>Free-form context remains first-class data, not a notes appendix.</li>
      <li>The first refinement artifact still begins at objective and outcome.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="intake-rail-card">
        <strong>Downstream brief</strong>
        <p class="intake-copy">002-vibetodo-spec-refinement-workbench consumes the confirmed snapshot.</p>
      </div>
    `,
  });

export const ReviewBeforeStart = () =>
  renderTemplate({
    STATE_PILL: "Review",
    STATE_PILL_CLASS: "intake-pill-warm",
    STATE_META: "Pre-start review remains inside SCR-001 before the SCR-002 handoff",
    PAGE_TITLE: "Confirm the exact intake snapshot that will seed the first refinement artifact",
    PAGE_COPY:
      "This state shows the full structured template and the long-form narrative again, with a clear path back to editing.",
    MODE_PROJECT_CLASS: "intake-mode-option-active",
    MODE_DAILY_CLASS: "",
    MODE_LABEL: "Project planning",
    STATUS_STRIP: `
      <div class="intake-chip"><strong>Project ID</strong>prj_local_001</div>
      <div class="intake-chip"><strong>Ready action</strong>Confirm and start refinement</div>
      <div class="intake-chip"><strong>Session target</strong>objective_and_outcome</div>
    `,
    FORM_FIELDS: `
      <div class="intake-field-wide">
        <span class="intake-label">Structured input summary</span>
        <div class="intake-summary">
          <strong>Quarterly hiring reset</strong>
          objective: Create a concrete hiring plan for next quarter<br />
          background: Interview capacity is uneven and finance wants a realistic sequence first<br />
          scope: roles, checkpoints, approval dependencies<br />
          constraints: current bandwidth only<br />
          stakeholders: VP of People, hiring managers, recruiting coordinator, finance approver
        </div>
      </div>
      <div class="intake-field-wide">
        <span class="intake-label">Free-form context summary</span>
        <div class="intake-summary">
          I want the next AI step to stabilize priorities, success criteria, and a sane delivery sequence before we talk about tasks. This narrative stays visible here so hidden assumptions are caught before DOM-002 starts.
        </div>
      </div>
    `,
    REVIEW_PANEL: `
      <div class="intake-review-banner">Review gate: both structured and free-form content are visible, editable, and required before SCR-002 unlocks.</div>
      <div class="intake-rail-card">
        <strong>Confirmation result</strong>
        <p class="intake-copy">Persist confirmed intake snapshot, write confirmed_at, and create one active RefinementSession.</p>
      </div>
    `,
    PRIMARY_ACTION: "Confirm and start refinement",
    SECONDARY_ACTION: "Return to editing",
    SIDEBAR_TITLE: "Review checklist",
    SIDEBAR_COPY:
      "The user should know exactly what will be handed to the refinement workbench and whether anything still needs correction.",
    SIDEBAR_LIST: `
      <li>Every required field for the current mode is visible again.</li>
      <li>Free-form context is readable without silent truncation.</li>
      <li>Confirmation creates one active session and then routes to SCR-002.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="intake-rail-card">
        <strong>Module boundary</strong>
        <p class="intake-copy">UI triggers confirmation, but CD-MOD-001 owns atomic persistence and session initialization.</p>
      </div>
    `,
  });
