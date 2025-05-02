import { OpenAI } from 'openai';
import { MemoryEntry } from './MemoryRouter';
import { logger } from '../../../lib/logging';

/**
 * Enhanced reranker result with confidence and validation info
 */
export interface RerankerResult {
  entries: MemoryEntry[];
  confidenceThresholdMet: boolean;
  topScore?: number;
  validationResult?: {
    isValid: boolean;
    reason?: string;
  };
}

/**
 * Service for reranking search results based on relevance to a query
 */
export class RerankerService {
  private model: OpenAI | null = null;
  private modelName: string;
  private maxBatchSize: number = 10;
  private confidenceThreshold: number = 70; // Default confidence threshold

  constructor(options: { 
    modelName?: string;
    openAIApiKey?: string;
    maxBatchSize?: number;
    confidenceThreshold?: number;
  } = {}) {
    this.modelName = options.modelName || process.env.OPENAI_CHEAP_MODEL || 'gpt-4o-mini';
    this.maxBatchSize = options.maxBatchSize || 10;
    this.confidenceThreshold = options.confidenceThreshold || 70;
    
    // Initialize OpenAI client if we're server-side
    if (typeof window === 'undefined') {
      const apiKey = options.openAIApiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        this.model = new OpenAI({ apiKey });
      }
    }
  }

  /**
   * Rerank memory entries based on relevance to query
   * @param query The user query
   * @param entries The candidate memory entries
   * @param options Options for reranking
   * @returns Reranked memory entries with scores
   */
  async rerank(
    query: string, 
    entries: MemoryEntry[], 
    options: { 
      debug?: boolean;
      returnScores?: boolean;
      confidenceThreshold?: number;
    } = {}
  ): Promise<MemoryEntry[]> {
    // Use enhanced version with confidence check but maintain backward compatibility
    const result = await this.rerankWithConfidence(query, entries, options);
    return result.entries;
  }
  
  /**
   * Enhanced reranking with confidence threshold checking
   * @param query The user query
   * @param entries The candidate memory entries
   * @param options Options for reranking
   * @returns Reranked results with confidence validation
   */
  async rerankWithConfidence(
    query: string, 
    entries: MemoryEntry[], 
    options: { 
      debug?: boolean;
      returnScores?: boolean;
      confidenceThreshold?: number; 
      validateContent?: boolean;
    } = {}
  ): Promise<RerankerResult> {
    // Set confidence threshold from options or use default
    const confidenceThreshold = options.confidenceThreshold || this.confidenceThreshold;
    
    // Default result with no confidence
    const emptyResult: RerankerResult = {
      entries: [],
      confidenceThresholdMet: false
    };
    
    if (!this.model) {
      logger.warn('Reranker: No model available, returning entries in original order');
      return {
        entries,
        confidenceThresholdMet: false
      };
    }
    
    if (!entries || entries.length === 0) {
      return emptyResult;
    }
    
    // If we have only one entry, evaluate its relevance
    if (entries.length === 1) {
      const relevance = await this.evaluateSingleEntryRelevance(query, entries[0]);
      
      // Add score to metadata if requested
      if (options.returnScores) {
        entries[0].metadata = {
          ...entries[0].metadata,
          rerankScore: relevance.score,
          rerankReasoning: relevance.reasoning
        };
      }
      
      return {
        entries,
        confidenceThresholdMet: relevance.score >= confidenceThreshold,
        topScore: relevance.score,
        validationResult: {
          isValid: relevance.isValid,
          reason: relevance.reason
        }
      };
    }
    
    try {
      // Process in batches if needed
      if (entries.length > this.maxBatchSize) {
        return this.rankInBatchesWithConfidence(query, entries, { 
          ...options, 
          confidenceThreshold 
        });
      }
      
      // Prepare entries for reranking
      const formattedEntries = entries.map(entry => {
        // Extract clean content from memory entries
        const content = entry.content || '';
        const metadata = entry.metadata || {};
        
        // Include metadata for better assessment
        const typeInfo = entry.type || entry.category || metadata.type || metadata.category || 'unknown';
        const sourceInfo = metadata.source || metadata.filePath || 'unknown';
        
        // Format for scoring
        return {
          id: entry.id,
          content: content,
          type: typeInfo,
          source: sourceInfo
        };
      });
      
      // Request reranking from model
      const response = await this.model.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: `You are an expert at assessing document relevance. 
Your task is to rerank document snippets based on their relevance to a query.
Focus on semantic relevance, factual accuracy, and information completeness.
For company information queries, prioritize official documents over conversational mentions.
For technical or domain-specific questions, prioritize detailed specialized information.

Assign scores on a scale of 0-100 based on these principles:
- 90-100: Perfect match that directly answers the query
- 70-89: Strong match with relevant information
- 50-69: Partial match with some relevant information
- 30-49: Weak match with only tangential relevance
- 0-29: Not relevant to the query

If no document meets a minimum threshold of 70, indicate clearly that none are satisfactory.`
          },
          {
            role: 'user',
            content: `Please evaluate which of these document snippets best answers the query: "${query}"
            
${formattedEntries.map((entry, i) => 
  `Document ${i+1} [${entry.type}]:
  ${entry.content.substring(0, 500)}${entry.content.length > 500 ? '...' : ''}`
).join('\n\n')}

Return a JSON object with:
1. "rankings": Array of document rankings from most to least relevant
2. "threshold_met": Boolean indicating if any document meets the minimum threshold (70+)
3. "evaluation": Brief explanation of your overall assessment

Example:
{
  "rankings": [
    {"index": 2, "score": 95, "reasoning": "This document directly answers the query with specific information..."},
    {"index": 5, "score": 82, "reasoning": "This document contains related information but is less complete..."}
  ],
  "threshold_met": true,
  "evaluation": "Document 2 provides a perfect match for the query, offering comprehensive information."
}`
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      if (options.debug) {
        logger.debug('Reranker response:', response);
      }
      
      try {
        // Parse the response
        const content = response.choices[0]?.message?.content || '{"rankings":[], "threshold_met": false}';
        const parsed = JSON.parse(content);
        const rankings = parsed.rankings || [];
        const thresholdMet = parsed.threshold_met === true;
        
        if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
          logger.warn('Reranker: Invalid or empty rankings, returning original order');
          return {
            entries,
            confidenceThresholdMet: false
          };
        }
        
        // Reorder entries based on rankings
        const reranked = rankings
          .filter(r => typeof r.index === 'number')
          .sort((a, b) => b.score - a.score)
          .map(ranking => {
            // Adjust for 1-based indexing in the response
            const index = ranking.index - 1;
            if (index >= 0 && index < entries.length) {
              const entry = entries[index];
              // Add reranking metadata if requested
              if (options.returnScores) {
                entry.metadata = {
                  ...entry.metadata,
                  rerankScore: ranking.score,
                  rerankReasoning: ranking.reasoning
                };
              }
              return entry;
            }
            return null;
          })
          .filter(entry => entry !== null) as MemoryEntry[];
        
        // Handle any entries not included in rankings
        const rankedIds = new Set(reranked.map(e => e.id));
        const unrankedEntries = entries.filter(e => !rankedIds.has(e.id));
        
        // Get top score
        const topScore = rankings.length > 0 ? rankings[0].score : 0;
        
        // Validate answer against top result if requested
        let validationResult: { isValid: boolean; reason?: string } | undefined;
        
        if (options.validateContent && reranked.length > 0 && topScore >= confidenceThreshold) {
          validationResult = await this.validateAnswerContent(
            query, 
            reranked[0]
          );
        }
        
        return {
          entries: [...reranked, ...unrankedEntries],
          confidenceThresholdMet: thresholdMet,
          topScore,
          validationResult
        };
      } catch (parseError) {
        logger.error('Reranker: Error parsing rankings', parseError);
        return {
          entries,
          confidenceThresholdMet: false
        };
      }
    } catch (error) {
      logger.error('Reranker: Error during reranking', error);
      return {
        entries,
        confidenceThresholdMet: false
      };
    }
  }
  
  /**
   * Process large entry sets in batches and combine results
   */
  private async rankInBatches(
    query: string, 
    entries: MemoryEntry[], 
    options: { debug?: boolean; returnScores?: boolean } = {}
  ): Promise<MemoryEntry[]> {
    // Use enhanced version and return just entries for backward compatibility
    const result = await this.rankInBatchesWithConfidence(query, entries, options);
    return result.entries;
  }
  
  /**
   * Process large entry sets in batches with confidence checking
   */
  private async rankInBatchesWithConfidence(
    query: string, 
    entries: MemoryEntry[], 
    options: { 
      debug?: boolean; 
      returnScores?: boolean;
      confidenceThreshold?: number;
      validateContent?: boolean;
    } = {}
  ): Promise<RerankerResult> {
    // Split entries into batches
    const batches: MemoryEntry[][] = [];
    for (let i = 0; i < entries.length; i += this.maxBatchSize) {
      batches.push(entries.slice(i, i + this.maxBatchSize));
    }
    
    // Rank each batch separately
    const rankedBatchResults = await Promise.all(
      batches.map(batch => this.rerankWithConfidence(query, batch, options))
    );
    
    // Find batches that met confidence threshold
    const confidenceBatches = rankedBatchResults.filter(result => 
      result.confidenceThresholdMet
    );
    
    // If we have confidence batches, use those
    if (confidenceBatches.length > 0) {
      // Sort by top score
      confidenceBatches.sort((a, b) => (b.topScore || 0) - (a.topScore || 0));
      
      // Return the highest confidence batch
      return confidenceBatches[0];
    }
    
    // Otherwise, combine top results from all batches
    const topResults: MemoryEntry[] = [];
    const topPerBatch = Math.min(3, Math.ceil(this.maxBatchSize / 3));
    
    rankedBatchResults.forEach(result => {
      topResults.push(...result.entries.slice(0, topPerBatch));
    });
    
    // Final reranking of combined top results if we have enough
    if (topResults.length > 1 && topResults.length <= this.maxBatchSize) {
      return this.rerankWithConfidence(query, topResults, options);
    }
    
    // Return combined results without confidence
    return {
      entries: topResults,
      confidenceThresholdMet: false
    };
  }
  
  /**
   * Evaluate the relevance of a single entry
   */
  private async evaluateSingleEntryRelevance(
    query: string,
    entry: MemoryEntry
  ): Promise<{
    score: number;
    reasoning: string;
    isValid: boolean;
    reason?: string;
  }> {
    if (!this.model) {
      return { score: 0, reasoning: 'No model available', isValid: false };
    }
    
    try {
      const content = entry.content || '';
      const metadata = entry.metadata || {};
      const typeInfo = entry.type || entry.category || metadata.type || metadata.category || 'unknown';
      
      const response = await this.model.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: `You are an expert at assessing document relevance to a query. 
Evaluate if this single document is relevant to the query and assign a score from 0-100.
Focus on semantic relevance, factual accuracy, and information completeness.`
          },
          {
            role: 'user',
            content: `Please evaluate if this document answers the query: "${query}"

Document [${typeInfo}]:
${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}

Return a JSON object with:
1. "score": A number from 0-100 indicating relevance
2. "reasoning": Brief explanation of your score
3. "is_valid": Boolean indicating if information is accurate and reliable
4. "reason": Reason for validity assessment

Example:
{
  "score": 85,
  "reasoning": "This document directly addresses the query...",
  "is_valid": true,
  "reason": "Information appears factual and comes from an official source"
}`
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      const responseContent = response.choices[0]?.message?.content || '{"score":0,"reasoning":"Error evaluating document"}';
      const parsed = JSON.parse(responseContent);
      
      return {
        score: parsed.score || 0,
        reasoning: parsed.reasoning || '',
        isValid: parsed.is_valid === true,
        reason: parsed.reason
      };
    } catch (error) {
      logger.error('Error evaluating single entry relevance:', error);
      return { 
        score: 0, 
        reasoning: 'Error evaluating document', 
        isValid: false 
      };
    }
  }
  
  /**
   * Validate if a potential answer is supported by the retrieved content
   */
  private async validateAnswerContent(
    query: string,
    entry: MemoryEntry
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    if (!this.model) {
      return { isValid: false, reason: 'No model available' };
    }
    
    try {
      const documentContent = entry.content || '';
      
      const response = await this.model.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: `You are an expert fact-checker who verifies if a document contains sufficient information to answer a query.
Your task is to determine if the document contains explicit information needed to answer the query accurately.
If the document is missing key information or is only tangentially related, mark it as invalid.`
          },
          {
            role: 'user',
            content: `Query: "${query}"

Document Content:
${documentContent.substring(0, 1500)}${documentContent.length > 1500 ? '...' : ''}

Determine if this document contains enough explicit information to provide a reliable answer to the query.
Return a JSON object with:
1. "is_valid": Boolean indicating if document supports answering the query
2. "reason": Brief explanation for your assessment
3. "missing_info": Any critical information that's missing (if invalid)

If in doubt, err on the side of caution and mark as invalid.`
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      const validationContent = response.choices[0]?.message?.content || '{"is_valid":false,"reason":"Error validating content"}';
      const parsed = JSON.parse(validationContent);
      
      return {
        isValid: parsed.is_valid === true,
        reason: parsed.reason || (parsed.missing_info ? `Missing: ${parsed.missing_info}` : undefined)
      };
    } catch (error) {
      logger.error('Error validating answer content:', error);
      return { 
        isValid: false, 
        reason: 'Error validating content' 
      };
    }
  }
} 