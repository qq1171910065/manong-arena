# One-time setup: push origin syncs to Gitee + GitHub
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-remotes.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$GiteeUrl = 'https://gitee.com/czmanong/arena.git'
$GithubUrl = 'https://github.com/czmanong/manong-arena.git'

if (-not (Test-Path '.git')) {
  throw 'Not a git repository root'
}

Write-Host "Fetch URL (Gitee): $GiteeUrl"
git remote set-url origin $GiteeUrl

Write-Host 'Configure dual push URLs for origin...'
git remote set-url --add --push origin $GiteeUrl
git remote set-url --add --push origin $GithubUrl

if (git remote | Select-String -Pattern '^github$' -Quiet) {
  git remote set-url github $GithubUrl
} else {
  git remote add github $GithubUrl
}

Write-Host ''
Write-Host 'Done. These commands push to BOTH remotes:'
Write-Host '  git push origin master'
Write-Host '  git push origin --tags'
Write-Host ''
Write-Host 'GitHub only:'
Write-Host '  git push github master'
Write-Host ''
git remote -v
