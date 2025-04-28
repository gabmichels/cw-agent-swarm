import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { createMarketScanner, MarketScanner, MarketTrend } from '../tools/marketScanner';
import * as serverQdrant from '../../../server/qdrant';
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';

// Add a declaration to extend the serverQdrant type
declare module '../../../server/qdrant' {
  export function addToCollection(collection: string, embedding: number[], payload: any): Promise<boolean>;
}

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
 * Options for initializing the market scanner manager
 */
export interface MarketScannerManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  logger?: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
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
  private readonly strategicInsightsCollection = 'strategic_insights';

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
      const trends = await this.scanner.getTrends(query, 0, 20);
      
      // Format trends into a readable string
      const scanResults = this.formatTrendsResult(trends);
      
      // Process and store the results
      await this.memory.addMemory(
        `Market Scan Results for "${query}": ${scanResults.substring(0, 200)}...`,
        'market_scan',
        'medium',
        'system',
        undefined,
        ['market_scan', 'trend_analysis', query.toLowerCase()]
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
      return `
TREND: ${trend.name}
CATEGORY: ${trend.category}
STAGE: ${trend.stage}
DESCRIPTION: ${trend.description}
KEYWORDS: ${trend.keywords.join(', ')}
BUSINESS IMPACT: ${trend.estimatedBusinessImpact}/100
RELEVANCE: ${trend.score}/100
      `.trim();
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
      const recentScans = await this.memory.getRelevantMemories('market trends analysis scan', 10);
      
      if (!recentScans || recentScans.length === 0) {
        // No recent scans, so run a new market scan
        const newScanResults = await this.scanMarketTrends('current marketing trends');
        recentScans.push(newScanResults);
      }
      
      // Create a prompt for trend summarization
      const prompt = `As Chloe, the Chief Marketing Officer AI, analyze these recent market scans and synthesize the key trends, insights, and strategic implications:

RECENT MARKET SCANS:
${recentScans.join('\n\n')}

Create a comprehensive trend summary with the following structure:
- For each major trend, provide:
  * INSIGHT: [The key insight in 1-2 sentences]
  * TAGS: [3-5 relevant tags/keywords]
  * CATEGORY: [One of: Consumer Behavior, Technology, Competitive Landscape, Content Strategy, Channel Strategy, Industry Shift]

Focus on actionable insights that have strategic implications for marketing efforts. Be specific and forward-looking.`;
      
      // Generate the trend summary
      const response = await this.model.invoke(prompt);
      const trendSummary = response.content.toString();
      
      // Store the trend summary in memory
      await this.memory.addMemory(
        `Trend Summary: ${trendSummary.substring(0, 200)}...`,
        'trend_summary',
        'high',
        'chloe',
        undefined,
        ['trend_summary', 'market_analysis', 'strategic_insight']
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
      
      // Look for sections that match our pattern
      const sections = summary.split(/[-*]\s*INSIGHT:/i);
      
      // Skip the first entry if it doesn't contain trend data
      for (let i = 1; i < sections.length; i++) {
        const section = sections[i].trim();
        
        // Extract the insight (everything until TAGS:)
        // Using a more compatible regex without the '/s' flag
        const insightMatch = section.match(/^([\s\S]*?)(?=\s*[-*]\s*TAGS:|$)/);
        const insight = insightMatch ? insightMatch[1].trim() : '';
        
        // Extract the tags
        const tagsMatch = section.match(/[-*]\s*TAGS:\s*\[(.*?)\]/i);
        const tagsString = tagsMatch ? tagsMatch[1] : '';
        const tags = tagsString.split(/,\s*/).map(tag => tag.trim()).filter(Boolean);
        
        // Extract the category
        const categoryMatch = section.match(/[-*]\s*CATEGORY:\s*\[(.*?)\]/i);
        const category = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'general';
        
        if (insight) {
          trends.push({
            insight,
            tags: tags.length > 0 ? tags : ['trend', 'market_analysis'],
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
   * Add a strategic insight to the memory system
   * @param insight The insight text
   * @param tags Array of tags for the insight
   * @param category The category of the insight
   * @returns Promise that resolves to a boolean indicating success
   */
  private async addStrategicInsight(
    insight: string, 
    tags: string[], 
    category: string = 'general'
  ): Promise<boolean> {
    try {
      // Get embeddings for the insight
      const embeddingResponse = await serverQdrant.getEmbedding(insight);
      if (!embeddingResponse || !embeddingResponse.embedding) {
        this.logAction('Failed to get embedding for strategic insight', { insight: insight.substring(0, 50) });
        return false;
      }
      
      const embedding = embeddingResponse.embedding;
      
      // Create a timestamp
      const timestamp = new Date().toISOString();
      
      // Create a payload with all the data
      const payload = {
        insight,
        source: 'market_scanner',
        tags,
        timestamp,
        category
      };
      
      // Add to Qdrant collection
      await serverQdrant.addToCollection(this.strategicInsightsCollection, embedding, payload);
      
      // Also add to normal memory with high importance
      await this.memory.addMemory(
        `Strategic Insight: ${insight}`,
        'strategic_insight',
        'high',
        'system',
        `Category: ${category}`,
        tags
      );
      
      this.logAction('Added strategic insight', { 
        category, 
        tags: tags.join(', '),
        insight: insight.substring(0, 50) + (insight.length > 50 ? '...' : '')
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error adding strategic insight', { error: errorMessage });
      return false;
    }
  }
} 