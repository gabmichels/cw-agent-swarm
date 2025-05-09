import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { ChloeMemory } from '../memory';
import { logger } from '@/lib/logging';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { extractTags } from '../../../utils/tagExtractor';

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), 'data/cache/markdown-cache.json');
// Flag file to track initialization
const INIT_FLAG_PATH = path.join(process.cwd(), 'data/cache/markdown-initialized.flag');

/**
 * Options for the MarkdownManager
 */
export interface MarkdownManagerOptions {
  memory: ChloeMemory;
  agentId: string;
  department?: string;
  logFunction?: (message: string, data?: any) => void;
  syncWithGraph?: boolean;
}

/**
 * Statistics about markdown processing
 */
export interface MarkdownStats {
  filesProcessed: number;
  entriesAdded: number;
  filesSkipped: number;
  duplicatesSkipped: number;
  unchangedFiles: number;
}

/**
 * Single class to handle all markdown-related functionality
 */
export class MarkdownManager {
  private memory: ChloeMemory;
  private agentId: string;
  private department: string;
  private logFunction: (message: string, data?: any) => void;
  private syncWithGraph: boolean;
  private watcher: any; // chokidar watcher
  private isWatching: boolean = false;
  private fileCache: Map<string, { lastModified: number, memoryIds: string[] }> = new Map();

  constructor(options: MarkdownManagerOptions) {
    this.memory = options.memory;
    this.agentId = options.agentId;
    this.department = options.department || 'marketing';
    this.logFunction = options.logFunction || ((message, data) => {
      logger.info(`[MarkdownManager] ${message}`, data ? data : '');
    });
    this.syncWithGraph = options.syncWithGraph !== undefined ? options.syncWithGraph : true;
    
    // Load cache on initialization
    this.loadCache().catch(error => {
      this.logFunction('Error loading cache', { error: String(error) });
    });
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const cacheDir = path.dirname(CACHE_FILE_PATH);
      await fs.mkdir(cacheDir, { recursive: true });
      
      try {
        const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        this.fileCache = new Map(Object.entries(cache));
        this.logFunction('Loaded markdown cache', { entries: this.fileCache.size });
      } catch (error) {
        // If file doesn't exist, that's fine - we'll create it
        this.logFunction('No existing cache found, starting fresh');
      }
    } catch (error) {
      this.logFunction('Error loading cache', { error: String(error) });
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    try {
      const cacheDir = path.dirname(CACHE_FILE_PATH);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cache = Object.fromEntries(this.fileCache);
      await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
      this.logFunction('Saved markdown cache', { entries: this.fileCache.size });
    } catch (error) {
      this.logFunction('Error saving cache', { error: String(error) });
    }
  }

  /**
   * Update cache for a file
   */
  private async updateFileCache(filePath: string, lastModified: number, memoryIds: string[]): Promise<void> {
    this.fileCache.set(filePath, { lastModified, memoryIds });
    await this.saveCache();
  }

  /**
   * Remove file from cache
   */
  private async removeFromCache(filePath: string): Promise<void> {
    this.fileCache.delete(filePath);
    await this.saveCache();
  }

  /**
   * Get the standard directories for this agent
   */
  private getAgentDirectories(): string[] {
    return [
      'data/knowledge/company',
      `data/knowledge/agents/${this.agentId}`,
      'data/knowledge/agents/shared',
      `data/knowledge/domains/${this.department}`,
      'data/knowledge/test' // Added test directory for development
    ];
  }

  /**
   * Load all markdown files for this agent
   */
  async loadMarkdownFiles(options: {
    force?: boolean;
    checkForDuplicates?: boolean;
  } = {}): Promise<MarkdownStats> {
    const stats: MarkdownStats = {
      filesProcessed: 0,
      entriesAdded: 0,
      filesSkipped: 0,
      duplicatesSkipped: 0,
      unchangedFiles: 0
    };
    
    // Log both to logger and console to ensure visibility
    console.log('🍜 LOADING FUCKING MARKDOWN FILES - started at', new Date().toISOString());
    
    try {
      // Check if we've already initialized once during this server session
      // to prevent duplicate ingestion on agent reinitialization
      if (!options.force) {
        try {
          // Check for the flag file's existence
          console.log(`Checking for initialization flag at ${INIT_FLAG_PATH}`);
          
          const initFlagExists = await fs.access(INIT_FLAG_PATH)
            .then(() => true)
            .catch(() => false);
            
          if (initFlagExists) {
            try {
              // Try to read the flag content for debugging
              const flagContent = await fs.readFile(INIT_FLAG_PATH, 'utf-8');
              console.log(`Markdown initialization flag exists with content: ${flagContent}`);
            } catch (readError) {
              console.log(`Markdown initialization flag exists but could not read content`);
            }
            
            this.logFunction('Markdown already initialized this session. Skipping ingestion.');
            console.log('Markdown already initialized this session. Skipping loading of markdown files.');
            return stats;
          } else {
            console.log('No initialization flag found. Will process markdown files.');
          }
        } catch (error) {
          // Ignore errors and continue with ingestion
          console.error('Error checking initialization flag:', error);
        }
      } else if (options.force) {
        console.log('Force flag set to true. Will process markdown files regardless of initialization flag.');
      }
      
      const directories = this.getAgentDirectories();
      this.logFunction('=== Starting Markdown Ingestion ===');
      console.log(`=== Starting Markdown Ingestion === [${new Date().toISOString()}]`);
      this.logFunction(`Scanning directories: ${directories.join(', ')}`);
      console.log(`Scanning directories: ${directories.join(', ')}`);

      // Process each directory
      for (const dir of directories) {
        const fullPath = path.join(process.cwd(), dir);
        
        try {
          // Get all markdown files in directory
          const files = await this.getMarkdownFiles(fullPath);
          this.logFunction(`Found ${files.length} markdown files in ${dir}`);
          console.log(`Found ${files.length} markdown files in ${dir}`);
          
          // Process each file
          for (const file of files) {
            const relativePath = path.relative(process.cwd(), file);
            console.log(`Processing markdown file: ${relativePath}`);
            
            // Force processing of all files by setting shouldProcess to true
            // Removed the check that might prevent ingestion
            const shouldProcess = true; // Always process

            if (!shouldProcess) {
              stats.unchangedFiles++;
              continue;
            }

            // Process the file
            const fileStats = await this.processMarkdownFile(file, relativePath, options.checkForDuplicates);
            
            // Update stats
            stats.filesProcessed++;
            stats.entriesAdded += fileStats.entriesAdded;
            stats.duplicatesSkipped += fileStats.duplicatesSkipped;
            
            console.log(`✅ Processed ${relativePath}: added ${fileStats.entriesAdded} entries`);
          }
        } catch (error: any) {
          this.logFunction(`❌ Error processing directory ${dir}: ${error.message}`);
          console.error(`❌ Error processing directory ${dir}: ${error.message}`);
          stats.filesSkipped++;
        }
      }

      // After successful ingestion, create the initialization flag file
      try {
        // Ensure the directory exists
        const flagDir = path.dirname(INIT_FLAG_PATH);
        await fs.mkdir(flagDir, { recursive: true });
        
        // Write the current timestamp to the flag file
        await fs.writeFile(INIT_FLAG_PATH, new Date().toISOString());
        console.log(`Created initialization flag at ${INIT_FLAG_PATH}`);
      } catch (error) {
        this.logFunction(`Warning: Could not create initialization flag: ${String(error)}`);
        console.error(`Warning: Could not create initialization flag: ${String(error)}`);
      }

      this.logFunction('=== Markdown Ingestion Complete ===');
      console.log(`=== Markdown Ingestion Complete === [${new Date().toISOString()}]`);
      this.logFunction('Summary:', stats);
      console.log('Summary:', stats);

      return stats;
    } catch (error: any) {
      this.logFunction(`❌ Fatal error in markdown ingestion: ${error.message}`);
      console.error(`❌ Fatal error in markdown ingestion: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all markdown files in a directory recursively
   */
  private async getMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively get files from subdirectories
          const subFiles = await this.getMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logFunction(`Error reading directory ${dir}`, { error: String(error) });
    }
    
    return files;
  }

  /**
   * Check if a file should be processed - Always returns true now
   */
  private async shouldProcessFile(filePath: string, force: boolean = false): Promise<boolean> {
    // Always return true to process all files
    return true;
    
    // Original code commented out
    /*
    if (force) return true;

    try {
      const relativePath = path.relative(process.cwd(), filePath);
      const fileStats = await fs.stat(filePath);
      const lastModified = fileStats.mtimeMs;
      
      // Get memory services
      const { memoryService } = await getMemoryServices();
      
      // Search for existing memories for this file using exact path match
      const existingMemories = await memoryService.searchMemories({
        type: MemoryType.DOCUMENT,
        query: `metadata.filePath:"${relativePath}"`,
        limit: 1
      });

      // If no memories exist, process the file
      if (!existingMemories || existingMemories.length === 0) {
        this.logFunction(`No existing memories found for ${relativePath}, will process`);
        return true;
      }

      // Check if file has been modified since last memory creation
      const memory = existingMemories[0];
      const metadata = memory.payload?.metadata as DocumentMetadataSchema;
      const memoryLastModified = metadata?.lastModified 
        ? new Date(metadata.lastModified).getTime()
        : 0;

      if (lastModified > memoryLastModified) {
        this.logFunction(`File ${relativePath} has been modified since last memory creation, will process`);
        return true;
      }

      this.logFunction(`Skipping ${relativePath} - no changes detected`);
      return false;
    } catch (error: any) {
      this.logFunction(`Error checking file ${filePath}: ${error.message}`);
      return true; // Process file if there's an error checking
    }
    */
  }

  /**
   * Process a single markdown file
   */
  private async processMarkdownFile(
    filePath: string, 
    relativePath: string,
    checkForDuplicates: boolean = true
  ): Promise<{ entriesAdded: number; duplicatesSkipped: number }> {
    const stats = { entriesAdded: 0, duplicatesSkipped: 0 };

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const fileStats = await fs.stat(filePath);
      
      // Get memory services
      const { memoryService } = await getMemoryServices();
      
      // Convert markdown to memory entries
      const entries = await this.markdownToMemoryEntries(filePath, content);
      this.logFunction(`📝 Processing ${relativePath} (${entries.length} sections)`);
      
      // Add each entry to memory
      for (const entry of entries) {
        const formattedContent = `# ${entry.title}\n\n${entry.content}`;
        
        // Add to memory
        const result = await memoryService.addMemory({
          type: entry.type as MemoryType,
          content: formattedContent,
          metadata: {
            title: entry.title,
            filePath: relativePath,
            type: entry.type,
            tags: entry.tags,
            importance: entry.importance,
            source: entry.source,
            lastModified: new Date(fileStats.mtimeMs).toISOString()
          }
        });

        if (result.id) {
          stats.entriesAdded++;
          this.logFunction(`✅ Added memory: ${entry.title}`);
        } else {
          this.logFunction(`❌ Failed to add memory: ${entry.title}`);
        }
      }

      // Update file cache with the new memory IDs
      const memoryIds = entries.map(entry => entry.title); // Using title as placeholder since we don't have actual IDs
      await this.updateFileCache(filePath, fileStats.mtimeMs, memoryIds as string[]);

      // Sync with graph if enabled - commented out for now to simplify
      /*
      if (this.syncWithGraph) {
        await syncMarkdownWithGraph({
          filePath: relativePath,
          content,
          logFunction: this.logFunction
        });
      }
      */

      return stats;
    } catch (error: any) {
      this.logFunction(`❌ Error processing file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert markdown content to memory entries
   */
  private async markdownToMemoryEntries(filePath: string, content: string): Promise<Array<{
    title: string;
    content: string;
    type: string;
    tags: string[];
    importance: string;
    source: string;
  }>> {
    // Get filename as title, removing extension
    const filename = path.basename(filePath, '.md');
    const title = filename.charAt(0).toUpperCase() + filename.slice(1);
    
    // Extract tags using only the AI-powered tag extractor
    let tags: string[] = [];
    try {
      const result = await extractTags(content, { maxTags: 15 });
      
      if (result.success && result.tags.length > 0) {
        tags = result.tags.map(tag => tag.text);
      }
    } catch (error) {
      this.logFunction(`Failed to extract tags with AI: ${error}`);
    }
    
    // Create a single entry for the entire file
    return [{
      title,
      content,
      type: MemoryType.DOCUMENT,
      tags,
      importance: ImportanceLevel.CRITICAL,
      source: 'markdown'
    }];
  }

  /**
   * Start watching markdown files
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      this.logFunction('Watcher is already running');
      return;
    }

    const directories = this.getAgentDirectories();
    this.logFunction('Starting markdown file watcher', { directories });
    console.log(`Starting markdown file watcher for directories: ${directories.join(', ')}`);

    try {
      // Get absolute paths for all directories
      const absolutePaths = directories.map(dir => path.join(process.cwd(), dir));
      
      // Make sure the directories exist
      for (const dirPath of absolutePaths) {
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
          console.error(`Error creating directory ${dirPath}:`, error);
        }
      }

      // Initialize chokidar watcher with improved settings
      this.watcher = watch(absolutePaths, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000, // Reduced from 2000ms
          pollInterval: 100
        },
        ignorePermissionErrors: true, // More resilient to permission issues
        usePolling: true, // Use polling for better compatibility across platforms
        interval: 1000, // Polling interval
        binaryInterval: 3000 // For binary files
      });

      // Handle file events with explicit event logging
      this.watcher.on('add', (filePath: string) => {
        console.log(`📥 File added: ${filePath}`);
        this.handleFileAddOrChange(filePath, 'add');
      });
      
      this.watcher.on('change', (filePath: string) => {
        console.log(`🔄 File changed: ${filePath}`);
        this.handleFileAddOrChange(filePath, 'change');
      });
      
      this.watcher.on('unlink', (filePath: string) => {
        console.log(`🗑️ File deleted: ${filePath}`);
        this.handleFileDelete(filePath);
      });
      
      this.watcher.on('error', (error: Error) => {
        console.error(`❌ Error in file watcher: ${error.message}`);
        this.logFunction('Error in file watcher', { error: error.message });
      });

      // Add ready event to confirm watcher is working
      this.watcher.on('ready', () => {
        console.log(`✅ Markdown watcher ready and monitoring ${absolutePaths.length} directories`);
        this.logFunction('Markdown watcher ready', { directories: absolutePaths });
      });

      this.isWatching = true;
      console.log('File watcher started successfully');
    } catch (error) {
      console.error('Error starting markdown file watcher:', error);
      this.logFunction('Error starting markdown file watcher', { error: String(error) });
      throw error;
    }
  }

  /**
   * Stop watching markdown files
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      this.logFunction('Watcher is not running');
      return;
    }

    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
    this.logFunction('Stopped markdown file watcher');
  }

  /**
   * Handle file add or change events
   */
  private async handleFileAddOrChange(filePath: string, eventType: 'add' | 'change'): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) {
      console.log(`Ignoring non-markdown file: ${filePath}`);
      return;
    }

    try {
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(`🔍 Processing ${eventType} event for file: ${relativePath}`);
      
      // First check if the file exists and is accessible
      try {
        const fileStats = await fs.stat(filePath);
        console.log(`File stats: size=${fileStats.size}, mtime=${fileStats.mtime.toISOString()}`);
        
        // Check if file is empty
        if (fileStats.size === 0) {
          console.log(`Warning: File is empty, skipping: ${relativePath}`);
          return;
        }
      } catch (statError) {
        console.error(`Error accessing file ${filePath}:`, statError);
        return;
      }
      
      // For 'change' events, first delete existing memories for this file
      if (eventType === 'change') {
        try {
          const deletedCount = await this.deleteMemoriesForFile(relativePath);
          this.logFunction(`Deleted ${deletedCount} existing memories for changed file: ${relativePath}`);
          console.log(`✅ Deleted ${deletedCount} existing memories for changed file: ${relativePath}`);
        } catch (deleteError) {
          console.error(`Error deleting existing memories for ${relativePath}:`, deleteError);
          // Continue processing even if deletion fails
        }
      }
      
      // Process the file (adds new memories)
      console.log(`📝 Processing file content: ${relativePath}`);
      const result = await this.processMarkdownFile(filePath, relativePath);
      
      this.logFunction(`Processed ${eventType} event`, { 
        filePath,
        entriesAdded: result.entriesAdded
      });
      console.log(`✅ Processed ${eventType} event for ${relativePath}, added ${result.entriesAdded} entries`);
    } catch (error) {
      this.logFunction(`Error handling ${eventType} event`, { 
        filePath, 
        error: String(error) 
      });
      console.error(`❌ Error handling ${eventType} event for ${filePath}:`, error);
    }
  }

  /**
   * Handle file delete events
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) return;

    try {
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Delete associated memories from the memory service
      await this.deleteMemoriesForFile(relativePath);
      
      // Remove from cache
      await this.removeFromCache(filePath);
      
      this.logFunction('Processed delete event', { filePath: relativePath });
      console.log(`Processed delete event for ${relativePath}, removed associated memories`);
    } catch (error) {
      this.logFunction('Error handling delete event', { 
        filePath, 
        error: String(error) 
      });
      console.error(`Error handling delete event for ${filePath}:`, error);
    }
  }
  
  /**
   * Delete all memories associated with a specific file path
   */
  private async deleteMemoriesForFile(relativePath: string): Promise<number> {
    try {
      // Get memory services
      const { memoryService } = await getMemoryServices();
      
      // Normalize the path to ensure consistent matching
      const normalizedPath = relativePath.replace(/\\/g, '/');
      
      // Search for existing memories for this file using EXACT path match
      // We need to be very precise here to avoid deleting unrelated memories
      const query = `metadata.filePath:"${normalizedPath}"`;
      console.log(`🔍 Searching for memories with EXACT file path match: ${query}`);
      
      const existingMemories = await memoryService.searchMemories({
        type: MemoryType.DOCUMENT,
        query: query,
        limit: 100 // Increase limit to handle multiple entries per file
      });
      
      // If no memories exist, nothing to delete
      if (!existingMemories || existingMemories.length === 0) {
        this.logFunction(`No existing memories found for ${normalizedPath}, nothing to delete`);
        return 0;
      }
      
      // Double-check that we're only deleting memories for THIS exact file
      const filteredMemories = existingMemories.filter(memory => {
        // Try to find filePath in different possible locations using type casting to avoid TypeScript errors
        // since the actual runtime objects may have these properties even if not in the type definitions
        const metadata = memory.payload?.metadata as any;
        const memFilePath = metadata?.filePath || metadata?.extractedFrom || '';
        
        if (!memFilePath) return false;
        
        // Normalize paths for comparison
        const normalizedMemPath = memFilePath.toString().replace(/\\/g, '/');
        const pathsMatch = normalizedMemPath === normalizedPath;
        
        if (!pathsMatch) {
          console.log(`⚠️ Skipping memory - path mismatch: '${normalizedMemPath}' vs '${normalizedPath}'`);
        }
        
        return pathsMatch;
      });
      
      // Log the results of our filtering
      if (filteredMemories.length !== existingMemories.length) {
        console.log(`⚠️ Query matched ${existingMemories.length} memories, but only ${filteredMemories.length} have the exact file path match`);
      }
      
      this.logFunction(`Found ${filteredMemories.length} memories to delete for file: ${normalizedPath}`);
      console.log(`Found ${filteredMemories.length} memories to delete for file: ${normalizedPath}`);
      
      // Delete each memory
      let deletedCount = 0;
      for (const memory of filteredMemories) {
        try {
          if (memory.id) {
            await memoryService.deleteMemory({
              type: MemoryType.DOCUMENT,
              id: memory.id,
              hardDelete: true
            });
            deletedCount++;
          }
        } catch (deleteError) {
          this.logFunction(`Error deleting memory: ${deleteError}`);
          console.error(`Error deleting memory: ${deleteError}`);
        }
      }
      
      this.logFunction(`Deleted ${deletedCount}/${filteredMemories.length} memories for ${normalizedPath}`);
      console.log(`✅ Deleted ${deletedCount}/${filteredMemories.length} memories for ${normalizedPath}`);
      return deletedCount;
    } catch (error) {
      this.logFunction(`Error deleting memories for file ${relativePath}: ${error}`);
      console.error(`Error deleting memories for file ${relativePath}:`, error);
      throw error;
    }
  }

  /**
   * Test file watcher by creating a test file
   * This is for development testing only
   */
  async testFileWatcher(): Promise<boolean> {
    try {
      // Create test directory if it doesn't exist
      const testDir = path.join(process.cwd(), 'data', 'knowledge', 'test');
      await fs.mkdir(testDir, { recursive: true });
      
      // Create a random filename to avoid cache hits
      const randomId = Math.floor(Math.random() * 10000);
      const testFilePath = path.join(testDir, `test-file-${randomId}.md`);
      const relativePath = path.relative(process.cwd(), testFilePath);
      
      // Create test content
      const testContent = `# Test Markdown File ${randomId}

This is a test file created at ${new Date().toISOString()}.

## Test Section

This file should be detected by the markdown watcher.
`;
      
      console.log(`🧪 Creating test file at: ${relativePath}`);
      
      // Write the file
      await fs.writeFile(testFilePath, testContent, 'utf-8');
      console.log(`✅ Test file created successfully`);
      
      // After 5 seconds, update the file to test change detection
      setTimeout(async () => {
        try {
          console.log(`🧪 Updating test file: ${relativePath}`);
          await fs.writeFile(
            testFilePath, 
            testContent + `\n\n## Updated Section\n\nThis file was updated at ${new Date().toISOString()}.\n`,
            'utf-8'
          );
          console.log(`✅ Test file updated successfully`);
          
          // After another 5 seconds, delete the file to test delete detection
          setTimeout(async () => {
            try {
              console.log(`🧪 Deleting test file: ${relativePath}`);
              await fs.unlink(testFilePath);
              console.log(`✅ Test file deleted successfully`);
            } catch (deleteError) {
              console.error(`Error deleting test file:`, deleteError);
            }
          }, 5000);
          
        } catch (updateError) {
          console.error(`Error updating test file:`, updateError);
        }
      }, 5000);
      
      return true;
    } catch (error) {
      console.error(`Error testing file watcher:`, error);
      return false;
    }
  }
} 