# Market Scanner

This directory contains the implementation of the Market Scanner system for detecting and analyzing trends in AI and automation technologies. The system uses a modular, interface-first approach with clean separation of concerns.

## Components

### 1. Core Interfaces

- `IMarketScanner`: Main interface for market scanner implementations.
- `MarketSource`: Interface for market sources (RSS, Reddit, Twitter).
- `MarketSignal`: Interface for market signals extracted from sources.
- `MarketTrend`: Interface for trends identified from signals.
- `MarketScannerConfig`: Interface for scanner configuration.
- `MarketScanResult`: Interface for scan results.

### 2. Specialized Interfaces

- `ISourceManager`: Interface for managing market sources.
- `ISourceProcessor`: Interface for processing different source types.
- `IRssProcessor`, `IRedditProcessor`, `ITwitterProcessor`: Source-specific interfaces.
- `ITrendAnalyzer`: Interface for analyzing signals to identify trends.

### 3. Implementations

- `DefaultMarketScanner`: Main implementation of the market scanner.
- `DefaultSourceManager`: Implementation for managing sources.
- `DefaultTrendAnalyzer`: Implementation for trend analysis.
- `DefaultRssProcessor`: Implementation for processing RSS feeds.

### 4. Integration

The Market Scanner integrates with the Apify system for Twitter and Reddit sources, providing a clean, modular approach to source processing.

## Usage

### Basic Usage

```typescript
import defaultScanner from 'src/agents/shared/tools/market';

// Run a market scan
const signalCount = await defaultScanner.runMarketScan(['ai', 'automation']);

// Get current trends
const trends = await defaultScanner.getTrends('ai', 50, 10);
```

### Creating a Custom Instance

```typescript
import { DefaultMarketScanner } from 'src/agents/shared/tools/market';

const customScanner = new DefaultMarketScanner({
  maxResults: 50,
  scanFrequency: 12 * 60 * 60 * 1000, // 12 hours
  sources: ['ai', 'automation', 'integration'],
  dataDir: './data/market-sources',
  enabled: true
});

await customScanner.initialize();
```

### Tool Integration

```typescript
import defaultScanner from 'src/agents/shared/tools/market';

// Create a market trend finder tool
const trendFinderTool = defaultScanner.createMarketTrendTool();

// Register with a tool manager
toolManager.registerTool(trendFinderTool);
```

## Source Processing

The Market Scanner processes several types of sources:

1. **RSS Feeds**: Processed directly using the RSS parser.
2. **Reddit**: Processed using the ApifyManager integration.
3. **Twitter**: Processed using the ApifyManager integration.

Each source type has a dedicated processor implementation that follows the appropriate interface.

## Trend Analysis

The trend analysis system:

1. Collects signals from all sources
2. Analyzes the signals to identify trends
3. Assigns scores and categories to trends
4. Merges similar trends to avoid duplication
5. Sorts trends by relevance score

## Implementation Approach

The implementation follows these core principles:

1. **Interface-First Design**: All components are defined by interfaces first.
2. **Modular Architecture**: Clear separation of concerns with specialized modules.
3. **Type Safety**: Strict type checking throughout the implementation.
4. **Error Handling**: Comprehensive error handling with specific error types.
5. **Integration**: Clean integration with other systems like Apify.

## Status

- ✅ Core interfaces defined
- ✅ DefaultMarketScanner implementation with source integration
- ✅ RSS processor implementation with tests
- ✅ Integration with Apify for Reddit and Twitter sources
- 🟡 Source manager and trend analyzer implementations (placeholders)
- 🔴 API route updates

## Future Enhancements

1. **Advanced Trend Analysis**: Implement machine learning-based trend detection.
2. **Additional Source Types**: Add support for more source types (e.g., academic publications).
3. **Real-time Monitoring**: Add real-time monitoring of high-importance sources.
4. **Trend Visualization**: Create visualization components for identified trends.
5. **Historical Analysis**: Add capabilities for historical trend analysis. 