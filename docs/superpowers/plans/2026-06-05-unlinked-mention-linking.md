# Unlinked Mention Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click action that converts Knowledge panel unlinked mentions into wiki links.

**Architecture:** Add a safe text replacement utility in `wikiLinks`, expose an optional action from `ReferenceList`, emit a `link-mention` event from `KnowledgePanel`, and perform file write/update orchestration in `App.vue`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add failing coverage

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] Add a test where a source note contains an unlinked alias mention on a known line.
- [ ] Open the target note, refresh Knowledge panel, switch to mentions, click the row action button labeled `链接`.
- [ ] Assert the source workspace file contains `[[Target Title]]`.
- [ ] Assert the mention list no longer shows the source after refresh.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts -g "一键链接"` and confirm it fails before implementation.

### Task 2: Add safe replacement utility

**Files:**
- Modify: `src/utils/wikiLinks.ts`
- Modify: `src/utils/index.ts`

- [ ] Export `linkFirstUnlinkedMention(content, names, targetTitle, options)` from `wikiLinks`.
- [ ] Prefer `options.lineNumber` when searching.
- [ ] Skip matches inside `[[...]]`.
- [ ] Preserve the rest of the document unchanged.

### Task 3: Add UI event plumbing

**Files:**
- Modify: `src/components/sidebar/ReferenceList.vue`
- Modify: `src/components/sidebar/KnowledgePanel.vue`
- Modify: `src/components/Sidebar.vue`

- [ ] Add optional `actionLabel` prop and `action` emit to `ReferenceList`.
- [ ] Add a compact `.reference-action` button with `@click.stop`.
- [ ] Pass `action-label="链接"` for unlinked mentions.
- [ ] Emit `link-mention` with reference, target title, and target names.
- [ ] Forward the event through `Sidebar`.

### Task 4: Write the source file and update open tabs

**Files:**
- Modify: `src/App.vue`

- [ ] Add `handleLinkMention`.
- [ ] Use open tab content when the source file is already open; otherwise read from `fileSystem`.
- [ ] Call `linkFirstUnlinkedMention`.
- [ ] Write the updated source through `fileSystem.writeFile`.
- [ ] Update the editor/open tab if that file is already open.
- [ ] Refresh markdown paths and show success/failure messages.

### Task 5: Verify

**Files:**
- No source edits unless verification finds a bug.

- [ ] Run `npm run typecheck`.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts`.
- [ ] Run `npx playwright test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
