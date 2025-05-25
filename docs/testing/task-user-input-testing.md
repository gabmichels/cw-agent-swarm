# Task User Input Testing Guide

## Overview

This document outlines comprehensive testing scenarios for verifying that agents can handle tasks from user input to completion. The goal is to test the full task lifecycle: input parsing → task creation → scheduling → execution → completion status updates.

## Testing Objectives

1. **Task Status Management**: Verify tasks are correctly created, updated, and marked as complete
2. **Priority Handling**: Ensure prioritization strategies work correctly
3. **Time Interpretation**: Validate that temporal expressions are parsed accurately
4. **Tool Integration**: Test task execution with various tool combinations
5. **Multi-step Planning**: Verify complex tasks are broken down and executed step-by-step
6. **Autonomous Execution**: Confirm the scheduler picks up and executes tasks without manual intervention

## Test Scenarios

### 1. Simple High-Urgency Task (Immediate Execution)

**User Input Examples:**
```
"URGENT: Please analyze this error message immediately and provide a solution"
"I need help RIGHT NOW with this critical bug"
"Emergency: System is down, need immediate assessment"
"Priority 1: Server crashed, investigate ASAP"
"Critical issue: Database connection failed, urgent fix needed"
```

**Expected Behavior:**
- Task created with priority 9-10
- Scheduled time: immediate (within seconds)
- No tools required - direct agent response
- Status: PENDING → RUNNING → COMPLETED
- Execution time: < 30 seconds

**Verification Points:**
- [ ] Task priority correctly set to high (8-10)
- [ ] Task scheduled for immediate execution
- [ ] Task status updates tracked correctly
- [ ] Response provided within expected timeframe
- [ ] Task marked as COMPLETED after execution

### 2. Tool-Based Task with Time Constraint

**User Input Examples:**
```
"Find 3 recent posts with hashtag #bitcoin from today and report back in 3 minutes"
"Search for the latest news about AI developments and summarize in 5 minutes"
"Check my calendar for conflicts tomorrow and send me a list in 2 minutes"
"Monitor the current stock price of TSLA and give me an update in 1 minute"
"Find the weather forecast for next week and report in 4 minutes"
```

**Expected Behavior:**
- Task created with specific time deadline
- Tool integration (Twitter/X API, search, calendar, finance APIs)
- Scheduled execution with countdown timer
- Results delivered to specified channel/method
- Status tracking through tool execution phases

**Verification Points:**
- [ ] Correct tool(s) selected for task
- [ ] Time constraint parsed and scheduled correctly
- [ ] Tool execution successful
- [ ] Results formatted and delivered on time
- [ ] Task marked complete with tool execution results

### 3. Complex Multi-Tool Task

**User Input Examples:**
```
"Research the top 5 trending crypto currencies, analyze their 24h performance, check recent news for each, and create a summary report with recommendations"
"Find upcoming tech conferences in San Francisco, check my availability, get venue details, and create a priority-ranked list with pros/cons"
"Monitor Bitcoin price every 30 minutes for the next 2 hours, track any movements > 2%, and alert me if it crosses $45,000"
"Search for open-source AI projects on GitHub trending this week, analyze their documentation quality, and recommend the top 3 for contribution"
"Check my email for urgent messages, categorize them by priority, draft responses for the top 3, and schedule follow-up tasks"
```

**Expected Behavior:**
- Task decomposed into multiple sub-tasks
- Different tools coordinated in sequence
- Intermediate results stored and passed between steps
- Complex data aggregation and analysis
- Comprehensive final report

**Verification Points:**
- [ ] Task properly decomposed into sub-tasks
- [ ] Each tool executed in correct sequence
- [ ] Data passed correctly between tool executions
- [ ] Error handling for individual tool failures
- [ ] Final aggregated result meets requirements

### 4. Multi-Step Goal-Oriented Planning

**User Input Examples:**
```
"Help me prepare for a product launch next week. I need to: create a marketing timeline, research competitor strategies, draft press materials, and coordinate with the team"
"Plan my weekend coding project: research React 18 features, set up a new project, implement a demo app, and deploy to Vercel"
"Organize my move to a new city: research neighborhoods, find housing options, calculate moving costs, and create a timeline"
"Prepare for my presentation on AI ethics: research current debates, gather case studies, create slides, and practice schedule"
"Set up a home office: research ergonomic furniture, compare prices, check delivery times, and create a budget plan"
```

**Expected Behavior:**
- High-level goal broken into actionable steps
- Each step becomes a scheduled sub-task
- Dependencies between tasks managed
- Progress tracking across all steps
- Final goal achievement confirmation

**Verification Points:**
- [ ] Goal decomposed into logical steps
- [ ] Sub-tasks created with appropriate scheduling
- [ ] Dependencies respected in execution order
- [ ] Progress tracking shows completion of each step
- [ ] Final goal marked as achieved

### 5. Recurring Task Patterns

**User Input Examples:**
```
"Every morning at 9 AM, check my calendar and send me a summary of the day's meetings"
"Monitor server health every 15 minutes and alert me if CPU usage exceeds 80%"
"Weekly on Fridays, generate a summary of completed tasks and email it to my team"
"Daily at market close, get stock prices for my portfolio and update my tracking spreadsheet"
"Every hour during business hours, check for new customer support tickets and prioritize them"
```

**Expected Behavior:**
- Recurring schedule pattern established
- Tasks created automatically according to schedule
- Consistent execution without user intervention
- Pattern continues until explicitly cancelled
- Historical execution tracking maintained

**Verification Points:**
- [ ] Recurring pattern correctly parsed and scheduled
- [ ] Tasks created automatically at scheduled times
- [ ] Consistent execution quality over multiple cycles
- [ ] Pattern can be modified or cancelled
- [ ] Execution history properly maintained

### 6. Conditional and Adaptive Tasks

**User Input Examples:**
```
"If Bitcoin drops below $40,000, immediately research the cause and prepare a market analysis report"
"Monitor my GitHub repo for new issues, and if any are labeled 'urgent', notify me and draft initial responses"
"Watch for any news about company layoffs in the tech sector, and if found, analyze potential impact on our recruiting strategy"
"If website traffic drops by more than 20% from yesterday, investigate the cause and suggest immediate fixes"
"Monitor weather forecasts, and if snow is predicted for tomorrow, reschedule my outdoor meetings and notify attendees"
```

**Expected Behavior:**
- Condition monitoring established
- Trigger events detected accurately
- Conditional actions executed only when criteria met
- Context-aware responses based on trigger conditions
- Adaptive behavior based on changing conditions

**Verification Points:**
- [ ] Monitoring condition correctly established
- [ ] Trigger detection works accurately
- [ ] Actions executed only when conditions are met
- [ ] Context from trigger event used in response
- [ ] False positives minimized

### 7. Priority Escalation and Interruption

**User Input Examples:**
```
"I'm working on the quarterly report (low priority), but if any customer calls with issues, drop everything and help them immediately"
"Continue with code review tasks, but if the production build fails, immediately investigate and fix"
"Process my email backlog, but interrupt if anyone messages about the client presentation"
"Work on documentation updates, but prioritize any security alerts that come in"
"Organize my photo library, but stop if I get any calendar reminders for meetings"
```

**Expected Behavior:**
- Base task continues in background
- Higher priority interruptions properly handled
- Original task resumed after interruption
- Clear priority hierarchy maintained
- Smooth transition between task contexts

**Verification Points:**
- [ ] Base task starts and runs in background
- [ ] Interruption triggers properly detected
- [ ] Priority escalation handled correctly
- [ ] Context switching between tasks works smoothly
- [ ] Original task properly resumed after interruption

### 8. Error Handling and Recovery

**User Input Examples:**
```
"Try to get the latest stock prices, but if the API is down, use alternative data sources"
"Send this report via email, but if that fails, upload to shared drive and notify via Slack"
"Search for recent news about our competitors, and if no results found, expand the search timeframe"
"Check my calendar for conflicts, and if the calendar service is unavailable, remind me to check manually"
"Download market data for analysis, but if the connection times out, retry up to 3 times"
```

**Expected Behavior:**
- Primary method attempted first
- Failures detected and handled gracefully
- Alternative approaches tried automatically
- User notified of any issues or fallback methods used
- Task completion achieved despite obstacles

**Verification Points:**
- [ ] Primary method attempted
- [ ] Failures properly detected
- [ ] Fallback methods automatically triggered
- [ ] User notification about method changes
- [ ] Task ultimately completed or gracefully failed

## Test Implementation Strategy

### Test Environment Setup

```typescript
// Use JSON files instead of Qdrant for testing
const testConfig = {
  storage: {
    type: 'json',
    path: './test-data/tasks.json'
  },
  scheduler: {
    enabled: true,
    enableAutoScheduling: true,
    schedulingIntervalMs: 1000,
    maxConcurrentTasks: 5
  },
  agents: {
    enableMemoryManager: true,
    enableToolManager: true,
    enablePlanningManager: true,
    enableSchedulerManager: true,
    enableReflectionManager: true
  }
};
```

### Verification Framework

```typescript
interface TaskVerification {
  taskCreated: boolean;
  priorityCorrect: boolean;
  schedulingCorrect: boolean;
  toolsUsed: string[];
  statusUpdates: TaskStatus[];
  executionTime: number;
  completionStatus: 'success' | 'partial' | 'failed';
  errorHandling: boolean;
}
```

### Test Data Structure

```json
{
  "tests": [
    {
      "id": "urgent-simple-001",
      "category": "simple-urgent",
      "userInput": "URGENT: Please analyze this error message immediately",
      "expectedPriority": 10,
      "expectedScheduling": "immediate",
      "expectedTools": [],
      "expectedDuration": 30,
      "verificationPoints": [
        "task_created",
        "high_priority_set",
        "immediate_execution",
        "status_tracking",
        "completion_marked"
      ]
    }
  ]
}
```

## Performance Benchmarks

- **Simple Tasks**: < 30 seconds end-to-end
- **Tool-based Tasks**: < 5 minutes including tool execution
- **Complex Multi-tool**: < 15 minutes for full completion
- **Multi-step Planning**: Variable based on scope, but progress visible within 1 minute
- **Task Creation Latency**: < 2 seconds from user input to task in system
- **Status Update Frequency**: Every 10 seconds during execution

## Monitoring and Metrics

### Key Metrics to Track
1. Task completion rate (target: >95%)
2. Average execution time by task type
3. Priority handling accuracy (target: >99%)
4. Tool integration success rate (target: >90%)
5. Schedule adherence (target: >95% within tolerance)
6. Error recovery success rate (target: >80%)

### Dashboard Indicators
- Real-time task queue status
- Execution success/failure rates
- Average response times
- Tool utilization statistics
- Priority distribution analysis
- User satisfaction scores

## Integration with Production

The test scenarios should mirror production conditions as closely as possible:

1. **Real API Keys**: Use actual service APIs (with rate limiting)
2. **Production Data Structures**: Same task models and schemas
3. **Authentic User Inputs**: Based on real user request patterns
4. **Performance Constraints**: Similar resource limitations as production
5. **Error Conditions**: Simulate real-world failure scenarios

This comprehensive testing approach ensures that the agent system can handle the full spectrum of user requests reliably and efficiently. 