# Chloe Tool Adaptation Resilience System

This resilience system enables Chloe's tools to automatically recover from failures and self-optimize during execution. The system consists of two main components:

1. **Multi-path Fallback Chains**: Provides alternative execution paths when tools fail
2. **Runtime Parameter Adjustment**: Allows tools to self-adjust parameters during execution

## 1. Multi-path Fallback Chains

The `ToolFallbackManager` (in `fallbackManager.ts`) provides a comprehensive fallback system that:

- Detects tool failures and categorizes errors
- Uses predefined fallback chains for common failure modes
- Automatically selects alternative tools based on function similarity
- Tracks success rates for fallback sequences

### Key Features

- **Error Categorization**: Classifies errors into specific types (timeout, permission, rate limit, etc.)
- **Configurable Fallback Chains**: Define fallback sequences through JSON configuration
- **Similarity-based Fallback Selection**: When explicit fallbacks aren't defined, finds similar tools
- **Parameter Transformation**: Adjusts parameters when switching to fallback tools
- **Performance Tracking**: Records success rates of different fallback paths

### Usage Example

```typescript
// Initialize the fallback manager
const fallbackManager = initializeToolFallbackManager(toolManager, registry, memory);

// Define a fallback chain
fallbackManager.registerFallbackChain({
  primaryToolName: "webSearch",
  fallbacks: [
    {
      toolName: "bingSearch",
      forFailureTypes: [FailureType.RATE_LIMIT_ERROR, FailureType.TIMEOUT_ERROR],
      priority: 10
    },
    {
      toolName: "googleCustomSearch",
      priority: 5
    }
  ]
});

// Execute a tool with fallback handling
const result = await fallbackManager.executeWithFallbacks("webSearch", {
  query: "latest AI research"
});

// Check if a fallback was used
if (result.fallbackUsed) {
  console.log(`Primary tool failed, used fallback: ${result.fallbackToolName}`);
}

// Get execution trace
console.log(result.executionTrace);
```

## 2. Runtime Parameter Adjustment

The `AdaptiveToolWrapper` (in `adaptiveWrapper.ts`) provides parameter adjustment capabilities:

- Analyzes parameter sensitivity
- Evaluates intermediate results
- Progressively optimizes parameters
- Self-heals common errors

### Key Features

- **Parameter Adjustment Strategies**: Specific strategies for timeouts, rate limits, etc.
- **Success Pattern Learning**: Records successful parameter adjustments for future use
- **Intermediate Result Evaluation**: Assesses quality to guide adjustments
- **Historical Pattern Matching**: Applies previously successful patterns to similar parameters

### Adjustment Strategies

The system includes several built-in adjustment strategies:

- **Timeout Adjustment**: Increases timeout values when timeout errors occur
- **Batch Size Adjustment**: Reduces batch sizes when rate limit errors occur
- **Query Reformulation**: Expands search queries when results are insufficient

### Usage Example

```typescript
// Initialize the adaptive wrapper
const adaptiveWrapper = initializeAdaptiveToolWrapper(toolManager, registry, memory);

// Register a tool with adaptive capabilities
adaptiveWrapper.registerAdaptiveTool({
  toolName: "imageGenerator",
  maxAdjustmentAttempts: 3,
  parameterSensitivity: {
    resolution: 0.8,
    quality: 0.6,
    timeout: 0.4
  },
  adjustmentStrategies: [
    AdaptiveToolWrapper.createTimeoutAdjustmentStrategy("timeout"),
    AdaptiveToolWrapper.createBatchSizeAdjustmentStrategy("batchSize")
  ],
  successEvaluator: (result) => {
    return {
      success: result.success === true,
      quality: result.quality || 0.5
    };
  }
});

// Execute with adaptation
const result = await adaptiveWrapper.executeWithAdaptation("imageGenerator", {
  prompt: "A futuristic city with flying cars",
  resolution: "medium",
  quality: 0.7,
  timeout: 5000
});

// Check if parameters were adjusted
if (result.parametersAdjusted) {
  console.log("Original parameters:", result.initialParameters);
  console.log("Adjusted parameters:", result.finalParameters);
  console.log("Adjustment trace:", result.adjustmentTrace);
}
```

## Integration with Existing Systems

The resilience system integrates with:

- **ToolManager**: For tool execution
- **ToolRegistry**: For tool discovery and metadata
- **ChloeMemory**: For recording adaptation patterns and fallback attempts

## Visualization and Monitoring

The system records detailed execution traces that can be used to:

- Visualize fallback paths
- Analyze parameter adjustment effectiveness
- Identify common failure patterns
- Optimize tool configurations

## A/B Testing

Both components support A/B testing to validate the effectiveness of:

- Different fallback sequences
- Parameter adjustment strategies
- Success evaluation thresholds

## Implementation Notes

- All failed attempts are logged to memory for future analysis
- Successful adaptations are recorded for pattern matching
- Both systems use singleton patterns for easy access throughout the codebase
- Type definitions ensure strong typing throughout the system 