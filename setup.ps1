# Setup script to install dependencies and start development server

Write-Output "Installing dependencies..."
npm install

Write-Output "Setting up environment variables..."
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Output "Created .env file from .env.example"
    }
}

Write-Output "Starting development server..."
npm run dev 