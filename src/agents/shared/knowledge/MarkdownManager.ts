/**
 * Generic Markdown Manager
 * 
 * This module provides a configurable, agent-agnostic implementation of the markdown manager
 * that can work with any agent's configuration and knowledge paths.
 */

import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { logger } from '@/lib/logging';
import { IAgentMemory } from '../memory';
import { extractTags } from '../../../utils/tagExtractor';

/**
 * Cache interface for markdown files
 */
interface MarkdownFileCache {
  [filePath: string]: {
    lastModified: number;
    memoryIds: string[];
  };
}

/**
 * Options for the MarkdownManager
 */
export interface MarkdownManagerOptions {
  /**
   * Memory service to use for storing markdown content
   */
  memory: IAgentMemory;
  
  /**
   * Agent ID to associate with the markdown content
   */
  agentId: string;
  
  /**
   * Department or domain for categorizing knowledge
   * @default "general"
   */
  department?: string;
  
  /**
   * Custom list of knowledge paths to load
   */
  knowledgePaths?: string[];
  
  /**
   * Logger function for tracking operations
   */
  logFunction?: (message: string, data?: any) => void;
  
  /**
   * Whether to sync markdown with knowledge graph
   * @default false
   */
  syncWithGraph?: boolean;
  
  /**
   * Path to cache file
   * @default "data/cache/markdown-cache.json"
   */
  cacheFilePath?: string;
  
  /**
   * Path to initialization flag file
   * @default "data/cache/markdown-initialized.flag"
   */
  initFlagPath?: string;
}

/**
 * Statistics for markdown loading operations
 */
export interface MarkdownLoadingStats {
  /**
   * Number of files loaded
   */
  filesLoaded: number;
  
  /**
   * Number of memories created
   */
  memoriesCreated: number;
  
  /**
   * Number of errors encountered
   */
  errors: number;
  
  /**
   * Number of files that were unchanged
   */
  unchangedFiles: number;
  
  /**
   * Number of duplicates skipped
   */
  duplicatesSkipped: number;
  
  /**
   * Paths that were processed
   */
  paths: string[];
  
  /**
   * Time taken in milliseconds
   */
  timeTakenMs: number;
}

/**
 * Configuration for markdown parsing
 */
export interface MarkdownParsingOptions {
  /**
   * Split into multiple sections at h1 headers
   */
  splitSections?: boolean;
  
  /**
   * Maximum tags to extract from content
   */
  maxTags?: number;
  
  /**
   * Default importance level
   */
  defaultImportance?: string;
  
  /**
   * Additional tags to include
   */
  additionalTags?: string[];
  
  /**
   * Maximum length for individual sections
   */
  maxSectionLength?: number;
}

/**
 * Generic markdown manager that handles loading and watching markdown files
 * for any agent type
 */
export class MarkdownManager {
  private memory: IAgentMemory;
  private agentId: string;
  private department: string;
  private customKnowledgePaths?: string[];
  private logFunction: (message: string, data?: any) => void;
  private syncWithGraph: boolean;
  private watcher: any; // chokidar watcher
  private isWatching: boolean = false;
  private fileCache: Map<string, { lastModified: number, memoryIds: string[] }> = new Map();
  private cacheFilePath: string;
  private initFlagPath: string;
  
  /**
   * Create a new markdown manager
   */
  constructor(options: MarkdownManagerOptions) {
    this.memory = options.memory;
    this.agentId = options.agentId;
    this.department = options.department || 'general';
    this.customKnowledgePaths = options.knowledgePaths;
    this.logFunction = options.logFunction || ((message, data) => {
      logger.info(`[MarkdownManager] ${message}`, data ? data : '');
    });
    this.syncWithGraph = options.syncWithGraph !== undefined ? options.syncWithGraph : false;
    this.cacheFilePath = options.cacheFilePath || path.join(process.cwd(), 'data/cache/markdown-cache.json');
    this.initFlagPath = options.initFlagPath || path.join(process.cwd(), 'data/cache/markdown-initialized.flag');
    
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
      const cacheDir = path.dirname(this.cacheFilePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      try {
        const data = await fs.readFile(this.cacheFilePath, 'utf-8');
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
      const cacheDir = path.dirname(this.cacheFilePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cache = Object.fromEntries(this.fileCache);
      await fs.writeFile(this.cacheFilePath, JSON.stringify(cache, null, 2));
      this.logFunction('Saved markdown cache', { entries: this.fileCache.size });
    } catch (error) {
      this.logFunction('Error saving cache', { error: String(error) });
    }
  }
  
  /**
   * Get the directories to load markdown files from
   */
  public getDirectories(): string[] {
    // If custom paths are provided, use those instead
    if (this.customKnowledgePaths && this.customKnowledgePaths.length > 0) {
      return this.customKnowledgePaths;
    }
    
    // Otherwise use default directories
    return [
      'data/knowledge/company',
      `data/knowledge/agents/${this.agentId}`,
      'data/knowledge/agents/shared',
      `data/knowledge/domains/${this.department}`,
      'data/knowledge/test' // Added test directory for development
    ];
  }
  
  /**
   * Load markdown files from all directories
   */
  async loadMarkdownFiles(options: {
    force?: boolean;
    checkForDuplicates?: boolean;
    parsingOptions?: MarkdownParsingOptions;
  } = {}): Promise<MarkdownLoadingStats> {
    const startTime = Date.now();
    const stats: MarkdownLoadingStats = {
      filesLoaded: 0,
      memoriesCreated: 0,
      errors: 0,
      unchangedFiles: 0,
      duplicatesSkipped: 0,
      paths: [],
      timeTakenMs: 0
    };
    
    // Check if we've already initialized once during this server session
    if (!options.force) {
      try {
        // Check for the flag file's existence
        const initFlagExists = await fs.access(this.initFlagPath)
          .then(() => true)
          .catch(() => false);
          
        if (initFlagExists) {
          this.logFunction('Markdown already initialized this session. Skipping ingestion.');
          
          stats.timeTakenMs = Date.now() - startTime;
          return stats;
        }
      } catch (error) {
        // Ignore errors and continue with ingestion
        this.logFunction('Error checking initialization flag, proceeding with ingestion');
      }
    }
    
    try {
      const directories = this.getDirectories();
      stats.paths = directories;
      
      this.logFunction('=== Starting Markdown Ingestion ===');
      this.logFunction('Loading markdown files from directories', { directories });
      
      for (const dir of directories) {
        try {
          const fullPath = path.join(process.cwd(), dir);
          const markdownFiles = await this.getMarkdownFiles(fullPath);
          
          for (const filePath of markdownFiles) {
            try {
              // Check if file has been modified since last processing
              const fileStats = await fs.stat(filePath);
              const lastModified = fileStats.mtimeMs;
              
              // Check cache to see if the file has been modified
              const cachedFile = this.fileCache.get(filePath);
              if (!options.force && cachedFile && cachedFile.lastModified === lastModified) {
                // Skip unchanged file
                stats.unchangedFiles++;
                continue;
              }
              
              // Process the file
              const fileResult = await this.processMarkdownFile(filePath, options.parsingOptions);
              
              // Update stats
              stats.filesLoaded++;
              stats.memoriesCreated += fileResult.memoryIds.length;
              
              // Update file cache
              this.fileCache.set(filePath, { 
                lastModified, 
                memoryIds: fileResult.memoryIds 
              });
            } catch (error) {
              stats.errors++;
              this.logFunction(`Error processing markdown file ${filePath}`, { error: String(error) });
            }
          }
        } catch (error) {
          stats.errors++;
          this.logFunction(`Error loading markdown files from ${dir}`, { error: String(error) });
        }
      }
      
      // Save the cache
      await this.saveCache();
      
      // After successful ingestion, create the initialization flag file
      try {
        // Ensure the directory exists
        const flagDir = path.dirname(this.initFlagPath);
        await fs.mkdir(flagDir, { recursive: true });
        
        // Write the current timestamp to the flag file
        await fs.writeFile(this.initFlagPath, new Date().toISOString());
        this.logFunction('Created initialization flag');
      } catch (error) {
        this.logFunction(`Warning: Could not create initialization flag: ${String(error)}`);
      }
      
      stats.timeTakenMs = Date.now() - startTime;
      this.logFunction('=== Markdown Ingestion Complete ===', stats);
      
      return stats;
    } catch (error) {
      this.logFunction('Error loading markdown files', { error: String(error) });
      stats.errors++;
      stats.timeTakenMs = Date.now() - startTime;
      return stats;
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
   * Process a markdown file and add it to memory
   */
  private async processMarkdownFile(
    filePath: string, 
    parsingOptions?: MarkdownParsingOptions
  ): Promise<{ memoryIds: string[] }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Remove existing memories for this file if any
      await this.removeMemoriesForFile(filePath);
      
      // Convert markdown to memory entries
      const entries = await this.markdownToMemoryEntries(filePath, content, parsingOptions);
      
      // Add each entry to memory
      const memoryIds: string[] = [];
      for (const entry of entries) {
        try {
          const result = await this.memory.addKnowledge({
            title: entry.title,
            content: entry.content,
            source: entry.source,
            tags: entry.tags,
            importance: entry.importance,
            filePath: relativePath,
            lastModified: new Date().toISOString()
          });
          
          memoryIds.push(result.id);
        } catch (error) {
          this.logFunction(`Error adding memory for ${filePath}`, { error: String(error) });
        }
      }
      
      // Update cache
      const fileStats = await fs.stat(filePath);
      this.fileCache.set(filePath, { 
        lastModified: fileStats.mtimeMs, 
        memoryIds 
      });
      
      return { memoryIds };
    } catch (error) {
      this.logFunction(`Error processing markdown file ${filePath}`, { error: String(error) });
      return { memoryIds: [] };
    }
  }
  
  /**
   * Convert markdown content to memory entries
   */
  private async markdownToMemoryEntries(
    filePath: string, 
    content: string,
    options?: MarkdownParsingOptions
  ): Promise<Array<{
    title: string;
    content: string;
    type: string;
    tags: string[];
    importance: string;
    source: string;
  }>> {
    const defaultTitle = path.basename(filePath, '.md');
    const formattedTitle = defaultTitle.charAt(0).toUpperCase() + defaultTitle.slice(1);
    
    // Default options
    const {
      splitSections = false,
      maxTags = 15,
      defaultImportance = 'critical',
      additionalTags = [],
      maxSectionLength = 8000
    } = options || {};
    
    // Extract tags using the tag extractor
    let tags: string[] = [...additionalTags];
    try {
      const result = await extractTags(content, { maxTags });
      
      if (result.success && result.tags.length > 0) {
        tags = [...tags, ...result.tags.map(tag => tag.text)];
      }
    } catch (error) {
      this.logFunction(`Failed to extract tags with AI: ${error}`);
    }
    
    // If not splitting into sections, create a single entry for the whole file
    if (!splitSections) {
      return [{
        title: formattedTitle,
        content,
        type: 'document',
        tags,
        importance: defaultImportance,
        source: 'markdown'
      }];
    }
    
    // Split the content into sections based on h1 headers
    const sections: Array<{title: string, content: string}> = [];
    const h1Regex = /^# (.+)$/gm;
    let lastIndex = 0;
    let match;
    
    while ((match = h1Regex.exec(content)) !== null) {
      if (lastIndex > 0) {
        const sectionContent = content.substring(lastIndex, match.index).trim();
        if (sectionContent) {
          sections.push({
            title: sections.length > 0 ? sections[sections.length - 1].title : formattedTitle,
            content: sectionContent
          });
        }
      }
      lastIndex = match.index;
      sections.push({
        title: match[1].trim(),
        content: ''
      });
    }
    
    // Add the last section
    if (lastIndex > 0) {
      const sectionContent = content.substring(lastIndex).trim();
      if (sectionContent) {
        sections.push({
          title: sections.length > 0 ? sections[sections.length - 1].title : formattedTitle,
          content: sectionContent
        });
      }
    } else {
      // No sections found, use the whole content
      sections.push({
        title: formattedTitle,
        content
      });
    }
    
    // Convert sections to memory entries
    return sections.map(section => ({
      title: section.title,
      content: section.content.substring(0, maxSectionLength),
      type: 'document',
      tags,
      importance: defaultImportance,
      source: 'markdown'
    }));
  }
  
  /**
   * Remove memories associated with a file
   */
  private async removeMemoriesForFile(filePath: string): Promise<void> {
    try {
      const cachedFile = this.fileCache.get(filePath);
      if (cachedFile && cachedFile.memoryIds.length > 0) {
        // Delete each memory ID
        for (const memoryId of cachedFile.memoryIds) {
          await this.memory.removeKnowledge(memoryId);
        }
        
        // Remove from cache
        this.fileCache.delete(filePath);
        
        this.logFunction(`Removed ${cachedFile.memoryIds.length} memories for ${filePath}`);
      }
    } catch (error) {
      this.logFunction(`Error removing memories for ${filePath}`, { error: String(error) });
    }
  }
  
  /**
   * Start watching markdown files for changes
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      this.logFunction('Already watching markdown files');
      return;
    }
    
    try {
      const directories = this.getDirectories();
      
      // Make sure the directories exist
      for (const dir of directories) {
        try {
          await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
        } catch (error) {
          this.logFunction(`Error creating directory ${dir}`, { error: String(error) });
        }
      }
      
      // Create a watcher for all directories with improved settings
      this.watcher = watch(directories.map(dir => path.join(process.cwd(), dir)), {
        persistent: true,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        },
        usePolling: true,
        interval: 1000
      });
      
      // Setup change event handlers
      this.watcher.on('add', (filePath: string) => this.handleFileChange(filePath, 'add'));
      this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath, 'change'));
      this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));
      
      // Add ready event
      this.watcher.on('ready', () => {
        this.logFunction('Markdown watcher ready', { directories });
      });
      
      // Add error handling
      this.watcher.on('error', (error: Error) => {
        this.logFunction('Error in file watcher', { error: error.message });
      });
      
      this.isWatching = true;
      this.logFunction('Started watching markdown files', { directories });
    } catch (error) {
      this.logFunction('Error starting markdown watcher', { error: String(error) });
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
   * Handle file change events
   */
  private async handleFileChange(filePath: string, eventType: 'add' | 'change'): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) return;
    
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Process the file
      const result = await this.processMarkdownFile(filePath);
      
      this.logFunction(`Processed ${eventType} event`, { 
        filePath: relativePath,
        entriesAdded: result.memoryIds.length
      });
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
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Remove memories for this file
      await this.removeMemoriesForFile(filePath);
      
      this.logFunction('Processed delete event', { filePath: relativePath });
    } catch (error) {
      this.logFunction('Error handling delete event', { 
        filePath, 
        error: String(error) 
      });
    }
  }
  
  /**
   * Clear all markdown caches
   */
  async clearCache(): Promise<void> {
    try {
      this.fileCache.clear();
      await this.saveCache();
      
      // Also remove the initialization flag
      try {
        await fs.unlink(this.initFlagPath);
      } catch (error) {
        // Ignore if the file doesn't exist
      }
      
      this.logFunction('Cleared markdown cache');
    } catch (error) {
      this.logFunction('Error clearing markdown cache', { error: String(error) });
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
      
      this.logFunction(`Creating test file at: ${relativePath}`);
      
      // Write the file
      await fs.writeFile(testFilePath, testContent, 'utf-8');
      this.logFunction(`Test file created successfully`);
      
      // After 5 seconds, update the file to test change detection
      setTimeout(async () => {
        try {
          this.logFunction(`Updating test file: ${relativePath}`);
          await fs.writeFile(
            testFilePath, 
            testContent + `\n\n## Updated Section\n\nThis file was updated at ${new Date().toISOString()}.\n`,
            'utf-8'
          );
          this.logFunction(`Test file updated successfully`);
          
          // After another 5 seconds, delete the file to test delete detection
          setTimeout(async () => {
            try {
              this.logFunction(`Deleting test file: ${relativePath}`);
              await fs.unlink(testFilePath);
              this.logFunction(`Test file deleted successfully`);
            } catch (deleteError) {
              this.logFunction(`Error deleting test file: ${String(deleteError)}`);
            }
          }, 5000);
          
        } catch (updateError) {
          this.logFunction(`Error updating test file: ${String(updateError)}`);
        }
      }, 5000);
      
      return true;
    } catch (error) {
      this.logFunction(`Error testing file watcher: ${String(error)}`);
      return false;
    }
  }
} 