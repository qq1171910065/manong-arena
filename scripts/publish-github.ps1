# One-shot GitHub publish: create repo (if needed), push master, push release tag.
# Requires Classic PAT with `repo` scope — Fine-grained tokens cannot create repositories.
#
# Usage:
#   $env:GITHUB_TOKEN = 'ghp_xxxxxxxx'   # Classic token, never commit
#   pnpm publish:github
#   pnpm publish:github -- -Tag v0.2.0

param(
  [string]$Tag = '',
  [switch]$SkipCreate
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$GithubOwner = 'qq1171910065'
$GithubRepo = 'manong-arena'
$GithubUrl = "https://github.com/$GithubOwner/$GithubRepo.git"

$token = [string]$env:GITHUB_TOKEN
if (-not $token.Trim()) {
  throw @"
Missing GITHUB_TOKEN.

Generate a Classic Personal Access Token (NOT Fine-grained):
  https://github.com/settings/tokens/new
  Scope: repo (full control)

Then run:
  `$env:GITHUB_TOKEN = 'ghp_xxxxxxxx'
  pnpm publish:github
"@
}

$version = (& node -p "require('./package.json').version" 2>$null).Trim()
if (-not $version) {
  throw 'Could not read version from package.json'
}
if (-not $Tag) {
  $Tag = "v$version"
}
if ($Tag -notmatch '^v') {
  $Tag = "v$Tag"
}

$env:GH_TOKEN = $token
$ghCandidates = @(
  'C:\Program Files\GitHub CLI\gh.exe',
  'C:\Program Files (x86)\GitHub CLI\gh.exe',
  'gh'
)
$gh = $ghCandidates | Where-Object { $_ -eq 'gh' -or (Test-Path $_) } | Select-Object -First 1
if (-not $gh) {
  throw 'GitHub CLI (gh) not found. Install: winget install GitHub.cli'
}

Write-Host "GitHub target: $GithubOwner/$GithubRepo"
Write-Host "Release tag: $Tag"

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'GITHUB_TOKEN invalid or expired. Generate a new Classic PAT with repo scope.'
}

$repoJson = & $gh api "repos/$GithubOwner/$GithubRepo" 2>$null
$repoExists = $LASTEXITCODE -eq 0

if (-not $repoExists -and -not $SkipCreate) {
  Write-Host "Creating public repository $GithubOwner/$GithubRepo ..."
  & $gh repo create $GithubRepo --public `
    --description 'Manong Arena — AI character social deduction desktop client (Electron)' `
    --homepage "https://github.com/$GithubOwner/$GithubRepo"
  if ($LASTEXITCODE -ne 0) {
    throw @"
Failed to create repository. Your token is likely Fine-grained (cannot create repos).
Use a Classic PAT with `repo` scope: https://github.com/settings/tokens/new
"@
  }
  $repoExists = $true
}

if (-not $repoExists) {
  throw "Repository $GithubOwner/$GithubRepo not found. Remove -SkipCreate or create it manually."
}

if (git remote | Select-String -Pattern '^github$' -Quiet) {
  git remote set-url github $GithubUrl
} else {
  git remote add github $GithubUrl
}

Write-Host 'Configuring git credentials via gh ...'
& $gh auth setup-git 2>&1 | Out-Null

Write-Host 'Pushing master to github ...'
git push github master
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$existingTag = git tag -l $Tag
if (-not $existingTag) {
  Write-Host "Creating annotated tag $Tag ..."
  git tag -a $Tag -m "Release $Tag"
} else {
  Write-Host "Tag $Tag already exists locally, pushing ..."
}

Write-Host "Pushing tag $Tag to github ..."
git push github $Tag
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'GitHub publish complete.'
Write-Host "  Repo:    https://github.com/$GithubOwner/$GithubRepo"
Write-Host "  Actions: https://github.com/$GithubOwner/$GithubRepo/actions"
Write-Host "  Release: https://github.com/$GithubOwner/$GithubRepo/releases/tag/$Tag"
Write-Host ''
Write-Host 'Release CI builds Windows/macOS installers (~15-30 min).'
Write-Host 'After CI completes, upload full asset zip locally:'
Write-Host '  pnpm upload:release-assets'
