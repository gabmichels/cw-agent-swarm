# Approval Management System for Chloe

## Overview

The Approval Management System enables Chloe to identify tasks that require explicit human approval before execution. This system helps manage risk for tasks that involve external interactions, strategic decisions, or the use of special tools.

## Integration Points

### 1. Task Extension
- Extended `PlannedTask` interface with approval-related fields:
  - `requiresApproval`: Boolean flag indicating if approval is needed
  - `approvalGranted`: Boolean flag indicating if approval has been granted
  - `blockedReason`: String indicating why a task is blocked
  - `type`: Task type identifier (e.g., 'external_post')
  - `isStrategic`: Flag for strategic tasks that require review
  - `toolName`: Tool identifier for tools that require approval

### 2. Approval Check
- Implemented `checkIfApprovalRequired()` function that examines task properties:
  - External posting tasks (`type === 'external_post'`)
  - Strategic tasks (`isStrategic === true`)
  - Tasks using certain tools (`toolName === 'new_tool'`)
  - Designed for extensibility with admin-defined rules

### 3. Planning Integration
- Modified `planTaskNode` to:
  - Check for approval requirements during task planning
  - Set the `requiresApproval` flag when needed
  - Log approval requirements for transparency

### 4. Execution Integration
- Updated `executeStepNode` to:
  - Block execution of tasks requiring approval
  - Generate appropriate approval request messages
  - Store blocked tasks in memory for tracking
  - Set `route: 'request-approval'` to pause execution

### 5. Decision Node
- Enhanced `decideNextStepNode` to:
  - Handle `request-approval` routes
  - Return appropriate user-facing messages with approval requests
  - Return control to the user by setting `route: 'finalize'`

### 6. Graph Flow
- Modified `chloeGraph.ts` to handle the `request-approval` route
- Added a conditional edge rule to direct this route to the `finalize` node

## Usage Flow

1. During task planning:
   - Task properties are analyzed for approval requirements
   - If needed, the `requiresApproval` flag is set

2. During task execution:
   - Tasks with `requiresApproval === true` are checked
   - If `approvalGranted !== true`, execution is blocked
   - An approval request is generated and returned to the user
   - Task is marked with `blockedReason = "awaiting approval"`

3. Approval process:
   - User reviews the approval request
   - User can grant approval by setting `approvalGranted = true`
   - Task execution can then resume normally

## Approval Request Format

```
This task requires approval before execution:

**Task**: [Task Description]

**Goal**: [Overall Goal]

**Reason for approval**: [Specific reason why approval is required]
```

## Benefits

- **Risk Management**: Prevents automatic execution of sensitive or high-impact tasks
- **Governance**: Provides oversight for strategic or external-facing operations
- **Compliance**: Helps enforce organizational policies for certain activities
- **Accountability**: Creates a clear record of approval decisions

## Future Enhancements

1. Implement a formal approval workflow with multiple approval levels
2. Add ability to specify required approver roles for different task types
3. Create an admin interface for defining approval rules
4. Implement approval expiration and renewal
5. Add approval history tracking and reporting 