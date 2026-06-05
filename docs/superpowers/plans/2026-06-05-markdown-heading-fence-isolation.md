# Markdown Heading Fence Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent headings inside fenced code blocks from appearing in heading completion, outline, or heading navigation.

**Architecture:** Add one shared Markdown heading parser in `src/utils/wikiLinks.ts`, then replace duplicated line-regex parsing in `Editor.vue` and `OutlinePanel.vue`.

**Tech Stack:** Vue 3, TypeScript, Playwright.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [x] Add a current-document heading completion test where `## Fake Heading` appears inside a fenced code block.
- [x] Add a cross-document heading completion test where `## Fake Heading` appears inside the target note's fenced code block using tilde fences.
- [x] Add an outline test where `## Fake Heading` inside a fenced code block is not listed.
- [x] Add a preview Wiki Link heading navigation test where an earlier code-block heading has the same text as the real target heading.
- [x] Run `npx playwright test e2e/file-and-editor.spec.ts -g "代码块"` and confirm the new tests fail before implementation.

### Task 2: Add Shared Heading Parser

**Files:**
- Modify: `src/utils/wikiLinks.ts`
- Modify: `src/utils/index.ts`

- [x] Export a `MarkdownHeading` interface.
- [x] Export `extractMarkdownHeadings(content)` that skips backtick and tilde fenced code blocks.
- [x] Make `findMarkdownHeadingLine` use `extractMarkdownHeadings`.
- [x] Re-export the parser from `src/utils/index.ts`.

### Task 3: Wire Parser Into UI

**Files:**
- Modify: `src/components/Editor.vue`
- Modify: `src/components/editor/OutlinePanel.vue`

- [x] Replace local heading parsing in `Editor.vue` with `extractMarkdownHeadings`.
- [x] Replace local heading parsing in `OutlinePanel.vue` with `extractMarkdownHeadings`.
- [x] Keep existing suggestion labels and outline styling unchanged.

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/file-and-editor.spec.ts -g "代码块"
npx playwright test e2e/file-and-editor.spec.ts -g "Wiki Link .*标题补全"
npx playwright test
npm run build
git diff --check
```
