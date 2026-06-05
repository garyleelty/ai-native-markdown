# Preview Wiki Link Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered preview Wiki Links open existing Markdown files.

**Architecture:** Keep parsing in a focused utility, wire `Preview.vue` navigation through `App.vue`, and reuse the existing `handleFileSelect` open/save flow. E2E tests cover the user workflow instead of only utility behavior.

**Tech Stack:** Vue 3, TypeScript, Pinia, Playwright.

---

### Task 1: Add Wiki Link Target Resolution

**Files:**
- Create: `src/utils/wikiLinks.ts`

- [x] Add a pure resolver that accepts the raw link target, the current file path, and known Markdown file paths.

```ts
function resolveWikiLinkTarget(rawTarget: string, currentFile: string, markdownPaths: string[]): string | null
```

- [x] Strip alias fragments before matching while preserving the optional heading fragment for post-open navigation.
- [x] Try absolute, workspace-root, current-folder-relative, and unique basename candidates.
- [x] Add a helper that returns the source line for a Markdown heading using normalized slug/text comparison.
- [x] Treat heading-only links like `[[#Heading]]` as current-document navigation and use the live editor content.

### Task 2: Wire Preview Navigation

**Files:**
- Modify: `src/App.vue`
- Modify: `src/utils/index.ts`

- [x] Add `@navigate="handleWikiNavigate"` to the `Preview` component.
- [x] Load Markdown paths through `fileSystem.getAllMarkdownFiles()`.
- [x] Resolve the target with `resolveWikiLinkTarget`.
- [x] Call `handleFileSelect(resolvedPath)` on success.
- [x] If the link includes `#Heading`, find the target heading line after opening and scroll both editor and preview surfaces to that line.
- [x] Show `ElMessage.warning('未找到链接目标: ...')` on failure.
- [x] Export the utility from `src/utils/index.ts`.

### Task 3: Cover The User Workflow

**Files:**
- Modify: `e2e/preview-security.spec.ts`

- [x] Create `/workspace/notes/wiki-target.md`.
- [x] Put `[[notes/wiki-target|Target Note]]` in the current document.
- [x] Switch to preview mode, click `Target Note`, and assert the target tab/content opens.
- [x] Put `[[notes/wiki-target#Deep Heading|Deep]]` in the current document and assert the target preview highlights `Deep Heading`.
- [x] Put `[[#Deep Heading|Deep]]` in the current document and assert preview highlights `Deep Heading`.

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/preview-security.spec.ts
npx playwright test
npm run build
git diff --check
```
