import { MemoryRecord } from './index';
import { TagExtractor } from '../../lib/memory/TagExtractor';
import { ImportanceCalculator } from '../../lib/memory/ImportanceCalculator';

/**
 * Extended memory record with score information
 */
export interface ScoredMemoryRecord extends MemoryRecord {
  score: number;
  metadata: Record<string, any>; // Explicitly define metadata to ensure it exists
}

/**
 * Apply tag-based boosting to search results
 * 
 * @param results The original search results
 * @param queryTags Tags extracted from the query
 * @returns Boosted search results
 */
export function applyTagBoosting(
  results: ScoredMemoryRecord[], 
  queryTags: string[]
): ScoredMemoryRecord[] {
  if (!results || results.length === 0 || !queryTags || queryTags.length === 0) {
    return results;
  }
  
  // Apply tag-based boosting
  const boostedResults = results.map(result => {
    const memoryTags = result.metadata?.tags || [];
    
    // Calculate tag overlap boost factor
    const tagBoostFactor = ImportanceCalculator.calculateTagBoostFactor(
      queryTags, 
      memoryTags as string[]
    );
    
    // Apply the tag boost to the score
    return {
      ...result,
      score: result.score * tagBoostFactor
    };
  });
  
  // Re-sort by adjusted score
  boostedResults.sort((a, b) => b.score - a.score);
  
  return boostedResults;
}

/**
 * Extract tags from a search query
 * 
 * @param query The search query
 * @returns Extracted tags
 */
export function extractTagsFromQuery(query: string): string[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  // Extract tags from the query using RAKE algorithm (better for short text)
  const extractedTags = TagExtractor.extractTags(query, {
    algorithm: 'rake' as any, // Using RAKE for short queries
    maxTags: 5,
    minConfidence: 0.2
  });
  
  return extractedTags.map(tag => tag.text);
} 