#!/usr/bin/env node

/**
 * Script to manually reload all markdown files into memory
 * 
 * Usage:
 *   npm run reload-md-memory [--clear]
 *   
 * Options:
 *   --clear: Clear all markdown-derived memories before reloading
 */

import { loadAllMarkdownAsMemory } from '../src/agents/chloe/knowledge/markdownMemoryLoader';
import * as memory from '../src/server/qdrant';

async function main() {
  try {
    console.log('🔄 Starting markdown memory reload process...');
    
    // Check if we should clear memories first
    const shouldClear = process.argv.includes('--clear');
    
    if (shouldClear) {
      console.log('🧹 Clearing existing markdown-derived memories...');
      
      try {
        // Initialize memory system
        await memory.initMemory();
        
        // Clear memories with source=FILE
        const clearResult = await memory.clearMemoriesBySource('file');
        console.log(`✅ Cleared ${clearResult.count} existing markdown memories`);
      } catch (clearError) {
        console.error('❌ Error clearing memories:', clearError);
        process.exit(1);
      }
    } else {
      // Just initialize memory without clearing
      await memory.initMemory();
    }
    
    // Load all markdown files
    console.log('📚 Loading markdown files into memory...');
    const result = await loadAllMarkdownAsMemory();
    
    // Output summary
    console.log('\n=== Markdown Memory Reload Complete ===');
    console.log(`📄 Processed ${result.filesProcessed} files`);
    console.log(`🧠 Added ${result.entriesAdded} memory entries`);
    console.log('\nMemory types:');
    
    // Print memory type stats
    Object.entries(result.typeStats).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} entries`);
    });
    
    console.log('\n✅ Reload completed successfully!');
  } catch (error) {
    console.error('❌ Error reloading markdown memories:', error);
    process.exit(1);
  }
}

// Run the script
main(); 