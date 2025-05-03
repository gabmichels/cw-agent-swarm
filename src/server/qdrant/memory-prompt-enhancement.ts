/**
 * Memory-based system prompt enhancement utilities
 * 
 * These functions handle extracting relevant memories and injecting them
 * into system prompts for improved contextual responses.
 */

import { 
  searchMemory, 
  MemoryRecord,
  ScoredMemoryRecord
} from './index';
import { markMemoriesAsUsed } from './memory-utils';
import { Tag, TagExtractor, TagAlgorithm } from '../../lib/memory/TagExtractor';

/**
 * Configuration options for memory context injection
 */
export interface MemoryContextOptions {
  /** Minimum confidence score for memories to be included (0-1) */
  confidenceThreshold?: number;
  /** Maximum number of memories to include */
  maxMemories?: number;
  /** Maximum length of each memory summary in characters */
  maxSummaryLength?: number;
  /** Whether to track memories that were used */
  trackUsage?: boolean;
  /** How to format the memory context */
  formatType?: 'basic' | 'detailed' | 'minimal';
  /** Memory types to include in search */
  memoryTypes?: string[];
}

/**
 * Generate a summary of a memory record suitable for including in a prompt
 * 
 * @param memory The memory record to summarize
 * @param maxLength Maximum length of the summary
 * @returns A summarized version of the memory
 */
export function summarizeMemory(memory: MemoryRecord, maxLength: number = 150): string {
  // Extract the content of the memory
  const content = memory.text || '';
  
  // If it's already shorter than the max length, just return it
  if (content.length <= maxLength) {
    return content;
  }
  
  // Basic truncation with ellipsis
  return content.substring(0, maxLength - 3) + '...';
  
  // NOTE: A more sophisticated approach could use an LLM to generate
  // a true summary, but that would add latency and complexity.
  // This simple approach is fast and works well enough for many cases.
}

/**
 * Extract key terms from a user message for better memory search
 * 
 * @param message User message text
 * @returns Array of extracted key terms
 */
export function extractKeyTerms(message: string): string[] {
  // Use the TagExtractor to identify key terms
  const extractedTags = TagExtractor.extractTags(message, {
    algorithm: TagAlgorithm.RAKE, // RAKE works well for extracting key phrases
    maxTags: 8,
    minConfidence: 0.2,
    useStemming: true
  });
  
  // Return just the text of each tag
  return extractedTags.map(tag => tag.text);
}

/**
 * Search for relevant memories based on a user message
 * 
 * @param message User message to find relevant memories for
 * @param options Configuration options
 * @returns Relevant memories with scores
 */
export async function findRelevantMemories(
  message: string,
  options: MemoryContextOptions = {}
): Promise<ScoredMemoryRecord[]> {
  // Set default options
  const confidenceThreshold = options.confidenceThreshold || 0.75;
  const maxMemories = options.maxMemories || 3;
  const memoryTypes = options.memoryTypes || ['document', 'message', 'thought'];
  
  // Extract key terms from the message
  const keyTerms = extractKeyTerms(message);
  console.log(`Extracted key terms: ${keyTerms.join(', ')}`);
  
  // For each memory type, search for relevant memories
  let allResults: ScoredMemoryRecord[] = [];
  
  for (const type of memoryTypes) {
    // Search using the message and key terms
    const results = await searchMemory(type as any, message, {
      limit: maxMemories * 2 // Get more than we need to allow for filtering
    });
    
    // Apply hybrid scoring to convert MemoryRecord[] to ScoredMemoryRecord[]
    const scoredResults = results.map(result => ({
      ...result,
      score: 'score' in result ? result.score : 0
    })) as ScoredMemoryRecord[];
    
    // Then combine with allResults
    allResults = [...allResults, ...scoredResults];
  }
  
  // Filter by confidence threshold and sort by score
  const filteredResults = allResults
    .filter(memory => {
      // Use the adjusted score for confidence threshold
      const score = memory.score || 0;
      return score >= confidenceThreshold;
    })
    .sort((a, b) => b.score - a.score);
  
  // Take just the top results
  return filteredResults.slice(0, maxMemories);
}

/**
 * Create a memory context block for enhancing system prompts
 * 
 * @param memories Array of relevant memories
 * @param options Configuration options
 * @returns Formatted memory context string
 */
export function formatMemoryContext(
  memories: ScoredMemoryRecord[],
  options: MemoryContextOptions = {}
): string {
  if (!memories || memories.length === 0) {
    return '';
  }
  
  // Set default options
  const maxSummaryLength = options.maxSummaryLength || 150;
  const formatType = options.formatType || 'basic';
  
  // Different format types for different use cases
  switch (formatType) {
    case 'detailed':
      return `Based on your previous knowledge and these relevant memories:\n\n${
        memories.map((memory, i) => {
          const summary = summarizeMemory(memory, maxSummaryLength);
          const source = memory.metadata?.source || 'unknown';
          const score = memory.score ? ` (confidence: ${memory.score.toFixed(2)})` : '';
          return `Memory ${i + 1}${score}: "${summary}" (Source: ${source})`;
        }).join('\n\n')
      }`;
    
    case 'minimal':
      return `Relevant context: ${
        memories.map(memory => summarizeMemory(memory, maxSummaryLength)).join('; ')
      }`;
    
    case 'basic':
    default:
      return `Based on related prior knowledge: ${
        memories.map(memory => summarizeMemory(memory, maxSummaryLength)).join(', ')
      }`;
  }
}

/**
 * Enhance a system prompt with relevant memory context
 * 
 * @param systemPrompt Original system prompt
 * @param userMessage Latest user message
 * @param options Configuration options
 * @returns Enhanced system prompt and used memories
 */
export async function enhancePromptWithMemoryContext(
  systemPrompt: string,
  userMessage: string,
  options: MemoryContextOptions = {}
): Promise<{
  enhancedPrompt: string;
  usedMemories: ScoredMemoryRecord[];
}> {
  try {
    // Set default options
    const trackUsage = options.trackUsage !== false; // Default to true
    
    // Find relevant memories
    const relevantMemories = await findRelevantMemories(userMessage, options);
    
    // If no relevant memories meet the threshold, return the original prompt
    if (!relevantMemories || relevantMemories.length === 0) {
      return {
        enhancedPrompt: systemPrompt,
        usedMemories: []
      };
    }
    
    // Format the memory context
    const memoryContext = formatMemoryContext(relevantMemories, options);
    
    // Enhance the system prompt with memory context
    const enhancedPrompt = `${systemPrompt}\n\n${memoryContext}`;
    
    // Track memory usage if enabled
    if (trackUsage) {
      const memoryIds = relevantMemories.map(m => m.id);
      await markMemoriesAsUsed(memoryIds, 'prompt_enhancement');
    }
    
    // Return enhanced prompt and used memories
    return {
      enhancedPrompt,
      usedMemories: relevantMemories
    };
  } catch (error) {
    console.error('Error enhancing prompt with memory context:', error);
    // On error, return the original prompt
    return {
      enhancedPrompt: systemPrompt,
      usedMemories: []
    };
  }
} 