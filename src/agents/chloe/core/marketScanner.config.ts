import { ImportanceLevel } from '../../../constants/memory';

/**
 * Market Scanner Manager Configuration
 * Contains all configurable constants and templates used by the MarketScannerManager
 */
export const MarketScannerConfig = {
  /**
   * Collection and storage names
   */
  collections: {
    strategicInsights: 'strategic_insights'
  },
  
  /**
   * Search and retrieval query strings
   */
  queries: {
    marketTrends: 'market trends analysis scan',
    defaultTrends: 'current marketing trends'
  },
  
  /**
   * Numeric limits and thresholds
   */
  limits: {
    relevantMemories: 10,        // Number of memories to retrieve
    trendResultsOffset: 0,       // Starting offset for trend results
    trendResultsLimit: 20,       // Maximum number of trend results to retrieve
    textPreviewLength: 200,      // Length of text previews for summaries (characters)
    insightPreviewLength: 50     // Length of insight previews for logging (characters)
  },
  
  /**
   * Default tags for memory entries
   */
  tags: {
    marketScan: ['market_scan', 'trend_analysis'], // Base tags for market scans
    trendSummary: ['trend_summary', 'market_analysis', 'strategic_insight'], // Tags for trend summaries
    defaultTrend: ['trend', 'market_analysis']  // Default tags for trends without explicit tags
  },
  
  /**
   * Default importance levels for different memory types
   */
  importance: {
    marketScan: ImportanceLevel.MEDIUM,
    trendSummary: ImportanceLevel.HIGH,
    strategicInsight: ImportanceLevel.HIGH
  }
};

/**
 * Regular expression patterns for parsing trend summaries
 */
export const TrendParsingPatterns = {
  sectionSplitter: /[-*]\s*INSIGHT:/i,
  insightExtractor: /^([\s\S]*?)(?=\s*[-*]\s*TAGS:|$)/,
  tagsExtractor: /[-*]\s*TAGS:\s*\[(.*?)\]/i,
  categoryExtractor: /[-*]\s*CATEGORY:\s*\[(.*?)\]/i
};

/**
 * Template strings for prompts and formatting
 */
export const Templates = {
  /**
   * Template for formatting individual market trends
   */
  trendFormat: `
TREND: {name}
CATEGORY: {category}
STAGE: {stage}
DESCRIPTION: {description}
KEYWORDS: {keywords}
BUSINESS IMPACT: {impact}/100
RELEVANCE: {score}/100
  `,

  /**
   * Template for the trend summarization prompt
   */
  trendSummarizationPrompt: `As Chloe, the Chief Marketing Officer AI, analyze these recent market scans and synthesize the key trends, insights, and strategic implications:

RECENT MARKET SCANS:
{marketScans}

Create a comprehensive trend summary with the following structure:
- For each major trend, provide:
  * INSIGHT: [The key insight in 1-2 sentences]
  * TAGS: [3-5 relevant tags/keywords]
  * CATEGORY: [One of: Consumer Behavior, Technology, Competitive Landscape, Content Strategy, Channel Strategy, Industry Shift]

Focus on actionable insights that have strategic implications for marketing efforts. Be specific and forward-looking.`
}; 