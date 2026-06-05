# Sidebar Tab Persistence Implementation Plan

> **For agentic workers:** Inline execution only. Do not use subagents.

**Goal:** Persist the active sidebar tab across page reloads.

**Architecture:** Use `settingsStore.activeSidebarTab` as the single source of truth. Validate loaded storage values and route all sidebar tab changes through `settingsStore.setActiveTab`.

## Task 1: Persist Store State

- [ ] Load `active_sidebar_tab` from localStorage.
- [ ] Validate stored values against supported sidebar tabs.
- [ ] Save the tab inside `setActiveTab`.

## Task 2: Wire Sidebar to Store

- [ ] Replace local `activeTab` state in `Sidebar.vue` with a computed store value.
- [ ] Update menu selection and exposed `openTab` to call `settingsStore.setActiveTab`.

## Task 3: Add Regression Coverage

- [ ] Add a Playwright test that selects a sidebar tab, reloads, and verifies the same tab is active.

## Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/sidebar.spec.ts
npx playwright test
npm run build
git diff --check
```
