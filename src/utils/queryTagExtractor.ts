/**
 * Query Tag Extraction Utility
 * 
 * This module extracts relevant tags from user queries to improve memory retrieval.
 */

import { ImportanceLevel } from '../constants/memory';

/**
 * Interface for tag extraction result
 */
export interface TagExtractionResult {
  tags: QueryTag[];
  importance: ImportanceLevel;
  reasoning: string;
}

/**
 * Interface for a single query tag
 */
export interface QueryTag {
  text: string;
  relevance: number; // 0-1 score of tag relevance
  confidence: number; // 0-1 score of extraction confidence
}

/**
 * Mock LLM service interface
 */
interface SimpleLLMService {
  generateStructuredOutput<T>(
    model: string, 
    prompt: string, 
    outputSchema: Record<string, unknown>
  ): Promise<T>;
}

/**
 * Simple mock LLM service for tag extraction
 */
class MockTagExtractor implements SimpleLLMService {
  async generateStructuredOutput<T>(
    model: string, 
    prompt: string, 
    outputSchema: Record<string, unknown>
  ): Promise<T> {
    // For testing and development, we'll extract tags based on simple pattern matching
    const lowerPrompt = prompt.toLowerCase();
    
    const tags: QueryTag[] = [];
    
    // Extract potential tags based on common keywords
    if (lowerPrompt.includes('budget') || lowerPrompt.includes('money') || lowerPrompt.includes('cost')) {
      tags.push({ text: 'budget', relevance: 0.9, confidence: 0.8 });
      tags.push({ text: 'finance', relevance: 0.7, confidence: 0.7 });
    }
    
    if (lowerPrompt.includes('marketing') || lowerPrompt.includes('advertis')) {
      tags.push({ text: 'marketing', relevance: 0.9, confidence: 0.9 });
    }
    
    if (lowerPrompt.includes('competitor') || lowerPrompt.includes('competition') || lowerPrompt.includes('landscape')) {
      tags.push({ text: 'competition', relevance: 0.9, confidence: 0.8 });
      tags.push({ text: 'landscape', relevance: 0.8, confidence: 0.7 });
    }
    
    if (lowerPrompt.includes('status') || lowerPrompt.includes('progress') || lowerPrompt.includes('where') || lowerPrompt.includes('how far')) {
      tags.push({ text: 'status', relevance: 0.8, confidence: 0.7 });
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
        tags.push({ text: word, relevance: 0.6, confidence: 0.5 });
      });
    }
    
    return {
      tags,
      importance: ImportanceLevel.MEDIUM,
      reasoning: "Extracted based on keyword matching."
    } as unknown as T;
  }
}

// Create a singleton instance of the tag extractor
const tagExtractor = new MockTagExtractor();

/**
 * Extract tags from a user query
 * @param query The query text to extract tags from
 * @returns Promise resolving to extraction result with tags and metadata
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
    
    // Use the mock tag extractor to extract tags
    return await tagExtractor.generateStructuredOutput<TagExtractionResult>(
      "mock-model",
      query,
      outputSchema
    );
  } catch (error) {
    console.error("Error extracting query tags:", error);
    
    // Return a default extraction result on error
    return {
      tags: [],
      importance: ImportanceLevel.MEDIUM,
      reasoning: "Failed to extract tags due to an error."
    };
  }
} 