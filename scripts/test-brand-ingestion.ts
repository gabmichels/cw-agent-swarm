#!/usr/bin/env node

/**
 * Script to test if brand.md is properly ingested into memory
 * 
 * Usage:
 *   npm run memory:test-brand
 */

import { ChloeMemory } from '../src/agents/chloe/memory';
import * as qdrant from '../src/server/qdrant';
import { MemoryType as StandardMemoryType } from '../src/server/memory/config';

async function main() {
  try {
    console.log('🔍 Testing brand.md ingestion...');
    
    // Initialize memory systems
    console.log('Initializing memory...');
    await qdrant.initMemory();
    
    // Create a ChloeMemory instance
    const memory = new ChloeMemory();
    await memory.initialize();
    
    // Search for brand-related contents in memory
    console.log('\n🔹 Searching for brand in all collections:');
    const brandResults = await qdrant.searchMemory(
      null, 
      "Claro brand identity", 
      {
        limit: 10
      }
    );
    
    console.log(`Found ${brandResults.length} results in all collections`);
    
    // Print all matching entries with their file paths
    if (brandResults.length > 0) {
      console.log('\nResults from all collections:');
      brandResults.forEach((result, i) => {
        console.log(`\n${i+1}. ID: ${result.id}`);
        console.log(`   Type: ${result.type}`);
        console.log(`   File: ${result.metadata?.filePath || 'unknown'}`);
        console.log(`   Content: ${result.text.substring(0, 150)}${result.text.length > 150 ? '...' : ''}`);
      });
    } else {
      console.log('\n❌ No brand-related entries found in memory!');
    }
    
    // Search specifically for content from the brand.md file
    console.log('\n🔹 Searching for entries from brand.md file:');
    const fileResults = await qdrant.searchMemory(
      null,
      "",
      {
        limit: 10,
        filter: {
          filePath: "company/general/brand.md"
        }
      }
    );
    
    if (fileResults.length > 0) {
      console.log(`\n✅ Found ${fileResults.length} entries from brand.md file!`);
      fileResults.forEach((result, i) => {
        console.log(`\n${i+1}. ID: ${result.id}`);
        console.log(`   Type: ${result.type}`);
        console.log(`   Content: ${result.text.substring(0, 150)}${result.text.length > 150 ? '...' : ''}`);
      });
    } else {
      console.log('\n❌ No entries from brand.md file found in memory!');
      
      // Check if the file path might be different
      console.log('\n🔍 Looking for any brand-related file paths:');
      const pathResults = await qdrant.searchMemory(
        null,
        "brand",
        {
          limit: 20
        }
      );
      
      const brandFilePaths = new Set<string>();
      pathResults.forEach(result => {
        if (result.metadata?.filePath && 
            typeof result.metadata.filePath === 'string' && 
            result.metadata.filePath.toLowerCase().includes('brand')) {
          brandFilePaths.add(result.metadata.filePath as string);
        }
      });
      
      if (brandFilePaths.size > 0) {
        console.log('\nFound brand-related files with these paths:');
        Array.from(brandFilePaths).forEach(path => {
          console.log(`- ${path}`);
        });
      } else {
        console.log('\nNo brand-related file paths found!');
      }
    }
    
    // List all strategy files
    console.log('\n🔹 Listing all files with STRATEGY type:');
    const strategyResults = await qdrant.searchMemory(
      'document',
      "",
      {
        limit: 30,
        filter: {
          type: StandardMemoryType.DOCUMENT
        }
      }
    );
    
    console.log(`Found ${strategyResults.length} entries with DOCUMENT type`);
    
    if (strategyResults.length > 0) {
      const filePaths = new Set<string>();
      strategyResults.forEach(result => {
        if (result.metadata?.filePath) {
          filePaths.add(result.metadata.filePath as string);
        }
      });
      
      console.log('\nStrategy files found:');
      Array.from(filePaths).forEach(path => {
        console.log(`- ${path}`);
      });
    }
    
    // Test direct retrieval of brand information
    console.log('\n🔹 Testing brand identity queries:');
    const brandQueries = [
      "What is Claro's brand identity?",
      "Tell me about Claro brand",
      "What are Claro's brand values?",
      "Describe Claro's brand personality"
    ];
    
    for (const query of brandQueries) {
      console.log(`\nQuery: "${query}"`);
      
      const results = await memory.getRelevantMemories(
        query, 
        3, 
        [StandardMemoryType.DOCUMENT]
      );
      
      console.log(`Found ${results.length} results`);
      
      if (results.length > 0) {
        results.forEach((result, i) => {
          console.log(`\n${i+1}. ${result.type || result.category || 'unknown'}:`);
          console.log(`   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
          
          if (result.metadata?.filePath) {
            console.log(`   Source: ${result.metadata.filePath}`);
          }
        });
      }
    }
    
    console.log('\n\n✅ Brand ingestion test completed!');
    
    // Attempt to reload the brand.md file if it wasn't found
    if (fileResults.length === 0) {
      console.log('\n⚠️ Brand.md file not found in memory. Would you like to reload markdown files? (Y/n)');
      process.stdout.write('> ');
      process.stdin.once('data', async (data) => {
        const input = data.toString().trim().toLowerCase();
        if (input === 'y' || input === 'yes' || input === '') {
          console.log('\nReloading markdown files...');
          
          const { loadAllMarkdownAsMemory } = require('../src/agents/chloe/knowledge/markdownMemoryLoader');
          const stats = await loadAllMarkdownAsMemory();
          
          console.log(`\nReloaded ${stats.filesProcessed} files (${stats.entriesAdded} entries added, ${stats.filesSkipped} skipped)`);
          
          // Check again after reload
          console.log('\nChecking for brand.md again...');
          const recheck = await qdrant.searchMemory(
            null,
            "",
            {
              limit: 5,
              filter: {
                filePath: "company/general/brand.md"
              }
            }
          );
          
          if (recheck.length > 0) {
            console.log('\n✅ Success! Brand.md is now in memory.');
          } else {
            console.log('\n❌ Still could not find brand.md in memory after reload.');
            console.log('Possible reasons:');
            console.log('1. The file path might be different');
            console.log('2. The file might not exist');
            console.log('3. There might be an issue with the markdown loader');
          }
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error testing brand ingestion:', error);
    process.exit(1);
  }
}

// Run the script
main(); 