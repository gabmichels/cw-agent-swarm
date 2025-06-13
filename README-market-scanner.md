# Market Scanner Implementation

## Overview

The Market Scanner is a tool that collects and analyzes market trends from various sources including RSS feeds, Reddit, and Twitter. It uses the Apify integration to collect data, processes it through trend analysis, and exposes the insights to agents via a structured tool.

## What's Been Implemented

1. **Uncommented Real Implementations**:
   - `DefaultSourceManager` - Manages data sources and refreshing
   - `DefaultTrendAnalyzer` - Analyzes market signals to identify trends

2. **Wired Dependencies**:
   - Connected `DefaultSourceManager` and `DefaultTrendAnalyzer` in `DefaultMarketScanner`
   - Integrated Apify for web scraping capabilities

3. **Added Configuration**:
   - Set up environment variables for API keys
   - Created default data sources for RSS feeds, Reddit, and Twitter

## Directory Structure

```
src/agents/shared/tools/market/
├── MarketScanner.interface.ts      # Core interfaces
├── DefaultMarketScanner.ts         # Main implementation
├── index.ts                        # Export factory functions
├── analysis/
│   └── DefaultTrendAnalyzer.ts     # Trend analysis implementation
└── processors/
    ├── DefaultSourceManager.ts     # Source management implementation
    └── rss/
        └── DefaultRssProcessor.ts  # RSS feed processor

data/market-sources/
├── feeds.json                      # RSS feed sources
├── reddit.json                     # Reddit sources
└── twitter.json                    # Twitter sources
```

## How to Use the Market Scanner

### Basic Usage

```javascript
import { createMarketScanner } from './src/agents/shared/tools/market';

// Create scanner instance
const scanner = createMarketScanner();

// Initialize
await scanner.initialize();

// Run a scan for specific categories
const signalCount = await scanner.runMarketScan(['ai']);

// Get trends with minimum score threshold
const trends = await scanner.getTrends('ai', 30, 5);

// Create a tool for agent use
const trendTool = scanner.createMarketTrendTool();
```

### Required Environment Variables

For full functionality, add these to your `.env.local` file:

```
APIFY_API_KEY=your_apify_key_here
NEWS_API_KEY=your_news_api_key_here
RESEARCH_API_KEY=your_research_api_key_here
TRENDS_API_KEY=your_trends_api_key_here
```

### Testing

Two test scripts have been provided:

1. **test_market_scanner.mjs** - ESM module-based test
2. **test-market-scanner.js** - CommonJS-based test

Run either with Node.js:
```
node test-market-scanner.js
```

## Integration with Agents

The Market Scanner was intended to be registered with the `SharedToolRegistry` to make it available to all agents. The implementation adds a `market_trends` tool that agents can use to access market trend information.

## Data Sources

Default data sources have been configured for:

### RSS Feeds
- TechCrunch AI section
- MIT Technology Review
- Hacker News (AI-filtered)

### Reddit
- r/artificial
- r/MachineLearning
- r/OpenAI

### Twitter
- "artificial intelligence" search
- "large language model" search
- "automation technology" search

## Next Steps

1. Run the test scripts to verify functionality
2. Add your Apify API key to the environment variables
3. Integrate with Agent Toolkits in production
4. Expand source coverage with more feeds and sources
5. Implement additional analysis methods for deeper insights 