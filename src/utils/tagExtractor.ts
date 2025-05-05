/**
 * TagExtractor Service
 * 
 * Uses OpenAI's cheaper model to extract tags from content.
 * This service is used for both user messages and AI responses.
 */

import OpenAI from 'openai';
import { Tag } from '../lib/memory/TagExtractor';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get model from environment or use default
const CHEAP_MODEL = process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14';

/**
 * Tag extraction result
 */
export interface TagExtractionResult {
  tags: Tag[];
  success: boolean;
  error?: string;
}

/**
 * Options for tag extraction
 */
export interface TagExtractionOptions {
  maxTags?: number;
  minConfidence?: number;
  model?: string;
  existingTags?: string[];
}

/**
 * Memory tag extractor service
 */
export class OpenAITagExtractor {
  private static instance: OpenAITagExtractor;
  private extractionCache: Map<string, TagExtractionResult>;
  private model: string;
  
  /**
   * Create a new tag extractor instance
   */
  private constructor() {
    this.extractionCache = new Map();
    this.model = CHEAP_MODEL;
    console.log(`Initialized OpenAI Tag Extractor with model: ${this.model}`);
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): OpenAITagExtractor {
    if (!OpenAITagExtractor.instance) {
      OpenAITagExtractor.instance = new OpenAITagExtractor();
    }
    return OpenAITagExtractor.instance;
  }
  
  /**
   * Extract tags from content using OpenAI
   * 
   * @param content Text to extract tags from
   * @param options Extraction options
   * @returns Tag extraction result
   */
  public async extractTags(
    content: string,
    options: TagExtractionOptions = {}
  ): Promise<TagExtractionResult> {
    try {
      // Use shorter content for caching to avoid memory issues
      const cacheKey = this.generateCacheKey(content, options);
      
      // Check if we have a cached result
      if (this.extractionCache.has(cacheKey)) {
        return this.extractionCache.get(cacheKey)!;
      }
      
      // Maximum content length to avoid token limit issues
      const truncatedContent = content.length > 8000 
        ? content.substring(0, 8000) + "..." 
        : content;
      
      // Configure options
      const maxTags = options.maxTags || 10;
      const minConfidence = options.minConfidence || 0.3;
      const modelToUse = options.model || this.model;
      
      // Create the existing tags string if needed
      let existingTagsText = "";
      if (options.existingTags && options.existingTags.length > 0) {
        existingTagsText = `These tags already exist: ${options.existingTags.join(', ')}`;
      }
      
      // Call OpenAI to extract tags
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system" as const,
            content: `You are a tag extraction system. Extract the most relevant tags or keywords from the provided text. 
            Focus on important topics, concepts, entities, and themes.
            
            Rules:
            - Extract between 3 and ${maxTags} tags maximum
            - Tags should be 1-3 words at most
            - No hashtags or special characters in tags
            - Make sure tags are in lowercase
            - Return only the most relevant and specific tags
            - If there are already existing tags, try to build upon them with complementary tags
            - For very short messages, extract fewer but more precise tags
            - For technical content, include technical terms as tags
            - For conversational content, focus on the main topics and intent
            - Return the tags with confidence scores between 0.0 and 1.0`
          },
          {
            role: "user" as const,
            content: `Extract tags from the following text. ${existingTagsText}
            
            TEXT:
            ${truncatedContent}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 500
      });
      
      // Parse the response
      const output = response.choices[0]?.message?.content || '{}';
      
      let responseJson;
      try {
        responseJson = JSON.parse(output);
      } catch (error) {
        console.error('Error parsing OpenAI response:', error);
        console.log('Raw response:', output);
        responseJson = { tags: [] };
      }
      
      // Format tags with confidence scores
      const tags: Tag[] = this.formatTags(responseJson, minConfidence);
      
      const result: TagExtractionResult = {
        tags,
        success: true
      };
      
      // Store in cache
      this.extractionCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error extracting tags with OpenAI:', error);
      return {
        tags: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Normalize a tag to ensure consistent formatting
   * - Convert to lowercase
   * - Trim whitespace
   * - Replace multiple spaces with single space
   * - Remove special characters
   * - Truncate to reasonable length (max 30 chars)
   * - Use consistent format for multi-word tags (using spaces, not underscores)
   */
  private normalizeTag(tagText: string): string {
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
   * Format tags from the API response
   */
  private formatTags(responseJson: any, minConfidence: number): Tag[] {
    if (!Array.isArray(responseJson.tags)) {
      return [];
    }
    
    // First pass: normalize all tags
    const normalizedTags: Tag[] = responseJson.tags
      .map((tag: any) => {
        // Handle different possible formats from the AI
        if (typeof tag === 'string') {
          return {
            text: this.normalizeTag(tag),
            confidence: 0.8
          };
        } else if (typeof tag === 'object') {
          const tagText = tag.text || tag.tag || tag.name || '';
          return {
            text: this.normalizeTag(tagText),
            confidence: tag.confidence || tag.score || 0.8
          };
        }
        return null;
      })
      .filter((tag: Tag | null): tag is Tag => 
        tag !== null && 
        typeof tag.text === 'string' && 
        tag.text.length > 0 && 
        tag.confidence >= minConfidence
      );
    
    // Second pass: remove duplicates while keeping highest confidence
    const uniqueTags = new Map<string, Tag>();
    
    for (const tag of normalizedTags) {
      // If we haven't seen this tag or this one has higher confidence
      if (!uniqueTags.has(tag.text) || uniqueTags.get(tag.text)!.confidence < tag.confidence) {
        uniqueTags.set(tag.text, tag);
      }
    }
    
    // Convert map back to array and sort by confidence
    return Array.from(uniqueTags.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate a cache key for the content and options
   */
  private generateCacheKey(content: string, options: TagExtractionOptions): string {
    // Use first 100 chars + last 100 chars + content length as cache key
    const startContent = content.substring(0, 100);
    const endContent = content.substring(Math.max(0, content.length - 100));
    const contentKey = `${startContent}...${endContent}:${content.length}`;
    
    // Create an options string
    const maxTags = options.maxTags || 10;
    const minConfidence = options.minConfidence || 0.3;
    
    // Get existing tags as a string, or empty if none
    let existingTagsStr = '';
    
    // Check if existingTags is defined and not empty
    const hasExistingTags = options.existingTags !== undefined && options.existingTags.length > 0;
    
    if (hasExistingTags && options.existingTags) {
      existingTagsStr = options.existingTags.join(',');
    }
    
    const optionsKey = `${maxTags}:${minConfidence}:${existingTagsStr}`;
    
    return `${contentKey}:${optionsKey}`;
  }
}

// Export singleton instance
export const tagExtractor = OpenAITagExtractor.getInstance();

/**
 * Extract tags from content
 * Convenience function to use the singleton instance
 */
export async function extractTags(content: string, options?: TagExtractionOptions): Promise<TagExtractionResult> {
  return tagExtractor.extractTags(content, options);
} 