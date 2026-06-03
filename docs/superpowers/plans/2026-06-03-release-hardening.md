# Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix release-blocking correctness, security, persistence, AI-provider, and UI reliability issues in the current local-first app.

**Architecture:** Keep the existing Vue/Vite/Electron architecture. Move reusable safety logic into focused utilities, enforce file-system invariants in services, and keep UI changes scoped to observable release behavior.

**Tech Stack:** Vue 3, Pinia, Vite, Electron, Dexie, DOMPurify, CodeMirror, Element Plus, Playwright.

---

## File Structure

- Modify `index.html`: align CSP with built-in AI providers without using unrestricted wildcards.
- Modify `src/services/fileSystem.ts`: enforce unique paths and atomic preflight checks for rename/import behavior.
- Modify `src/components/sidebar/FileExplorer.vue`: show duplicate-name errors clearly.
- Modify `src/components/ai-panel/ChatPanel.vue`: centralize chat request construction, bound persisted chat history, always include system prompt.
- Modify `src/utils/security.ts`: tighten sanitization helpers and clarify API-key obfuscation naming.
- Modify or delete `src/components/AIPanel.vue`: remove unused unsafe legacy component if it is not imported.
- Modify `src/extensions/multimodal/ChartRenderer.vue`: sanitize Mermaid SVG and render errors via textContent.
- Modify `src/extensions/ai-actions/AIActionMenuWidget.ts`: remove avoidable template `innerHTML` for local labels/icons.
- Add or modify e2e tests under `e2e/`: cover rename collision and basic security rendering.

## Tasks

### Task 1: Security And Provider Runtime

- [ ] Update CSP in `index.html` to allow OpenAI, DeepSeek, and localhost model providers while avoiding `connect-src *`.
- [ ] Replace direct unsanitized `innerHTML` in `ChartRenderer.vue` error rendering with DOM node creation and `textContent`.
- [ ] Sanitize Mermaid SVG in `ChartRenderer.vue` with the existing `sanitizeSvg` helper.
- [ ] Replace AI action button template `innerHTML` with DOM node creation and `textContent`.
- [ ] Delete `src/components/AIPanel.vue` if it has no imports; otherwise remove `v-html`.
- [ ] Run `npm run typecheck`.

### Task 2: File-System Invariants

- [ ] Add a reusable `assertPathAvailable(path, oldPath?)` check in `src/services/fileSystem.ts`.
- [ ] Make `renameFile` preflight every target path before mutating records, including directory descendants.
- [ ] Make create/import errors distinguish duplicate names from generic failures.
- [ ] Update `FileExplorer.vue` to display duplicate rename/create errors instead of swallowing them as cancel events.
- [ ] Add Playwright coverage for rename collision if the current UI can automate the context menu reliably.

### Task 3: AI Chat Reliability And Persistence

- [ ] Ensure every chat request prepends a system message.
- [ ] Include document context and RAG context as additions to the same system message instead of replacing the base role.
- [ ] Bound local chat history by count and serialized byte size.
- [ ] Make localStorage failures non-fatal and explicit in code paths.
- [ ] Run AI panel related e2e tests or add smoke coverage if missing.

### Task 4: Continued Discovery

- [ ] Search for remaining `innerHTML`, `v-html`, direct `localStorage`, broad `any`, and swallowed catches.
- [ ] Inspect Electron security defaults and package build metadata.
- [ ] Fix newly discovered release-grade defects in the same categories.
- [ ] Document residual product decisions that cannot be safely fixed without a larger requirement decision.

### Task 5: Release Gate

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npx playwright test`.
- [ ] Summarize fixed issues, remaining risks, and commands run.
