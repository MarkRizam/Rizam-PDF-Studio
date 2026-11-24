# Contributing to Rizam PDF Studio

Thank you for improving an accessible, privacy-conscious PDF editor. Code, tests, UX suggestions, bug reports, translations and documentation are welcome.

## Before opening an issue

- Look for an existing issue first.
- Describe **what happened**, **what you expected**, your operating system/browser and the editor version.
- Reproduce with `tests/sample-2-pages.pdf` or a PDF you created yourself using fake information.
- **Never upload** real job application forms, CVs, NRIC/passport numbers, signatures, medical data, employment/salary information, or private files.
- For possible security vulnerabilities, use the process in [SECURITY.md](SECURITY.md) instead of a public issue.

## Development

1. Fork the repository and create a branch such as `fix/image-crop-handle`.
2. Install Node.js **22.12+** and run `npm install`.
3. Run `npm run dev` to test locally.
4. Run `npm run check` and `npm run build` before submitting a PR.
5. Submit a focused pull request with a short explanation, screenshots using synthetic data if relevant, and test evidence.

## Guidelines

- Keep PDF bytes and profile data in the browser by default. Propose any cloud features with an explicit privacy and consent design.
- Avoid introducing external analytics, trackers, network calls carrying document data, or automatic form submission.
- Do not auto-answer declarations about health, criminal history, bankruptcy, consent, or other sensitive legal matters.
- Prefer small, understandable changes and tests that reproduce the problem.
- Follow the project's current vanilla JavaScript/module style; new dependencies need a clear reason.
- Respect accessibility: keyboard focus, descriptive labels, readable contrast, and visual controls usable without precise mouse dragging.
- Be clear about security limitations; a white cover rectangle is **not** a secure PDF redaction.
- Never bundle an employer's form, logo, copyrighted sample or real user's document without the necessary rights and permission.

Maintainers review pull requests and decide which changes to merge. Contributors retain copyright in their contributions and submit them for distribution under the repository's MIT license.
