import { ImportanceLevel, MemorySource, ChloeMemoryType } from '../../constants/memory';

/**
 * Interface for metadata required for importance calculation
 */
export interface ImportanceMetadata {
  content: string;
  source?: MemorySource;
  type?: string | ChloeMemoryType;
  tags?: string[];
  tagConfidence?: number;
  embedding?: number[];
  length?: number;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Calculates and manages importance scores for memory entries
 * Provides a unified approach to importance calculation across the system
 */
export class ImportanceCalculator {
  // Centralized importance weights - these could be adjusted by learning over time
  private static weights = {
    // Source type weights
    sourceWeights: {
      [MemorySource.FILE]: 0.9,      // Files (especially markdown) are high importance
      [MemorySource.USER]: 0.7,      // User input is high importance
      [MemorySource.AGENT]: 0.5,     // Agent-generated content is medium importance
      [MemorySource.SYSTEM]: 0.6,    // System information is medium-high importance
      [MemorySource.EXTERNAL]: 0.5,  // External content varies in importance
    },
    
    // Importance factors and their relative weights in the calculation
    contentLength: 0.15,      // Longer content tends to be more important (up to a point)
    tagConfidence: 0.25,      // Higher confidence in tags suggests more relevant/important content
    embeddingCentrality: 0.2, // Higher similarity to core concepts indicates importance
    keywordPresence: 0.3,     // Presence of important keywords
    recency: 0.1,             // More recent memories may be more relevant in some cases
  };
  
  // Core importance keywords that indicate criticality in content
  private static importanceKeywords = {
    critical: [
      'urgent', 'critical', 'emergency', 'immediate', 'crucial', 'vital',
      'security', 'breach', 'violation', 'danger', 'threat', 'risk'
    ],
    high: [
      'important', 'significant', 'key', 'essential', 'remember', 'priority',
      'deadline', 'required', 'necessary', 'needed', 'mandate'
    ],
    medium: [
      'relevant', 'useful', 'helpful', 'informative', 'valuable', 'worth', 
      'consider', 'note', 'remember'
    ],
    low: [
      'minor', 'trivial', 'optional', 'later', 'fyi', 'suggestion', 
      'thought', 'idea', 'maybe', 'perhaps'
    ]
  };
  
  // Core concept embeddings - these would be updated over time as the system learns
  private static coreConcepts: number[][] = [];
  
  /**
   * Calculate the importance score for a memory entry
   * 
   * @param data The memory data needed for importance calculation
   * @returns A normalized importance score between 0 and 1
   */
  public static calculateImportanceScore(data: ImportanceMetadata): number {
    // Special handling for markdown files - always critical
    if (data.source === MemorySource.FILE && 
        (data.metadata?.contentType === 'markdown' || data.metadata?.fileType === 'md')) {
      return 1.0; // Maximum importance
    }
    
    let score = 0;
    const weights = this.weights;
    
    // 1. Source type weight
    if (data.source && this.weights.sourceWeights[data.source]) {
      score += this.weights.sourceWeights[data.source] * 0.2; // 20% influence from source type
    }
    
    // 2. Content length factor - normalize against an expected maximum length
    if (data.content) {
      const contentLength = data.length || data.content.length;
      // Normalize: longer is better, up to ~1000 chars, then diminishing returns
      const normalizedLength = Math.min(contentLength / 1000, 1.5);
      score += normalizedLength * weights.contentLength;
    }
    
    // 3. Keyword importance - check for presence of important keywords
    const keywordScore = this.calculateKeywordScore(data.content || '');
    score += keywordScore * weights.keywordPresence;
    
    // 4. Tag confidence - higher confidence in tags suggests more relevant content
    if (data.tagConfidence !== undefined) {
      score += data.tagConfidence * weights.tagConfidence;
    }
    
    // 5. Embedding centrality - how close this memory is to core concepts
    if (data.embedding && this.coreConcepts.length > 0) {
      const centralityScore = this.calculateEmbeddingCentrality(data.embedding);
      score += centralityScore * weights.embeddingCentrality;
    }
    
    // 6. Recency factor - more recent memories may be more important in some contexts
    if (data.createdAt) {
      const ageInDays = (Date.now() - data.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      // Newer content gets a recency boost, with diminishing returns after 30 days
      const recencyScore = Math.max(0, 1 - (ageInDays / 30));
      score += recencyScore * weights.recency;
    }
    
    // Ensure the score is normalized between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Convert a numeric importance score to an ImportanceLevel enum value
   * 
   * @param score Numeric importance score (0-1)
   * @returns The corresponding ImportanceLevel
   */
  public static scoreToImportanceLevel(score: number): ImportanceLevel {
    if (score >= 0.8) {
      return ImportanceLevel.CRITICAL;
    } else if (score >= 0.6) {
      return ImportanceLevel.HIGH;
    } else if (score >= 0.3) {
      return ImportanceLevel.MEDIUM;
    } else {
      return ImportanceLevel.LOW;
    }
  }
  
  /**
   * Calculate a score based on presence of important keywords
   * 
   * @param content The text content to analyze
   * @returns A score between 0 and 1 based on keyword presence
   */
  private static calculateKeywordScore(content: string): number {
    if (!content) return 0;
    
    const lowercaseContent = content.toLowerCase();
    let score = 0;
    
    // Check for critical keywords - these have the highest weight
    const criticalMatches = this.importanceKeywords.critical.filter(
      keyword => lowercaseContent.includes(keyword)
    ).length;
    if (criticalMatches > 0) {
      score += Math.min(criticalMatches / 2, 1) * 0.8; // 80% weight for critical keywords
    }
    
    // Check for high importance keywords
    const highMatches = this.importanceKeywords.high.filter(
      keyword => lowercaseContent.includes(keyword)
    ).length;
    if (highMatches > 0) {
      score += Math.min(highMatches / 3, 1) * 0.6; // 60% weight for high importance
    }
    
    // Check for medium importance keywords
    const mediumMatches = this.importanceKeywords.medium.filter(
      keyword => lowercaseContent.includes(keyword)
    ).length;
    if (mediumMatches > 0) {
      score += Math.min(mediumMatches / 4, 1) * 0.3; // 30% weight for medium importance
    }
    
    // Apply a penalty for low importance keywords
    const lowMatches = this.importanceKeywords.low.filter(
      keyword => lowercaseContent.includes(keyword)
    ).length;
    if (lowMatches > 0) {
      score -= Math.min(lowMatches / 4, 0.5) * 0.2; // 20% penalty for low importance keywords
    }
    
    // Ensure score is within 0-1 range
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate embedding centrality - how closely this embedding matches to core concepts
   * 
   * @param embedding The embedding vector to evaluate
   * @returns A centrality score between 0 and 1
   */
  private static calculateEmbeddingCentrality(embedding: number[]): number {
    if (this.coreConcepts.length === 0) {
      return 0.5; // Default middle score if we have no core concepts yet
    }
    
    // Calculate cosine similarity to each core concept
    const similarities = this.coreConcepts.map(conceptEmbedding => 
      this.cosineSimilarity(embedding, conceptEmbedding)
    );
    
    // Return the highest similarity score to any core concept
    return Math.max(...similarities);
  }
  
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
  
  /**
   * Add a new core concept embedding to the system
   * This allows the system to learn what's important over time
   * 
   * @param embedding The embedding to add as a core concept
   */
  public static addCoreConcept(embedding: number[]): void {
    this.coreConcepts.push([...embedding]); // Clone the array
    
    // Limit the number of core concepts to prevent computational overhead
    if (this.coreConcepts.length > 50) {
      this.coreConcepts.shift(); // Remove the oldest concept
    }
  }
  
  /**
   * Update the weights used in importance calculation
   * This allows the system to adjust its importance model over time
   * 
   * @param newWeights The new weights to apply (partial updates allowed)
   */
  public static updateWeights(newWeights: Partial<typeof ImportanceCalculator.weights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }
} 