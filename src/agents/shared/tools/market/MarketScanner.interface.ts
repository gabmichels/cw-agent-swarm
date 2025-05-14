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
  type: 'rss' | 'reddit' | 'twitter';
  url: string;
  category: string;
  theme: string;
  refresh_interval: number; // in hours
  last_checked?: string;
}

/**
 * Interface representing a market signal from a source
 */
export interface MarketSignal {
  title: string;
  content: string;
  source: string;
  sourceType: string;
  category: string;
  theme: string;
  url: string;
  published: Date;
  retrieved: Date;
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
} 