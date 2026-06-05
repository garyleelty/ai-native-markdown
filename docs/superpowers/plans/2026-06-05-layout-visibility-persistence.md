# Layout Visibility Persistence Implementation Plan

> **For agentic workers:** Inline execution only. Do not use subagents.

**Goal:** Persist sidebar and AI panel visibility across reloads.

## Task 1: Store State

- [ ] Load `show_sidebar` and `show_ai_panel` from localStorage.
- [ ] Add explicit setters for both values.
- [ ] Make existing toggle methods delegate to the setters.

## Task 2: App Wiring

- [ ] Replace direct `settingsStore.showSidebar = true` assignments with `setSidebarVisible(true)`.
- [ ] Keep existing header and Settings panel controls working through the toggle methods.

## Task 3: Regression Coverage

- [ ] Test sidebar visibility survives reload.
- [ ] Test AI panel visibility survives reload.
- [ ] Test the Settings panel AI switch reflects persisted state.

## Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/sidebar.spec.ts
npx playwright test
npm run build
git diff --check
```
