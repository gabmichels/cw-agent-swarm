# File Naming Migration Plan

## Overview
This document outlines the systematic migration from mixed file naming conventions (kebab-case, camelCase, PascalCase) to standardized **PascalCase** for all TypeScript files in the codebase.

## Current State Analysis

### Naming Patterns Found
1. **kebab-case**: `agent-log-test.ts`, `test-api-key-loading.ts`, `test-approval-system.ts`
2. **camelCase**: `bootstrapAgents.ts`, `databaseAgentRegistration.ts`
3. **PascalCase**: `KnowledgeGraphManager.ts`, `DefaultAgent.ts`, `AgentFactory.ts` ✅ (Already correct)

### Migration Strategy

**Phase 1: Automated Renaming**
- Use PowerShell script to rename files systematically
- Update all import statements automatically
- Preserve git history using `git mv`

**Phase 2: Manual Verification**
- Verify all imports are updated correctly
- Check for any dynamic imports or string-based references
- Test that build still works

**Phase 3: Documentation Update**
- Update any documentation that references old file names
- Update README files and guides

## Migration Script

### PowerShell Migration Script

```powershell
# File: scripts/migrate-file-names.ps1

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

function Convert-ToTitleCase {
    param([string]$text)
    
    # Convert kebab-case and camelCase to PascalCase
    $words = $text -split '[-_]' | ForEach-Object {
        if ($_.Length -gt 0) {
            $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
        }
    }
    
    # Handle camelCase conversion
    $result = $text -creplace '([a-z])([A-Z])', '$1-$2' -split '-' | ForEach-Object {
        if ($_.Length -gt 0) {
            $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
        }
    }
    
    return ($result -join '')
}

function Get-NewFileName {
    param([string]$oldName)
    
    # Extract base name without extension
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($oldName)
    $extension = [System.IO.Path]::GetExtension($oldName)
    
    # Handle special cases
    if ($baseName -match '^test-') {
        # test-api-key-loading.ts → ApiKeyLoadingTest.ts
        $testName = $baseName.Substring(5) # Remove 'test-' prefix
        $newBaseName = (Convert-ToTitleCase $testName) + 'Test'
    }
    elseif ($baseName -match '\.test$') {
        # existing-name.test.ts → ExistingNameTest.ts
        $testName = $baseName.Substring(0, $baseName.Length - 5) # Remove '.test' suffix
        $newBaseName = (Convert-ToTitleCase $testName) + 'Test'
    }
    elseif ($baseName -match '\.integration\.test$') {
        # existing-name.integration.test.ts → ExistingNameIntegrationTest.ts
        $testName = $baseName.Substring(0, $baseName.Length - 17) # Remove '.integration.test' suffix
        $newBaseName = (Convert-ToTitleCase $testName) + 'IntegrationTest'
    }
    elseif ($baseName -match '\.interface$') {
        # existing-name.interface.ts → ExistingNameInterface.ts
        $interfaceName = $baseName.Substring(0, $baseName.Length - 10) # Remove '.interface' suffix
        $newBaseName = (Convert-ToTitleCase $interfaceName) + 'Interface'
    }
    elseif ($baseName -match '\.types$') {
        # existing-name.types.ts → ExistingNameTypes.ts
        $typesName = $baseName.Substring(0, $baseName.Length - 6) # Remove '.types' suffix
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
    
    $content = Get-Content $filePath -Raw
    $originalContent = $content
    
    foreach ($oldName in $fileNameMappings.Keys) {
        $newName = $fileNameMappings[$oldName]
        $oldBaseName = [System.IO.Path]::GetFileNameWithoutExtension($oldName)
        $newBaseName = [System.IO.Path]::GetFileNameWithoutExtension($newName)
        
        # Update import statements
        $content = $content -replace "from ['""]\.\/.*\/$oldBaseName['""]", "from './$newBaseName'"
        $content = $content -replace "from ['""]\.\.\/.*\/$oldBaseName['""]", "from '../$newBaseName'"
        $content = $content -replace "import.*from ['""].*\/$oldBaseName['""]", { $_.Value -replace $oldBaseName, $newBaseName }
    }
    
    if ($content -ne $originalContent) {
        if (-not $DryRun) {
            Set-Content $filePath -Value $content -NoNewline
        }
        if ($Verbose) {
            Write-Host "Updated imports in: $filePath"
        }
    }
}

# Main migration logic
Write-Host "🔄 Starting File Naming Migration to PascalCase" -ForegroundColor Green

# Get all TypeScript files
$tsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | Where-Object { 
    $_.Name -notmatch "^[A-Z]" -or $_.Name -match "[-_]" 
}

if ($tsFiles.Count -eq 0) {
    Write-Host "✅ No files need renaming - all files already follow PascalCase convention" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($tsFiles.Count) files that need renaming:" -ForegroundColor Yellow

# Build file mapping
$fileNameMappings = @{}
foreach ($file in $tsFiles) {
    $newName = Get-NewFileName $file.Name
    if ($newName -ne $file.Name) {
        $fileNameMappings[$file.Name] = $newName
        Write-Host "  $($file.Name) → $newName" -ForegroundColor Cyan
    }
}

if ($DryRun) {
    Write-Host "`n🔍 DRY RUN MODE - No files will be renamed" -ForegroundColor Yellow
    Write-Host "Run without -DryRun to perform actual migration" -ForegroundColor Yellow
    exit 0
}

# Confirm migration
$confirm = Read-Host "`nProceed with renaming $($fileNameMappings.Count) files? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Migration cancelled" -ForegroundColor Red
    exit 1
}

# Phase 1: Rename files using git mv to preserve history
Write-Host "`n📁 Phase 1: Renaming files..." -ForegroundColor Blue
foreach ($file in $tsFiles) {
    $newName = $fileNameMappings[$file.Name]
    if ($newName) {
        $oldPath = $file.FullName
        $newPath = Join-Path $file.Directory $newName
        
        try {
            # Use git mv to preserve history
            git mv $oldPath $newPath
            if ($Verbose) {
                Write-Host "  Renamed: $($file.Name) → $newName" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  ❌ Failed to rename $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Phase 2: Update import statements
Write-Host "`n🔗 Phase 2: Updating import statements..." -ForegroundColor Blue
$allTsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse
foreach ($file in $allTsFiles) {
    Update-ImportStatements $file.FullName $fileNameMappings
}

# Phase 3: Update other references
Write-Host "`n📝 Phase 3: Updating other references..." -ForegroundColor Blue

# Update package.json scripts if they reference specific files
$packageJsonPath = "package.json"
if (Test-Path $packageJsonPath) {
    $packageContent = Get-Content $packageJsonPath -Raw
    $originalPackageContent = $packageContent
    
    foreach ($oldName in $fileNameMappings.Keys) {
        $newName = $fileNameMappings[$oldName]
        $packageContent = $packageContent -replace $oldName, $newName
    }
    
    if ($packageContent -ne $originalPackageContent) {
        Set-Content $packageJsonPath -Value $packageContent -NoNewline
        Write-Host "  Updated package.json" -ForegroundColor Green
    }
}

# Update tsconfig.json and other config files
$configFiles = @("tsconfig.json", "jest.config.js", "vitest.config.ts")
foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        $configContent = Get-Content $configFile -Raw
        $originalConfigContent = $configContent
        
        foreach ($oldName in $fileNameMappings.Keys) {
            $newName = $fileNameMappings[$oldName]
            $configContent = $configContent -replace $oldName, $newName
        }
        
        if ($configContent -ne $originalConfigContent) {
            Set-Content $configFile -Value $configContent -NoNewline
            Write-Host "  Updated $configFile" -ForegroundColor Green
        }
    }
}

Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run 'npm run build' to verify TypeScript compilation" -ForegroundColor White
Write-Host "  2. Run 'npm test' to verify all tests pass" -ForegroundColor White
Write-Host "  3. Commit changes: git add . && git commit -m 'Migrate to PascalCase file naming'" -ForegroundColor White
```

## Usage Instructions

### 1. Run Dry Run First
```powershell
# Preview what will be renamed
.\scripts\migrate-file-names.ps1 -DryRun -Verbose
```

### 2. Execute Migration
```powershell
# Perform actual migration
.\scripts\migrate-file-names.ps1 -Verbose
```

### 3. Verify Migration
```powershell
# Check TypeScript compilation
npm run build

# Run tests
npm test

# Check for any remaining issues
Get-ChildItem -Path src -Filter "*.ts" -Recurse | Where-Object { $_.Name -match "[-_]" -and $_.Name -notmatch "\.test\." }
```

## Expected Transformations

### Test Files
- `agent-log-test.ts` → `AgentLogTest.ts`
- `test-api-key-loading.ts` → `ApiKeyLoadingTest.ts`
- `test-approval-system.ts` → `ApprovalSystemTest.ts`

### Regular Files
- `bootstrapAgents.ts` → `BootstrapAgents.ts`
- `databaseAgentRegistration.ts` → `DatabaseAgentRegistration.ts`
- `traced-scheduler-test-ts.ts` → `TracedSchedulerTest.ts`

### Special Cases
- `DefaultAgent.integration.test.ts` → `DefaultAgentIntegrationTest.ts`
- `AgentBase.interface.ts` → `AgentBaseInterface.ts`
- `foundation-types.ts` → `FoundationTypes.ts`

## Post-Migration Validation

### Automated Checks
```powershell
# Verify no kebab-case files remain
$remainingKebabFiles = Get-ChildItem -Path src -Filter "*-*.ts" -Recurse | Where-Object { $_.Name -notmatch "\.test\." }
if ($remainingKebabFiles.Count -gt 0) {
    Write-Host "⚠️ Remaining kebab-case files found:" -ForegroundColor Yellow
    $remainingKebabFiles | ForEach-Object { Write-Host "  $($_.Name)" }
}

# Verify all files start with uppercase
$nonPascalFiles = Get-ChildItem -Path src -Filter "*.ts" -Recurse | Where-Object { $_.Name -cmatch "^[a-z]" }
if ($nonPascalFiles.Count -gt 0) {
    Write-Host "⚠️ Files not starting with uppercase found:" -ForegroundColor Yellow
    $nonPascalFiles | ForEach-Object { Write-Host "  $($_.Name)" }
}
```

### Manual Verification
1. **Build Check**: Ensure `npm run build` passes without errors
2. **Test Check**: Ensure `npm test` passes all tests
3. **Import Check**: Verify no broken import statements
4. **Dynamic Import Check**: Search for any string-based imports that might need manual updating

## Benefits After Migration

1. **Consistency**: All TypeScript files follow the same naming convention
2. **IDE Support**: Better autocomplete and navigation
3. **Import Clarity**: Clear correspondence between file names and exports
4. **Industry Standard**: Aligns with React, Angular, and most TypeScript projects
5. **Developer Experience**: Eliminates confusion about file naming patterns

## Rollback Plan

If issues arise, rollback using git:
```bash
# Rollback all changes
git reset --hard HEAD~1

# Or rollback specific files
git checkout HEAD~1 -- src/path/to/specific/file.ts
```

## Integration with Unified Tools Foundation

This migration aligns with the Unified Tools Foundation project by:
- Establishing consistent patterns across the codebase
- Improving developer experience during Phase 2 integration
- Reducing cognitive load when working with multiple tool systems
- Supporting the overall architecture refactoring goals 