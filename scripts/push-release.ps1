param(
    [string]$Tag = "v1.3.0",
    [string]$Message = "feat: upgrade PixelSweep"
)

Write-Host "=== PixelSweep Quick Push & Release ($Tag) ===" -ForegroundColor Cyan
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "$Message $Tag"
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    Write-Host "[INFO] No staged file changes to commit." -ForegroundColor Yellow
}

git push origin main
if ($LASTEXITCODE -ne 0) { exit 1 }

git tag -f $Tag
git push origin $Tag --force
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[SUCCESS] Pushed main and tag $Tag. Check GitHub Actions for installers." -ForegroundColor Green
