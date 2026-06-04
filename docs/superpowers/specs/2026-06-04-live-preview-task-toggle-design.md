# Live Preview Task Toggle Design

## Goal

Make Live Preview task checkboxes behave like usable editor controls:

- Clicking a rendered checkbox updates the Markdown source from `[ ]` to `[x]`.
- Clicking it again updates `[x]` or `[X]` back to `[ ]`.
- The saved workspace file contains the updated Markdown.
- The implementation stays inside the active Live Preview extension.

## Current Problems

The app imports `src/extensions/live-preview/livePreviewPlugin.ts`. The older `src/extensions/livePreview/` directory is not imported by app code and contains a separate partial implementation, which makes future maintenance ambiguous.

The active `CheckboxWidget` renders a native checkbox, but it does not dispatch a CodeMirror document change. A user can click the control visually, but the Markdown source remains unchanged.

## Design

Update the active checkbox widget:

- Store the checkbox marker range (`[ ]`, `[x]`, or `[X]`) in the widget.
- In `toDOM(view)`, attach a `change` listener to the native checkbox.
- Dispatch a CodeMirror change replacing only the marker range:
  - checked: `[x]`
  - unchecked: `[ ]`
- Stop the checkbox event from bubbling into the editor selection handler.
- Include marker range in `eq()` so widgets are not reused across stale positions.

Clean up unused implementation:

- Remove the unreferenced `src/extensions/livePreview/` files.
- Keep existing docs that describe historical plans; do not rewrite old planning records in this slice.

## Test Cases

Add Playwright coverage:

- In an open Markdown document with Live Preview enabled, clicking an unchecked task checkbox changes the saved file to `- [x] task`.
- Clicking the same rendered checkbox again changes the saved file back to `- [ ] task`.

## Non-goals

- Do not redesign the whole Live Preview parser.
- Do not add rich inline rendering for every Markdown construct.
- Do not change source/split/preview view modes.
