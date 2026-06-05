# Daily Note Command Design

## Problem

The app has strong Markdown editing and knowledge features, but it lacks a daily capture workflow. Obsidian users often rely on Daily Notes as the starting point for work, journaling, meetings, and link creation.

## Goal

Add a built-in command palette action that creates or opens today’s daily note under `/workspace/Daily/YYYY-MM-DD.md`.

## User Experience

- Press `Ctrl+P`, search `今日笔记`, press Enter.
- If `/workspace/Daily` does not exist, create it.
- If today’s note does not exist, create it with a useful starter template.
- If today’s note already exists, open it without overwriting content.
- The file tree and Markdown path list refresh after creation.

## Daily Note Template

New daily notes use:

```md
---
date: YYYY-MM-DD
tags: [daily]
---

# YYYY-MM-DD

## 今日重点

- 

## 记录

```

## Architecture

`CommandPalette.vue` adds a `file.daily-note` command in the File category. `App.vue` handles the command with a small helper:

1. format the local date as `YYYY-MM-DD`,
2. ensure `/workspace/Daily` exists,
3. read today’s note if present,
4. otherwise write the starter template,
5. refresh Markdown paths, refresh the sidebar tree, and open the note.

This uses existing `fileSystem` APIs and does not change IndexedDB schema.

## Error Handling

- If the `Daily` path already exists as a directory, continue.
- If directory creation fails for another reason, show an error message.
- Existing notes are never overwritten.

## Testing

Add Playwright coverage for command palette creation/opening:

- execute `今日笔记`,
- verify the tab opens,
- verify the note exists at `/workspace/Daily/YYYY-MM-DD.md`,
- verify the template contains frontmatter, heading, and sections.

