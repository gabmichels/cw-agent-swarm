#!/usr/bin/env node

/**
 * Project setup script
 * 
 * This script initializes the development environment, creating necessary
 * directories and configuration files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to ensure exist
const requiredDirs = [
  'data/memory',
  'data/config',
  'data/resources',
];

// Make sure all required directories exist
function ensureDirectories() {
  console.log('Ensuring required directories exist...');
  
  requiredDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

// Create example environment file if it doesn't exist
function createEnvFileIfNeeded() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log('Creating .env file from example...');
    fs.copyFileSync(envExamplePath, envPath);
  }
}

// Run the script
function main() {
  console.log('Setting up development environment...');
  
  ensureDirectories();
  createEnvFileIfNeeded();
  
  console.log('Setup complete!');
}

main(); 