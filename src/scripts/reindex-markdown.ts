/**
 * Markdown Re-Indexing Script
 * 
 * This script allows you to manually trigger re-indexing of markdown files
 * from the docs/ and knowledge/ directories, ensuring they are stored with
 * the proper importance and metadata in Chloe's memory system.
 * 
 * Usage:
 * ts-node src/scripts/reindex-markdown.ts [--force] [--directories=dir1,dir2]
 * 
 * Options:
 * --force: Force reindexing of all files, even if they haven't changed
 * --directories: Comma-separated list of directories to search (defaults to docs/,knowledge/)
 */

import { loadAllMarkdownAsMemory } from '../agents/chloe/knowledge/markdownMemoryLoader';
import { logger } from '../lib/logging';

async function main() {
  try {
    console.log('🔄 Starting markdown re-indexing process...');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const forceReindex = args.includes('--force');
    
    // Extract directories from --directories=dir1,dir2 format
    const directoriesArg = args.find(arg => arg.startsWith('--directories='));
    let directories = ['docs/', 'knowledge/'];
    
    if (directoriesArg) {
      const directoriesValue = directoriesArg.split('=')[1];
      if (directoriesValue) {
        directories = directoriesValue.split(',');
      }
    }
    
    console.log(`📁 Targeting directories: ${directories.join(', ')}`);
    
    if (forceReindex) {
      console.log('⚠️ Force mode enabled - will reindex all files regardless of modification status');
    }
    
    // Run the indexing process
    console.log('🔍 Searching for markdown files...');
    const stats = await loadAllMarkdownAsMemory(directories, {
      force: forceReindex,
      checkForDuplicates: !forceReindex
    });
    
    // Log results
    console.log('\n✅ Markdown indexing complete!');
    console.log('-----------------------------');
    console.log(`📊 Files processed: ${stats.filesProcessed}`);
    console.log(`📝 Entries added: ${stats.entriesAdded}`);
    console.log(`🔄 Unchanged files: ${stats.unchangedFiles}`);
    console.log(`⏭️ Files skipped: ${stats.filesSkipped}`);
    console.log(`🔍 Duplicates skipped: ${stats.duplicatesSkipped}`);
    
    // Display type statistics
    console.log('\n📋 Content type breakdown:');
    Object.entries(stats.typeStats).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} entries`);
    });
    
    console.log('\n🔢 All done! Your markdown content is now indexed and available to Chloe.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during markdown indexing:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 