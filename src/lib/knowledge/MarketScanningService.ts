import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { CronJob } from 'cron';
import { logger } from '../logging';
import { KnowledgeGraphManager } from '../agents/implementations/memory/KnowledgeGraphManager';
import { KnowledgeNodeType } from '../agents/shared/memory/types';

// Interfaces for market scanning
export interface WebSearchConfig {
  apiKey?: string;
  engine?: string;
  maxResults?: number;
}

export interface NewsApiConfig {
  apiKey?: string;
  maxResults?: number;
  countries?: string[];
}

export interface ResearchApiConfig {
  apiKey?: string;
  maxResults?: number;
}

export interface MarketScanConfig {
  webSearch?: WebSearchConfig;
  newsApi?: NewsApiConfig;
  researchApi?: ResearchApiConfig;
  searchQueries?: SearchQuery[];
  schedules?: ScanScheduleConfig;
}

export interface SearchQuery {
  id: string;
  query: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  frequency: 'hourly' | 'daily' | 'weekly';
  enabled: boolean;
  lastRun?: string;
}

export interface ScanScheduleConfig {
  generalNews: string; // cron expression
  industryNews: string; // cron expression
  trendingTopics: string; // cron expression
  customQueries: string; // cron expression
}

export interface ScanResult {
  query: string;
  results: Array<{
    title: string;
    content: string;
    url: string;
    source: string;
    publishedAt?: string;
  }>;
  timestamp: string;
  count: number;
}

/**
 * Market Scanning Service
 * Handles automated web searches, news scanning, and trend detection
 */
export class MarketScanningService {
  private graphManager: KnowledgeGraphManager;
  private config: MarketScanConfig;
  private searchQueries: Map<string, SearchQuery> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private isAutonomyEnabled: boolean = false;
  
  constructor(graphManager: KnowledgeGraphManager, config?: MarketScanConfig) {
    this.graphManager = graphManager;
    
    // Default configuration
    this.config = config || {
      webSearch: {
        maxResults: 10
      },
      newsApi: {
        maxResults: 20,
        countries: ['us', 'gb']
      },
      searchQueries: [],
      schedules: {
        generalNews: '0 */8 * * *', // Every 8 hours
        industryNews: '0 9 * * *',  // Daily at 9 AM
        trendingTopics: '0 12 * * 1', // Weekly on Monday at 12 PM
        customQueries: '0 */12 * * *' // Every 12 hours
      }
    };
    
    // Initialize search queries
    if (config?.searchQueries) {
      config.searchQueries.forEach(query => {
        this.searchQueries.set(query.id, query);
      });
    } else {
      // Set up default search queries
      this.setupDefaultSearchQueries();
    }
    
    logger.info(`MarketScanningService initialized with ${this.searchQueries.size} search queries`);
  }
  
  /**
   * Setup default search queries
   */
  private setupDefaultSearchQueries() {
    const defaultQueries: SearchQuery[] = [
      {
        id: uuidv4(),
        query: 'latest AI tools for marketing',
        category: 'marketing_tools',
        importance: 'high',
        frequency: 'daily',
        enabled: true
      },
      {
        id: uuidv4(),
        query: 'customer experience personalization trends',
        category: 'customer_experience',
        importance: 'medium',
        frequency: 'weekly',
        enabled: true
      },
      {
        id: uuidv4(),
        query: 'social media algorithm changes',
        category: 'social_media',
        importance: 'high',
        frequency: 'daily',
        enabled: true
      },
      {
        id: uuidv4(),
        query: 'email marketing automation best practices',
        category: 'email_marketing',
        importance: 'medium',
        frequency: 'weekly',
        enabled: true
      },
      {
        id: uuidv4(),
        query: 'content marketing ROI measurement',
        category: 'content_marketing',
        importance: 'medium',
        frequency: 'weekly',
        enabled: true
      }
    ];
    
    defaultQueries.forEach(query => {
      this.searchQueries.set(query.id, query);
    });
  }
  
  /**
   * Run a web search and add relevant knowledge
   */
  public async runWebSearch(query: string, category: string): Promise<ScanResult> {
    try {
      logger.info(`Running web search for: ${query}`);
      
      // Implement web search API call here
      // For now, using a simulated result
      const results = await this.simulateWebSearchResults(query);
      
      const scanResult: ScanResult = {
        query,
        results,
        timestamp: new Date().toISOString(),
        count: results.length
      };
      
      // Add knowledge nodes for each result
      for (const result of results) {
        try {
          const nodeId = `web-${uuidv4()}`;
          await this.graphManager.addNode({
            id: nodeId,
            label: result.title,
            type: 'resource' as KnowledgeNodeType,
            description: result.content,
            tags: [category, 'web_search', result.source],
            metadata: {
              url: result.url,
              source: result.source,
              publishedAt: result.publishedAt,
              scanType: 'web_search',
              query,
              category,
              addedAt: new Date().toISOString()
            }
          });
          
          logger.info(`Added knowledge node from web search result: ${result.title}`);
        } catch (error) {
          logger.error(`Error adding knowledge node from web search: ${error}`);
        }
      }
      
      return scanResult;
    } catch (error) {
      logger.error(`Error in web search: ${error}`);
      throw error;
    }
  }
  
  /**
   * Scan news sources for relevant information
   */
  public async scanNewsSource(category?: string): Promise<ScanResult> {
    try {
      logger.info(`Scanning news sources${category ? ` for category: ${category}` : ''}`);
      
      // Implement news API call here
      // For now, using simulated results
      const results = await this.simulateNewsResults('', category);
      
      const scanResult: ScanResult = {
        query: category || 'general',
        results,
        timestamp: new Date().toISOString(),
        count: results.length
      };
      
      // Add knowledge nodes for each result
      for (const result of results) {
        try {
          const nodeId = `news-${uuidv4()}`;
          await this.graphManager.addNode({
            id: nodeId,
            label: result.title,
            type: 'event' as KnowledgeNodeType,
            description: result.content,
            tags: [category || 'general', 'news', result.source],
            metadata: {
              url: result.url,
              source: result.source,
              publishedAt: result.publishedAt,
              scanType: 'news_scan',
              category: category || 'general',
              addedAt: new Date().toISOString()
            }
          });
          
          logger.info(`Added knowledge node from news result: ${result.title}`);
        } catch (error) {
          logger.error(`Error adding knowledge node from news: ${error}`);
        }
      }
      
      return scanResult;
    } catch (error) {
      logger.error(`Error in news scan: ${error}`);
      throw error;
    }
  }
  
  /**
   * Scan research papers for relevant information
   */
  public async scanResearchPapers(topic?: string): Promise<ScanResult> {
    try {
      logger.info(`Scanning research papers${topic ? ` for topic: ${topic}` : ''}`);
      
      // Implement research API call here
      // For now, using simulated results
      const results = await this.simulateResearchResults(topic || '');
      
      const scanResult: ScanResult = {
        query: topic || 'general',
        results,
        timestamp: new Date().toISOString(),
        count: results.length
      };
      
      // Add knowledge nodes for each result
      for (const result of results) {
        try {
          const nodeId = `research-${uuidv4()}`;
          await this.graphManager.addNode({
            id: nodeId,
            label: result.title,
            type: 'resource' as KnowledgeNodeType,
            description: result.content,
            tags: [topic || 'general', 'research', result.source],
            metadata: {
              url: result.url,
              source: result.source,
              publishedAt: result.publishedAt,
              scanType: 'research_scan',
              topic: topic || 'general',
              addedAt: new Date().toISOString()
            }
          });
          
          logger.info(`Added knowledge node from research result: ${result.title}`);
        } catch (error) {
          logger.error(`Error adding knowledge node from research: ${error}`);
        }
      }
      
      return scanResult;
    } catch (error) {
      logger.error(`Error in research scan: ${error}`);
      throw error;
    }
  }
  
  /**
   * Detect trending topics from recent knowledge nodes
   */
  public async detectTrendingTopics(): Promise<string[]> {
    try {
      // Get recent nodes
      const recentNodes = await this.graphManager.findNodes('', undefined, 100);
      
      // Extract topics from node tags and descriptions
      const topics = new Map<string, number>();
      
      for (const node of recentNodes) {
        // Count tag occurrences
        node.tags?.forEach(tag => {
          if (tag !== 'web_search' && tag !== 'news' && tag !== 'research') {
            topics.set(tag, (topics.get(tag) || 0) + 1);
          }
        });
      }
      
      // Sort topics by frequency
      const sortedTopics = Array.from(topics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic]) => topic);
      
      return sortedTopics;
    } catch (error) {
      logger.error(`Error detecting trending topics: ${error}`);
      return [];
    }
  }
  
  /**
   * Set up scheduled scans using cron jobs
   */
  public setupScheduledScans(): void {
    try {
      const schedules = this.config.schedules || {
        generalNews: '0 */8 * * *', // Every 8 hours
        industryNews: '0 9 * * *',  // Daily at 9 AM
        trendingTopics: '0 12 * * 1', // Weekly on Monday at 12 PM
        customQueries: '0 */12 * * *' // Every 12 hours
      };
      
      // Schedule general news scan
      this.createCronJob('general-news', schedules.generalNews, async () => {
        logger.info('Running scheduled general news scan');
        await this.scanNewsSource();
      });
      
      // Schedule industry news scan
      this.createCronJob('industry-news', schedules.industryNews, async () => {
        logger.info('Running scheduled industry news scan');
        const categories = ['marketing', 'social_media', 'content_strategy', 'analytics'];
        for (const category of categories) {
          await this.scanNewsSource(category);
        }
      });
      
      // Schedule trending topic detection
      this.createCronJob('trending-topics', schedules.trendingTopics, async () => {
        logger.info('Running scheduled trending topic detection');
        const topics = await this.detectTrendingTopics();
        
        // Research each trending topic
        for (const topic of topics) {
          await this.scanResearchPapers(topic);
        }
      });
      
      // Schedule custom queries
      this.createCronJob('custom-queries', schedules.customQueries, async () => {
        logger.info('Running scheduled custom queries');
        
        // Get all enabled queries
        const enabledQueries = Array.from(this.searchQueries.values())
          .filter(query => query.enabled);
          
        // Run each query
        for (const query of enabledQueries) {
          await this.runWebSearch(query.query, query.category);
          
          // Update last run time
          query.lastRun = new Date().toISOString();
          this.searchQueries.set(query.id, query);
        }
      });
      
      logger.info('Scheduled market scans have been set up');
    } catch (error) {
      logger.error(`Error setting up scheduled scans: ${error}`);
    }
  }
  
  /**
   * Create a cron job and store it
   */
  private createCronJob(id: string, cronExpression: string, taskFn: () => Promise<void>): void {
    // Stop any existing job with the same ID
    if (this.cronJobs.has(id)) {
      this.cronJobs.get(id)?.stop();
    }
    
    // Create and store the new job
    const job = new CronJob(
      cronExpression,
      async () => {
        if (this.isAutonomyEnabled) {
          try {
            await taskFn();
          } catch (error) {
            logger.error(`Error executing scheduled task ${id}: ${error}`);
          }
        } else {
          logger.info(`Skipping scheduled task ${id} because autonomy is disabled`);
        }
      },
      null, // onComplete
      false, // start
      'UTC' // timezone
    );
    
    this.cronJobs.set(id, job);
    
    // Start the job if autonomy is enabled
    if (this.isAutonomyEnabled) {
      job.start();
      logger.info(`Started scheduled task: ${id} (${cronExpression})`);
    }
  }
  
  /**
   * Enable or disable autonomy mode
   */
  public setAutonomyMode(enabled: boolean): void {
    this.isAutonomyEnabled = enabled;
    
    // Start or stop all cron jobs
    this.cronJobs.forEach((job, id) => {
      if (enabled) {
        job.start();
        logger.info(`Started scheduled task: ${id}`);
      } else {
        job.stop();
        logger.info(`Stopped scheduled task: ${id}`);
      }
    });
    
    logger.info(`Market scanning autonomy mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Add a new search query
   */
  public addSearchQuery(query: Omit<SearchQuery, 'id'>): string {
    const id = uuidv4();
    const newQuery: SearchQuery = {
      ...query,
      id
    };
    
    this.searchQueries.set(id, newQuery);
    logger.info(`Added new search query: ${query.query} (${id})`);
    
    return id;
  }
  
  /**
   * Remove a search query
   */
  public removeSearchQuery(id: string): boolean {
    if (!this.searchQueries.has(id)) {
      return false;
    }
    
    this.searchQueries.delete(id);
    logger.info(`Removed search query: ${id}`);
    
    return true;
  }
  
  /**
   * Get all search queries
   */
  public getSearchQueries(): SearchQuery[] {
    return Array.from(this.searchQueries.values());
  }
  
  /**
   * Set a search query's enabled status
   */
  public setQueryEnabled(id: string, enabled: boolean): boolean {
    const query = this.searchQueries.get(id);
    if (!query) {
      return false;
    }
    
    query.enabled = enabled;
    this.searchQueries.set(id, query);
    
    logger.info(`${enabled ? 'Enabled' : 'Disabled'} search query: ${id}`);
    return true;
  }
  
  /**
   * Run a search query immediately
   */
  public async runQueryNow(id: string): Promise<ScanResult | null> {
    const query = this.searchQueries.get(id);
    if (!query) {
      return null;
    }
    
    try {
      const result = await this.runWebSearch(query.query, query.category);
      
      // Update last run time
      query.lastRun = new Date().toISOString();
      this.searchQueries.set(id, query);
      
      return result;
    } catch (error) {
      logger.error(`Error running query ${id} now: ${error}`);
      return null;
    }
  }
  
  /**
   * Simulated web search results (for testing)
   */
  private async simulateWebSearchResults(query: string): Promise<ScanResult['results']> {
    // In a real implementation, this would call an external search API
    
    // Generate 3-5 simulated results
    const count = 3 + Math.floor(Math.random() * 3);
    const results: ScanResult['results'] = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        title: `${query} - Result ${i+1}`,
        content: `This is simulated content for the search query "${query}". This would contain a summary of the web page content, highlighting key information related to the search query. It would typically be a few paragraphs long and provide useful insights.`,
        url: `https://example.com/result-${i+1}`,
        source: `Example Source ${i+1}`,
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 30 days
      });
    }
    
    return results;
  }
  
  /**
   * Simulated news results (for testing)
   */
  private async simulateNewsResults(query: string, category?: string): Promise<ScanResult['results']> {
    // In a real implementation, this would call a news API
    
    // Generate 5-8 simulated results
    const count = 5 + Math.floor(Math.random() * 4);
    const results: ScanResult['results'] = [];
    
    const catText = category ? ` in ${category}` : '';
    
    for (let i = 0; i < count; i++) {
      results.push({
        title: `Breaking News${catText}: ${query} Development ${i+1}`,
        content: `This is simulated news content related to "${query}"${catText}. This would contain a summary of the news article, highlighting key information and developments. It would typically include quotes from industry experts, statistics, and analysis of the implications.`,
        url: `https://news-example.com/article-${i+1}`,
        source: `News Source ${i+1}`,
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 7 days
      });
    }
    
    return results;
  }
  
  /**
   * Simulated research paper results (for testing)
   */
  private async simulateResearchResults(query: string): Promise<ScanResult['results']> {
    // In a real implementation, this would call a research paper API
    
    // Generate 2-4 simulated results
    const count = 2 + Math.floor(Math.random() * 3);
    const results: ScanResult['results'] = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        title: `Research: ${query} - Study ${i+1}`,
        content: `This is simulated research paper content related to "${query}". The paper investigates the impact and effectiveness of various approaches and methodologies. It contains an abstract, methodology, results, and discussion sections with academic analysis and findings supported by data.`,
        url: `https://research-example.com/paper-${i+1}`,
        source: `Journal of ${query.split(' ')[0]} Studies`,
        publishedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 90 days
      });
    }
    
    return results;
  }
}

/**
 * Create a new instance of MarketScanningService
 */
export function createMarketScanningService(
  graphManager: KnowledgeGraphManager,
  config?: MarketScanConfig
): MarketScanningService {
  return new MarketScanningService(graphManager, config);
} 