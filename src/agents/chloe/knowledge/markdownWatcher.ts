import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { ChloeMemory } from '../memory';
import { markdownToMemoryEntries, loadAllMarkdownAsMemory } from './markdownMemoryLoader';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import * as memory from '../../../server/qdrant';
import { syncMarkdownWithGraph } from './markdownGraphIntegration';

/**
 * Watcher options interface
 */
export interface MarkdownWatcherOptions {
  memory: ChloeMemory;
  basePaths?: string[];
  logFunction?: (message: string, data?: any) => void;
  syncWithGraph?: boolean;
}

/**
 * Class to watch markdown files and keep memory in sync
 */
export class MarkdownWatcher {
  private memory: ChloeMemory;
  private watcher: any; // chokidar watcher
  private basePaths: string[];
  private logFunction: (message: string, data?: any) => void;
  private isWatching: boolean = false;
  private fileCache: Map<string, { lastModified: number, memoryIds: string[] }> = new Map();
  private syncWithGraph: boolean;

  constructor(options: MarkdownWatcherOptions) {
    this.memory = options.memory;
    // Set default base paths for watching markdown files
    this.basePaths = options.basePaths || [
      path.join(process.cwd(), 'data/knowledge/company/**/*.md'),
      path.join(process.cwd(), 'data/knowledge/domains/**/*.md'),
      path.join(process.cwd(), 'data/knowledge/agents/**/*.md')
    ];
    this.logFunction = options.logFunction || ((message, data) => {
      console.log(`[MarkdownWatcher] ${message}`, data ? data : '');
    });
    this.syncWithGraph = options.syncWithGraph !== undefined ? options.syncWithGraph : true;
  }

  /**
   * Start watching markdown files
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      this.logFunction('Watcher is already running');
      return;
    }

    this.logFunction('Starting markdown file watcher', { paths: this.basePaths });

    // Initialize chokidar watcher
    this.watcher = watch(this.basePaths, {
      persistent: true,
      ignoreInitial: false, // Process files on startup
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Wait 2 seconds after last change
        pollInterval: 100 // Poll every 100ms
      }
    });

    // Handle add/change events
    this.watcher.on('add', (filePath: string) => this.handleFileAddOrChange(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleFileAddOrChange(filePath, 'change'));
    
    // Handle delete events
    this.watcher.on('unlink', (filePath: string) => this.handleFileDelete(filePath));
    
    // Handle errors
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
    if (!filePath.toLowerCase().endsWith('.md')) {
      return; // Only process markdown files
    }

    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtimeMs;

      // Check if we need to process this file (either new or modified)
      const cachedFile = this.fileCache.get(filePath);
      if (cachedFile && cachedFile.lastModified === lastModified && eventType === 'change') {
        // File hasn't actually changed since last processing
        return;
      }

      this.logFunction(`Processing ${eventType === 'add' ? 'new' : 'modified'} markdown file`, { 
        filePath, 
        lastModified: new Date(lastModified).toISOString() 
      });

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Convert the file into memory entries
      const relativePath = path.relative(process.cwd(), filePath);
      const memoryEntries = await markdownToMemoryEntries(relativePath, content);
      
      // If this is a change event, mark old entries as superseded
      if (eventType === 'change' && cachedFile) {
        await this.markEntriesAsSuperseded(cachedFile.memoryIds, relativePath);
      }
      
      // Store new memory IDs
      const newMemoryIds: string[] = [];
      
      // Add each entry to memory
      for (const entry of memoryEntries) {
        const formattedContent = `# ${entry.title}\n\n${entry.content}`;
        
        // Convert to base memory type for storage and add metadata
        const memoryId = await memory.addMemory(
          entry.type as any,
          formattedContent,
          {
            title: entry.title,
            filePath: relativePath,
            type: entry.type,
            tags: entry.tags,
            importance: entry.importance,
            source: entry.source,
            lastModified: new Date(lastModified).toISOString()
          }
        );

        if (memoryId) {
          newMemoryIds.push(memoryId);
        }
      }
      
      // Update the cache
      this.fileCache.set(filePath, {
        lastModified,
        memoryIds: newMemoryIds
      });
      
      // GRAPH INTEGRATION: Synchronize with knowledge graph if enabled
      if (this.syncWithGraph) {
        try {
          const graphResult = await syncMarkdownWithGraph({
            filePath: relativePath,
            content,
            logFunction: this.logFunction
          });
          
          this.logFunction(`Synchronized markdown file with knowledge graph`, { 
            filePath: relativePath,
            nodesAdded: graphResult.nodesAdded,
            edgesAdded: graphResult.edgesAdded,
            concepts: graphResult.concepts
          });
        } catch (graphError) {
          this.logFunction(`Error synchronizing with knowledge graph`, { 
            error: String(graphError),
            filePath: relativePath
          });
          // Continue even if graph sync fails
        }
      }
      
      this.logFunction(`Successfully processed markdown file`, { 
        filePath, 
        entriesAdded: memoryEntries.length,
        memoryIds: newMemoryIds
      });
    } catch (error) {
      this.logFunction(`Error processing markdown file ${filePath}`, { 
        error: String(error) 
      });
    }
  }

  /**
   * Handle file delete events
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith('.md')) {
      return; // Only process markdown files
    }

    try {
      // Mark memories from this file as deleted
      const cachedFile = this.fileCache.get(filePath);
      if (cachedFile) {
        const relativePath = path.relative(process.cwd(), filePath);
        await this.markEntriesAsDeleted(cachedFile.memoryIds, relativePath);
        this.fileCache.delete(filePath);
        
        this.logFunction(`Marked deleted markdown file memories as removed`, { 
          filePath, 
          memoryIds: cachedFile.memoryIds 
        });
      }
    } catch (error) {
      this.logFunction(`Error handling deleted markdown file ${filePath}`, { 
        error: String(error) 
      });
    }
  }

  /**
   * Mark memory entries as superseded
   */
  private async markEntriesAsSuperseded(memoryIds: string[], filePath: string): Promise<void> {
    if (!memoryIds || memoryIds.length === 0) {
      return;
    }
    
    for (const memoryId of memoryIds) {
      // Modify the memory metadata to indicate it's superseded
      try {
        await memory.updateMemoryMetadata(memoryId, {
          superseded: true,
          supersededAt: new Date().toISOString()
        });
      } catch (error) {
        this.logFunction(`Error marking memory ${memoryId} as superseded`, { error: String(error) });
      }
    }
  }

  /**
   * Mark memory entries as deleted
   */
  private async markEntriesAsDeleted(memoryIds: string[], filePath: string): Promise<void> {
    if (!memoryIds || memoryIds.length === 0) {
      return;
    }
    
    for (const memoryId of memoryIds) {
      // Mark the memory as deleted
      try {
        await memory.updateMemoryMetadata(memoryId, {
          deleted: true,
          deletedAt: new Date().toISOString()
        });
      } catch (error) {
        this.logFunction(`Error marking memory ${memoryId} as deleted`, { error: String(error) });
      }
    }
  }

  /**
   * Force reload all markdown files
   */
  async reloadAllFiles(): Promise<{
    filesProcessed: number;
    entriesAdded: number;
    typeStats: Record<string, number>;
  }> {
    // Clear the cache
    this.fileCache.clear();
    
    // Stop watching temporarily if active
    const wasWatching = this.isWatching;
    if (wasWatching) {
      await this.stopWatching();
    }
    
    this.logFunction('Reloading all markdown files...');
    
    try {
      // Run the loader to reload all files
      const results = await loadAllMarkdownAsMemory();
      
      this.logFunction('Successfully reloaded all markdown files', results);
      
      // Restart watching if it was active
      if (wasWatching) {
        await this.startWatching();
      }
      
      return results;
    } catch (error) {
      this.logFunction('Error reloading markdown files', { error: String(error) });
      
      // Restart watching if it was active
      if (wasWatching) {
        await this.startWatching();
      }
      
      throw error;
    }
  }
} 