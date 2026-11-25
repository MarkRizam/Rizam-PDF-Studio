# Changelog

## 0.6.2 - 2026-11-25

- Prevented résumé education, dates and responsibility sentences from becoming invented employment records. Employment now requires a plausible employer, title and date range.
- Show the actual extracted education and employment entries before import; those entries require explicit selection.
- Added a guarded button to clear incorrect employment entries from the current profile.
- Added regression tests for false employer/title matches.

## 0.6.1 - 2026-11-25

- Fixed résumé PDF upload failing with `pdf.destroy is not a function` after extraction.
- Clean up PDF.js loading tasks safely, including the failure path.
- Added two regression tests for importing PDFs without `PDFDocumentProxy.destroy()`.

## 0.6.0 - 2026-11-24

- Added local import for text-based PDF, DOCX and TXT résumés into an editable career profile.
- Added preview/confirmation, fill-empty-fields merge, optional replacement and extraction warnings.
- Added deterministic parser, DOCX extraction and synthetic test fixture. Does not infer salary, sensitive declarations, identity number or job-specific statements.
- Maintained strict four-page PROPPY-only automatic PDF form mapping; other forms still need manual placement.

## 0.5.0 — Initial open-source candidate

- PDF viewing and local export.
- Text, highlight, cover and image overlays.
- Image cropping, resizing and dragging.
- Career-profile editor and guarded, fixed-template auto-fill.
- Manual placement of saved profile values for other PDF layouts.
- Geometry, autofill and source checks.

**Known limitation:** full browser integration/build has not yet been verified in this environment; check exported files carefully.

## Earlier prototypes

- 0.4: Image crop and resize controls.
- 0.3: PDF coordinate conversion fixes.
- 0.2: Image placement visibility improvements.
- 0.1: First local PDF editor prototype.
