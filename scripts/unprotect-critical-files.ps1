# Unprotect Critical Files Script
# Removes read-only protection from critical system files to allow modification

Write-Host "🔓 Unprotecting critical files..." -ForegroundColor Yellow

# Find environment files (.env, .env.*)
$envFiles = Get-ChildItem -Path "." -Filter ".env*" -File | Select-Object -ExpandProperty Name

# Find database files (*.db, *.sqlite, journal files)
$dbFiles = @()
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*.db" -File | Select-Object -ExpandProperty FullName
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*.sqlite" -File | Select-Object -ExpandProperty FullName
$dbFiles += Get-ChildItem -Path "." -Recurse -Filter "*journal*" -File | Select-Object -ExpandProperty FullName

# Define critical directories to unprotect
$criticalDirectories = @(
    "backups"
)

$unprotectedCount = 0
$errorCount = 0

# Unprotect environment files
Write-Host "🌍 Unprotecting environment files..." -ForegroundColor Cyan
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        try {
            Set-ItemProperty -Path $file -Name IsReadOnly -Value $false
            Write-Host "✅ Unprotected: $file" -ForegroundColor Green
            $unprotectedCount++
        }
        catch {
            Write-Host "❌ Failed to unprotect: $file - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
}

# Unprotect database files
Write-Host "🗄️  Unprotecting database files..." -ForegroundColor Cyan
foreach ($file in $dbFiles) {
    if (Test-Path $file) {
        try {
            Set-ItemProperty -Path $file -Name IsReadOnly -Value $false
            Write-Host "✅ Unprotected: $file" -ForegroundColor Green
            $unprotectedCount++
        }
        catch {
            Write-Host "❌ Failed to unprotect: $file - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
}

# Unprotect directories (remove read-only from all files)
Write-Host "📁 Unprotecting backup directories..." -ForegroundColor Cyan
foreach ($dir in $criticalDirectories) {
    if (Test-Path $dir) {
        try {
            Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
                Set-ItemProperty -Path $_.FullName -Name IsReadOnly -Value $false
                Write-Host "✅ Unprotected: $($_.FullName)" -ForegroundColor Green
                $unprotectedCount++
            }
        }
        catch {
            Write-Host "❌ Failed to unprotect directory: $dir - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    else {
        Write-Host "⚠️  Directory not found: $dir" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔓 Unprotection Summary:" -ForegroundColor Cyan
Write-Host "   Unprotected: $unprotectedCount files" -ForegroundColor Green
Write-Host "   Errors: $errorCount" -ForegroundColor Red
Write-Host ""
Write-Host "💡 To protect files again, run: .\scripts\protect-critical-files.ps1" -ForegroundColor Blue
Write-Host "⚠️  Remember: Files are now modifiable - use caution!" -ForegroundColor Yellow 