/**
 * Very Simple Markdown Memory Test Script
 * 
 * This minimalist script tests the retrieval of markdown documents from the memory system.
 * Using explicit ESM format with .mjs extension.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the current directory for debugging
console.log('Current directory:', process.cwd());
console.log('Script location:', __filename);

// Check if the memory service file exists
const servicesPath = path.resolve(process.cwd(), 'src/server/memory/services/index.js');
const typesPath = path.resolve(process.cwd(), 'src/server/memory/config/types.js');

console.log('Checking if services file exists:', servicesPath);
console.log('File exists:', fs.existsSync(servicesPath));

console.log('Checking if types file exists:', typesPath);
console.log('File exists:', fs.existsSync(typesPath));

// List available files in the directories
console.log('\nListing files in services directory:');
try {
  const servicesDir = path.dirname(servicesPath);
  const files = fs.readdirSync(servicesDir);
  files.forEach(file => console.log(`- ${file}`));
} catch (err) {
  console.error('Error listing services directory:', err);
}

console.log('\nListing files in config directory:');
try {
  const configDir = path.dirname(typesPath);
  const files = fs.readdirSync(configDir);
  files.forEach(file => console.log(`- ${file}`));
} catch (err) {
  console.error('Error listing config directory:', err);
}

async function main() {
  try {
    console.log('\n=== MARKDOWN MEMORY TEST (SIMPLE VERSION) ===');
    console.log('Importing memory services...');
    
    // Try with various import paths
    let servicesModule;
    try {
      console.log('Trying to import services with .js extension...');
      servicesModule = await import('../server/memory/services/index.js');
      console.log('Import successful');
    } catch (importError) {
      console.error('Error importing with .js extension:', importError.message);
      
      try {
        console.log('Trying to import services without extension...');
        servicesModule = await import('../server/memory/services/index');
        console.log('Import successful');
      } catch (secondError) {
        console.error('Error importing without extension:', secondError.message);
        
        try {
          console.log('Trying to import with absolute path...');
          servicesModule = await import(servicesPath);
          console.log('Import successful');
        } catch (thirdError) {
          console.error('Error importing with absolute path:', thirdError.message);
          throw new Error('Failed to import memory services after multiple attempts');
        }
      }
    }
    
    const { getMemoryServices } = servicesModule;
    console.log('Services module loaded:', Object.keys(servicesModule));
    
    // Similar approach for types
    let typesModule;
    try {
      console.log('\nTrying to import types with .js extension...');
      typesModule = await import('../server/memory/config/types.js');
      console.log('Import successful');
    } catch (importError) {
      console.error('Error importing types:', importError.message);
      
      try {
        console.log('Trying to import types without extension...');
        typesModule = await import('../server/memory/config/types');
        console.log('Import successful');
      } catch (secondError) {
        console.error('Error importing types without extension:', secondError.message);
        
        try {
          console.log('Trying to import types with absolute path...');
          typesModule = await import(typesPath);
          console.log('Import successful');
        } catch (thirdError) {
          console.error('Error importing types with absolute path:', thirdError.message);
          throw new Error('Failed to import memory types after multiple attempts');
        }
      }
    }
    
    const { MemoryType } = typesModule;
    console.log('Types module loaded:', Object.keys(typesModule));
    
    console.log('\nInitializing memory services...');
    const services = await getMemoryServices();
    console.log('Memory services initialized:', Object.keys(services));
    
    // Check if the client is initialized
    const status = await services.client.getStatus();
    console.log(`Memory client initialized: ${status.initialized}`);
    
    // Search for DOCUMENT memories
    console.log('\nFetching document memories...');
    const documentResults = await services.searchService.search('', {
      types: [MemoryType.DOCUMENT],
      limit: 100
    });
    
    console.log(`Found ${documentResults.length} document memories`);
    
    // Extract some basic info from the first 5 documents
    console.log('\nDocument samples:');
    documentResults.slice(0, 5).forEach((doc, index) => {
      const metadata = doc.point?.metadata || {};
      const source = metadata.source || 'unknown';
      const id = doc.point?.id || 'unknown';
      
      console.log(`${index + 1}. ID: ${id}, Source: ${source}`);
    });
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Error running test:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Execute the main function
main(); 