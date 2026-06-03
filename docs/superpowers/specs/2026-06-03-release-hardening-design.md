# Release Hardening Design

## Goal

Prepare AI Native Markdown for a production-quality release by fixing known correctness, security, persistence, AI-provider, and UI reliability issues, then continuing discovery with targeted scans and tests until the remaining risks are explicit.

## Scope

This hardening pass covers the existing Vue/Vite/Electron application. It does not replace the product architecture, add cloud sync, or introduce a new backend. The work focuses on defects and release blockers in the current local-first app.

## Known Issues To Fix

- CSP currently blocks advertised providers such as DeepSeek and remote OpenAI-compatible endpoints.
- File and folder rename can collide with an existing path because `fileSystem.renameFile` does not validate the target path.
- AI chat does not always send the default system prompt, which makes behavior inconsistent across empty-context, document-context, and RAG-context chats.
- API key storage uses static frontend obfuscation. The UI and docs must not imply cryptographic security, and Electron secure storage should be used only if a reliable local implementation is available in this app.
- Legacy or unused components still contain unsafe `innerHTML` or `v-html` patterns.
- Some local persistence paths write large or sensitive data to localStorage without size bounds, failure reporting, or a clear privacy model.

## Architecture

The hardening keeps the current architecture: Vue components call Pinia stores and service modules, while IndexedDB/Dexie remains the local data store. Fixes should improve boundaries inside the existing structure instead of introducing broad framework changes.

Security-sensitive helpers stay in `src/utils/security.ts`. Storage helpers should be centralized there or in a focused storage utility so components do not each implement fragile localStorage handling. File system invariants belong in `src/services/fileSystem.ts`, because UI validation alone cannot protect all callers.

AI provider behavior stays in `src/services/ai.ts` and UI configuration stays in `src/components/sidebar/AIConfigPanel.vue`. Chat request assembly should be deterministic and easy to test from `src/components/ai-panel/ChatPanel.vue` or a new focused helper if extraction reduces complexity.

## Data And Error Handling

File paths must remain unique. Creating, importing, and renaming files should either complete with a single clear result or fail before mutating data. Directory rename must check every descendant target before writing changes.

Knowledge index sync must remain non-blocking for user file operations, but stale state must be recorded when index sync fails. User-facing file operations should still surface real file system failures.

AI provider requests must fail with actionable messages. Browser CSP should allow built-in supported providers and preserve local model support. Fully arbitrary remote custom endpoints are a product/security tradeoff; this pass will support the currently exposed provider choices without weakening CSP to `connect-src *`.

## UI

The UI should keep the existing Obsidian-like workbench style. Fixes should improve states that matter for release: connection failure, duplicate file name, AI request failure, empty knowledge graph, and long chat history. This pass should not redesign the whole application.

Unused components that create security or maintenance risk should be deleted if no imports reference them. Used components should avoid direct HTML injection unless the content is sanitized at the boundary and the reason is clear.

## Testing

The release gate for this pass is:

- `npm run typecheck`
- `npm run build`
- `npx playwright test`

Add or update Playwright tests for user-visible regressions where practical: AI provider configuration, file rename conflicts, and security rendering behavior. If a behavior cannot be tested without a larger harness, document the residual risk in the final report.

## Non-Goals

- No cloud sync.
- No account system.
- No plugin marketplace.
- No promise that API keys are secure in browser-only mode.
- No unbounded CSP wildcard for all HTTPS endpoints unless the user explicitly accepts that release risk.

## Release Criteria

The pass is complete when known release blockers are fixed, new findings from targeted scans are either fixed or documented, and all release gate commands pass locally.
