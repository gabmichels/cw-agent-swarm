/**
 * DefaultTrendAnalyzer.ts - Default implementation of trend analysis
 * 
 * This file provides a concrete implementation of the ITrendAnalyzer interface
 * for analyzing market signals and identifying trends.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../../lib/logging';
import { ChatOpenAI } from '@langchain/openai';
import { MarketSignal, MarketTrend } from '../MarketScanner.interface';
import { ITrendAnalyzer, TrendAnalysisConfig, TrendAnalysisResult } from '../interfaces/TrendAnalysis.interface';

/**
 * Error class for trend analysis operations
 */
export class TrendAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrendAnalysisError';
  }
}

/**
 * Default implementation of the trend analyzer
 */
export class DefaultTrendAnalyzer implements ITrendAnalyzer {
  private model: ChatOpenAI | null = null;
  private config: TrendAnalysisConfig = {
    minConfidence: 0.7,
    maxTrends: 10,
    useLlm: true,
    modelName: 'gpt-4.1-2025-04-14',
    mergeSimilarTrends: true,
    similarityThreshold: 0.7
  };
  
  /**
   * Initialize the trend analyzer
   * 
   * @param model Optional LLM model to use
   * @param config Configuration options
   */
  async initialize(model?: ChatOpenAI, config?: TrendAnalysisConfig): Promise<void> {
    this.model = model || new ChatOpenAI({
      temperature: 0.2,
      modelName: config?.modelName || 'gpt-4.1-2025-04-14',
    });
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    logger.info('Trend analyzer initialized');
  }
  
  /**
   * Process market signals to extract trends
   * 
   * @param signals Market signals to analyze
   * @param context Optional context information
   * @returns Analysis result with extracted trends
   */
  async analyzeSignals(
    signals: MarketSignal[], 
    context?: Record<string, unknown>
  ): Promise<TrendAnalysisResult> {
    if (!this.model) {
      throw new TrendAnalysisError('Trend analyzer not initialized with an LLM model');
    }
    
    const startTime = Date.now();
    logger.info(`Analyzing ${signals.length} market signals`);
    
    try {
      let trends: MarketTrend[];
      
      if (this.config.useLlm) {
        trends = await this.extractTrendsWithLLM(signals, context);
      } else {
        trends = await this.extractTrendsHeuristically(signals, context);
      }
      
      // Merge similar trends if enabled
      if (this.config.mergeSimilarTrends && trends.length > 1) {
        trends = await this.mergeSimilarTrends(trends, this.config.similarityThreshold);
      }
      
      // Calculate scores for each trend
      for (let i = 0; i < trends.length; i++) {
        trends[i] = await this.calculateTrendScore(trends[i], context);
        trends[i] = await this.determineTrendStage(trends[i], context);
      }
      
      // Sort by score and limit results
      trends = trends
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxTrends);
      
      const processingTime = Date.now() - startTime;
      logger.info(`Trend analysis complete in ${processingTime}ms, found ${trends.length} trends`);
      
      return {
        trends,
        confidence: 0.85, // Placeholder confidence
        processingTime,
        signalsProcessed: signals.length,
        metadata: {
          usedLlm: this.config.useLlm,
          contextSize: context ? Object.keys(context).length : 0,
          categories: Array.from(new Set(trends.map(t => t.category)))
        }
      };
    } catch (error) {
      logger.error('Error analyzing signals:', error);
      throw error;
    }
  }
  
  /**
   * Merge similar trends to avoid duplication
   * 
   * @param trends Trends to merge
   * @param similarityThreshold Threshold for similarity (0-1)
   * @returns Merged trends
   */
  async mergeSimilarTrends(
    trends: MarketTrend[], 
    similarityThreshold: number = 0.7
  ): Promise<MarketTrend[]> {
    // Skip if too few trends
    if (trends.length <= 1) {
      return trends;
    }
    
    const mergedTrends: MarketTrend[] = [];
    const processedIds = new Set<string>();
    
    // For each trend, look for similar trends to merge
    for (let i = 0; i < trends.length; i++) {
      const trend = trends[i];
      
      // Skip if already processed
      if (processedIds.has(trend.id)) {
        continue;
      }
      
      // Find similar trends
      const similarTrends = trends.filter((t, idx) => {
        if (idx === i || processedIds.has(t.id)) {
          return false;
        }
        
        return this.calculateSimilarity(trend, t) >= similarityThreshold;
      });
      
      if (similarTrends.length === 0) {
        // No similar trends, add as is
        mergedTrends.push(trend);
      } else {
        // Merge with similar trends
        const mergedTrend = this.mergeTrends([trend, ...similarTrends]);
        mergedTrends.push(mergedTrend);
        
        // Mark all as processed
        similarTrends.forEach(t => processedIds.add(t.id));
      }
      
      // Mark as processed
      processedIds.add(trend.id);
    }
    
    logger.info(`Merged ${trends.length} trends into ${mergedTrends.length} trends`);
    return mergedTrends;
  }
  
  /**
   * Calculate trend score based on various factors
   * 
   * @param trend Trend to score
   * @param context Optional context for scoring
   * @returns Updated trend with new score
   */
  async calculateTrendScore(
    trend: MarketTrend, 
    context?: Record<string, unknown>
  ): Promise<MarketTrend> {
    // This is a simple placeholder implementation
    // In a real implementation, this would analyze various factors
    
    // For now, just ensure score is in range 0-100
    const score = Math.min(100, Math.max(0, trend.score));
    
    return {
      ...trend,
      score
    };
  }
  
  /**
   * Determine trend stage based on various factors
   * 
   * @param trend Trend to evaluate
   * @param context Optional context for evaluation
   * @returns Updated trend with new stage
   */
  async determineTrendStage(
    trend: MarketTrend, 
    context?: Record<string, unknown>
  ): Promise<MarketTrend> {
    // This is a simple placeholder implementation
    // In a real implementation, this would analyze trend patterns
    
    // For now, just use a simple score-based approach
    let stage: 'emerging' | 'growing' | 'mainstream' | 'declining';
    
    if (trend.score < 40) {
      stage = 'declining';
    } else if (trend.score < 60) {
      stage = 'mainstream';
    } else if (trend.score < 80) {
      stage = 'growing';
    } else {
      stage = 'emerging';
    }
    
    return {
      ...trend,
      stage
    };
  }
  
  /**
   * Extract trends using LLM
   * 
   * @param signals Market signals to analyze
   * @param context Optional context information
   * @returns Extracted market trends
   */
  private async extractTrendsWithLLM(
    signals: MarketSignal[],
    context?: Record<string, unknown>
  ): Promise<MarketTrend[]> {
    if (!this.model) {
      throw new TrendAnalysisError('Trend analyzer not initialized with an LLM model');
    }
    
    // Construct prompt with signal data
    const signalSummaries = signals.map(s => 
      `- ${s.title} (${s.source}, ${s.category}): ${s.content.substring(0, 200)}...`
    ).join('\n');
    
    // Add context information if available
    const contextInfo = context ? 
      `Additional context: ${JSON.stringify(context, null, 2)}` : '';
    
    // Create the prompt
    const prompt = `
      You are an expert market analyst specializing in AI and automation technologies.
      Analyze the following market signals and identify key trends in AI tools and automation.
      
      MARKET SIGNALS:
      ${signalSummaries}
      
      ${contextInfo}
      
      For each trend you identify, provide:
      1. A unique ID (short alphanumeric)
      2. Name (concise title)
      3. Description (1-2 sentences)
      4. Relevance score (0-100)
      5. Category (one of: ai, automation, integration, analytics, other)
      6. 3-5 relevant keywords as an array of strings
      7. List of sources
      8. Stage (one of: emerging, growing, mainstream, declining)
      9. 2-3 relevant user needs this trend addresses
      10. Estimated business impact score (0-100)
      
      Format the response as a valid JSON array of trend objects.
      Extract up to ${this.config.maxTrends} distinct trends.
    `;
    
    const completion = await this.model.invoke(prompt);
    const responseText = completion.content as string;
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new TrendAnalysisError('Could not extract valid JSON from LLM response');
    }
    
    const jsonString = jsonMatch[0];
    
    try {
      const parsedTrends = JSON.parse(jsonString);
      
      // Format and validate results
      const trends: MarketTrend[] = parsedTrends.map((trend: any) => ({
        id: trend.id || `trend_${uuidv4().substring(0, 8)}`,
        name: trend.name || 'Unknown Trend',
        description: trend.description || 'No description provided',
        score: typeof trend.score === 'number' ? trend.score : 50,
        category: this.validateCategory(trend.category),
        keywords: Array.isArray(trend.keywords) ? trend.keywords : [],
        sources: Array.isArray(trend.sources) ? trend.sources : [],
        firstDetected: new Date(),
        lastUpdated: new Date(),
        stage: this.validateStage(trend.stage),
        relevantUserNeeds: Array.isArray(trend.relevantUserNeeds) ? 
          trend.relevantUserNeeds : 
          (Array.isArray(trend.userNeeds) ? trend.userNeeds : []),
        estimatedBusinessImpact: typeof trend.estimatedBusinessImpact === 'number' ? 
          trend.estimatedBusinessImpact : 50
      }));
      
      return trends;
    } catch (error) {
      logger.error('Error parsing LLM response:', error);
      logger.debug('Raw response:', responseText);
      throw new TrendAnalysisError('Failed to parse LLM response as valid JSON');
    }
  }
  
  /**
   * Extract trends using heuristic analysis
   * 
   * @param signals Market signals to analyze
   * @param context Optional context information
   * @returns Extracted market trends
   */
  private async extractTrendsHeuristically(
    signals: MarketSignal[],
    context?: Record<string, unknown>
  ): Promise<MarketTrend[]> {
    // This is a placeholder implementation for non-LLM trend extraction
    // In a real implementation, this would use NLP techniques, TF-IDF, etc.
    
    const trends: MarketTrend[] = [];
    
    // Group signals by category
    const categorizedSignals = new Map<string, MarketSignal[]>();
    
    for (const signal of signals) {
      if (!categorizedSignals.has(signal.category)) {
        categorizedSignals.set(signal.category, []);
      }
      categorizedSignals.get(signal.category)!.push(signal);
    }
    
    // Create one trend per category as a placeholder
    // Convert Map entries to array before iteration to avoid downlevel iteration issues
    for (const [category, categorySignals] of Array.from(categorizedSignals.entries())) {
      // Skip categories with too few signals
      if (categorySignals.length < 3) {
        continue;
      }
      
      // Create a trend for this category
      trends.push({
        id: `trend_${category}_${uuidv4().substring(0, 8)}`,
        name: `${category.charAt(0).toUpperCase() + category.slice(1)} Trend`,
        description: `Trend observed in ${category} category based on ${categorySignals.length} signals.`,
        score: 50 + Math.min(50, categorySignals.length * 2), // Simple score based on signal count
        category: this.mapToValidCategory(category),
        keywords: [category],
        sources: Array.from(new Set(categorySignals.map((s: MarketSignal) => s.source))),
        firstDetected: new Date(),
        lastUpdated: new Date(),
        stage: 'emerging',
        relevantUserNeeds: ['efficiency', 'automation'],
        estimatedBusinessImpact: 50
      });
    }
    
    return trends;
  }
  
  /**
   * Merge multiple trends into one
   * 
   * @param trends Trends to merge
   * @returns Merged trend
   */
  private mergeTrends(trends: MarketTrend[]): MarketTrend {
    if (trends.length === 0) {
      throw new TrendAnalysisError('Cannot merge empty trends array');
    }
    
    if (trends.length === 1) {
      return trends[0];
    }
    
    // Use first trend as base and merge others in
    const base = trends[0];
    
    // Combine keywords and sources with deduplication
    const keywords = new Set<string>();
    const sources = new Set<string>();
    const userNeeds = new Set<string>();
    
    // Track scores for averaging
    let totalScore = 0;
    let totalBusinessImpact = 0;
    
    for (const trend of trends) {
      trend.keywords.forEach(k => keywords.add(k));
      trend.sources.forEach(s => sources.add(s));
      trend.relevantUserNeeds.forEach(n => userNeeds.add(n));
      
      totalScore += trend.score;
      totalBusinessImpact += trend.estimatedBusinessImpact;
    }
    
    // Calculate averages
    const avgScore = Math.round(totalScore / trends.length);
    const avgBusinessImpact = Math.round(totalBusinessImpact / trends.length);
    
    // Create merged trend
    return {
      id: base.id,
      name: base.name,
      description: this.getMergedDescription(trends),
      score: avgScore,
      category: base.category,
      keywords: Array.from(keywords),
      sources: Array.from(sources),
      firstDetected: this.getEarliestDate(trends.map(t => t.firstDetected)),
      lastUpdated: new Date(),
      stage: this.getMostCommonStage(trends),
      relevantUserNeeds: Array.from(userNeeds),
      estimatedBusinessImpact: avgBusinessImpact
    };
  }
  
  /**
   * Calculate similarity between two trends
   * 
   * @param trendA First trend
   * @param trendB Second trend
   * @returns Similarity score (0-1)
   */
  private calculateSimilarity(trendA: MarketTrend, trendB: MarketTrend): number {
    // This is a simple implementation of trend similarity calculation
    // In a real implementation, this would use more sophisticated techniques
    
    // Check keyword overlap
    const keywordsA = new Set(trendA.keywords);
    const keywordsB = new Set(trendB.keywords);
    const commonKeywords = trendA.keywords.filter(k => keywordsB.has(k));
    
    // Check category match
    const categoryMatch = trendA.category === trendB.category ? 1 : 0;
    
    // Check user need overlap
    const needsA = new Set(trendA.relevantUserNeeds);
    const needsB = new Set(trendB.relevantUserNeeds);
    const commonNeeds = trendA.relevantUserNeeds.filter(n => needsB.has(n));
    
    // Calculate scores
    const keywordSimilarity = commonKeywords.length / 
      Math.max(1, Math.min(keywordsA.size, keywordsB.size));
    
    const needSimilarity = commonNeeds.length / 
      Math.max(1, Math.min(needsA.size, needsB.size));
    
    // Combine factors (weighting keyword match higher)
    return (keywordSimilarity * 0.6) + (categoryMatch * 0.3) + (needSimilarity * 0.1);
  }
  
  /**
   * Get merged description from multiple trends
   * 
   * @param trends Trends to merge descriptions from
   * @returns Merged description
   */
  private getMergedDescription(trends: MarketTrend[]): string {
    // Use the longest description as it likely has the most information
    return trends.reduce((longest, trend) => 
      trend.description.length > longest.length ? trend.description : longest, 
      trends[0].description
    );
  }
  
  /**
   * Get earliest date from a list of dates
   * 
   * @param dates Dates to compare
   * @returns Earliest date
   */
  private getEarliestDate(dates: Date[]): Date {
    return dates.reduce((earliest, date) => 
      date < earliest ? date : earliest, 
      dates[0]
    );
  }
  
  /**
   * Get most common stage from trends
   * 
   * @param trends Trends to analyze
   * @returns Most common stage
   */
  private getMostCommonStage(trends: MarketTrend[]): 'emerging' | 'growing' | 'mainstream' | 'declining' {
    const stageCounts = {
      emerging: 0,
      growing: 0,
      mainstream: 0,
      declining: 0
    };
    
    trends.forEach(trend => {
      stageCounts[trend.stage]++;
    });
    
    let maxCount = 0;
    let mostCommonStage: 'emerging' | 'growing' | 'mainstream' | 'declining' = 'emerging';
    
    for (const [stage, count] of Object.entries(stageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonStage = stage as 'emerging' | 'growing' | 'mainstream' | 'declining';
      }
    }
    
    return mostCommonStage;
  }
  
  /**
   * Validate and normalize category
   * 
   * @param category Category to validate
   * @returns Valid category
   */
  private validateCategory(category?: string): 'ai' | 'automation' | 'integration' | 'analytics' | 'other' {
    if (!category) {
      return 'other';
    }
    
    const normalized = category.toLowerCase();
    
    if (['ai', 'automation', 'integration', 'analytics'].includes(normalized)) {
      return normalized as 'ai' | 'automation' | 'integration' | 'analytics';
    }
    
    return 'other';
  }
  
  /**
   * Map arbitrary category string to valid category
   * 
   * @param category Category to map
   * @returns Valid category
   */
  private mapToValidCategory(category: string): 'ai' | 'automation' | 'integration' | 'analytics' | 'other' {
    const normalized = category.toLowerCase();
    
    if (normalized.includes('ai') || normalized.includes('intelligence')) {
      return 'ai';
    }
    
    if (normalized.includes('automat') || normalized.includes('robot')) {
      return 'automation';
    }
    
    if (normalized.includes('integrat') || normalized.includes('connect')) {
      return 'integration';
    }
    
    if (normalized.includes('analytic') || normalized.includes('data') || normalized.includes('insight')) {
      return 'analytics';
    }
    
    return 'other';
  }
  
  /**
   * Validate and normalize trend stage
   * 
   * @param stage Stage to validate
   * @returns Valid stage
   */
  private validateStage(stage?: string): 'emerging' | 'growing' | 'mainstream' | 'declining' {
    if (!stage) {
      return 'emerging';
    }
    
    const normalized = stage.toLowerCase();
    
    if (['emerging', 'growing', 'mainstream', 'declining'].includes(normalized)) {
      return normalized as 'emerging' | 'growing' | 'mainstream' | 'declining';
    }
    
    return 'emerging';
  }
} 