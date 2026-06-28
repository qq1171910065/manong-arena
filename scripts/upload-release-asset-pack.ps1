# Pack full asset zip from local .dev-assets/ and upload to an existing GitHub Release.
# .dev-assets/ is gitignored — this step is intentionally local, not CI.
#
# Prerequisites:
#   1. .dev-assets/ populated (pnpm init:dev-assets or dev asset manager)
#   2. Release tag already exists (CI finished or tag pushed)
#   3. GITHUB_TOKEN (Classic PAT with repo scope) or gh auth login
#
# Usage:
#   $env:GITHUB_TOKEN = 'ghp_xxxxxxxx'
#   pnpm upload:release-assets
#   pnpm upload:release-assets -- -Tag v0.1.0

param(
  [string]$Tag = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$GithubOwner = 'qq1171910065'
$GithubRepo = 'manong-arena'

$devAssets = Join-Path $root '.dev-assets'
$charMarker = Join-Path $devAssets 'character-packs/manifest.json'
if (-not (Test-Path $charMarker)) {
  throw @"
Missing .dev-assets/ (not in git). Prepare local assets first:
  pnpm init:dev-assets
or use the in-app dev asset manager, then re-run:
  pnpm upload:release-assets
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

$token = [string]$env:GITHUB_TOKEN
if ($token.Trim()) {
  $env:GH_TOKEN = $token
}

$ghCandidates = @(
  'C:\Program Files\GitHub CLI\gh.exe',
  'C:\Program Files (x86)\GitHub CLI\gh.exe',
  'gh'
)
$gh = $ghCandidates | Where-Object { $_ -eq 'gh' -or (Test-Path $_) } | Select-Object -First 1
if (-not $gh) {
  throw 'GitHub CLI (gh) not found. Install: winget install GitHub.cli'
}

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Set GITHUB_TOKEN (Classic PAT, repo scope) or run gh auth login.'
}

& $gh release view $Tag --repo "$GithubOwner/$GithubRepo" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Release $Tag not found. Wait for CI to finish or push the tag first."
}

$baseUrl = "https://github.com/$GithubOwner/$GithubRepo/releases/download/$Tag"
$env:ARENA_ASSET_PACK_VERSION = $version
$env:ARENA_ASSETS_BASE_URL = $baseUrl

Write-Host "Packing assets from .dev-assets/ (version $version) ..."
pnpm run pack:assets
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$zipName = "arena-initial-assets-$version.zip"
$zipPath = Join-Path $root ".tmp/asset-pack/$zipName"
if (-not (Test-Path $zipPath)) {
  throw "Pack output missing: $zipPath"
}

$releaseAssetPath = "$version/assets/$zipName"
Write-Host "Uploading to release $Tag as $releaseAssetPath ..."

& $gh release upload $Tag "${zipPath}#${releaseAssetPath}" --repo "$GithubOwner/$GithubRepo" --clobber
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Asset pack uploaded.'
Write-Host "  Release: https://github.com/$GithubOwner/$GithubRepo/releases/tag/$Tag"
Write-Host "  Asset:   $baseUrl/assets/$zipName"
Write-Host ''
Write-Host 'Commit bundled-asset-pack-manifest.json if pack:assets updated downloadUrl/sha256.'
