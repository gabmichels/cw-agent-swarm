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
   * Paths that were processed
   */
  paths: string[];
  
  /**
   * Time taken in milliseconds
   */
  timeTakenMs: number;
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
  }
  
  /**
   * Get the directories to load markdown files from
   */
  private getDirectories(): string[] {
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
  async loadMarkdownFiles(): Promise<MarkdownLoadingStats> {
    const startTime = Date.now();
    const stats: MarkdownLoadingStats = {
      filesLoaded: 0,
      memoriesCreated: 0,
      errors: 0,
      paths: [],
      timeTakenMs: 0
    };
    
    try {
      const directories = this.getDirectories();
      stats.paths = directories;
      
      this.logFunction('Loading markdown files from directories', { directories });
      
      for (const dir of directories) {
        try {
          const fullPath = path.join(process.cwd(), dir);
          const markdownFiles = await this.getMarkdownFiles(fullPath);
          
          for (const filePath of markdownFiles) {
            try {
              await this.processMarkdownFile(filePath);
              stats.filesLoaded++;
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
      
      stats.timeTakenMs = Date.now() - startTime;
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
  private async processMarkdownFile(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtimeMs;
      
      // Check cache to see if the file has been modified
      const cachedFile = this.fileCache.get(filePath);
      if (cachedFile && cachedFile.lastModified === lastModified) {
        // Return existing memory IDs
        return cachedFile.memoryIds;
      }
      
      // Remove existing memories for this file
      if (cachedFile) {
        await this.removeMemoriesForFile(filePath);
      }
      
      // Convert markdown to memory entries
      const entries = await this.markdownToMemoryEntries(filePath, content);
      
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
            filePath: path.relative(process.cwd(), filePath)
          });
          
          memoryIds.push(result.id);
        } catch (error) {
          this.logFunction(`Error adding memory for ${filePath}`, { error: String(error) });
        }
      }
      
      // Update cache
      this.fileCache.set(filePath, { lastModified, memoryIds });
      
      return memoryIds;
    } catch (error) {
      this.logFunction(`Error processing markdown file ${filePath}`, { error: String(error) });
      return [];
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
    
    // Extract tags using the tag extractor
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
      type: 'document',
      tags,
      importance: 'critical',
      source: 'markdown'
    }];
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
      
      // Create a watcher for all directories
      this.watcher = watch(directories, {
        persistent: true,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        }
      });
      
      // Setup change event handlers
      this.watcher.on('add', (filePath: string) => this.handleFileChange(filePath));
      this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath));
      this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));
      
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
  private async handleFileChange(filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) return;
    
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Process the file
      await this.processMarkdownFile(filePath);
      
      this.logFunction('Processed change event', { filePath: relativePath });
    } catch (error) {
      this.logFunction('Error handling file change', { 
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
} 