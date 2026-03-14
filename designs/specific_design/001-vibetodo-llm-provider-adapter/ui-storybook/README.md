# UI Storybook

This directory is the UI design source of truth for Storybook HTML.

## Purpose

- Define reviewable UI states with `@storybook/html`
- Keep screen variants and HTML templates together
- Link UI states back to requirements and field definitions

## Design Note

本設計 (`001-vibetodo-llm-provider-adapter`) はユーザー向け UI 画面を持たないインフラストラクチャ層である。
Storybook は実際のユーザー画面の代わりに、LLM プロバイダー設定インターフェースの契約と構成パターンを
開発者向けドキュメントとして可視化する目的で使用する。

SCR-002 Refinement Loop 等の実際のユーザー画面は、各 feature の specific design bundle で定義する。

## Structure

- `package.json`: pinned Storybook runtime and scripts
- `.storybook/main.ts`: Storybook configuration
- `.storybook/preview.ts`: shared preview parameters
- `.storybook/preview.css`: global review styles
- `stories/`: story definitions
- `components/`: HTML templates used by stories

## Stories

- `SCR-001-provider-config.stories.js` — LLM プロバイダー設定インターフェース（環境変数スキーマ）の可視化

## Local Review

```bash
npm install
npm run storybook
```

To verify the bundle in CI or before handoff:

```bash
npm run build-storybook
```

## Rules

- Stories are design artifacts, not production runtime code
- Keep stories aligned with `ui-fields.yaml`
- Add one story per meaningful screen or UI state
- Keep the bundle buildable without adding app-specific tooling first
