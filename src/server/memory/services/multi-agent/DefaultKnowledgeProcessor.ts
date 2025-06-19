/**
 * Knowledge Processor Service
 * 
 * This service handles processing of markdown files and other knowledge sources
 * to extract content and store as critical memories for agents.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { DefaultAgentMemoryService } from './agent-service';
import { IMemoryClient } from '../client/types';
import { logger } from '@/lib/logging';
import { tagExtractor } from '@/utils/tagExtractor';
import { AgentMemoryEntity } from '../../schema/agent';
import { MemoryType } from '@/server/memory/config/types';
import { DEFAULTS } from '@/server/memory/config/types';
import { BaseMetadata } from '@/types/metadata';

/**
 * Result of knowledge processing operation
 */
export interface KnowledgeProcessingResult {
  memoryIds: string[];
  fileCount: number;
  errorCount: number;
  tagCount: number;
  processingTimeMs: number;
}

/**
 * Knowledge processing options
 */
export interface KnowledgeProcessingOptions {
  maxTagsPerMemory?: number;
  importance?: string;
  chunkSize?: number;
  includeFilename?: boolean;
}

/**
 * Default knowledge processor service implementation
 */
export class DefaultKnowledgeProcessor {
  private client: IMemoryClient;
  private agentService: DefaultAgentMemoryService;

  /**
   * Create a new knowledge processor
   * @param client Memory client
   */
  constructor(client: IMemoryClient) {
    this.client = client;
    this.agentService = new DefaultAgentMemoryService(client);
  }

  /**
   * Process a markdown file and store its content as critical memories
   * 
   * @param agentId ID of the agent to store memories for
   * @param filePath Path to the markdown file
   * @param options Processing options
   * @returns Processing results including memory IDs
   */
  async processMarkdownFile(
    agentId: string, 
    filePath: string, 
    options: KnowledgeProcessingOptions = {}
  ): Promise<KnowledgeProcessingResult> {
    const startTime = Date.now();
    const result: KnowledgeProcessingResult = {
      memoryIds: [],
      fileCount: 1,
      errorCount: 0,
      tagCount: 0,
      processingTimeMs: 0
    };

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Get file name for reference
      const fileName = path.basename(filePath);
      
      // Split content into sections if it's too large
      const chunks = this.splitContentIntoChunks(content, options.chunkSize || 5000);
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTitle = chunks.length > 1 
          ? `${fileName} (Part ${i+1}/${chunks.length})` 
          : fileName;
        
        // Extract tags
        const taggingResult = await tagExtractor.extractTags(chunk, {
          maxTags: options.maxTagsPerMemory || 15
        });
        
        // Create memory metadata
        const metadata = {
          type: 'critical_memory',
          source: 'knowledge_file',
          fileName,
          importance: options.importance || 'high',
          tags: taggingResult.tags.map(tag => tag.text),
          agentId,
          timestamp: new Date()
        };
        
        // Create memory content with optional filename header
        const memoryContent = options.includeFilename !== false
          ? `# ${chunkTitle}\n\n${chunk}`
          : chunk;
        
        // Store memory
        const memoryId = `memory_${agentId}_${fileName.replace(/\W+/g, '_')}_${Date.now()}_${i}`;
        
        // Store in the agent's memory collection
        const storeResult = await this.storeMemory('memories', memoryId, memoryContent, metadata);
        
        if (storeResult.isError) {
          logger.error(`Error storing memory for file ${fileName}:`, storeResult.error);
          result.errorCount++;
        } else {
          result.memoryIds.push(memoryId);
          result.tagCount += taggingResult.tags.length;
        }
      }
    } catch (error) {
      logger.error(`Error processing markdown file ${filePath}:`, error);
      result.errorCount++;
    }
    
    // Calculate processing time
    result.processingTimeMs = Date.now() - startTime;
    
    return result;
  }
  
  /**
   * Process all markdown files in specified knowledge paths
   * 
   * @param agentId ID of the agent to store memories for
   * @param knowledgePaths Paths to scan for markdown files
   * @param options Processing options
   * @returns Processing results
   */
  async processKnowledgePaths(
    agentId: string,
    knowledgePaths: string[],
    options: KnowledgeProcessingOptions = {}
  ): Promise<KnowledgeProcessingResult> {
    const startTime = Date.now();
    const result: KnowledgeProcessingResult = {
      memoryIds: [],
      fileCount: 0,
      errorCount: 0,
      tagCount: 0,
      processingTimeMs: 0
    };
    
    try {
      // Find all markdown files in the specified paths
      const markdownFiles: string[] = [];
      
      for (const dirPath of knowledgePaths) {
        try {
          // Make sure directory exists
          const dirStats = await fs.stat(dirPath).catch(() => null);
          if (!dirStats || !dirStats.isDirectory()) {
            logger.warn(`Knowledge path does not exist or is not a directory: ${dirPath}`);
            continue;
          }
          
          // Find markdown files in this directory
          const files = await glob('**/*.md', { cwd: dirPath });
          
          // Add full paths to the list
          for (const file of files) {
            markdownFiles.push(path.join(dirPath, file));
          }
        } catch (error) {
          logger.error(`Error scanning directory ${dirPath}:`, error);
          result.errorCount++;
        }
      }
      
      // Process each markdown file
      for (const filePath of markdownFiles) {
        const fileResult = await this.processMarkdownFile(agentId, filePath, options);
        
        // Update overall results
        result.fileCount++;
        result.memoryIds.push(...fileResult.memoryIds);
        result.errorCount += fileResult.errorCount;
        result.tagCount += fileResult.tagCount;
      }
    } catch (error) {
      logger.error('Error processing knowledge paths:', error);
      result.errorCount++;
    }
    
    // Calculate processing time
    result.processingTimeMs = Date.now() - startTime;
    
    // Associate memories with agent
    try {
      // Get the agent
      const agentResult = await this.agentService.getAgent(agentId);
      
      if (agentResult.isError || !agentResult.value) {
        logger.error(`Could not find agent ${agentId} to associate memories with`);
        return result;
      }
      
      // No need to update the agent for now as the memories can be retrieved
      // by agentId in the metadata
      
      logger.info(`Successfully processed ${result.fileCount} files for agent ${agentId}, created ${result.memoryIds.length} memories`);
    } catch (error) {
      logger.error(`Error associating memories with agent ${agentId}:`, error);
    }
    
    return result;
  }
  
  /**
   * Process uploaded markdown content
   * 
   * @param agentId ID of the agent to store memories for
   * @param content Markdown content
   * @param fileName Optional filename for reference
   * @param options Processing options
   * @returns Processing results
   */
  async processMarkdownContent(
    agentId: string,
    content: string,
    fileName: string = 'uploaded_content.md',
    options: KnowledgeProcessingOptions = {}
  ): Promise<KnowledgeProcessingResult> {
    const startTime = Date.now();
    const result: KnowledgeProcessingResult = {
      memoryIds: [],
      fileCount: 1,
      errorCount: 0,
      tagCount: 0,
      processingTimeMs: 0
    };
    
    try {
      // Split content into sections if it's too large
      const chunks = this.splitContentIntoChunks(content, options.chunkSize || 5000);
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTitle = chunks.length > 1 
          ? `${fileName} (Part ${i+1}/${chunks.length})` 
          : fileName;
        
        // Extract tags
        const taggingResult = await tagExtractor.extractTags(chunk, {
          maxTags: options.maxTagsPerMemory || 15
        });
        
        // Create memory metadata
        const metadata = {
          type: 'critical_memory',
          source: 'uploaded_content',
          fileName,
          importance: options.importance || 'high',
          tags: taggingResult.tags.map(tag => tag.text),
          agentId,
          timestamp: new Date()
        };
        
        // Create memory content with optional filename header
        const memoryContent = options.includeFilename !== false
          ? `# ${chunkTitle}\n\n${chunk}`
          : chunk;
        
        // Store memory
        const memoryId = `memory_${agentId}_${fileName.replace(/\W+/g, '_')}_${Date.now()}_${i}`;
        
        // Store in the agent's memory collection
        const storeResult = await this.storeMemory('memories', memoryId, memoryContent, metadata);
        
        if (storeResult.isError) {
          logger.error(`Error storing memory for content ${fileName}:`, storeResult.error);
          result.errorCount++;
        } else {
          result.memoryIds.push(memoryId);
          result.tagCount += taggingResult.tags.length;
        }
      }
    } catch (error) {
      logger.error('Error processing markdown content:', error);
      result.errorCount++;
    }
    
    // Calculate processing time
    result.processingTimeMs = Date.now() - startTime;
    
    return result;
  }
  
  /**
   * Split content into smaller chunks that can be processed separately
   * 
   * @param content Content to split
   * @param maxChunkSize Maximum size of each chunk
   * @returns Array of content chunks
   */
  private splitContentIntoChunks(content: string, maxChunkSize: number): string[] {
    // If content is small enough, return as is
    if (content.length <= maxChunkSize) {
      return [content];
    }
    
    const chunks: string[] = [];
    
    // Try to split on headers first (# Header)
    const headerRegex = /^#+\s+.+$/gm;
    const headerMatches: number[] = [];
    let match: RegExpExecArray | null;
    
    // Use exec instead of matchAll for better compatibility
    while ((match = headerRegex.exec(content)) !== null) {
      if (match.index !== undefined) {
        headerMatches.push(match.index);
      }
    }
    
    if (headerMatches.length > 1) {
      // We have headers to split on
      let startIdx = 0;
      let currentChunk = '';
      
      for (let i = 0; i < headerMatches.length; i++) {
        const headerIdx = headerMatches[i] as number;
        const nextHeaderIdx = i < headerMatches.length - 1 ? headerMatches[i + 1] as number : content.length;
        
        // Get the current header's content
        const headerContent = content.substring(headerIdx, nextHeaderIdx);
        
        // If adding this would make the chunk too big, start a new chunk
        if (currentChunk.length + headerContent.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = headerContent;
        } else {
          currentChunk += headerContent;
        }
      }
      
      // Add the last chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
    } else {
      // No headers, split on paragraphs or just by size
      const paragraphs = content.split(/\n\s*\n/);
      let currentChunk = '';
      
      for (const para of paragraphs) {
        if (currentChunk.length + para.length + 2 > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = para;
        } else {
          if (currentChunk.length > 0) {
            currentChunk += '\n\n';
          }
          currentChunk += para;
        }
      }
      
      // Add the last chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      
      // If any chunk is still too big, split it arbitrarily
      const finalChunks: string[] = [];
      for (const chunk of chunks) {
        if (chunk.length > maxChunkSize) {
          // Split into pieces of maxChunkSize
          for (let i = 0; i < chunk.length; i += maxChunkSize) {
            finalChunks.push(chunk.substring(i, i + maxChunkSize));
          }
        } else {
          finalChunks.push(chunk);
        }
      }
      
      return finalChunks;
    }
    
    return chunks;
  }

  /**
   * Helper function to store memory using the memory client
   * 
   * @param collectionName Collection to store memory in
   * @param id Memory ID
   * @param content Memory content
   * @param metadata Memory metadata
   * @returns Result with success flag and error if applicable
   */
  private async storeMemory(
    collectionName: string,
    id: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<{ isError: boolean; error?: Error }> {
    try {
      // Store memory with proper structure
      await this.client.addPoint(collectionName, {
        id,
        vector: [], // The vector will be generated by the database service
        payload: {
          id,
          text: content,
          timestamp: new Date().toISOString(),
          type: MemoryType.DOCUMENT,
          metadata: {
            ...metadata,
            schemaVersion: DEFAULTS.SCHEMA_VERSION
          }
        }
      });
      
      return { isError: false };
    } catch (error) {
      return { 
        isError: true, 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  }
} 