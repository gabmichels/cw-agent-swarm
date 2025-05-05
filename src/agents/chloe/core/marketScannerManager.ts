import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { createMarketScanner, MarketScanner, MarketTrend } from '../tools/marketScanner';
import { getMemoryServices } from '../../../server/memory/services';
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';
import { 
  ImportanceLevel, 
  MemoryType, 
  MemorySource
} from '../../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config/types';
import { MemoryEntry } from '../memory';
import { MarketScannerConfig, TrendParsingPatterns, Templates } from './marketScanner.config';

/**
 * Interface for trend summary results
 */
export interface TrendSummary {
  insight: string;
  tags: string[];
  category: string;
}

/**
 * Interface for trend summary response
 */
export interface TrendSummaryResponse {
  success: boolean;
  summary?: string;
  error?: string;
}

/**
 * Configuration options that can be customized
 */
export interface MarketScannerCustomConfig {
  collections?: Partial<typeof MarketScannerConfig.collections>;
  queries?: Partial<typeof MarketScannerConfig.queries>;
  limits?: Partial<typeof MarketScannerConfig.limits>;
  tags?: Partial<typeof MarketScannerConfig.tags>;
  importance?: Partial<typeof MarketScannerConfig.importance>;
}

/**
 * Options for initializing the market scanner manager
 */
export interface MarketScannerManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  logger?: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
  config?: MarketScannerCustomConfig;
}

/**
 * Manages market scanning and trend analysis for the Chloe agent
 */
export class MarketScannerManager implements IManager {
  // Required core properties
  private agentId: string;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
  // Manager-specific properties
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private notifyFunction?: (message: string) => Promise<void>;
  private scanner: MarketScanner | null = null;
  
  // Configuration
  private config: typeof MarketScannerConfig;
  
  /**
   * Creates a new MarketScannerManager instance
   * @param options Configuration options for the manager
   */
  constructor(options: MarketScannerManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.logger || null;
    this.notifyFunction = options.notifyFunction;
    
    // Initialize configuration with default values, then merge with custom config if provided
    this.config = { ...MarketScannerConfig };
    
    if (options.config) {
      // Deep merge custom configuration
      if (options.config.collections) {
        this.config.collections = { ...this.config.collections, ...options.config.collections };
      }
      if (options.config.queries) {
        this.config.queries = { ...this.config.queries, ...options.config.queries };
      }
      if (options.config.limits) {
        this.config.limits = { ...this.config.limits, ...options.config.limits };
      }
      if (options.config.tags) {
        this.config.tags = { ...this.config.tags, ...options.config.tags };
      }
      if (options.config.importance) {
        this.config.importance = { ...this.config.importance, ...options.config.importance };
      }
    }
  }

  /**
   * Get the agent ID this manager belongs to
   * Required by IManager interface
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   * Required by IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`MarketScannerManager: ${action}`, metadata);
    } else {
      logger.info(`MarketScannerManager: ${action}`, metadata);
    }
  }

  /**
   * Initialize the market scanner system
   * Required by IManager interface
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing market scanner system');
      
      // Initialize market scanner
      this.scanner = createMarketScanner();
      await this.scanner.initialize(this.model);
      
      this.initialized = true;
      this.logAction('Market scanner system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error initializing market scanner', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   * Optional but recommended method in IManager interface
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down market scanner system');
      
      // Add cleanup logic here if needed
      if (this.scanner) {
        // Cleanup scanner resources if applicable
      }
      
      this.logAction('Market scanner system shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during market scanner system shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   * Required by IManager interface
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Scan market trends based on a specific category or query
   * @param query The category or search query for scanning
   * @returns Promise that resolves to the scan results text
   */
  async scanMarketTrends(query: string): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      if (!this.scanner) {
        throw new Error('Market scanner not initialized');
      }
      
      this.logAction('Scanning market trends', { query });
      
      // Run market scan - use getTrends method which is available in MarketScanner
      const trends = await this.scanner.getTrends(
        query, 
        this.config.limits.trendResultsOffset, 
        this.config.limits.trendResultsLimit
      );
      
      // Format trends into a readable string
      const scanResults = this.formatTrendsResult(trends);
      
      // Create tags by combining base market scan tags with the query
      const tags = [...this.config.tags.marketScan, query.toLowerCase()];
      
      // Process and store the results
      await this.memory.addMemory(
        `Market Scan Results for "${query}": ${scanResults.substring(0, this.config.limits.textPreviewLength)}...`,
        StandardMemoryType.DOCUMENT,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        undefined,
        tags
      );
      
      return scanResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error scanning market trends', { 
        query, 
        error: errorMessage 
      });
      return `Error scanning market trends: ${errorMessage}`;
    }
  }

  /**
   * Format market trends into a readable string
   * @param trends The trend objects to format
   * @returns A formatted string with trend information
   */
  private formatTrendsResult(trends: MarketTrend[]): string {
    if (!trends || trends.length === 0) {
      return "No market trends found.";
    }

    return trends.map(trend => {
      // Replace template placeholders with actual values
      return Templates.trendFormat
        .replace('{name}', trend.name)
        .replace('{category}', trend.category)
        .replace('{stage}', trend.stage)
        .replace('{description}', trend.description)
        .replace('{keywords}', trend.keywords.join(', '))
        .replace('{impact}', trend.estimatedBusinessImpact.toString())
        .replace('{score}', trend.score.toString())
        .trim();
    }).join('\n\n');
  }

  /**
   * Summarize latest trends and extract insights
   * @returns Promise that resolves to a summary object with success status
   */
  async summarizeTrends(): Promise<TrendSummaryResponse> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Summarizing market trends');
      
      // Get recent market scan memories
      const recentScans = await this.memory.getRelevantMemories(
        this.config.queries.marketTrends, 
        this.config.limits.relevantMemories
      );
      
      if (!recentScans || recentScans.length === 0) {
        // No recent scans, so run a new market scan
        const newScanResults = await this.scanMarketTrends(this.config.queries.defaultTrends);
        
        // Create a proper MemoryEntry from the scan results
        const newMemoryEntry: MemoryEntry = {
          id: `scan-${Date.now()}`,
          content: newScanResults,
          category: StandardMemoryType.DOCUMENT,
          importance: ImportanceLevel.HIGH,
          source: MemorySource.SYSTEM,
          created: new Date(),
          type: StandardMemoryType.DOCUMENT
        };
        
        // Add to recentScans array
        recentScans.push(newMemoryEntry);
      }
      
      // Create a prompt from the template, replacing the placeholder with the scan content
      const prompt = Templates.trendSummarizationPrompt.replace(
        '{marketScans}', 
        recentScans.map(scan => scan.content).join('\n\n')
      );
      
      // Generate the trend summary
      const response = await this.model.invoke(prompt);
      const trendSummary = response.content.toString();
      
      // Store the trend summary in memory
      await this.memory.addMemory(
        `Trend Summary: ${trendSummary.substring(0, this.config.limits.textPreviewLength)}...`,
        StandardMemoryType.DOCUMENT,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        undefined,
        this.config.tags.trendSummary
      );
      
      // Parse trends and store as strategic insights
      const parsedTrends = this.parseTrendSummary(trendSummary);
      
      // Store each trend as a strategic insight
      for (const trend of parsedTrends) {
        await this.addStrategicInsight(trend.insight, trend.tags, trend.category);
      }
      
      // Notify about the summary if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`Completed trend analysis with ${parsedTrends.length} key insights`);
      }
      
      return { success: true, summary: trendSummary };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error summarizing trends', { error: errorMessage });
      
      if (this.notifyFunction) {
        await this.notifyFunction(`Error in trend summarization: ${errorMessage}`);
      }
      
      return { success: false, error: `Error summarizing trends: ${errorMessage}` };
    }
  }

  /**
   * Parse trend summary text into structured data
   * @param summary The trend summary text to parse
   * @returns Array of parsed trend summary objects
   */
  private parseTrendSummary(summary: string): TrendSummary[] {
    try {
      const trends: TrendSummary[] = [];
      
      // Use the extraction patterns from configuration
      const sections = summary.split(TrendParsingPatterns.sectionSplitter);
      
      // Skip the first entry if it doesn't contain trend data
      for (let i = 1; i < sections.length; i++) {
        const section = sections[i].trim();
        
        // Extract the insight
        const insightMatch = section.match(TrendParsingPatterns.insightExtractor);
        const insight = insightMatch ? insightMatch[1].trim() : '';
        
        // Extract the tags
        const tagsMatch = section.match(TrendParsingPatterns.tagsExtractor);
        const tagsString = tagsMatch ? tagsMatch[1] : '';
        const tags = tagsString.split(/,\s*/).map(tag => tag.trim()).filter(Boolean);
        
        // Extract the category
        const categoryMatch = section.match(TrendParsingPatterns.categoryExtractor);
        const category = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'general';
        
        if (insight) {
          trends.push({
            insight,
            tags: tags.length > 0 ? tags : this.config.tags.defaultTrend,
            category: category || 'general'
          });
        }
      }
      
      return trends;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error parsing trend summary', { error: errorMessage });
      return [];
    }
  }

  /**
   * Add a strategic insight to memory based on trend analysis
   */
  private async addStrategicInsight(
    insight: string, 
    tags: string[], 
    category: string = 'general'
  ): Promise<boolean> {
    try {
      if (!this.memory) {
        this.logAction('Cannot add strategic insight: memory not initialized');
        return false;
      }
      
      // Create metadata for the insight
      const metadata = {
        type: 'strategic_insight',
        category,
        tags,
        source: 'market_scanner',
        generated: new Date().toISOString()
      };
      
      // Format content for better readability and context
      const formattedInsight = `${category.toUpperCase()} INSIGHT: ${insight}`;
      
      // Add to memory with appropriate importance level
      await this.memory.addMemory(
        formattedInsight,
        StandardMemoryType.DOCUMENT,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Strategic insight from market trends analysis in category: ${category}`,
        tags,
        metadata
      );
      
      this.logAction('Added strategic insight to memory', { 
        category, 
        tags,
        insightPreview: insight.slice(0, 100) + (insight.length > 100 ? '...' : '')
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error adding strategic insight', { error: errorMessage });
      return false;
    }
  }

  /**
   * Scan the market for trends and opportunities
   */
  async scanMarket(): Promise<void> {
    try {
      this.logAction('Starting market scan', {
        agentId: this.agentId,
        timestamp: new Date().toISOString()
      });

      // Implement market scanning logic here
      // This could include:
      // - Analyzing social media trends
      // - Monitoring competitor activities
      // - Tracking industry news
      // - Identifying emerging opportunities

      this.logAction('Market scan completed', {
        agentId: this.agentId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logAction('Market scan failed', {
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 