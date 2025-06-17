# AI Agent Approval System Guide

## Overview

The AI Agent Approval System enables agents to proactively request user permission before executing tasks that require approval. This system provides a complete workflow from agent task creation to user approval and scheduled execution.

## 🚀 Features

- **Proactive Approval Requests**: Agents automatically send approval requests to users in chat
- **Rich UI Components**: Beautiful approval interface in chat bubbles
- **Rule-Based System**: Configurable rules determine what requires approval
- **Task Scheduling**: Approved tasks are automatically scheduled for execution
- **Approval History**: Complete audit trail of all approval decisions
- **Multiple Task Types**: Support for tweets, emails, posts, and custom tasks

## 📋 System Components

### Core Services

1. **ApprovalWorkflowService** - Manages the complete approval workflow
2. **AgentApprovalHelper** - Helper for agents to send approval requests
3. **ChatApprovalHandler** - Handles approval decisions from chat UI
4. **ApprovalSystemInitializer** - Initializes and connects all components

### UI Components

1. **Enhanced ChatBubble** - Shows approval UI in chat messages
2. **Approval API Endpoints** - RESTful API for approval management

### Data Models

1. **Extended Task Model** - Tasks now include approval-related fields
2. **Approval Interfaces** - Type-safe interfaces for approval data

## 🛠️ Setup Instructions

### 1. Initialize the System

```typescript
import { ApprovalSystemInitializer } from './services/ApprovalSystemInitializer';

// Initialize with your dependencies
await ApprovalSystemInitializer.initialize({
  schedulerManager: yourSchedulerManager,
  messagingService: yourMessagingService
});
```

### 2. Configure Approval Rules

The system comes with default approval rules for:
- External content posting (tweets, emails, posts)
- Strategic tasks
- High priority tasks
- Sensitive data access
- New tool usage

You can customize these rules using the `ApprovalConfigurationManager`.

### 3. Update Your Chat Component

```typescript
import { chatApprovalHandler } from './services/ChatApprovalHandler';

// In your chat component
const handleApprovalDecision = chatApprovalHandler.createApprovalDecisionHandler(userId);

<ChatBubble
  message={message}
  requiresApproval={message.requiresApproval}
  approvalContent={message.approvalContent}
  onApprovalDecision={handleApprovalDecision}
  userId={currentUserId}
  // ... other props
/>
```

## 👤 For Agent Developers

### Quick Start - Request Tweet Approval

```typescript
import { agentApprovalHelper } from './services/AgentApprovalHelper';

// In your agent code
const taskId = await agentApprovalHelper.requestTweetApproval(
  'my-agent-id',
  'chat-123',
  '🚀 The future of AI agents is here! #AIAgents #FutureOfWork',
  new Date('2024-01-15T10:00:00') // Optional: scheduled time
);

console.log(`Approval request sent! Task ID: ${taskId}`);
```

### Custom Approval Requests

```typescript
import { agentApprovalHelper } from './services/AgentApprovalHelper';

const taskId = await agentApprovalHelper.requestApproval({
  agentId: 'my-agent',
  chatId: 'chat-123',
  taskName: 'Custom Task',
  taskDescription: 'Description of what the task will do',
  taskType: 'Custom',
  draftContent: 'Content that needs approval',
  scheduledTime: new Date('2024-01-15T14:00:00'),
  priority: 'high',
  handler: async (...args) => {
    // Your task execution logic
    console.log('Executing approved task...');
    return { success: true };
  },
  handlerArgs: ['arg1', 'arg2']
});
```

### Check if Approval is Needed

```typescript
const needsApproval = agentApprovalHelper.checkNeedsApproval({
  agentId: 'my-agent',
  chatId: 'chat-123',
  taskName: 'My Task',
  taskDescription: 'Task description',
  taskType: 'Tweet',
  // ... other task data
});

if (needsApproval) {
  // Request approval
} else {
  // Execute immediately
}
```

## 🖥️ User Experience

### What Users See

When an agent needs approval, users will see:

1. **Approval Message**: Agent's message explaining what it wants to do
2. **Approval UI**: Rich interface showing:
   - Task type and priority
   - Scheduled time (if applicable)
   - Content preview (for tweets, emails, etc.)
   - Approve/Reject buttons
   - Optional notes field

### Approval Workflow

1. **Agent Request**: Agent sends approval request to chat
2. **User Decision**: User sees approval UI and makes decision
3. **Task Processing**: 
   - If approved → Task is scheduled for execution
   - If rejected → Task is cancelled
4. **Execution**: Approved tasks run at scheduled time
5. **History**: All decisions are logged for audit

## 🔧 API Endpoints

### Get Pending Approvals

```
GET /api/tasks/approval?chatId=your-chat-id
```

Response:
```json
{
  "success": true,
  "approvals": [
    {
      "taskId": "task-123",
      "approvalMessage": "Approval required message",
      "draftContent": "Content to be posted",
      "scheduledTime": "2024-01-15T10:00:00Z",
      "taskType": "Tweet",
      "priority": "medium"
    }
  ]
}
```

### Submit Approval Decision

```
POST /api/tasks/approval
```

Body:
```json
{
  "taskId": "task-123",
  "approved": true,
  "userId": "user-456",
  "notes": "Optional approval notes"
}
```

## 📝 Example Scenarios

### Scenario 1: Scheduled Tweet

**User says**: "Prepare a tweet about AI agents that we can post tomorrow at 10am"

**Agent response**:
1. Agent analyzes the request
2. Checks if tweet posting requires approval (it does)
3. Generates tweet content
4. Sends approval request to chat with:
   - Generated tweet content
   - Scheduled time (tomorrow 10am)
   - Priority level
5. User sees approval UI and can approve/reject
6. If approved, tweet is scheduled for 10am tomorrow

### Scenario 2: Immediate Email

**User says**: "Send an email to the team about the quarterly results"

**Agent response**:
1. Agent detects email intent
2. Checks if email sending requires approval (it does)
3. Drafts email content
4. Sends approval request with email preview
5. User approves and email is sent immediately

### Scenario 3: No Approval Needed

**User says**: "What's the weather like today?"

**Agent response**:
1. Agent checks if weather lookup requires approval (it doesn't)
2. Agent fetches weather data immediately
3. Agent responds with weather information
4. No approval UI is shown

## 🛡️ Security Considerations

### Approval Rules

The system uses rule-based approval detection:

- **External Posts**: Always require approval
- **Strategic Tasks**: Require approval if marked as strategic
- **High Priority**: Require approval if priority ≥ 8/10
- **Sensitive Data**: Require approval if content contains sensitive keywords
- **Tool Usage**: Require approval for new or sensitive tools

### Audit Trail

All approval decisions are logged with:
- Task ID and details
- User who made the decision
- Timestamp of decision
- Approval/rejection reason
- Full approval history

## 🔄 Integration with Existing Systems

### Scheduler Integration

The approval system integrates with your existing task scheduler:

```typescript
// Task statuses during approval workflow
TaskStatus.PENDING    // Task waiting for approval
TaskStatus.RUNNING    // Task executing after approval
TaskStatus.COMPLETED  // Task completed successfully
TaskStatus.CANCELLED  // Task rejected by user
```

### Message Integration

Approval requests are sent as regular chat messages with special metadata:

```typescript
interface ApprovalMessage {
  content: string;           // Human-readable approval request
  requiresApproval: true;    // Flag for UI rendering
  approvalContent: {        // Approval-specific data
    taskId: string;
    draftContent?: string;
    scheduledTime?: Date;
    taskType: string;
    priority: string;
    approvalMessage: string;
  };
}
```

## 🧪 Testing

### Run the Example

```typescript
import { runApprovalExample } from './examples/AgentApprovalExample';

// Run the complete example workflow
await runApprovalExample();
```

This will simulate:
- Agent receiving various user requests
- Approval checking and request generation
- Complete workflow demonstration

### Manual Testing

1. Set up the approval system in your development environment
2. Create a test agent that uses `agentApprovalHelper`
3. Send test messages that trigger approval requests
4. Verify the approval UI appears in chat
5. Test both approval and rejection workflows

## 🚨 Troubleshooting

### Common Issues

**Issue**: Approval UI not showing
- Check that `requiresApproval` and `approvalContent` are set on messages
- Verify ChatBubble component includes approval UI code
- Check console for JavaScript errors

**Issue**: Tasks not executing after approval
- Verify scheduler manager is connected to approval workflow service
- Check task status in the scheduler
- Review approval decision processing logs

**Issue**: Agents not sending approval requests
- Confirm approval system is initialized with messaging service
- Check agent is using `agentApprovalHelper` correctly
- Verify approval rules are configured properly

### Debug Logging

Enable debug logging to see the approval workflow in action:

```typescript
// The system includes comprehensive console logging
// Check browser console for detailed workflow information
```

## 📚 Advanced Usage

### Custom Approval Rules

```typescript
import { ApprovalConfigurationManager } from './agents/shared/collaboration/approval/ApprovalConfigurationManager';

const approvalManager = ApprovalConfigurationManager.getInstance();

// Add custom approval rule
approvalManager.addRule({
  id: 'custom-rule',
  name: 'Custom Approval Rule',
  description: 'Requires approval for custom conditions',
  condition: (task) => {
    // Your custom logic here
    return task.params?.requiresCustomApproval === true;
  },
  priority: 85,
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  reason: 'This task requires custom approval'
});
```

### Custom Task Types

```typescript
// Extend the AgentApprovalRequestData interface for custom task types
await agentApprovalHelper.requestApproval({
  // ... standard fields
  taskType: 'Custom',
  // Add custom parameters in handler args
  handlerArgs: [customParam1, customParam2]
});
```

## 🎯 Next Steps

1. **Initialize** the approval system in your application
2. **Configure** approval rules for your use cases
3. **Update** your chat components to show approval UI
4. **Train** your agents to use the approval helper
5. **Test** the complete workflow end-to-end
6. **Monitor** approval decisions and system performance

## 💡 Best Practices

- **Clear Messaging**: Make approval requests clear and specific
- **Appropriate Rules**: Only require approval for tasks that genuinely need it
- **User Experience**: Keep approval UI simple and fast
- **Audit Trail**: Regularly review approval decisions for insights
- **Error Handling**: Handle approval timeouts and edge cases gracefully

---

The approval system is now ready to use! Agents can proactively request permission, users get a great approval experience, and you have full control over what requires approval. 