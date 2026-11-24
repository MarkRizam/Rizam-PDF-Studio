# Roadmap

These are proposals, not promises or confirmed release dates. Please open an issue to discuss large changes before implementation.

## Good first contributions

- Improve keyboard navigation and visible focus in the image resize/crop controls.
- Add Malay (`ms`) translations to helper text while retaining English.
- Improve README installation troubleshooting for Windows PowerShell.
- Add more tests using **synthetic, redistributable** example PDFs.
- Improve error messages when unsupported/rotated documents are opened.

## Planned exploration

- Editable saved form templates and a visual template-mapping builder.
- Detection and filling of native AcroForm fields.
- Improve PDF/DOCX résumé extraction accuracy for multi-column and complex-table layouts (basic reviewed import is available in v0.6).
- Add confidence indicators and an opt-in advanced import engine; no fabricated details.
- Page thumbnails, reordering/merging/splitting, undo/redo.
- Automatic text field suggestions with confidence indicators and manual review.
- Better Unicode text/font handling and accessible form controls.
- True secure-redaction support with verification; separate from visual cover rectangles.
- OCR for scanned documents with clear reliability warnings.
- End-to-end browser and export regression tests on CI.

Privacy, document integrity, and human review take priority over automating every form.
