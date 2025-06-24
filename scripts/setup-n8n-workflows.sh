#!/bin/bash

# N8N Workflows Repository Setup Script
# This script automates the setup process for the n8n-workflows repository

set -e  # Exit on any error

echo "🚀 Setting up N8N Workflows Repository..."

# Check if we're in the right directory
if [ ! -d "data" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: Git is not installed. Please install Git first."
    exit 1
fi

# Check if python is available
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Error: Python is not installed. Please install Python 3.7+ first."
    exit 1
fi

# Determine python command
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "✅ Using Python: $PYTHON_CMD"

# Navigate to data directory
cd data

# Check if repository already exists
if [ -d "n8n-workflows-repo" ]; then
    echo "📁 N8N workflows repository already exists"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Updating existing repository..."
        cd n8n-workflows-repo
        git pull origin main
        echo "🔄 Reindexing database..."
        $PYTHON_CMD workflow_db.py --reindex
        echo "✅ Repository updated successfully!"
        exit 0
    else
        echo "ℹ️  Using existing repository"
        exit 0
    fi
fi

# Clone the repository
echo "📥 Cloning n8n-workflows repository..."
git clone https://github.com/Zie619/n8n-workflows.git n8n-workflows-repo

# Navigate to repository
cd n8n-workflows-repo

# Install Python dependencies
echo "📦 Installing Python dependencies..."
$PYTHON_CMD -m pip install -r requirements.txt

# Initialize database
echo "🗄️  Initializing workflow database..."
$PYTHON_CMD workflow_db.py --index

# Verify setup
if [ -f "workflows.db" ]; then
    WORKFLOW_COUNT=$($PYTHON_CMD -c "import sqlite3; conn = sqlite3.connect('workflows.db'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM workflows'); print(cursor.fetchone()[0]); conn.close()")
    echo "✅ Setup complete! Indexed $WORKFLOW_COUNT workflows."
else
    echo "❌ Error: Database creation failed"
    exit 1
fi

echo ""
echo "🎉 N8N Workflows Repository setup successful!"
echo ""
echo "Next steps:"
echo "1. Start the FastAPI server: cd data/n8n-workflows-repo && $PYTHON_CMD api_server.py --port 8080"
echo "2. Access workflows via: http://localhost:8080"
echo "3. Or use the Next.js API: http://localhost:3000/api/workflows"
echo ""
echo "To update workflows in the future:"
echo "  cd data/n8n-workflows-repo"
echo "  git pull origin main"
echo "  $PYTHON_CMD workflow_db.py --reindex"
