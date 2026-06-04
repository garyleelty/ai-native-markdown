# File Lifecycle Index Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep version history and RAG indexes aligned when workspace files or folders are renamed or deleted.

**Architecture:** `fileSystem` remains the authoritative lifecycle coordinator. File mutations commit first, then secondary stores sync best-effort so a history/RAG failure cannot roll back the user's filesystem operation.

**Tech Stack:** Vue 3 app services, Dexie IndexedDB stores, Playwright E2E/service integration tests.

---

### Task 1: Regression Tests

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] Add a service-level test that saves a version snapshot and indexes a RAG document for `/workspace/Lifecycle.md`, renames it to `/workspace/Lifecycle Renamed.md`, then verifies history snapshots and RAG documents/search results only use the new path.
- [ ] Add a service-level test that saves/indexes `/workspace/RemoveMe.md`, deletes it, then verifies history snapshots and RAG documents/search results are gone.
- [ ] Add a service-level test that saves/indexes files under `/workspace/FolderA`, renames the folder to `/workspace/FolderB`, then verifies descendant paths move in both secondary stores.
- [ ] Add a service-level test that saves/indexes files under `/workspace/DeleteFolder`, deletes the folder, then verifies descendant records are removed.

Run: `npx playwright test e2e/knowledge-export-history.spec.ts`
Expected first run before implementation: lifecycle tests fail because secondary stores still point to old paths.

### Task 2: Version History and RAG API

**Files:**
- Modify: `src/services/versionHistory.ts`
- Modify: `src/services/rag.ts`

- [ ] Add prefix delete and rename helpers to `versionHistory`.
- [ ] Add prefix delete and rename helpers to `ragService`, keeping document titles derived from the new path.
- [ ] Keep all helpers idempotent: missing records should be a no-op.

Run: `npm run typecheck`
Expected: no TypeScript errors.

### Task 3: FileSystem Coordination

**Files:**
- Modify: `src/services/fileSystem.ts`

- [ ] Import `versionHistory` and `ragService`.
- [ ] Add a generic best-effort secondary index sync helper.
- [ ] After delete, remove matching records from knowledge index, version history, and RAG.
- [ ] After rename, migrate matching records in knowledge index, version history, and RAG.
- [ ] Keep file mutation success independent from secondary store sync failures.

Run: `npx playwright test e2e/knowledge-export-history.spec.ts`
Expected: all tests in the file pass.

### Task 4: Full Verification

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```

Expected: all commands succeed.
