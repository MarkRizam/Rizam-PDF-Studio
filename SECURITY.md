# Security Policy

## Status

This is an **experimental** PDF editor, not a reviewed or audited security product. Do not rely on cover rectangles to remove private PDF content; overlays do not securely redact source bytes.

## Reporting a vulnerability

**Do not file a public issue with exploit details, private documents, credentials, personal information or proof-of-concept data that could harm someone.**

If the repository has **Private vulnerability reporting** enabled, use its **Security → Report a vulnerability** feature on GitHub. Otherwise, contact the repository maintainer privately through their GitHub profile and ask for a secure reporting channel. We cannot promise a fixed response timeline.

## Privacy guidance

- PDFs are processed in the browser in the current implementation; do not add file uploads without explicit user consent and careful review.
- Optional saved profiles use unencrypted browser storage. Avoid shared browser accounts and clear the stored profile when needed.
- Never include real CVs, ID numbers, employment history, contact information or signatures in test fixtures or bug reports.
- Existing digital signatures may become invalid when a PDF is edited.

Supported versions: **v0.5.x prototype only**; older archives are not maintained security releases.
