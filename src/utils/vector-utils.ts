/**
 * Vector utility functions
 * 
 * This file contains helper functions for vector operations
 * used by the memory and knowledge graph systems.
 */

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param vector1 First vector
 * @param vector2 Second vector
 * @returns Similarity score between 0 and 1
 */
export function computeCosineSimilarity(vector1: number[], vector2: number[]): number {
  // Check if vectors are valid
  if (!vector1 || !vector2 || vector1.length === 0 || vector2.length === 0) {
    return 0;
  }
  
  // Vectors must be the same length
  if (vector1.length !== vector2.length) {
    console.error(`Vector dimensions don't match: ${vector1.length} vs ${vector2.length}`);
    return 0;
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Check for zero magnitudes to avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Return normalized similarity (0-1)
  return dotProduct / (magnitude1 * magnitude2);
} 