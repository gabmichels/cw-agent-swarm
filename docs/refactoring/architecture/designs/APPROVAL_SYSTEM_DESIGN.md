# Approval System Design

## Overview

The Approval System provides a flexible, rule-based framework for defining and enforcing approval requirements for various task types and operations. The system includes comprehensive configuration capabilities and detailed history tracking to maintain a complete audit trail of all approval activities.

## Key Components

### 1. Rule-Based Configuration

The system uses a declarative rule engine that allows defining approval requirements based on:

- Task properties (type, strategic importance, etc.)
- Content characteristics (sensitive keywords, etc.)
- Tool usage (specific tools that require oversight)
- Priority levels (high-priority tasks needing review)

Each rule includes:
- Condition logic to evaluate against tasks
- Priority setting to resolve conflicts
- Descriptive reason for user display
- Metadata for tracking and management

### 2. Multi-Level Approval Framework

Different operations can require different levels of approval:

- Standard approval (single approver)
- Admin-only approval (restricted approver roles)
- Multi-person approval (requiring multiple reviewers)

Each level specifies:
- Number of required approvers
- Allowed approver roles
- Optional expiration timeframes
- Enabled/disabled status

### 3. Comprehensive History Tracking

The system maintains a detailed history of all approval activities:

- Approval requests with timestamps
- Approval decisions with approver information
- Notes and context for decisions
- Full audit trail with search and filtering

### 4. Integration Points

The approval system integrates with:

- Task planning workflow (to identify approval needs)
- Task execution (to block tasks pending approval)
- User interface (to display approval requests)
- Memory system (to store approval history)

## Implementation Details

### Approval Configuration Manager

The `ApprovalConfigurationManager` provides a centralized service for:

- Managing approval rules
- Evaluating tasks against rules
- Recording approval requests and decisions
- Retrieving approval history

```typescript
// Core interfaces
interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  condition: (task: PlanningTask) => boolean;
  priority: number;
  enabled: boolean;
  reason?: string; 
}

interface ApprovalLevel {
  id: string;
  name: string;
  description: string;
  requiredApprovers: number;
  allowedApproverRoles: string[];
  expiresAfter?: number;
  enabled: boolean;
}

interface ApprovalHistoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  requestedAt: Date;
  decidedAt?: Date;
  approved: boolean;
  approvedBy?: string;
  reason: string;
  notes?: string;
}
```

### Rule Evaluation Flow

1. During task planning and execution, the system checks if approval is required:
   ```typescript
   const approvalCheck = approvalConfig.checkApprovalRequired(task);
   if (approvalCheck.required) {
     // Block execution and request approval
   }
   ```

2. When approval is required:
   - The task execution is paused
   - An approval request is recorded in history
   - A user-friendly message is displayed with the reason
   - The approval entry ID is stored on the task

3. When approval is granted:
   - The approval decision is recorded in history
   - The task is updated with approval information
   - Execution can proceed

### History Management

The approval history provides:

- Complete timeline of all approval activities
- Filtering by task, approver, result, date range
- Task-specific approval history
- Export/import capabilities for compliance

## Default Rules

The system comes with several predefined rules:

1. **External Content Posting**
   - Requires approval for tasks that post content to external platforms
   - High priority (100)

2. **Strategic Task Execution**
   - Requires approval for tasks marked as strategic
   - Medium-high priority (90)

3. **New Tool Usage**
   - Requires approval for tasks using new or sensitive tools
   - Medium priority (80)

4. **High Priority Task**
   - Requires approval for high priority tasks
   - Medium priority (70)

5. **Sensitive Data Access**
   - Requires approval for tasks accessing sensitive data
   - High priority (95)

## Integration with Planning Flow

The approval system integrates with the planning flow through multiple points:

1. **Planning Node**
   - Checks for approval requirements during task planning
   - Sets the `requiresApproval` flag when needed

2. **Execution Node**
   - Blocks execution of tasks requiring approval
   - Generates approval requests with context
   - Creates detailed trace entries

3. **Decision Node**
   - Handles the `request-approval` route
   - Provides informative messages to the user
   - Tracks approval status in task history

4. **Human Collaboration Module**
   - Provides interfaces for checking approval requirements
   - Formats approval requests for user presentation
   - Records approval decisions

## User Experience

When a task requires approval:

1. The user sees a detailed message explaining:
   - Which specific step requires approval
   - The reason for the approval requirement
   - The rule that triggered the requirement

2. The approval request includes:
   - Task description and context
   - Timestamp when approval was requested
   - Explanation of why approval is needed

3. After approval:
   - The task continues execution
   - A record of the approval is maintained
   - The approval is included in task history

## Configuring the Approval System

Administrators can configure the approval system by:

1. Adding custom rules:
   ```typescript
   approvalConfig.addRule({
     id: 'rule_custom',
     name: 'Custom Rule',
     description: 'Custom approval rule',
     condition: (task) => task.metadata?.requiresReview === true,
     priority: 60,
     enabled: true,
     createdAt: new Date(),
     updatedAt: new Date(),
     reason: 'This task requires approval based on custom criteria'
   });
   ```

2. Adding approval levels:
   ```typescript
   approvalConfig.addLevel({
     id: 'level_custom',
     name: 'Custom Approval Level',
     description: 'Custom approval level',
     requiredApprovers: 2,
     allowedApproverRoles: ['admin', 'manager'],
     expiresAfter: 60 * 48, // 48 hours
     enabled: true
   });
   ```

3. Getting approval history:
   ```typescript
   const history = approvalConfig.getApprovalHistory({
     startDate: new Date('2025-01-01'),
     endDate: new Date(),
     approved: true
   });
   ```

## Future Enhancements

1. **Approval Workflows**
   - Multi-stage approval processes
   - Sequential approvals from different roles
   - Delegated approval capabilities

2. **Approval Analytics**
   - Metrics on approval time and outcomes
   - Patterns in approval requests
   - Optimization recommendations

3. **Conditional Requirements**
   - Dynamic approval requirements based on context
   - Rule composition and complex conditions
   - Time-based or load-based requirements

4. **Integration Expansion**
   - API for external approval systems
   - Notification integrations
   - Calendar/scheduling integration

## Conclusion

The Approval System provides a robust, flexible framework for managing approvals throughout the application. Its rule-based configuration, comprehensive history tracking, and seamless integration with the planning flow enable effective governance and oversight while maintaining a smooth user experience.

The system balances the need for control with the flexibility required for different operational contexts, allowing organizations to implement approval policies tailored to their specific requirements. 