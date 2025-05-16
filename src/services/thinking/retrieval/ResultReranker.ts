import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';

/**
 * A retrieval result
 */
export interface RetrievalResult {
  /**
   * Unique ID of the result
   */
  id: string;
  
  /**
   * Content text
   */
  content: string;
  
  /**
   * Source or location of the content
   */
  source: string;
  
  /**
   * Initial relevance score
   */
  score: number;
  
  /**
   * Metadata for the result
   */
  metadata?: Record<string, any>;
}

/**
 * A scored retrieval result with multiple dimension scores
 */
export interface ScoredResult extends RetrievalResult {
  /**
   * Relevance score
   */
  relevanceScore: number;
  
  /**
   * Recency score
   */
  recencyScore?: number;
  
  /**
   * Diversity score relative to other results
   */
  diversityScore?: number;
  
  /**
   * Information density score
   */
  densityScore?: number;
  
  /**
   * Composite score for ranking
   */
  compositeScore: number;
}

/**
 * Options for reranking results
 */
export interface RerankerOptions {
  /**
   * Original query
   */
  query: string;
  
  /**
   * Initial retrieval results
   */
  initialResults: RetrievalResult[];
  
  /**
   * Reranking strategy
   */
  strategy: 'relevance' | 'diversity' | 'reciprocal' | 'semantic' | 'hybrid';
  
  /**
   * Dimension weights for scoring
   */
  weights?: {
    relevance?: number;
    recency?: number;
    diversity?: number;
    length?: number;
  };
  
  /**
   * Whether to remove duplicates
   */
  removeDuplicates?: boolean;
}

/**
 * Result of content verification against sources
 */
export interface VerificationResult {
  /**
   * Overall faithfulness score (0-1)
   */
  faithfulness: number;
  
  /**
   * Map of content segments to source attribution
   */
  attributions: Record<string, string[]>;
  
  /**
   * List of unsupported claims
   */
  unsupportedClaims: string[];
  
  /**
   * List of contradictions with sources
   */
  contradictions: string[];
}

/**
 * Content with source attribution
 */
export interface AttributedContent {
  /**
   * Original content text
   */
  content: string;
  
  /**
   * Map of segments to sources
   */
  segments: Record<string, string[]>;
  
  /**
   * Confidence for each attribution
   */
  confidence: Record<string, number>;
}

/**
 * Formatted citations for attributed content
 */
export interface FormattedCitations {
  /**
   * Content with citation markers
   */
  content: string;
  
  /**
   * Source references
   */
  sources: Array<{
    id: string;
    text: string;
    source: string;
    confidence: number;
  }>;
}

/**
 * Service for reranking and attributing retrieval results
 */
export class ResultReranker {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.1
    });
  }
  
  /**
   * Rerank retrieval results to improve relevance and diversity
   * @param options Reranking options
   * @returns Reranked results
   */
  async rerank(options: RerankerOptions): Promise<RetrievalResult[]> {
    try {
      console.log(`Reranking ${options.initialResults.length} results for query: ${options.query}`);
      
      if (!options.initialResults || options.initialResults.length === 0) {
        return [];
      }
      
      // Score results on multiple dimensions
      const scoredResults = await this.scoreResults(options.query, options.initialResults, options.weights);
      
      // Apply different ranking strategies
      let rerankedResults: ScoredResult[];
      
      switch (options.strategy) {
        case 'diversity':
          rerankedResults = this.applyDiversityRanking(scoredResults);
          break;
        case 'reciprocal':
          rerankedResults = this.applyReciprocalRankFusion(scoredResults);
          break;
        case 'semantic':
          rerankedResults = await this.applySemanticRanking(options.query, scoredResults);
          break;
        case 'hybrid':
          rerankedResults = this.applyHybridRanking(scoredResults);
          break;
        case 'relevance':
        default:
          // Default to relevance ranking
          rerankedResults = scoredResults.sort((a, b) => b.compositeScore - a.compositeScore);
      }
      
      // Remove duplicates if requested
      if (options.removeDuplicates) {
        rerankedResults = this.deduplicateResults(rerankedResults);
      }
      
      // Convert back to standard result format
      return rerankedResults.map(result => ({
        id: result.id,
        content: result.content,
        source: result.source,
        score: result.compositeScore,
        metadata: {
          ...result.metadata,
          originalScore: result.score,
          relevanceScore: result.relevanceScore,
          recencyScore: result.recencyScore,
          diversityScore: result.diversityScore,
          reranked: true
        }
      }));
    } catch (error) {
      console.error('Error reranking results:', error);
      return options.initialResults;
    }
  }
  
  /**
   * Score each result based on multiple dimensions
   * @param query Original query
   * @param results Initial results
   * @param weights Scoring weights
   * @returns Results with dimension scores
   */
  async scoreResults(
    query: string, 
    results: RetrievalResult[],
    weights?: {
      relevance?: number;
      recency?: number;
      diversity?: number;
      length?: number;
    }
  ): Promise<ScoredResult[]> {
    // Default weights
    const relevanceWeight = weights?.relevance ?? 1.0;
    const recencyWeight = weights?.recency ?? 0.5;
    const diversityWeight = weights?.diversity ?? 0.3;
    const lengthWeight = weights?.length ?? 0.2;
    
    // Map of content fingerprints to detect similarity
    const contentFingerprints = new Map<string, number>();
    
    // Process each result
    const scoredResults: ScoredResult[] = results.map(result => {
      // Initial score is the relevance score (already computed)
      let relevanceScore = result.score;
      
      // Calculate recency score if date is available
      let recencyScore = 0.5;
      if (result.metadata?.createdAt || result.metadata?.date) {
        const date = new Date(result.metadata.createdAt || result.metadata.date);
        // More recent = higher score
        const ageInDays = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        recencyScore = Math.max(0, 1 - (ageInDays / 365)); // Scale over a year
      }
      
      // Calculate length/information density score
      const contentLength = result.content.length;
      const densityScore = Math.min(1.0, contentLength / 1000); // Normalize to 0-1
      
      // Calculate diversity score based on content similarity
      let diversityScore = 1.0;
      
      // Simple fingerprinting for diversity calculation
      const words = result.content.toLowerCase().split(/\W+/).filter(w => w.length > 4);
      const fingerprint = words.slice(0, 10).join(' '); // Use first 10 significant words
      
      if (contentFingerprints.has(fingerprint)) {
        // Reduce score for similar content
        diversityScore = 0.3;
        contentFingerprints.set(fingerprint, contentFingerprints.get(fingerprint)! + 1);
      } else {
        contentFingerprints.set(fingerprint, 1);
      }
      
      // Calculate composite score with weights
      const compositeScore = 
        (relevanceScore * relevanceWeight) +
        (recencyScore * recencyWeight) +
        (diversityScore * diversityWeight) +
        (densityScore * lengthWeight);
      
      return {
        ...result,
        relevanceScore,
        recencyScore,
        diversityScore,
        densityScore,
        compositeScore
      };
    });
    
    return scoredResults;
  }
  
  /**
   * Apply diversity-focused ranking
   * @param results Scored results
   * @returns Diversity-ranked results
   */
  private applyDiversityRanking(results: ScoredResult[]): ScoredResult[] {
    // Make a copy to avoid mutating the original
    const remainingResults = [...results];
    const selectedResults: ScoredResult[] = [];
    
    // Always select highest scoring result first
    if (remainingResults.length > 0) {
      remainingResults.sort((a, b) => b.compositeScore - a.compositeScore);
      selectedResults.push(remainingResults.shift()!);
    }
    
    // Iteratively select results that maximize relevance AND diversity
    while (remainingResults.length > 0) {
      // For each remaining result, calculate its maximum similarity to already selected results
      const resultsWithDiversity = remainingResults.map(result => {
        // Calculate content similarity to all selected results
        const similarities = selectedResults.map(selected => {
          // Simple Jaccard similarity between content
          const resultWords = new Set(result.content.toLowerCase().split(/\W+/));
          const selectedWords = new Set(selected.content.toLowerCase().split(/\W+/));
          
          const intersection = new Set(Array.from(resultWords).filter(x => selectedWords.has(x)));
          const union = new Set(Array.from(resultWords).concat(Array.from(selectedWords)));
          
          return intersection.size / union.size;
        });
        
        // Get maximum similarity (0 if no selected results yet)
        const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
        
        // Calculate marginal relevance score
        // λ * relevance_score - (1-λ) * max_similarity
        // λ balances relevance vs. diversity (0.7 = favor relevance)
        const lambda = 0.7;
        const marginalRelevance = (lambda * result.compositeScore) - ((1 - lambda) * maxSimilarity);
        
        return {
          ...result,
          marginalRelevance
        };
      });
      
      // Sort by marginal relevance and select the best
      resultsWithDiversity.sort((a, b) => b.marginalRelevance - a.marginalRelevance);
      const nextBest = resultsWithDiversity[0];
      
      // Remove from remaining and add to selected
      selectedResults.push(nextBest);
      remainingResults.splice(remainingResults.findIndex(r => r.id === nextBest.id), 1);
    }
    
    return selectedResults;
  }
  
  /**
   * Apply reciprocal rank fusion
   * @param results Scored results
   * @returns Fused results
   */
  private applyReciprocalRankFusion(results: ScoredResult[]): ScoredResult[] {
    // Create multiple rankings
    const relevanceRanking = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const recencyRanking = [...results].sort((a, b) => (b.recencyScore || 0) - (a.recencyScore || 0));
    const diversityRanking = [...results].sort((a, b) => (b.diversityScore || 0) - (a.diversityScore || 0));
    
    // Calculate reciprocal rank fusion score
    const fusedResults = results.map(result => {
      // Find ranks (add 1 to avoid division by zero)
      const relevanceRank = relevanceRanking.findIndex(r => r.id === result.id) + 1;
      const recencyRank = recencyRanking.findIndex(r => r.id === result.id) + 1;
      const diversityRank = diversityRanking.findIndex(r => r.id === result.id) + 1;
      
      // Constant k (typically 60)
      const k = 60;
      
      // RRF formula: sum(1 / (k + rank_i))
      const rrfScore = 
        (1 / (k + relevanceRank)) +
        (1 / (k + recencyRank)) +
        (1 / (k + diversityRank));
      
      return {
        ...result,
        compositeScore: rrfScore
      };
    });
    
    // Sort by RRF score
    return fusedResults.sort((a, b) => b.compositeScore - a.compositeScore);
  }
  
  /**
   * Apply semantic ranking using LLM
   * @param query Original query
   * @param results Scored results
   * @returns Semantically ranked results
   */
  private async applySemanticRanking(query: string, results: ScoredResult[]): Promise<ScoredResult[]> {
    try {
      // For large result sets, only rerank the top N
      const topResults = results.length > 10 ? 
        [...results].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 10) :
        results;
      
      // Define system prompt for semantic ranking
      const systemPrompt = `You are an AI assistant that ranks search results based on semantic relevance to a query.
Your task is to re-order a list of search results to better match the user's query intent.

Analyze each result's content and determine how well it addresses the query.
Assign a score from 0 to 10 for each result (10 being perfect match).

Return your rankings as a JSON array of IDs and scores, like this:
{
  "rankings": [
    {"id": "result-id-1", "score": 9.5},
    {"id": "result-id-2", "score": 8.7},
    {"id": "result-id-3", "score": 6.2}
  ]
}`;

      // Prepare the content for LLM analysis
      const resultDescriptions = topResults.map(result => 
        `ID: ${result.id}
Content: ${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}
Source: ${result.source}
Initial Score: ${result.relevanceScore}`
      ).join('\n\n---\n\n');
      
      // Create human message with query and results
      const humanMessage = `Query: "${query}"

Results to rank:
${resultDescriptions}

Please rank these results based on their semantic relevance to the query.`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        if (data.rankings && Array.isArray(data.rankings)) {
          // Map of ID to new score
          const newScores = new Map<string, number>();
          
          // Normalize scores to 0-1 range
          data.rankings.forEach((ranking: { id: string, score: number }) => {
            newScores.set(ranking.id, ranking.score / 10);
          });
          
          // Apply new scores to results
          const semanticResults = topResults.map(result => ({
            ...result,
            // If this result was re-ranked, use new score; otherwise keep original
            relevanceScore: newScores.has(result.id) ? newScores.get(result.id)! : result.relevanceScore,
            // Recalculate composite score
            compositeScore: newScores.has(result.id) ? 
              newScores.get(result.id)! : result.compositeScore
          }));
          
          // Re-sort based on semantic scores
          return semanticResults.sort((a, b) => b.compositeScore - a.compositeScore);
        }
      }
      
      // Fallback to original results if parsing fails
      return results;
    } catch (error) {
      console.error('Error applying semantic ranking:', error);
      return results;
    }
  }
  
  /**
   * Apply hybrid ranking combining multiple strategies
   * @param results Scored results
   * @returns Hybrid-ranked results
   */
  private applyHybridRanking(results: ScoredResult[]): ScoredResult[] {
    // Get diversity ranking
    const diversityRanked = this.applyDiversityRanking(results);
    
    // Get reciprocal rank fusion
    const rrfRanked = this.applyReciprocalRankFusion(results);
    
    // Combine ranks (lower is better)
    const hybridResults = results.map(result => {
      const diversityRank = diversityRanked.findIndex(r => r.id === result.id);
      const rrfRank = rrfRanked.findIndex(r => r.id === result.id);
      
      // Hybrid rank is weighted average of both rankings
      const hybridRank = (0.6 * diversityRank) + (0.4 * rrfRank);
      
      return {
        ...result,
        compositeScore: 1 / (1 + hybridRank) // Transform back to score (higher is better)
      };
    });
    
    // Sort by hybrid score
    return hybridResults.sort((a, b) => b.compositeScore - a.compositeScore);
  }
  
  /**
   * Filter out redundant information
   * @param results Ranked results
   * @returns Deduplicated results
   */
  deduplicateResults(results: ScoredResult[]): ScoredResult[] {
    // If fewer than 2 results, no need to deduplicate
    if (results.length < 2) {
      return results;
    }
    
    const deduplicated: ScoredResult[] = [results[0]]; // Always keep the top result
    const significantPhrases = new Set<string>();
    
    // Extract significant phrases from first result for deduplication
    const topPhrases = this.extractSignificantPhrases(results[0].content);
    topPhrases.forEach(phrase => significantPhrases.add(phrase));
    
    // Check remaining results for redundancy
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      const phrases = this.extractSignificantPhrases(result.content);
      
      // Calculate overlap with known phrases
      let overlapCount = 0;
      phrases.forEach(phrase => {
        if (significantPhrases.has(phrase)) {
          overlapCount++;
        }
      });
      
      // Calculate overlap percentage
      const overlapPercentage = overlapCount / phrases.length;
      
      // If overlap is below threshold, add to results
      if (overlapPercentage < 0.5) { // Less than 50% overlap
        deduplicated.push(result);
        
        // Add new phrases to the set
        phrases.forEach(phrase => significantPhrases.add(phrase));
      }
    }
    
    return deduplicated;
  }
  
  /**
   * Extract significant phrases from text for deduplication
   * @param text Content text
   * @returns List of significant phrases
   */
  private extractSignificantPhrases(text: string): string[] {
    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // For simplicity, use sentences as phrases
    // In a real implementation, you might use NLP to extract more sophisticated phrases
    return sentences.map(s => s.trim().toLowerCase());
  }
  
  /**
   * Track which parts of the generated content came from which sources
   * @param content Generated content
   * @param sources Source texts
   * @returns Attribution mapping
   */
  async trackSourceAttribution(
    content: string,
    sources: RetrievalResult[]
  ): Promise<AttributedContent> {
    try {
      // For small content/sources, use LLM-based attribution
      if (content.length < 2000 && sources.length <= 5) {
        return this.llmSourceAttribution(content, sources);
      }
      
      // For larger content/sources, use heuristic attribution
      return this.heuristicSourceAttribution(content, sources);
    } catch (error) {
      console.error('Error tracking source attribution:', error);
      // Return basic attribution
      return {
        content,
        segments: {},
        confidence: {}
      };
    }
  }
  
  /**
   * Use LLM to attribute content to sources
   * @param content Generated content
   * @param sources Source texts
   * @returns Attribution mapping
   */
  private async llmSourceAttribution(
    content: string,
    sources: RetrievalResult[]
  ): Promise<AttributedContent> {
    try {
      // Define system prompt for source attribution
      const systemPrompt = `You are an AI assistant that identifies which parts of a generated text came from which source documents.
Your task is to analyze a generated text and map segments to their likely source documents.
For each segment, assign a confidence score from 0.0 to 1.0 indicating how certain you are of the attribution.

Return your analysis as a JSON object with the following structure:
{
  "segments": {
    "segment 1": ["source-id-1", "source-id-3"],
    "segment 2": ["source-id-2"]
  },
  "confidence": {
    "segment 1": 0.9,
    "segment 2": 0.8
  }
}`;

      // Prepare message with sources and content
      const sourcesText = sources.map(source => 
        `Source ID: ${source.id}
Content: ${source.content.substring(0, 300)}${source.content.length > 300 ? '...' : ''}`
      ).join('\n\n---\n\n');
      
      const humanMessage = `Generated content:
${content}

Source documents:
${sourcesText}

Please identify which parts of the generated content came from which source documents.`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const responseText = response.content.toString();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        if (data.segments && data.confidence) {
          return {
            content,
            segments: data.segments,
            confidence: data.confidence
          };
        }
      }
      
      // Fallback to basic attribution
      throw new Error('Failed to parse LLM attribution response');
    } catch (error) {
      console.error('Error using LLM for source attribution:', error);
      return this.heuristicSourceAttribution(content, sources);
    }
  }
  
  /**
   * Use heuristic methods to attribute content to sources
   * @param content Generated content
   * @param sources Source texts
   * @returns Attribution mapping
   */
  private heuristicSourceAttribution(
    content: string,
    sources: RetrievalResult[]
  ): AttributedContent {
    // Split content into sentences
    const sentences = content.split(/(?<=[.!?])\s+/);
    
    const segments: Record<string, string[]> = {};
    const confidence: Record<string, number> = {};
    
    // Check each sentence against each source
    for (const sentence of sentences) {
      if (sentence.trim().length < 10) continue; // Skip very short sentences
      
      const attributions: string[] = [];
      let maxConfidence = 0;
      
      for (const source of sources) {
        // Calculate similarity between sentence and source
        const similarity = this.calculateTextSimilarity(sentence, source.content);
        
        // If similarity is above threshold, attribute to this source
        if (similarity > 0.6) {
          attributions.push(source.id);
          maxConfidence = Math.max(maxConfidence, similarity);
        }
      }
      
      // Store attributions and confidence
      if (attributions.length > 0) {
        segments[sentence] = attributions;
        confidence[sentence] = maxConfidence;
      }
    }
    
    return {
      content,
      segments,
      confidence
    };
  }
  
  /**
   * Calculate text similarity using a simple heuristic
   * @param text1 First text
   * @param text2 Second text
   * @returns Similarity score (0-1)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // This is a very simplified version - in a real implementation,
    // you would use more sophisticated techniques like embedding similarity,
    // longest common subsequence, or n-gram overlap
    
    // Convert to lowercase and tokenize
    const tokens1 = text1.toLowerCase().split(/\W+/).filter(t => t.length > 3);
    const tokens2 = text2.toLowerCase().split(/\W+/).filter(t => t.length > 3);
    
    // Count overlapping tokens
    let overlapCount = 0;
    const tokenSet2 = new Set(tokens2);
    
    for (const token of tokens1) {
      if (tokenSet2.has(token)) {
        overlapCount++;
      }
    }
    
    // Calculate Jaccard similarity
    const union = new Set([...tokens1, ...tokens2]);
    return overlapCount / union.size;
  }
  
  /**
   * Format citations in a user-friendly way
   * @param attribution Attribution mapping
   * @returns Formatted citations
   */
  async formatCitations(attribution: AttributedContent): Promise<FormattedCitations> {
    const { content, segments, confidence } = attribution;
    
    // Map to track citations
    const citationMap = new Map<string, Set<string>>();
    
    // Process each segment
    Object.entries(segments).forEach(([segment, sourceIds]) => {
      sourceIds.forEach(sourceId => {
        if (!citationMap.has(sourceId)) {
          citationMap.set(sourceId, new Set());
        }
        citationMap.get(sourceId)!.add(segment);
      });
    });
    
    // Create citation markers in the content
    let citedContent = content;
    const sources: Array<{
      id: string;
      text: string;
      source: string;
      confidence: number;
    }> = [];
    
    // Assign citation numbers
    let citationCounter = 1;
    
    // Process citations
    citationMap.forEach((segments, sourceId) => {
      const citationNumber = citationCounter++;
      
      // Add citation marker to each segment
      segments.forEach(segment => {
        if (citedContent.includes(segment)) {
          citedContent = citedContent.replace(
            segment,
            `${segment} [${citationNumber}]`
          );
        }
      });
      
      // Add to sources list
      sources.push({
        id: sourceId,
        text: Array.from(segments).join(' ... '),
        source: sourceId,
        confidence: Math.max(...Array.from(segments).map(s => confidence[s] || 0))
      });
    });
    
    return {
      content: citedContent,
      sources
    };
  }
  
  /**
   * Verify generated content against sources for factuality
   * @param content Generated content
   * @param sources Source texts
   * @returns Verification result
   */
  async verifyContentAgainstSources(
    content: string,
    sources: RetrievalResult[]
  ): Promise<VerificationResult> {
    try {
      // Define system prompt for content verification
      const systemPrompt = `You are an AI assistant that verifies if generated content is supported by source documents.
Your task is to determine:
1. Which claims in the content are supported by the sources
2. Which claims are unsupported
3. Which claims contradict the sources

Assign an overall faithfulness score from 0.0 to 1.0 indicating how well the content is supported by the sources.

Return your analysis as a JSON object with the following structure:
{
  "faithfulness": 0.85,
  "attributions": {
    "claim 1": ["source-id-1", "source-id-3"],
    "claim 2": ["source-id-2"]
  },
  "unsupportedClaims": [
    "claim that has no support"
  ],
  "contradictions": [
    "claim that contradicts the sources"
  ]
}`;

      // Prepare message with sources and content
      const sourcesText = sources.map(source => 
        `Source ID: ${source.id}
Content: ${source.content.substring(0, 300)}${source.content.length > 300 ? '...' : ''}`
      ).join('\n\n---\n\n');
      
      const humanMessage = `Generated content to verify:
${content}

Source documents:
${sourcesText}

Please verify if the generated content is supported by the source documents.`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const responseText = response.content.toString();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        return {
          faithfulness: data.faithfulness || 0,
          attributions: data.attributions || {},
          unsupportedClaims: data.unsupportedClaims || [],
          contradictions: data.contradictions || []
        };
      }
      
      // Fallback for parsing failures
      throw new Error('Failed to parse verification response');
    } catch (error) {
      console.error('Error verifying content against sources:', error);
      
      // Return basic result
      return {
        faithfulness: 0.5,
        attributions: {},
        unsupportedClaims: ['[Verification failed]'],
        contradictions: []
      };
    }
  }
} 