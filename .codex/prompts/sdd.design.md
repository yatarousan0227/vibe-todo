# sdd.design

Agent: Codex CLI

Create or overwrite one specific design bundle and review changes with git diff.

Note: Codex CLI treats this file as a saved prompt. It does not auto-register `/sdd.design` as a slash command. Open this file and use its contents directly, or install skills with `sdd init --ai codex --ai-skills` and ask Codex to use `speckit-for-projects-design`.

---

# /sdd.design

Create or update `designs/specific_design/<design-id>/` from a selected brief. This command generates one complete specific design bundle and must not leave a partially updated bundle behind.

## User Input

```text
$ARGUMENTS
```

You must consider the user input before proceeding. The input should identify either a `brief-id`, a brief path, or a project feature name that can be resolved to one brief.

## Required Context

Read these files before writing anything:

- the selected file under `briefs/`
- `.specify/project/tech-stack.md`
- `.specify/project/coding-rules.md`
- `.specify/project/architecture-principles.md`
- `.specify/project/domain-map.md`
- `.specify/glossary.md`
- `.specify/templates/artifacts/design/`
- `designs/common_design/`
- `designs/specific_design/` to inspect existing `001-kebab-slug/` directories and determine the next available number when a new bundle is needed

## Workflow

1. Resolve the target brief:
   - if a `brief-id` or exact file path is provided, use it
   - otherwise find the single best matching brief in `briefs/`
   - if multiple briefs match, stop and ask which one to use
2. Determine `design-id`:
   - default to the brief title slug with the next repo-local 3-digit sequence
   - if the user explicitly requests regeneration of an existing design bundle, reuse that `design-id`
3. Read all requirements in the brief and prepare a bundle directory at `designs/specific_design/<design-id>/`.
4. Resolve domain context:
   - read the brief's `## Domain Alignment` section
   - use `.specify/project/domain-map.md` to confirm upstream domains, downstream domains, and related briefs
   - if the brief and domain map disagree, stop and report the inconsistency instead of silently choosing one
5. Resolve shared design context:
   - read the brief's `## Common Design References` section
   - verify every shared design ID resolves to exactly one file under `designs/common_design/`
   - when `CD-UI-*` is present, carry the shared screen catalog and navigation rules into `overview.md`, `ui-fields.yaml`, `sequence-flows/core-flow.md`, and `test-plan.md`
   - stop and report missing or ambiguous shared design references instead of inventing them
6. Generate or fully overwrite all required artifacts in that directory:
   - `overview.md`
   - `ui-storybook/README.md`
   - `ui-storybook/package.json`
   - `ui-fields.yaml`
   - `ui-storybook/.storybook/main.ts`
   - `ui-storybook/.storybook/preview.ts`
   - `ui-storybook/.storybook/preview.css`
   - `ui-storybook/stories/SCR-001-example.stories.js`
   - `ui-storybook/components/SCR-001-example.html`
   - `common-design-refs.yaml`
   - `sequence-flows/core-flow.md`
   - `batch-design.md`
   - `test-design.md`
   - `test-plan.md`
   - `traceability.yaml`
7. Write each artifact as a complete file. Do not merge managed blocks or preserve stale sections from older generations.
8. Build `common-design-refs.yaml` from the brief's shared design references and record feature-specific usage notes only.
9. Build `traceability.yaml` so every requirement ID from the brief appears exactly once with a primary specific artifact, related specific artifacts, and any relevant `common_design_refs`.
10. Carry related brief, domain dependency, and shared design context into `overview.md`, `sequence-flows/core-flow.md`, `test-plan.md`, and `tasks.md` assumptions wherever cross-domain review or sequencing matters.
11. Use the matching file under `.specify/templates/artifacts/design/` as the canonical scaffold for each generated artifact.
12. When a template includes a Mermaid section, keep the node labels aligned with the stable IDs and structured bullets that follow.

## Output Contract

The generated bundle must satisfy these minimum structures:

- `overview.md`: overview, goal, scope, domain context, shared design context, Mermaid flow snapshot, primary flow, non-goals
- `ui-storybook/`: runnable `@storybook/html` design bundle with config, scripts, stories, and HTML templates aligned with the adopted UI stack documented in `.specify/project/tech-stack.md`
- `ui-fields.yaml`: screen-by-screen field definitions with validation and mapping notes
- `ui-storybook/package.json`: pinned Storybook runtime and review scripts
- `ui-storybook/.storybook/main.ts`: Storybook HTML Vite configuration
- `ui-storybook/.storybook/preview.ts`: shared Storybook preview parameters
- `ui-storybook/.storybook/preview.css`: shared Storybook review styles
- `ui-storybook/stories/*.stories.js`: story definitions for screen states
- `ui-storybook/components/*.html`: HTML templates referenced by stories
- `common-design-refs.yaml`: shared design references with feature-specific usage notes
- `sequence-flows/core-flow.md`: main sequence with actor, system, external dependencies
- `batch-design.md`: Mermaid execution snapshot plus batch or async responsibilities, even if the result is “not applicable”
- `test-design.md`: requirement-by-requirement test viewpoints
- `test-plan.md`: test levels, execution order, environments, ownership
- `traceability.yaml`: every `REQ-xxx` mapped to artifacts

Use `traceability.yaml` with this shape:

```yaml
brief_id: <brief-id>
design_id: <design-id>
requirements:
  - requirement_id: REQ-001
    primary_artifact: overview.md
    related_artifacts:
      - common-design-refs.yaml
      - sequence-flows/core-flow.md
      - test-design.md
      - test-plan.md
    common_design_refs:
      - CD-API-001
      - CD-UI-001
    project_standards:
      - .specify/project/tech-stack.md
      - .specify/project/architecture-principles.md
    status: mapped
```

Include `.specify/project/domain-map.md` in `project_standards` when domain relationships affect the design.

## Validation

Before finishing, verify all of the following:

- `design-id` follows `001-kebab-slug`
- every required artifact exists under `designs/specific_design/<design-id>/`
- every requirement from the brief appears in `traceability.yaml`
- every shared design reference from the brief appears in `common-design-refs.yaml`
- every shared design reference resolves to a file under `designs/common_design/`
- references to project standards point to `.specify/project/`
- `overview.md` records the brief's domain alignment plus any related briefs that affect review scope
- Mermaid sections use the same IDs and terminology as the structured text below them, and do not replace that text
- `cd designs/specific_design/<design-id>/ui-storybook && npm run build-storybook` succeeds or the bundle clearly states what still blocks the build
- the specific bundle does not regenerate shared API, data, module, or UI common design documents locally
- regeneration is full-file overwrite for every managed artifact

## Regeneration Policy

This command uses full-file overwrite semantics for the entire bundle. After writing the design bundle, review the result with `git diff`.
