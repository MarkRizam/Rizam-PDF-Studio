# Publishes the current Rizam PDF Studio source into the existing public GitHub repository.
# Runs on your own Windows PC using your existing GitHub authentication.
$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://github.com/MarkRizam/Rizam-PDF-Studio.git'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git for Windows is not installed: https://git-scm.com/downloads/win'
}
if (-not (Test-Path (Join-Path $Project 'package.json')) -or -not (Test-Path (Join-Path $Project 'src/main.js'))) {
  throw 'Run this script from the Rizam-PDF-Studio folder that contains package.json and src/main.js.'
}

# Explicit file allowlist: never copy private PDFs, resumes, signatures or environment files.
$allowedRootFiles = @(
  '.editorconfig', '.gitattributes', '.gitignore', 'CHANGELOG.md',
  'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'LICENSE', 'PUBLISHING.md',
  'README.md', 'ROADMAP.md', 'SECURITY.md', 'index.html', 'package.json',
  'start-windows.bat', 'publish-to-github.ps1', 'publish-existing-repo.ps1', 'publish-existing-repo.bat'
)
$allowedFolders = @('.github', 'docs', 'src', 'tests')
$stage = Join-Path ([IO.Path]::GetTempPath()) ('rizam-pdf-publish-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  $checkout = Join-Path $stage 'repo'
  & git clone --quiet $RepoUrl $checkout
  if ($LASTEXITCODE -ne 0) { throw 'Git clone failed. Sign in with Git Credential Manager and retry.' }
  $actual = (& git -C $checkout remote get-url origin).Trim()
  if ($actual -ne $RepoUrl) { throw "Unexpected Git remote: $actual" }

  foreach ($name in $allowedRootFiles) {
    $from = Join-Path $Project $name
    if (Test-Path -LiteralPath $from -PathType Leaf) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $checkout $name) -Force
    }
  }
  foreach ($name in $allowedFolders) {
    $from = Join-Path $Project $name
    if (Test-Path -LiteralPath $from -PathType Container) {
      Copy-Item -LiteralPath $from -Destination (Join-Path $checkout $name) -Recurse -Force
    }
  }
  & git -C $checkout add --all
  if ($LASTEXITCODE -ne 0) { throw 'Git staging failed' }
  Write-Host "`nReview these changes before committing:" -ForegroundColor Cyan
  & git -C $checkout status --short
  if (-not (& git -C $checkout status --porcelain)) {
    Write-Host 'Nothing to publish: the repository already matches the packaged source.'
    exit 0
  }
  Write-Host "`nOnly publish source code and synthetic test files. NEVER publish real CVs or private job applications." -ForegroundColor Yellow
  $approval = Read-Host 'Type PUBLISH to commit and push to main'
  if ($approval -cne 'PUBLISH') { Write-Host 'Cancelled. No GitHub changes made.'; exit 0 }
  & git -C $checkout commit -m 'feat: publish Rizam PDF Studio v0.6 resume import and PDF editor'
  if ($LASTEXITCODE -ne 0) { throw 'Git commit failed; configure git user.name and user.email.' }
  & git -C $checkout push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed. Confirm GitHub login and write access.' }
  Write-Host "`nPublished! https://github.com/MarkRizam/Rizam-PDF-Studio" -ForegroundColor Green
} finally {
  if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
