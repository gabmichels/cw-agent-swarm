# File Naming Migration Script - Convert to PascalCase
# Usage: .\scripts\migrate-file-names.ps1 [-DryRun] [-Verbose]

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

function Convert-ToTitleCase {
    param([string]$text)
    
    # Handle kebab-case and underscore separation
    if ($text -match '[-_]') {
        $words = $text -split '[-_]' | ForEach-Object {
            if ($_.Length -gt 0) {
                $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
            }
        }
        return ($words -join '')
    }
    
    # Handle camelCase conversion (convert to PascalCase)
    if ($text -cmatch '^[a-z]') {
        return $text.Substring(0,1).ToUpper() + $text.Substring(1)
    }
    
    # Already PascalCase
    return $text
}

function Get-NewFileName {
    param([string]$oldName)
    
    # Extract base name without extension
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($oldName)
    $extension = [System.IO.Path]::GetExtension($oldName)
    
    # Handle special test file patterns
    if ($baseName -match '^test-(.+)$') {
        # test-api-key-loading → ApiKeyLoadingTest
        $testName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $testName) + 'Test'
    }
    elseif ($baseName -match '^(.+)-test$') {
        # agent-log-test → AgentLogTest
        $testName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $testName) + 'Test'
    }
    elseif ($baseName -match '^(.+)\.test$') {
        # existing-name.test → ExistingNameTest
        $testName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $testName) + 'Test'
    }
    elseif ($baseName -match '^(.+)\.integration\.test$') {
        # existing-name.integration.test → ExistingNameIntegrationTest
        $testName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $testName) + 'IntegrationTest'
    }
    elseif ($baseName -match '^(.+)\.interface$') {
        # existing-name.interface → ExistingNameInterface
        $interfaceName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $interfaceName) + 'Interface'
    }
    elseif ($baseName -match '^(.+)\.types$') {
        # existing-name.types → ExistingNameTypes
        $typesName = $matches[1]
        $newBaseName = (Convert-ToTitleCase $typesName) + 'Types'
    }
    else {
        # Regular file conversion
        $newBaseName = Convert-ToTitleCase $baseName
    }
    
    return $newBaseName + $extension
}

function Update-ImportStatements {
    param([string]$filePath, [hashtable]$fileNameMappings)
    
    if (-not (Test-Path $filePath)) {
        return
    }
    
    $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) {
        return
    }
    
    $originalContent = $content
    
    foreach ($oldName in $fileNameMappings.Keys) {
        $newName = $fileNameMappings[$oldName]
        $oldBaseName = [System.IO.Path]::GetFileNameWithoutExtension($oldName)
        $newBaseName = [System.IO.Path]::GetFileNameWithoutExtension($newName)
        
        # Update various import patterns
        $patterns = @(
            "from ['""]\./$oldBaseName['""]",
            "from ['""]\.\./$oldBaseName['""]",
            "from ['""]\.\.\/.*\/$oldBaseName['""]",
            "from ['""]\.\/.*\/$oldBaseName['""]",
            "import.*from ['""].*\/$oldBaseName['""]"
        )
        
        foreach ($pattern in $patterns) {
            $content = $content -replace $pattern, { $_.Value -replace $oldBaseName, $newBaseName }
        }
    }
    
    if ($content -ne $originalContent) {
        if (-not $DryRun) {
            Set-Content $filePath -Value $content -NoNewline -ErrorAction SilentlyContinue
        }
        if ($Verbose) {
            Write-Host "  Updated imports in: $([System.IO.Path]::GetFileName($filePath))" -ForegroundColor Cyan
        }
    }
}

# Main migration logic
Write-Host "🔄 Starting File Naming Migration to PascalCase" -ForegroundColor Green
Write-Host "📁 Scanning src directory for files to rename..." -ForegroundColor Blue

# Get all TypeScript files that need renaming
$tsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | Where-Object { 
    $newName = Get-NewFileName $_.Name
    $newName -ne $_.Name
}

if ($tsFiles.Count -eq 0) {
    Write-Host "✅ No files need renaming - all files already follow PascalCase convention!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($tsFiles.Count) files that need renaming:" -ForegroundColor Yellow

# Build file mapping
$fileNameMappings = @{}
$renamedFiles = @()

foreach ($file in $tsFiles) {
    $newName = Get-NewFileName $file.Name
    if ($newName -ne $file.Name) {
        $fileNameMappings[$file.Name] = $newName
        $renamedFiles += @{
            OldPath = $file.FullName
            NewPath = Join-Path $file.Directory $newName
            OldName = $file.Name
            NewName = $newName
        }
        Write-Host "  $($file.Name) → $newName" -ForegroundColor Cyan
    }
}

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No files will be renamed" -ForegroundColor Yellow
    Write-Host "Run without -DryRun to perform actual migration" -ForegroundColor Yellow
    exit 0
}

# Confirm migration
Write-Host "`nThis will rename $($fileNameMappings.Count) files and update all import statements." -ForegroundColor Yellow
$confirm = Read-Host "Proceed with migration? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Migration cancelled" -ForegroundColor Red
    exit 1
}

# Phase 1: Rename files using git mv to preserve history
Write-Host "`n📁 Phase 1: Renaming files..." -ForegroundColor Blue
$successCount = 0
$errorCount = 0

foreach ($fileInfo in $renamedFiles) {
    try {
        # Check if git is available and we're in a git repo
        $isGitRepo = (git rev-parse --git-dir 2>$null) -ne $null
        
        if ($isGitRepo) {
            # Use git mv to preserve history
            git mv $fileInfo.OldPath $fileInfo.NewPath 2>$null
        } else {
            # Fallback to regular rename
            Move-Item $fileInfo.OldPath $fileInfo.NewPath
        }
        
        $successCount++
        if ($Verbose) {
            Write-Host "  ✅ $($fileInfo.OldName) → $($fileInfo.NewName)" -ForegroundColor Green
        }
    }
    catch {
        $errorCount++
        Write-Host "  ❌ Failed to rename $($fileInfo.OldName): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "  Renamed $successCount files successfully" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "  $errorCount files failed to rename" -ForegroundColor Red
}

# Phase 2: Update import statements
Write-Host "`n🔗 Phase 2: Updating import statements..." -ForegroundColor Blue
$allTsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse
$importUpdateCount = 0

foreach ($file in $allTsFiles) {
    $sizeBefore = (Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue).Length
    Update-ImportStatements $file.FullName $fileNameMappings
    $sizeAfter = (Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue).Length
    
    if ($sizeBefore -ne $sizeAfter) {
        $importUpdateCount++
    }
}

Write-Host "  Updated imports in $importUpdateCount files" -ForegroundColor Green

# Phase 3: Update configuration files
Write-Host "`n📝 Phase 3: Updating configuration files..." -ForegroundColor Blue

$configFiles = @("package.json", "tsconfig.json", "jest.config.js", "vitest.config.ts")
$configUpdateCount = 0

foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        $configContent = Get-Content $configFile -Raw -ErrorAction SilentlyContinue
        if ($configContent) {
            $originalConfigContent = $configContent
            
            foreach ($oldName in $fileNameMappings.Keys) {
                $newName = $fileNameMappings[$oldName]
                $configContent = $configContent -replace [regex]::Escape($oldName), $newName
            }
            
            if ($configContent -ne $originalConfigContent) {
                Set-Content $configFile -Value $configContent -NoNewline
                Write-Host "  Updated $configFile" -ForegroundColor Green
                $configUpdateCount++
            }
        }
    }
}

if ($configUpdateCount -eq 0) {
    Write-Host "  No configuration files needed updates" -ForegroundColor Gray
}

# Final verification
Write-Host "`n🔍 Phase 4: Verification..." -ForegroundColor Blue

# Check for remaining non-PascalCase files
$remainingFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | Where-Object { 
    $_.Name -cmatch "^[a-z]" -or ($_.Name -match "[-_]" -and $_.Name -notmatch "\.test\.")
}

if ($remainingFiles.Count -gt 0) {
    Write-Host "  ⚠️ Files that may still need attention:" -ForegroundColor Yellow
    $remainingFiles | ForEach-Object { Write-Host "    $($_.Name)" -ForegroundColor Gray }
} else {
    Write-Host "  ✅ All TypeScript files now follow PascalCase convention" -ForegroundColor Green
}

Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run 'npm run build' to verify TypeScript compilation" -ForegroundColor White
Write-Host "  2. Run 'npm test' to verify all tests pass" -ForegroundColor White
Write-Host "  3. Review and commit changes" -ForegroundColor White

if ($errorCount -gt 0) {
    Write-Host "`n⚠️ Some files failed to rename. Please review and fix manually." -ForegroundColor Yellow
    exit 1
} else {
    exit 0
} 