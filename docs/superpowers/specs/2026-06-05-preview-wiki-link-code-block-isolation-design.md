# Preview Wiki Link Code Block Isolation Design

## Problem

`Preview.vue` extracts `[[Wiki Link]]` syntax before Markdown rendering, then replaces placeholder tokens in the final HTML. This makes wiki links inside fenced code blocks or inline code become clickable preview links, even though code should stay literal.

## Goal

Rendered preview should only turn Wiki Link syntax in normal Markdown prose into interactive links. Code fences and inline code must preserve the original `[[...]]` text.

## Approach

Move Wiki Link rendering into a Markdown-it inline rule instead of a pre-render string replacement. Markdown-it does not run inline rules inside fenced code blocks or inline code, so code content remains literal while paragraphs, list items, headings, and blockquotes still render links.

The inline rule will:

- match `[[target]]` and `[[target|alias]]`;
- render an `<a class="wiki-link ...">` token with `data-filename`;
- mark links as existing or missing using the current file path and known Markdown paths;
- escape target and display text through Markdown-it token attrs/content handling.

## Testing

Add Playwright coverage in `e2e/preview-security.spec.ts`:

- normal prose `[[README|Read me]]` still renders as one `.wiki-link`;
- fenced code containing `[[README]]` stays text inside `code`;
- inline code containing `[[README]]` stays text inside `code`.

Run the preview target test, then full typecheck, Playwright, build, and diff check.
