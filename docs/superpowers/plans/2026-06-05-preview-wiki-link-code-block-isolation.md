# Preview Wiki Link Code Block Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Wiki Link syntax inside preview code blocks and inline code literal.

**Architecture:** Replace `Preview.vue`'s pre-render placeholder replacement with a Markdown-it inline rule that only runs in Markdown inline content. Existing preview navigation events and missing-link styling stay unchanged.

**Tech Stack:** Vue 3, TypeScript, Markdown-it, Playwright.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `e2e/preview-security.spec.ts`

- [x] Extend the existing preview feature test with fenced code and inline code containing `[[README]]`.
- [x] Assert that only the prose Wiki Link renders as `.wiki-link`.
- [x] Assert code elements still contain literal `[[README]]`.
- [x] Run `npx playwright test e2e/preview-security.spec.ts -g "KaTeX"` and confirm it fails before implementation.

### Task 2: Move Wiki Link Rendering Into Markdown-it

**Files:**
- Modify: `src/components/Preview.vue`

- [x] Remove the pre-render `extractWikiLinks` and `restoreWikiLinks` replacement path.
- [x] Add a Markdown-it inline rule for `[[target]]` and `[[target|alias]]`.
- [x] Render a `link_open`, `text`, and `link_close` token sequence with `wiki-link-exists` or `wiki-link-missing`.
- [x] Keep `data-filename` so existing click navigation keeps working.

### Task 3: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/preview-security.spec.ts -g "KaTeX"
npx playwright test
npm run build
git diff --check
```
