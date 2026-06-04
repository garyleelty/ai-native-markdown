# Preview Sync Design

## Goal

Make the rendered preview track the Markdown source accurately enough for daily split-view writing:

- Moving the editor cursor highlights the matching rendered block.
- Preview scrolling uses real source line metadata instead of DOM order guesses.
- Clicking a heading permalink in preview moves the editor cursor to the source heading line.
- Mermaid rendering keeps the existing lazy-loading and sanitization behavior while using stable per-render IDs.

## Current Problems

`src/components/Preview.vue` already sanitizes rendered Markdown and Mermaid SVG output, but the sync layer is incomplete:

- `buildLineMap()` maps top-level rendered elements to lines by counting DOM children, so blank lines, multi-line paragraphs, lists, code blocks, and diagrams drift from the real source line.
- `scrollToLine()` searches for `[data-line]`, but the renderer does not currently add `data-line` attributes.
- `Preview` emits `heading-click`, but `App.vue` does not listen to it, so heading anchors do not jump back to the editor.
- Mermaid DOM IDs are generated with `Math.random()`, which makes rendered markup less deterministic than needed for tests.

## Design

Add real source line metadata during Markdown rendering:

- Use a Markdown-it core rule after block parsing to attach `data-line` and `data-line-end` to block tokens that have `token.map`.
- Store source lines as 1-based values.
- Include common block tokens only: headings, paragraphs, lists, list items, blockquotes, fences, code blocks, tables, and horizontal rules.
- Keep inline output untouched except for existing Wiki Link restoration.

Use one line lookup path:

- `buildLineMap()` reads all elements with `data-line` / `data-line-end` and maps every line in the source range to the element.
- `findElementForLine(line)` returns the exact element when available, otherwise the nearest following mapped block, otherwise the last mapped block.
- `highlightCurrentLine()` and `scrollToLine()` both call this helper.

Close the heading interaction loop:

- When a heading anchor is clicked, read the heading element's `data-line`.
- Emit `heading-click` with that line number.
- In `App.vue`, wire `@heading-click="handleOutlineNavigate"` so the existing editor navigation path is reused.

Stabilize Mermaid IDs:

- Use a component-level numeric counter reset before each Markdown render.
- Fence placeholders use `mermaid-<n>`.
- Mermaid SVG render calls use `mermaid-svg-<n>`.
- Continue sanitizing SVG output with `sanitizeSvg()`.

## Test Cases

Add Playwright coverage in the preview suite:

- Rendering a mixed document exposes `data-line` values that match real Markdown source lines.
- In split mode, moving the editor cursor to a later heading highlights the matching preview heading.
- Clicking a preview heading permalink moves the editor cursor/status line to the matching source line.
- Mermaid still renders as SVG or shows the safe error text.

## Non-goals

- Do not change Markdown raw HTML policy.
- Do not replace the Live Preview editor extension in this slice.
- Do not redesign the full editor layout in this slice.
