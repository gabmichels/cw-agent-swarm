# Importance Score Upgrade Implementation Plan

## Implementation Status (Updated: 2023-07-10)

### Completed:
- ✅ Core infrastructure for importance calculation
- ✅ Rule-based and LLM-based calculators
- ✅ Memory retrieval enhancements with importance weighting
- ✅ Importance conversion utilities
- ✅ Integration with all memory types:
  - ✅ Message metadata with content summaries
  - ✅ Cognitive processes (thoughts, reflection, insights)
  - ✅ Documents with retrieval optimization
  - ✅ Tasks with priority-based importance
- ✅ Content summary generation for all memory types
- ✅ Unit tests for key components
- ✅ Integration tests for full pipeline
- ✅ Basic documentation in docs/features/importance-scoring.md

### In Progress:
- Performance optimization for LLM-based calculation
- Developer guidelines for importance scoring

### Pending:
- API reference documentation updates
- Knowledge base updates for new importance scoring system

## Instruction Prompt for Implementation

> When implementing the importance score calculation improvements to our memory system, you MUST:
> 
> - Follow the [IMPLEMENTATION_GUIDELINES.md](../refactoring/architecture/IMPLEMENTATION_GUIDELINES.md) strictly, particularly:
>   - Use strict type safety with no 'any' types
>   - Use dependency injection for all services
>   - Create proper interfaces before implementation
>   - Follow interface-first design principles
>   - Ensure test coverage >95%
>   - Use ULID/UUID for IDs
> - Reuse existing architecture, types, and patterns where appropriate
> - Avoid backward compatibility layers - implement clean solutions
> - Ensure all code is properly documented with TypeScript docstrings
> - Implement all features with performance in mind
> - Keep the implementation simple but comprehensive
> - Seek full test coverage with both unit and integration tests

## Executive Summary

Currently, our system has inconsistent handling of importance across different memory types. There are two parallel systems:

1. **ImportanceLevel enum** (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) - Used for qualitative classification
2. **importance_score** (0-1 float) - Used for numeric scoring

This implementation will harmonize these approaches and use our LLM capabilities to enhance importance scoring across all memory types.

## Current State Audit

### Issues Identified

1. **Inconsistent Representation**:
   - `MessageMetadata` has `importance_score` but no conversion to ImportanceLevel
   - Most cognitive artifacts use ImportanceLevel but lack numeric scoring
   - Documents have hardcoded "critical" importance for some types

2. **Missing Implementation**:
   - No consistent way to calculate importance across memory types
   - No LLM-based importance calculation
   - No proper conversion between score and ImportanceLevel

3. **Retrieval Issues**:
   - Memory retrieval doesn't effectively use importance for ranking
   - Critical information may be missed in context building

4. **Global Inconsistencies**:
   - Multiple `ImportanceLevel` definitions causing conflicts:
     - `src/server/memory/config/types.ts` 
     - `src/constants/memory.ts`

## Implementation Plan

### 1. Standardize Importance Types and Interfaces

```typescript
// Enhance BaseMetadata interface
export interface BaseMetadata {
  // ...existing fields...
  
  // Standardized importance fields
  importance?: ImportanceLevel;
  importance_score?: number;  // 0-1 float
}

// Create a new interface for LLM importance calculation
export interface ImportanceCalculationRequest {
  content: string;             // The content to evaluate
  contentType: string;         // Type of content (message, thought, document)
  userContext?: string;        // User context for relevance judgment
  existingScore?: number;      // Pre-calculated score to validate/adjust
  tags?: string[];             // Content tags for context
  source?: string;             // Content source (user, agent, system)
}

export interface ImportanceCalculationResponse {
  importance_score: number;    // 0-1 float
  importance_level: ImportanceLevel;
  reasoning: string;           // Why this importance was assigned
  is_critical: boolean;        // Quick flag for critical content
  keywords: string[];          // Extracted importance keywords
}
```

### 2. Create Importance Calculator Service

- Create `ImportanceCalculatorService` with both rule-based and LLM-based calculation
- Implement dependency injection pattern
- Provide methods for both sync (rule-based) and async (LLM-based) calculation

### 3. Implement LLM-Based Importance Calculation

Leverage `OPENAI_CHEAP_MODEL` to assess importance without high costs:

```typescript
export class LLMImportanceCalculator implements IImportanceCalculator {
  constructor(
    private readonly llmService: LLMService,
    private readonly fallbackCalculator: RuleBasedImportanceCalculator
  ) {}

  async calculateImportance(request: ImportanceCalculationRequest): Promise<ImportanceCalculationResponse> {
    try {
      // Use cheap model for cost efficiency
      const model = process.env.OPENAI_CHEAP_MODEL || 'gpt-3.5-turbo';
      
      // Template prompt format
      const prompt = `
      Analyze the following content and determine its importance on a scale of 0.0-1.0:
      
      CONTENT TYPE: ${request.contentType}
      CONTENT: "${request.content}"
      ${request.tags?.length ? `TAGS: ${request.tags.join(', ')}` : ''}
      ${request.source ? `SOURCE: ${request.source}` : ''}
      
      Assign an importance score where:
      - 0.0-0.3: Low importance (routine information)
      - 0.3-0.6: Medium importance (useful but not critical)
      - 0.6-0.9: High importance (significant information)
      - 0.9-1.0: Critical importance (vital information)
      
      Return only a JSON object with the following format:
      {
        "importance_score": number, // 0.0-1.0
        "importance_level": "low"|"medium"|"high"|"critical",
        "reasoning": "string", // Brief explanation
        "is_critical": boolean,
        "keywords": ["array of keywords influencing this importance"]
      }
      `;
      
      // Call LLM with cheap model
      const result = await this.llmService.generateStructuredOutput(model, prompt, {
        importance_score: { type: 'number', minimum: 0, maximum: 1 },
        importance_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        reasoning: { type: 'string' },
        is_critical: { type: 'boolean' },
        keywords: { type: 'array', items: { type: 'string' } }
      });
      
      return result;
    } catch (error) {
      console.error('Error in LLM importance calculation, falling back to rule-based:', error);
      // Fall back to rule-based calculation
      return this.fallbackCalculator.calculateImportance(request);
    }
  }
}
```

### 4. Enhance Memory Retrieval with Improved Importance Weighting

Update `MemoryRetriever.ts` to better utilize importance for retrieval:

```typescript
// Enhanced scoring with proper importance weighting
private applyImportanceWeighting(memories: WorkingMemoryItem[]): WorkingMemoryItem[] {
  const scoredMemories = memories.map(memory => {
    let score = memory._relevanceScore || 0.5;
    
    // Use numeric importance_score when available
    if (memory.metadata?.importance_score) {
      // Exponential boost for high importance items
      score *= Math.pow(1 + memory.metadata.importance_score, 2);
    } 
    // Fall back to ImportanceLevel when only that is available
    else if (memory.metadata?.importance) {
      const levelBoosts = {
        [ImportanceLevel.CRITICAL]: 2.0,
        [ImportanceLevel.HIGH]: 1.5,
        [ImportanceLevel.MEDIUM]: 1.2,
        [ImportanceLevel.LOW]: 1.0
      };
      score *= levelBoosts[memory.metadata.importance] || 1.0;
    }
    
    // Additional boosts for message types, etc.
    // ...existing logic...
    
    return { memory, score };
  });
  
  // Sort by final score (descending)
  return scoredMemories
    .sort((a, b) => b.score - a.score)
    .map(item => item.memory);
}
```

### 5. Implement Automatic Conversion Between Score and Level

```typescript
export class ImportanceConverter {
  /**
   * Convert numeric importance score to ImportanceLevel enum
   */
  static scoreToLevel(score: number): ImportanceLevel {
    if (score >= 0.9) return ImportanceLevel.CRITICAL;
    if (score >= 0.6) return ImportanceLevel.HIGH;
    if (score >= 0.3) return ImportanceLevel.MEDIUM;
    return ImportanceLevel.LOW;
  }

  /**
   * Convert ImportanceLevel enum to a representative score
   */
  static levelToScore(level: ImportanceLevel): number {
    switch (level) {
      case ImportanceLevel.CRITICAL: return 0.95;
      case ImportanceLevel.HIGH: return 0.75;
      case ImportanceLevel.MEDIUM: return 0.5;
      case ImportanceLevel.LOW: return 0.25;
      default: return 0.5;
    }
  }
}
```

### 6. Update Memory Storage to Ensure Both Fields are Set

Enhance memory creation across the codebase to set both importance fields:

```typescript
// Example for creating a new memory
async storeMemory(content: string, metadata: Partial<BaseMetadata>): Promise<string> {
  // If importance_score is provided but not importance
  if (metadata.importance_score !== undefined && metadata.importance === undefined) {
    metadata.importance = ImportanceConverter.scoreToLevel(metadata.importance_score);
  }
  // If importance is provided but not importance_score
  else if (metadata.importance !== undefined && metadata.importance_score === undefined) {
    metadata.importance_score = ImportanceConverter.levelToScore(metadata.importance);
  }
  // If neither is provided, calculate both
  else if (metadata.importance === undefined && metadata.importance_score === undefined) {
    const result = await this.importanceCalculator.calculateImportance({
      content,
      contentType: metadata.type || 'unknown'
      // ...other fields...
    });
    
    metadata.importance = result.importance_level;
    metadata.importance_score = result.importance_score;
  }
  
  // Proceed with memory storage...
}
```

### 7. Cleanup Phase (REQUIRED)

#### A. Consolidate Importance Types
1. Delete duplicate ImportanceLevel definitions:
   - Remove from `src/server/memory/config/types.ts`
   - Remove from `src/constants/memory.ts`
   - Keep only in `src/constants/memory.ts`

2. Update all imports to use the single source:
```typescript
import { ImportanceLevel } from '../../constants/memory';
```

#### B. Standardize Importance Calculation
1. Delete duplicate calculator implementations:
   - Remove `src/lib/memory/ImportanceCalculator.ts`
   - Remove custom calculations from `EntityGraph.ts`
   - Remove from `CognitiveMemory.ts`
   - Remove from `MemoryTagger.ts`
   - Remove from `DefaultAgentMemory.ts`

2. Use ImportanceCalculatorService everywhere:
```typescript
import { ImportanceCalculatorService } from '../../services/importance/ImportanceCalculatorService';
```

3. Standardize weights and thresholds:
   - Move all weights to a central configuration
   - Use consistent thresholds across all components
   - Document weight rationale in code

4. Update all components to use the service:
   - Update EntityGraph to use ImportanceCalculatorService
   - Update CognitiveMemory to use ImportanceCalculatorService
   - Update MemoryTagger to use ImportanceCalculatorService
   - Update DefaultAgentMemory to use ImportanceCalculatorService

#### C. Performance Optimization

1. Implement caching for LLM-based calculation:
   - Implement Redis-based caching layer for importance results
   - Add configurable TTL for cached importance values
   - Add cache invalidation on content updates
   - Track cache hit/miss metrics
   - Add caching options to service configuration
   - Implement in-memory fallback cache for local development

2. Add performance monitoring:
   - Add timing metrics for importance calculation
   - Track calculation times by mode (Rule-based vs. LLM)
   - Add memory usage tracking
   - Monitor cache hit rates and effectiveness
   - Set up alerts for performance degradation
   - Create performance dashboard for monitoring

3. Optimize rule-based calculation:
   - Refactor keyword matching for better performance
   - Implement trie data structure for keyword matching
   - Optimize regex patterns used in importance calculation
   - Add short-circuit evaluation for critical keywords
   - Cache keyword extraction results
   - Implement batch processing for multiple calculations

4. Add performance tests:
   - Benchmark different calculator modes
   - Test with varying content sizes
   - Test cache effectiveness under load
   - Test with high concurrency
   - Test impact on memory retrieval performance
   - Publish performance comparison results

#### D. Documentation

1. Update API documentation:
   - Document ImportanceCalculatorService API
   - Document ImportanceConverter utility methods
   - Document ImportanceCalculationRequest/Response objects
   - Document all configuration options for calculators
   - Add examples of different calculation modes usage
   - Document thresholds and weights with rationale
   - Add sequence diagrams for importance calculation flows

2. Add developer guidelines:
   - Guidelines for when to use each calculation mode
   - Guidelines for configuring RuleBasedImportanceCalculator
   - Guidelines for tuning weight configurations
   - Performance considerations and best practices
   - Guidelines for testing importance calculation
   - Guidelines for troubleshooting and debugging

3. Update architecture docs:
   - Update architecture diagrams to show importance calculation
   - Document integration points with memory system
   - Document integration with retrieval system
   - Remove references to legacy calculators
   - Document the central importance calculation approach

4. Knowledge Base Updates:
   - Update product documentation for importance system
   - Add FAQ section for importance-related questions
   - Add troubleshooting guide for importance issues
   - Create importance calculation examples for typical content

5. Migration Guide:
   - Create guide for migrating from old to new importance calculation
   - Document before/after examples 
   - Document potential breaking changes
   - Provide best practices for upgrading existing code

#### E. Testing

1. Add integration tests:
   - Test integration with memory creation flow
   - Test integration with memory retrieval flow
   - Test hybrid importance calculation mode
   - Test rule-based fallback when LLM fails
   - Test importance conversion during memory operations
   - Test all supported content types
   - Verify bi-directional conversion between score and level

2. Add performance tests:
   - Test calculation speed with different modes
   - Test memory usage under load
   - Test caching behavior and effectiveness
   - Test batch calculation performance
   - Compare performance against legacy implementation
   - Document performance findings

3. Add stress tests:
   - Test with high concurrency
   - Test with large content chunks
   - Test with edge case content
   - Test memory usage under prolonged load
   - Test recovery after service disruption
   - Test with real-world content samples

4. Add coverage tests:
   - Ensure >95% code coverage for all importance components
   - Test edge cases and error handling
   - Test configuration validation
   - Test all public APIs for consistent behavior
   - Create mock test fixtures for repeatable testing
   - Add integration test reports to CI pipeline

### Implementation Progress

- [x] Phase 7.A: Consolidate Types
  - [x] Remove duplicate ImportanceLevel definitions
  - [x] Update imports to use central definition
  - [x] Verify no remaining duplicates

- [x] Phase 7.B: Standardize Calculation
  - [x] Remove duplicate calculators
  - [x] Update components to use service
  - [x] Standardize weights and thresholds
  - [x] Document weight rationale

- [ ] Phase 7.C: Performance
  - [ ] Implement caching
  - [ ] Add monitoring
  - [ ] Optimize calculations
  - [ ] Add performance tests

- [ ] Phase 7.D: Documentation
  - [ ] Update API docs
  - [ ] Add guidelines
  - [ ] Update architecture docs

- [ ] Phase 7.E: Testing
  - [ ] Add integration tests
  - [ ] Add performance tests
  - [ ] Add stress tests

## Success Metrics for Cleanup

1. **Code Quality**:
   - [x] Single implementation of importance calculation
   - [x] No duplicate enum definitions
   - [x] Proper dependency injection throughout
   - [ ] >95% test coverage maintained

2. **Consistency**:
   - [x] Same thresholds used everywhere
   - [x] Same conversion logic throughout
   - [x] Standardized boost factors in retrieval

3. **Performance**:
   - [ ] No regression in calculation speed
   - [x] Reduced code complexity
   - [x] Improved maintainability

## Cleanup Checklist

- [x] Remove duplicate ImportanceLevel definitions
- [x] Delete redundant calculator implementations
- [x] Update all imports to use single source
- [x] Standardize thresholds across codebase
- [x] Update integration points
- [ ] Add/update tests for consistency
- [ ] Update documentation
- [x] Verify no breaking changes
- [ ] Run full test suite
- [ ] Performance validation

## Architecture Diagram

```
┌───────────────────┐       ┌─────────────────────┐        ┌───────────────────┐
│                   │       │                     │        │                   │
│  Memory Creation  │──────▶│ ImportanceCalculator│◀───────│  LLM Service      │
│                   │       │                     │        │  (Cheap Model)    │
└───────────────────┘       └─────────────────────┘        └───────────────────┘
                                     │   ▲
                                     ▼   │
                             ┌─────────────────────┐
                             │                     │
                             │ ImportanceConverter │
                             │                     │
                             └─────────────────────┘
                                     │   ▲
                                     ▼   │
┌───────────────────┐       ┌─────────────────────┐        ┌───────────────────┐
│                   │       │                     │        │                   │
│  Memory Storage   │◀──────│  BaseMetadata with  │───────▶│  Memory Retrieval │
│                   │       │  Dual Importance    │        │                   │
└───────────────────┘       └─────────────────────┘        └───────────────────┘
```

## Performance Considerations

1. **LLM Cost Efficiency**
   - Use the cheapest suitable model (OPENAI_CHEAP_MODEL)
   - Implement caching for repeated calculations
   - Fall back to rule-based for high-volume scenarios

2. **Calculation Optimization**
   - Prioritize which memory types need LLM-based calculation
   - Use rule-based for routine messages, LLM for critical context

3. **Storage Efficiency**
   - Store both importance types to avoid recalculation
   - Ensure proper indexing on importance fields for retrieval

## Rollout Plan

1. ✅ Implement core infrastructure (interfaces, services)
2. ✅ Add LLM integration with fallbacks
3. ✅ Update memory creation flows
4. ✅ Enhance retrieval with importance weighting
5. ✅ Implement content summarization for all memory types
6. ✅ Deploy initial documentation
7. 🔄 Deploy with monitoring for LLM usage and performance
8. 🔄 Tune parameters based on real-world performance
9. ✅ Complete integration tests across memory subsystems
10. ⏳ Update API documentation and developer guidelines

## Success Metrics

1. **Relevance Improvement**: Higher quality context retrieval as measured by:
   - Retrieval of critical information in relevant queries
   - Reduction in missed important context

2. **Performance**: Maintain system performance while adding importance calculation:
   - Average latency increase < 100ms for memory creation
   - No significant impact on retrieval speed

3. **Cost Efficiency**:
   - LLM inference cost < $0.10 per 1000 importance calculations
   - Caching efficiency > 40% (reduce LLM calls)

## Testing Plan

### Unit Tests

1. **ImportanceCalculatorService Tests**
   - Test all calculation modes (RULE_BASED, LLM, HYBRID)
   - Test conversion between score and level
   - Test with various content types
   - Test threshold boundaries

2. **ImportanceConverter Tests**
   - Test all score-to-level conversions
   - Test all level-to-score conversions
   - Test edge cases (0, 1, negative values)
   - Test the ensureBothFields utility

3. **RuleBasedImportanceCalculator Tests**
   - Test keyword matching functionality
   - Test content length impact
   - Test tag quality impact
   - Test different source types
   - Test critical keyword override

### Integration Tests

1. **Memory Retrieval with Importance**
   - Test that high importance memories are prioritized
   - Test retrieval with different importance distributions
   - Validate importance weighting algorithm

2. **End-to-End Importance Flow**
   - Test importance calculation during memory creation
   - Test importance adjustment during memory updates
   - Test importance impact on context building

3. **Cross-Component Tests**
   - Verify importance integration with EntityGraph
   - Verify importance integration with ThinkingService
   - Verify importance integration with CognitiveMemory
   - Verify importance integration with BasicSummaryGenerator

### Performance Tests

1. **Calculation Speed**
   - Benchmark RULE_BASED mode vs LLM mode
   - Test with various content lengths
   - Test with high concurrency

2. **Caching Effectiveness**
   - Measure cache hit rates
   - Test cache eviction policy
   - Test with repeated content

3. **Memory Impact**
   - Measure memory usage during calculation
   - Test for memory leaks in long-running scenarios

### Next Steps for Testing

1. **Setup Test Environment**
   - Configure test data sets with various importance levels
   - Set up performance monitoring tools

2. **Write Test Cases**
   - Start with core unit tests
   - Move to integration tests
   - Add performance tests last

3. **Continuous Integration**
   - Add importance-specific test runs to CI
   - Set up coverage reports for importance components
   - Configure performance benchmarks 
 