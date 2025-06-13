# Market Scanner

The Market Scanner is a tool for tracking and analyzing trends in AI, automation, and technology markets. It collects data from various sources like RSS feeds, Reddit, and Twitter, analyzes this data using our trend analysis engine, and provides insights into emerging market trends.

## Features

- **Multi-source data collection**: Gathers data from RSS feeds, Reddit, and Twitter
- **AI-powered trend analysis**: Uses LLMs to identify and analyze market trends
- **Customizable data sources**: Easy to add or modify data sources
- **Integration with agent tools**: Provides trend information to agents through a structured tool

## Configuration

### API Keys

The Market Scanner uses the following API keys:

1. **APIFY_API_KEY**: Required for web scraping (Reddit, Twitter, etc.)
2. **NEWS_API_KEY**: Optional for news article collection
3. **RESEARCH_API_KEY**: Optional for research paper analysis
4. **TRENDS_API_KEY**: Optional for trend data

Add these API keys to your `.env` file:

```
APIFY_API_KEY=your_apify_api_key_here
NEWS_API_KEY=your_news_api_key_here
RESEARCH_API_KEY=your_research_api_key_here
TRENDS_API_KEY=your_trends_api_key_here
```

### Data Sources

Data sources are stored in JSON files in the `data/market-sources` directory:

- `feeds.json`: RSS feed sources
- `reddit.json`: Reddit sources
- `twitter.json`: Twitter sources

Each source has the following structure:

```json
{
  "id": "unique-source-id",
  "type": "rss|reddit|twitter",
  "url": "source-url-or-search-term",
  "category": "ai|tech|automation|analytics|other",
  "theme": "news|research|social|technical|business",
  "refresh_interval": 12 // hours
}
```

## Usage

### Basic Usage

```javascript
import { createMarketScanner } from './src/agents/shared/tools/market';

// Create a market scanner with default configuration
const scanner = createMarketScanner();

// Initialize the scanner
await scanner.initialize();

// Run a market scan for AI and automation categories
await scanner.runMarketScan(['ai', 'automation']);

// Get top trends with minimum score of 40
const trends = await scanner.getTrends(undefined, 40, 10);

// Create a market trend tool for agent use
const trendTool = scanner.createMarketTrendTool();
```

### Custom Configuration

```javascript
const scanner = createMarketScanner({
  maxResults: 20,
  scanFrequency: 12 * 60 * 60 * 1000, // 12 hours
  apiKeys: {
    news: 'your-news-api-key',
    research: 'your-research-api-key',
    trends: 'your-trends-api-key'
  },
  sources: ['news', 'research', 'social'],
  dataDir: './custom-data-directory',
  enabled: true
});
```

## Integrating with Agents

The Market Scanner provides a structured tool that can be used by agents to find market trends:

```javascript
// In your agent's tool registration
const marketScanner = createMarketScanner();
await marketScanner.initialize();

const marketTrendTool = marketScanner.createMarketTrendTool();
agent.registerTool(marketTrendTool);
```

## Testing

Run the test script to verify your Market Scanner configuration:

```bash
node test_market_scanner.mjs
```

## API Reference

### MarketScanner Interface

```typescript
interface IMarketScanner {
  initialize(model?: ChatOpenAI): Promise<void>;
  runMarketScan(categories?: string[]): Promise<number>;
  getTrends(category?: string, minScore?: number, limit?: number): Promise<MarketTrend[]>;
  refreshTrends(): Promise<MarketTrend[]>;
  createMarketTrendTool(): StructuredTool;
}
```

### MarketTrend Interface

```typescript
interface MarketTrend {
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
```

## Troubleshooting

If you encounter issues:

1. **API Errors**: Verify your API keys are correctly set in `.env`
2. **No Data**: Check your data source files and ensure URLs are correctly formatted
3. **Timeouts**: Consider increasing the timeout settings in your agent configuration 