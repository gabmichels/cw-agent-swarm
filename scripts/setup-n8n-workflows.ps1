# N8N Workflows Repository Setup Script (Windows PowerShell)
# This script automates the setup process for the n8n-workflows repository

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up N8N Workflows Repository..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "data")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Check if git is available
try {
    git --version | Out-Null
    Write-Host "✅ Git is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

# Check if python is available
$pythonCmd = $null
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if (-not $pythonCmd) {
    Write-Host "❌ Error: Python is not installed. Please install Python 3.7+ first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Using Python: $pythonCmd" -ForegroundColor Green

# Navigate to data directory
Set-Location data

# Check if repository already exists
if (Test-Path "n8n-workflows-repo") {
    Write-Host "📁 N8N workflows repository already exists" -ForegroundColor Yellow
    $update = Read-Host "Do you want to update it? (y/N)"
    if ($update -eq "y" -or $update -eq "Y") {
        Write-Host "🔄 Updating existing repository..." -ForegroundColor Blue
        Set-Location n8n-workflows-repo
        git pull origin main
        Write-Host "🔄 Reindexing database..." -ForegroundColor Blue
        & $pythonCmd workflow_db.py --index
        Write-Host "✅ Repository updated successfully!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "ℹ️  Using existing repository" -ForegroundColor Blue
        exit 0
    }
}

# Clone the repository
Write-Host "📥 Cloning n8n-workflows repository..." -ForegroundColor Blue
git clone https://github.com/Zie619/n8n-workflows.git n8n-workflows-repo

# Navigate to repository
Set-Location n8n-workflows-repo

# Install Python dependencies
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Blue
& $pythonCmd -m pip install -r requirements.txt

# Initialize database
Write-Host "🗄️  Initializing workflow database..." -ForegroundColor Blue
& $pythonCmd workflow_db.py --index

# Verify setup
if (Test-Path "workflows.db") {
    $workflowCount = & $pythonCmd -c "import sqlite3; conn = sqlite3.connect('workflows.db'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM workflows'); print(cursor.fetchone()[0]); conn.close()"
    Write-Host "✅ Setup complete! Indexed $workflowCount workflows." -ForegroundColor Green
} else {
    Write-Host "❌ Error: Database creation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 N8N Workflows Repository setup successful!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start the FastAPI server: cd data/n8n-workflows-repo && $pythonCmd api_server.py --port 8080" -ForegroundColor White
Write-Host "2. Access workflows via: http://localhost:8080" -ForegroundColor White
Write-Host "3. Or use the Next.js API: http://localhost:3000/api/workflows" -ForegroundColor White
Write-Host ""
Write-Host "To update workflows in the future:" -ForegroundColor Cyan
Write-Host "  cd data/n8n-workflows-repo" -ForegroundColor White
Write-Host "  git pull origin main" -ForegroundColor White
Write-Host "  $pythonCmd workflow_db.py --reindex" -ForegroundColor White 