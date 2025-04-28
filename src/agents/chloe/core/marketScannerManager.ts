import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { createMarketScanner, MarketScanner, MarketTrend } from '../tools/marketScanner';
import * as serverQdrant from '../../../server/qdrant';

// Add a declaration to extend the serverQdrant type
declare module '../../../server/qdrant' {
  export function addToCollection(collection: string, embedding: number[], payload: any): Promise<boolean>;
}

/**
 * Interface for MarketScannerManager options
 */
export interface MarketScannerManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
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
 * Manages market scanning and trend analysis for the Chloe agent
 */
export class MarketScannerManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private notifyFunction?: (message: string) => Promise<void>;
  private scanner: MarketScanner | null = null;
  private initialized: boolean = false;
  private readonly strategicInsightsCollection = 'strategic_insights';

  /**
   * Creates a new MarketScannerManager instance
   * @param options Configuration options for the manager
   */
  constructor(options: MarketScannerManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Initialize the market scanner system
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    try {
      this.taskLogger.logAction('Initializing market scanner system');
      
      // Initialize market scanner
      this.scanner = createMarketScanner();
      await this.scanner.initialize(this.model);
      
      this.initialized = true;
      this.taskLogger.logAction('Market scanner system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger.logAction('Error initializing market scanner', { error: errorMessage });
      console.error('Error initializing market scanner system:', errorMessage);
      throw error;
    }
  }

  /**
   * Scan market trends based on a specific category or query
   * @param query The category or search query for scanning
   * @returns Promise that resolves to the scan results text
   */
  async scanMarketTrends(query: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.scanner) {
        throw new Error('Market scanner not initialized');
      }
      
      this.taskLogger.logAction('Scanning market trends', { query });
      
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
      this.taskLogger.logAction('Error scanning market trends', { 
        query, 
        error: errorMessage 
      });
      console.error('Error scanning market trends:', errorMessage);
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction('Summarizing market trends');
      
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
      this.taskLogger.logAction('Error summarizing trends', { error: errorMessage });
      console.error('Error summarizing trends:', errorMessage);
      
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
      this.taskLogger.logAction('Error parsing trend summary', { error: errorMessage });
      console.error('Error parsing trend summary:', errorMessage);
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
        console.error('Failed to get embedding for strategic insight');
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
      
      this.taskLogger.logAction('Added strategic insight', { 
        category, 
        tags: tags.join(', '),
        insight: insight.substring(0, 50) + (insight.length > 50 ? '...' : '')
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger.logAction('Error adding strategic insight', { error: errorMessage });
      console.error('Error adding strategic insight from market scanner:', errorMessage);
      return false;
    }
  }

  /**
   * Check if the market scanner system is initialized
   * @returns Boolean indicating initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 