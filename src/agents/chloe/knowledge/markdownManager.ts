import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { ChloeMemory } from '../memory';
import { logger } from '@/lib/logging';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { syncMarkdownWithGraph } from './markdownGraphIntegration';
import { DocumentMetadataSchema } from '../../../server/memory/models/document-schema';
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
      `data/knowledge/domains/${this.department}`
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

    // Initialize chokidar watcher
    this.watcher = watch(directories, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    // Handle file events
    this.watcher.on('add', (filePath: string) => this.handleFileAddOrChange(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleFileAddOrChange(filePath, 'change'));
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));
    this.watcher.on('error', (error: Error) => {
      this.logFunction('Error in file watcher', { error: error.message });
    });

    this.isWatching = true;
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
    if (!filePath.toLowerCase().endsWith('.md')) return;

    try {
      const relativePath = path.relative(process.cwd(), filePath);
      await this.processMarkdownFile(filePath, relativePath);
      
      this.logFunction(`Processed ${eventType} event`, { filePath });
    } catch (error) {
      this.logFunction(`Error handling ${eventType} event`, { 
        filePath, 
        error: String(error) 
      });
    }
  }

  /**
   * Handle file delete events
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) return;

    try {
      // Simply remove from cache, don't interact with memory database
      await this.removeFromCache(filePath);
      this.logFunction('Removed file from cache', { filePath });
      
      /* Original code commented out
      const cached = this.fileCache.get(filePath);
      if (cached) {
        const { memoryService } = await getMemoryServices();
        
        // Mark memories as deleted
        for (const memoryId of cached.memoryIds) {
          await memoryService.updateMemory({
            id: memoryId,
            type: MemoryType.DOCUMENT,
            metadata: {
              deleted: true,
              deletedAt: new Date().toISOString(),
              fileDeleted: true,
              filePath: path.relative(process.cwd(), filePath)
            }
          });
        }
        
        await this.removeFromCache(filePath);
        this.logFunction('Marked memories as deleted', { filePath });
      }
      */
    } catch (error) {
      this.logFunction('Error handling delete event', { 
        filePath, 
        error: String(error) 
      });
    }
  }
} 