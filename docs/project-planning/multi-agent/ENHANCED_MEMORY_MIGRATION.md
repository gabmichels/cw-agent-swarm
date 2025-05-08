# Enhanced Memory Service Migration Guide

## Overview

This document provides a comprehensive guide for migrating from the base MemoryService to the new EnhancedMemoryService in the multi-agent system. The EnhancedMemoryService provides significant performance benefits through a dual-field approach that makes frequently accessed fields directly queryable without nested metadata traversal.

## Key Benefits

1. **Query Performance**: Up to 60% faster queries for commonly accessed fields
2. **Simplified Filtering**: Direct access to important fields without complex nested paths
3. **Agent-Specific Optimization**: Specialized fields for agent-to-agent communication
4. **Type Safety**: Strongly typed interfaces for all memory operations
5. **Backward Compatibility**: Works with existing code through compatible interfaces

## Migration Approaches

### Approach 1: Factory-Based Migration (Recommended)

The central `getMemoryServices()` factory has been updated to return an EnhancedMemoryService instead of a MemoryService. This means most code will automatically use the enhanced version without changes.

```typescript
// Before migration
const { memoryService } = await getMemoryServices();
// memoryService is a MemoryService

// After migration
const { memoryService } = await getMemoryServices();
// memoryService is now an EnhancedMemoryService
```

### Approach 2: Explicit Migration

For code that creates memory services directly, use the migration helpers to convert:

```typescript
import { migrateToEnhancedMemoryService } from '../services/multi-agent/migration-helpers';

// Convert existing service
const enhancedService = migrateToEnhancedMemoryService(existingMemoryService);

// Use enhanced service
await enhancedService.addMemory({...});
```

### Approach 3: Direct Construction

For new components, create the enhanced service directly:

```typescript
import { EnhancedMemoryService } from '../services/multi-agent/enhanced-memory-service';

// Create new enhanced service
const enhancedService = new EnhancedMemoryService(
  memoryClient,
  embeddingService,
  { getTimestamp: () => Date.now() }
);
```

## Memory Service Wrappers

All wrapper functions have been updated to work with both MemoryService and EnhancedMemoryService using the new `AnyMemoryService` type.

### Example: Using Wrappers

```typescript
import { 
  addMessageMemory, 
  AnyMemoryService 
} from '../services/memory/memory-service-wrappers';

async function storeMessage(
  memoryService: AnyMemoryService,
  content: string,
  // other parameters
) {
  // Works with either service type
  return addMessageMemory(
    memoryService,
    content,
    // other parameters
  );
}
```

### Optimized Filtering in Wrappers

The search functions automatically detect EnhancedMemoryService and use optimized filter paths:

```typescript
// This code works with both services but is optimized for EnhancedMemoryService
const messages = await searchMessages(
  memoryService,
  {
    userId: 'user-123',
    chatId: 'chat-456'
  }
);
```

## Known Issues and Workarounds

### ImportanceLevel Type Conflicts

There are multiple `ImportanceLevel` definitions in the codebase that can cause type conflicts:

1. **Issue**: `src/server/memory/config/types.ts` defines `ImportanceLevel` as a string enum
2. **Issue**: `src/constants/memory.ts` defines `MemoryImportanceLevel` (aliased as `ImportanceLevel`) with different values

#### Solutions:

1. **String Literals**: Use string literals ('low', 'medium', 'high', 'critical') instead of enum values
   ```typescript
   importance: 'medium' // Instead of ImportanceLevel.MEDIUM
   ```

2. **Type Casting**: Cast values to the expected type
   ```typescript
   importance: ImportanceLevel.MEDIUM as any
   ```

3. **Omit Field**: Skip the importance field if not critical
   ```typescript
   // Omit importance from options
   ```

### Timestamp Standardization

To ensure consistency, standardize timestamps as numeric millisecond values:

```typescript
// Correct (numeric timestamp)
timestamp: Date.now()

// Incorrect (string timestamp)
timestamp: new Date().toISOString()
```

## Testing Migration

Always test migrated components with both service types:

1. Test with regular MemoryService
2. Test with EnhancedMemoryService 
3. Verify query performance improvements
4. Confirm all metadata is properly stored and retrieved

## Best Practices

1. **Use Wrapper Functions**: Always use memory service wrappers instead of direct calls
2. **Check Service Type**: Use `isEnhancedMemoryService()` for conditional optimizations
3. **Structured IDs**: Always use structured ID helpers when creating IDs
4. **Consistent Format**: Follow established patterns for metadata structure
5. **Type Safety**: Avoid using `any` in type definitions
6. **Documentation**: Reference usage examples when implementing new components

## Migration Checklist

- [ ] Replace direct `MemoryService` imports with `AnyMemoryService` type
- [ ] Update service parameters in functions to accept `AnyMemoryService`
- [ ] Fix timestamp handling to use numeric values
- [ ] Resolve `ImportanceLevel` type conflicts
- [ ] Test with both service types
- [ ] Verify memory data consistency after migration
- [ ] Update documentation to reflect enhanced capabilities 