# Mobile Sidebar Drawer Interactions Design

## Problem

On narrow viewports, the sidebar now behaves as an overlay drawer so it no longer clips the welcome screen. That fixes layout, but the drawer still needs product-grade interaction guarantees: users must be able to open it, dismiss it, and return to the editor after choosing a file without hidden state or horizontal overflow.

## Goals

- Keep mobile main content full-width while the sidebar is closed.
- Let the header sidebar button open and close the drawer without changing the persisted desktop sidebar preference.
- Let backdrop click and Escape dismiss the drawer.
- Close the drawer after selecting a file, search result, knowledge reference, or Wiki Link target.
- Preserve desktop behavior and existing sidebar persistence.

## Non-Goals

- Do not redesign the sidebar panels.
- Do not add new navigation concepts.
- Do not change file-system, search, or knowledge-index behavior.

## Interaction Model

Mobile sidebar state is local UI state. Desktop sidebar state remains stored in settings. Commands that need a sidebar panel should open the drawer on mobile and open the persisted sidebar on desktop. Once a user selects content that moves focus into the editor or preview, the drawer should close so the chosen document is visible.

## Acceptance Criteria

- At `390x844`, the sidebar is closed by default and editor/welcome content spans the viewport.
- Tapping the sidebar toggle opens a drawer with a visible backdrop and width no more than 86% of the viewport.
- Tapping the backdrop closes the drawer.
- Pressing Escape closes the drawer.
- Selecting a Markdown file from the drawer closes the drawer and shows the editor.
- Desktop sidebar visibility persistence remains covered by existing tests.
