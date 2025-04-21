#!/usr/bin/env node

/**
 * Memory Loader Script
 * 
 * This script loads memory documents from the data directory into the agent's memory.
 * It processes markdown files and adds them to the vector store.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load memory documents from the data directory
 * @param {string} agentName - Name of the agent to load memory for (e.g., 'chloe')
 * @returns {Promise<Array>} - Array of loaded documents
 */
async function loadMemoryData(agentName) {
  console.log(`Loading memory data for ${agentName}...`);
  
  const memoryDir = path.join(process.cwd(), 'data', 'memory', agentName);
  
  if (!fs.existsSync(memoryDir)) {
    console.warn(`Memory directory for ${agentName} does not exist`);
    return [];
  }
  
  // This is a placeholder for actual document loading logic
  // In a real implementation, this would:
  // 1. Read the markdown files
  // 2. Process them into documents
  // 3. Add them to the vector store
  
  const files = fs.readdirSync(memoryDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(memoryDir, file));
  
  console.log(`Found ${files.length} memory documents for ${agentName}`);
  
  return files;
}

// Example usage
if (require.main === module) {
  // When run directly
  const agentName = process.argv[2] || 'chloe';
  
  loadMemoryData(agentName)
    .then(docs => {
      console.log(`Loaded ${docs.length} documents`);
    })
    .catch(err => {
      console.error('Error loading memory data:', err);
      process.exit(1);
    });
} else {
  // When imported as a module
  module.exports = {
    loadMemoryData
  };
} 