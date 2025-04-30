# Chloe Agent Core Components

## Configuration Pattern

The Chloe agent uses a configuration pattern to manage constants, templates, and other configuration values. This pattern helps to:

1. Eliminate hardcoded string literals and magic numbers
2. Centralize configuration for easier maintenance
3. Allow for customization without changing core code
4. Improve testability

### Example: MarketScannerManager

The `MarketScannerManager` class demonstrates this pattern:

```typescript
// Configuration is defined in a separate file
import { MarketScannerConfig } from './marketScanner.config';

// Class accepts custom configuration in constructor
constructor(options: MarketScannerManagerOptions) {
  // Basic initialization
  this.agentId = options.agentId;
  
  // Initialize configuration with defaults, then merge custom config
  this.config = { ...MarketScannerConfig };
  
  if (options.config) {
    // Merge custom configuration
    // ...
  }
}
```

### Configuration Structure

The configuration is organized into logical groups:

```typescript
export const MarketScannerConfig = {
  collections: { ... },  // Collection names
  queries: { ... },      // Search query strings
  limits: { ... },       // Numeric thresholds and limits
  tags: { ... },         // Default memory tags
  importance: { ... }    // Default importance levels
};
```

### Template System

Templates for prompts and formatted output are stored separately:

```typescript
export const Templates = {
  trendFormat: `
    TREND: {name}
    // ...
  `,
  
  trendSummarizationPrompt: `
    As Chloe, the Chief Marketing Officer AI...
    // ...
  `
};
```

### Regular Expression Patterns

Regular expressions are also stored as named constants:

```typescript
export const TrendParsingPatterns = {
  sectionSplitter: /[-*]\s*INSIGHT:/i,
  insightExtractor: /^([\s\S]*?)(?=\s*[-*]\s*TAGS:|$)/,
  tagsExtractor: /[-*]\s*TAGS:\s*\[(.*?)\]/i,
  categoryExtractor: /[-*]\s*CATEGORY:\s*\[(.*?)\]/i
};
```

## How to Use Custom Configuration

You can customize the configuration when creating a new instance:

```typescript
const manager = new MarketScannerManager({
  // Required options
  agentId: 'chloe',
  memory: chloeMemory,
  model: modelInstance,
  
  // Custom configuration
  config: {
    limits: {
      relevantMemories: 15,  // Override the default limit of 10
      textPreviewLength: 150 // Override the default of 200
    },
    importance: {
      marketScan: ImportanceLevel.HIGH  // Override the default of MEDIUM
    }
  }
});
```

## Testing

The configuration pattern makes testing easier by allowing configuration overrides for testing specific scenarios:

```typescript
test('should use custom limits', async () => {
  const customManager = new MarketScannerManager({
    // ...basic options
    config: {
      limits: {
        relevantMemories: 5 // Use 5 instead of default 10
      }
    }
  });
  
  await customManager.summarizeTrends();
  expect(mockMemory.getRelevantMemories).toHaveBeenCalledWith(
    expect.any(String),
    5  // Should use our custom limit
  );
});
```

## Benefits

1. **Maintainability**: Changes to configuration values are isolated to one place
2. **Readability**: Code is free from magic numbers and string literals
3. **Testability**: Easy to override configuration for testing
4. **Flexibility**: Configuration can be changed without modifying core code
5. **Documentation**: Configuration values are self-documenting with comments 