# RAG Current Document Send Index Design

## Problem

AI chat only queries the existing RAG index. The current document is indexed during save when RAG is enabled, but a user can ask AI before autosave runs or after editing unsaved content. In that case, the assistant can miss the most relevant local context even though it is visible in the editor.

## Decision

When RAG is enabled and the user sends a chat message, `ChatPanel` should best-effort index the active editor document before calling `ragService.buildContext()`.

This keeps RAG local-first and predictable:

- If the active file and content are available, index that content under the active path.
- If indexing fails, continue the AI request with regular document context instead of blocking chat.
- Do not save the file as a side effect; this only updates the RAG index.
- Keep the existing `context` prop for selected text or clipped document context.

## Acceptance

- A newly edited current document can contribute RAG context to the AI request before manual save or autosave.
- The request still succeeds if RAG indexing fails.
- The existing base system prompt and document context behavior stay intact.
