/**
 * Tag Extractor Middleware
 * 
 * Middleware to extract tags from messages using OpenAI's cheaper model.
 * This happens before the main LLM processing and after responses.
 */

import { ImportanceLevel, MemoryType } from '../../../server/memory/config';
import { MemorySource } from '../../../constants/memory';
import { extractTags } from '../../../utils/tagExtractor';
import { Tag } from '../../../lib/memory/TagExtractor';

/**
 * TaskLogger interface for logging
 */
interface TaskLogger {
  logAction(action: string, metadata?: Record<string, unknown>): void;
}

/**
 * Options for tag extraction middleware
 */
export interface TagExtractorMiddlewareOptions {
  maxTags?: number;
  taskLogger?: TaskLogger;
}

/**
 * Memory update data
 */
interface MemoryUpdateData {
  memoryId: string;
  tags: string[];
}

/**
 * Normalize a tag for consistent formatting
 * @param tagText Tag text to normalize
 * @returns Normalized tag
 */
function normalizeTag(tagText: string): string {
  if (!tagText || typeof tagText !== 'string') return '';
  
  // Convert to lowercase and trim
  let normalized = tagText.toLowerCase().trim();
  
  // Remove special characters (keep alphanumeric, spaces)
  normalized = normalized.replace(/[^\w\s]/g, '');
  
  // Replace underscores with spaces for consistency
  normalized = normalized.replace(/_+/g, ' ');
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Truncate if too long (max 30 chars)
  if (normalized.length > 30) {
    // Try to truncate at a word boundary
    const words = normalized.split(' ');
    normalized = '';
    for (const word of words) {
      if ((normalized + ' ' + word).length <= 30) {
        normalized += (normalized ? ' ' : '') + word;
      } else {
        break;
      }
    }
  }
  
  return normalized;
}

/**
 * Normalize an array of tags
 * @param tags Array of tags to normalize
 * @returns Deduplicated, normalized tags
 */
function normalizeTags(tags: string[]): string[] {
  // Create a set for deduplication
  const tagSet = new Set<string>();
  
  // Add normalized tags to set
  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag);
    if (normalizedTag) {
      tagSet.add(normalizedTag);
    }
  }
  
  // Convert back to array and return
  return Array.from(tagSet);
}

/**
 * Middleware for tag extraction
 */
export class TagExtractorMiddleware {
  private memoryManager: any;
  private maxTags: number;
  private taskLogger: TaskLogger | null;
  private memoryUpdates: Map<string, MemoryUpdateData> = new Map();
  private options: TagExtractorMiddlewareOptions;
  
  /**
   * Create a new tag extractor middleware
   */
  constructor(memoryManager: any, options: TagExtractorMiddlewareOptions = {}) {
    this.memoryManager = memoryManager;
    this.maxTags = options.maxTags || 10;
    this.taskLogger = options.taskLogger || null;
    this.options = options;
  }
  
  /**
   * Process a user message to extract tags
   * Returns extracted tags to be used in message processing
   */
  async processUserMessage(
    message: string, 
    existingTags: string[] = []
  ): Promise<Tag[]> {
    try {
      // Log that we're extracting tags
      this.log('Extracting tags from user message', {
        messageLength: message.length,
        existingTagsCount: existingTags.length
      });
      
      // Normalize existing tags
      const normalizedExistingTags = normalizeTags(existingTags);
      
      // Extract tags from the message
      const extractionResult = await extractTags(message, {
        maxTags: this.maxTags,
        existingTags: normalizedExistingTags
      });
      
      if (!extractionResult.success) {
        this.log('Tag extraction failed', { error: extractionResult.error });
        return [];
      }
      
      // Log the extracted tags
      this.log('Tags extracted from user message', {
        tagCount: extractionResult.tags.length,
        tags: extractionResult.tags.map(t => `${t.text} (${t.confidence.toFixed(2)})`)
      });
      
      return extractionResult.tags;
    } catch (error) {
      this.log('Error in tag extraction middleware', { error });
      return [];
    }
  }
  
  /**
   * Process a memory item to extract and update tags
   * This is used after memory creation to update the tags
   */
  async processMemoryItem(
    memoryId: string,
    content: string,
    existingTags: string[] = []
  ): Promise<void> {
    try {
      // Normalize existing tags
      const normalizedExistingTags = normalizeTags(existingTags);
      
      // Extract tags from the memory content
      const extractionResult = await extractTags(content, {
        maxTags: this.maxTags,
        existingTags: normalizedExistingTags
      });
      
      if (!extractionResult.success) {
        this.log('Tag extraction failed for memory', { 
          memoryId, 
          error: extractionResult.error 
        });
        return;
      }
      
      // Get tag texts and normalize them
      const extractedTagTexts = extractionResult.tags.map(tag => tag.text);
      const normalizedExtractedTags = normalizeTags(extractedTagTexts);
      
      // Only update if we have new tags and they're different from existing
      if (normalizedExtractedTags.length > 0) {
        // Combine existing and new tags, removing duplicates through normalization
        const allTags = normalizeTags([...normalizedExistingTags, ...normalizedExtractedTags]);
        
        // Store update to be applied later
        this.memoryUpdates.set(memoryId, {
          memoryId,
          tags: allTags
        });
        
        this.log('Tags extracted for memory', {
          memoryId,
          existingTagsCount: normalizedExistingTags.length,
          newTagsCount: normalizedExtractedTags.length,
          allTagsCount: allTags.length,
          newTags: normalizedExtractedTags
        });
      }
    } catch (error) {
      this.log('Error in memory tag extraction', { error, memoryId });
    }
  }
  
  /**
   * Process an agent response to extract tags
   */
  async processAgentResponse(
    response: string, 
    memoryId: string, 
    existingTags: string[] = []
  ): Promise<void> {
    try {
      // Normalize existing tags
      const normalizedExistingTags = normalizeTags(existingTags);
      
      // Extract tags from the response
      const extractionResult = await extractTags(response, {
        maxTags: this.maxTags,
        existingTags: normalizedExistingTags
      });
      
      if (!extractionResult.success) {
        this.log('Tag extraction failed for agent response', { 
          memoryId, 
          error: extractionResult.error 
        });
        return;
      }
      
      // Get normalized tag texts
      const extractedTagTexts = extractionResult.tags.map(tag => tag.text);
      const normalizedExtractedTags = normalizeTags(extractedTagTexts);
      
      // Only update if we have new tags
      if (normalizedExtractedTags.length > 0) {
        // Combine existing and new tags, removing duplicates through normalization
        const allTags = normalizeTags([...normalizedExistingTags, ...normalizedExtractedTags]);
        
        // Store the update to be applied later
        this.memoryUpdates.set(memoryId, {
          memoryId,
          tags: allTags
        });
        
        this.log('Tags extracted for agent response', {
          memoryId,
          allTagsCount: allTags.length,
          newTags: normalizedExtractedTags
        });
      }
    } catch (error) {
      this.log('Error in agent response tag extraction', { error, memoryId });
    }
  }
  
  /**
   * Process markdown file content to extract tags
   */
  async processMarkdownFile(
    content: string,
    existingTags: string[] = []
  ): Promise<string[]> {
    try {
      // Normalize existing tags
      const normalizedExistingTags = normalizeTags(existingTags);
      
      // Extract tags with a higher max for markdown files
      const extractionResult = await extractTags(content, {
        maxTags: 15, // More tags for markdown files
        existingTags: normalizedExistingTags
      });
      
      if (!extractionResult.success) {
        this.log('Tag extraction failed for markdown file', { 
          error: extractionResult.error 
        });
        return normalizedExistingTags;
      }
      
      // Get tag texts and normalize
      const extractedTagTexts = extractionResult.tags.map(tag => tag.text);
      const normalizedExtractedTags = normalizeTags(extractedTagTexts);
      
      // Combine existing and new tags, removing duplicates
      return normalizeTags([...normalizedExistingTags, ...normalizedExtractedTags]);
    } catch (error) {
      this.log('Error in markdown file tag extraction', { error });
      return normalizeTags(existingTags);
    }
  }
  
  /**
   * Apply all pending memory updates for tags
   * This is called at the end of processing to update all memories at once
   */
  async applyMemoryUpdates(): Promise<void> {
    if (this.memoryUpdates.size === 0) {
      return;
    }
    
    this.log('Applying memory tag updates', { 
      updateCount: this.memoryUpdates.size 
    });
    
    // Process each memory update using Array.from to avoid iterator issues
    const updates = Array.from(this.memoryUpdates.entries());
    
    for (const [memoryId, update] of updates) {
      try {
        // Update memory with new tags
        await this.memoryManager.updateMemory(
          memoryId,
          {
            metadata: {
              tags: update.tags,
              tagsManagedBy: 'openai-extractor',
              tagsUpdatedAt: new Date().toISOString()
            }
          }
        );
        
        this.log('Updated memory tags', { 
          memoryId, 
          tagCount: update.tags.length 
        });
      } catch (error) {
        this.log('Error updating memory tags', { error, memoryId });
      }
    }
    
    // Clear the updates
    this.memoryUpdates.clear();
  }
  
  /**
   * Log with tag extractor prefix
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`TagExtractor: ${message}`, data);
    } else {
      if (data?.error) {
        console.error(`TagExtractor: ${message}`, data);
      } else {
        console.log(`TagExtractor: ${message}`, data);
      }
    }
  }
} 