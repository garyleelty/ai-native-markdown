# Mobile Sidebar Drawer Interactions Implementation Plan

**Goal:** Make the narrow-screen sidebar drawer behave like a reliable product interaction, not only a layout fix.

**Architecture:** Keep drawer state in `App.vue` as local viewport UI state. Keep desktop sidebar persistence in `settingsStore`. Add Playwright coverage in `e2e/sidebar.spec.ts`.

**Tech Stack:** Vue 3, CSS, Element Plus, Playwright.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `e2e/sidebar.spec.ts`

- [x] Add a mobile test for toggle open, drawer width, backdrop visibility, and backdrop close.
- [x] Add a mobile test for Escape close.
- [x] Add a mobile test for selecting a file from the drawer closing it and showing the editor.

### Task 2: Fix Interaction Gaps

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles/app.css`

- [x] Ensure toggle uses local mobile state and does not mutate persisted desktop sidebar visibility.
- [x] Ensure backdrop and Escape close only mobile drawer state.
- [x] Ensure content selection closes the drawer after successful navigation.
- [x] Keep mobile drawer width capped at 86vw and desktop behavior unchanged.

### Task 3: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/sidebar.spec.ts -g "窄屏|移动端"
npx playwright test
npm run build
git diff --check
```

- [x] `npx playwright test e2e/sidebar.spec.ts -g "移动端"`
- [x] `npm run typecheck`
- [x] `npx playwright test e2e/sidebar.spec.ts -g "窄屏|移动端"`
- [x] `npx playwright test e2e/knowledge-export-history.spec.ts -g "窄屏下导出弹窗"`
- [x] `npx playwright test`
- [x] `npm run build`
- [x] `git diff --check`

**Follow-up found during full regression:** `loadDemoWorkspace` used an optional visibility check before clicking the demo workspace button, which could leave a full-suite run waiting for `.el-tree` without having established the workspace precondition. The helper now treats demo loading as required setup: reuse an existing tree if present, otherwise require the demo button, click it, and wait for the tree.
