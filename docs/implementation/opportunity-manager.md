# Opportunity Management System: Implementation Plan

## 🎯 Goal & Context

To implement a sophisticated opportunity management system that enables agents to autonomously identify, evaluate, and act on opportunities. Currently, only Chloe has this capability, but it should be available to all agents in the AgentBase framework. The current system has several gaps:

1. Opportunity detection is siloed in Chloe and not available to other agents
2. No standardized approach to opportunity evaluation and prioritization
3. Limited integration with task creation and scheduling
4. Minimal integration with memory and knowledge systems
5. No robust tracking of opportunity lifecycle
6. Lacks contextual awareness across different opportunity types

## 🔍 Key Discoveries

- **Chloe-Only Implementation**: The `OpportunityDetector` and related classes are currently Chloe-specific
- **Limited Opportunity Sources**: While Chloe monitors market data, news, and patterns, the system could support more sources
- **Disconnected From Task Scheduling**: Opportunity detection doesn't fully leverage the scheduling system for execution
- **Manual Time Assessment**: Time sensitivity is manually set rather than determined through NLP or context
- **No Feedback Loop**: Opportunities that lead to successful outcomes don't inform future opportunity detection
- **Missing Unified API**: No standardized interface for other agents to leverage opportunity detection

## 📝 Implementation Approach 

Follow these principles when implementing the Opportunity Management System:

1. **Strictly adhere to IMPLEMENTATION_GUIDELINES.md**:
   - Replace (don't extend) Chloe-specific implementation
   - Use ULID instead of timestamp-based IDs
   - Enforce strict type safety (no 'any' types)
   - Follow interface-first design
   - Use dependency injection

2. **Split into focused components**:
   - OpportunityRegistry - Storage and retrieval of opportunities
   - OpportunityDetector - Detection of potential opportunities
   - OpportunityEvaluator - Assessment of value, priority, and timing
   - OpportunityProcessor - Conversion to actionable items
   - OpportunityManager - Orchestration layer

3. **Implement diverse opportunity detection strategies**:
   - ExternalSourceStrategy - For market data, news, etc.
   - MemoryPatternStrategy - For insights from agent's memory
   - UserInteractionStrategy - For opportunities in user interactions
   - ScheduleBasedStrategy - For recurring and time-sensitive opportunities
   - CollaborationStrategy - For opportunities involving multiple agents

4. **Integrate with other systems**:
   - TaskScheduler - For executing on opportunities
   - DateTimeProcessor - For NLP-based time sensitivity assessment
   - MemorySystem - For contextual awareness and pattern recognition
   - KnowledgeGraph - For understanding relationships between entities
   - FeedbackSystem - For learning from past opportunity outcomes

## 📋 Implementation Phases

### Phase 1: Initial Setup & Design
- [x] Create interface definitions for all components
- [x] Design opportunity detection strategies
- [x] Define data models with proper typing
- [x] Create error hierarchy for opportunity-related errors
- [x] Design test approach for all components
- [x] Design integration points with TaskScheduler and DateTimeProcessor

### Phase 2: Core Components Implementation
- [ ] Implement OpportunityRegistry with proper storage
- [ ] Implement detection strategies (external, memory, interaction, schedule, collaboration)
- [ ] Implement OpportunityEvaluator with priority scoring
- [ ] Implement OpportunityProcessor with task creation capabilities
- [ ] Build OpportunityManager orchestrator

### Phase 3: Testing & Validation
- [ ] Create unit tests for each component
- [ ] Add integration tests for component interactions
- [ ] Test with real-world opportunity scenarios

### Phase 4: Integration & Deployment
- [ ] Create data migration utilities for existing opportunities
- [ ] Integrate with TaskScheduler for opportunity execution
- [ ] Integrate with DateTimeProcessor for time sensitivity assessment
- [ ] Integrate with MemorySystem for contextual awareness
- [ ] Create compatibility adapter for DefaultOpportunityIdentifier
- [ ] Integrate with DefaultAutonomySystem to replace existing opportunity detection
- [ ] Implement feature flags for gradual rollout

### Phase 5: Expansion & Enhancement
- [ ] Add support for additional opportunity sources
- [ ] Implement machine learning for opportunity pattern recognition
- [ ] Create feedback loops for continuous improvement
- [ ] Add multi-agent opportunity collaboration
- [ ] Implement real-time opportunity notifications

## ✅ Completed Tasks
- Created comprehensive error hierarchy in `OpportunityError.ts`
- Defined complete opportunity data models in `opportunity.model.ts`
- Created interface definitions for all core components:
  - OpportunityRegistry interface for storing opportunities
  - OpportunityDetector interface for detecting opportunities
  - OpportunityEvaluator interface for evaluating opportunities
  - OpportunityProcessor interface for converting to tasks
  - OpportunityManager interface for orchestration
- Designed strategy interfaces for different detection approaches:
  - Base OpportunityDetectionStrategy interface
  - ExternalSourceStrategy for market data and news
  - MemoryPatternStrategy for agent memory analysis
  - UserInteractionStrategy for user conversation analysis
  - ScheduleBasedStrategy for time-based opportunities
  - CollaborationStrategy for multi-agent opportunities

## 📌 Next Steps
1. Implement OpportunityRegistry as first component
2. Create test cases for OpportunityRegistry
3. Implement core detection strategies
4. Set up the factory pattern for dependency injection

## 🚧 TODO Items
- Define opportunity lifecycle states and transitions
- Design opportunity priority scoring algorithm
- Review Chloe's implementation for best practices to retain
- Identify key metrics for opportunity detection performance
- Research additional opportunity sources beyond current implementation

## 📊 Progress Tracking

```
Phase 1: [XXXXXXXXXX] 100%
Phase 2: [          ] 0%
Phase 3: [          ] 0%
Phase 4: [          ] 0%
Phase 5: [          ] 0%
```

## 📘 Implementation Details

### Current Chloe Implementation Analysis

Chloe's implementation includes:

```typescript
// In OpportunityDetector class
export enum OpportunitySource {
  CALENDAR = 'calendar',
  MARKET_DATA = 'market_data',
  NEWS = 'news',
  MEMORY_PATTERN = 'memory_pattern',
  RECURRING_CYCLE = 'recurring_cycle'
}

export enum TimeSensitivity {
  IMMEDIATE = 'immediate',     // Within the next hour
  URGENT = 'urgent',           // Within the next 4 hours
  IMPORTANT = 'important',     // Within the next day
  STANDARD = 'standard',       // Within the next 2-3 days
  LONG_TERM = 'long_term'      // Within the next week
}

export interface DetectedOpportunity {
  id: string;
  title: string;
  description: string;
  created: Date;
  metadata: {
    source: OpportunitySource;
    confidence: number;
    timeSensitivity: TimeSensitivity;
    resourceNeeded?: {
      estimatedMinutes: number;
      priorityLevel: string;
    };
    patterns?: Array<{
      type: string;
      description: string;
    }>;
  };
  actionTaken: boolean;
  tags: string[];
}
```

The current implementation has detection methods like:

```typescript
private async detectMarketOpportunities(): Promise<DetectedOpportunity[]> {
  // Looks for market anomalies in market data memories
}

private async detectNewsOpportunities(): Promise<DetectedOpportunity[]> {
  // Looks for competitor mentions in news memories
}

private async detectMemoryPatterns(): Promise<DetectedOpportunity[]> {
  // Finds recurring topics in high-importance memories
}
```

### Opportunity to Task Integration

The new system will improve the integration with the task system:

```typescript
// New approach for opportunity processing
interface OpportunityProcessor {
  /**
   * Process an opportunity by converting it to an executable task
   * @param opportunity The opportunity to process
   * @returns The created task ID or null if processing failed
   */
  processOpportunity(opportunity: DetectedOpportunity): Promise<string | null>;
  
  /**
   * Determine the optimal scheduling for an opportunity
   * @param opportunity The opportunity to schedule
   * @param dateTimeProcessor Reference to the DateTimeProcessor for NLP
   * @returns Scheduling metadata for the task
   */
  determineScheduling(
    opportunity: DetectedOpportunity, 
    dateTimeProcessor: DateTimeProcessor
  ): Promise<TaskSchedulingMetadata>;
  
  /**
   * Generate appropriate task metadata from an opportunity
   * @param opportunity The source opportunity
   * @returns Task metadata
   */
  generateTaskMetadata(opportunity: DetectedOpportunity): TaskMetadata;
}
```

### Modular Structure

The new structure will separate concerns:

```
OpportunityManager (orchestration)
├── OpportunityRegistry (storage)
├── OpportunityDetector (detection)
│   ├── ExternalSourceStrategy
│   ├── MemoryPatternStrategy
│   ├── UserInteractionStrategy
│   ├── ScheduleBasedStrategy
│   └── CollaborationStrategy
├── OpportunityEvaluator (evaluation)
└── OpportunityProcessor (processing)
    └── Integration with TaskScheduler
```

### Opportunity Evaluation Improvements

The current system uses a simple confidence score. The new system will implement a more sophisticated evaluation:

```typescript
interface OpportunityEvaluator {
  /**
   * Evaluate an opportunity to determine its value, priority, and timing
   * @param opportunity The opportunity to evaluate
   * @returns Evaluation result with scores and recommendations
   */
  evaluateOpportunity(opportunity: DetectedOpportunity): Promise<OpportunityEvaluation>;
  
  /**
   * Score an opportunity based on multiple factors
   * @param opportunity The opportunity to score
   * @returns Scoring breakdown
   */
  scoreOpportunity(opportunity: DetectedOpportunity): Promise<OpportunityScore>;
  
  /**
   * Determine time sensitivity based on content and context
   * @param opportunity The opportunity to analyze
   * @param dateTimeProcessor Reference to the DateTimeProcessor for NLP
   * @returns Time sensitivity assessment
   */
  determineTimeSensitivity(
    opportunity: DetectedOpportunity,
    dateTimeProcessor: DateTimeProcessor
  ): Promise<TimeSensitivityAssessment>;
}

interface OpportunityScore {
  overall: number; // 0-1 score
  relevance: number; // How relevant to agent's goals
  actionability: number; // How actionable it is
  urgency: number; // How time-sensitive
  impact: number; // Potential impact of acting
  confidence: number; // Confidence in the assessment
}
```

This implementation will provide a robust, reusable opportunity management system that integrates with task scheduling and leverages NLP for time sensitivity assessment. It will enable all agents to autonomously identify and act on opportunities, not just Chloe.

### Integration with Existing Agent Systems

To seamlessly replace the current `DefaultOpportunityIdentifier` and integrate with the `DefaultAutonomySystem`, we'll implement the following approach:

```typescript
// Integration strategy for existing agent systems

// Step 1: Create a compatibility adapter
class OpportunityIdentifierAdapter implements OpportunityIdentifier {
  constructor(private opportunityManager: OpportunityManager) {}

  // Implement the legacy OpportunityIdentifier interface methods
  // but delegate to the new OpportunityManager implementation
  async initialize(): Promise<boolean> {
    return this.opportunityManager.initialize();
  }
  
  async detectTriggers(content: string, options?: TriggerDetectionOptions): Promise<OpportunityTrigger[]> {
    // Adapt the new system's detect method to match legacy interface
    const detectionResult = await this.opportunityManager.detectOpportunities(content, {
      agentId: options?.context?.agentId || 'default',
      source: options?.source as OpportunitySource || OpportunitySource.USER_INTERACTION,
      context: options?.context || {}
    });
    
    return detectionResult.opportunities.map(opp => opp.trigger);
  }
  
  // Implement other methods similarly, adapting between interfaces
}

// Step 2: Update DefaultAutonomySystem to use the new system
export class DefaultAutonomySystem implements AutonomySystem {
  // ... existing implementation ...
  
  private initializeOpportunityIdentification(): void {
    // Create the new opportunity manager via the factory
    const opportunityManager = createOpportunityManager();
    
    // Wrap it in the compatibility adapter for backward compatibility
    this.opportunityIdentifier = new OpportunityIdentifierAdapter(opportunityManager);
    
    // Initialize the system
    this.opportunityIdentifier.initialize();
  }
  
  // ... rest of implementation ...
}
```

This adapter pattern will allow for a smooth transition from the legacy opportunity detection system to the new modular, extensible framework. The adapter ensures that existing code continues to work while we gradually refactor agent implementations to use the new capabilities directly.

Key integration points:
1. Create an adapter implementing the legacy interface while using the new implementation internally
2. Replace DefaultOpportunityIdentifier usage in DefaultAutonomySystem
3. Gradually update agents to directly leverage the new OpportunityManager
4. Eventually remove the adapter once all agents have been migrated 