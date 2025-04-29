# Find any types in TypeScript files and output a summary
# This script helps identify remaining 'any' types in the codebase

param (
    [string]$directory = "src",
    [switch]$excludeDeclarationFiles = $true,
    [switch]$excludeNodeModules = $true,
    [switch]$verbose = $false
)

# Patterns to search for
$patterns = @(
    ": any",
    "as any",
    "<any>",
    "Array<any>",
    "any\[\]",
    "Promise<any>"
)

# Directories to exclude
$excludeDirs = @()
if ($excludeNodeModules) {
    $excludeDirs += "node_modules"
}

# File types to include or exclude
$fileFilter = "*.ts*"
$excludeFilter = @()
if ($excludeDeclarationFiles) {
    $excludeFilter += "*.d.ts"
}

# Function to search files for patterns
function Find-AnyTypes {
    param (
        [string]$dir,
        [string[]]$patterns,
        [string[]]$excludeDirs,
        [string]$fileFilter,
        [string[]]$excludeFilter
    )

    $results = @{}
    $totalOccurrences = 0
    $totalFiles = 0
    $filesWithAny = 0

    # Get all the files
    $files = Get-ChildItem -Path $dir -Recurse -File -Filter $fileFilter |
        Where-Object {
            $include = $true
            foreach ($exclude in $excludeDirs) {
                if ($_.FullName -like "*\$exclude\*") {
                    $include = $false
                    break
                }
            }
            foreach ($exclude in $excludeFilter) {
                if ($_.Name -like $exclude) {
                    $include = $false
                    break
                }
            }
            $include
        }

    $totalFiles = $files.Count
    
    # For each file, check for patterns
    foreach ($file in $files) {
        $content = Get-Content -Path $file.FullName -Raw
        $fileOccurrences = 0
        
        foreach ($pattern in $patterns) {
            $matches = [regex]::Matches($content, $pattern)
            $fileOccurrences += $matches.Count
            
            if ($verbose -and $matches.Count -gt 0) {
                Write-Host "Found $($matches.Count) occurrences of '$pattern' in $($file.FullName)"
                $lineNumbers = @()
                $lines = Get-Content -Path $file.FullName
                for ($i = 0; $i -lt $lines.Length; $i++) {
                    if ($lines[$i] -match $pattern) {
                        $lineNumbers += ($i + 1)
                    }
                }
                Write-Host "  At lines: $($lineNumbers -join ', ')"
            }
        }
        
        if ($fileOccurrences -gt 0) {
            $results[$file.FullName] = $fileOccurrences
            $totalOccurrences += $fileOccurrences
            $filesWithAny++
        }
    }
    
    return @{
        Results = $results
        TotalOccurrences = $totalOccurrences
        TotalFiles = $totalFiles
        FilesWithAny = $filesWithAny
    }
}

Write-Host "Searching for 'any' types in $directory..."
$searchResults = Find-AnyTypes -dir $directory -patterns $patterns -excludeDirs $excludeDirs -fileFilter $fileFilter -excludeFilter $excludeFilter

# Display summary
Write-Host "`nSummary:"
Write-Host "- Found $($searchResults.TotalOccurrences) occurrences of 'any' types"
Write-Host "- $($searchResults.FilesWithAny) of $($searchResults.TotalFiles) files contain 'any' types"
Write-Host "- $([math]::Round(($searchResults.FilesWithAny / $searchResults.TotalFiles) * 100, 2))% of files have 'any' types"

# Show files with the most 'any' types
if ($searchResults.Results.Count -gt 0) {
    Write-Host "`nFiles with the most 'any' types:"
    $searchResults.Results.GetEnumerator() | 
        Sort-Object -Property Value -Descending | 
        Select-Object -First 10 | 
        ForEach-Object {
            Write-Host "$($_.Key): $($_.Value) occurrences"
        }
}

# Provide guidance
Write-Host "`nGuidance:"
Write-Host "- Run with -verbose to see line numbers"
Write-Host "- Check docs/TYPE_SAFETY.md for best practices"
Write-Host "- Replace 'any' with 'unknown' for error handling"
Write-Host "- Use specific interfaces for data structures" 