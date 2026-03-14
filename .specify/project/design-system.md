# Design System

VibeToDo uses a local design system because the product combines AI-assisted document refinement, approval workflows, and management views that are not well covered by a generic vendor component library alone.

## Applicability Check

- Adopted external design system, if any: `none` for the MVP baseline
- Additional local rules beyond the adopted system:
  - editorial workbench visual language for planning-heavy screens
  - Atomic Design taxonomy for reusable UI
  - Storybook storyboard review for the full refinement-to-management flow
  - artifact lifecycle states and task-management state naming
- Decision: `Fill this file`

## Design System Decision

The project uses a local design system with the working visual identity `Strategic Workbench`.

- Primary goal: make AI-supported planning feel calm, traceable, and operational instead of chat-like or toy-like
- Product posture: document-first refinement with management surfaces that feel connected to the same source of truth
- Implementation direction: external primitives may be adopted later, but the public component model, naming, and review rules are defined locally in this repository

## Visual Direction

- Core mood: editorial planning desk plus operations console
- Visual balance:
  - warm canvas surfaces for document work
  - darker structured panels for status, dependencies, and timeline information
  - teal as the forward-action color
  - amber and rust only for caution, stale state, or blocking decisions
- Motion direction:
  - progress should feel directional and calm
  - use staged reveal and status transitions to show refinement progress
  - avoid decorative motion that competes with reading and approval tasks

## Component Taxonomy

Atomic Design is required at the project level.

- `atoms`
  - smallest reusable controls and semantic indicators
  - examples: action buttons, status pills, tabs, badges, labels, input primitives
  - source directory: `.specify/project/ui-storybook/components/atoms/`
- `molecules`
  - compact combinations that express a single planning concept
  - examples: guided prompt cards, artifact progress cards, task summary cards, approval callouts
  - source directory: `.specify/project/ui-storybook/components/molecules/`
- `organisms`
  - dense working sections that combine multiple planning actions
  - examples: refinement workbench, kanban board, gantt strip, artifact review rail
  - source directory: `.specify/project/ui-storybook/components/organisms/`
- `templates`
  - page structures with stable layout regions but without screen-specific data contracts
  - examples: refinement studio template, management console template
  - source directory: `.specify/project/ui-storybook/components/templates/`
- `pages`
  - representative storyboard screens that show end-to-end product moments
  - examples: intake, refinement loop, approval, task synthesis, management workspace
  - source directory: `.specify/project/ui-storybook/components/pages/`

## Storybook Review Model

Storybook is required for project-level UI review.

- Project-level Storybook files:
  - `.specify/project/ui-storybook/stories/`
  - `.specify/project/ui-storybook/components/`
  - `.specify/project/ui-storybook/.storybook/`
- Feature-level bundles under `designs/specific_design/<design-id>/ui-storybook/` extend the project-level design system. They do not replace naming, status, or accessibility rules defined here.
- Shared screen catalogs and shared navigation rules remain in `designs/common_design/ui/`. Project Storybook is the implementation-oriented storyboard and component review surface.
- Required story title conventions:
  - `Atoms/<ComponentName>`
  - `Molecules/<ComponentName>`
  - `Organisms/<ComponentName>`
  - `Templates/<ComponentName>`
  - `Pages/<nn ScreenName>`
- Required page storyboard sequence:
  - `Pages/01 IntakeStart`
  - `Pages/02 RefinementLoop`
  - `Pages/03 ArtifactApproval`
  - `Pages/04 TaskSynthesis`
  - `Pages/05 ManagementWorkspace`
- Required review states:
  - default resting state
  - active editing state
  - loading or in-progress AI state when applicable
  - approved or complete state when applicable
  - stale, warning, or blocked state when applicable

## Naming And Variant Rules

- Component names must describe the product concept, not only the HTML shape
  - use `ArtifactStatusPill`, not `RoundedBadge`
  - use `GuidedPromptCard`, not `PanelWithButton`
- Variant names should align with domain language
  - actions: `primary`, `secondary`, `ghost`, `danger`
  - artifact states: `draft`, `in_review`, `approved`, `stale`
  - task states: `backlog`, `ready`, `in_progress`, `blocked`, `done`
- Avoid product-agnostic names like `item`, `box`, `thing`, or `panel2`

## Composition Rules

- Create a new `atom` when the same visual primitive appears in three or more places with the same semantics
- Create a new `molecule` when multiple atoms are repeatedly combined to express one planning concept
- Create a new `organism` when a section owns a meaningful workflow boundary such as artifact review or board management
- Keep page-specific presentation local to a `page` story if the pattern is not expected to survive across features
- Conversational UI must always stay subordinate to the current project or artifact context; never model it as a standalone assistant shell

## Tokens And Layout Primitives

- Typography:
  - display and artifact headings use a serif family to reinforce document quality
  - controls, metadata, and dense operational UI use a sans-serif family
  - line lengths should favor reading and review, not marketing-style hero layouts
- Spacing scale:
  - base spacing unit: `8px`
  - dense stacks: `8px` to `12px`
  - section spacing: `16px` to `24px`
  - page gutters: `24px` desktop, `16px` tablet, `12px` mobile
- Color system:
  - canvas and surfaces are warm neutrals
  - accent color is teal for commit or continue actions
  - caution color is amber for unresolved questions
  - danger color is rust for destructive or blocking states
  - deep slate is reserved for structure, navigation, and timeline context
- Shape and elevation:
  - default radius: `16px`
  - compact controls may use fully rounded pills
  - shadows should be soft and broad; avoid sharp floating-card aesthetics
- Breakpoints:
  - mobile: up to `767px`
  - tablet: `768px` to `1023px`
  - desktop: `1024px` and above

## Accessibility

- Every interactive control must have a visible focus state with at least 3:1 contrast against adjacent colors
- Keyboard order must follow the planning flow: navigation, current artifact context, main document area, assistant actions, secondary panels
- Status must never rely on color alone; pair color with text labels such as `Approved` or `Blocked`
- Dense management views must preserve readable row and column headings for screen readers
- Approval decisions, AI progress, and stale downstream state changes must be announced in text, not only visually

## Review Policy

- All shared atoms, molecules, organisms, templates, and storyboard pages must have Storybook stories
- Every new workflow must demonstrate where human approval happens before AI-generated downstream data becomes trusted
- Page stories must show how document refinement connects to task planning and management views, not isolated screens with no transition logic
- Design handoff is not complete until both of the following are true:
  - the relevant component stories exist
  - the affected storyboard page sequence still reads as one coherent user journey
