/**
 * Advanced retrieval services and components
 */

export * from './QueryEnhancer';
export * from './ResultReranker';

/**
 * Evaluates RAG system quality
 */
export interface RAGEvaluationOptions {
  /**
   * Query used for retrieval
   */
  query: string;
  
  /**
   * Retrieved context
   */
  retrievedContext: string[];
  
  /**
   * Generated response using the context
   */
  generatedResponse: string;
  
  /**
   * Known ground truth (if available)
   */
  groundTruth?: string;
  
  /**
   * Metrics to evaluate
   */
  metrics: ('relevance' | 'faithfulness' | 'informativeness' | 'diversity' | 'coverage')[];
}

/**
 * Results of RAG evaluation
 */
export interface RAGEvaluationResult {
  /**
   * Overall RAG quality score (0-1)
   */
  overallScore: number;
  
  /**
   * Individual metric scores
   */
  metricScores: {
    /**
     * Relevance of context to query (0-1)
     */
    relevance?: number;
    
    /**
     * Faithfulness of response to context (0-1)
     */
    faithfulness?: number;
    
    /**
     * Informativeness of response (0-1)
     */
    informativeness?: number;
    
    /**
     * Diversity of context (0-1)
     */
    diversity?: number;
    
    /**
     * Coverage of relevant information (0-1)
     */
    coverage?: number;
  };
  
  /**
   * Utilization metrics
   */
  utilization?: {
    /**
     * Percentage of context used in response
     */
    contextUtilization: number;
    
    /**
     * Percentage of response supported by context
     */
    responseSupport: number;
  };
  
  /**
   * Feedback for improvement
   */
  feedback?: string;
}

/**
 * Advanced retrieval components for the thinking system
 * 
 * These components provide:
 * 1. Query enhancement through expansion, variation, and structured extraction
 * 2. Result reranking for better relevance and diversity
 * 3. Source attribution and citation tracking
 * 4. Evaluation metrics for retrieval quality
 */
export class RAGSystem {
  /**
   * Integrate these components with the thinking system
   * @param ThinkingService Service to extend with RAG capabilities
   */
  static enhanceThinkingService(ThinkingService: any): void {
    console.log('Enhancing thinking service with advanced RAG capabilities');
    // This is a placeholder - in a real implementation, this would
    // modify the ThinkingService to use these RAG components
  }
} 