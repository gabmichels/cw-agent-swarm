# Enhanced Memory Features for Chloe

This document describes the enhanced memory features implemented for Chloe's memory management system.

## Features Overview

1. **Hybrid Scoring Strategy**
   - Combines vector similarity (70%) with tag overlap (30%)
   - Improves relevance by considering both semantic similarity and topic matching

2. **Memory Usage Tracking**
   - Records each time a memory is used in a response
   - Applies a logarithmic boost formula: `adjusted_score = original_score * (1 + log(usage_count))`
   - Frequently used memories are more likely to be retrieved

3. **Memory Decay and Reinforcement**
   - Decay: Reduces importance scores by 5% weekly for unused memories
   - Critical memories are exempt from decay
   - Reinforcement: Increases importance by 20% when memories are helpful
   - Helper functions to mark memories as critical

4. **System Prompt Enhancement**
   - Injects relevant memories into the system prompt
   - Extracts key terms from user messages
   - Only includes memories with confidence scores above 0.75
   - Tracks usage when memories are injected

## Usage

### Hybrid Scoring

```typescript
import { applyHybridScoring } from '../lib/memory/MemoryUtils';

// After performing a basic vector search
const vectorResults = await searchMemory("document", query, { limit: 10 });

// Apply hybrid scoring that combines vector similarity with tag overlap
const hybridResults = applyHybridScoring(vectorResults, query);

// Results are automatically sorted by score
console.log(`Top result: ${hybridResults[0].text} (Score: ${hybridResults[0].score})`);
```

### Usage Tracking

```typescript
import { trackMemoryUsage } from '../lib/memory/MemoryUtils';

// When a memory is used in a response, track its usage
await trackMemoryUsage(memoryId);

// For multiple memories
const usedMemoryIds = [memoryId1, memoryId2, memoryId3];
for (const id of usedMemoryIds) {
  await trackMemoryUsage(id);
}
```

### Memory Reinforcement and Protection

```typescript
import { 
  reinforceMemoryImportance, 
  markMemoryAsCritical 
} from '../lib/memory/MemoryUtils';

// When a memory is explicitly helpful, reinforce it
await reinforceMemoryImportance(memoryId, "user_feedback_helpful");

// Mark a memory as critical to protect it from decay
await markMemoryAsCritical(memoryId, true);
```

### Memory Decay

```typescript
import { decayMemoryImportance } from '../lib/memory/MemoryUtils';

// Run memory decay (typically as a scheduled weekly task)
const decayStats = await decayMemoryImportance({
  decayPercent: 5,         // 5% decay
  olderThan: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  dryRun: false            // Set to true to simulate without making changes
});

console.log(`Decay results: Processed ${decayStats.processed}, Decayed ${decayStats.decayed}`);
```

### System Prompt Injection

```typescript
import { injectMemoriesIntoPrompt } from '../lib/memory/MemoryUtils';

// Get the base system prompt
let systemPrompt = SYSTEM_PROMPTS.CHLOE;

// Enhance it with relevant memories based on the user message
const enhancedPrompt = await injectMemoriesIntoPrompt(systemPrompt, userMessage);

// Use the enhanced prompt for the AI response
const response = await model.invoke([
  new SystemMessage(enhancedPrompt),
  new HumanMessage(userMessage)
]);
```

## Testing the Features

Two test scripts are provided to demonstrate these features:

1. **Basic Memory Utilities Test**
   ```
   ts-node src/lib/memory/test-memory-utils.ts
   ```
   
   This script tests hybrid scoring, usage tracking, reinforcement, and decay.

2. **Prompt Injection Demo**
   ```
   ts-node src/lib/memory/prompt-injection-demo.ts
   ```
   
   This script demonstrates how relevant memories are retrieved and injected into the system prompt before generating a response, and compares memory-augmented responses with standard responses.

## Implementation Notes

- The hybrid scoring strategy works best when memories are well-tagged
- Memory decay helps prevent memory overload while preserving important information
- Usage tracking creates a self-improving loop where helpful memories become more likely to be retrieved
- Critical memories (like user preferences, brand guidelines, etc.) should be explicitly marked to protect them from decay 