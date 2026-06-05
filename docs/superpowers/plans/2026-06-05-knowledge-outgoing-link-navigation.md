# Knowledge Outgoing Link Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Knowledge panel outgoing link chips navigate to existing notes or create missing notes through the existing wiki-link flow.

**Architecture:** Emit a wiki navigation event from `KnowledgePanel`, forward it through `Sidebar`, and handle it in `App.vue` with the existing `handleWikiNavigate` function.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add failing E2E coverage

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] Add a test that opens a note with an outgoing link to an existing target, opens the Knowledge panel, clicks the outgoing link chip, and asserts the target tab opens.
- [ ] Add a test that opens a note with an outgoing link to a missing target, opens the Knowledge panel, clicks the outgoing link chip, and asserts the new target note is created and opened with initial heading content.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts -g "Outgoing Link"` and confirm both new tests fail before implementation.

### Task 2: Wire the navigation event

**Files:**
- Modify: `src/components/sidebar/KnowledgePanel.vue`
- Modify: `src/components/Sidebar.vue`
- Modify: `src/App.vue`

- [ ] Add `@click="emit('wiki-navigate', link)"` to each outgoing link chip in `KnowledgePanel`.
- [ ] Add `wiki-navigate` to `KnowledgePanel` and `Sidebar` emitted event types.
- [ ] Forward `@wiki-navigate` from `Sidebar` to `App.vue`.
- [ ] Bind `@wiki-navigate="handleWikiNavigate"` on the `Sidebar` instance in `App.vue`.

### Task 3: Verify

**Files:**
- No source edits unless verification finds a bug.

- [ ] Run `npm run typecheck`.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts`.
- [ ] Run `npx playwright test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
