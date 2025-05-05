# Memory Integration Tests PowerShell Runner
# This script ensures proper configuration for running memory integration tests

Write-Host "Memory Integration Tests Runner" -ForegroundColor Cyan

# Check if Qdrant is running
$qdrantRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6333/collections" -Method Get -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $qdrantRunning = $true
        Write-Host "✅ Qdrant is running" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Qdrant is not running at http://localhost:6333" -ForegroundColor Red
    Write-Host "Please start Qdrant before running the tests" -ForegroundColor Yellow
    exit 1
}

# Check for OpenAI API Key
if (-not $env:OPENAI_API_KEY -and -not $env:TEST_OPENAI_API_KEY) {
    Write-Host "❌ OpenAI API key not found in environment variables" -ForegroundColor Red
    Write-Host "Please set OPENAI_API_KEY or TEST_OPENAI_API_KEY environment variable" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ OpenAI API key found in environment" -ForegroundColor Green
}

# Setup test collections
Write-Host "Setting up test collections..." -ForegroundColor Cyan
npx tsx src/server/memory/testing/setup-test-collections.ts

# Pause to ensure collections are ready
Start-Sleep -Seconds 2

# Run the tests with extended timeout
Write-Host "Running memory integration tests..." -ForegroundColor Cyan
npx vitest run src/server/memory/testing/integration --testTimeout=15000

Write-Host "Tests completed. See above for results." -ForegroundColor Cyan 