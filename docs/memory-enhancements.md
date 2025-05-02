# Memory System Enhancements

This document outlines the enhancements made to Chloe's memory system to improve retrieval accuracy and handle cases where information is missing.

## Hybrid Retrieval with Reranking

We've implemented a hybrid retrieval approach that combines vector search with advanced reranking to improve the relevance of retrieved memory entries.

### Key Components:

1. **RerankerService**: A new service (`src/agents/chloe/services/reranker.ts`) that evaluates and reranks candidate memory entries based on their relevance to the user's query.

2. **Enhanced Memory Retrieval**: The `getEnhancedRelevantMemories` method in `ChloeMemory` now uses a two-stage retrieval process:
   - Initial retrieval of candidates using vector search
   - Reranking of candidates using a dedicated model

3. **Confidence Thresholds**: Results are evaluated against confidence thresholds to determine if there's sufficient relevant information to answer a query.

4. **Content Validation**: The system validates if the retrieved content actually contains the information needed to answer the query.

## Agent Updates

We've updated the agent logic to handle cases where confidence thresholds aren't met:

1. **Query Type Detection**: Added patterns to identify specific types of queries (like company information, brand identity).

2. **Missing Knowledge Handling**: Implemented special handling for cases where the agent lacks sufficient confident information, particularly for brand identity queries.

3. **Enhanced Reasoning**: The agent now factors in confidence levels and content validation results when processing messages.

## Testing Tools

Several test scripts have been added to validate the memory enhancements:

1. `memory:test-brand`: Verifies that brand.md is correctly ingested and retrievable.

2. `memory:test-confidence`: Tests the confidence threshold implementation with different queries and threshold levels.

3. `memory:test-reranking`: Tests the reranking system for more accurate memory retrieval.

## Usage

The enhanced memory system integrates seamlessly with the existing agent logic. When a user asks about Claro's brand identity or other company information, the system will:

1. Detect the query type and apply specific memory filters
2. Retrieve candidate memories with more relevant content
3. Evaluate the confidence in the retrieved information
4. Either provide the information or request clarification if confidence is low

## Configuration

The system uses several configurable parameters:

- `confidenceThreshold`: Default is 70%. Can be adjusted per query type.
- `validateContent`: When true, performs additional validation on retrieved content.
- `requireConfidence`: When true, returns no results if confidence threshold isn't met.

## Next Steps

Future enhancements could include:

1. Improving the tag-based metadata system for better retrieval
2. Implementing additional specialized retrievers for different query types
3. Adding user feedback loops to improve retrieval accuracy over time 