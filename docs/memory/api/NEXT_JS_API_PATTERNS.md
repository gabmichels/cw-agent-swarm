# Next.js API Patterns for Memory System

This document provides guidelines for creating reliable API endpoints for the memory system based on our experience with routing issues. Follow these patterns to ensure your endpoints work consistently.

## Recommended API Structure

Based on extensive testing, we've identified endpoint structures that reliably work in this project:

### ✅ Recommended Pattern: Dynamic Parameter in Middle

```
/api/memory/[id]/tags
/api/memory/[id]/actions/regenerate
/api/memory/[id]/operations/tag
```

This pattern has consistently proven reliable across our codebase.

### ❌ Avoid: Simple Root Endpoints

```
/api/test
/api/regenerate-tags
/api/simple-endpoint
```

These endpoints often result in 404 errors despite correct implementation.

### ❌ Avoid: Dynamic Parameter at End After Single Segment

```
/api/regenerate-tags/[id]
/api/simple/[param]
```

These patterns have been unreliable in our testing.

## Implementation Guide

### Step 1: Use the Right File Structure

Place your API file in the correct directory following the path pattern:

```
src/
  pages/
    api/
      memory/
        [id]/
          tags/
            action.ts
```

### Step 2: Implement the Handler

```typescript
import { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  success: boolean;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // 1. Log the request for debugging
  console.log(`API endpoint called: ${req.url}`);
  console.log(`Request method: ${req.method}`);
  console.log(`Memory ID: ${req.query.id}`);
  
  // 2. Validate request method
  if (req.method !== 'POST' && req.method !== 'PUT') {
    console.log(`Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  // 3. Extract parameters from the URL and body
  try {
    const memoryId = req.query.id as string;
    if (!memoryId) {
      return res.status(400).json({
        success: false,
        error: 'Memory ID is required'
      });
    }

    const { param1, param2 } = req.body;
    
    // 4. Process the request
    // Your business logic here
    const result = await processRequest(memoryId, param1, param2);
    
    // 5. Return a successful response
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // 6. Handle errors consistently
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function for your business logic
async function processRequest(memoryId: string, param1: any, param2: any) {
  // Implementation
  return { result: 'Success', memoryId };
}
```

### Step 3: Testing New Endpoints

1. Create your API file following the recommended pattern
2. Stop the Next.js server completely:
   ```
   taskkill /F /IM node.exe   # Windows
   pkill -f node              # Linux/Mac
   ```
3. Clear the Next.js cache:
   ```
   rm -rf .next/server/pages-manifest.json
   ```
4. Restart the server:
   ```
   npm run dev
   ```
5. Test your endpoint with appropriate tools (curl, Postman, browser)

## Example: Memory Tag Operations

### Creating a Tag Update Endpoint

```typescript
// src/pages/api/memory/[id]/tags/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getMemoryServices } from '../../../../../server/memory/services';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`Tags endpoint called for memory: ${req.query.id}`);
  
  // Only allow PUT to update tags
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const memoryId = req.query.id as string;
    const { tags } = req.body;
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }
    
    // Update tags in the memory system
    const { memoryService } = await getMemoryServices();
    const result = await memoryService.updateMemoryTags(memoryId, tags);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating tags:', error);
    return res.status(500).json({ 
      error: 'Failed to update tags',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

### Creating a Tag Generation Endpoint

```typescript
// src/pages/api/memory/[id]/tags/generate.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { tagExtractor } from '../../../../../utils/tagExtractor';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`Tag generation endpoint called for memory: ${req.query.id}`);
  
  // Only allow POST for generation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const memoryId = req.query.id as string;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Generate tags using the tag extractor
    const extractionResult = await tagExtractor.extractTags(content, {
      maxTags: 10,
      minConfidence: 0.3
    });
    
    if (!extractionResult.success) {
      throw new Error(extractionResult.error);
    }
    
    // Format tags for response
    const tags = extractionResult.tags.map(tag => tag.text);
    
    return res.status(200).json({
      success: true,
      memoryId,
      tags
    });
  } catch (error) {
    console.error('Error generating tags:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to generate tags',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

## Client-Side Integration

When implementing client-side code that calls your API:

```typescript
// Example: Calling the tag update API
const updateTags = async (memoryId: string, tags: string[]) => {
  const response = await fetch(`/api/memory/${memoryId}/tags`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update tags: ${response.status}`);
  }
  
  return await response.json();
};

// Example: Calling the tag generation API
const generateTags = async (memoryId: string, content: string) => {
  const response = await fetch(`/api/memory/${memoryId}/tags/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate tags: ${response.status}`);
  }
  
  return await response.json();
};
```

## Fallback Strategies

If you're still experiencing issues with API routes:

1. **Client-Side Processing**: Consider moving simple logic to the client-side when appropriate
2. **Use Existing Endpoints**: Leverage endpoints we know work rather than creating new ones
3. **Consolidate Endpoints**: Implement multiple operations in single endpoints with different HTTP methods

## Debugging API Routes

Add detailed logging at the beginning of your API handler:

```typescript
console.log(`API DEBUG: ${req.method} ${req.url}`);
console.log('API DEBUG: Query parameters:', req.query);
console.log('API DEBUG: Body:', req.body);
```

Monitor server logs for 404 errors or missing route compilation messages.

---

Document created on May 6, 2025 based on our troubleshooting experiences with Next.js API routing in the memory system. 