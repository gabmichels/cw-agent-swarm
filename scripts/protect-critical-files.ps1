# Protect Critical Files Script
# Makes critical system files read-only to prevent accidental modification/deletion

Write-Host "🔒 Protecting critical files..." -ForegroundColor Yellow

# Find environment files (.env, .env.*)
$envFiles = Get-ChildItem -Path "." -Filter ".env*" -File | Select-Object -ExpandProperty Name

# Find database files (*.db, *.sqlite, journal files)
$dbFiles = @()
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*.db" -File | Select-Object -ExpandProperty FullName
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*.sqlite" -File | Select-Object -ExpandProperty FullName
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*journal*" -File | Select-Object -ExpandProperty FullName

# Define critical directories to protect
$criticalDirectories = @(
    "backups"
)

$protectedCount = 0
$errorCount = 0

# Protect environment files
Write-Host "🌍 Protecting environment files..." -ForegroundColor Cyan
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        try {
            Set-ItemProperty -Path $file -Name IsReadOnly -Value $true
            Write-Host "✅ Protected: $file" -ForegroundColor Green
            $protectedCount++
        }
        catch {
            Write-Host "❌ Failed to protect: $file - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
}

# Protect database files
Write-Host "🗄️  Protecting database files..." -ForegroundColor Cyan
foreach ($file in $dbFiles) {
    if (Test-Path $file) {
        try {
            Set-ItemProperty -Path $file -Name IsReadOnly -Value $true
            Write-Host "✅ Protected: $file" -ForegroundColor Green
            $protectedCount++
        }
        catch {
            Write-Host "❌ Failed to protect: $file - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
}

# Protect directories (make all files read-only)
Write-Host "📁 Protecting backup directories..." -ForegroundColor Cyan
foreach ($dir in $criticalDirectories) {
    if (Test-Path $dir) {
        try {
            Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
                Set-ItemProperty -Path $_.FullName -Name IsReadOnly -Value $true
                Write-Host "✅ Protected: $($_.FullName)" -ForegroundColor Green
                $protectedCount++
            }
        }
        catch {
            Write-Host "❌ Failed to protect directory: $dir - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    else {
        Write-Host "⚠️  Directory not found: $dir (will be protected when created)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔒 Protection Summary:" -ForegroundColor Cyan
Write-Host "   Protected: $protectedCount files" -ForegroundColor Green
Write-Host "   Errors: $errorCount" -ForegroundColor Red
Write-Host ""
Write-Host "💡 To unprotect files, run: .\scripts\unprotect-critical-files.ps1" -ForegroundColor Blue
Write-Host "⚠️  Remember: Protected files cannot be modified until unprotected!" -ForegroundColor Yellow 