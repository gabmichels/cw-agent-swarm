#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run TypeScript compiler with --listFiles and --noEmit
try {
  console.log('Finding missing dependencies in TypeScript files...');
  const files = execSync('npx tsc --noEmit --listFiles', { encoding: 'utf8' });
  
  // Extract missing module errors
  const tscOutput = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  
  // Regular expression to match "Cannot find module" errors
  const moduleErrorRegex = /Cannot find module '([^']+)'/g;
  const missingModules = new Set();
  
  let match;
  while ((match = moduleErrorRegex.exec(tscOutput)) !== null) {
    missingModules.add(match[1]);
  }
  
  console.log('\nMissing dependencies:');
  
  const packagesToInstall = [];
  
  missingModules.forEach(module => {
    // Skip relative imports
    if (module.startsWith('.')) return;
    
    // Skip @crowd-wisdom/* packages (internal packages)
    if (module.startsWith('@crowd-wisdom/')) return;
    
    let packageName = module;
    
    // Handle scoped packages correctly
    if (module.startsWith('@')) {
      // Take the first two parts for scoped packages (e.g., @types/node)
      packageName = module.split('/').slice(0, 2).join('/');
    } else {
      // Take just the first part for regular packages (e.g., react from react/index)
      packageName = module.split('/')[0];
    }
    
    // Check if this is a type definition that should be installed as devDependency
    const isTypeDefinition = packageName.startsWith('@types/');
    
    if (!isTypeDefinition) {
      console.log(`${packageName} (dependency)`);
      packagesToInstall.push(packageName);
      
      // Also check if there's a corresponding @types package
      const typesPackage = `@types/${packageName}`;
      console.log(`${typesPackage} (devDependency) - might be needed`);
      packagesToInstall.push(`-D ${typesPackage}`);
    } else {
      console.log(`${packageName} (devDependency)`);
      packagesToInstall.push(`-D ${packageName}`);
    }
  });
  
  if (packagesToInstall.length > 0) {
    console.log('\nTo install all missing dependencies, run:');
    console.log(`pnpm add ${packagesToInstall.join(' ')}`);
  } else {
    console.log('No missing external dependencies found.');
  }
  
} catch (error) {
  console.error('Error:', error.message);
} 