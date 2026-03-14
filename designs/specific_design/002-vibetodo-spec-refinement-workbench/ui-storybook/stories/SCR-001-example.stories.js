import template from "../components/SCR-001-example.html?raw";

const renderTemplate = (tokens) =>
  Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`__${key}__`, value),
    template,
  );

const sequenceItems = `
  <div class="wb-sequence-item wb-sequence-item-active"><strong>objective_and_outcome</strong><span>approved</span></div>
  <div class="wb-sequence-item wb-sequence-item-active"><strong>background_and_current_situation</strong><span>active draft</span></div>
  <div class="wb-sequence-item"><strong>scope_and_non_scope</strong><span>blocked</span></div>
  <div class="wb-sequence-item"><strong>constraints_and_conditions</strong><span>blocked</span></div>
  <div class="wb-sequence-item"><strong>stakeholders_and_roles</strong><span>blocked</span></div>
  <div class="wb-sequence-item"><strong>deliverables_and_milestones</strong><span>blocked</span></div>
  <div class="wb-sequence-item"><strong>work_breakdown</strong><span>blocked</span></div>
  <div class="wb-sequence-item"><strong>risks_assumptions_and_open_questions</strong><span>blocked</span></div>
`;

export default {
  title: "Screens/DOM-002 Refinement Review States",
  parameters: {
    layout: "fullscreen",
  },
};

export const RefinementLoopActiveDraft = () =>
  renderTemplate({
    STATE_PILL: "Refinement",
    STATE_PILL_CLASS: "",
    STATE_META: "SCR-002 keeps drafting, context scope, and async generation visible",
    SCREEN_LABEL: "SCR-002 Refinement Loop",
    PAGE_TITLE: "Refine one artifact at a time without losing the approved baseline",
    PAGE_COPY:
      "The workbench shows only the upstream context that belongs to the active project and artifact. Generation is explicit, async, and reviewable before approval.",
    STATUS_STRIP: `
      <div class="wb-chip"><strong>Project</strong>prj_local_014</div>
      <div class="wb-chip"><strong>Active artifact</strong>background_and_current_situation</div>
      <div class="wb-chip"><strong>Job status</strong>running -> completed</div>
      <div class="wb-chip"><strong>Next boundary</strong>SCR-003 review</div>
    `,
    SEQUENCE_ITEMS: sequenceItems,
    MAIN_PANEL: `
      <p class="wb-section-title">Current artifact draft</p>
      <div class="wb-editor">
        The project has enough directional intent to begin planning, but the current situation remains unstable. Intake data shows uneven interview capacity, unclear budget checkpoints, and no shared milestone cadence across hiring managers.
        <br /><br />
        The next approved draft should explain why the planning effort exists now, what already blocks confident sequencing, and which operational assumptions still need confirmation before task synthesis begins.
      </div>
      <p class="wb-section-title">Change reason summary</p>
      <div class="wb-box">Generated from the approved objective artifact plus intake context. The update adds current-state bottlenecks and replaces generic filler with project-specific constraints.</div>
      <div class="wb-banner">Downstream stale impact if approved: scope_and_non_scope onward, plus the latest task plan snapshot once one exists.</div>
    `,
    SIDE_PANEL: `
      <div class="wb-context">
        <p class="wb-section-title">Approved upstream context</p>
        <p class="wb-copy">project_id, active artifact key, confirmed intake snapshot, and approved objective artifact only.</p>
      </div>
      <label>
        <span class="wb-label">Refinement prompt</span>
        <textarea class="wb-textarea">Clarify why the current situation blocks confident planning. Keep it specific to this hiring reset project and do not invent task-level steps yet.</textarea>
      </label>
      <div class="wb-note">
        <p class="wb-section-title">Generation job status</p>
        <div class="wb-timeline">
          <div class="wb-timeline-item"><strong>queued</strong><span>accepted with project_id and artifact_key</span></div>
          <div class="wb-timeline-item"><strong>running</strong><span>provider adapter building draft</span></div>
          <div class="wb-timeline-item"><strong>completed</strong><span>snapshot v3 ready for review</span></div>
        </div>
      </div>
    `,
    ACTIONS: `
      <button class="wb-button wb-button-primary" type="button">Generate draft</button>
      <button class="wb-button wb-button-secondary" type="button">Regenerate with note</button>
      <button class="wb-button wb-button-secondary" type="button">Save explicit edit</button>
      <button class="wb-button wb-button-secondary" type="button">Review for approval</button>
    `,
    SIDEBAR_TITLE: "Why chat stays narrow",
    SIDEBAR_COPY:
      "The conversation surface exists only to improve the active artifact. It cannot act as a general assistant and it does not update the artifact body until the user triggers an explicit write path.",
    SIDEBAR_LIST: `
      <li>The artifact rail uses one canonical order for both planning modes.</li>
      <li>Async generation failures preserve the last approved snapshot.</li>
      <li>Approval remains a separate screen even after draft generation finishes.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="wb-impact">
        <p class="wb-section-title">Shared refs</p>
        <p class="wb-copy">CD-API-001 for generation commands, CD-MOD-001 for gating, CD-UI-001 for SCR-002 ownership.</p>
      </div>
    `,
  });

export const ApprovalBoundary = () =>
  renderTemplate({
    STATE_PILL: "Approval",
    STATE_PILL_CLASS: "wb-pill-warn",
    STATE_META: "SCR-003 compares immutable snapshots and records explicit decisions",
    SCREEN_LABEL: "SCR-003 Artifact Approval",
    PAGE_TITLE: "Approve one immutable snapshot and see exactly what will go stale",
    PAGE_COPY:
      "The approval boundary shows diff, rationale, prior decisions, and readiness impact before the user advances the sequence or sends work back to refinement.",
    STATUS_STRIP: `
      <div class="wb-chip"><strong>Artifact</strong>background_and_current_situation</div>
      <div class="wb-chip"><strong>Snapshot</strong>art_029_v3</div>
      <div class="wb-chip"><strong>Decision</strong>approval required</div>
      <div class="wb-chip"><strong>Ready after action</strong>scope_and_non_scope unlocks</div>
    `,
    SEQUENCE_ITEMS: `
      <div class="wb-sequence-item wb-sequence-item-active"><strong>objective_and_outcome</strong><span>approved</span></div>
      <div class="wb-sequence-item wb-sequence-item-active"><strong>background_and_current_situation</strong><span>under review</span></div>
      <div class="wb-sequence-item"><strong>scope_and_non_scope</strong><span>waiting for approval</span></div>
      <div class="wb-sequence-item"><strong>constraints_and_conditions</strong><span>blocked</span></div>
      <div class="wb-sequence-item"><strong>stakeholders_and_roles</strong><span>blocked</span></div>
      <div class="wb-sequence-item"><strong>deliverables_and_milestones</strong><span>blocked</span></div>
      <div class="wb-sequence-item"><strong>work_breakdown</strong><span>blocked</span></div>
      <div class="wb-sequence-item"><strong>risks_assumptions_and_open_questions</strong><span>blocked</span></div>
    `,
    MAIN_PANEL: `
      <p class="wb-section-title">Current vs previous diff</p>
      <div class="wb-diff">
        <del>The team needs a hiring plan soon.</del><br />
        <ins>The hiring plan is blocked by uneven interview capacity, unclear budget checkpoints, and missing weekly decision cadence across hiring managers.</ins>
        <br /><br />
        <del>There are some dependencies to resolve.</del><br />
        <ins>These blockers explain why downstream scope and milestone artifacts would otherwise rest on unstable assumptions.</ins>
      </div>
      <p class="wb-section-title">Change reason</p>
      <div class="wb-box">Regeneration incorporated explicit interview-capacity risk and budget checkpoint detail after the user rejected the prior generic wording.</div>
      <div class="wb-banner">Readiness gate: task synthesis remains blocked until every required artifact shows approved + current.</div>
    `,
    SIDE_PANEL: `
      <div class="wb-audit">
        <p class="wb-section-title">Approval history</p>
        <div class="wb-timeline">
          <div class="wb-timeline-item"><strong>v2 rejected</strong><span>Reason: too generic, 2026-03-14 10:18</span></div>
          <div class="wb-timeline-item"><strong>v1 approved</strong><span>Objective artifact, 2026-03-14 09:42</span></div>
        </div>
      </div>
      <div class="wb-impact">
        <p class="wb-section-title">Downstream stale impact</p>
        <p class="wb-copy">If approved, downstream artifacts from scope onward must regenerate against this newly approved planning basis.</p>
      </div>
      <div class="wb-note">
        <p class="wb-section-title">Decision requirement</p>
        <p class="wb-copy">Approval and rejection both require an explicit decision reason tied to this snapshot ID.</p>
      </div>
    `,
    ACTIONS: `
      <button class="wb-button wb-button-primary" type="button">Approve snapshot</button>
      <button class="wb-button wb-button-warn" type="button">Reject to refinement</button>
      <button class="wb-button wb-button-secondary" type="button">Return to SCR-002</button>
    `,
    SIDEBAR_TITLE: "What this boundary protects",
    SIDEBAR_COPY:
      "Without an explicit review screen, generated drafts would drift into task synthesis without traceable human confirmation. SCR-003 exists to stop that.",
    SIDEBAR_LIST: `
      <li>One approval decision maps to one immutable snapshot.</li>
      <li>Previous versions remain visible for audit and comparison.</li>
      <li>Readiness to open SCR-004 is calculated here, not guessed by the UI.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="wb-impact">
        <p class="wb-section-title">Cross-domain check</p>
        <p class="wb-copy">REQ-005 and REQ-006 matter to 003-vibetodo-task-plan-synthesis and 004-vibetodo-management-workspace because stale task plans must become non-current immediately.</p>
      </div>
    `,
  });

export const StaleDownstreamImpact = () =>
  renderTemplate({
    STATE_PILL: "Stale",
    STATE_PILL_CLASS: "wb-pill-danger",
    STATE_META: "Upstream approval changed the planning basis for downstream artifacts and tasks",
    SCREEN_LABEL: "SCR-003 Artifact Approval",
    PAGE_TITLE: "Show the blast radius before downstream work keeps running on stale assumptions",
    PAGE_COPY:
      "After an upstream artifact changes, the workbench must immediately signal which downstream artifacts and task plans are stale and what the user must regenerate or re-approve.",
    STATUS_STRIP: `
      <div class="wb-chip"><strong>Changed artifact</strong>scope_and_non_scope</div>
      <div class="wb-chip"><strong>Downstream artifacts</strong>4 stale</div>
      <div class="wb-chip"><strong>Task plan</strong>latest snapshot stale</div>
      <div class="wb-chip"><strong>Blocked handoff</strong>SCR-004 disabled</div>
    `,
    SEQUENCE_ITEMS: `
      <div class="wb-sequence-item"><strong>objective_and_outcome</strong><span>approved</span></div>
      <div class="wb-sequence-item"><strong>background_and_current_situation</strong><span>approved</span></div>
      <div class="wb-sequence-item wb-sequence-item-active"><strong>scope_and_non_scope</strong><span>newly approved</span></div>
      <div class="wb-sequence-item wb-sequence-item-stale"><strong>constraints_and_conditions</strong><span>stale</span></div>
      <div class="wb-sequence-item wb-sequence-item-stale"><strong>stakeholders_and_roles</strong><span>stale</span></div>
      <div class="wb-sequence-item wb-sequence-item-stale"><strong>deliverables_and_milestones</strong><span>stale</span></div>
      <div class="wb-sequence-item wb-sequence-item-stale"><strong>work_breakdown</strong><span>stale</span></div>
      <div class="wb-sequence-item wb-sequence-item-stale"><strong>risks_assumptions_and_open_questions</strong><span>stale</span></div>
    `,
    MAIN_PANEL: `
      <p class="wb-section-title">Stale impact summary</p>
      <div class="wb-box">
        A newly approved scope change removed vendor-led execution and tightened the in-house hiring operations boundary.
        <br /><br />
        Downstream artifacts now rely on an outdated assumption set and the latest task plan snapshot can no longer be treated as the current planning basis.
      </div>
      <div class="wb-banner wb-banner-danger">Required follow-up: regenerate or re-approve every stale downstream artifact before task synthesis reopens.</div>
      <p class="wb-section-title">Readiness gate</p>
      <div class="wb-box">SCR-004 remains blocked. SCR-005 should surface the task plan as read-only until a fresh task plan is synthesized and published.</div>
    `,
    SIDE_PANEL: `
      <div class="wb-impact">
        <p class="wb-section-title">Affected records</p>
        <ul class="wb-list">
          <li>constraints_and_conditions snapshot art_031_v2</li>
          <li>stakeholders_and_roles snapshot art_032_v2</li>
          <li>deliverables_and_milestones snapshot art_033_v1</li>
          <li>task_plan_snapshot tp_008</li>
        </ul>
      </div>
      <div class="wb-note">
        <p class="wb-section-title">Why current plan is blocked</p>
        <p class="wb-copy">The task plan was generated from now-obsolete scope assumptions and must not remain the editable source of truth.</p>
      </div>
    `,
    ACTIONS: `
      <button class="wb-button wb-button-primary" type="button">Return to stale artifact</button>
      <button class="wb-button wb-button-secondary" type="button">Open regeneration queue</button>
      <button class="wb-button wb-button-secondary" type="button">View audit history</button>
    `,
    SIDEBAR_TITLE: "Why stale matters across domains",
    SIDEBAR_COPY:
      "The refinement bundle is not isolated. Once an approved planning basis changes, task synthesis and management workspace consumers must immediately stop treating older outputs as current.",
    SIDEBAR_LIST: `
      <li>Stale is a data lifecycle state, not just a visual warning.</li>
      <li>Task synthesis stays blocked until downstream artifacts are refreshed.</li>
      <li>Management workspace should switch the current task plan to read-only while stale.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="wb-impact">
        <p class="wb-section-title">Shared refs</p>
        <p class="wb-copy">CD-DATA-001 for freshness state, CD-MOD-001 for stale propagation, CD-UI-001 for feedback return path into SCR-002.</p>
      </div>
    `,
  });
