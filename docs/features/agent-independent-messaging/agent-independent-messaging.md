# Agent Independent Messaging System

## Implementation Instructions
**READ THIS FIRST**: This document describes a critical feature that allows agents to independently initiate conversations with users. When implementing:
1. Always follow `@IMPLEMENTATION_GUIDELINES.md` - use ULID for IDs, strict TypeScript, no 'any' types
2. Implementation must be production-ready, not placeholder code
3. Test all integration points between task execution and chat delivery
4. Ensure proper error handling and fallback mechanisms
5. Consider rate limiting and notification preferences

---

## Overview

This system provides two complementary capabilities:
1. **Autonomous Messaging**: Agents independently message users about task results, opportunities, insights
2. **Tool-Based Messaging**: Users can request agents to schedule regular messages (reflections, reminders, summaries)

**Example User Request**: *"Every weekday at 6pm I want you to send me the same exact reflection questions about my day"*

The agent should be able to create a scheduled task that sends daily reflection questions and builds up memory collections as a diary.

Currently, agents can execute tasks independently but cannot deliver results or insights directly to users via chat. This feature bridges that gap by enabling agents to message users proactively based on various triggers AND provides messaging as a tool that agents can use when users request scheduled messages, reflections, or other recurring communications.

## Current Infrastructure Status

### ✅ **Existing Components**
- **Task Execution**: `ModularSchedulerManager.executeDueTasks()` ✓
- **Agent Communication**: `AgentCommunicationHandler.sendMessage()` ✓  
- **Chat Persistence**: `ConversationManager.addMessage()` ✓
- **WebSocket Delivery**: `WebSocketNotificationService.notifyMessageCreated()` ✓
- **Memory System**: Task results stored in memory ✓

### ❌ **Missing Links**
- **Task → Chat Integration**: No mechanism to deliver `TaskExecutionResult` to active chats
- **Message Routing**: No system to determine which chat/user to message
- **Notification Logic**: No decision engine for when agents should message vs. stay silent
- **User Preferences**: No user controls for agent messaging frequency/types

---

## Messaging Scenarios Audit

### 1. **Task Completion Reporting**
**Current State**: Task results stored in memory only  
**Desired**: Agent reports completion with key findings to relevant chat

```typescript
// Example scenarios:
- "✅ Completed market analysis. Found 3 new opportunities worth exploring."
- "📊 Weekly report generated. Revenue up 12%, here are the highlights..."
- "❌ Data sync failed. Connection timeout to external API."
```

### 2. **Opportunity Notifications**  
**Current State**: `OpportunityDetector` identifies opportunities, stores in memory  
**Desired**: Agent proactively informs user about detected opportunities

```typescript
// Example scenarios:
- "💡 Detected trend: Bitcoin mentions increased 300% in news. Should I analyze?"
- "🎯 Your competitor just released a similar feature. Want me to research?"
- "📈 Found 5 investment opportunities matching your criteria."
```

### 3. **Reflection Insights**
**Current State**: Reflection results stored, not shared with user  
**Desired**: Agent shares interesting learnings and insights

```typescript
// Example scenarios:
- "🧠 Weekly reflection: I've improved 23% at task prioritization this week"
- "💭 Insight: Your productivity peaks on Tuesdays at 10 AM"
- "🔄 I've identified a pattern: complex requests work better when broken into steps"
```

### 4. **Scheduled Summaries**
**Current State**: Weekly cycles run, results stored internally  
**Desired**: Agent delivers regular summaries to users

```typescript
// Example scenarios:
- "📋 Weekly Summary: 12 tasks completed, 3 insights discovered, 2 follow-ups needed"
- "🎯 Daily Briefing: Today's priorities based on your schedule and goals"
- "📈 Monthly Progress: Here's how we've improved together this month"
```

### 5. **Follow-up Questions**
**Current State**: No mechanism for agents to ask clarifying questions later  
**Desired**: Agent can request additional information or confirmation

```typescript
// Example scenarios:
- "❓ Earlier you mentioned social media platforms. Should I create a strategy draft?"
- "🤔 I need more context for the budget analysis. What's the target date?"
- "✋ Before I proceed with the integration, should I check security requirements?"
```

### 6. **Error Notifications & Recovery**
**Current State**: Errors logged but user not informed  
**Desired**: Agent notifies user of issues and suggests solutions

```typescript
// Example scenarios:
- "⚠️ API quota exceeded. Should I try alternative data sources?"
- "🔧 Memory optimization completed. System running 15% faster now"
- "🔄 Retrying failed task with adjusted parameters"
```

### 7. **Learning & Adaptation Updates**
**Current State**: Knowledge graph changes happen silently  
**Desired**: Agent shares learning progress and discoveries

```typescript
// Example scenarios:
- "📚 Learned new patterns from your coding style. Applied to future suggestions"
- "🔗 Connected your project requirements with industry best practices"
- "🎯 Updated my understanding of your priorities based on recent decisions"
```

---

## Architecture Design

### Message Flow Architecture
```
TaskExecution → MessageRouter → ChatIntegrator → WebSocketDelivery
     ↓              ↓              ↓              ↓
TaskResult → RoutingDecision → ChatMessage → UserNotification
```

### Core Components

#### 1. **AgentMessagingBridge**
Central coordinator between task system and chat system.

```typescript
interface AgentMessagingBridge {
  // Route messages from task execution to appropriate chats
  routeTaskMessage(result: TaskExecutionResult, options: MessagingOptions): Promise<MessageDeliveryResult>;
  
  // Handle spontaneous agent-initiated messages
  sendSpontaneousMessage(agentId: string, content: string, trigger: MessageTrigger): Promise<MessageDeliveryResult>;
  
  // Route opportunity notifications
  routeOpportunityMessage(opportunity: DetectedOpportunity, urgency: 'low' | 'medium' | 'high'): Promise<MessageDeliveryResult>;
}
```

#### 2. **ChatRoutingEngine**
Determines which chat/user to message based on context.

```typescript
interface ChatRoutingEngine {
  // Find the most appropriate chat for a message
  findTargetChat(agentId: string, context: MessageContext): Promise<ChatTarget | null>;
  
  // Get user's messaging preferences
  getUserPreferences(userId: string): Promise<MessagingPreferences>;
  
  // Check if user is available/should be notified
  shouldNotifyUser(userId: string, messageType: MessageType, urgency: MessageUrgency): Promise<boolean>;
}
```

#### 3. **MessageDecisionEngine** 
Decides when agents should message vs. stay silent.

```typescript
interface MessageDecisionEngine {
  // Evaluate if a task result should trigger a message
  shouldMessageForTaskResult(result: TaskExecutionResult): Promise<MessagingDecision>;
  
  // Evaluate if an opportunity should be shared
  shouldMessageForOpportunity(opportunity: DetectedOpportunity): Promise<MessagingDecision>;
  
  // Rate limiting and spam prevention
  checkRateLimits(agentId: string, userId: string): Promise<RateLimitStatus>;
}
```

#### 4. **MessageTemplateEngine**
Formats messages appropriately for different scenarios.

```typescript
interface MessageTemplateEngine {
  // Format task completion messages
  formatTaskCompletionMessage(result: TaskExecutionResult): Promise<FormattedMessage>;
  
  // Format opportunity notifications
  formatOpportunityMessage(opportunity: DetectedOpportunity): Promise<FormattedMessage>;
  
  // Format reflection insights
  formatReflectionMessage(reflection: ReflectionResult): Promise<FormattedMessage>;
}
```

---

## Implementation Plan

### ✅ **Phase 1: LLM-Powered Message Generation** - **COMPLETED**
**REVISED APPROACH**: Use existing infrastructure instead of building new services

**Key Realizations:**
- ✅ **Existing Chat System**: `useChatMemory`, `addChatMessage()`, WebSocket delivery already work
- ✅ **Existing Memory System**: `MemoryType.MESSAGE`, memory services, chat persistence all exist  
- ✅ **Existing Agent LLM**: Agents already have LLM access, personas, context handling
- ❌ **New Infrastructure**: Don't need new messaging services - leverage what exists

**What We Actually Need:**
- ✅ **AgentMessagingService**: Simple service that uses existing chat/memory APIs
- ✅ **LLM Message Generator**: Use agent's LLM to generate contextual messages with persona
- ✅ **Agent Tool**: Simple tool that uses existing scheduler for user-requested messages

**✅ COMPLETED IMPLEMENTATION:**

**Files Created:**
- `src/services/messaging/message-generator.ts` - LLM-powered message generation with agent personas
- `src/services/agent-messaging.ts` - Main orchestration service using existing infrastructure  
- `src/services/messaging/agent-tool.ts` - Agent tool for user-requested scheduled messages

**Key Features Implemented:**
- **LLM-Powered Generation**: Messages generated using agent LLM with full persona context
- **Existing System Integration**: Uses existing chat, memory, and scheduler APIs
- **Context-Aware Messaging**: Incorporates recent conversation, user preferences, task results
- **Agent Tool**: `schedule_message` tool for user-requested recurring messages
- **Error Handling**: Comprehensive error handling with proper typing
- **ULID IDs**: All generated IDs use ULID format per guidelines
- **Strict TypeScript**: No 'any' types, proper interfaces throughout

**Message Types Supported:**
- Task completion notifications with LLM-generated context
- Opportunity alerts with confidence and relevance
- Reflection insights with patterns and improvements  
- Scheduled messages (daily reflections, weekly summaries, goal reviews, break reminders)
- Follow-up questions and clarifications

**Agent Tool Capabilities:**
- Schedule daily/weekly/monthly recurring messages
- Interactive options for response collection into memory collections
- Expiration dates and occurrence limits
- User-friendly validation and error messages
- Integration with existing scheduler system

**Implementation Approach:**
```typescript
// Use existing systems - don't rebuild them
interface AgentMessagingService {
  // Generate message using agent's LLM with full context
  generateContextualMessage(
    agentId: string,
    trigger: MessageTrigger,
    context: MessageContext
  ): Promise<string>;
  
  // Send message using existing chat system
  sendToUserChat(
    userId: string, 
    agentId: string, 
    content: string,
    messageType: 'task_completion' | 'opportunity' | 'reflection' | 'scheduled'
  ): Promise<void>;
}

// Leverage existing chat persistence
const chatService = await getChatService();
const message = await chatService.addMessage({
  chatId,
  userId,
  agentId,
  content: llmGeneratedContent, // ← Key change: LLM generates this
  messageType: 'agent_message',
  metadata: { trigger, context }
});
```

**Ready for Integration:**
- ✅ Can be integrated into existing task execution flows
- ✅ Agent tool ready for registration in agent systems
- ✅ Mock LLM service provided for testing
- ✅ Full type safety and error handling
- ✅ Leverages all existing infrastructure

### ✅ **Phase 2: Task Completion Integration** - **COMPLETED**
**REVISED APPROACH**: Hook into existing task execution without new infrastructure

**Implementation:**
- ✅ Add message generation hook to `ModularSchedulerManager.executeDueTasks()`
- ✅ Use agent's persona + task context to generate relevant completion messages
- ✅ Deliver via existing chat system APIs
- ✅ Store in existing memory system as `MemoryType.MESSAGE`

**✅ COMPLETED IMPLEMENTATION:**

**Files Created:**
- `src/services/messaging/llm-adapter.ts` - OpenAI LLM adapter using `OPENAI_CHEAP_MODEL`
- `src/services/messaging/scheduler-integration.ts` - Integration logic between scheduler and messaging
- `src/services/messaging/messaging-scheduler-manager.ts` - Wrapper for ModularSchedulerManager with messaging

**Key Features Implemented:**
- **Smart Decision Engine**: Only messages for significant tasks (failures, long-running, significant results)
- **Rate Limiting**: Prevents message spam with configurable limits (10/hour, 30s cooldown)
- **LLM Integration**: Uses `process.env.OPENAI_CHEAP_MODEL` for cost-effective message generation
- **Task Result Adaptation**: Converts scheduler TaskExecutionResult to messaging format
- **Automatic Agent/User Detection**: Extracts IDs from task metadata patterns
- **Interface Compatibility**: Adapts between different Task and ScheduledTask interfaces

**Message Triggering Logic:**
- Failed tasks → Always message (high priority)
- Long-running tasks (>30s) → Message on completion (medium priority)
- Tasks with significant results → Message (medium priority)
- Quick routine tasks → No message (prevents spam)

**Integration Point:**
```typescript
// In existing ModularSchedulerManager.executeDueTasks()
const results = await this.executor.executeTasks(dueTasks, maxConcurrent);

// NEW: Process results for messaging
if (this.messagingIntegration && results.length > 0) {
  await this.processTaskResultsForMessaging(results, agentId);
}
```

**Smart Decision Making:**
```typescript
// Only message for substantial tasks
if (taskResult.duration < 5000) { // 5 seconds
  return { shouldMessage: false, reason: 'Routine task - no message needed' };
}

// Always message for failures
if (!taskResult.successful) {
  return { shouldMessage: true, reason: 'Task failed - user should be notified' };
}
```

**LLM-Powered Generation:**
- Uses `OPENAI_CHEAP_MODEL` for cost efficiency (smart thinking already happened)
- Temperature 0.3 for consistent, focused messaging
- 500 token limit for concise messages
- 10-second timeout for fast response
- Fallback messages on LLM errors

**Ready for Integration:**
- ✅ Can wrap any existing ModularSchedulerManager instance
- ✅ Zero changes required to core scheduler code
- ✅ Backward compatible - can enable/disable messaging
- ✅ Automatic agent/user detection from task metadata
- ✅ Full error handling and rate limiting

### ✅ **Phase 3: User-Requested Scheduled Messages** - **COMPLETED**
**REVISED APPROACH**: Comprehensive agent tool using existing scheduler

**✅ COMPLETED IMPLEMENTATION:**

**Files Created:**
- `src/services/messaging/agent-tool.ts` - Complete schedule_message tool with comprehensive functionality
- `src/tests/autonomy/agent-messaging.test.ts` - Test suite for agent messaging functionality

**Key Features Implemented:**
- **Comprehensive Message Types**: daily_reflection, weekly_summary, goal_review, break_reminder, custom
- **Flexible Scheduling**: Support for daily, weekly, monthly, and custom frequencies
- **Smart Time Parsing**: Natural language time parsing ("6:00 PM", "Friday 3:00 PM", "1st 9:00 AM")
- **Interactive Messaging**: Optional response collection into memory collections
- **Message Templates**: Pre-built templates for common message types with engaging content
- **Expiration Control**: Support for end dates and maximum occurrence limits
- **Timezone Support**: Configurable timezone handling for scheduling

**Message Types with Templates:**
- **Daily Reflection**: 5-question reflection prompts for personal growth tracking
- **Weekly Summary**: Comprehensive weekly review and planning questions
- **Goal Review**: Goal progress and motivation check-ins
- **Break Reminder**: Wellness-focused break suggestions with health tips
- **Custom Messages**: User-defined content with flexible scheduling

**Scheduling Intelligence:**
```typescript
// Natural language time parsing
"6:00 PM" → Daily at 6 PM
"Friday 3:00 PM" → Weekly on Fridays at 3 PM  
"1st 9:00 AM" → Monthly on 1st at 9 AM
```

**Tool Integration:**
```typescript
// Agent tool metadata
{
  name: 'schedule_message',
  description: 'Schedule recurring messages to be sent to the user at specified times. Use this when users ask for regular reminders, reflections, summaries, or any recurring communication.',
  parameters: ScheduleMessageParamsSchema
}
```

**Example Usage Scenarios:**
- User: "Send me daily reflection questions at 6 PM"
- User: "Remind me to take breaks every 2 hours" 
- User: "Weekly goal review every Friday afternoon"
- User: "Send me a joke in 2 minutes to chat 1b17d53c-cb7c-4734-a8f1-5d6fdc91f80e"

**Test Coverage:**
- Joke scheduling for specific chat ID in 2 minutes
- General message scheduling queries
- Different message type recognition
- Task completion messaging concepts
- Tool integration verification
- Error handling for invalid requests

**Integration Points:**
- Uses existing `SchedulerManager` for task creation
- Leverages `ChatService` for message delivery
- Integrates with `MemoryService` for response collection
- Uses LLM adapter for dynamic content generation
- Full compatibility with existing agent tool system

**Ready for Agent Registration:**
The tool provides static metadata and can be easily registered with any agent system that supports the standard tool interface pattern used throughout the codebase.

### ❌ **Phase 4: Opportunity & Insight Notifications** - **NOT STARTED**
**Implementation:**
- [ ] Hook into existing opportunity detection systems
- [ ] Hook into existing reflection/insight generation
- [ ] Use agent LLM to format notifications with proper tone/context
- [ ] Deliver via existing chat system

---

## Revised Technical Approach

### Core Principle: **Leverage Existing Infrastructure**

Instead of building new messaging services, use what already exists:

1. **Message Generation**: Agent's LLM + persona/background for contextual content
2. **Message Delivery**: Existing chat system (`addChatMessage`, `getChatService`)
3. **Message Storage**: Existing memory system (`MemoryType.MESSAGE`)
4. **Scheduling**: Existing `ModularSchedulerManager` for recurring messages
5. **WebSocket Delivery**: Existing WebSocket notification system

### LLM Message Generation with Context

**Key Innovation**: Generate messages using agent's LLM with full context:

```typescript
interface MessageGenerationContext {
  // Agent context
  agentPersona: AgentPersona;
  agentBackground: string;
  communicationStyle: string;
  
  // Trigger context  
  trigger: MessageTrigger;
  taskResult?: TaskExecutionResult;
  opportunity?: DetectedOpportunity;
  reflection?: ReflectionResult;
  
  // User context
  userPreferences: MessagingPreferences;
  recentConversation: Message[];
  userTimezone: string;
  relationshipHistory: string;
}

// Generate contextual message
const systemPrompt = `
You are ${agentPersona.name}, ${agentPersona.description}.

COMMUNICATION STYLE: ${agentPersona.communicationStyle}
BACKGROUND: ${agentPersona.background}

TASK: Generate a message to inform the user about: ${trigger.type}

CONTEXT:
- Task Result: ${JSON.stringify(taskResult)}
- Your relationship with user: ${relationshipHistory}
- User prefers: ${userPreferences.tone}

REQUIREMENTS:
- Match your persona and communication style
- Be helpful and relevant
- Keep it concise but informative
- Include actionable insights or next steps
- Use appropriate emojis sparingly
`;

const message = await agentLLM.generate(systemPrompt, context);
```

### Simple Service Architecture

```typescript
// Single service that orchestrates existing systems
export class AgentMessagingService {
  constructor(
    private chatService: ChatService,           // Existing
    private memoryService: MemoryService,       // Existing  
    private schedulerManager: SchedulerManager, // Existing
    private messageGenerator: MessageGenerator  // New: LLM wrapper
  ) {}
  
  async sendTaskCompletionMessage(result: TaskExecutionResult) {
    const content = await this.messageGenerator.generateTaskMessage(result);
    await this.chatService.addMessage({ content, type: 'task_completion' });
  }
  
  async scheduleRecurringMessage(params: ScheduleParams) {
    return this.schedulerManager.createTask({
      handler: () => this.sendScheduledMessage(params)
    });
  }
}
```

---

## Benefits of Revised Approach

1. **Leverage Existing**: Use proven chat/memory/scheduler systems
2. **LLM-Powered**: Messages generated with agent persona + context  
3. **Minimal Code**: Single service vs. multiple new systems
4. **Faster Implementation**: Build on existing APIs vs. recreating them
5. **Better Integration**: Works with existing WebSocket, UI, memory patterns
6. **Easier Testing**: Test integration points vs. new infrastructure

---

## Technical Specifications

### Data Structures

```typescript
interface MessageTrigger {
  type: 'task_completion' | 'opportunity' | 'reflection' | 'scheduled' | 'follow_up' | 'error' | 'learning';
  source: string; // agentId
  priority: 'low' | 'medium' | 'high' | 'urgent';
  context: Record<string, unknown>;
}

interface MessagingOptions {
  urgency: MessageUrgency;
  category: MessageCategory;
  requiresResponse: boolean;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
}

interface MessageDeliveryResult {
  success: boolean;
  messageId?: string;
  chatId?: string;
  deliveredAt?: Date;
  error?: string;
  rateLimited?: boolean;
}

interface MessagingPreferences {
  enableTaskNotifications: boolean;
  enableOpportunityAlerts: boolean;
  enableReflectionInsights: boolean;
  enableScheduledSummaries: boolean;
  summaryFrequency: 'daily' | 'weekly' | 'monthly';
  quietHours: { start: string; end: string; timezone: string };
  maxMessagesPerHour: number;
  preferredUrgencyLevels: MessageUrgency[];
}
```

### Integration Points

1. **Task Execution Hook**
```typescript
// In ModularSchedulerManager.executeDueTasks()
const results = await this.executor.executeTasks(dueTasks, maxConcurrent);

// NEW: Route task results to messaging system
for (const result of results) {
  if (result.successful && result.shouldNotifyUser) {
    await this.messagingBridge.routeTaskMessage(result, {
      urgency: this.determineUrgency(result),
      category: 'task_completion',
      requiresResponse: false
    });
  }
}
```

2. **Opportunity Detection Hook**
```typescript
// In OpportunityDetector.detectOpportunities()
const opportunities = await this.scanForOpportunities();

for (const opportunity of opportunities) {
  // NEW: Route high-value opportunities to user
  if (opportunity.confidence > 0.8) {
    await this.messagingBridge.routeOpportunityMessage(opportunity, 'high');
  }
}
```

3. **Reflection Hook**
```typescript
// In ReflectionManager.generateWeeklyReflection()
const reflection = await this.generateReflection();

// NEW: Share interesting insights with user
if (reflection.hasSignificantInsights) {
  await this.messagingBridge.sendSpontaneousMessage(
    this.agentId,
    this.formatReflectionInsight(reflection),
    { type: 'reflection', priority: 'medium' }
  );
}
```

---

## Error Handling & Edge Cases

### Rate Limiting
- Maximum 10 messages per hour per agent
- Exponential backoff for repeated failures
- User preferences override default limits

### Message Deduplication
- Hash message content to prevent duplicates
- Time-based windows for similar messages
- User feedback integration for relevance

### Fallback Mechanisms
- If chat routing fails, store in agent's message queue
- If WebSocket delivery fails, fall back to email/SMS
- If formatting fails, send plain text version

### Privacy & Security
- Respect user's do-not-disturb settings
- Encrypt sensitive message content
- Audit trail for all agent-initiated messages
- User consent for different message types

---

## Testing Strategy

### Unit Tests
- Message routing logic
- Template formatting
- Rate limiting algorithms
- Decision engine rules

### Integration Tests
- Task execution → message delivery flow
- Opportunity detection → notification flow
- Reflection → insight sharing flow
- WebSocket delivery end-to-end

### User Experience Tests
- Message relevance and timing
- Notification fatigue prevention
- Preference system effectiveness
- Cross-platform delivery

---

## Success Metrics

### Technical Metrics
- Message delivery success rate > 99%
- Average delivery latency < 200ms
- False positive rate < 5%
- User preference compliance > 95%

### User Experience Metrics
- User engagement with agent messages
- Message relevance ratings
- Opt-out rates by message type
- Time to acknowledge/respond to messages

### Business Metrics
- Increased task completion visibility
- Faster response to opportunities
- Improved agent-user collaboration
- Enhanced user satisfaction scores

---

## Future Enhancements

### Advanced Features
- **Conversational Threading**: Multi-turn conversations initiated by agents
- **Rich Media Messages**: Images, files, interactive buttons
- **Smart Batching**: Group related messages for better UX
- **Predictive Messaging**: ML-based optimal timing prediction

### Integration Expansions
- **External Notifications**: Slack, Teams, email integration
- **Voice Notifications**: Text-to-speech for urgent messages
- **Mobile Push**: Native mobile app notifications
- **Calendar Integration**: Schedule-aware messaging

### Analytics & ML
- **Message Effectiveness Scoring**: Learn what works best
- **Personalization Engine**: Adapt to individual user preferences
- **Conversation Analytics**: Measure engagement quality
- **Predictive Relevance**: AI-powered message filtering

---

## Implementation Timeline

**Total Estimated Time**: 8-10 weeks

- **Weeks 1-2**: Phase 1 (Core Infrastructure)
- **Weeks 3-4**: Phase 2 (Task Completion Messaging)
- **Weeks 5-6**: Phase 3 (Opportunity Notifications) + Phase 4 (Reflection)
- **Weeks 7-8**: Phase 5 (Scheduled Summaries) + Phase 6 (Advanced Features)
- **Weeks 9-10**: Phase 7 (User Experience) + Testing & Polish

Each phase should be fully tested and potentially deployable before moving to the next phase. 

## Key Innovation: Agent Messaging as a Tool

### **User-Requested vs. Agent-Initiated**
Instead of agents randomly deciding to message users, this approach gives users **control**:

**User**: *"Every weekday at 6pm I want you to send me reflection questions about my day"*
**Agent**: *[Uses `schedule_message` tool to create recurring task]*

### **Memory Collection as Primary Goal**
The tool approach naturally builds toward **data collection and insights**:
- **Daily Journal**: Reflection responses build a personal diary
- **Goal Tracking**: Monthly check-ins create progress records
- **Habit Formation**: Regular prompts establish routines
- **Pattern Recognition**: Long-term data reveals trends

### **User Control & Consent**
- Users explicitly request scheduled messages
- Clear expectations about frequency and content
- Easy cancellation and modification
- No surprise or unwanted notifications

### **Examples of Tool-Based Messaging**

#### **Daily Reflection Journal**
**User**: *"Help me build a daily journal habit. Can you send me reflection questions every evening?"*
**Agent**: Schedules daily reflection questions at 6pm weekdays, collects responses in "daily_journal" memory collection

#### **Weekly Goal Review**
**User**: *"I want to review my goals every Friday afternoon"*
**Agent**: Schedules weekly goal review questions, tracks progress over time

#### **Break Reminders**
**User**: *"Remind me to take breaks every 2 hours during work days"*
**Agent**: Schedules wellness check-ins, monitors work patterns 