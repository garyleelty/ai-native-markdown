# UX Health Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore TypeScript health and reduce friction in high-frequency editor/settings workflows.

**Architecture:** Keep changes surgical and aligned with the existing Vue 3 + Element Plus component structure. Fix test fixture type drift without changing services, then improve dense UI surfaces by using existing dropdown/collapse primitives rather than broad refactors.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Vitest, vue-tsc.

---

### Task 1: Typecheck Fixture Alignment

**Files:**
- Modify: `src/services/__tests__/frontmatterService.test.ts`
- Modify: `src/services/__tests__/rss.test.ts`

- [ ] **Step 1: Type property preferences explicitly**

Update merge-property test fixtures so TypeScript preserves literal `PropertyType` values instead of widening them to `string`.

- [ ] **Step 2: Complete RSS article fixtures**

Add `isRead: false` to every handwritten `RSSArticle` object in RSS tests.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no fixture-related TypeScript errors.

### Task 2: Compact Editor Toolbar

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Keep frequent actions visible**

Visible toolbar actions remain: undo, redo, save, bold, italic, inline code, code block, link, unordered list, ordered list, live preview.

- [ ] **Step 2: Move secondary actions into More menu**

Move H1/H2/H3, strikethrough, quote, image, task list, word wrap, voice input, and ghost text into an Element Plus dropdown labeled `更多`.

- [ ] **Step 3: Preserve accessibility**

Keep `aria-label` on all interactive buttons and use native button types for dropdown commands.

### Task 3: Settings Panel Progressive Disclosure

**Files:**
- Modify: `src/components/sidebar/SettingsPanel.vue`

- [ ] **Step 1: Wrap sections in collapse groups**

Use `el-collapse` and `el-collapse-item` to group 外观, 编辑器, AI, and 高级 sections.

- [ ] **Step 2: Default common sections open**

Initialize active groups to `appearance` and `editor`, leaving AI and advanced collapsed.

- [ ] **Step 3: Preserve all controls**

Move existing controls without changing store behavior or emitted setting changes.

### Task 4: Validation

**Files:**
- Read: command output

- [ ] **Step 1: Run targeted checks**

Run: `npm run typecheck`
Expected: pass or only unrelated pre-existing failures documented.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: pass or only unrelated pre-existing failures documented.
