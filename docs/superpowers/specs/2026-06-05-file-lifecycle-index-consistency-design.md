# File Lifecycle Index Consistency Design

## Goal

Keep secondary data stores consistent when files or folders are renamed or deleted from the local workspace.

## Problem

The file system already updates Markdown files and the knowledge index during rename/delete operations. Version history and RAG indexes are only written during saves, so a rename can leave historical snapshots and RAG chunks under the old path. Folder delete can also leave stale descendant RAG/history records.

This creates user-visible failures:

- Version history disappears after renaming a file.
- AI RAG context can cite deleted or old paths.
- Folder rename/delete can leave stale records for nested notes.

## Design

Use `fileSystem` as the authoritative lifecycle coordinator:

- `versionHistory.renameFile(oldPath, newPath)` moves snapshots to the new file path.
- `versionHistory.renameByPrefix(oldPrefix, newPrefix)` moves all descendant snapshots.
- `versionHistory.clearByPrefix(prefix)` deletes snapshots for a file or folder subtree.
- `ragService.renameDocument(oldPath, newPath)` moves chunks and metadata.
- `ragService.renameByPrefix(oldPrefix, newPrefix)` moves all descendant records.
- `ragService.deleteByPrefix(prefix)` removes records for a file or folder subtree.

`fileSystem.renameFile` already builds the exact old/new path list. Reuse that list after the file transaction commits:

- For every renamed Markdown file, update knowledge index, version history, and RAG.
- Directory records are ignored by RAG/history because they have no content.

`fileSystem.deleteFile` already collects every removed path. Reuse those paths:

- Remove knowledge index entries.
- Remove version history and RAG records for removed Markdown files.
- For directories, prefix cleanup catches any descendant records that were stale before the delete.

## Error Handling

Secondary store failures must not roll back the file operation. They should be best-effort, matching the existing knowledge index behavior. If one secondary sync fails, continue syncing the others and log the failure.

## Tests

Add Playwright service-level coverage:

- Renaming a file moves version history and RAG records to the new path.
- Deleting a file removes version history and RAG records.
- Renaming a folder moves descendant version history and RAG records.
- Deleting a folder removes descendant version history and RAG records.

## Non-goals

- Do not redesign the RAG ranking algorithm.
- Do not add semantic embeddings in this slice.
- Do not add undo/restore for delete operations.
