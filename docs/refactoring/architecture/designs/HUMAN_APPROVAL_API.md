# Human Approval Workflow API Documentation

## Overview

The Human Approval Workflow system provides a rule-based, configurable framework for defining, enforcing, and tracking approval requirements for various types of tasks. This document details the API for integrating with and using the approval system.

## Core Components

### ApprovalConfigurationManager

The central service that manages approval rules, evaluates tasks against rules, and maintains approval history.

```typescript
export class ApprovalConfigurationManager {
  // Singleton instance getter
  public static getInstance(): ApprovalConfigurationManager;
  
  // Rule management
  public addRule(rule: ApprovalRule): void;
  public removeRule(ruleId: string): boolean;
  public getAllRules(): ApprovalRule[];
  
  // Approval level management
  public addLevel(level: ApprovalLevel): void;
  public removeLevel(levelId: string): boolean;
  public getAllLevels(): ApprovalLevel[];
  
  // Approval evaluation
  public checkApprovalRequired(task: PlanningTask): { required: boolean; rule?: ApprovalRule };
  
  // Approval history recording
  public recordApprovalRequest(taskId: string, taskTitle: string, rule: ApprovalRule, subGoalId?: string): ApprovalHistoryEntry;
  public recordApprovalDecision(entryId: string, approved: boolean, approvedBy?: string, approverRole?: string, notes?: string): ApprovalHistoryEntry | null;
  
  // Approval history retrieval
  public getApprovalHistory(filter?: ApprovalHistoryFilter): ApprovalHistoryEntry[];
  public getTaskApprovalHistory(taskId: string): ApprovalHistoryEntry[];
  
  // Import/Export
  public exportApprovalHistory(): string;
  public importApprovalHistory(json: string): boolean;
}

// Singleton instance for easy access
export const approvalConfig = ApprovalConfigurationManager.getInstance();
```

### Human Collaboration Module

The interface layer that provides simplified access to approval functionality.

```typescript
export const HumanCollaboration = {
  // Approval checking
  checkIfApprovalRequired(task: PlannedTask): { required: boolean; rule?: ApprovalRule };
  
  // Message formatting
  formatApprovalRequest(task: PlannedTask, stakeholderProfile?: StakeholderProfile): string;
  
  // Approval decision handling
  applyApprovalDecision(task: PlannedTask, approved: boolean, approvedBy?: string, notes?: string): PlannedTask;
  
  // History retrieval
  getApprovalHistory(taskId: string): ApprovalHistoryEntry[];
};
```

## Key Data Types

### ApprovalRule

```typescript
export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  condition: (task: PlanningTask) => boolean;
  priority: number; // Higher priority rules are evaluated first
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  reason?: string; // Reason shown to the user when approval is required
}
```

### ApprovalLevel

```typescript
export interface ApprovalLevel {
  id: string;
  name: string;
  description: string;
  requiredApprovers: number; // Number of approvers needed
  allowedApproverRoles: string[]; // Roles that can approve
  expiresAfter?: number; // Time in minutes after which approval expires
  enabled: boolean;
}
```

### ApprovalHistoryEntry

```typescript
export interface ApprovalHistoryEntry {
  id: string;
  taskId: string;
  subGoalId?: string;
  taskTitle: string;
  requestedAt: Date;
  decidedAt?: Date;
  approved: boolean;
  approvedBy?: string;
  approverRole?: string;
  reason: string;
  notes?: string;
  ruleId: string;
  ruleName: string;
}
```

### ApprovalHistoryFilter

```typescript
export interface ApprovalHistoryFilter {
  taskId?: string;
  approved?: boolean;
  approvedBy?: string;
  ruleId?: string;
  startDate?: Date;
  endDate?: Date;
}
```

### ApprovalOperationType

```typescript
export enum ApprovalOperationType {
  EXTERNAL_POST = 'external_post',
  DATA_MODIFICATION = 'data_modification',
  STRATEGIC_TASK = 'strategic_task',
  TOOL_USAGE = 'tool_usage',
  HIGH_RESOURCE = 'high_resource',
  SENSITIVE_DATA = 'sensitive_data',
  AUTONOMOUS = 'autonomous',
  CUSTOM = 'custom'
}
```

## Usage Patterns

### Checking if a Task Requires Approval

```typescript
// Using the approval configuration manager directly
const approvalCheck = approvalConfig.checkApprovalRequired(task);
if (approvalCheck.required) {
  console.log(`Task requires approval due to rule: ${approvalCheck.rule?.name}`);
  console.log(`Reason: ${approvalCheck.rule?.reason}`);
}

// Using the human collaboration module
const approvalCheck = HumanCollaboration.checkIfApprovalRequired(task);
if (approvalCheck.required) {
  // Handle approval requirement
}
```

### Creating an Approval Request

```typescript
// Record an approval request using the configuration manager
const entry = approvalConfig.recordApprovalRequest(
  task.id,                   // Task ID
  "Analyze market trends",   // Task title
  approvalCheck.rule!,       // The rule that triggered approval
  task.currentSubGoalId      // Optional: Specific sub-goal requiring approval
);

// Store the approval entry ID on the task for future reference
task.approvalEntryId = entry.id;

// Format an approval request message for the user
const approvalMessage = HumanCollaboration.formatApprovalRequest(
  task,
  task.stakeholderProfile    // Optional: Stakeholder profile for tone adjustment
);

// Display the message to the user
displayToUser(approvalMessage);
```

### Recording an Approval Decision

```typescript
// Using the configuration manager directly
const updatedEntry = approvalConfig.recordApprovalDecision(
  task.approvalEntryId!,  // The approval entry ID
  true,                   // Approved or rejected
  "john.doe",             // Who approved/rejected
  "admin",                // Their role
  "Looks good to proceed" // Optional notes
);

// Using the human collaboration module (recommended)
const updatedTask = HumanCollaboration.applyApprovalDecision(
  task,                   // The task requiring approval
  true,                   // Approved or rejected
  "john.doe",             // Who approved/rejected
  "Looks good to proceed" // Optional notes
);
```

### Retrieving Approval History

```typescript
// Get all approval history for a specific task
const taskHistory = approvalConfig.getTaskApprovalHistory(taskId);

// Get filtered approval history
const approvedItems = approvalConfig.getApprovalHistory({
  approved: true,
  startDate: new Date('2025-01-01'),
  endDate: new Date()
});

// Using the human collaboration module
const taskHistory = HumanCollaboration.getApprovalHistory(taskId);
```

### Adding Custom Approval Rules

```typescript
// Add a custom rule
approvalConfig.addRule({
  id: 'rule_custom_security',
  name: 'Security-Sensitive Operations',
  description: 'Requires approval for operations that might pose security risks',
  condition: (task) => {
    // Check if task involves security-sensitive operations
    const securityKeywords = ['access', 'credential', 'permission', 'security'];
    return securityKeywords.some(keyword => 
      task.goal.toLowerCase().includes(keyword)
    );
  },
  priority: 95, // High priority
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  reason: 'This task involves security-sensitive operations'
});
```

### Adding Custom Approval Levels

```typescript
// Add a custom approval level
approvalConfig.addLevel({
  id: 'level_security',
  name: 'Security Team Approval',
  description: 'Requires approval from security team members',
  requiredApprovers: 2,
  allowedApproverRoles: ['security_analyst', 'security_manager'],
  expiresAfter: 60 * 4, // 4 hours
  enabled: true
});
```

## Integration Points

### Task Planning Integration

During task planning, check if approval will be required:

```typescript
function planTask(goal: string): PlannedTask {
  // Create and plan the task
  const task = createTaskPlan(goal);
  
  // Check if approval is required
  const approvalCheck = HumanCollaboration.checkIfApprovalRequired(task);
  
  // Set flag on task if approval is required
  if (approvalCheck.required) {
    task.requiresApproval = true;
    task.blockedReason = approvalCheck.rule?.reason || "Requires approval";
  }
  
  return task;
}
```

### Task Execution Integration

In the task execution flow, check for approval before proceeding:

```typescript
async function executeTask(task: PlannedTask) {
  // Check if task requires approval but hasn't been granted yet
  const approvalCheck = HumanCollaboration.checkIfApprovalRequired(task);
  
  if ((approvalCheck.required || task.requiresApproval) && !task.approvalGranted) {
    // Format and display approval request
    const approvalMessage = HumanCollaboration.formatApprovalRequest(task);
    await displayToUser(approvalMessage);
    
    // Block execution until approval is granted
    return {
      status: 'blocked',
      reason: 'awaiting_approval',
      message: approvalMessage
    };
  }
  
  // Continue with execution if approval not required or already granted
  return executeTaskSteps(task);
}
```

### Approval Decision Integration

When the user provides an approval decision:

```typescript
function handleApprovalDecision(taskId: string, approved: boolean, notes?: string) {
  // Find the task
  const task = findTaskById(taskId);
  
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  
  // Apply the approval decision
  const updatedTask = HumanCollaboration.applyApprovalDecision(
    task,
    approved,
    getCurrentUser(),
    notes
  );
  
  // Continue task execution if approved
  if (approved) {
    executeTask(updatedTask);
  } else {
    abortTask(updatedTask, 'approval_denied');
  }
}
```

## Error Handling

The approval system implements robust error handling:

- Invalid rule or level IDs return `null` or appropriate boolean values
- JSON parsing errors during import are caught and result in `false` return value
- Approval decisions for non-existent entry IDs return `null`
- Type safety is enforced throughout the system

## Performance Considerations

- Rules are evaluated in priority order for efficient approval checking
- Rules cache is maintained for fast lookups
- History filtering uses optimized Map data structures
- Rule conditions should be kept efficient as they run during task evaluation

## Security Considerations

- Approval levels enforce role-based restrictions on who can approve
- Complete audit trail is maintained of all approval requests and decisions
- Approval entries cannot be modified after creation, only supplemented with decisions
- Multiple approval levels provide flexible security controls

## Compatibility Notes

The approval system is designed to work with:

- The planning task system (`PlanningTask` type)
- The stakeholder profile system for customized messaging
- The autonomy levels system for automatic approval requirements 