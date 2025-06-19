# Agent Memory System - Document Decay Prevention

## Overview

The agent memory system has been enhanced to prevent decay for document type memories, ensuring that uploaded documents and important files remain permanently accessible and untouchable by the decay process.

## Document Memory Protection

### Automatic Protection
All document type memories (`MemoryType.DOCUMENT`) are automatically protected from decay through multiple mechanisms:

1. **Type-Based Protection**: Document memories are explicitly checked and skipped during decay calculations
2. **Critical Flag**: All documents are automatically marked as `critical: true` when added to memory
3. **Zero Decay Factor**: Document type has a decay factor of 0 in the default configuration

### How It Works

#### 1. Memory Addition
When adding document memories using `addDocumentMemory()`:
- Documents are automatically marked with `critical: true` in their metadata
- This ensures backwards compatibility with existing critical memory protection

#### 2. Decay Calculation
In `calculateMemoryDecay()`:
```typescript
// Always protect document type memories from decay - they should be permanent
const isDocument = memory.type === MemoryType.DOCUMENT;

if (isCritical || isDocument) {
  // Return no decay
  return { decayRate: 0, isCritical: true, ... };
}
```

#### 3. Decay Application
In `runMemoryDecay()`:
```typescript
// Always protect document type memories from decay - they should be permanent
if (memory.type === MemoryType.DOCUMENT) {
  protectedCount++;
  continue;
}
```

### Configuration
The default decay configuration explicitly sets document decay factor to 0:
```typescript
typeDecayFactors: {
  [MemoryType.DOCUMENT]: 0, // Documents never decay - they are permanent
  // ... other types
}
```

## Benefits

1. **Permanent Document Storage**: Uploaded documents remain accessible indefinitely
2. **User Confidence**: Users can trust that their important documents won't be lost
3. **Knowledge Preservation**: Critical knowledge from documents is preserved
4. **Backward Compatibility**: Existing critical memory protection still works

## Usage

Document memories are automatically protected - no additional configuration required:

```typescript
// This document will be permanently protected from decay
const documentMemory = await addDocumentMemory(
  memoryService,
  'Important document content',
  DocumentSource.USER,
  {
    title: 'My Important Document',
    fileName: 'document.pdf'
  }
);
```

## Statistics

Document protection is tracked in decay statistics:
- `criticalMemoriesProtected` includes protected documents
- `typeDecayRates[MemoryType.DOCUMENT]` always shows 0 