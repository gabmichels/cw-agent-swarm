# Tag Extraction Guide: Memory Creation & API Patterns

This document explains how tag extraction works during memory creation in our codebase, and verifies that it will work with our next-generation API patterns.

## Current Tag Extraction Architecture

### 1. Memory Creation Flow

Our memory system has two primary ways to generate tags during memory creation:

1. **Direct Creation API:** When creating memories through the `addMemory()` method
2. **Tag Extractor Middleware:** Post-creation tag enhancement using the `TagExtractorMiddleware`

### 2. Memory Creation without Auto-Tagging

The core memory creation process works as follows:

```typescript
// From src/server/memory/services/memory/memory-service.ts
async addMemory<T extends BaseMemorySchema>(params: AddMemoryParams<T>): Promise<MemoryResult> {
  // ... validation and setup ...
  
  // Generate ID if not provided
  const id = params.id || uuidv4();
  
  // Generate embedding if not provided
  const embedding = params.embedding || 
    (await this.embeddingService.getEmbedding(params.content)).embedding;
  
  // Create memory point
  const point: MemoryPoint<T> = {
    id,
    vector: embedding,
    payload: {
      text: params.content,
      type: params.type,
      timestamp: this.getTimestamp().toString(),
      ...(collectionConfig.defaults || {}),
      ...(params.payload || {}),
      metadata: {
        ...(collectionConfig.defaults?.metadata || {}),
        ...(params.metadata || {})
      }
    } as any
  };
  
  // Add to collection
  await this.client.addPoint(collectionConfig.name, point);
  
  return {
    success: true,
    id
  };
  // ... error handling ...
}
```

This basic flow does not automatically extract tags. Tags must be provided in the `metadata.tags` field if needed.

### 3. Tag Extractor Middleware

For automatic tag extraction, we use a specialized middleware that processes memories after creation:

```typescript
// From src/agents/chloe/core/tagExtractorMiddleware.ts
async processMemoryItem(
  memoryId: string,
  content: string,
  existingTags: string[] = []
): Promise<void> {
  try {
    // Normalize existing tags
    const normalizedExistingTags = normalizeTags(existingTags);
    
    // Extract tags from the memory content
    const extractionResult = await extractTags(content, {
      maxTags: this.maxTags,
      existingTags: normalizedExistingTags
    });
    
    // ... validation and normalization ...
    
    // Store update to be applied later
    this.memoryUpdates.set(memoryId, {
      memoryId,
      tags: allTags
    });
    
    // ... logging ...
  } catch (error) {
    // ... error handling ...
  }
}
```

Later, these stored updates are applied:

```typescript
async applyMemoryUpdates(): Promise<void> {
  // ... setup ...
  
  for (const [memoryId, update] of updates) {
    try {
      // Update memory with new tags
      await this.memoryManager.updateMemory(
        memoryId,
        {
          metadata: {
            tags: update.tags,
            tagsManagedBy: 'openai-extractor',
            tagsUpdatedAt: new Date().toISOString()
          }
        }
      );
    } catch (error) {
      // ... error handling ...
    }
  }
  
  // Clear the updates
  this.memoryUpdates.clear();
}
```

### 4. Tag Extraction Implementation

The actual tag extraction is performed by the `tagExtractor` service:

```typescript
// From src/utils/tagExtractor.ts
export class OpenAITagExtractor {
  // ... implementation details ...
  
  async extractTags(
    content: string, 
    options: ExtractionOptions = {}
  ): Promise<TagExtractionResult> {
    // ... caching, validation, and setup ...
    
    try {
      // Extract tags using OpenAI
      const extractionResult = await this.extractTagsWithOpenAI(
        content,
        options.maxTags || 10
      );
      
      // ... processing and returning results ...
    } catch (error) {
      // ... error handling ...
    }
  }
}
```

## Compatibility with API Patterns

### API Route Pattern Analysis

Our tag extraction during memory creation is compatible with our working API patterns because:

1. **No Direct Dependency on API Routes**: The tag extraction process does not directly depend on any API routes. It works through direct method calls to the memory service and tag extractor service.

2. **Update API Works with Our Pattern**: The memory update API used by the `TagExtractorMiddleware` follows our proven pattern:
   ```
   /api/memory/[id]/tags
   ```
   
   This pattern matches our verified working pattern with dynamic parameters in the middle.

3. **No Flat API Routes Used**: The tag extraction process does not use any flat API routes (like `/api/regenerate-tags`) that we've found to be problematic.

### Tag Updating Process

The tag updating API route uses this pattern:

```typescript
// From components/tabs/MemoryTab.tsx
const API_ENDPOINTS = {
  // ...
  TAG_UPDATE: (memoryId: string) => `/api/memory/${memoryId}/tags`,
  // ...
};

const handleTagUpdate = useCallback(async (memoryId: string, tags: string[]) => {
  console.log(`Updating tags for memory ${memoryId}:`, tags);
  
  try {
    // Use standardized API endpoint for tag update
    const updateUrl = API_ENDPOINTS.TAG_UPDATE(memoryId);
    console.log(`Making tag update request to: ${updateUrl}`);
    
    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    });
    
    // ... response handling ...
  } catch (error) {
    // ... error handling ...
  }
}, [handleRefresh]);
```

This matches our working pattern and has been verified to work correctly.

## Implementation Recommendations

For future development, we recommend the following tag extraction patterns:

### 1. Client-Side Tag Extraction

For simple tag extraction needs, use client-side extraction:

```typescript
// Client-side tag extraction
const generateTags = (content: string): string[] => {
  // Extract unique words, filter out common words and short words
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => 
      word.length > 5 &&
      !['about', 'there', 'these', 'their', 'would', 'should', 'could'].includes(word)
    );
    
  // Get unique words
  const uniqueWords = Array.from(new Set(words));
  
  // Use the most frequent words as tags
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by frequency and take the top ones
  const sortedWords = Object.keys(wordCounts)
    .sort((a, b) => wordCounts[b] - wordCounts[a])
    .slice(0, 7);
  
  // Add some standard tags
  return [
    ...sortedWords,
    'memory',
    'content',
    new Date().toISOString().substring(0, 10)
  ];
};
```

### 2. Server-Side Tag Extraction

For more advanced tag extraction, use the established pattern:

```typescript
// src/pages/api/memory/[id]/tags/generate.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { tagExtractor } from '../../../../../utils/tagExtractor';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const memoryId = req.query.id as string;
    const { content } = req.body;
    
    // Basic validation
    if (!memoryId || !content) {
      return res.status(400).json({ 
        error: 'Memory ID and content are required' 
      });
    }
    
    // Extract tags using the tag extractor
    const extractionResult = await tagExtractor.extractTags(content, {
      maxTags: 10
    });
    
    // Return extracted tags
    return res.status(200).json({
      success: true,
      memoryId,
      tags: extractionResult.tags.map(tag => tag.text)
    });
  } catch (error) {
    // Error handling
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

## Conclusion

The tag extraction process during memory creation is compatible with our working API patterns. It primarily relies on:

1. Direct method calls to memory and tag extraction services
2. The memory update API that follows our proven pattern with dynamic parameters in the middle
3. Post-creation tag enhancement through the `TagExtractorMiddleware`

For new tag extraction features, we recommend using either client-side extraction for simple cases or following our established API patterns with dynamic parameters in the middle for server-side extraction.

---

Document created on May 6, 2025 to verify tag extraction compatibility with API patterns. 