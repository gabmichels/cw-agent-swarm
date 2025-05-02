import { Message } from '../types';

/**
 * Smart search function for messages that supports:
 * - Fuzzy matching
 * - Misspelling tolerance
 * - Contextual relevance
 */
export function smartSearchMessages(
  messages: Message[],
  query: string,
  options: {
    threshold?: number; // Similarity threshold (0-1), where 1 is exact match
    caseSensitive?: boolean;
    includeMetadata?: boolean; // Search in message metadata
  } = {}
): Message[] {
  console.log(`smartSearchMessages called with query: "${query}" and ${messages.length} messages`);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning all messages');
    return messages;
  }

  const {
    threshold = 0.7,
    caseSensitive = false,
    includeMetadata = true
  } = options;

  // Normalize query
  const normalizedQuery = caseSensitive ? query.trim() : query.trim().toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 1);

  const results = messages.filter(message => {
    // Base content to search in
    const content = caseSensitive 
      ? (message.content || '') 
      : (message.content || '').toLowerCase();
    
    // For exact matches, prioritize these
    if (content.includes(normalizedQuery)) {
      return true;
    }

    // Check if each term is in the content with some flexibility
    const termMatches = queryTerms.map(term => {
      // Direct inclusion check
      if (content.includes(term)) {
        return 1; // Perfect match
      }

      // Fuzzy matching for potential misspellings
      return calculateFuzzyScore(content, term);
    });

    // Calculate average match score
    const averageScore = termMatches.reduce((sum, score) => sum + score, 0) / termMatches.length;
    
    // If we have metadata and need to search there too
    if (includeMetadata && message.metadata) {
      let metadataString = '';
      
      try {
        if (typeof message.metadata === 'string') {
          metadataString = message.metadata;
        } else {
          metadataString = JSON.stringify(message.metadata);
        }
        
        const normalizedMetadata = caseSensitive 
          ? metadataString 
          : metadataString.toLowerCase();
          
        // Check if query exists in metadata
        if (normalizedMetadata.includes(normalizedQuery)) {
          return true;
        }
        
        // Check term by term
        const metadataMatches = queryTerms.map(term => {
          if (normalizedMetadata.includes(term)) {
            return 1;
          }
          return calculateFuzzyScore(normalizedMetadata, term);
        });
        
        const metadataScore = metadataMatches.reduce((sum, score) => sum + score, 0) / metadataMatches.length;
        
        // Use the better score between content and metadata
        return Math.max(averageScore, metadataScore) >= threshold;
      } catch (e) {
        // If metadata parsing fails, fall back to content match only
        console.error('Error parsing message metadata for search:', e);
      }
    }

    // Return true if average score meets threshold
    return averageScore >= threshold;
  });
  
  console.log(`Search complete: ${results.length} of ${messages.length} messages matched`);
  return results;
}

/**
 * Calculate similarity between a string and a search term
 * Uses Levenshtein distance for edit distance
 */
function calculateFuzzyScore(text: string, term: string): number {
  // For very short terms, require more precise matching
  if (term.length <= 3) {
    return text.includes(term) ? 1 : 0;
  }

  // Quick contains check first
  if (text.includes(term)) {
    return 1;
  }

  // Check for substrings with one character different (common misspellings)
  for (let i = 0; i <= text.length - term.length; i++) {
    const substring = text.substring(i, i + term.length);
    const distance = levenshteinDistance(substring, term);
    
    // Allow for 1 edit per 4 characters of search term
    const maxAllowedDistance = Math.max(1, Math.floor(term.length / 4));
    
    if (distance <= maxAllowedDistance) {
      // Convert distance to similarity score (0-1)
      return 1 - (distance / term.length);
    }
  }

  return 0;
}

/**
 * Calculate the Levenshtein distance between two strings
 * Used for fuzzy matching and misspelling tolerance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a.charAt(j - 1) === b.charAt(i - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Helper to highlight matching text in search results
 */
export function highlightSearchMatches(
  text: string, 
  searchQuery: string,
  options: { 
    caseSensitive?: boolean,
    highlightClass?: string 
  } = {}
): string {
  if (!searchQuery || !text) return text;
  
  const { 
    caseSensitive = false, 
    highlightClass = 'bg-yellow-300 text-black rounded px-1'
  } = options;
  
  // No search - return original
  if (!searchQuery.trim()) return text;
  
  try {
    const normalizedText = caseSensitive ? text : text.toLowerCase();
    const normalizedQuery = caseSensitive ? searchQuery.trim() : searchQuery.trim().toLowerCase();
    const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);
    
    // Sort terms by length descending to match longest terms first
    terms.sort((a, b) => b.length - a.length);
    
    let result = text;
    let offsets = 0; // Track how much we're expanding the string with HTML tags
    
    for (const term of terms) {
      // For each term, find all occurrences in the normalized text
      let startPos = 0;
      let matchPos: number;
      
      while ((matchPos = normalizedText.indexOf(term, startPos)) !== -1) {
        // Calculate positions in the modified result text
        const resultMatchPos = matchPos + offsets;
        const matchEndPos = resultMatchPos + term.length;
        
        // Extract the exact original case from the text
        const originalMatch = result.substring(resultMatchPos, matchEndPos);
        
        // Replace with highlighted version
        const highlighted = `<span class="${highlightClass}">${originalMatch}</span>`;
        
        // Perform replacement
        result = 
          result.substring(0, resultMatchPos) + 
          highlighted + 
          result.substring(matchEndPos);
        
        // Update offsets and start position for next search
        offsets += highlighted.length - originalMatch.length;
        startPos = matchPos + term.length;
      }
    }
    
    return result;
  } catch (e) {
    console.error('Error highlighting search matches:', e);
    return text;
  }
} 