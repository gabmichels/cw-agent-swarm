# File Naming Migration Script - Context-Aware Migration
# Usage: .\scripts\MigrateFileNames.ps1 [-DryRun] [-Verbose]

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

function Should-RenameFile {
    param([string]$filePath, [string]$fileName)
    
    # Skip Next.js special files
    if ($fileName -match '^(page|layout|route|loading|error|not-found)\.(ts|tsx)$') {
        return $false
    }
    
    # Skip index.ts files (module convention)
    if ($fileName -eq 'index.ts') {
        return $false
    }
    
    # Skip root executable scripts
    if ($filePath -match '^[^\\]*\\[^\\]*$' -and $fileName -match '\.(js|ts)$' -and $fileName -match '^(bootstrap|setup|init|run|start)') {
        return $false
    }
    
    # Skip configuration files
    if ($fileName -match '^(next\.config|tsconfig|jest\.config|vitest\.config|tailwind\.config)\.(js|ts)$') {
        return $false
    }
    
    # Skip utility files that should stay kebab-case
    $utilityPatterns = @(
        'request-utils', 'id-conversion', 'vector-utils', 'metadata-helpers', 
        'filter-builder', 'query-cache', 'object-utils', 'error-handler'
    )
    
    foreach ($pattern in $utilityPatterns) {
        if ($fileName -match "^$pattern\.(ts|tsx)$") {
            return $false
        }
    }
    
    return $true
}

function Get-NewFileName {
    param([string]$oldName, [string]$filePath)
    
    # Check if file should be renamed
    if (-not (Should-RenameFile $filePath $oldName)) {
        return $oldName
    }
    
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
        # Regular file conversion - only if it looks like a class/service
        # Keep utilities in kebab-case, convert classes/services to PascalCase
        if ($baseName -match '^[a-z]' -or $baseName -match '[-_]') {
            # Check if this looks like a class/service file
            $classServicePatterns = @(
                'Agent', 'Service', 'Manager', 'Provider', 'Factory', 'Handler', 
                'Processor', 'Generator', 'Validator', 'Registry', 'Repository',
                'Controller', 'Orchestrator', 'Analyzer', 'Optimizer', 'Engine'
            )
            
            $isClassService = $false
            foreach ($pattern in $classServicePatterns) {
                if ($baseName -match $pattern -or $filePath -match "\\(services|agents|lib)\\") {
                    $isClassService = $true
                    break
                }
            }
            
            if ($isClassService) {
                $newBaseName = Convert-ToTitleCase $baseName
            } else {
                # Keep as kebab-case for utilities
                $newBaseName = $baseName
            }
        } else {
            # Already PascalCase
            $newBaseName = $baseName
        }
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
Write-Host "🔄 Starting Context-Aware File Naming Migration" -ForegroundColor Green
Write-Host "📁 Scanning src directory for files to rename..." -ForegroundColor Blue

# Get all TypeScript files that need renaming
$tsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | Where-Object { 
    $newName = Get-NewFileName $_.Name $_.FullName
    $newName -ne $_.Name
}

$tsxFiles = Get-ChildItem -Path "src" -Filter "*.tsx" -Recurse | Where-Object { 
    $newName = Get-NewFileName $_.Name $_.FullName
    $newName -ne $_.Name
}

$allFiles = $tsFiles + $tsxFiles

if ($allFiles.Count -eq 0) {
    Write-Host "✅ No files need renaming - all files follow appropriate conventions!" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($allFiles.Count) files that need renaming:" -ForegroundColor Yellow
Write-Host "(Respecting Next.js, utility, and configuration file conventions)" -ForegroundColor Gray

# Build file mapping
$fileNameMappings = @{}
$renamedFiles = @()

foreach ($file in $allFiles) {
    $newName = Get-NewFileName $file.Name $file.FullName
    if ($newName -ne $file.Name) {
        $fileNameMappings[$file.Name] = $newName
        $renamedFiles += @{
            OldPath = $file.FullName
            NewPath = Join-Path $file.Directory $newName
            OldName = $file.Name
            NewName = $newName
        }
        
        # Categorize the change
        $category = "Class/Service"
        if ($file.Name -match "test") { $category = "Test" }
        elseif ($file.Name -match "interface") { $category = "Interface" }
        elseif ($file.Name -match "types") { $category = "Types" }
        
        Write-Host "  [$category] $($file.Name) → $newName" -ForegroundColor Cyan
    }
}

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No files will be renamed" -ForegroundColor Yellow
    Write-Host "Files that will be KEPT as-is (following conventions):" -ForegroundColor Green
    
    # Show files that are being kept
    $keptFiles = Get-ChildItem -Path "src" -Filter "*.ts*" -Recurse | Where-Object { 
        $newName = Get-NewFileName $_.Name $_.FullName
        $newName -eq $_.Name
    } | Select-Object -First 10
    
    foreach ($file in $keptFiles) {
        $reason = "Unknown"
        if ($file.Name -match '^(page|layout|route)\.(ts|tsx)$') { $reason = "Next.js convention" }
        elseif ($file.Name -eq 'index.ts') { $reason = "Module entry point" }
        elseif ($file.Name -match 'config\.(js|ts)$') { $reason = "Configuration file" }
        elseif ($file.Name -match '(utils|helpers)\.(ts|tsx)$') { $reason = "Utility file" }
        
        Write-Host "  ✓ $($file.Name) ($reason)" -ForegroundColor Green
    }
    
    Write-Host "`nRun without -DryRun to perform actual migration" -ForegroundColor Yellow
    exit 0
}

# Confirm migration
Write-Host "`nThis will rename $($fileNameMappings.Count) files while preserving framework conventions." -ForegroundColor Yellow
$confirm = Read-Host "Proceed with context-aware migration? (y/N)"
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
$allTsFiles = Get-ChildItem -Path "src" -Filter "*.ts*" -Recurse
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

# Check for remaining inconsistent files (excluding those that should stay as-is)
$remainingFiles = Get-ChildItem -Path "src" -Filter "*.ts*" -Recurse | Where-Object { 
    $newName = Get-NewFileName $_.Name $_.FullName
    $newName -ne $_.Name -and (Should-RenameFile $_.FullName $_.Name)
}

if ($remainingFiles.Count -gt 0) {
    Write-Host "  ⚠️ Files that may still need attention:" -ForegroundColor Yellow
    $remainingFiles | ForEach-Object { Write-Host "    $($_.Name)" -ForegroundColor Gray }
} else {
    Write-Host "  ✅ All applicable files now follow appropriate naming conventions" -ForegroundColor Green
}

Write-Host "`n✅ Context-aware migration completed successfully!" -ForegroundColor Green
Write-Host "📋 Summary:" -ForegroundColor Yellow
Write-Host "  • Renamed class/service files to PascalCase" -ForegroundColor White
Write-Host "  • Kept Next.js files as page.tsx, layout.tsx, route.ts" -ForegroundColor White
Write-Host "  • Preserved index.ts and utility file conventions" -ForegroundColor White
Write-Host "  • Updated all import statements automatically" -ForegroundColor White
Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run 'npm run build' to verify TypeScript compilation" -ForegroundColor White
Write-Host "  2. Run 'npm test' to verify all tests pass" -ForegroundColor White
Write-Host "  3. Review and commit changes" -ForegroundColor White

if ($errorCount -gt 0) {
    Write-Host "`n⚠️ Some files failed to rename. Please review and fix manually." -ForegroundColor Yellow
    exit 1
} else {
    exit 0
}
