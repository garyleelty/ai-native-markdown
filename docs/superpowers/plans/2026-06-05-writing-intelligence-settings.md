# Writing Intelligence Settings Implementation Plan

> **For agentic workers:** Inline execution only. Do not use subagents.

**Goal:** Expose writing intelligence controls in Settings and make them persistent and live-updating.

## Task 1: Store API

- [ ] Add setters for RAG, AI actions, smart paste, and inline edit.
- [ ] Persist all four flags through localStorage.

## Task 2: Settings UI

- [ ] Add a `写作智能` section to `SettingsPanel.vue`.
- [ ] Add switch rows for knowledge-enhanced chat, AI inline actions, smart paste, and inline edit.

## Task 3: Editor Runtime Wiring

- [ ] Put smart paste behind a CodeMirror compartment.
- [ ] Reconfigure smart paste when `enableSmartPaste` changes.

## Task 4: Regression Coverage

- [ ] Add a Playwright test for toggling the four settings.
- [ ] Verify values survive page reload.

## Task 5: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/sidebar.spec.ts
npx playwright test
npm run build
git diff --check
```
