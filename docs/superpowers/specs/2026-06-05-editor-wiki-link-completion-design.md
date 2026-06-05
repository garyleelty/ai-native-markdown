# Editor Wiki Link Completion Design

## Goal

When the user types a Wiki Link trigger (`[[`) in the editor, the app should suggest existing Markdown notes and insert the selected note title into the link. This closes a core knowledge-workflow gap with Obsidian: creating links should be fast while writing, not only navigable after writing.

## Scope

This slice supports note-path completion only:

- Show suggestions after the cursor is inside an unfinished Wiki Link that starts with `[[`.
- Filter existing Markdown files by note title or workspace-relative path.
- Insert the selected suggestion as `[[Note Title]]` while preserving typed surrounding text.
- Support mouse click, `Enter`, `Tab`, `ArrowUp`, `ArrowDown`, and `Escape`.
- Show a compact empty state when no note matches.

This slice does not add heading completion, aliases, tags, fuzzy scoring, backlinks ranking, or automatic creation from the completion popup. Missing-note creation already exists through preview and knowledge navigation.

## UX

The completion popup appears near the editor as a restrained overlay with:

- a short label, "Wiki Link 建议";
- up to six note suggestions;
- title-first rows with a smaller workspace-relative path;
- a selected row state for keyboard navigation;
- an empty row, "没有匹配笔记，继续输入可创建新链接".

The popup disappears when the cursor leaves the unfinished link, the user closes the link with `]]`, or `Escape` is pressed. It should not cover the toolbar or resize editor content.

## Architecture

`App.vue` already maintains `markdownPaths`, so it passes them into `Editor.vue`.

`Editor.vue` owns the interaction because CodeMirror cursor state and key handling live there. It derives the current incomplete Wiki Link query from the document around the cursor, renders suggestions in Vue, and applies the chosen suggestion through a CodeMirror transaction.

No persistent data model changes are needed.

## Edge Cases

- Existing complete links like `[[README]]` should not show the popup after `]]`.
- The current file can appear as a suggestion; this is acceptable and matches simple path completion behavior.
- Markdown extensions are hidden in the inserted target.
- Duplicate basenames are shown with their relative path for disambiguation.
- Keyboard handlers only intercept keys while the popup is open.

## Testing

Add Playwright coverage for:

- Typing `[[ali` shows a matching note and pressing `Enter` inserts `[[Alpha Note]]`.
- Typing an unmatched query shows the empty state, and pressing `Escape` closes the popup without changing the typed link.

Run targeted editor tests, full Playwright tests, typecheck, build, and whitespace checks.
