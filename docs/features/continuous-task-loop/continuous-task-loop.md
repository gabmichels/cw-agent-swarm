# Continuous Task Loop Implementation Plan

## Initiative Goal

Enable autonomous, long-term background task execution for complex research and planning goals. The system will allow agents to receive high-level objectives like "Perform market analysis for the European coffee subscription industry" and autonomously decompose, execute, persist, and refine these tasks across multiple sessions while maintaining goal-specific memory isolation and real-time progress visualization.

## Core Capabilities Target

- **Autonomous Task Decomposition**: Break complex goals into executable subtasks
- **Background Execution**: Run tasks continuously while serving other user requests
- **Cross-Session Persistence**: Maintain task state through application restarts
- **Goal-Specific Memory Isolation**: Prevent memory blending between different objectives
- **Real-Time Progress Visualization**: ChatGPT-style task execution monitoring
- **Self-Evaluation & Replanning**: Autonomous retry and strategy adjustment
- **Cost-Aware Execution**: Smart resource management for expensive operations
- **Multi-Source Research**: Integrated web scraping (Playwright) + search APIs (Google/Bing/Brave)
- **Multi-Goal Session Tracking**: Context switching between active research goals
- **Autonomous Replanning**: LangGraph-powered fallback strategies for failed data sources

---

## Phase 1: Foundation Infrastructure ⚡ (Reuses Existing Systems)

### Goal-Scoped Memory Extension ✅ Builds on Existing MemoryIsolationManager
- [ ] **Extend MemoryIsolationManager**: Add goal-specific scope creation
  - [ ] Add `createGoalScope(goalId: string, parentScope?: string)` method
  - [ ] Implement goal hierarchy support in existing scope system
  - [ ] Extend metadata tagging for goal-specific memory retrieval
  - [ ] Add goal completion cleanup mechanisms
  - [ ] Write tests extending existing MemoryIsolation.test.ts

- [ ] **GoalMemoryContext.ts**: Goal-aware memory context wrapper
  - [ ] Extend existing AgentMemoryManager with goal context
  - [ ] Implement goal ID injection into memory operations
  - [ ] Add goal-scoped memory retrieval methods
  - [ ] Build on existing memory isolation patterns
  - [ ] Test with existing Qdrant integration

### Task Decomposition Engine ✅ Builds on Existing Planning System
- [ ] **Extend DefaultPlanningManager**: Add continuous task capabilities
  - [ ] Add `decomposeGoal(goal: string, context: GoalContext)` method
  - [ ] Integrate with existing PlanCreator and StepGenerator
  - [ ] Extend existing plan adaptation system for goal replanning
  - [ ] Build on existing plan optimization algorithms
  - [ ] Use existing plan validation and error handling

- [ ] **ContinuousGoalPlanner.ts**: Specialized planner for long-term goals
  - [ ] Extend existing planning interfaces with goal persistence
  - [ ] Implement recursive decomposition using existing plan structures
  - [ ] Build on existing success criteria validation
  - [ ] Integrate with existing strategy adaptation system
  - [ ] Use existing ULID generation and error handling patterns

---

## Phase 2: Execution Infrastructure ⚡ (Extends Existing Scheduler)

### Goal Queue Integration ✅ Builds on ModularSchedulerManager + BullMQ Enhancement
- [ ] **Extend ModularSchedulerManager**: Add goal-aware task execution with BullMQ
  - [ ] Add goal context to existing Task model metadata
  - [ ] **NEW**: Integrate BullMQ for true background processing (extend existing OperationQueue)
    - [ ] Build on existing OperationQueue infrastructure in `src/server/memory/services/queue/`
    - [ ] Add Redis persistence layer for cross-session goal continuity
    - [ ] Implement job prioritization with goal-specific weights
    - [ ] Add job retry logic with exponential backoff for failed research tasks
  - [ ] Extend existing task execution with goal tracking
  - [ ] Build on existing retry logic and error handling
  - [ ] Use existing BullMQ-like execution patterns (already implemented)
  - [ ] Integrate with existing task status management

- [ ] **GoalTaskExecutor.ts**: Goal-aware task execution wrapper with multi-session support
  - [ ] Extend existing TaskExecutor interface with goal context
  - [ ] Build on existing AgentTaskExecutor implementation
  - [ ] Add goal progress tracking to existing execution results
  - [ ] **NEW**: Multi-session goal tracking and context switching
    - [ ] Goal state persistence across application restarts
    - [ ] Context isolation between different research goals
    - [ ] Smart resource allocation between concurrent goals
  - [ ] Implement cost tracking integration with existing patterns (especially Apify usage)
  - [ ] Use existing timeout and cancellation mechanisms

- [ ] **Extend Prisma Schema**: Add goal tracking to existing models
  - [ ] Add ContinuousGoal, GoalStep, GoalProgress models
  - [ ] Extend existing Task model with goalId foreign key
  - [ ] Build on existing ULID patterns and relationships
  - [ ] Use existing audit trail infrastructure
  - [ ] Add data migration for existing task data

### LangGraph Integration ✅ Builds on Existing Workflows + Deep Research Capabilities
- [ ] **ContinuousGoalGraph.ts**: Goal-aware LangGraph workflows with multi-source research
  - [ ] Extend existing LangGraph knowledge workflows pattern
  - [ ] Build on existing state management and error handling
  - [ ] Use existing retry and fallback structures from thinking workflow
  - [ ] Add goal state persistence using existing patterns
  - [ ] **NEW**: Multi-source research orchestration (web scraping + search APIs)
  - [ ] **NEW**: Intelligent source selection and fallback strategies
  - [ ] Integration tests extending existing workflow tests

- [ ] **DeepResearchNodes.ts**: Perplexity/ChatGPT-style research nodes
  - [ ] **Web Search Orchestration**: Extend existing ApifyWebSearchTool
    - [ ] Build on existing Google Search API integration
    - [ ] Add Bing and Brave search API providers
    - [ ] Implement search result quality scoring and deduplication
    - [ ] Smart source selection based on query type and domain expertise
  - [ ] **Web Scraping Engine**: Extend existing Playwright/RPA infrastructure
    - [ ] Build on existing TwitterRPAProvider and InstagramRPAProvider patterns
    - [ ] Create WebScrapingProvider for general website content extraction
    - [ ] Implement anti-detection and rate limiting (already exists in RPA system)
    - [ ] Smart content extraction with readability scoring
  - [ ] **Research Synthesis**: LangGraph nodes for information integration
    - [ ] Multi-source content analysis and verification
    - [ ] Contradiction detection between sources
    - [ ] Confidence scoring for extracted information
    - [ ] Citation and source attribution management

- [ ] **GoalExecutionNodes.ts**: Goal-specific workflow nodes with research integration
  - [ ] Build on existing research/analysis node patterns
  - [ ] Extend existing tool integration nodes for research workflows
  - [ ] Use existing document generation patterns with research citations
  - [ ] Build on existing validation and error recovery
  - [ ] **NEW**: Research quality assessment and source verification
  - [ ] Follow existing pure function and immutable state patterns

---

## Phase 3: Autonomous Decision Making ⚡ (Extends Existing Strategy Systems)

### Self-Evaluation System ✅ Builds on Existing Plan Adaptation
- [ ] **Extend DefaultPlanAdaptationSystem**: Add goal-aware evaluation
  - [ ] Add goal completion criteria to existing adaptation triggers
  - [ ] Extend existing quality scoring with goal-specific metrics
  - [ ] Build on existing confidence assessment algorithms
  - [ ] Use existing requirement validation patterns
  - [ ] Extend existing adaptation strategy effectiveness tracking

- [ ] **GoalStrategyAdapter.ts**: Goal-aware strategy adaptation
  - [ ] Extend existing strategy adaptation system for goals
  - [ ] Build on existing alternative approach generation
  - [ ] Use existing resource availability assessment
  - [ ] Extend existing failure pattern recognition
  - [ ] Build on existing error recovery mechanisms

- [ ] **ResourceOptimizer.ts**: Cost and performance management for deep research
  - [ ] **Apify Cost Management**: Build on existing DefaultApifyManager
    - [ ] Extend existing usage tracking for web scraping operations
    - [ ] Smart result limiting (default 5-10 results, approval required for >25)
    - [ ] Cost prediction based on search complexity and source count
    - [ ] Budget allocation across multiple research goals
  - [ ] **Search API Rate Limiting**: Extend existing web search infrastructure
    - [ ] Build on existing ApifyWebSearchTool rate limiting
    - [ ] Add Bing/Brave API quota management
    - [ ] Smart provider rotation to optimize costs and avoid limits
  - [ ] **Intelligent Caching**: Multi-layer caching strategy
    - [ ] Search result caching with TTL based on content freshness requirements
    - [ ] Scraped content caching with domain-specific strategies
    - [ ] Research synthesis caching for similar queries
  - [ ] Performance optimization algorithms

### Watchdog and Monitoring ✅ Builds on Existing Scheduler
- [ ] **Extend ModularSchedulerManager**: Add goal health monitoring
  - [ ] Add goal progress checks to existing scheduling loop
  - [ ] Extend existing stuck task detection for goals
  - [ ] Build on existing resource usage monitoring
  - [ ] Use existing automatic task prioritization
  - [ ] Extend existing comprehensive logging system

- [ ] **GoalCoordinator.ts**: Goal-aware scheduling coordination
  - [ ] Extend existing SchedulerCoordinator for goals
  - [ ] Build on existing priority-based scheduling
  - [ ] Use existing resource-aware task distribution
  - [ ] Extend existing dependency resolution
  - [ ] Build on existing load balancing mechanisms

---

## Phase 4: User Interface & Debugging

### Debug Interface
- [ ] **Debug Goal Management Page**: `/debug/goal-management`
  - [ ] Create task input interface with validation
  - [ ] Build real-time task visualization component
  - [ ] Implement progress tracking display
  - [ ] Add task pause/resume controls
  - [ ] Tool usage and cost monitoring dashboard

- [ ] **Task Visualization Components**: Real-time progress display
  - [ ] Create ChatGPT-style thinking display
  - [ ] Build tool usage indicators
  - [ ] Implement progress bars and status indicators
  - [ ] Add error state visualization
  - [ ] Cost tracking and budget warnings

- [ ] **Goal Management API Endpoints**: Backend task control
  - [ ] `/api/debug/goal-management/start` - Task initiation
  - [ ] `/api/debug/goal-management/[taskId]/stream` - Real-time updates
  - [ ] `/api/debug/goal-management/[taskId]/pause` - Task control
  - [ ] `/api/debug/goal-management/[taskId]/status` - Status queries
  - [ ] Error handling with proper HTTP status codes

### Production Interface
- [ ] **Goal-Context-Aware Chat**: Multi-goal conversation interface (Perplexity-style)
  - [ ] **Multi-Goal Session Management**: Context switching between active research goals
    - [ ] "Resume working on my France trip planning" vs "Show me the status of the market analysis"
    - [ ] Goal-specific memory retrieval via goalId filtering
    - [ ] Context preservation when switching between goals
    - [ ] Visual indicators for active vs paused goals
  - [ ] **Real-time Research Progress**: ChatGPT-style thinking display
    - [ ] Live updates showing "Searching web for coffee subscription companies..."
    - [ ] Source attribution display ("Found 3 companies via Google Search, scraping pricing data...")
    - [ ] Progress bars for multi-step research tasks
    - [ ] Error recovery visualization with automatic fallback strategies
  - [ ] Build context-aware message routing with goal awareness
  - [ ] Implement goal status integration in chat UI
  - [ ] Add goal summary and progress displays
  - [ ] Real-time updates via Server-Sent Events

---

## Phase 5: Integration & Testing

### System Integration ✅ Builds on Existing Agent Architecture
- [ ] **DefaultAgent Integration**: Extend existing agent capabilities
  - [ ] Add goal management methods to existing DefaultAgent interface
  - [ ] Integrate with existing planAndExecute methodology
  - [ ] Connect to existing task execution pipeline
  - [ ] Build on existing memory management integration
  - [ ] Use existing agent capability system

- [ ] **Database Schema Updates**: Extend existing Prisma models
  - [ ] Add goal-related fields to existing Task and Agent models
  - [ ] Build on existing ULID and relationship patterns
  - [ ] Use existing migration infrastructure
  - [ ] Extend existing indexing strategy
  - [ ] Build on existing backup and recovery procedures

### Comprehensive Testing ✅ Extends Existing Test Infrastructure
- [ ] **Unit Tests**: Extend existing test suites
  - [ ] Extend existing scheduler tests for goal functionality
  - [ ] Build on existing memory isolation test patterns
  - [ ] Use existing mock patterns for external dependencies
  - [ ] Extend existing error scenario testing
  - [ ] Build on existing performance testing infrastructure

- [ ] **Integration Tests**: Extend existing integration patterns
  - [ ] Build on existing scheduler integration tests
  - [ ] Extend existing memory isolation integration tests
  - [ ] Use existing database persistence test patterns
  - [ ] Extend existing LangGraph workflow tests
  - [ ] Build on existing agent execution test patterns

- [ ] **E2E Tests**: Extend existing E2E infrastructure
  - [ ] Build on existing agent lifecycle tests
  - [ ] Extend existing UI testing patterns
  - [ ] Use existing concurrent execution test infrastructure
  - [ ] Build on existing performance testing suites
  - [ ] Extend existing cost tracking test patterns

---

## Example Implementations

### Market Analysis Goal Example (Perplexity/ChatGPT Deep Research Style)
**Input**: "Perform market analysis for the European coffee subscription industry"

**Expected Decomposition with Multi-Source Research**:
1. **Company Discovery Phase**
   - Google Search: "European coffee subscription services 2024"
   - Bing Search: "coffee subscription companies Europe market leaders"
   - Web scraping: Industry reports, trade publications, startup databases
   - *Fallback*: If search APIs fail, use Apify website crawler on known industry sites
2. **Pricing Analysis Phase**
   - Direct website scraping using Playwright for each company's pricing pages
   - Search for "Company X pricing" + "Company X subscription costs"
   - Cross-reference with review sites mentioning pricing
   - *Fallback*: If scraping blocked, search for pricing announcements and press releases
3. **Feature & Review Analysis Phase**
   - Multi-source review aggregation (Trustpilot, Google Reviews, specialized coffee forums)
   - Social media sentiment analysis via search APIs
   - Feature comparison via company website scraping
   - *Fallback*: If primary sources unavailable, search for comparison articles and user discussions
4. **Synthesis & Validation Phase**
   - Cross-reference findings across all sources
   - Identify and resolve data contradictions
   - Generate comprehensive analysis with source attribution
   - Quality score each data point based on source reliability

**Autonomous Checkpoints with Source Validation**:
- **Company Discovery**: Minimum 3 companies found with 2+ independent source confirmations
- **Pricing Data Quality**: All pricing tiers captured with direct source links + freshness validation
- **Review Analysis**: Minimum 50 reviews per company from 3+ different review platforms
- **Source Diversity**: Research findings supported by minimum 5 different source types (search, scraping, reviews, social media, industry reports)
- **Data Freshness**: 80% of information from sources less than 6 months old

### France Trip Planning Goal Example (Multi-Source Travel Research)
**Input**: "Plan a comprehensive trip to France including hotels, flights, and activities"

**Expected Decomposition with Intelligent Research**:
1. **Travel Context Discovery**
   - Search for "best time to visit France" + seasonal considerations
   - Cross-reference with weather data and local event calendars
   - *Fallback*: Use general travel guidance if specific seasonal data unavailable
2. **Flight Research Phase** 
   - Multi-provider search via travel API integrations
   - Price trend analysis via search engines
   - Alternative airport options research
   - *Fallback*: Manual search guidance if APIs rate-limited
3. **Accommodation Intelligence**
   - Location-based hotel/Airbnb research via web scraping
   - Review sentiment analysis from multiple platforms
   - Local neighborhood safety and attraction proximity analysis
   - *Fallback*: General recommendation articles if direct booking sites blocked
4. **Activity Curation**
   - Interest-based activity discovery via search and scraping
   - Local event calendar integration
   - User review analysis for experience quality
   - Geographic optimization for itinerary efficiency
   - *Fallback*: Static tourism resources if dynamic sources fail
5. **Budget Synthesis & Optimization**
   - Multi-source price aggregation and validation
   - Cost optimization recommendations with trade-off analysis
   - Real-time price monitoring and alert setup

**Autonomous Checkpoints with Multi-Source Validation**:
- **Flight Options**: Minimum 3 flight options found with price validation from 2+ sources
- **Accommodation Quality**: Each recommendation backed by minimum 15+ reviews with 4+ star average
- **Activity Diversity**: Minimum 2 activities per day with geographic clustering for efficiency
- **Budget Accuracy**: All costs validated within 48 hours and from official/reliable sources
- **Itinerary Feasibility**: Travel times validated and optimized for realistic daily schedules

---

## Technical Architecture Alignment ⚡ (Efficient Reuse Strategy)

### IMPLEMENTATION_GUIDELINES.md Compliance ✅ Building on Existing Patterns
- **ULID Usage**: Extend existing ULID patterns in scheduler and memory systems
- **Strict Typing**: Build on existing TypeScript interfaces and type safety
- **Dependency Injection**: Use existing DI patterns from agents and managers
- **Pure Functions**: Extend existing immutable patterns from planning system
- **Test-First Development**: Build on existing comprehensive test infrastructure
- **Error Handling**: Use existing custom error types and structured logging
- **Interface-First Design**: Extend existing interface patterns

### Performance Considerations ✅ Building on Existing Optimizations
- **Memory Efficiency**: Extend existing memory isolation and Qdrant integration
- **Database Optimization**: Build on existing Prisma optimization patterns
- **Cache Strategy**: Extend existing caching patterns and strategies
- **Resource Limits**: Build on existing cost tracking and usage monitoring
- **Concurrent Execution**: Use existing ModularSchedulerManager concurrency patterns

### Security & Reliability ✅ Extending Existing Security Model
- **Data Isolation**: Build on existing MemoryIsolationManager security
- **Error Recovery**: Use existing retry mechanisms and error handling
- **Audit Trail**: Extend existing comprehensive logging infrastructure
- **Resource Protection**: Build on existing cost tracking and monitoring
- **Session Persistence**: Use existing task persistence and state management

## Efficiency Benefits of This Enhanced Deep Research Approach

### Estimated Development Time Reduction: **65-75%** (Higher due to extensive infrastructure reuse)
- **Memory System**: Extend existing instead of rebuilding (weeks → days)
- **Task Execution**: Build on ModularSchedulerManager + OperationQueue (weeks → days)  
- **Planning System**: Extend DefaultPlanningManager (weeks → days)
- **LangGraph Integration**: Follow existing workflow patterns (weeks → days)
- **Web Search APIs**: Build on existing ApifyWebSearchTool and search providers (days instead of weeks)
- **Web Scraping**: Extend existing RPA/Playwright infrastructure (days instead of weeks)
- **Background Queues**: Enhance existing OperationQueue with BullMQ (days instead of weeks)
- **Testing**: Extend existing test suites (weeks → days)

### Risk Mitigation Through Reuse
- **Proven Architecture**: Build on battle-tested existing systems
- **Consistent Patterns**: Follow established coding standards and practices
- **Reduced Complexity**: Avoid architectural fragmentation and duplication
- **Faster Debugging**: Use existing debugging and monitoring infrastructure

---

## Success Metrics

- [ ] **Functional**: Complete autonomous execution of market analysis tasks
- [ ] **Performance**: Handle 10+ concurrent long-running goals with <200ms response time
- [ ] **Reliability**: 99% task completion rate with proper error recovery
- [ ] **Cost Efficiency**: 50% reduction in unnecessary API calls through smart caching
- [ ] **User Experience**: Real-time progress visibility with <1 second update latency
- [ ] **Memory Isolation**: Zero cross-contamination between concurrent goals
- [ ] **Persistence**: 100% task state preservation across application restarts 