# TypeScript Issues Tracker

## Instructions
This document tracks TypeScript errors found in the codebase. Each issue will be listed with its location, error message, and status. When fixing issues, update this tracker by marking items as completed. Use the Windows PowerShell command `npx tsc` to verify if issues are fixed.

## Summary
- Initial Issues: 538 (in 134 files)
- Current Issues: 219 (in 56 files)
- Completed Issues: 
  - 9 in `scheduler-persistence.test.ts`
  - ~10 in `cached-memory-service.test.ts`
  - 1 in `config.ts` - Removed duplicate `MemoryType` enum
  - 8 in `execution-analyzer-integration.test.ts`
  - 16 in `tool-routing-integration.test.ts`
  - 4 in `strategy-updater-integration.test.ts`
  - 1 in `memory-integration.test.ts`
  - 14 in `search-service.test.ts`
  - 3 in `filter-service.test.ts`
  - 13 in `search-service-extended.test.ts`
  - 4 in `memory-service.test.ts`
  - 2 in `qdrant-client.test.ts`
- Remaining Issues: Primarily in Chloe agent files, API routes, and component files

## Progress Made

### Fixed Issues

1. **In src/server/memory/testing/integration/scheduler-persistence.test.ts**:
   - Added the `schemaVersion` field to the mock metadata
   - Created a task-specific metadata interface
   - Fixed typing for memory points

2. **In src/server/memory/testing/unit/cached-memory-service.test.ts**:
   - Fixed issues with `extractIndexableFields` return type
   - Created proper mock for `EnhancedMemoryService` with all required methods
   - Used type assertions to handle type compatibility

3. **In src/server/memory/config.ts**:
   - Removed the duplicate MemoryType enum
   - Added re-export from `config/types.ts`

4. **In src/server/memory/testing/integration/execution-analyzer-integration.test.ts**:
   - Updated import of `MemoryType` to use the correct path (`config/types.ts`)
   - Created a proper adapter for `EnhancedMemoryService` in the `MockSearchService` constructor
   - Added `schemaVersion: '1.0.0'` to all metadata objects
   - Fixed the mock execution outcome to include required schema version

5. **In src/server/memory/testing/integration/tool-routing-integration.test.ts**:
   - Updated import of `MemoryType` from `config/types.ts`
   - Created a custom `ToolMetadataSchema` interface for tool-specific metadata 
   - Created a proper adapter for `EnhancedMemoryService` with all required methods
   - Ensured all metadata objects include `schemaVersion: '1.0.0'`
   - Used type assertions to fix type compatibility issues

6. **In src/server/memory/testing/integration/strategy-updater-integration.test.ts**:
   - Updated import of `MemoryType` from `config/types.ts`
   - Created a proper adapter for `EnhancedMemoryService`
   - Fixed reference to non-existent function `adjustBasedOnRecentOutcomes`
   - Added `schemaVersion: '1.0.0'` to all metadata objects

7. **In src/server/memory/testing/integration/memory-integration.test.ts**:
   - Updated import of `MemoryType` from `config/types.ts`
   - Created adapter for `EnhancedMemoryService`
   - Added `schemaVersion: '1.0.0'` to all metadata objects

8. **In src/server/memory/testing/unit/search-service.test.ts**:
   - Updated import of `MemoryType` from `config/types.ts`
   - Created proper adapter for `EnhancedMemoryService`
   - Created mock implementations for the MemoryContext interface
   - Fixed assertions to match the current API structure
   - Added `schemaVersion: '1.0.0'` to all metadata objects

9. **In src/server/memory/testing/unit/filter-service.test.ts**:
   - Updated import of `MemoryType` from `config/types.ts`
   - Created adapter for `EnhancedMemoryService`
   - Added `schemaVersion: '1.0.0'` to all metadata objects
   - Fixed collection name references

10. **In src/server/memory/testing/unit/search-service-extended.test.ts**:
    - Updated import of `MemoryType` from `config/types.ts`
    - Created adapter for `EnhancedMemoryService`
    - Added `schemaVersion: '1.0.0'` to all metadata objects
    - Fixed COLLECTION_NAMES references to use dot notation

11. **In src/server/memory/testing/unit/memory-service.test.ts**:
    - Updated import of `MemoryType` from `config/types.ts`
    - Added `schemaVersion: '1.0.0'` to all metadata objects

12. **In src/server/memory/testing/unit/qdrant-client.test.ts**:
    - Updated import of `MemoryType` and `ImportanceLevel` from `config/types.ts`
    - Added `schemaVersion: '1.0.0'` to all metadata objects

## Root Causes

1. **MemoryType Enum Mismatches**
   - Two different `MemoryType` enums existed in the codebase, causing inconsistencies
   - Some code was using the old enum from `config.ts` while other code was using the new enum from `config/types.ts`

2. **Missing Required Properties in Metadata**
   - The `BaseMetadataSchema` interface requires a `schemaVersion` property, which was missing in mock objects
   - Test files were using simplified metadata objects that didn't satisfy the interface requirements

3. **EnhancedMemoryService vs MemoryService Type Mismatches**
   - `EnhancedMemoryService` is used where `MemoryService` was previously used
   - Many test files were still using `MemoryService` where `EnhancedMemoryService` is expected

4. **Task-Specific Metadata Fields**
   - Different memory types require specific metadata fields
   - Mock objects in tests didn't include all required fields

5. **References to Non-existent Functions**
   - Some test files referenced functions that don't exist
   - These needed to be updated to check for existence of objects instead

6. **API Changes**
   - The `MemoryContext` interface was updated to use a groups-based structure
   - Tests were still expecting the old API structure with `memories` and `total` properties

7. **ImportanceLevel Enum Mismatches**
   - Two different `ImportanceLevel` enums existed in the codebase
   - One in `constants/memory.ts` (`MemoryImportanceLevel`) and another in `config/types.ts`

## Fix Strategy

1. For the `MemoryType` enum inconsistency: 
   - Removed the duplicate enum in `config.ts`
   - Added re-export from `config/types.ts`
   - Updated imports to use the correct enum

2. For missing metadata properties:
   - Add `schemaVersion: '1.0.0'` to all mock metadata objects
   - Ensure all required fields in `BaseMetadataSchema` are provided

3. For EnhancedMemoryService vs MemoryService mismatches:
   - Create adapters that implement the EnhancedMemoryService interface
   - Add all methods and properties required by consuming classes

4. For type-specific metadata:
   - Create custom interfaces that extend BaseMetadataSchema
   - Add type-specific fields to these interfaces
   - Use type assertions when accessing specific fields

5. For API changes:
   - Update tests to check for the new structure (e.g., `groups` instead of `memories`)
   - Create appropriate mock objects that match the current API structure

6. For ImportanceLevel mismatches:
   - Use the correct ImportanceLevel enum from `config/types.ts` in server code
   - Add type-specific fields to these interfaces

## Current Issues

### Test files with remaining errors
1. **src/server/memory/testing/unit/search-service.test.ts** (10 errors):
   - Property 'score' is missing in type 'MemoryPoint<BaseMemorySchema>' but required in type 'MemorySearchResult<BaseMemorySchema>'
   - Property 'scanPoints' does not exist on type 'MockMemoryClient'
   - Property 'getCollectionName' does not exist on type 'SearchService'
   - Type conversion issues with MemoryType and COLLECTION_NAMES

2. **src/server/memory/testing/unit/qdrant-client.test.ts** (2 errors):
   - Type 'ImportanceLevel' is not assignable to type 'MemoryImportanceLevel | undefined'

3. **src/server/memory/testing/unit/cached-memory-service.test.ts** (2 errors)

4. **src/server/memory/testing/setup-test-collections.ts** (1 error)

### Service Implementation Files
1. **src/server/memory/services/search/search-service.ts** (6 errors)
2. **src/server/memory/services/memory/helpers.ts** (1 error)
3. **src/server/memory/scripts/setup-collections.ts** (1 error)
4. **src/server/memory/services/multi-agent/messaging/__tests__/factory.test.ts** (2 errors)

### Most Affected Areas
- **Chloe Agent Files** (76 errors): Primarily in scheduler, tasks, and autonomous execution components
- **API Routes** (45 errors): Mostly memory-related API endpoints
- **Web UI Components** (19 errors): Including FilesTable and MemoryItem components
- **Memory Library** (22 errors): Particularly in knowledge-graph implementation

## Remaining Files & Errors
Errors  Files
     1  .next/types/app/api/memory/all/route.ts:12
     1  src/agents/chloe/adapters/registry-adapter.ts:10
     2  src/agents/chloe/agent.ts:26
     1  src/agents/chloe/autonomy.ts:46
     1  src/agents/chloe/core/planningManager.ts:798
     2  src/agents/chloe/examples/graph-test.ts:36
    15  src/agents/chloe/scheduler.ts:34
     8  src/agents/chloe/scheduler/autonomousScheduler.ts:65
    12  src/agents/chloe/scheduler/chloeScheduler.ts:163
     3  src/agents/chloe/self-initiation/autonomousScheduler.ts:75
     2  src/agents/chloe/self-initiation/opportunityDetector.ts:82
     6  src/agents/chloe/tasks/allTasks.ts:66
     9  src/agents/chloe/tasks/marketScanTask.ts:57
     6  src/agents/chloe/tasks/memoryConsolidation.ts:16
     1  src/agents/chloe/time-reasoning/resourceManager.ts:57
     1  src/agents/chloe/time-reasoning/timePredictor.ts:63
     3  src/app/api/chat/delete-message/route.ts:84
     3  src/app/api/chat/messages/delete/route.ts:81
     2  src/app/api/check-chloe/route.ts:71
     7  src/app/api/debug/clear-images/route.ts:100
     6  src/app/api/debug/memory/route.ts:47
     1  src/app/api/debug/reset-chat/route.ts:69
     2  src/app/api/memory/add-knowledge.ts:62
     4  src/app/api/memory/add-knowledge/route.ts:66
     4  src/app/api/memory/check-format/route.ts:41
     4  src/app/api/memory/debug-memory-types/route.ts:70
     1  src/app/api/memory/flag-unreliable/route.ts:43
     3  src/app/api/memory/flagged/route.ts:84
     1  src/app/api/memory/transfer/route.ts:87
     1  src/app/api/run-task/route.ts:30
     1  src/app/api/scheduler-tasks/route.ts:112
     6  src/app/api/social-media-data/route.ts:89
     1  src/app/api/tasks/route.ts:20
     1  src/app/api/toggle-task/route.ts:37
     2  src/app/utils/chatHandler.ts:52
     4  src/cli/chloe.ts:43
    11  src/components/FilesTable.tsx:57
     8  src/components/memory/MemoryItem.tsx:85
     2  src/lib/memory/src/cognitive-memory.ts:227
    17  src/lib/memory/src/knowledge-graph.ts:297
     3  src/lib/memory/test-memory-utils.ts:550
     1  src/scheduledTasks/chloe.ts:21
     1  src/scripts/reindex-markdown.ts:16
     1  src/scripts/run-chloe-scheduler.ts:22
     1  src/server/memory/scripts/setup-collections.ts:9
     1  src/server/memory/services/memory/helpers.ts:43
     2  src/server/memory/services/multi-agent/messaging/__tests__/factory.test.ts:77
     6  src/server/memory/services/search/search-service.ts:114
     1  src/server/memory/testing/setup-test-collections.ts:46
     2  src/server/memory/testing/unit/cached-memory-service.test.ts:458
     2  src/server/memory/testing/unit/qdrant-client.test.ts:149
    10  src/server/memory/testing/unit/search-service.test.ts:451
     1  src/tools/loadMarkdownToMemory.ts:8
     2  tests/markdownMemoryLoader.test.ts:4
    13  tests/markdownMemoryRetrieval.test.ts:4
     6  tests/markdownWatcher.test.ts:5

## Next Steps

Now that we've made significant progress fixing the integration tests and unit tests, the next areas to focus on are:

1. **Remaining unit test issues**:
   - Fix the `search-service.test.ts` with 10 remaining errors
   - Resolve the ImportanceLevel type issues in `qdrant-client.test.ts`
   - Address the 2 remaining errors in `cached-memory-service.test.ts`

2. **Core service implementation files**:
   - Fix the 6 errors in `search-service.ts`
   - Address issues in memory helpers and factory test files

3. **Prioritize by impact**:
   - Focus on the most reused components that will have the greatest impact when fixed
   - Consider creating standardized adapter patterns that can be reused across multiple files

Using the patterns we've established, we can continue to fix these issues systematically.
