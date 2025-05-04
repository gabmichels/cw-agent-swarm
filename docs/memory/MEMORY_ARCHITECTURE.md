# Memory System Architecture

## Overview

The memory system is built on top of Qdrant, a vector database that enables semantic search capabilities. It stores and retrieves various types of memories including messages, thoughts, documents, and tasks.

## Collection Structure

The system currently uses the following collections:

| Collection Name | Purpose | Key Fields |
|-----------------|---------|------------|
| `messages` | User and assistant messages | role, content, timestamp |
| `thoughts` | Agent reflections and reasoning | content, type, timestamp |
| `documents` | Stored documents and files | content, title, source |
| `tasks` | Agent tasks and goals | content, status, priority |
| `memory_edits` | Version history of memories | original_memory_id, edit_type |

## Current Issues

1. **Inconsistent Collection Naming**: The `COLLECTIONS` constant uses singular keys but plural values.
2. **Type Inconsistencies**: Memory records have inconsistent structures across different functions.
3. **Error Handling**: Inconsistent error handling with fallbacks that hide issues.
4. **Monolithic Architecture**: The `index.ts` file is ~3300 lines with tightly coupled responsibilities.
5. **No Testing**: Lack of tests for critical memory operations.
6. **Redundant Code**: Multiple implementations of similar functionality.

## Main Operations

The memory system supports the following core operations:

1. **Adding Memories**: `addMemory`, `storeMemory`
2. **Retrieving Memories**: `searchMemory`, `getMemoryById`, `getRecentMemories`, `getAllMemories`
3. **Updating Memories**: `updateMemory`, `updateMemoryMetadata`
4. **Deleting Memories**: `deleteMemory`
5. **Memory Management**: `reinforceMemory`, `decayMemoryImportance`, `trackMemoryUsage`
6. **Causal Relationships**: `establishCausalLink`, `traceCausalChain`

## Access Patterns

The memory system is accessed through multiple patterns:

1. **Direct API calls**: Client code making direct calls to memory functions
2. **Agent operations**: Agents accessing memory for context and reasoning
3. **Batch processing**: Background processes like memory decay and importance recalculation
4. **User interactions**: UI-driven memory retrieval and modification

## Technical Debt

1. Inconsistent parameter and return types across similar functions
2. Absence of standardized error handling
3. Hardcoded fallbacks with random vector generation
4. Mixed concerns (embedding generation, database interaction, memory logic)
5. No validation of memory structure before insertion 