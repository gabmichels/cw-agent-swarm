# PowerShell script to run the memory importance update with TypeScript transpile-only mode

Write-Host "Running memory importance update script..." -ForegroundColor Green
Write-Host "Setting up typescript transpile-only mode to bypass type errors..." -ForegroundColor Yellow

# Use transpile-only flag to bypass TypeScript errors
npx ts-node --transpile-only scripts/update-memory-importance.ts

Write-Host "Script execution complete." -ForegroundColor Green 