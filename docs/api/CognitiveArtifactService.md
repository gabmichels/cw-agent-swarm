# CognitiveArtifactService API Documentation

The CognitiveArtifactService is responsible for storing and retrieving cognitive artifacts - structured records of an agent's thinking process, including thoughts, reasoning chains, reflections, insights, plans, and tasks.

## Constructor

```typescript
constructor(memoryService: MemoryService, agentId?: string)
```

- `memoryService`: The memory service for persisting cognitive artifacts
- `agentId`: The ID of the agent creating the artifacts (defaults to 'default')

## Methods

### storeThought

```typescript
async storeThought(
  content: string,
  options?: {
    intention?: string;
    confidenceScore?: number;
    importance?: ImportanceLevel;
    relatedTo?: string[];
    influencedBy?: string[];
    contextId?: string;
    tags?: string[];
    category?: string;
  }
): Promise<string | null>
```

Stores a cognitive thought with associated metadata.

**Parameters:**
- `content`: The thought content
- `options`: Optional configuration
  - `intention`: Purpose of the thought (e.g., 'problem-solving', 'analysis')
  - `confidenceScore`: Confidence level (0.0-1.0)
  - `importance`: Importance level (LOW, MEDIUM, HIGH)
  - `relatedTo`: IDs of related memories
  - `influencedBy`: IDs of memories that influenced this thought
  - `contextId`: Context identifier
  - `tags`: Custom tags for categorization
  - `category`: Broad category classification

**Returns:**
- Memory ID if successful, null otherwise

### storeReasoning

```typescript
async storeReasoning(
  steps: string[],
  conclusion: string,
  options?: {
    importance?: ImportanceLevel;
    relatedTo?: string[];
    influencedBy?: string[];
    contextId?: string;
    confidence?: number;
    tags?: string[];
    category?: string;
  }
): Promise<string | null>
```

Stores a reasoning chain including multiple steps and a conclusion.

**Parameters:**
- `steps`: Array of reasoning steps in sequence
- `conclusion`: Final conclusion of the reasoning process
- `options`: Optional configuration (similar to storeThought)

**Returns:**
- Memory ID if successful, null otherwise

### storeReflection

```typescript
async storeReflection(
  content: string,
  options?: {
    reflectionType?: 'experience' | 'behavior' | 'strategy' | 'performance';
    timeScope?: 'immediate' | 'short-term' | 'long-term';
    importance?: ImportanceLevel;
    relatedTo?: string[];
    influencedBy?: string[];
    contextId?: string;
    tags?: string[];
    category?: string;
  }
): Promise<string | null>
```

Stores an agent reflection on its own performance, behavior, or strategy.

**Parameters:**
- `content`: Reflection content
- `options`: Optional configuration
  - `reflectionType`: Type of reflection (defaults to 'experience')
  - `timeScope`: Temporal scope of the reflection (defaults to 'immediate')
  - Other fields similar to storeThought

**Returns:**
- Memory ID if successful, null otherwise

### storeInsight

```typescript
async storeInsight(
  content: string,
  options?: {
    insightType?: 'pattern' | 'implication' | 'prediction' | 'opportunity';
    applicationContext?: string[];
    validityPeriod?: {
      from?: string;
      to?: string;
    };
    importance?: ImportanceLevel;
    relatedTo?: string[];
    influencedBy?: string[];
    contextId?: string;
    tags?: string[];
    category?: string;
  }
): Promise<string | null>
```

Stores an insight derived from analysis or pattern recognition.

**Parameters:**
- `content`: Insight content
- `options`: Optional configuration
  - `insightType`: Type of insight (defaults to 'pattern')
  - `applicationContext`: Contexts where the insight applies
  - `validityPeriod`: Temporal validity of the insight
  - Other fields similar to storeThought

**Returns:**
- Memory ID if successful, null otherwise

### storePlan

```typescript
async storePlan(
  goal: string,
  steps: string[],
  options?: {
    planType?: 'task' | 'strategy' | 'contingency';
    estimatedSteps?: number;
    dependsOn?: string[];
    importance?: ImportanceLevel;
    relatedTo?: string[];
    influencedBy?: string[];
    contextId?: string;
    tags?: string[];
    category?: string;
  }
): Promise<string | null>
```

Stores a plan with a goal and defined execution steps.

**Parameters:**
- `goal`: The objective of the plan
- `steps`: Array of plan execution steps
- `options`: Optional configuration
  - `planType`: Type of plan (defaults to 'task')
  - `estimatedSteps`: Estimated number of steps (defaults to length of steps array)
  - `dependsOn`: Prerequisites for this plan
  - Other fields similar to storeThought

**Returns:**
- Memory ID if successful, null otherwise

### storeTask

```typescript
async storeTask(
  title: string,
  description: string,
  options?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    parentTaskId?: string;
    subtaskIds?: string[];
    dependsOn?: string[];
    blockedBy?: string[];
    importance?: ImportanceLevel;
    relatedTo?: string[];
    tags?: string[];
  }
): Promise<string | null>
```

Stores a task with title, description, and execution metadata.

**Parameters:**
- `title`: Task title
- `description`: Detailed description
- `options`: Optional configuration
  - `status`: Current status (PENDING, IN_PROGRESS, COMPLETED, etc.)
  - `priority`: Task priority (LOW, MEDIUM, HIGH, etc.)
  - `dueDate`: ISO date string for due date
  - `parentTaskId`: ID of parent task if this is a subtask
  - `subtaskIds`: IDs of child tasks
  - `dependsOn`: IDs of prerequisite tasks
  - `blockedBy`: IDs of tasks blocking this one
  - Other fields similar to storeThought

**Returns:**
- Memory ID if successful, null otherwise

### storeThinkingResult

```typescript
async storeThinkingResult(
  thinking: {
    intent: {
      primary: string;
      confidence: number;
      alternatives?: Array<{intent: string, confidence: number}>;
    };
    entities?: Array<{type: string, value: string, confidence: number}>;
    reasoning?: string[];
    planSteps?: string[];
    shouldDelegate?: boolean;
  },
  userId: string,
  message: string,
  options?: {
    contextId?: string;
    importance?: ImportanceLevel;
    relatedMemories?: string[];
  }
): Promise<{
  thoughtId: string | null;
  planId: string | null;
  entityIds: string[];
}>
```

Stores a complete thinking result including intent, entities, reasoning, and plan.

**Parameters:**
- `thinking`: The thinking result structure
  - `intent`: Intent analysis with primary and alternative intents
  - `entities`: Extracted entities with type, value, and confidence
  - `reasoning`: Reasoning steps
  - `planSteps`: Execution plan steps
  - `shouldDelegate`: Whether the task should be delegated
- `userId`: ID of the user who initiated the request
- `message`: Original user message
- `options`: Optional configuration

**Returns:**
- Object containing:
  - `thoughtId`: ID of stored intent thought
  - `planId`: ID of stored plan
  - `entityIds`: Array of stored entity IDs

## Usage Examples

### Basic Thought Storage

```typescript
const artifactService = new CognitiveArtifactService(memoryService, 'agent-12345');

// Store a simple thought
const thoughtId = await artifactService.storeThought(
  "I should check the user's previous interactions for context"
);

// Store a thought with metadata
const analyzedThoughtId = await artifactService.storeThought(
  "The user appears to be asking about financial data",
  {
    intention: "intention-analysis",
    confidenceScore: 0.85,
    importance: ImportanceLevel.MEDIUM,
    tags: ["finance", "analysis"]
  }
);
```

### Storing a Reasoning Chain

```typescript
const reasoningId = await artifactService.storeReasoning(
  [
    "The user asked about market trends in the technology sector",
    "I need to analyze recent stock performance data",
    "NASDAQ technology indices show an upward trend over the last quarter",
    "Several major tech companies have reported better than expected earnings"
  ],
  "The technology sector is showing strong growth indicators in the current quarter",
  {
    confidence: 0.92,
    tags: ["finance", "market-analysis", "technology"]
  }
);
```

### Complete Thinking Process Storage

```typescript
const thinkingResult = {
  intent: {
    primary: "data-retrieval",
    confidence: 0.88,
    alternatives: [
      { intent: "analysis", confidence: 0.45 }
    ]
  },
  entities: [
    { type: "time-period", value: "Q2 2023", confidence: 0.96 },
    { type: "data-category", value: "sales figures", confidence: 0.93 }
  ],
  reasoning: [
    "User is requesting Q2 2023 sales data",
    "Need to query the database for this specific time period",
    "Sales figures should be formatted as a comparative analysis"
  ],
  planSteps: [
    "Query sales database for Q2 2023 records",
    "Process and aggregate the data",
    "Generate visual representation",
    "Prepare comparative analysis against Q1 and previous year"
  ]
};

const result = await artifactService.storeThinkingResult(
  thinkingResult,
  "user-789",
  "Can you show me our Q2 sales figures?"
);

console.log(`Stored thought ID: ${result.thoughtId}`);
console.log(`Stored plan ID: ${result.planId}`);
console.log(`Stored entity IDs: ${result.entityIds.join(', ')}`);
``` 