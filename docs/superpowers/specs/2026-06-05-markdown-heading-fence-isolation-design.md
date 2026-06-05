# Markdown Heading Fence Isolation Design

## Problem

Several features detect Markdown headings by matching every line with `^(#{1,6})`: Wiki Link heading completion, heading-link navigation, and the outline panel. This incorrectly treats headings inside fenced code blocks as real document headings.

## Goal

ATX headings inside fenced code blocks must be ignored everywhere the app builds heading-based UX. Real headings outside fences should keep working.

## Approach

Add a shared heading parser in `src/utils/wikiLinks.ts`:

- parse Markdown line by line;
- enter fenced-code mode on backtick or tilde fences of length 3 or more;
- leave fenced-code mode on a matching closing fence;
- only emit headings while outside fenced code.

Use the shared parser in:

- `findMarkdownHeadingLine`, for preview/wiki navigation;
- `Editor.vue`, for current and cross-document heading completion;
- `OutlinePanel.vue`, for the outline list.

## Testing

Add Playwright coverage for:

- current-document heading completion ignores a fake heading inside a code fence;
- cross-document heading completion ignores a fake heading inside the target note's code fence;
- the outline panel does not list fenced-code headings.

Then run targeted tests, typecheck, full Playwright, build, and diff check.
