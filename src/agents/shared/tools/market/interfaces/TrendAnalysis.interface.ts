/**
 * TrendAnalysis.interface.ts - Interfaces for market trend analysis
 * 
 * This file defines interfaces for trend analysis and processing components
 * that convert market signals into actionable market trends.
 */

import { MarketSignal, MarketTrend } from '../MarketScanner.interface';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Configuration for trend analysis
 */
export interface TrendAnalysisConfig {
  minConfidence?: number; // Minimum confidence score (0-1)
  maxTrends?: number; // Maximum trends to extract
  useLlm?: boolean; // Whether to use LLM for analysis
  modelName?: string; // Model name for LLM analysis
  mergeSimilarTrends?: boolean; // Whether to merge similar trends
  similarityThreshold?: number; // Threshold for similarity (0-1)
}

/**
 * Analysis result from processing market signals
 */
export interface TrendAnalysisResult {
  trends: MarketTrend[];
  confidence: number; // Overall confidence (0-1)
  processingTime: number; // In milliseconds
  signalsProcessed: number;
  metadata: Record<string, unknown>;
}

/**
 * Trend analyzer interface
 */
export interface ITrendAnalyzer {
  /**
   * Initialize the trend analyzer
   * 
   * @param model Optional LLM model to use
   * @param config Configuration options
   */
  initialize(model?: ChatOpenAI, config?: TrendAnalysisConfig): Promise<void>;
  
  /**
   * Process market signals to extract trends
   * 
   * @param signals Market signals to analyze
   * @param context Optional context information
   * @returns Analysis result with extracted trends
   */
  analyzeSignals(
    signals: MarketSignal[], 
    context?: Record<string, unknown>
  ): Promise<TrendAnalysisResult>;
  
  /**
   * Merge similar trends to avoid duplication
   * 
   * @param trends Trends to merge
   * @param similarityThreshold Threshold for similarity (0-1)
   * @returns Merged trends
   */
  mergeSimilarTrends(
    trends: MarketTrend[], 
    similarityThreshold?: number
  ): Promise<MarketTrend[]>;
  
  /**
   * Calculate trend score based on various factors
   * 
   * @param trend Trend to score
   * @param context Optional context for scoring
   * @returns Updated trend with new score
   */
  calculateTrendScore(
    trend: MarketTrend, 
    context?: Record<string, unknown>
  ): Promise<MarketTrend>;
  
  /**
   * Determine trend stage based on various factors
   * 
   * @param trend Trend to evaluate
   * @param context Optional context for evaluation
   * @returns Updated trend with new stage
   */
  determineTrendStage(
    trend: MarketTrend, 
    context?: Record<string, unknown>
  ): Promise<MarketTrend>;
} 