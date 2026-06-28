# One-time setup: origin -> Gitee only; github -> GitHub (separate push)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-remotes.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$GiteeUrl = 'https://gitee.com/czmanong/arena.git'
$GithubOwner = 'qq1171910065'
$GithubRepo = 'manong-arena'
$GithubUrl = "https://github.com/$GithubOwner/$GithubRepo.git"

if (-not (Test-Path '.git')) {
  throw 'Not a git repository root'
}

Write-Host "Fetch URL (Gitee): $GiteeUrl"
git remote set-url origin $GiteeUrl

while ($true) {
  $pushUrls = @(git config --get-all remote.origin.pushurl 2>$null)
  if (-not $pushUrls -or $pushUrls.Count -eq 0) { break }
  foreach ($url in $pushUrls) {
    git remote set-url --delete --push origin $url 2>$null
  }
}
git remote set-url --push origin $GiteeUrl

if (git remote | Select-String -Pattern '^github$' -Quiet) {
  git remote set-url github $GithubUrl
} else {
  git remote add github $GithubUrl
}

Write-Host ''
Write-Host 'Done. Push separately to avoid credential hangs:'
Write-Host '  git push origin master          # Gitee'
Write-Host '  pnpm publish:github             # GitHub (needs GITHUB_TOKEN Classic PAT)'
Write-Host ''
Write-Host 'Or push both via helper:'
Write-Host '  pnpm push -- master'
Write-Host ''
git remote -v
