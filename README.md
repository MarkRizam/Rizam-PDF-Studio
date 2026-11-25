# Rizam PDF Studio

**Local-first, open-source PDF editing and assisted form filling.**

Rizam PDF Studio is an experimental browser-based PDF editor. Open a PDF on your own computer, add text, highlights, photographs and signatures, crop/resize images, and export a new PDF. A reusable career profile can help populate job application forms. The code is open for review and contributions.

> **Project status: early prototype (v0.6.0).** Automated source and geometry tests pass, but end-to-end browser and build verification is still needed. Inspect every exported PDF carefully before using it for employment, legal or other important purposes.

## Features

- Preview PDFs locally, navigate pages and remove pages from the exported copy.
- Add and move text, images/signatures, highlights and cover rectangles.
- Crop an image (free, 1:1, 35:45 passport portrait or 4:5), resize it by handles or enter dimensions.
- Import a **text-based PDF, DOCX or TXT résumé** to suggest a reusable career profile (name, email, phone, education, employment, listed technical skills). All extraction is local, rule-based, and must be reviewed before use.
- Enter a career profile once and manually place saved details onto unfamiliar forms.
- Auto-place selected profile data on **one specifically recognized four-page job-application template**; unsupported PDFs are **not** auto-filled.
- Export a new PDF without submitting an application or sending the document to a server.

**Not implemented:** universal PDF form detection, OCR, editable existing page text, secure redaction, full multilingual font support, and OCR for scanned résumés. Cover rectangles are visual overlays **not** confidential-data removal.

## Get started (Windows)

Prerequisite: [Node.js](https://nodejs.org/) **22.12 or newer**.

1. [Download this repository's source](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives) or clone it.
2. Extract/open the folder containing `package.json`.
3. Run `start-windows.bat`, or use a terminal:

```sh
npm install
npm run dev
```

4. Open the local address printed in your terminal (usually `http://127.0.0.1:5173`).
5. Select **Open PDF**, make your edits, then choose **Export PDF**.

For tests: `npm run check`. For a production build: `npm run build` (dependency installation required). We have **not** established a fully verified browser build or deployable hosted version yet.

## Import your résumé to fill a job form

1. Open the target job application PDF with **Open PDF**.
2. Click **Auto-fill form**, then **Upload résumé**.
3. Choose a résumé in **PDF, DOCX or TXT** format (maximum 15 MB).
4. Check each suggested education, employment and training record in the preview. These records start **unchecked** because the PDF reader can mix columns and headings. Select only records you verified, then choose **Use extracted details**. Existing values are preserved unless you explicitly tick **Replace existing matching details**.
5. Open and check the **Personal, Education, Employment, Skills** and other profile sections. The importer does **not** invent a vacancy title, salary, notice period, identity card, birth date, signature, health/legal declarations or motivation statement.
6. Click **Auto-fill matching fields** to apply the profile to the verified four-page PROPPY PDF layout. For other PDF templates, choose **Place fields manually**. Review all pages before **Export PDF**.

To remove incorrect employment records imported by an earlier version, open **Employment history** and use **Remove** on individual rows, or click **Clear employment entries** (asks for confirmation). Clear any already auto-filled PDF annotations by applying Auto-fill again after correcting the profile.

The résumé is processed in your browser using PDF.js or built-in DOCX text extraction; no résumé upload endpoint or AI service is used. Scanned PDF images, unusual columns, tables and inconsistent résumé formatting may not be extracted accurately. **OCR is not supported yet.** Imported data remains in memory unless you explicitly save your career profile. Review every extracted field, especially dates and employment entries, before submitting to an employer.

## Form filling and privacy

The career profile is held in memory unless you explicitly select **Save on this device**. That saves some profile details to **unencrypted browser localStorage**; don't use this option on a shared device. Identity numbers are excluded from the saved profile, but other saved fields can still contain sensitive personal information. Applications, signatures and declarations are **not** submitted or approved automatically. Review everything before export.

The included `tests/sample-2-pages.pdf` contains synthetic text only. **Do not share real CVs, employment application forms, applicant photos, identity numbers or signatures in GitHub issues/PRs.** This repository does **not** include the employer-supplied PDF used to test one form-specific coordinate mapping; that mapping is provided as an experimental compatibility example, not an affiliation or endorsement.

See [the full user guide](docs/USER_GUIDE.md) for details and current limitations.

## Contribute

Contributions are welcome from developers, testers, designers and documentation writers. Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to report bugs and send pull requests
- [ROADMAP.md](ROADMAP.md) — possible next features and beginner-friendly tasks
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — expected community behavior
- [SECURITY.md](SECURITY.md) — private vulnerability reporting
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the current code is organized

For bugs, use the GitHub issue templates and include a **synthetic PDF** if a reproduction file is needed.

## Stack and license

Vanilla JavaScript, [Vite](https://vite.dev/), [PDF.js](https://mozilla.github.io/pdf.js/), and [pdf-lib](https://pdf-lib.js.org/). No built-in external upload endpoint or telemetry.

Licensed under the [MIT License](LICENSE). This permits use, modification and redistribution, including commercial use, under the license conditions. Library dependencies have their own licenses.

## Copy and paste (v0.7)

- **Paste text:** Click **Paste text**, paste text into the dialog (Ctrl+V), then choose **Insert on page**. Drag the new text into position and edit it in **Properties**.
- **Quick paste:** With the PDF editor active (not inside an input field), press **Ctrl+V** to insert plain text from another app. Pasted PNG/JPG images are also supported where the browser exposes them.
- **Copy items:** Select an inserted text, image, cover or highlight, then click **Copy selected item**. Use **Paste copied item** on the current or another page. Ctrl+C / Ctrl+V work for text annotations; Ctrl+D quickly duplicates a selected annotation. Use the on-screen paste button for images when browser clipboard behavior varies.
- **Copy PDF text:** **Copy page text** copies extractable text from the *entire current page* (not a selection). If clipboard access is denied, select the text in the dialog and manually copy it. Scanned/image-only PDFs need OCR, which is not included.
- Clipboard operations are local to your browser. The editor does not upload the document or its contents. Copying may place text on your operating system clipboard.

## Windows desktop application (v0.8)

The browser edition remains available at `npm run dev`. The Windows desktop edition can open PDFs directly from File Explorer after installing its `.exe` installer.

### Download and install on Windows 11

1. On the GitHub repository, open **Actions → Windows Desktop Installer**.
2. Open the most recent successful workflow run for `main`. Under **Artifacts**, download **Rizam-PDF-Studio-Windows-Installer**.
3. Extract the ZIP and run the installer `.exe`. Per-machine installation may require administrator permission to register the `.pdf` file association.
4. In Windows **Settings → Apps → Default apps**, search for `.pdf`, click Adobe Acrobat, and select **Rizam PDF Studio**. Windows requires you to choose your own default.
5. Double-click a PDF in File Explorer to open it in Rizam PDF Studio. Files remain on your device.

> The installer is an **unsigned development build**; Windows SmartScreen may display an unknown publisher warning. Download only from the repository Actions page. Please test the installed application on Windows before relying on it.

### Build locally

Run in PowerShell (Node.js 22.12+):

```powershell
npm install
npm run check
npm run desktop:win
```

The installer is written to `release/`. To run a desktop window without installing, use `npm run desktop:dev`.

Electron renders Vite's static bundle offline using a sandboxed preload bridge. It receives the PDF file selected in Windows Explorer, including when the app is already running. It does not silently change Windows default apps, create accounts, or upload PDFs.
