# Responsive Welcome Entry Design

## Problem

The welcome screen is the first empty-state users see, but on narrow viewports it is partially clipped because the persistent sidebar consumes most of the width. The page also undersells the product's local-first AI knowledge-work positioning.

## Goals

- Make the welcome screen readable and actionable on desktop and mobile widths.
- Keep the first action set focused: create a document, open a folder, or try the demo workspace.
- Surface concrete differentiators without marketing clutter: local workspace, knowledge graph, AI assistance, and multimodal input.
- Preserve existing events and app wiring.

## Non-Goals

- Do not introduce a landing page or navigation separate from the app.
- Do not change file-system behavior, workspace persistence, or command handling.
- Do not redesign the full shell in this slice.

## UX Direction

Use a calm product empty state, not a hero page. The layout should feel like a capable workbench: concise heading, direct actions, and compact feature proof points. Buttons must remain tappable on mobile, and text must wrap instead of being clipped.

## Implementation

- Update `WelcomePage.vue` to use a responsive two-column desktop layout that collapses to one column on small screens.
- Replace random emoji tips with deterministic, icon-backed capability items.
- Add a compact workflow rail that explains the default path: choose workspace, write in Markdown, connect notes, use AI when needed.
- Add CSS constraints so the welcome content fits within its parent even when the sidebar is visible.
- Add a mobile regression test that asserts the welcome page is not clipped and its primary actions are visible.

## Acceptance Criteria

- At `390x844`, the welcome title and all three primary actions are visible within the viewport.
- The welcome page does not create horizontal overflow.
- Desktop layout remains centered and visually balanced.
- Existing welcome events still trigger the same app handlers.
