#!/usr/bin/env node

/**
 * This script helps fix "Cannot find module X" TypeScript errors
 * by creating an ambient type declaration file.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask for input
const ask = (question) => new Promise((resolve) => {
  rl.question(question, resolve);
});

// Path to create ambient declarations
const TYPES_PATH = path.join(__dirname, '../types');

// List of common modules that may need declarations
const COMMON_MODULES = [
  'discord.js',
  'cron',
  'langgraph',
  '@langchain/core',
  '@langchain/openai',
  '@langchain/langgraph',
];

// Main function
async function main() {
  console.log('🔍 Fix Missing Dependencies Tool');
  console.log('-------------------------------');
  
  // Create types directory if it doesn't exist
  if (!fs.existsSync(TYPES_PATH)) {
    fs.mkdirSync(TYPES_PATH, { recursive: true });
  }
  
  // Create ambient-modules.d.ts file if it doesn't exist
  const ambientFilePath = path.join(TYPES_PATH, 'ambient-modules.d.ts');
  
  if (!fs.existsSync(ambientFilePath)) {
    // Create a basic ambient declarations file
    const ambientContent = `/**
 * Ambient module declarations for modules without type definitions
 * Use this file to add quick fixes for "Cannot find module" errors
 */

`;
    fs.writeFileSync(ambientFilePath, ambientContent);
  }

  // Add references to tsconfig
  ensureTsConfigReferences();

  if (process.argv.includes('--auto')) {
    // Auto mode - add declarations for common modules
    for (const moduleName of COMMON_MODULES) {
      addModuleDeclaration(moduleName);
    }
    console.log('✅ Added ambient declarations for common modules');
    rl.close();
    return;
  }

  // Interactive mode
  while (true) {
    const moduleName = await ask('Enter module name to create declaration for (or "exit" to quit): ');
    
    if (moduleName.toLowerCase() === 'exit') {
      break;
    }
    
    addModuleDeclaration(moduleName);
    console.log(`✅ Added ambient declaration for '${moduleName}'`);
  }
  
  rl.close();
  
  console.log('\n📝 Update your tsconfig.json or package tsconfigs:');
  console.log('Add to compilerOptions:');
  console.log('  "skipLibCheck": true');
  console.log('  "paths": {');
  console.log('    "*": ["./types/*"]');
  console.log('  }');
}

// Function to add a module declaration
function addModuleDeclaration(moduleName) {
  const ambientFilePath = path.join(TYPES_PATH, 'ambient-modules.d.ts');
  const content = fs.readFileSync(ambientFilePath, 'utf8');
  
  // Check if module already declared
  if (content.includes(`declare module '${moduleName}'`)) {
    console.log(`⚠️ Module '${moduleName}' already declared`);
    return;
  }
  
  // Add declaration
  const declaration = `// Quick fix for ${moduleName}
declare module '${moduleName}' {
  const content: any;
  export = content;
  export * from 'content';
}

`;
  
  fs.appendFileSync(ambientFilePath, declaration);
}

// Function to ensure tsconfig references the types directory
function ensureTsConfigReferences() {
  const tsConfigPath = path.join(__dirname, '../tsconfig.json');
  
  if (!fs.existsSync(tsConfigPath)) {
    console.log('⚠️ No root tsconfig.json found');
    return;
  }
  
  try {
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    
    // Ensure include has types directory
    if (!tsConfig.include) {
      tsConfig.include = [];
    }
    
    if (!tsConfig.include.includes('types/**/*.d.ts')) {
      tsConfig.include.push('types/**/*.d.ts');
      fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
      console.log('✅ Updated tsconfig.json to include types directory');
    }
  } catch (error) {
    console.error('Error updating tsconfig.json:', error);
  }
}

// Run the main function
main().catch(console.error); 