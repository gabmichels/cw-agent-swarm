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
import { DefaultSourceManager } from './processors/DefaultSourceManager';
import { DefaultTrendAnalyzer } from './analysis/DefaultTrendAnalyzer';
import { DefaultRssProcessor } from './processors/rss/DefaultRssProcessor';
import { ISourceProcessor, IRssProcessor } from './interfaces/SourceProcessor.interface';
import { RssSource } from './interfaces/MarketSource.interface';

// Import our DefaultApifyManager
import defaultApifyManager, { IApifyManager } from '../integrations/apify';

// Initialize Apify manager with the default implementation
const apifyManager: IApifyManager = defaultApifyManager;

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
      apiKeys: config.apiKeys || {
        news: process.env.NEWS_API_KEY,
        research: process.env.RESEARCH_API_KEY,
        trends: process.env.TRENDS_API_KEY
      },
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

    // Initialize the source manager and trend analyzer with real implementations
    this.sourceManager = new DefaultSourceManager(this.config);
    this.trendAnalyzer = new DefaultTrendAnalyzer();
    
    // Initialize RssProcessor with the real implementation
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
    
    // Create default sources if none exist
    this.createDefaultSources();
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
      modelName: 'gpt-4.1-2025-04-14',
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
   * Create market scanner command tool for natural language interactions
   * 
   * @returns Command tool for market scanning
   */
  createMarketCommandTool(): StructuredTool {
    return new StructuredTool({
      name: 'market_scan_command',
      description: 'Execute market scanning commands using natural language',
      schema: z.object({
        command: z.string().describe('Natural language command for market scanning, like "scan the market for AI trends" or "schedule daily market scan at 9am"')
      }),
      func: async ({ command }: { command: string }) => {
        try {
          // Dynamically import to avoid circular dependency
          const { parseMarketScanCommand, MarketScanCommandType } = await import('./MarketScannerNLP');
          
          // Parse the command
          const parsedCommand = parseMarketScanCommand(command);
          
          if (!parsedCommand) {
            return "I couldn't understand your market scanning command. Try phrases like 'scan the market for AI trends' or 'schedule a daily market scan at 9 AM'.";
          }
          
          // For immediate scans, handle directly
          if (parsedCommand.type === MarketScanCommandType.IMMEDIATE_SCAN) {
            // Refresh trends if requested
            await this.refreshTrends();
            
            // Get trends
            const category = parsedCommand.category;
            const minScore = parsedCommand.minScore || 50;
            const limit = parsedCommand.limit || 10;
            
            const trends = await this.getTrends(category, minScore, limit);
            
            if (trends.length === 0) {
              return `No market trends found${category ? ` for category '${category}'` : ''}.`;
            }
            
            // Format the trends into a readable response
            let response = `Found ${trends.length} market trends${category ? ` for category '${category}'` : ''}:\n\n`;
            
            trends.forEach((trend, index) => {
              response += `${index + 1}. ${trend.name} (Score: ${trend.score}/100)\n`;
              response += `   ${trend.description}\n`;
              response += `   Category: ${trend.category}, Stage: ${trend.stage}\n`;
              response += `   Keywords: ${trend.keywords.join(', ')}\n\n`;
            });
            
            return response;
          }
          
          // For other commands, import the necessary components dynamically
          const { MarketScanScheduler } = await import('./MarketScanScheduler'); 
          const scheduler = new MarketScanScheduler(this);
          
          // Initialize the scheduler with a scheduler manager
          const { createSchedulerManager } = await import('../../../../lib/scheduler/factories/SchedulerFactory');
          const schedulerManager = await createSchedulerManager({
            schedulingIntervalMs: 60000, // Check every minute
            maxConcurrentTasks: 3, // Max 3 concurrent scans
            defaultTaskTimeoutMs: 5 * 60 * 1000, // 5 minute timeout
            enabled: true,
          });
          
          await scheduler.initialize(schedulerManager);
          
          // Create a one-time tool instance to handle the command
          const { MarketScannerTool } = await import('./MarketScannerTool');
          const tool = new MarketScannerTool(this, scheduler);
          
          // Execute the command using the tool
          return await tool._call({ command });
        } catch (error) {
          logger.error('Error handling market scan command:', error);
          return `Error processing market scan command: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    });
  }
  
  /**
   * Create all market scanner tools
   * 
   * @returns Array of market scanner tools
   */
  createMarketTools(): StructuredTool[] {
    return [
      this.createMarketTrendTool(),
      this.createMarketCommandTool()
    ];
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
   * Process a Reddit source using Apify
   */
  private async processRedditSource(source: MarketSource): Promise<MarketSignal[]> {
    if (!source.url) {
      logger.error(`Reddit source ${source.id} has no URL`);
      return [];
    }

    logger.info(`Processing Reddit source: ${source.id} - ${source.url}`);
    
    try {
      const result = await apifyManager.runRedditSearch(
        source.url,
        false,
        20
      );
      
      if (!result.success || !result.output) {
        logger.error(`Failed to process Reddit source ${source.id}:`, result.error);
        return [];
      }
      
      return result.output.map(post => ({
        id: `${source.id}-${post.id || Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: post.title || 'Untitled Reddit Post',
        content: post.text || post.contentText || post.description || '',
        source: `Reddit - ${source.url}`,
        sourceType: 'reddit',
        category: source.category,
        url: post.url || post.link || '',
        timestamp: post.postedAt ? new Date(post.postedAt) : new Date(),
        keywords: [],
        sentiment: 0,
        relevance: 0.5
      }));
    } catch (error) {
      logger.error(`Error processing Reddit source ${source.id}:`, error);
      return [];
    }
  }
  
  /**
   * Process a Twitter source using Apify
   */
  private async processTwitterSource(source: MarketSource): Promise<MarketSignal[]> {
    if (!source.url) {
      logger.error(`Twitter source ${source.id} has no URL`);
      return [];
    }

    logger.info(`Processing Twitter source: ${source.id} - ${source.url}`);
    
    try {
      const result = await apifyManager.runTwitterSearch(
        source.url,
        false,
        20
      );
      
      if (!result.success || !result.output) {
        logger.error(`Failed to process Twitter source ${source.id}:`, result.error);
        return [];
      }
      
      return result.output.map(tweet => ({
        id: `${source.id}-${tweet.id || Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: tweet.text ? tweet.text.substring(0, 100) : 'Tweet',
        content: tweet.text || tweet.contentText || tweet.full_text || '',
        source: `Twitter - ${tweet.username || 'Unknown'}`,
        sourceType: 'twitter',
        category: source.category,
        url: tweet.url || tweet.permalink || '',
        timestamp: tweet.postedAt ? new Date(tweet.postedAt) : new Date(),
        keywords: [],
        sentiment: 0,
        relevance: 0.5
      }));
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

  /**
   * Create default data sources if none exist
   */
  private async createDefaultSources(): Promise<void> {
    try {
      // Check if we have any sources
      const sources = await this.sourceManager.loadSources();
      
      if (sources.length === 0) {
        logger.info('Creating default market scanner data sources');
        
        // Add default RSS feeds for AI and tech news
        const defaultSources: MarketSource[] = [
          {
            id: 'techcrunch-ai',
            name: 'TechCrunch AI',
            type: 'rss',
            url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
            category: 'ai',
            refresh_frequency: 12,
            enabled: true,
            parameters: { type: 'news' }
          },
          {
            id: 'mit-tech-review',
            name: 'MIT Technology Review',
            type: 'rss',
            url: 'https://www.technologyreview.com/feed/',
            category: 'tech',
            refresh_frequency: 24,
            enabled: true,
            parameters: { type: 'research' }
          },
          {
            id: 'hn-ai',
            name: 'Hacker News AI',
            type: 'rss',
            url: 'https://hnrss.org/newest?q=artificial+intelligence',
            category: 'ai',
            refresh_frequency: 6,
            enabled: true,
            parameters: { type: 'tech' }
          },
          {
            id: 'reddit-artificial',
            name: 'Reddit Artificial Intelligence',
            type: 'reddit',
            url: 'artificial',
            category: 'ai',
            refresh_frequency: 24,
            enabled: true,
            parameters: { type: 'social' }
          },
          {
            id: 'twitter-ai',
            name: 'Twitter AI Search',
            type: 'twitter',
            url: 'artificial intelligence',
            category: 'ai',
            refresh_frequency: 12,
            enabled: true,
            parameters: { type: 'social' }
          }
        ];
        
        // Add each default source
        for (const source of defaultSources) {
          try {
            await this.sourceManager.addSource(source);
            logger.info(`Added default source: ${source.id}`);
          } catch (error) {
            logger.error(`Error adding default source ${source.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error creating default sources:', error);
    }
  }
} 