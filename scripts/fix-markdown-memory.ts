#!/usr/bin/env node

/**
 * Script to fix markdown memory duplication issues
 * 
 * This script:
 * 1. Clears the markdown cache file
 * 2. Removes all existing document memories with source="markdown" or source="file"
 * 3. Re-loads markdown files from the standard directories
 * 
 * Usage:
 *   npx tsx scripts/fix-markdown-memory.ts
 */

import fs from 'fs';
import path from 'path';
import { getMemoryServices } from '../src/server/memory/services';
import { loadAllMarkdownAsMemory } from '../src/agents/chloe/knowledge/markdownMemoryLoader';

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');

async function clearMarkdownCache(): Promise<boolean> {
  try {
    // Check if file exists
    const fileExists = fs.existsSync(CACHE_FILE_PATH);
    
    if (fileExists) {
      // Delete the file
      fs.unlinkSync(CACHE_FILE_PATH);
      console.log('✅ Successfully deleted markdown cache file');
      return true;
    } else {
      console.log('ℹ️ Cache file not found, nothing to delete');
      return true;
    }
  } catch (error) {
    console.error('❌ Error clearing markdown cache:', error);
    return false;
  }
}

async function removeMarkdownDocuments() {
  try {
    console.log('🔍 Finding and removing all markdown-derived documents...');
    
    // Get memory services
    const { memoryService, searchService } = await getMemoryServices();
    
    // Find all documents with markdown source
    const markdownDocs = await searchService.search('', {
      filter: {
        metadata: {
          source: { $in: ['markdown', 'file'] }
        }
      },
      limit: 1000
    });
    
    console.log(`🔍 Found ${markdownDocs.length} markdown documents to remove`);
    
    // Delete each document
    let deletedCount = 0;
    for (const doc of markdownDocs) {
      try {
        // Use the correct parameter format for deleteMemory
        await memoryService.deleteMemory({
          id: doc.point.id,
          type: doc.type // Include the type if required
        });
        deletedCount++;
        
        // Log progress every 10 documents
        if (deletedCount % 10 === 0) {
          console.log(`🗑️ Deleted ${deletedCount}/${markdownDocs.length} documents...`);
        }
      } catch (error) {
        console.error(`❌ Error deleting document ${doc.point.id}:`, error);
      }
    }
    
    console.log(`✅ Successfully deleted ${deletedCount} markdown documents`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error removing markdown documents:', error);
    return 0;
  }
}

async function reloadMarkdownFiles() {
  try {
    console.log('📚 Reloading markdown files into memory...');
    
    // Standard directories to load from
    const directoriesToLoad = [
      'data/knowledge/company', 
      'data/knowledge/agents',
      'data/knowledge/domains'
    ];
    
    // Load all markdown files with force option set to true
    const result = await loadAllMarkdownAsMemory(directoriesToLoad, {
      force: true,
      checkForDuplicates: false // Don't check for duplicates since we cleared everything
    });
    
    // Output summary
    console.log('\n=== Markdown Memory Reload Complete ===');
    console.log(`📄 Processed ${result.filesProcessed} files`);
    console.log(`🔄 Skipped ${result.filesSkipped} files`);
    console.log(`🧠 Added ${result.entriesAdded} memory entries`);
    console.log('\nMemory types:');
    
    // Print memory type stats
    Object.entries(result.typeStats).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} entries`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error reloading markdown files:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting markdown memory fix process...');
  
  try {
    // Step 1: Clear the markdown cache
    console.log('🧹 Step 1: Clearing markdown cache...');
    await clearMarkdownCache();
    
    // Step 2: Remove existing markdown documents
    console.log('\n🧹 Step 2: Removing existing markdown documents...');
    const deletedCount = await removeMarkdownDocuments();
    
    // Step 3: Reload markdown files
    console.log('\n🧹 Step 3: Reloading markdown files...');
    const reloadResult = await reloadMarkdownFiles();
    
    console.log('\n✅ Markdown memory fix complete!');
    console.log(`📊 Summary: Removed ${deletedCount} duplicate documents, added ${reloadResult.entriesAdded} fresh entries`);
  } catch (error) {
    console.error('\n❌ Error fixing markdown memory:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 