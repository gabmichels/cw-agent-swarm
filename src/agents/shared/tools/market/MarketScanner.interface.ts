/**
 * MarketScanner.interface.ts - Interface for market scanning and trend analysis
 * 
 * This file defines the interface for market scanner implementations that detect
 * and analyze trends in AI, automation, and related technologies.
 */

import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Interface representing a market source
 */
export interface MarketSource {
  id: string;
  name: string;
  type: string;
  category: string;
  url?: string;
  apiEndpoint?: string;
  apiKey?: string;
  refresh_frequency?: number;
  last_checked?: number;
  parameters?: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * Interface representing a market signal from a source
 */
export interface MarketSignal {
  id: string;
  source: string;
  sourceType: string;
  title: string;
  content: string;
  url?: string;
  timestamp: Date;
  category: string;
  keywords?: string[];
  sentiment?: number; // -1 to 1
  relevance?: number; // 0 to 1
}

/**
 * Interface representing a market trend in AI and automation
 */
export interface MarketTrend {
  id: string;
  name: string;
  description: string;
  score: number; // 0-100 relevance score
  category: 'ai' | 'automation' | 'integration' | 'analytics' | 'other';
  keywords: string[];
  sources: string[];
  firstDetected: Date;
  lastUpdated: Date;
  stage: 'emerging' | 'growing' | 'mainstream' | 'declining';
  relevantUserNeeds: string[];
  estimatedBusinessImpact: number; // 0-100 score
}

/**
 * Configuration for the market scanner
 */
export interface MarketScannerConfig {
  maxResults?: number;
  scanFrequency?: number; // in milliseconds
  apiKeys?: {
    news?: string;
    research?: string;
    trends?: string;
    apify?: string;
  };
  sources?: string[];
  dataDir?: string;
  enabled?: boolean;
}

/**
 * Result of a market scan operation
 */
export interface MarketScanResult {
  trends: MarketTrend[];
  timestamp: Date;
  source: string;
  scanDuration: number; // in milliseconds
}

/**
 * Market Scanner interface that defines the contract for any
 * implementation that detects and analyzes market trends
 */
export interface IMarketScanner {
  /**
   * Initialize the market scanner with an LLM
   * 
   * @param model Optional LLM model to use for trend generation
   */
  initialize(model?: ChatOpenAI): Promise<void>;
  
  /**
   * Run a market scan across all sources or specific categories
   * 
   * @param categories Optional list of categories to scan
   * @returns Number of signals processed
   */
  runMarketScan(categories?: string[]): Promise<number>;
  
  /**
   * Get current market trends
   * 
   * @param category Optional category to filter trends
   * @param minScore Minimum score threshold (0-100)
   * @param limit Maximum number of trends to return
   * @returns List of market trends
   */
  getTrends(category?: string, minScore?: number, limit?: number): Promise<MarketTrend[]>;
  
  /**
   * Refresh market trends from all configured sources
   * 
   * @returns Updated list of market trends
   */
  refreshTrends(): Promise<MarketTrend[]>;
  
  /**
   * Create a market trend finder tool for use in LLM agents
   * 
   * @returns Structured tool for finding market trends
   */
  createMarketTrendTool(): StructuredTool;
  
  /**
   * Create market scanner command tool for natural language interactions
   * 
   * @returns Command tool for market scanning
   */
  createMarketCommandTool(): StructuredTool;
  
  /**
   * Create all market scanner tools
   * 
   * @returns Array of market scanner tools
   */
  createMarketTools(): StructuredTool[];
} 