import template from "../components/SCR-001-example.html?raw";

const renderTemplate = (tokens) =>
  Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`__${key}__`, value),
    template,
  );

export default {
  title: "Pages/05 ManagementWorkspace",
  parameters: {
    layout: "fullscreen",
  },
};

export const CurrentPlanKanban = () =>
  renderTemplate({
    STATE_LABEL: "Current plan",
    STATE_CLASS: "",
    STATE_META:
      "Kanban is the active management view, but every card still resolves to the same canonical task record that gantt and detail consume.",
    SCREEN_LABEL: "SCR-005 Management Workspace",
    PAGE_TITLE: "Run the current published task plan without breaking its planning lineage",
    PAGE_COPY:
      "The workspace keeps kanban, gantt, task detail, and artifact health inside one shell so execution remains connected to the published task plan and the upstream artifacts that produced it.",
    STATUS_STRIP: `
      <div class="mw-chip"><strong>Project</strong>prj_local_021</div>
      <div class="mw-chip"><strong>Published plan</strong>tp_014 current</div>
      <div class="mw-chip"><strong>Active view</strong>kanban</div>
      <div class="mw-chip"><strong>Allowed actions</strong>update task + reopen refinement</div>
    `,
    MAIN_COLUMN: `
      <p class="mw-section-label">Workspace pulse</p>
      <div class="mw-stat-grid">
        <article class="mw-stat-card"><span class="mw-field-label">Backlog</span><strong>4</strong><span class="mw-field-value mw-field-value-muted">needs sequencing</span></article>
        <article class="mw-stat-card"><span class="mw-field-label">Ready</span><strong>6</strong><span class="mw-field-value mw-field-value-muted">clear dependencies</span></article>
        <article class="mw-stat-card"><span class="mw-field-label">In progress</span><strong>3</strong><span class="mw-field-value mw-field-value-muted">live execution</span></article>
        <article class="mw-stat-card"><span class="mw-field-label">Blocked</span><strong>1</strong><span class="mw-field-value mw-field-value-muted">artifact drift risk</span></article>
      </div>
      <div class="mw-banner mw-banner-success">Current published task plan is editable. Status changes and task detail saves refresh kanban, gantt, and artifact context from the same mutation response.</div>
      <p class="mw-section-label">Kanban board</p>
      <div class="mw-board">
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Backlog</strong><span class="mw-column-count">4</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Review onboarding milestone assumptions</p>
            <p class="mw-task-meta">Due 2026-03-20. Linked to approved deliverables snapshot.</p>
            <div class="mw-task-badges">
              <span class="mw-badge mw-badge-ready">priority high</span>
            </div>
          </article>
          <article class="mw-task-card">
            <p class="mw-task-title">Prepare launch communication checklist</p>
            <p class="mw-task-meta">Assignee self. Waiting for dependency sequencing.</p>
          </article>
        </section>
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Ready</strong><span class="mw-column-count">6</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Confirm interview-capacity buffer</p>
            <p class="mw-task-meta">Related artifacts stay visible in detail drawer.</p>
            <div class="mw-task-badges">
              <span class="mw-badge mw-badge-ready">artifact-backed</span>
            </div>
          </article>
        </section>
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>In progress</strong><span class="mw-column-count">3</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Run weekly milestone review</p>
            <p class="mw-task-meta">Estimate 2h. Timeline stays in sync after save.</p>
            <div class="mw-task-badges">
              <span class="mw-badge mw-badge-progress">status live</span>
            </div>
          </article>
        </section>
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Blocked</strong><span class="mw-column-count">1</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Finalize vendor fallback decision</p>
            <p class="mw-task-meta">Blocked until constraints artifact is reconfirmed.</p>
            <div class="mw-task-badges">
              <span class="mw-badge mw-badge-blocked">blocked</span>
            </div>
          </article>
        </section>
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Done</strong><span class="mw-column-count">8</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Publish current task plan</p>
            <p class="mw-task-meta">Completed in SCR-004 and now visible as workspace entry.</p>
            <div class="mw-task-badges">
              <span class="mw-badge mw-badge-done">published</span>
            </div>
          </article>
        </section>
      </div>
    `,
    SIDE_COLUMN: `
      <div>
        <p class="mw-section-label">Artifact health</p>
        <h2 class="mw-section-title">One blocked task traces back to one approved artifact snapshot</h2>
      </div>
      <div class="mw-note">
        <p class="mw-note-copy">Constraints and Conditions is still current, but the blocked task references a decision window that may need fresh refinement if execution slips again.</p>
      </div>
      <div class="mw-note">
        <p class="mw-section-label">Task detail preview</p>
        <div class="mw-detail-list">
          <div class="mw-detail-row"><span class="mw-field-label">Status</span><p class="mw-field-value">blocked -> ready</p></div>
          <div class="mw-detail-row"><span class="mw-field-label">Assignee</span><p class="mw-field-value">self</p></div>
          <div class="mw-detail-row"><span class="mw-field-label">Related artifacts</span><p class="mw-field-value">art_constraints_v4, art_deliverables_v3</p></div>
        </div>
      </div>
      <div class="mw-link-card">
        <strong>Refinement return remains available</strong>
        <p class="mw-note-copy">The workspace can reopen SCR-002 with task, artifact snapshot, and feedback note context, but it never stores a separate feedback record here.</p>
      </div>
    `,
    FOOTER_ACTIONS: `
      <button class="mw-button mw-button-primary" type="button">Open task detail</button>
      <button class="mw-button mw-button-secondary" type="button">Switch to gantt</button>
      <button class="mw-button mw-button-ghost" type="button">Open artifact health</button>
    `,
    SIDEBAR_TITLE: "Why one shell matters",
    SIDEBAR_COPY:
      "Kanban and gantt are not separate planning tools in the MVP. They are synchronized views over the same current published task plan, with artifact health and refinement return close enough to act on immediately.",
    SIDEBAR_LIST: `
      <li>Status editing is allowed only while the current plan remains fresh.</li>
      <li>Board counts, gantt rows, and task detail all refresh from one canonical task mutation.</li>
      <li>Related artifacts stay visible so execution changes remain reviewable and explainable.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="mw-link-card">
        <strong>Cross-domain review</strong>
        <p class="mw-note-copy">Check with brief 003 that only published plans appear here, and with brief 002 that feedback return carries enough context to resume targeted refinement.</p>
      </div>
    `,
  });

export const GanttAndDetail = () =>
  renderTemplate({
    STATE_LABEL: "Current plan",
    STATE_CLASS: "",
    STATE_META:
      "Gantt stays read-only even when the plan is current, while the task detail drawer owns canonical-field editing and traceability display.",
    SCREEN_LABEL: "SCR-005 Management Workspace",
    PAGE_TITLE: "See dependency order and edit the selected task without leaving the shared workspace",
    PAGE_COPY:
      "The gantt view consumes execution-order metadata from task planning and pairs it with a detail drawer where only the approved canonical fields can change.",
    STATUS_STRIP: `
      <div class="mw-chip"><strong>Project</strong>prj_local_021</div>
      <div class="mw-chip"><strong>Active view</strong>gantt</div>
      <div class="mw-chip"><strong>Selected task</strong>task_118 weekly milestone review</div>
      <div class="mw-chip"><strong>Freshness</strong>current</div>
    `,
    MAIN_COLUMN: `
      <p class="mw-section-label">Gantt projection</p>
      <div class="mw-timeline">
        <div class="mw-timeline-header"><span>Task</span><span>Schedule</span><span>State</span></div>
        <div class="mw-timeline-row">
          <strong>Confirm intake drift</strong>
          <div class="mw-timeline-track"><div class="mw-timeline-bar" style="left: 4%; width: 28%"></div></div>
          <span>ready</span>
        </div>
        <div class="mw-timeline-row">
          <strong>Weekly milestone review</strong>
          <div class="mw-timeline-track"><div class="mw-timeline-bar" style="left: 24%; width: 34%"></div></div>
          <span>in progress</span>
        </div>
        <div class="mw-timeline-row">
          <strong>Finalize vendor fallback decision</strong>
          <div class="mw-timeline-track"><div class="mw-timeline-bar mw-timeline-bar-blocked" style="left: 58%; width: 18%"></div></div>
          <span>blocked</span>
        </div>
      </div>
      <div class="mw-banner mw-banner-warn">Gantt is read-only in the MVP. Timeline changes come from canonical task field edits, not drag or resize gestures.</div>
    `,
    SIDE_COLUMN: `
      <div>
        <p class="mw-section-label">Task detail drawer</p>
        <h2 class="mw-section-title">weekly milestone review</h2>
      </div>
      <div class="mw-detail-list">
        <div class="mw-detail-row"><span class="mw-field-label">Description</span><p class="mw-field-value">Review approved milestones against current execution pace and update the next due date if blockers have cleared.</p></div>
        <div class="mw-detail-row"><span class="mw-field-label">Priority</span><p class="mw-field-value">high</p></div>
        <div class="mw-detail-row"><span class="mw-field-label">Dependencies</span><p class="mw-field-value">task_104 confirm intake drift, task_111 capture blocker notes</p></div>
        <div class="mw-detail-row"><span class="mw-field-label">Estimate</span><p class="mw-field-value">2h</p></div>
        <div class="mw-detail-row"><span class="mw-field-label">Assignee</span><p class="mw-field-value">self</p></div>
        <div class="mw-detail-row"><span class="mw-field-label">Related artifacts</span><p class="mw-field-value">art_work_breakdown_v2, art_deliverables_v3</p></div>
      </div>
      <div class="mw-link-card">
        <strong>Save path</strong>
        <p class="mw-note-copy">PATCH task update preserves related artifact links and refreshes both gantt markers and board columns from the returned canonical task.</p>
      </div>
    `,
    FOOTER_ACTIONS: `
      <button class="mw-button mw-button-primary" type="button">Save task update</button>
      <button class="mw-button mw-button-secondary" type="button">Return to kanban</button>
      <button class="mw-button mw-button-ghost" type="button">Send to refinement</button>
    `,
    SIDEBAR_TITLE: "Where editing actually lives",
    SIDEBAR_COPY:
      "The detail drawer is the only place that edits canonical task fields beyond quick status moves. That keeps gantt visual, kanban operational, and task mutation rules concentrated in one predictable path.",
    SIDEBAR_LIST: `
      <li>Required fields stay non-null across every save.</li>
      <li>Dependencies must resolve to tasks in the same current published plan.</li>
      <li>Related artifacts remain visible before and after mutation.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="mw-link-card">
        <strong>Shared refs in use</strong>
        <p class="mw-note-copy">CD-DATA-001 defines the canonical task shape, CD-API-001 defines the PATCH contract, and CD-MOD-001 owns freshness validation.</p>
      </div>
    `,
  });

export const StaleReadOnly = () =>
  renderTemplate({
    STATE_LABEL: "Stale",
    STATE_CLASS: "mw-kicker-state-danger",
    STATE_META:
      "An upstream artifact or a regenerated task plan changed the planning basis, so the workspace stays visible but mutating controls are removed.",
    SCREEN_LABEL: "SCR-005 Management Workspace",
    PAGE_TITLE: "Keep execution context visible while stopping edits on stale assumptions",
    PAGE_COPY:
      "Stale is a lifecycle state, not a cosmetic warning. The current board and timeline remain readable for situational awareness, but every mutation path is blocked until refinement or republish finishes.",
    STATUS_STRIP: `
      <div class="mw-chip"><strong>Published plan</strong>tp_014 stale</div>
      <div class="mw-chip"><strong>Cause</strong>scope change approved upstream</div>
      <div class="mw-chip"><strong>Allowed actions</strong>inspect + reopen refinement</div>
      <div class="mw-chip"><strong>Blocked</strong>status edit, task save</div>
    `,
    MAIN_COLUMN: `
      <div class="mw-banner mw-banner-danger">The current plan was generated from an outdated artifact basis. Board, gantt, and detail remain read-only until a fresh task plan is regenerated and published.</div>
      <p class="mw-section-label">Read-only management views</p>
      <div class="mw-board">
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Blocked impact</strong><span class="mw-column-count">4</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Reconfirm scope boundary with in-house execution</p>
            <p class="mw-task-meta">This task can be inspected but not edited while stale.</p>
          </article>
        </section>
        <section class="mw-board-column">
          <div class="mw-column-header"><strong>Ready</strong><span class="mw-column-count">2</span></div>
          <article class="mw-task-card">
            <p class="mw-task-title">Review revised milestone due dates</p>
            <p class="mw-task-meta">Waiting for fresh publish from SCR-004.</p>
          </article>
        </section>
      </div>
      <div class="mw-banner mw-banner-warn">Primary next step: reopen refinement or task synthesis instead of continuing to mutate stale tasks locally.</div>
    `,
    SIDE_COLUMN: `
      <div>
        <p class="mw-section-label">Stale reason</p>
        <h2 class="mw-section-title">Scope and Non-Scope v4 changed the execution boundary</h2>
      </div>
      <div class="mw-note">
        <p class="mw-note-copy">Vendor-led execution was removed. Downstream milestone and staffing assumptions now differ from the published task plan.</p>
      </div>
      <div class="mw-note">
        <p class="mw-section-label">Affected records</p>
        <ul class="mw-mini-list">
          <li>art_scope_non_scope_v4 approved</li>
          <li>task_plan_snapshot tp_014 stale</li>
          <li>4 tasks awaiting regenerated sequencing</li>
        </ul>
      </div>
      <div class="mw-link-card">
        <strong>Feedback route stays open</strong>
        <p class="mw-note-copy">User can still jump back to SCR-002 with task and artifact context, because handoff is not a task mutation.</p>
      </div>
    `,
    FOOTER_ACTIONS: `
      <button class="mw-button mw-button-primary" type="button">Reopen refinement</button>
      <button class="mw-button mw-button-secondary" type="button">Open task synthesis</button>
      <button class="mw-button mw-button-ghost" type="button">View read-only detail</button>
    `,
    SIDEBAR_TITLE: "Why stale locks the workspace",
    SIDEBAR_COPY:
      "If stale plans stayed editable, kanban and gantt would drift away from the latest approved artifact basis. The workspace must prefer trustworthy planning lineage over temporary editing convenience.",
    SIDEBAR_LIST: `
      <li>The stale banner explains why edits are blocked, not just that they are blocked.</li>
      <li>Read-only board and gantt still support inspection, conversation, and follow-up decisions.</li>
      <li>Returning to refinement does not create a workspace-owned feedback record.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="mw-link-card">
        <strong>Cross-domain dependency</strong>
        <p class="mw-note-copy">Brief 002 owns the artifact change that caused staleness, and brief 003 owns the fresh publish needed before SCR-005 becomes editable again.</p>
      </div>
    `,
  });

export const NoPublishedPlan = () =>
  renderTemplate({
    STATE_LABEL: "Waiting",
    STATE_CLASS: "mw-kicker-state-warn",
    STATE_META:
      "The management workspace never fabricates an editable board when no current published task plan exists for the project.",
    SCREEN_LABEL: "SCR-005 Management Workspace",
    PAGE_TITLE: "Show the route back to publish instead of pretending execution can start",
    PAGE_COPY:
      "If task synthesis has not published a current plan yet, SCR-005 becomes an empty state with clear next steps back to the review and publish boundary.",
    STATUS_STRIP: `
      <div class="mw-chip"><strong>Project</strong>prj_local_021</div>
      <div class="mw-chip"><strong>Current published plan</strong>none</div>
      <div class="mw-chip"><strong>Last task synthesis</strong>draft only</div>
      <div class="mw-chip"><strong>Allowed actions</strong>resume SCR-004</div>
    `,
    MAIN_COLUMN: `
      <div class="mw-empty">
        <p class="mw-section-label">Empty workspace state</p>
        <h2 class="mw-section-title">No current published task plan is available yet</h2>
        <p class="mw-copy">The latest synthesis result is still in review, or no task plan has been created for this project. Management views stay unavailable until SCR-004 publishes a current plan.</p>
      </div>
      <div class="mw-banner mw-banner-warn">This is not a stale state. It means the publish boundary has not produced a current plan that SCR-005 is allowed to manage.</div>
    `,
    SIDE_COLUMN: `
      <div>
        <p class="mw-section-label">Next step</p>
        <h2 class="mw-section-title">Return to task synthesis</h2>
      </div>
      <div class="mw-note">
        <p class="mw-note-copy">Resume SCR-004 to review generated tasks, make allowed corrections, and publish the task plan into the management workspace.</p>
      </div>
      <div class="mw-link-card">
        <strong>Boundary preserved</strong>
        <p class="mw-note-copy">SCR-005 never promotes draft task data to current. Publish remains a distinct user decision in task synthesis.</p>
      </div>
    `,
    FOOTER_ACTIONS: `
      <button class="mw-button mw-button-primary" type="button">Open SCR-004 task synthesis</button>
      <button class="mw-button mw-button-secondary" type="button">View artifact health</button>
    `,
    SIDEBAR_TITLE: "Why the empty state exists",
    SIDEBAR_COPY:
      "The management workspace is downstream of an explicit publish step. Showing a board before that step would hide whether the task plan is review-only, stale, or genuinely ready for execution.",
    SIDEBAR_LIST: `
      <li>No unpublished plan is ever treated as editable workspace data.</li>
      <li>The CTA routes back to SCR-004 instead of generating tasks locally.</li>
      <li>Artifact health can still provide context without implying execution readiness.</li>
    `,
    SIDEBAR_FOOTER: `
      <div class="mw-link-card">
        <strong>Shared screen rule</strong>
        <p class="mw-note-copy">CD-UI-001 keeps SCR-004 as the publish boundary and SCR-005 as the execution boundary, even when the latter has nothing to show yet.</p>
      </div>
    `,
  });
