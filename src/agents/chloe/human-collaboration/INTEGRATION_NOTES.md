# Human Collaboration Integration with Chloe Planning Flow

## Overview

This document describes how the Human Collaboration module has been integrated into Chloe's planning and execution flow, enabling her to detect ambiguities and request clarification from users when needed.

## Integration Points

### 1. Types Extension
- Extended `PlanningTask` interface in `src/agents/chloe/graph/nodes/types.ts`
- Added fields:
  - `confidenceScore`: Represents Chloe's confidence in her plan
  - `needsClarification`: Boolean flag indicating if clarification is needed
  - `clarificationQuestions`: Array of questions to ask the user
  - `params` and `requiredParams`: For parameter-based clarification checks
  - New status: `awaiting_clarification` for tasks pending human input

### 2. Plan Task Node
- Modified `planTaskNode.ts` to:
  - Request confidence score in the planning prompt
  - Call `HumanCollaboration.checkNeedClarification()` after plan generation
  - Generate clarification questions if needed
  - Set `route: 'request-clarification'` and update task status
  - Create appropriate messages and logging

### 3. Decision Node
- Updated `decideNextStepNode.ts` to handle:
  - Explicit `request-clarification` routes
  - Tasks with `awaiting_clarification` status
  - Generate appropriate user-facing messages with questions
  - Return control to the user by setting `route: 'finalize'`

### 4. Graph Flow
- Modified `chloeGraph.ts` to handle the `request-clarification` route
- Added a conditional edge rule to direct this route to the `finalize` node

## Usage Flow

1. When a task is planned, the system automatically checks for ambiguities:
   - Low confidence scores (< 0.6)
   - Missing required parameters
   - Presence of uncertainty markers in the plan

2. If ambiguities are detected:
   - Task is marked with `status: 'awaiting_clarification'`
   - 1-3 clarification questions are generated
   - Execution is paused
   - Questions are presented to the user

3. When user responds:
   - Chloe will need to process the response (future enhancement)
   - Task can be restarted with the clarified information
   - Normal execution flow resumes

## Benefits

- **Quality Improvement**: Prevents execution of ambiguous or underspecified tasks
- **User Experience**: Provides clear, targeted questions rather than executing incorrectly
- **Efficiency**: Reduces rework by getting clarification early in the process
- **Confidence**: Allows Chloe to express uncertainty and get help when needed

## Future Enhancements

1. Add a mechanism to process user responses to clarification questions
2. Implement retry logic after clarification is received
3. Add an option to save and restore tasks awaiting clarification
4. Expand detection to more sophisticated language patterns
5. Add confidence levels per sub-goal in the task breakdown 