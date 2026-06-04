# Multimodal Drop Reliability Design

## Goal

Make image/PDF drag handling match the product promise:

- Dropped images insert Markdown image syntax and OCR text when extraction succeeds.
- Dropped PDFs insert extracted text without requiring an AI provider.
- Browser `File` objects and Electron files with `path` both work.
- Unsupported files are ignored without changing editor content.

## Current Problems

The editor drop extension only processes files when `(file as any).path` exists. Standard browser `File` objects do not expose `path`, so web builds silently skip images and PDFs.

PDF extraction currently asks the active AI provider to read a file path. That fails when AI is not configured and does not actually parse the dropped PDF locally.

## Design

Update the multimodal service layer:

- Keep image OCR through the existing Tesseract service.
- Accept `File`, `ArrayBuffer`, or path/URL sources for PDF extraction.
- Use the local `src/services/pdf.ts` parser for PDF text.
- Keep optional AI cleanup for image OCR only; PDF drag should not depend on AI.

Update the editor drop handler:

- Use `file.path` when available; otherwise pass the browser `File` object.
- Insert content at the current accumulated insertion point so multiple dropped files preserve order.
- Export a small insertion function so tests can verify formatting and dispatch behavior without running heavyweight OCR/PDF engines.

## Test Cases

Add Playwright coverage for the insertion function with mocked extractors:

- Dropping an image inserts image Markdown and OCR block.
- Dropping a PDF inserts extracted text between separators.
- Unsupported files do not dispatch changes.

## Non-goals

- Do not add a full drag-and-drop visual redesign.
- Do not run real OCR in e2e tests.
- Do not summarize PDF content with AI in this slice.
