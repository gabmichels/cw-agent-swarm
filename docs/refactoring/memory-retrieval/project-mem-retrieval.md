# Memory Retrieval System Refactoring

## Overview

This document outlines the refactoring of the memory retrieval system to create a more accurate, robust, and language-agnostic approach to fetching relevant memories. The goal is to ensure agents can reliably retrieve the right memories based on semantic relevance and importance without relying on hardcoded patterns.

## Current Issues

1. **Hardcoded Keyword Matching**: The current implementation relies on hardcoded keywords and patterns, making it language-dependent and inflexible.
2. **Lack of Transparency**: Insufficient logging to understand which memories are being retrieved and why.
3. **Suboptimal Importance Weighting**: The importance scoring system isn't properly utilized in memory retrieval.
4. **Poor Tag Utilization**: Tags from user queries aren't effectively matched with memory tags.
5. **Inconsistent Relevance Calculation**: The algorithm for combining semantic relevance with importance produces inconsistent results.

## Implementation Goals

1. Create a language-agnostic memory retrieval system
2. Properly utilize semantic search with importance weighting
3. Implement effective tag matching between queries and memories
4. Add comprehensive logging for debugging and transparency
5. Ensure top N most relevant memories are consistently retrieved
6. Provide accurate memories for agent context building

## Implementation Plan

### Phase 1: Core Refactoring

- [ ] Remove all hardcoded keyword matching from MemoryRetriever.ts
- [ ] Implement proper tag extraction from user queries
- [ ] Create a unified relevance scoring algorithm that balances:
  - Semantic relevance (vector similarity)
  - Importance score
  - Tag matching
  - Recency (when appropriate)
- [ ] Add detailed logging of memory retrieval process
- [ ] Ensure proper importance weighting in search results

### Phase 2: Enhanced Tag Management

- [ ] Improve tag extraction from user queries
- [ ] Implement tag normalization and synonyms
- [ ] Create a tag registry for consistent tag usage
- [ ] Develop a mechanism to match related tags

### Phase 3: Testing & Validation

- [ ] Develop comprehensive testing script 
- [ ] Create integration tests with specific query scenarios
- [ ] Implement automated validation for memory retrieval accuracy
- [ ] Add performance testing for memory retrieval
- [ ] Verify multi-language support

### Phase 4: Production Readiness

- [ ] Add telemetry for production monitoring
- [ ] Implement caching strategies for performance 
- [ ] Add configuration options for tuning relevance weights
- [ ] Create documentation for memory retrieval system
- [ ] Add failure recovery mechanisms

## Memory Retrieval Scoring Algorithm

The refactored memory retrieval system will use the following algorithm for scoring memories:

```
final_score = (semantic_score * SEMANTIC_WEIGHT) + 
             (importance_score * IMPORTANCE_WEIGHT) + 
             (tag_match_score * TAG_WEIGHT) + 
             (recency_score * RECENCY_WEIGHT)
```

Where:
- `semantic_score`: Vector similarity between query and memory (0-1)
- `importance_score`: Normalized importance score from memory metadata (0-1)
- `tag_match_score`: Score based on matching tags (0-1)
- `recency_score`: Score based on recency of memory (0-1)
- Weights are configurable parameters that sum to 1.0

## Test Cases

The following test cases will be used to validate the memory retrieval system:

1. **Budget Query**:
   - Query: "What is our marketing budget?"
   - Expected: At least one memory containing "1500" in text
   
2. **Marketing Status Query**:
   - Query: "Where do our current marketing efforts stand?"
   - Expected: Memories containing "clean slate" and "starting from scratch"
   
3. **Competitive Landscape Query**:
   - Query: "What do you know about Claro's competitive landscape?"
   - Expected: At least one memory containing "Google Translate"

4. **Multi-language Support**:
   - Query in languages other than English
   - Expected: Proper semantic matching regardless of language

5. **Temporal Relevance**:
   - Query about recent events
   - Expected: Recent memories prioritized appropriately

## Implementation Details

### Memory Relevance Scoring

The refactored MemoryRetriever will use a more sophisticated algorithm for scoring relevance:

1. **Base Semantic Score**: Vector similarity between query and memory
2. **Importance Modifier**: Apply boost based on memory importance_score
3. **Tag Matching**: Calculate similarity between query tags and memory tags
4. **Recency Bonus**: Apply recency factor when temporally relevant
5. **Final Score Calculation**: Weighted combination of all factors

### Logging & Transparency

The implementation will add detailed logging:
- Memory candidates with scores
- Importance values and their impact
- Tag matches and their contribution
- Final selected memories
- Performance metrics

### Error Handling

Robust error handling with:
- Custom error types for memory retrieval failures
- Fallback mechanisms for partial data
- Telemetry for monitoring failures
- Recovery strategies 