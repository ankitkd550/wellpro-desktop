# WellPro Auto-Sync Script
# This runs in the background and automatically saves your work to GitHub
# every 5 minutes, if there are any changes.

$env:PATH += ";D:\akd\node-v26.8.2-win-x64\node-v26.8.2-win-x64"

Write-Host "WellPro Auto-Sync started. Checking for changes every 5 minutes..."
Write-Host "Leave this window open in the background. Do not close it."
Write-Host ""

while ($true) {
    $status = git status --porcelain

    if ($status) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] Changes detected. Saving to GitHub..."

        git add .
        git commit -m "auto-sync: $timestamp" | Out-Null
        git push origin main | Out-Null

        Write-Host "[$timestamp] Saved successfully."
    } else {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] No changes."
    }

    Start-Sleep -Seconds 300
}
