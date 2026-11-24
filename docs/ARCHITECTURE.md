# Architecture (v0.6)

- `index.html` — application shell and interactive controls.
- `src/main.js` — PDF preview, annotations, image operations, profile UI, and export integration.
- `src/styles.css` — UI presentation.
- `src/geometry.js` — conversion between PDF and canvas/view coordinates.
- `src/image-edit.js` — crop/resize geometry helpers.
- `src/form-autofill.js` — reusable career profile, validation, manual field choices, and positional map for a **single recognized template**.
- `src/resume-import.js` — local PDF.js line consolidation, DOCX ZIP/XML text extraction and deterministic resume-to-profile suggestions; no network/AI calls, human review, merge without overwriting by default.
- `tests/*.test.mjs` — unit and regression tests.
- `tests/sample-2-pages.pdf` — synthetic test-only PDF.

PDF.js renders a browser preview. User edits are modeled as overlay annotations. pdf-lib applies these to an exported PDF. Most PDF page content is *not* edited in place.

Form filling has two modes:

1. **Fixed-template:** only applies after checking document page count/dimensions and recognizable text. Field values that cannot fit are skipped; high-sensitivity declarations are excluded.
2. **Manual placement:** a user selects a saved profile value and clicks where it should appear. This works for other documents but is not automatic field detection.

**Safety boundaries:** Do not treat visual cover boxes as redaction, auto-submit forms, guess missing career details, or persist identity numbers by default. Work toward accessibility and automated browser/export tests before claiming production readiness.

Résumé import: file input -> PDF.js / DOCX text reader / plain TXT -> conservative parser -> preview -> user-approved merge into edit fields -> existing form mapper -> review/export. Unsupported or scanned PDFs require manual entry.
