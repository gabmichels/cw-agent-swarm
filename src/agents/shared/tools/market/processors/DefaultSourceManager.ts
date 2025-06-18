/**
 * DefaultSourceManager.ts - Default implementation of the ISourceManager interface
 * 
 * This file provides a concrete implementation for managing market sources.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../../../../lib/logging';
import { MarketSource, MarketScannerConfig } from '../MarketScanner.interface';
import { ISourceManager } from '../interfaces/MarketSource.interface';

/**
 * Interface for source file
 */
interface SourceFile {
  sources: MarketSource[];
}

/**
 * Error class for source manager operations
 */
export class SourceManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceManagerError';
  }
}

/**
 * Default implementation of the source manager
 */
export class DefaultSourceManager implements ISourceManager {
  private sources: MarketSource[] = [];
  private dataDir: string;
  private sourceFiles = ['feeds.json', 'reddit.json', 'twitter.json'];
  
  /**
   * Create a new DefaultSourceManager
   * 
   * @param config Market scanner configuration
   */
  constructor(private config: MarketScannerConfig) {
    this.dataDir = config.dataDir || path.join(process.cwd(), 'data', 'sources');
    this.loadSources();
  }
  
  /**
   * Load sources from configuration files
   */
  async loadSources(): Promise<MarketSource[]> {
    try {
      this.sources = [];
      
      for (const file of this.sourceFiles) {
        const filePath = path.join(this.dataDir, file);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
          this.sources.push(...data.sources);
        }
      }
      
      logger.info(`Loaded ${this.sources.length} sources for market scanning`);
      return this.sources;
    } catch (error) {
      logger.error('Error loading market scanner sources:', error);
      return [];
    }
  }
  
  /**
   * Add a new source
   * 
   * @param source Source to add
   */
  async addSource(source: MarketSource): Promise<void> {
    // Determine which file this source should go in based on type
    let targetFile: string;
    switch (source.type) {
      case 'rss':
        targetFile = 'feeds.json';
        break;
      case 'reddit':
        targetFile = 'reddit.json';
        break;
      case 'twitter':
        targetFile = 'twitter.json';
        break;
      default:
        throw new SourceManagerError(`Unknown source type: ${source.type}`);
    }
    
    const filePath = path.join(this.dataDir, targetFile);
    
    try {
      // Create file if it doesn't exist
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ sources: [] }, null, 2));
      }
      
      // Read existing file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
      
      // Check if source with same ID already exists
      if (data.sources.some(s => s.id === source.id)) {
        throw new SourceManagerError(`Source with ID ${source.id} already exists`);
      }
      
      // Add the new source
      data.sources.push(source);
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // Update in-memory sources
      this.sources.push(source);
      
      logger.info(`Added new source: ${source.id} (${source.type})`);
    } catch (error) {
      logger.error(`Error adding source ${source.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove a source
   * 
   * @param sourceId ID of source to remove
   */
  async removeSource(sourceId: string): Promise<boolean> {
    // Find source in memory
    const sourceIndex = this.sources.findIndex(s => s.id === sourceId);
    if (sourceIndex === -1) {
      return false;
    }
    
    const source = this.sources[sourceIndex];
    
    // Determine which file this source is in
    let targetFile: string;
    switch (source.type) {
      case 'rss':
        targetFile = 'feeds.json';
        break;
      case 'reddit':
        targetFile = 'reddit.json';
        break;
      case 'twitter':
        targetFile = 'twitter.json';
        break;
      default:
        return false;
    }
    
    const filePath = path.join(this.dataDir, targetFile);
    
    try {
      // Read existing file
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
      
      // Remove the source
      data.sources = data.sources.filter(s => s.id !== sourceId);
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // Update in-memory sources
      this.sources.splice(sourceIndex, 1);
      
      logger.info(`Removed source: ${sourceId}`);
      return true;
    } catch (error) {
      logger.error(`Error removing source ${sourceId}:`, error);
      return false;
    }
  }
  
  /**
   * Update a source
   * 
   * @param sourceId ID of source to update
   * @param updates Updates to apply
   */
  async updateSource(sourceId: string, updates: Partial<MarketSource>): Promise<MarketSource> {
    // Find source in memory
    const sourceIndex = this.sources.findIndex(s => s.id === sourceId);
    if (sourceIndex === -1) {
      throw new SourceManagerError(`Source with ID ${sourceId} not found`);
    }
    
    const source = this.sources[sourceIndex];
    
    // Determine which file this source is in
    let targetFile: string;
    switch (source.type) {
      case 'rss':
        targetFile = 'feeds.json';
        break;
      case 'reddit':
        targetFile = 'reddit.json';
        break;
      case 'twitter':
        targetFile = 'twitter.json';
        break;
      default:
        throw new SourceManagerError(`Unknown source type: ${source.type}`);
    }
    
    const filePath = path.join(this.dataDir, targetFile);
    
    try {
      // Read existing file
      if (!fs.existsSync(filePath)) {
        throw new SourceManagerError(`Source file ${targetFile} not found`);
      }
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SourceFile;
      
      // Find source in file
      const fileSourceIndex = data.sources.findIndex(s => s.id === sourceId);
      if (fileSourceIndex === -1) {
        throw new SourceManagerError(`Source with ID ${sourceId} not found in file ${targetFile}`);
      }
      
      // Update the source
      const updatedSource = {
        ...data.sources[fileSourceIndex],
        ...updates,
        id: sourceId // Ensure ID doesn't change
      };
      
      data.sources[fileSourceIndex] = updatedSource;
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // Update in-memory sources
      this.sources[sourceIndex] = updatedSource;
      
      logger.info(`Updated source: ${sourceId}`);
      return updatedSource;
    } catch (error) {
      logger.error(`Error updating source ${sourceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get sources by category
   * 
   * @param category Category to filter by
   */
  async getSourcesByCategory(category: string): Promise<MarketSource[]> {
    return this.sources.filter(s => s.category === category);
  }
  
  /**
   * Get sources that are due for refresh
   */
  async getDueSources(): Promise<MarketSource[]> {
    const now = new Date();
    
    return this.sources.filter(source => {
      if (!source.last_checked) return true;
      
      const lastChecked = new Date(source.last_checked);
      const hoursSinceLastCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastCheck >= (source as any).refresh_interval;
    });
  }
  
  /**
   * Update source timestamp after processing
   * 
   * @param sourceId ID of source to update
   */
  async updateSourceTimestamp(sourceId: string): Promise<void> {
    const sourceIndex = this.sources.findIndex(s => s.id === sourceId);
    if (sourceIndex === -1) {
      return;
    }
    
    const source = this.sources[sourceIndex];
    
    // Update the source with the new timestamp
    await this.updateSource(sourceId, {
      last_checked: Date.now()
    });
  }
} 