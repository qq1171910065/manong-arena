# Push to Gitee (origin) and GitHub (github)
# Usage: pnpm push -- master
#        pnpm push -- origin v0.1.0

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$argsList = @($args)
if ($argsList.Count -eq 0) {
  $argsList = @('origin', 'master')
}

Write-Host "git push $($argsList -join ' ')"
git push @argsList
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$remote = $argsList[0]
if ($remote -eq 'origin') {
  $githubArgs = @('github') + $argsList[1..($argsList.Count - 1)]
  Write-Host "git push $($githubArgs -join ' ')"
  git push @githubArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host 'Push complete.'
