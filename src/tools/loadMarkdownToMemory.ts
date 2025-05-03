/**
 * Command-line tool to load Markdown files into Chloe's memory system
 * 
 * This tool loads all markdown files from docs/ and knowledge/ directories
 * and imports them into Chloe's memory system with critical importance.
 */

import { loadAllMarkdownAsMemory, findMarkdownFiles } from '../agents/chloe/knowledge/markdownMemoryLoader';
import { logger } from '../lib/logging';

// Process command line arguments
const args = process.argv.slice(2);
const forceReload = args.includes('--force') || args.includes('-f');
const customDirectories = args.filter(arg => !arg.startsWith('-') && !arg.startsWith('--'));

async function main() {
  try {
    if (forceReload) {
      logger.info('🔄 Force reload mode enabled - will reload all files even if they exist in memory');
    }
    
    logger.info('🔍 Starting markdown memory loader...');
    
    // Set up directories to search
    const directoriesToLoad = customDirectories.length > 0 
      ? customDirectories 
      : ['docs/', 'knowledge/'];
    
    logger.info(`📁 Using directories: ${directoriesToLoad.join(', ')}`);
    
    // First, find all markdown files
    const files = await findMarkdownFiles(directoriesToLoad);
    logger.info(`📄 Found ${files.length} markdown files to process`);
    
    if (files.length === 0) {
      logger.warn('❌ No markdown files found in specified directories. Exiting.');
      return;
    }
    
    // Load all markdown files into memory
    logger.info('🧠 Loading markdown files into memory with CRITICAL importance...');
    const stats = await loadAllMarkdownAsMemory(directoriesToLoad, {
      force: forceReload,
      checkForDuplicates: !forceReload
    });
    
    // Log stats
    logger.info('✅ Markdown loading process complete!');
    logger.info(`📊 Stats: Processed ${stats.filesProcessed} files, Added ${stats.entriesAdded} memory entries, Skipped ${stats.filesSkipped} files, Duplicates skipped: ${stats.duplicatesSkipped}`);
    
    // Log type statistics
    logger.info('📑 Memory types created:');
    for (const [type, count] of Object.entries(stats.typeStats)) {
      logger.info(`  - ${type}: ${count} entries`);
    }
    
    logger.info('✨ Memory loading complete. Markdown content is now available with CRITICAL importance.');
  } catch (error) {
    logger.error('Error running markdown memory loader:', error);
    process.exit(1);
  }
}

// Show usage info if --help flag is provided
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Markdown Memory Loader

Usage:
  node loadMarkdownToMemory.js [options] [directories...]

Options:
  -f, --force    Force reload all files, even if they already exist in memory
  -h, --help     Show this help message

Examples:
  node loadMarkdownToMemory.js                     # Load files from default directories
  node loadMarkdownToMemory.js --force             # Force reload all files
  node loadMarkdownToMemory.js docs/ custom/       # Load from specific directories
  node loadMarkdownToMemory.js -f docs/ knowledge/ # Force reload from specified directories
  `);
  process.exit(0);
}

// Run the main function
main().catch(error => {
  logger.error('Unhandled error in markdown loader:', error);
  process.exit(1);
}); 