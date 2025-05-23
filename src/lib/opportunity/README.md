# Opportunity Management System

The Opportunity Management System is a framework for detecting, evaluating, and acting on opportunities within the agent swarm system.

## Architecture

The system is built with a modular architecture consisting of these key components:

### Core Components

1. **OpportunityManager**: The central orchestration component that coordinates the detection, evaluation, and processing of opportunities.

2. **OpportunityRegistry**: Stores and retrieves opportunities, with multiple implementations:
   - `MemoryOpportunityRegistry`: In-memory storage (non-persistent)
   - `PersistentOpportunityRegistry`: File-based storage using JSON
   - `CachingOpportunityRegistry`: Caching layer for performance optimization

3. **OpportunityDetector**: Detects opportunities from various sources and contexts.

4. **OpportunityEvaluator**: Evaluates opportunities to determine their value and priority.

### Data Model

- **Opportunity**: The core data model representing an opportunity with properties like:
  - ID, title, description
  - Type and priority
  - Status (detected, evaluating, pending, in_progress, completed, etc.)
  - Source and trigger information
  - Context data
  - Temporal information (detection time, validity, etc.)
  - Tags and result data

## Getting Started

### Creating the Opportunity System

```typescript
import { 
  createOpportunitySystem, 
  OpportunityStorageType 
} from '../lib/opportunity';

// Create with memory storage (default)
const memorySystem = createOpportunitySystem();

// Create with file storage
const fileSystem = createOpportunitySystem({
  storage: {
    type: OpportunityStorageType.FILE,
    storageDir: './data/opportunities',
    saveOnMutation: true
  }
});

// Create with cached file storage for better performance
const cachedSystem = createOpportunitySystem({
  storage: {
    type: OpportunityStorageType.CACHED_FILE,
    storageDir: './data/opportunities',
    maxCacheSize: 1000
  }
});

// Initialize the system
await fileSystem.initialize();
```

### Creating Opportunities

```typescript
const opportunity = await opportunitySystem.createOpportunity({
  title: 'Example Opportunity',
  description: 'This is an example opportunity',
  type: OpportunityType.TASK_OPTIMIZATION,
  priority: OpportunityPriority.MEDIUM,
  source: OpportunitySource.USER_INTERACTION,
  trigger: {
    type: 'example',
    source: OpportunitySource.USER_INTERACTION,
    content: 'Sample trigger content',
    confidence: 0.85,
    timestamp: new Date(),
    context: {}
  },
  context: {
    agentId: 'example-agent',
    source: 'example-source',
    metadata: {}
  },
  timeSensitivity: TimeSensitivity.STANDARD,
  tags: ['example']
});
```

### Finding and Filtering Opportunities

```typescript
// Find opportunities by filter
const opportunities = await opportunitySystem.findOpportunities({
  types: [OpportunityType.TASK_OPTIMIZATION],
  statuses: [OpportunityStatus.DETECTED, OpportunityStatus.EVALUATING],
  priorities: [OpportunityPriority.HIGH, OpportunityPriority.CRITICAL]
});

// Find opportunities for a specific agent
const agentOpportunities = await opportunitySystem.findOpportunitiesForAgent('agent-id');
```

### Updating Opportunities

```typescript
// Update an opportunity
await opportunitySystem.updateOpportunity(opportunityId, {
  priority: OpportunityPriority.HIGH,
  description: 'Updated description'
});

// Update status
await opportunitySystem.updateOpportunityStatus(
  opportunityId,
  OpportunityStatus.COMPLETED,
  {
    completedAt: new Date(),
    successful: true,
    outcomeDescription: 'Opportunity successfully handled'
  }
);
```

## Example Implementation

For a complete example of how to use the Opportunity Management System, see:
- `src/lib/opportunity/examples/usage-example.ts`

Run the example with:
```bash
ts-node scripts/run-opportunity-example.ts
```

## Testing

Integration tests are provided in:
- `src/lib/opportunity/__tests__/integration.test.ts` 