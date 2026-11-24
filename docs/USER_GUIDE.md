# Rizam PDF Studio v0.5 — Local Career Profile + Job Form Autofill

**New in v0.5:** Fill a reusable career profile once, then auto-place matching answers into the supplied 4-page PROPPY job application PDF. Other PDFs can be populated with a **Place saved field** tool: select a profile value, then click where it belongs on the page. All existing image crop, resize, add-text, highlight and PDF export features remain in place.

This is a local-first prototype. PDF files stay in your browser; no PDF bytes are uploaded to a service.

## Windows installation

1. Extract `rizam-pdf-studio` from this ZIP into a new folder. Do not overwrite an older version while it has unsaved work.
2. If you have an older editor open, **Export PDF** and close the old server's command window (`Ctrl+C`).
3. Double-click `start-windows.bat` (requires Node.js **22.12 or newer**).
4. On the first start you need an internet connection so `npm install` can download packages.
5. Open the local address printed in the command window (commonly `http://127.0.0.1:5173`).

Alternative Windows PowerShell commands from inside the app folder:

```powershell
npm install
npm run check
npm run build
npm run dev
```

## Auto-fill the supplied PROPPY form

1. Open your original **JOB APPLICATION FORM (FULL) (2).pdf** from the editor's **Open PDF** button.
2. Click **Auto-fill form** in the top bar.
3. Complete the fields you want filled. Education, training, work history and skills can have multiple entries. **Most recent employment first**.
4. Click **Auto-fill matching fields**. The app checks the page count, PDF dimensions and text headings. It **will not** place values using this map when the PDF is not a recognized template.
5. Go through **every page**, inspect the placements, adjust text manually when needed, and insert a photo or signature using the regular image tool.
6. Click **Export PDF**, reopen the exported file and inspect it before submitting.

Tips:
- Unanswered profile values remain **blank**. The editor does not invent an answer.
- If text is too long for a field, the field is **skipped** and a warning is shown. In particular, the application statement's printed box has very little room. Keep it genuinely short or place your statement manually where it fits.
- Sensitive declarations on page 4 (health, criminal history, employment termination, bankruptcy, reference consent) are **never automatically ticked**. Signatures and fields marked *For Official Use Only* are not populated.
- Applying Auto-fill again **replaces previous auto-filled items** but leaves manually added text and images untouched.
- You can click a filled answer in the PDF to move or edit it after auto-filling.
- This version provides a verified positional map only for the specific uploaded **PROPPY FR-HR-006-R00** form. A different version of the same form may need a new template.

## Fill a different PDF manually with saved values

1. Click **Auto-fill form**, complete the profile, and select **Place fields manually**.
2. In **Properties** on the right, choose the value, e.g., **Full name**.
3. Click on your PDF at the location where the value should appear.
4. Repeat for other fields, adjust as necessary and export the PDF.

This can fill static/scanned forms *visually* through overlays, but it does not automatically find and label fields in arbitrary PDFs yet. OCR and generalized automatic field detection are not part of v0.5.

## Your profile and privacy

- Your profile stays in memory unless you explicitly click **Save on this device**. That button stores profile fields in **unencrypted browser localStorage**, not on a server. Do not use it on a shared computer.
- **NRIC/passport number is not saved** to browser storage. If you enter it, it remains only for the current session.
- Click **Forget saved profile** to clear both the browser-saved profile and editable form, but it does not remove text already placed on the open PDF.
- The **Use example details** button inserts fictional demo data to test the feature. Do not submit it for a real application.
- Important: ordinary name, address, phone, education, salary and application information are **personal data**. If they are saved on a shared Windows profile, other users of that browser profile could access them.
- Clearing browser site data removes the saved profile. Unsaved PDF annotations are lost on reload; export before upgrading or closing.

## Previous features still included

- Local PDF preview, multi-page navigation and page deletion
- Add, edit and drag text
- Add highlights or cover rectangles (not secure redaction)
- Add PNG/JPG signature or photo; resize using corner handles or exact dimensions
- Crop pictures non-destructively; free, square, passport (35:45), 4:5 presets
- Embed cropped image pixels when exporting to a new PDF
- Original document stays unchanged

## Validation performed

- `npm run check`: **22 / 22 tests passing**, plus syntax and source-control checks.
- Positional fill simulation on the uploaded real four-page PDF: 4 pages retained, values rendered at mapped positions. The PDF was rendered and visually reviewed; adjusted date columns and made the application statement skip instead of overflowing.
- The sample used **fictional demo details**, not real career data.
- Browser build and full PDF.js/pdf-lib interaction **not verified here** because npm registry packages could not be installed in this environment. Run the app in Chrome and inspect a downloaded PDF before trusting it.

## Known limitations

- Positional auto-filling supports the **exact PROPPY template** only. Other PDFs: manual placement, unless they get their own mappings.
- This version has no automatic resume-to-profile parser. You enter or paste details into your career profile; resume import can be added later.
- It does not modify original page text or digitally redact hidden content.
- PDF export uses standard Helvetica; some Unicode characters will fail to export. International font embedding is planned.
- Text may not line-wrap like a full word processor. Keep brief summaries concise.
- Editing signed PDFs can invalidate digital signatures. Password-protected and malformed PDFs may fail.
- Maximum PDF size: 60 MB. Maximum image size: 8 MB. Rotated-page editing is not well tested.

## Technology

Vanilla JavaScript, Vite, PDF.js, and pdf-lib. Browser-local processing, no server endpoint, no analytics or tracking scripts.

## Manual acceptance test

1. Open the PROPPY form, click **Auto-fill form**, select **Use example details**, then **Auto-fill matching fields**.
2. Confirm the name and phone appear on page 1; education and skill on page 2; employer details on page 3; expected salary on page 4.
3. Confirm the health/legal declarations are still blank and the HR-only area is untouched.
4. Change a field, apply Auto-fill a second time, confirm it **does not duplicate** existing auto-filled answers.
5. Insert a photo, crop/resize it and export.
6. Reopen the exported file and inspect all four pages, including page 2 table lines and page 4 declaration area.
7. Open an unrelated PDF, try Auto-fill (it must refuse the unsupported layout) and then use **Place fields manually** successfully.
8. Test local save, reload, clear, and verify identity number is never restored after reload.


## v0.6: Import a résumé to your career profile

Open **Auto-fill form** and choose **Upload résumé**. Select a text-based PDF, DOCX or TXT résumé (up to 15 MB). Review the detected contact details, education, employers, courses and computer skills. Use **Use extracted details** to fill empty fields in the editable profile. To replace existing values, deliberately tick **Replace existing matching details**. Nothing is inserted into the PDF at the upload stage.

Review each section of your profile. For the verified four-page PROPPY application, choose **Auto-fill matching fields** and inspect all pages, then export. Other PDF layouts still require **Place fields manually**. Scanned/image-only CVs need OCR and are not currently supported. Multi-column résumés and diverse employer/education formatting may yield incomplete or incorrectly matched entries. The app does not automatically answer identity, personal declaration, salary or motivation questions.

Your résumé is read on your device. It is not uploaded, and the imported file itself is never saved to browser storage. Only clicking **Save on this device** stores the selected profile (unencrypted and with identity number excluded).
