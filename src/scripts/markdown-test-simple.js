/**
 * Very Simple Markdown Memory Test Script
 * 
 * This minimalist script tests the retrieval of markdown documents from the memory system.
 */

const path = require('path');

// Log the current directory for debugging
console.log('Current directory:', process.cwd());
console.log('Script location:', __filename);

async function main() {
  try {
    console.log('=== MARKDOWN MEMORY TEST (SIMPLE VERSION) ===');
    console.log('Importing memory services...');
    
    // Dynamically import the services
    const { getMemoryServices } = await import('../server/memory/services/index.js');
    console.log('Services imported successfully');
    
    // Get memory types
    const { MemoryType } = await import('../server/memory/config/types.js');
    console.log('Memory types imported successfully');
    
    console.log('Initializing memory services...');
    const services = await getMemoryServices();
    console.log('Memory services initialized');
    
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
  }
}

// Execute the main function
main(); 