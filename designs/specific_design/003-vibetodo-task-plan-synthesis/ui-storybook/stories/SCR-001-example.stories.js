import template from "../components/SCR-001-example.html?raw";

const renderTemplate = (tokens) =>
  Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`__${key}__`, value),
    template,
  );

export default {
  title: "Screens/DOM-003 Task Synthesis States",
  parameters: {
    layout: "fullscreen",
  },
};

export const EligibilityBlocked = () =>
  renderTemplate({
    STATE_PILL: "Blocked",
    STATE_PILL_CLASS: "tp-pill-warn",
    STATE_META: "SCR-004 remains unavailable until the approved artifact basis is complete",
    SCREEN_LABEL: "SCR-004 Task Synthesis",
    PAGE_TITLE: "Do not generate tasks from an incomplete or stale planning basis",
    PAGE_COPY:
      "Task synthesis only opens when the current project has one approved and current snapshot for every required artifact. The screen tells the reviewer exactly which upstream work still blocks generation.",
    STATUS_STRIP: `
      <div class="tp-chip"><strong>Project</strong>prj_local_021</div>
      <div class="tp-chip"><strong>Planning mode</strong>project</div>
      <div class="tp-chip"><strong>Current plan</strong>none published yet</div>
      <div class="tp-chip"><strong>Next unblock</strong>Return to SCR-003</div>
    `,
    RAIL_ITEMS: `
      <div class="tp-rail-item tp-rail-item-ready"><strong>objective_and_outcome</strong><span>approved + current</span></div>
      <div class="tp-rail-item tp-rail-item-ready"><strong>background_and_current_situation</strong><span>approved + current</span></div>
      <div class="tp-rail-item tp-rail-item-danger"><strong>scope_and_non_scope</strong><span>stale after upstream change</span></div>
      <div class="tp-rail-item tp-rail-item-warn"><strong>deliverables_and_milestones</strong><span>missing approval</span></div>
    `,
    MAIN_PANEL: `
      <p class="tp-section-title">Eligibility summary</p>
      <div class="tp-banner tp-banner-warn">Synthesis is blocked because <strong>scope_and_non_scope</strong> is stale and <strong>deliverables_and_milestones</strong> has no current approved snapshot for this project.</div>
      <div class="tp-box">
        The task planning module will not create a candidate plan until the required artifact sequence is fully trustworthy.
        <br /><br />
        This prevents SCR-005 from ever receiving a plan generated from mixed-version artifacts.
      </div>
      <p class="tp-section-title">What the reviewer should see</p>
      <div class="tp-table">
        <div class="tp-table-row">
          <div><strong>scope_and_non_scope</strong><span class="tp-mini">latest approved snapshot replaced upstream</span></div>
          <div><strong>State</strong><span class="tp-mini">stale</span></div>
          <div><strong>Action</strong><span class="tp-mini">re-open SCR-003</span></div>
          <div><strong>Impact</strong><span class="tp-mini">candidate generation disabled</span></div>
          <div><strong>Source</strong><span class="tp-mini">DOM-002</span></div>
        </div>
        <div class="tp-table-row">
          <div><strong>deliverables_and_milestones</strong><span class="tp-mini">draft exists but approval missing</span></div>
          <div><strong>State</strong><span class="tp-mini">missing</span></div>
          <div><strong>Action</strong><span class="tp-mini">finish approval</span></div>
          <div><strong>Impact</strong><span class="tp-mini">publish path unavailable</span></div>
          <div><strong>Source</strong><span class="tp-mini">DOM-002</span></div>
        </div>
      </div>
    `,
    SIDE_PANEL: `
      <div class="tp-stack-card">
        <p class="tp-section-title">Synthesis job status</p>
        <div class="tp-timeline">
          <div class="tp-timeline-item"><strong>queued</strong><span>not allowed until basis is ready</span></div>
          <div class="tp-timeline-item"><strong>running</strong><span>no active job</span></div>
          <div class="tp-timeline-item"><strong>retryable</strong><span>not applicable yet</span></div>
        </div>
      </div>
      <div class="tp-summary-card">
        <p class="tp-section-title">Cross-domain check</p>
        <p class="tp-copy">The same stale reason payload must be understood by 002-vibetodo-spec-refinement-workbench and by 004-vibetodo-management-workspace without reinterpretation.</p>
      </div>
    `,
    ACTIONS: `
      <button class="tp-button tp-button-secondary" type="button">Open stale artifact review</button>
      <button class="tp-button tp-button-warn" type="button">View readiness details</button>
      <button class="tp-button tp-button-secondary" type="button">Synthesize task plan (disabled)</button>
    `,
    SIDEBAR_TITLE: "Why readiness stays strict",
    SIDEBAR_COPY:
      "Task generation becomes the planning basis for the workspace. A soft warning is not enough here; the workflow must block until every upstream artifact is approved and current.",
    SIDEBAR_LIST: `
      <li>Eligibility is driven by shared artifact status, not screen-local flags.</li>
      <li>The user sees which artifact blocks synthesis and what to do next.</li>
      <li>No hidden fallback creates a plan from partial context.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="tp-summary-card">
        <p class="tp-section-title">Shared refs</p>
        <p class="tp-copy">CD-UI-001 for SCR-004 ownership, CD-MOD-001 for eligibility gating, CD-API-001 for readiness payloads.</p>
      </div>
    `,
  });

export const ReviewAndPublish = () =>
  renderTemplate({
    STATE_PILL: "Review",
    STATE_PILL_CLASS: "",
    STATE_META: "SCR-004 reviews one candidate snapshot before explicit publish",
    SCREEN_LABEL: "SCR-004 Task Synthesis",
    PAGE_TITLE: "Review dependency-ready tasks without losing the artifact evidence behind them",
    PAGE_COPY:
      "The candidate plan exposes required fields, dependency order, placeholder notes, and related artifacts in one screen. Corrections stay narrow and publish remains a separate decision.",
    STATUS_STRIP: `
      <div class="tp-chip"><strong>Project</strong>prj_local_021</div>
      <div class="tp-chip"><strong>Candidate snapshot</strong>tp_014_v2</div>
      <div class="tp-chip"><strong>Source artifacts</strong>8 approved snapshots</div>
      <div class="tp-chip"><strong>Publish state</strong>ready after one correction</div>
    `,
    RAIL_ITEMS: `
      <div class="tp-rail-item tp-rail-item-ready"><strong>Eligibility</strong><span>approved artifact set complete</span></div>
      <div class="tp-rail-item tp-rail-item-ready"><strong>Snapshot</strong><span>candidate generated</span></div>
      <div class="tp-rail-item"><strong>Corrections</strong><span>limited to fields + dependencies</span></div>
      <div class="tp-rail-item"><strong>Handoff</strong><span>SCR-005 after publish</span></div>
    `,
    MAIN_PANEL: `
      <p class="tp-section-title">Task plan summary</p>
      <div class="tp-box">
        Generated 2026-03-14 14:18 JST from the current approved artifact set. Two fields were placeholder-generated during synthesis: one estimate and one assignee.
        <br /><br />
        Publish blockers: <strong>1</strong> task still needs the assignee confirmed.
      </div>
      <p class="tp-section-title">Generated tasks</p>
      <div class="tp-table">
        <div class="tp-table-row">
          <div><strong>Define hiring checkpoint cadence</strong><span class="tp-mini">links: art_021, art_024</span></div>
          <div><strong>Priority</strong><span class="tp-mini">high</span></div>
          <div><strong>Status</strong><span class="tp-mini">ready</span></div>
          <div><strong>Due</strong><span class="tp-mini">2026-03-18</span></div>
          <div><strong>Deps</strong><span class="tp-mini">0</span></div>
        </div>
        <div class="tp-table-row">
          <div><strong>Confirm interview bandwidth owners</strong><span class="tp-mini">links: art_022, art_025, art_026</span></div>
          <div><strong>Priority</strong><span class="tp-mini">high</span></div>
          <div><strong>Status</strong><span class="tp-mini">blocked</span></div>
          <div><strong>Due</strong><span class="tp-mini">2026-03-20</span></div>
          <div><strong>Deps</strong><span class="tp-mini">1</span></div>
        </div>
        <div class="tp-table-row">
          <div><strong>Draft approval checkpoint memo</strong><span class="tp-mini">links: art_023, art_027</span></div>
          <div><strong>Priority</strong><span class="tp-mini">medium</span></div>
          <div><strong>Status</strong><span class="tp-mini">backlog</span></div>
          <div><strong>Due</strong><span class="tp-mini">2026-03-22</span></div>
          <div><strong>Deps</strong><span class="tp-mini">2</span></div>
        </div>
      </div>
      <div class="tp-banner">Selected task keeps three related artifact snapshots. The reviewer may fix the canonical fields below, but the traceability links are immutable from this screen.</div>
    `,
    SIDE_PANEL: `
      <div class="tp-form-grid">
        <label class="tp-field">
          <span>Title</span>
          <input class="tp-input" type="text" value="Confirm interview bandwidth owners" />
        </label>
        <label class="tp-field">
          <span>Description</span>
          <textarea class="tp-textarea">Finalize the owner list for weekly interview capacity, confirm approval cadence, and keep the decision tied to the approved staffing constraints and stakeholder artifacts.</textarea>
        </label>
        <div class="tp-dual">
          <label class="tp-field">
            <span>Priority</span>
            <input class="tp-select" type="text" value="high" />
          </label>
          <label class="tp-field">
            <span>Status</span>
            <input class="tp-select" type="text" value="blocked" />
          </label>
        </div>
        <div class="tp-dual">
          <label class="tp-field">
            <span>Due Date</span>
            <input class="tp-input" type="text" value="2026-03-20" />
          </label>
          <label class="tp-field">
            <span>Estimate</span>
            <input class="tp-input" type="text" value="6h" />
          </label>
        </div>
        <div class="tp-dual">
          <label class="tp-field">
            <span>Assignee</span>
            <input class="tp-input" type="text" value="self" />
          </label>
          <label class="tp-field">
            <span>Dependencies</span>
            <input class="tp-deps" type="text" value="tsk_001" />
          </label>
        </div>
        <div class="tp-summary-card">
          <p class="tp-section-title">Related Artifacts</p>
          <ul class="tp-note-list">
            <li>art_022 background_and_current_situation v3</li>
            <li>art_025 stakeholders_and_roles v2</li>
            <li>art_026 work_breakdown v1</li>
          </ul>
        </div>
        <div class="tp-stack-card">
          <p class="tp-section-title">Publish blockers</p>
          <p class="tp-copy">None after the selected task assignee is confirmed as <strong>self</strong>.</p>
        </div>
      </div>
    `,
    ACTIONS: `
      <button class="tp-button tp-button-secondary" type="button">Save task correction</button>
      <button class="tp-button tp-button-secondary" type="button">Regenerate candidate</button>
      <button class="tp-button tp-button-primary" type="button">Publish task plan</button>
      <button class="tp-button tp-button-secondary" type="button">Open SCR-005 after publish</button>
    `,
    SIDEBAR_TITLE: "What publish protects",
    SIDEBAR_COPY:
      "This screen separates candidate review from workspace promotion. The user can correct fields here, but the management workspace should not treat the plan as current until publish succeeds.",
    SIDEBAR_LIST: `
      <li>Every task keeps at least one related artifact link.</li>
      <li>Dependency edits are allowed, but task add and delete are not.</li>
      <li>Publish is explicit so SCR-005 only reads reviewed data.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="tp-summary-card">
        <p class="tp-section-title">Cross-domain check</p>
        <p class="tp-copy">004-vibetodo-management-workspace should receive this snapshot only after the explicit publish action, and then treat the same canonical task fields as its source of truth.</p>
      </div>
    `,
  });

export const StalePublishedPlan = () =>
  renderTemplate({
    STATE_PILL: "Stale",
    STATE_PILL_CLASS: "tp-pill-danger",
    STATE_META: "A previously published plan became read-only after upstream artifact changes",
    SCREEN_LABEL: "SCR-004 Task Synthesis",
    PAGE_TITLE: "Freeze the stale workspace basis until a new snapshot is regenerated and republished",
    PAGE_COPY:
      "The user can still inspect the current published tasks, but the screen shows exactly why the plan is stale and why SCR-005 must remain read-only until a fresh candidate is published.",
    STATUS_STRIP: `
      <div class="tp-chip"><strong>Published snapshot</strong>tp_013_v1</div>
      <div class="tp-chip"><strong>Freshness</strong>stale</div>
      <div class="tp-chip"><strong>Changed source</strong>scope_and_non_scope v4</div>
      <div class="tp-chip"><strong>Workspace mode</strong>read_only</div>
    `,
    RAIL_ITEMS: `
      <div class="tp-rail-item tp-rail-item-danger"><strong>Current plan</strong><span>stale published snapshot</span></div>
      <div class="tp-rail-item tp-rail-item-warn"><strong>Recovery</strong><span>regenerate candidate</span></div>
      <div class="tp-rail-item"><strong>Next decision</strong><span>republish required</span></div>
      <div class="tp-rail-item"><strong>Workspace</strong><span>read-only until resolved</span></div>
    `,
    MAIN_PANEL: `
      <p class="tp-section-title">Stale reason</p>
      <div class="tp-banner tp-banner-danger">The published task plan was generated from <strong>scope_and_non_scope art_024_v3</strong>, but the current approved planning basis is now <strong>art_024_v4</strong>. The workspace can no longer treat this plan as the active editable source of truth.</div>
      <div class="tp-box">
        Required next action: generate a new candidate plan from the latest approved artifact set, review the resulting task changes, and publish the replacement snapshot.
      </div>
      <p class="tp-section-title">Current published tasks</p>
      <div class="tp-table">
        <div class="tp-table-row">
          <div><strong>Define hiring checkpoint cadence</strong><span class="tp-mini">read-only reference</span></div>
          <div><strong>Status</strong><span class="tp-mini">ready</span></div>
          <div><strong>Due</strong><span class="tp-mini">2026-03-18</span></div>
          <div><strong>Estimate</strong><span class="tp-mini">4h</span></div>
          <div><strong>Mode</strong><span class="tp-mini">read-only</span></div>
        </div>
        <div class="tp-table-row">
          <div><strong>Confirm interview bandwidth owners</strong><span class="tp-mini">read-only reference</span></div>
          <div><strong>Status</strong><span class="tp-mini">in_progress</span></div>
          <div><strong>Due</strong><span class="tp-mini">2026-03-20</span></div>
          <div><strong>Estimate</strong><span class="tp-mini">6h</span></div>
          <div><strong>Mode</strong><span class="tp-mini">read-only</span></div>
        </div>
      </div>
    `,
    SIDE_PANEL: `
      <div class="tp-stack-card">
        <p class="tp-section-title">Affected source artifacts</p>
        <ul class="tp-note-list">
          <li>art_024_v3 -> art_024_v4 scope_and_non_scope</li>
          <li>art_027_v2 -> still current deliverables_and_milestones</li>
          <li>art_028_v2 -> still current work_breakdown</li>
        </ul>
      </div>
      <div class="tp-summary-card">
        <p class="tp-section-title">Workspace handoff state</p>
        <p class="tp-copy">SCR-005 may show this plan, but it must disable task mutation until a fresh snapshot is published.</p>
      </div>
      <div class="tp-stack-card">
        <p class="tp-section-title">Allowed actions now</p>
        <div class="tp-timeline">
          <div class="tp-timeline-item"><strong>regenerate</strong><span>allowed when latest artifacts are ready</span></div>
          <div class="tp-timeline-item"><strong>publish</strong><span>disabled until a new candidate exists</span></div>
          <div class="tp-timeline-item"><strong>edit tasks</strong><span>blocked while stale</span></div>
        </div>
      </div>
    `,
    ACTIONS: `
      <button class="tp-button tp-button-primary" type="button">Regenerate from latest artifacts</button>
      <button class="tp-button tp-button-secondary" type="button">Open source artifact history</button>
      <button class="tp-button tp-button-danger" type="button">Edit tasks (disabled while stale)</button>
    `,
    SIDEBAR_TITLE: "Why stale is operational, not cosmetic",
    SIDEBAR_COPY:
      "Once the planning basis changes, the published task plan is no longer trustworthy as the editable execution source. The workflow must force the user back through regeneration and republish.",
    SIDEBAR_LIST: `
      <li>SCR-004 becomes the recovery boundary for stale published plans.</li>
      <li>SCR-005 should mirror the same read-only state instead of inventing its own rule.</li>
      <li>The stale summary points back to the exact artifact snapshots that changed.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="tp-summary-card">
        <p class="tp-section-title">Shared refs</p>
        <p class="tp-copy">CD-DATA-001 for freshness state, CD-MOD-001 for stale propagation, CD-UI-001 for the SCR-004 to SCR-005 handoff rule.</p>
      </div>
    `,
  });
