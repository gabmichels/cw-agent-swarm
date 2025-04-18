Write-Host "Testing Discord integration..." -ForegroundColor Cyan

Write-Host "Using 'py' command..." -ForegroundColor Green
try {
    py test_discord.py
} catch {
    Write-Host "Error running Python script: $_" -ForegroundColor Red
    Write-Host "Please make sure the 'py' command is working correctly." -ForegroundColor Red
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 