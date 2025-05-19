/**
 * TagExtractor Service
 * 
 * Uses OpenAI's cheaper model to extract tags from content.
 * This service is used for both user messages and AI responses.
 */

import OpenAI from 'openai';
import { ImportanceLevel } from '../constants/memory';

// Temporary interface definitions to fix missing imports
// Note: These should match the actual interfaces from the missing modules
interface ChatService {
  // Placeholder for the actual interface
}

interface LLMService {
  generateText(model: string, prompt: string): Promise<string>;
  generateStructuredOutput<T>(
    model: string, 
    prompt: string, 
    outputSchema: Record<string, unknown>
  ): Promise<T>;
}

// Define Tag interface that combines all needed properties
export interface Tag {
  text: string;
  confidence: number;
  relevance?: number; // Optional for backward compatibility
}

// Re-export Tag to maintain backward compatibility
export type { Tag as TagFromMemory } from '../lib/memory/TagExtractor';

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
  success?: boolean;
  error?: string;
  importance?: ImportanceLevel;
  reasoning?: string;
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
            Focus on document purpose, core concepts, important topics, entities, and themes.
            
            Rules:
            - Always identify and tag the core document type/purpose (e.g., "mission", "policy", "product description")
            - Create compound tags for core concepts (e.g., "company mission", "privacy policy", "user guide")
            - Extract between 3 and ${maxTags} tags maximum
            - Single-word tags should identify key topics
            - Two-word tags should capture important concepts or relationships
            - No more than two words per tag
            - No hashtags or special characters in tags
            - Make sure tags are in lowercase
            - Return only the most relevant and specific tags
            - If there are already existing tags, try to build upon them with complementary tags
            - If the document has a title or headers, prioritize concepts from these sections
            - For documents with markdown formatting, identify the document type based on headers
            - For technical content, include technical terms as tags
            - For conversational content, focus on the main topics and intent
            - Return the tags with confidence scores between 0.0 and 1.0
            
            Format your response as a JSON object with a "tags" array. Each tag in the array should be an object with "text" and "confidence" properties.`
          },
          {
            role: "user" as const,
            content: `Extract tags from the following text and return them as JSON. ${existingTagsText}
            
            TEXT:
            ${truncatedContent}
            
            Return the extracted tags in JSON format with the following structure:
            {
              "tags": [
                {"text": "example tag", "confidence": 0.9},
                {"text": "another tag", "confidence": 0.7}
              ]
            }`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) / 10 : 500
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
 * IMPORTANT: Do not rename or change the signature of this function
 * as it's used by other parts of the codebase
 */
export async function extractTags(content: string, options?: TagExtractionOptions): Promise<TagExtractionResult> {
  return tagExtractor.extractTags(content, options);
}

/**
 * Mock LLM service instance for testing
 * In a production environment, this would be a real LLM service
 */
class MockLLMService implements LLMService {
  async generateText(model: string, prompt: string): Promise<string> {
    return "Default LLM response";
  }
  
  async generateStructuredOutput<T>(
    model: string, 
    prompt: string, 
    outputSchema: Record<string, unknown>
  ): Promise<T> {
    // For testing purposes, we'll extract some basic tags
    // In production, this would be a real LLM call
    const lowerPrompt = prompt.toLowerCase();
    
    const tags: Tag[] = [];
    
    // Extract potential tags based on common keywords
    if (lowerPrompt.includes('budget') || lowerPrompt.includes('money') || lowerPrompt.includes('cost')) {
      tags.push({ text: 'budget', confidence: 0.8, relevance: 0.9 });
      tags.push({ text: 'finance', confidence: 0.7, relevance: 0.7 });
    }
    
    if (lowerPrompt.includes('marketing') || lowerPrompt.includes('advertis')) {
      tags.push({ text: 'marketing', confidence: 0.9, relevance: 0.9 });
    }
    
    if (lowerPrompt.includes('competitor') || lowerPrompt.includes('competition') || lowerPrompt.includes('landscape')) {
      tags.push({ text: 'competition', confidence: 0.8, relevance: 0.9 });
      tags.push({ text: 'landscape', confidence: 0.7, relevance: 0.8 });
    }
    
    if (lowerPrompt.includes('status') || lowerPrompt.includes('progress') || lowerPrompt.includes('where') || lowerPrompt.includes('how far')) {
      tags.push({ text: 'status', confidence: 0.7, relevance: 0.8 });
    }
    
    // Add default tags if none were found
    if (tags.length === 0) {
      // Split the query into words and use the most significant words as tags
      const words = lowerPrompt.split(/\s+/);
      const significantWords = words.filter(word => 
        word.length > 3 && 
        !['what', 'when', 'where', 'which', 'how', 'why', 'who', 'will', 'can', 'could', 'should', 'would', 'about', 'with', 'from', 'that', 'this', 'these', 'those', 'their', 'they'].includes(word)
      );
      
      // Use up to 3 significant words as tags
      significantWords.slice(0, 3).forEach(word => {
        tags.push({ text: word, confidence: 0.5, relevance: 0.6 });
      });
    }
    
    return {
      tags,
      importance: ImportanceLevel.MEDIUM,
      reasoning: "Extracted based on keyword matching."
    } as unknown as T;
  }
}

// Create a singleton instance of the LLM service
const llmService = new MockLLMService();

/**
 * This method is kept distinct from extractTags to avoid naming conflicts
 * while maintaining backwards compatibility
 */
export async function extractQueryTags(query: string): Promise<TagExtractionResult> {
  try {
    // Define the schema for tag extraction
    const outputSchema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              relevance: { type: "number" },
              confidence: { type: "number" }
            },
            required: ["text"]
          }
        },
        importance: { type: "string", enum: Object.values(ImportanceLevel) },
        reasoning: { type: "string" }
      },
      required: ["tags"]
    };
    
    // Prompt for extracting tags
    const prompt = `
      Extract the most relevant tags from the following query:
      "${query}"
      
      Return 2-5 tags that best represent what the user is asking about.
      These tags will be used for memory retrieval, so they should match potential memory categories.
      
      For example, if the query is "What is our marketing budget?", appropriate tags might be:
      - "marketing"
      - "budget"
      - "finance"
      
      Also determine the importance level of this query (LOW, MEDIUM, HIGH, or CRITICAL).
    `;
    
    // Use the LLM service to extract tags
    const result = await llmService.generateStructuredOutput<TagExtractionResult>(
      "claude-3-opus-20240229",
      prompt,
      outputSchema
    );
    
    return result;
  } catch (error) {
    console.error("Error extracting tags:", error);
    
    // Return a default extraction result on error
    return {
      tags: [],
      success: false,
      importance: ImportanceLevel.MEDIUM,
      reasoning: "Failed to extract tags due to an error."
    };
  }
} 