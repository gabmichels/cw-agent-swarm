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

import { getMemoryServices } from '@/server/memory/services';
import { logger } from '@/lib/logging';
import { MarkdownManager } from '@/agents/shared/knowledge/MarkdownManager';

async function main() {
  try {
    console.log('🚀 Starting Markdown reindexing process...');
    
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
    
    // Get memory services
    const { memoryService } = await getMemoryServices();
    
    // Initialize markdown manager with basic options
    const manager = new MarkdownManager({
      memory: null as any, // We're using the memory service directly
      agentId: 'chloe',
      logFunction: (message, data) => {
        console.log(`[MarkdownReindex] ${message}`, data || '');
      }
    });
    
    // Run the indexing process
    console.log('🔍 Searching for markdown files...');
    const stats = await manager.loadMarkdownFiles({ 
      force: forceReindex, 
      checkForDuplicates: !forceReindex 
    });
    
    // Output the results
    console.log('✅ Markdown reindexing complete!');
    console.log(`📊 Summary:
      - Duplicates skipped: ${stats.duplicatesSkipped}
      - Unchanged files: ${stats.unchangedFiles}
    `);
    
    // Return success
    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('❌ Error during markdown indexing:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 