/**
 * Command-line tool to load Markdown files into Chloe's memory system
 * 
 * This tool loads all markdown files from docs/ and knowledge/ directories
 * and imports them into Chloe's memory system with critical importance.
 */

import { z } from "zod";
import { MemoryType } from "../server/memory/config/types";
import { MarkdownManager } from "../agents/chloe/knowledge/markdownManager";
import { getMemoryServices } from "../server/memory/services";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from '../lib/logging';

// Define type for tool definition
interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  execute: (params: any) => Promise<any>;
}

// Define the schema for the tool
export const loadMarkdownToMemorySchema = z.object({
  directoryPath: z.string().describe("Directory path to search for markdown files (defaults to knowledge directory if empty)"),
  force: z.boolean().optional().describe("Force reprocessing of all files regardless of modification status"),
});

// Helper function to find markdown files in a directory
export async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * Tool definition for loading markdown files into memory
 */
export const loadMarkdownToMemoryTool: ToolDefinition = {
  name: "load_markdown_to_memory",
  description: "Load markdown files into the memory system for knowledge access",
  schema: loadMarkdownToMemorySchema,
  execute: async (params: { directoryPath: string; force?: boolean }) => {
    const { directoryPath, force = false } = params;
    
    try {
      // Get memory services
      const { memoryService } = await getMemoryServices();
      
      // Resolve directory path, defaulting to knowledge directory
      const resolvedPath = directoryPath || path.join(process.cwd(), "data", "knowledge");
      console.log(`📚 Loading markdown files from ${resolvedPath}`);
      
      // Initialize markdown manager with needed settings
      const manager = new MarkdownManager({
        memory: null as any, // We're using memory service directly
        agentId: "chloe",
        logFunction: (message, data) => {
          console.log(`[MarkdownLoader] ${message}`, data || '');
        }
      });
      
      // Process the directory
      console.log(`🔍 Searching for markdown files in ${resolvedPath}`);
      const stats = await manager.loadMarkdownFiles({
        force,
        checkForDuplicates: !force
      });
      
      // Return success message with stats
      return {
        type: MemoryType.DOCUMENT, // Use correct enum value from MemoryType
        content: `Successfully processed markdown files.
Processed: ${stats.filesProcessed}
Added: ${stats.entriesAdded}
Skipped: ${stats.filesSkipped + stats.unchangedFiles}
Duplicates: ${stats.duplicatesSkipped}`,
        metadata: {
          tool: "load_markdown_to_memory",
          success: true,
          stats,
          schemaVersion: "1.0.0" // Add schema version for BaseMetadata compatibility
        }
      };
    } catch (error) {
      // Return error message
      return {
        type: MemoryType.DOCUMENT, // Using DOCUMENT as fallback
        content: `Error loading markdown files: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          tool: "load_markdown_to_memory",
          success: false,
          error: String(error),
          schemaVersion: "1.0.0" // Add schema version for BaseMetadata compatibility
        }
      };
    }
  }
};

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
    const files = await findMarkdownFiles(directoriesToLoad[0]);
    logger.info(`📄 Found ${files.length} markdown files to process`);
    
    if (files.length === 0) {
      logger.warn('❌ No markdown files found in specified directories. Exiting.');
      return;
    }
    
    // Load all markdown files into memory
    logger.info('🧠 Loading markdown files into memory with CRITICAL importance...');
    const stats = await loadMarkdownToMemoryTool.execute({ directoryPath: directoriesToLoad[0], force: forceReload });
    
    // Log stats
    logger.info('✅ Markdown loading process complete!');
    logger.info(`📊 Stats: Processed ${stats.metadata.stats.filesProcessed} files, Added ${stats.metadata.stats.entriesAdded} memory entries, Skipped ${stats.metadata.stats.filesSkipped + stats.metadata.stats.unchangedFiles} files, Duplicates skipped: ${stats.metadata.stats.duplicatesSkipped}`);
    
    // Log type statistics
    logger.info('📑 Memory types created:');
    for (const [type, count] of Object.entries(stats.metadata.stats.typeStats)) {
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