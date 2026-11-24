# Publish Rizam PDF Studio to GitHub

Repository: https://github.com/MarkRizam/Rizam-PDF-Studio

The repository already exists and has a main branch. Do not use the older initial-repository script, which assumes the target repo is empty.

## Publish the v0.6 source (Windows)

1. Extract the complete GitHub-ready project package.
2. Ensure [Git for Windows](https://git-scm.com/downloads/win) is installed and that you can sign in to the GitHub account with write access.
3. Double-click **publish-existing-repo.bat** from the extracted `Rizam-PDF-Studio` folder.
4. Examine the file list shown in PowerShell. Type `PUBLISH` only if the listed files are project sources and synthetic test assets.
5. The script clones the existing repository into a temporary folder, copies an explicit allowlist, commits, and pushes to `main` **without force**.
6. Review https://github.com/MarkRizam/Rizam-PDF-Studio and check GitHub Actions. The browser build still requires independent verification.

Never push real job application PDFs, resumes, identity documents, personal profile exports, photographs or API keys.

## Manual option

You can instead `git clone` the repository, copy allowed project files into the clone, run `git add -A`, review `git diff --cached --stat`, commit, and `git push origin main`.
