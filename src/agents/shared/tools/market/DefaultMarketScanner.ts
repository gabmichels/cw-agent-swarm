/**
 * DefaultMarketScanner.ts - Default implementation of the Market Scanner
 * 
 * This file provides a concrete implementation of the IMarketScanner interface
 * that detects and analyzes market trends for AI tools and automation.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../../../lib/logging';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import {
  IMarketScanner,
  MarketSource,
  MarketSignal,
  MarketTrend,
  MarketScannerConfig,
  MarketScanResult
} from './MarketScanner.interface';

import { ISourceManager } from './interfaces/MarketSource.interface';
import { ITrendAnalyzer } from './interfaces/TrendAnalysis.interface';
// TODO: Uncomment these when implementations are available
// import { DefaultSourceManager } from './processors/DefaultSourceManager';
// import { DefaultTrendAnalyzer } from './analysis/DefaultTrendAnalyzer';
import { DefaultRssProcessor } from './processors/rss/DefaultRssProcessor';
import { ISourceProcessor, IRssProcessor } from './interfaces/SourceProcessor.interface';
import { RssSource } from './interfaces/MarketSource.interface';

// Import our DefaultApifyManager
import defaultApifyManager, { IApifyManager } from '../integrations/apify';

// This is a reference to our DefaultApifyManager implementation
// In the future, this could be injected for better testability
let apifyManager: IApifyManager = defaultApifyManager;

/**
 * Default implementation of the Market Scanner
 */
export class DefaultMarketScanner implements IMarketScanner {
  private sourceManager: ISourceManager;
  private trendAnalyzer: ITrendAnalyzer;
  private config: MarketScannerConfig;
  private isEnabled: boolean = false;
  private cachedTrends: MarketTrend[] = [];
  private lastScanTime: Date | null = null;
  private isScanning: boolean = false;
  private model: ChatOpenAI | null = null;
  private rssProcessor: IRssProcessor;

  /**
   * Create a new DefaultMarketScanner instance
   * 
   * @param config Configuration options
   */
  constructor(config: MarketScannerConfig = {}) {
    this.config = {
      maxResults: config.maxResults || 100,
      scanFrequency: config.scanFrequency || 24 * 60 * 60 * 1000, // Default: daily
      apiKeys: config.apiKeys || {},
      sources: config.sources || [
        'news',
        'research',
        'social',
        'conferences',
        'llm'
      ],
      dataDir: config.dataDir || path.join(process.cwd(), 'data', 'sources'),
      enabled: config.enabled !== undefined ? config.enabled : true
    };

    // Initialize with default implementations
    // These could be injected for better testability
    
    // TODO: Replace these with actual implementations when available
    // For now, create placeholder implementations
    this.sourceManager = {
      loadSources: async () => [],
      addSource: async () => {},
      removeSource: async () => false,
      updateSource: async (id: string, updates: Partial<MarketSource>): Promise<MarketSource> => {
        // Create a properly typed MarketSource object
        return {
          id,
          type: updates.type || 'rss', // Default to RSS
          url: updates.url || '',
          category: updates.category || 'default',
          theme: updates.theme || 'general',
          refresh_interval: updates.refresh_interval || 24,
          last_checked: updates.last_checked
        };
      },
      getSourcesByCategory: async () => [],
      getDueSources: async () => [],
      updateSourceTimestamp: async () => {}
    };
    
    this.trendAnalyzer = {
      initialize: async () => {},
      analyzeSignals: async () => ({ 
        trends: [], 
        confidence: 0, 
        processingTime: 0, 
        signalsProcessed: 0, 
        metadata: {} 
      }),
      mergeSimilarTrends: async (trends) => trends,
      calculateTrendScore: async (trend) => trend,
      determineTrendStage: async (trend) => trend
    };
    
    this.rssProcessor = new DefaultRssProcessor();
    
    // Check if the data directory exists
    try {
      if (!fs.existsSync(this.config.dataDir!)) {
        fs.mkdirSync(this.config.dataDir!, { recursive: true });
        logger.info('Created source directory:', this.config.dataDir);
      }
      this.isEnabled = this.config.enabled ?? true;
    } catch (error) {
      logger.error('Failed to initialize market scanner data directory:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Initialize the market scanner with an LLM
   * 
   * @param model Optional LLM model to use for trend generation
   */
  async initialize(model?: ChatOpenAI): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('Market scanner is disabled, skipping initialization');
      return;
    }

    this.model = model || new ChatOpenAI({
      temperature: 0.2,
      modelName: 'gpt-4',
    });
    
    // Initialize components
    await this.trendAnalyzer.initialize(this.model);
    
    // Load initial trends if cache is empty
    if (this.cachedTrends.length === 0) {
      await this.refreshTrends();
    }
    
    logger.info('Market scanner initialized successfully');
  }

  /**
   * Run a market scan across all sources or specific categories
   * 
   * @param categories Optional list of categories to scan
   * @returns Number of signals processed
   */
  async runMarketScan(categories?: string[]): Promise<number> {
    if (!this.isEnabled) {
      logger.warn('Attempted to run market scan but scanner is disabled');
      return 0;
    }

    let scanCount = 0;
    logger.info(`Starting market scan${categories ? ` for categories: ${categories.join(', ')}` : ''}`);
    
    try {
      // Get sources that are due for refresh
      const dueSources = await this.sourceManager.getDueSources();
      
      // Filter by category if specified
      const filteredSources = categories 
        ? dueSources.filter(source => categories.includes(source.category))
        : dueSources;
      
      logger.info(`Found ${filteredSources.length} sources due for refresh`);
      
      // Process each source and collect signals
      const allSignals: MarketSignal[] = [];
      
      for (const source of filteredSources) {
        try {
          // Process the source to get signals
          const signals = await this.processSource(source);
          
          if (signals.length > 0) {
            logger.info(`Processed ${source.id} (${source.type}) and found ${signals.length} signals`);
            allSignals.push(...signals);
            scanCount += signals.length;
            
            // Update the last_checked timestamp
            await this.sourceManager.updateSourceTimestamp(source.id);
          } else {
            logger.info(`Processed ${source.id} (${source.type}) but found no signals`);
          }
        } catch (error) {
          logger.error(`Error processing source ${source.id}:`, error);
        }
      }
      
      // Analyze signals to find trends if we have enough signals
      if (allSignals.length > 0) {
        const analysisResult = await this.trendAnalyzer.analyzeSignals(allSignals);
        logger.info(`Analyzed ${allSignals.length} signals and found ${analysisResult.trends.length} trends`);
        
        // Update cached trends
        this.mergeWithCachedTrends(analysisResult.trends);
      }
      
      logger.info(`Market scan complete, processed ${scanCount} signals`);
      return scanCount;
    } catch (error) {
      logger.error('Error running market scan:', error);
      return 0;
    }
  }

  /**
   * Get current market trends
   * 
   * @param category Optional category to filter trends
   * @param minScore Minimum score threshold (0-100)
   * @param limit Maximum number of trends to return
   * @returns List of market trends
   */
  async getTrends(
    category?: string, 
    minScore: number = 0, 
    limit: number = 10
  ): Promise<MarketTrend[]> {
    // Check if we need to refresh trends based on scanFrequency
    const now = new Date();
    if (
      !this.lastScanTime || 
      now.getTime() - this.lastScanTime.getTime() > this.config.scanFrequency!
    ) {
      await this.refreshTrends();
    }
    
    // Filter trends based on params
    let filteredTrends = [...this.cachedTrends];
    
    if (category) {
      filteredTrends = filteredTrends.filter(
        trend => trend.category === category
      );
    }
    
    if (minScore > 0) {
      filteredTrends = filteredTrends.filter(
        trend => trend.score >= minScore
      );
    }
    
    // Sort by score descending and limit results
    return filteredTrends
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Refresh market trends from all configured sources
   * 
   * @returns Updated list of market trends
   */
  async refreshTrends(): Promise<MarketTrend[]> {
    if (this.isScanning) {
      return this.cachedTrends;
    }
    
    this.isScanning = true;
    const startTime = Date.now();
    
    try {
      // Scan each source in parallel
      const scanPromises = this.config.sources!.map(source => 
        this.scanSource(source)
      );
      
      const results = await Promise.all(scanPromises);
      
      // Merge and deduplicate trends
      const allTrends: MarketTrend[] = [];
      const trendIds = new Set<string>();
      
      for (const result of results) {
        for (const trend of result.trends) {
          if (!trendIds.has(trend.id)) {
            allTrends.push(trend);
            trendIds.add(trend.id);
          } else {
            // Merge with existing trend
            this.mergeTrend(allTrends, trend);
          }
        }
      }
      
      // Sort by score and limit results
      this.cachedTrends = allTrends
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxResults);
      
      this.lastScanTime = new Date();
      return this.cachedTrends;
    } catch (error) {
      logger.error('Error refreshing market trends:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Create a market trend finder tool for use in LLM agents
   * 
   * @returns Structured tool for finding market trends
   */
  createMarketTrendTool(): StructuredTool {
    const schema = z.object({
      category: z.enum(['ai', 'automation', 'integration', 'analytics', 'other']).optional(),
      minScore: z.number().min(0).max(100).optional(),
      limit: z.number().min(1).max(20).optional(),
      refresh: z.boolean().optional()
    });
    
    return new StructuredTool({
      name: 'find_market_trends',
      description: 'Find current market trends in AI and automation technologies',
      schema: schema,
      func: async ({ 
        category, 
        minScore = 50, 
        limit = 5, 
        refresh = false 
      }: { 
        category?: string; 
        minScore?: number; 
        limit?: number; 
        refresh?: boolean; 
      }) => {
        if (refresh) {
          await this.refreshTrends();
        }
        
        const trends = await this.getTrends(
          category,
          minScore,
          limit
        );
        
        return JSON.stringify(trends, null, 2);
      }
    });
  }

  /**
   * Process a specific source to extract market signals
   * 
   * @param source Source to process
   * @returns Extracted market signals
   */
  private async processSource(source: MarketSource): Promise<MarketSignal[]> {
    try {
      let signals: MarketSignal[] = [];

      switch (source.type) {
        case 'rss':
          // Process RSS using our dedicated processor
          // Use type assertion to satisfy TypeScript
          signals = await this.rssProcessor.processSource(source as RssSource);
          break;
          
        case 'reddit':
          // Use ApifyManager for Reddit
          signals = await this.processRedditSource(source);
          break;
          
        case 'twitter':
          // Use ApifyManager for Twitter
          signals = await this.processTwitterSource(source);
          break;
          
        default:
          logger.warn(`Unknown source type: ${source.type}`);
          break;
      }

      return signals;
    } catch (error) {
      logger.error(`Error processing source ${source.id}:`, error);
      return [];
    }
  }
  
  /**
   * Process a Reddit source using ApifyManager
   * 
   * @param source Reddit source to process
   * @returns Extracted market signals
   */
  private async processRedditSource(source: MarketSource): Promise<MarketSignal[]> {
    try {
      // Extract search query from URL
      const url = source.url;
      let searchTerm = '';
      
      // Handle subreddit URLs
      if (url.includes('r/') || url.startsWith('r/')) {
        // Extract subreddit name
        const subredditMatch = url.match(/r\/([a-zA-Z0-9_]+)/);
        if (subredditMatch && subredditMatch[1]) {
          searchTerm = subredditMatch[1];
        } else {
          searchTerm = url;
        }
      } else {
        // Use URL as is for search term
        searchTerm = url;
      }
      
      logger.info(`Processing Reddit source ${source.id} with query: ${searchTerm}`);
      
      // Use ApifyManager to run Reddit search
      const result = await apifyManager.runRedditSearch(searchTerm, false, 25);
      
      if (!result.success || !result.output) {
        logger.warn(`Failed to process Reddit source ${source.id}`);
        return [];
      }
      
      // Convert Apify results to market signals
      const signals: MarketSignal[] = [];
      const now = new Date();
      
      for (const post of result.output) {
        // Extract post data
        const title = post.title || 'Untitled';
        const content = post.text || post.description || '';
        const postUrl = post.url || post.permalink || '';
        const community = post.community || post.subreddit || '';
        
        // Parse date
        let published = now;
        if (post.postedAt) {
          published = new Date(post.postedAt);
        } else if (post.created) {
          published = new Date(post.created * 1000);
        }
        
        // Create signal
        signals.push({
          title,
          content: this.cleanContent(content),
          source: `Reddit - ${community}`,
          sourceType: 'reddit',
          category: source.category,
          theme: source.theme,
          url: postUrl,
          published,
          retrieved: now
        });
      }
      
      logger.info(`Processed Reddit source ${source.id} and found ${signals.length} signals`);
      return signals;
    } catch (error) {
      logger.error(`Error processing Reddit source ${source.id}:`, error);
      return [];
    }
  }
  
  /**
   * Process a Twitter source using ApifyManager
   * 
   * @param source Twitter source to process
   * @returns Extracted market signals
   */
  private async processTwitterSource(source: MarketSource): Promise<MarketSignal[]> {
    try {
      // Extract search query from URL
      let searchTerm = '';
      
      if (source.url.startsWith('search:')) {
        searchTerm = source.url.substring(7);
      } else {
        searchTerm = source.url;
      }
      
      logger.info(`Processing Twitter source ${source.id} with query: ${searchTerm}`);
      
      // Use ApifyManager to run Twitter search
      const result = await apifyManager.runTwitterSearch(searchTerm, false, 25);
      
      if (!result.success || !result.output) {
        logger.warn(`Failed to process Twitter source ${source.id}`);
        return [];
      }
      
      // Convert Apify results to market signals
      const signals: MarketSignal[] = [];
      const now = new Date();
      
      for (const tweet of result.output) {
        // Extract tweet data
        const title = `Tweet by @${tweet.username || 'unknown'}`;
        const content = tweet.text || tweet.content || tweet.full_text || '';
        const tweetUrl = tweet.url || '';
        
        // Parse date
        let published = now;
        if (tweet.date) {
          published = new Date(tweet.date);
        } else if (tweet.created_at) {
          published = new Date(tweet.created_at);
        }
        
        // Create signal
        signals.push({
          title,
          content,
          source: `Twitter - ${searchTerm}`,
          sourceType: 'twitter',
          category: source.category,
          theme: source.theme,
          url: tweetUrl,
          published,
          retrieved: now
        });
      }
      
      logger.info(`Processed Twitter source ${source.id} and found ${signals.length} signals`);
      return signals;
    } catch (error) {
      logger.error(`Error processing Twitter source ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Clean HTML content from feed items
   * 
   * @param content Content to clean
   * @returns Cleaned content
   */
  private cleanContent(content: string): string {
    try {
      // Remove HTML tags
      const withoutTags = content.replace(/<\/?[^>]+(>|$)/g, ' ');
      
      // Remove excess whitespace
      const withoutExcessSpace = withoutTags.replace(/\s+/g, ' ').trim();
      
      // Limit length to a reasonable size
      return withoutExcessSpace.length > 2000 
        ? withoutExcessSpace.substring(0, 2000) + '...'
        : withoutExcessSpace;
    } catch (error) {
      logger.error(`Error cleaning content:`, error);
      return content.substring(0, 500) + '...'; // Return truncated original on error
    }
  }

  /**
   * Scan a specific source for market trends
   * 
   * @param source Source type to scan
   * @returns Scan result with trends
   */
  private async scanSource(source: string): Promise<MarketScanResult> {
    const startTime = Date.now();
    const now = new Date();
    
    // This is a placeholder implementation
    // In a real implementation, this would use proper trend analysis
    return {
      trends: [],
      timestamp: now,
      source,
      scanDuration: Date.now() - startTime
    };
  }

  /**
   * Merge a new trend with existing trends
   * 
   * @param existingTrends List of existing trends
   * @param newTrend New trend to merge
   */
  private mergeTrend(existingTrends: MarketTrend[], newTrend: MarketTrend): void {
    const existingIndex = existingTrends.findIndex(t => t.id === newTrend.id);
    if (existingIndex >= 0) {
      const existing = existingTrends[existingIndex];
      existingTrends[existingIndex] = {
        ...existing,
        score: Math.max(existing.score, newTrend.score),
        keywords: [...Array.from(new Set([...existing.keywords, ...newTrend.keywords]))],
        sources: [...Array.from(new Set([...existing.sources, ...newTrend.sources]))],
        lastUpdated: new Date(),
        relevantUserNeeds: [...Array.from(new Set([...existing.relevantUserNeeds, ...newTrend.relevantUserNeeds]))],
        estimatedBusinessImpact: Math.max(existing.estimatedBusinessImpact, newTrend.estimatedBusinessImpact)
      };
    }
  }

  /**
   * Merge new trends with cached trends
   * 
   * @param newTrends New trends to merge with cache
   */
  private mergeWithCachedTrends(newTrends: MarketTrend[]): void {
    // Add new trends that don't exist in cache
    for (const newTrend of newTrends) {
      if (!this.cachedTrends.some(t => t.id === newTrend.id)) {
        this.cachedTrends.push(newTrend);
      } else {
        // Merge with existing trend
        this.mergeTrend(this.cachedTrends, newTrend);
      }
    }
    
    // Sort by score and limit results
    this.cachedTrends = this.cachedTrends
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);
    
    this.lastScanTime = new Date();
  }
} 