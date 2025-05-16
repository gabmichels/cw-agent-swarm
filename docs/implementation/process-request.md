# Agent Request Processing Flow Audit

## Introduction

This document details the complete flow of processing a user request in our agent architecture, with special focus on the "thinking" process. It begins from the initial entry point (`proxy.ts`) and traces through all relevant components, particularly examining how agents analyze, think about, and delegate requests.

## Current Implementation Audit

### Entry Point Flow (`proxy.ts`)

1. **Request Reception**
   - User sends message to `/api/chat/proxy` POST handler
   - System extracts `message`, `userId`, and optional `attachments`
   - Checks for in-flight requests and cached responses

2. **Message Processing**
   - Calls `agent.processMessage(normalizedMessage, {...options})` 
   - Passes user message and context to the agent
   - No explicit thinking step in the proxy layer

3. **Response Handling**
   - Extracts `reply`, `memories`, and `thoughts` from agent response
   - Caches the response for future reuse
   - Saves the response to history if memory is enabled

### Missing Thinking Process Elements in Current Flow

1. **Initial Intent Analysis**: No dedicated step to analyze "What does the user really want?"
2. **Memory Integration**: Limited retrieval of relevant past conversations and working memory
3. **Structured Intent Mapping**: No system to map recognized intents to specific actions
4. **Entity Extraction**: No systematic approach to extract and remember key information
5. **Delegation Decision Framework**: Basic delegation in `ChloeCoordinator.ts` but not integrated into main flow
6. **File-Based Context**: No mechanisms to retrieve and incorporate relevant files or documents
7. **Advanced Reasoning Techniques**: No multi-step reasoning or exploration of alternative hypotheses
8. **RAG Optimization**: No advanced retrieval strategies for optimizing context relevance

## ChloeCoordinator Analysis

The `ChloeCoordinator.ts` implementation includes a delegation identification process, but it's limited:

```typescript
private async shouldDelegateTask(task: string): Promise<{
  delegate: boolean;
  requiredCapabilities?: string[];
  reason?: string;
}> {
  // Check for research tasks
  if (task.toLowerCase().includes('research') || 
      task.toLowerCase().includes('find information')) {
    return {
      delegate: true,
      requiredCapabilities: ['research'],
      reason: 'This is a research task better suited for a specialized research agent'
    };
  }
  
  // Check for content creation tasks
  if (task.toLowerCase().includes('write') || 
      task.toLowerCase().includes('create content')) {
    return {
      delegate: true,
      requiredCapabilities: ['content_creation'],
      reason: 'This is a content creation task better suited for a specialized writing agent'
    };
  }
  
  // For everything else, handle directly
  return {
    delegate: false,
    reason: 'This task can be handled directly by Chloe'
  };
}
```

This approach:
- Uses simple keyword matching instead of semantic understanding
- Lacks integration with memory systems for context awareness
- Doesn't consider user history or preferences
- Doesn't include a true "thinking" step using an LLM
- Doesn't assess capability matches quantitatively

## Requirements for Enhanced Request Processing

A sophisticated thinking process should:

1. **Analyze Intent**: Run initial LLM pass focused solely on understanding the user's true intent
2. **Context Integration**: Pull relevant memories, files, and past conversations for context
3. **Entity Recognition**: Extract key information to store in working memory
4. **Meta-Cognitive Assessment**: Determine if agent can handle the request or should delegate
5. **Planning**: For complex requests, break down into steps before executing
6. **Multi-Step Reasoning**: Apply advanced reasoning techniques for complex problems
7. **Knowledge Integration**: Incorporate domain knowledge, files, and external information
8. **Optimized RAG Processing**: Apply advanced retrieval techniques for better context relevance

## Implementation Plan

### Phase 1: Core Thinking Process ⬜
- [x] Create ThinkingService interface and implementation
- [x] Implement "What does the user want?" initial analysis
- [x] Add working memory for context retention
- [x] Integrate thinking step in proxy.ts request flow
- [x] Add structured thought format for consistent processing
- [x] Implement LangGraph state management for thinking workflow

### Phase 2: Advanced Memory and Context Integration ⬜
- [ ] Implement comprehensive memory retrieval system
  - [ ] Semantic similarity search
  - [ ] Tag-based filtering
  - [ ] Temporal relevance (recency weighting)
  - [ ] Importance-weighted retrieval
- [x] Create working memory system for short-term information storage
- [x] Add entity extraction and storage capabilities
- [ ] Implement memory consolidation for important information
- [ ] Add file/document retrieval based on query relevance
- [ ] Implement advanced RAG techniques:
  - [ ] Query transformation/expansion
  - [ ] Reranking of retrieved results
  - [ ] Chunking strategies optimization
  - [ ] Hybrid retrieval (semantic + keyword)
  - [ ] Source attribution and citation tracking
  - [ ] Retrieval evaluation metrics

### Phase 3: Reasoning and Intent Systems ⬜
- [ ] Create intent classifier using LLM
- [ ] Implement multi-step reasoning frameworks:
  - [ ] ReAct (Reasoning + Acting)
  - [ ] Chain-of-Thought for complex problems
  - [ ] Tree-of-Thought for exploring multiple reasoning paths
- [ ] Map intents to specific handler capabilities
- [ ] Implement entity extraction for parameterization
- [ ] Build intent confidence scoring

### Phase 4: Advanced Delegation Framework ⬜
- [ ] Improve delegation decision system beyond keywords
- [ ] Implement capability matching between tasks and agents
- [ ] Add load balancing and priority handling
- [ ] Create feedback loop for delegation success/failure
- [ ] Add collaborative multi-agent problem solving

### Phase 5: Tool Integration ⬜
- [ ] Implement tool discovery and selection based on intent
- [ ] Add file search and manipulation tools
- [ ] Implement tool use feedback loops
- [ ] Create tool chaining for complex operations
- [ ] Add tool versioning and capability registration

### Phase 6: End-to-End Integration ⬜
- [ ] Integrate all components into unified flow
- [ ] Optimize for performance (caching, parallel processing)
- [ ] Add telemetry and monitoring
- [ ] Create visualization for the thinking process for debugging
- [ ] Implement A/B testing framework for response quality

## Proposed Thinking Flow

```
┌─────────────────────┐
│ Receive User Input  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐       ┌───────────────────┐
│ Context Retrieval   │◄──────┤ Retrieve Memories │
│                     │       └───────────────────┘
│                     │       ┌───────────────────┐
│                     │◄──────┤ Retrieve Files    │
└──────────┬──────────┘       └───────────────────┘
           ▼
┌─────────────────────┐
│ Initial Thinking    │
│ "What does user     │
│  really want?"      │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Extract Entities    │
│ & Update Working    │
│ Memory              │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Determine if Task   │       ┌───────────────────┐
│ Should be Delegated │──Yes─►│ Delegate to       │
│                     │       │ Specialized Agent │
└──────────┬──────────┘       └───────────────────┘
           │No
           ▼
┌─────────────────────┐       ┌───────────────────┐
│ Plan Execution      │◄──────┤ Select Tools      │
│ Steps               │       └───────────────────┘
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Apply Reasoning     │
│ Framework           │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Execute Plan and    │
│ Generate Response   │
└─────────────────────┘
```

## LangGraph Integration

Implement the thinking process as a LangGraph state machine:

```typescript
import { StateGraph } from '@langchain/langgraph';

// Define state interface
interface ThinkingState {
  input: string;
  userId: string;
  contextMemories: Memory[];
  contextFiles: FileReference[];
  workingMemory: WorkingMemoryItem[];
  intent: Intent | null;
  entities: Entity[];
  shouldDelegate: boolean;
  delegationTarget?: string;
  plan: ExecutionStep[];
  reasoning: string[];
  tools: ToolReference[];
  response: string | null;
}

// Create state graph with channels
const thinkingGraph = new StateGraph<ThinkingState>({
  channels: {
    memories: { value: null, default: [] },
    files: { value: null, default: [] },
    intent: { value: null },
    entities: { value: null, default: [] },
    reasoning: { value: null, default: [] },
    delegation: { value: false }
  }
});

// Add nodes for each thinking step
thinkingGraph.addNode("retrieve_context", retrieveContextNode);
thinkingGraph.addNode("analyze_intent", analyzeIntentNode);
thinkingGraph.addNode("extract_entities", extractEntitiesNode);
thinkingGraph.addNode("assess_delegation", assessDelegationNode);
thinkingGraph.addNode("delegate_task", delegateTaskNode);
thinkingGraph.addNode("plan_execution", planExecutionNode);
thinkingGraph.addNode("select_tools", selectToolsNode);
thinkingGraph.addNode("apply_reasoning", applyReasoningNode);
thinkingGraph.addNode("generate_response", generateResponseNode);

// Define edges
thinkingGraph.addEdge("retrieve_context", "analyze_intent");
thinkingGraph.addEdge("analyze_intent", "extract_entities");
thinkingGraph.addEdge("extract_entities", "assess_delegation");

// Add conditional branch for delegation
thinkingGraph.addConditionalEdges(
  "assess_delegation",
  (state) => state.shouldDelegate ? "delegate_task" : "plan_execution"
);

thinkingGraph.addEdge("plan_execution", "select_tools");
thinkingGraph.addEdge("select_tools", "apply_reasoning");
thinkingGraph.addEdge("apply_reasoning", "generate_response");

// Define the full graph
const compiler = thinkingGraph.compile();
```

## Memory Retrieval and Context Building

### Memory Retrieval Interface

```typescript
export interface MemoryRetrievalOptions {
  // Basic retrieval parameters
  query: string;
  userId: string;
  limit?: number;
  
  // Advanced retrieval options
  retrievalMethods: {
    semantic?: boolean;   // Vector similarity
    tags?: string[];      // Tag-based filtering
    temporal?: {          // Time-based relevance
      start?: Date;
      end?: Date;
      recencyWeight?: number;
    };
    entityBased?: {       // Entity match relevance
      entities: string[];
      weight: number;
    };
  };
  
  // Context formatting
  formatOptions: {
    maxTokens?: number;
    groupByType?: boolean;
    sortBy?: 'relevance' | 'time' | 'importance';
    includeMetadata?: boolean;
  };
}

export interface MemoryService {
  // Retrieve memories from different sources using multiple methods
  retrieveRelevantMemories(options: MemoryRetrievalOptions): Promise<FormattedMemoryContext>;
  
  // Store working memory items for future reference
  storeWorkingMemoryItem(userId: string, item: WorkingMemoryItem): Promise<string>;
  
  // Get current working memory for a user
  getWorkingMemory(userId: string): Promise<WorkingMemoryItem[]>;
  
  // Consolidate important working memory into long-term memory
  consolidateWorkingMemory(userId: string, options?: ConsolidationOptions): Promise<void>;
}
```

### File Retrieval Interface

```typescript
export interface FileRetrievalOptions {
  // Query to match against file content and metadata
  query: string;
  
  // Filtering options
  filters?: {
    fileTypes?: string[];    // Filter by file extension or mime type
    dateRange?: {            // Filter by modification date
      start?: Date;
      end?: Date;
    };
    tags?: string[];         // Filter by file tags
    metadata?: Record<string, any>; // Filter by custom metadata
  };
  
  // Retrieval options
  limit?: number;
  includeContent?: boolean;  // Whether to include file content in results
  searchMethod?: 'semantic' | 'keyword' | 'hybrid';
}

export interface FileService {
  // Search for relevant files
  findRelevantFiles(options: FileRetrievalOptions): Promise<FileReference[]>;
  
  // Get file content
  getFileContent(fileId: string): Promise<string>;
  
  // Get specific part of a file (for large files)
  getFileSection(fileId: string, start: number, end: number): Promise<string>;
}
```

## Advanced RAG Techniques

### Query Enhancement

```typescript
export interface QueryEnhancementOptions {
  originalQuery: string;
  enhancementStrategies: {
    expansion?: boolean;         // Add related terms to query
    hypothetical?: boolean;      // Generate hypothetical documents
    structuredExtraction?: boolean; // Extract structured components
    multiQuery?: boolean;        // Generate multiple query variations
  };
  executionOptions?: {
    parallel?: boolean;
    topK?: number;
  };
}

export interface QueryEnhancementService {
  enhanceQuery(options: QueryEnhancementOptions): Promise<EnhancedQuery>;
  
  // Generate multiple variations of the original query
  generateQueryVariations(query: string, count: number): Promise<string[]>;
  
  // Extract structured information to guide retrieval
  extractQueryEntities(query: string): Promise<QueryEntity[]>;
  
  // Expand query with related terms
  expandQuery(query: string): Promise<string>;
}
```

### Chunking Strategies

```typescript
export interface ChunkingOptions {
  content: string;
  strategy: 'fixed' | 'semantic' | 'recursive' | 'sliding' | 'hierarchical';
  chunkSize?: number;
  chunkOverlap?: number;
  semanticBoundaryDetection?: {
    enabled: boolean;
    boundaryTypes: ('paragraph' | 'section' | 'topic')[];
  };
}

export interface ChunkingService {
  // Chunk content according to strategy
  chunkContent(options: ChunkingOptions): Promise<DocumentChunk[]>;
  
  // Determine optimal chunk size for a specific document type
  getOptimalChunkParams(documentType: string): ChunkParameters;
  
  // Create hierarchical representation of document
  createHierarchicalChunks(content: string): Promise<HierarchicalChunkTree>;
}
```

### Reranking

```typescript
export interface RerankerOptions {
  query: string;
  initialResults: RetrievalResult[];
  strategy: 'relevance' | 'diversity' | 'reciprocal' | 'semantic' | 'hybrid';
  weights?: {
    relevance?: number;
    recency?: number;
    diversity?: number;
    length?: number;
  };
}

export interface RerankerService {
  // Rerank initial results based on strategy
  rerank(options: RerankerOptions): Promise<RetrievalResult[]>;
  
  // Score each result based on different dimensions
  scoreResults(query: string, results: RetrievalResult[]): Promise<ScoredResult[]>;
  
  // Filter out redundant information
  deduplicateResults(results: RetrievalResult[]): RetrievalResult[];
}
```

### Citation and Source Tracking

```typescript
export interface CitationOptions {
  generatedContent: string;
  retrievedSources: RetrievalResult[];
  trackingLevel: 'token' | 'sentence' | 'paragraph';
  includeConfidence: boolean;
}

export interface CitationService {
  // Track which parts of the response came from which sources
  trackSourceAttribution(options: CitationOptions): Promise<AttributedContent>;
  
  // Format citations in a user-friendly way
  formatCitations(attributedContent: AttributedContent): Promise<FormattedCitations>;
  
  // Verify generated content against sources
  verifyContentAgainstSources(content: string, sources: RetrievalResult[]): Promise<VerificationResult>;
}
```

### RAG Evaluation Metrics

```typescript
export interface RAGEvaluationOptions {
  query: string;
  retrievedContext: string[];
  generatedResponse: string;
  groundTruth?: string;
  metrics: ('relevance' | 'faithfulness' | 'informativeness' | 'diversity' | 'coverage')[];
}

export interface RAGEvaluationService {
  // Evaluate quality of retrieval and generation
  evaluateRAG(options: RAGEvaluationOptions): Promise<RAGEvaluationResult>;
  
  // Check if response is faithful to retrieved content
  evaluateFaithfulness(response: string, context: string[]): Promise<number>;
  
  // Assess context relevance to query
  evaluateRelevance(query: string, context: string[]): Promise<number>;
  
  // Calculate context utilization
  calculateContextUtilization(response: string, context: string[]): Promise<UtilizationMetrics>;
}
```

## LLM Context Construction

The quality of agent responses depends heavily on how we construct the context sent to the LLM:

### Layered Context Structure

```typescript
export interface ContextLayer {
  priority: number;  // Lower numbers = higher priority
  content: string;
  tokenBudget: number;
  truncationStrategy?: 'start' | 'end' | 'middle' | 'summarize';
}

export class ContextBuilder {
  private layers: ContextLayer[] = [];
  private maxTokens: number;
  
  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }
  
  addLayer(layer: ContextLayer): void {
    this.layers.push(layer);
    this.layers.sort((a, b) => a.priority - b.priority);
  }
  
  buildContext(): string {
    // Smart context construction with budget allocation
    // Higher priority layers get budget allocated first
    // Implements truncation based on strategy if needed
  }
}
```

### Example Context Layers

1. System instructions (priority 0)
2. Agent persona information (priority 1)
3. Working memory (priority 2)
4. Relevant file content (priority 3)
5. Relevant memories (priority 4)
6. Recent conversation history (priority 5)
7. Current user message (priority 0 - always included fully)
8. Retrieval context with citations (priority 3)

## Implementation Approach

### ThinkingService Interface

```typescript
export interface ThinkingResult {
  intent: {
    primary: string;
    confidence: number;
    alternatives?: Array<{intent: string, confidence: number}>;
  };
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  shouldDelegate: boolean;
  delegateToCapability?: string[];
  reasoning: string[];
  contextUsed: {
    memories: string[];
    files: string[];
    tools: string[];
  };
  planSteps?: string[];
}

export interface ThinkingService {
  // Analyze user intent and extract key information
  analyzeIntent(
    message: string, 
    options?: {
      userId?: string;
      chatHistory?: Message[];
      workingMemory?: WorkingMemoryItem[];
      contextFiles?: FileReference[];
    }
  ): Promise<ThinkingResult>;
  
  // Determine if task should be delegated
  shouldDelegate(
    thinkingResult: ThinkingResult
  ): Promise<{
    delegate: boolean;
    requiredCapabilities?: string[];
    confidence: number;
    reason: string;
  }>;
  
  // Update working memory based on thinking results
  updateWorkingMemory(
    userId: string,
    thinkingResult: ThinkingResult
  ): Promise<void>;
  
  // Create execution plan
  createExecutionPlan(
    intent: string,
    entities: any[],
    context: any
  ): Promise<{
    steps: string[];
    tools: string[];
    reasoning: string;
  }>;
  
  // Execute thinking graph end-to-end
  processRequest(
    userId: string,
    message: string,
    options?: ThinkingOptions
  ): Promise<ThinkingResult>;
}
```

### LLM Prompt Template for Thinking

```
[THINKING MODE]
Analyze what the user really wants with this message and extract key information.

User message: "{message}"

Previous context:
{context}

Working memory items:
{working_memory}

Relevant files:
{files}

Think about:
1. What is the user's true intent? (Look beyond the literal words)
2. What key entities/information should I extract and remember?
3. How does this relate to previous context?
4. What specific needs or goals is the user expressing?
5. Is this task better handled by a specialized agent?
6. Do I need specific files or knowledge to answer this properly?

Provide your analysis in detail structured as JSON:
{
  "intent": {
    "primary": "the main user intent",
    "confidence": 0.95,
    "alternatives": [{"intent": "possible alternative intent", "confidence": 0.3}]
  },
  "entities": [
    {"type": "person", "value": "John Smith", "confidence": 0.9},
    {"type": "date", "value": "tomorrow", "confidence": 0.8}
  ],
  "shouldDelegate": false,
  "requiredCapabilities": ["research", "writing"],
  "requiredFiles": ["project_overview.md", "dataset.csv"],
  "reasoning": "Detailed reasoning about the user request and how I arrived at this analysis",
  "contextNeeded": ["user_preferences", "past_interactions"]
}
```

## Implementation Guidelines

To ensure this implementation follows our architecture standards:

- Follow strict typing - no use of `any` types
- Use ULIDs for all identifiers
- Implement clean interfaces before implementations
- Use dependency injection
- Write tests before implementation
- Focus on immutability and pure functions where possible
- Prioritize performance through proper caching and memory management
- Keep the design simple but comprehensive
- Prefer composition over inheritance
- Use LangGraph for workflow organization

## Next Steps

1. Review this document against existing code
2. Create detailed interface definitions
3. Begin implementation of core LangGraph workflow
4. Implement ThinkingService and memory integration
5. Add file retrieval components
6. Develop delegation framework
7. Build integration with execution layer

---

**REMINDER: IMPLEMENTATION GUIDELINES**

- REPLACE, DON'T EXTEND legacy code
- NO BACKWARD COMPATIBILITY LAYERS
- TEST-DRIVEN DEVELOPMENT with >95% coverage
- USE ULID/UUID FOR IDS
- STRICT TYPE SAFETY - never use 'any'
- DEPENDENCY INJECTION for all components
- INTERFACE-FIRST DESIGN
- KEEP IT SIMPLE - avoid overengineering
- OPTIMIZE for performance 

## Implementation Progress Summary

### What's Been Completed

✅ **Phase 1: Core Thinking Process**
- Created ThinkingService interface and implementation
- Implemented "What does the user want?" initial analysis capability
- Added working memory for context retention
- Integrated thinking step in the message processing route
- Added structured thought format for consistent processing
- Implemented LangGraph state management for the thinking workflow

### Current Status
We have successfully implemented the core thinking process using LangGraph. The initial implementation provides:

1. A structured workflow for processing user requests
2. Working memory for contextual information retention
3. Basic entity extraction and intent analysis
4. Integration with the message processing route
5. A foundation for more advanced reasoning

### Next Steps

1. **Implement Memory Retrieval**
   - Add semantic search for retrieving relevant memories
   - Implement tag-based memory filtering
   - Add temporal and importance-based weighting

2. **Enhance Reasoning Capabilities**
   - Implement Chain-of-Thought reasoning
   - Add Tree-of-Thought for exploring multiple reasoning paths
   - Integrate ReAct framework for reasoning and acting

3. **Implement File Context**
   - Add capability to retrieve and analyze relevant files
   - Implement file content chunking and processing
   - Add semantic search across file contents

4. **Enhance Delegation Framework**
   - Improve the delegation decision system
   - Add capability matching between tasks and specialized agents
   - Create feedback loops for delegation outcomes

The next phase will focus on enhancing the memory retrieval system to provide better context for reasoning. 