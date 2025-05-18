# Importance Scoring System

## Overview

The importance scoring system provides a standardized way to prioritize memories during retrieval based on their significance to the agent's cognition. This system helps ensure that critical information is more likely to be recalled when relevant, addressing previous issues where important information (like budget constraints) might be overlooked.

## Dual Representation

The system uses a dual representation approach for memory importance:

1. **Categorical Representation**: `ImportanceLevel` enum with values:
   - `LOW` - Routine or minor information
   - `MEDIUM` - Useful but not critical information
   - `HIGH` - Significant information that should be prioritized
   - `CRITICAL` - Vital information that must not be forgotten

2. **Numerical Representation**: `importance_score` (0-1 float)
   - 0.0-0.3: Low importance
   - 0.3-0.6: Medium importance
   - 0.6-0.9: High importance
   - 0.9-1.0: Critical importance

## Components

### ImportanceConverter

Provides bidirectional conversion between numerical scores and categorical levels:

```typescript
// Score to level
if (score >= 0.9) return ImportanceLevel.CRITICAL;
if (score >= 0.6) return ImportanceLevel.HIGH;
if (score >= 0.3) return ImportanceLevel.MEDIUM;
return ImportanceLevel.LOW;

// Level to score
switch (level) {
  case ImportanceLevel.CRITICAL: return 0.95;
  case ImportanceLevel.HIGH: return 0.75;
  case ImportanceLevel.MEDIUM: return 0.5;
  case ImportanceLevel.LOW: return 0.25;
  default: return 0.5;
}
```

### Importance Calculators

1. **RuleBasedImportanceCalculator**
   - Fast, deterministic calculation based on pattern matching
   - Uses keywords, content length, and source type
   - No external API calls required

2. **LLMImportanceCalculator**
   - More accurate, context-aware calculation using LLMs
   - Uses cheaper models (e.g., GPT-3.5-Turbo) to minimize costs
   - Falls back to rule-based calculation if API unavailable
   - Includes result caching to reduce API calls

3. **ImportanceCalculatorService**
   - Orchestrates between rule-based and LLM-based approaches
   - Supports multiple calculation modes:
     - `RULE_BASED`: Always use rule-based (fast, less accurate)
     - `LLM`: Always use LLM (slower, more accurate)
     - `HYBRID`: Use rule-based first, then LLM if confidence is low

### Content Summary Generation

The `ContentSummaryGenerator` creates concise summaries of memory content to facilitate better retrieval:

- Extracts first sentences, key phrases, and entities
- Identifies important topics like budget, deadlines, requirements
- Limited to ~150 characters to minimize storage overhead
- Optimized for search term matching

## Memory Retrieval Enhancements

The importance scoring system significantly enhances memory retrieval through:

1. **Weighted Scoring**
   - Higher importance items receive exponential score boosts
   - `score *= Math.pow(1 + memory.metadata.importance_score, 2)`

2. **Type-Based Priorities**
   - Different memory types have appropriate base weights
   - Special handling for tasks when querying for tasks
   - Message types (questions, answers, budget info) influence ranking

3. **Content Relevance**
   - Content summaries are matched against query terms
   - Direct matches in summaries boost relevance by 50%
   - Task deadlines receive additional priority when searching for tasks

## Integration with Memory Types

The importance scoring system is integrated with all memory types:

1. **Message Memories**
   - Importance determined based on content and context
   - Critical user information receives highest importance
   - Budget-related content is automatically prioritized

2. **Cognitive Process Memories** (thoughts, reflections, insights)
   - Importance based on depth, novelty, and applicability
   - Higher confidence increases importance
   - Topics are extracted to improve contextual retrieval

3. **Document Memories**
   - Importance based on content type and source
   - Markdown files receive highest importance by default
   - Content summaries enable targeted retrieval

4. **Task Memories**
   - Importance derived from task priority
   - Due dates factor into retrieval ranking
   - Content summaries highlight deadlines and requirements

## Usage Guidelines

1. **Adding New Memories**
   ```typescript
   // Both fields will be auto-populated by ImportanceConverter
   await memoryService.addMemory({
     content: "Budget must not exceed $10,000",
     metadata: {
       importance: ImportanceLevel.HIGH
     }
   });
   ```

2. **Retrieving Memories**
   ```typescript
   const { memories } = await memoryRetriever.retrieveMemories({
     query: "What's our budget?",
     importanceWeighting: {
       enabled: true,
       importanceScoreWeight: 1.5
     }
   });
   ```

3. **Updating Importance**
   ```typescript
   // Update based on user feedback
   await feedbackMemoryManager.updateMemoryImportance(
     memoryId, 
     'positive' // Will increase importance
   );
   ```

## Best Practices

1. Always set both `importance` and `importance_score` fields, or use `ImportanceConverter.ensureBothFields()`
2. Use `ContentSummaryGenerator` to create searchable summaries for all memory types
3. Periodically review and adjust importance of memories based on usage patterns
4. For performance-critical paths, use rule-based calculation to avoid API latency
5. Validate LLM-based importance calculation results to ensure they fall within expected ranges 