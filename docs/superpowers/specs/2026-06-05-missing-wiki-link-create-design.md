# Missing Wiki Link Create Design

## Goal

Make missing Wiki Links in preview useful instead of dead ends. When a rendered link does not resolve to an existing Markdown file, the app should clearly show it as missing and let the user create the note from that link.

## User Experience

- Existing links keep the normal Wiki Link style and open the target note.
- Missing links use a distinct dashed underline and muted accent so users can spot knowledge gaps without a modal.
- Clicking a missing link creates the note at the resolved target path, opens it in the editor, and shows a short success message.
- The created note starts with a title derived from the target name, for example `[[Project Plan]]` creates `# Project Plan`.
- If the link includes a heading, for example `[[Project Plan#Risks]]`, creation still targets `Project Plan.md`; the heading fragment is ignored for the initial file content.

## Resolution Rules

- Reuse the existing Wiki Link parser and path resolver.
- If a target is missing and has no folder prefix, create it in the current file's directory.
- If a target includes a folder prefix, create it under `/workspace` or relative to the current file according to the same candidate order used by navigation.
- Do not create parent folders automatically in this slice. If the parent folder does not exist, show the existing file-system error.
- Heading-only links like `[[#Heading]]` remain current-document navigation and are never treated as creatable files.

## Implementation Notes

- `Preview.vue` receives a list of existing Markdown paths and the current file path.
- During render, each Wiki Link is marked as existing or missing using a pure helper.
- `Preview.vue` emits the same `navigate` event with the raw target. `App.vue` decides whether to open or create.
- `App.vue` creates missing files through `fileSystem.writeFile`, then opens the file through the existing `handleFileSelect` flow.

## Testing

Add Playwright coverage for clicking a missing Wiki Link from preview:

- The link renders with the missing-link class.
- Clicking it creates and opens the new note.
- The file content contains the generated title.
- A link with an existing target still opens normally.
