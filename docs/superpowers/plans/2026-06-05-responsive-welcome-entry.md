# Responsive Welcome Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the welcome screen usable and compelling on desktop and narrow viewports.

**Architecture:** Keep existing `WelcomePage` event contracts, refactor only its content structure and scoped styles, and add a focused Playwright regression for mobile clipping.

**Tech Stack:** Vue 3, Element Plus, Playwright, CSS.

---

### Task 1: Add Mobile Regression Coverage

**Files:**
- Modify: `e2e/security-and-ux.spec.ts`

- [x] Add a test that opens the app at `390x844`, checks the welcome title and three primary actions are visible, and asserts no horizontal overflow.
- [x] Run the test before implementation and confirm it fails because the welcome content is clipped.

### Task 2: Refactor Welcome Content

**Files:**
- Modify: `src/components/WelcomePage.vue`

- [x] Replace the centered single-column empty state with a responsive product entry layout.
- [x] Replace random emoji tips with deterministic capability items using Element Plus icons.
- [x] Add a compact workflow list that explains the app's local-first knowledge workflow.
- [x] Preserve `new-file`, `open-folder`, `demo`, and `open-file` emits.

### Task 3: Fix Responsive Layout

**Files:**
- Modify: `src/components/WelcomePage.vue`
- Modify: `src/styles/app.css`

- [x] Ensure welcome content uses available width and wraps on mobile.
- [x] On narrow screens, hide nonessential header center text and keep icon actions usable.
- [x] Ensure button touch targets are at least 44px tall on mobile.

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/security-and-ux.spec.ts -g "欢迎页"
npx playwright test e2e/sidebar.spec.ts -g "窄屏"
npx playwright test
npm run build
git diff --check
```

- [x] `npm run typecheck`
- [x] `npx playwright test e2e/security-and-ux.spec.ts -g "欢迎页|试用示例工作区|localStorage"`
- [x] `npx playwright test e2e/sidebar.spec.ts -g "窄屏"`
- [x] `npx playwright test`
- [x] `npm run build`
- [x] `git diff --check`
