# Human Collaboration System

The Human Collaboration system provides advanced capabilities for agents to effectively collaborate with human users, including:

1. **Stakeholder-aware communication**
2. **Approval management**
3. **Correction handling**
4. **Clarification workflows**

## Overview

The system enables agents to adapt their communication style to different stakeholders, manage approval workflows for sensitive operations, learn from corrections, and determine when clarification is needed.

## Key Components

### 1. Stakeholder Profiles

Stakeholder profiles allow the system to adjust communication based on:

- **Tone**: Formal, casual, or neutral
- **Expertise Level**: Beginner, intermediate, or expert
- **Format Preference**: Concise or detailed
- **Language**: Preferred language

```typescript
// Example of a stakeholder profile
const executiveProfile = {
  id: "executive",
  name: "Executive Team",
  tone: "formal",
  expertiseLevel: "intermediate",
  preferredFormat: "concise",
  language: "en"
};
```

### 2. Approval System

The approval system manages when human approval is required before certain operations:

- **Rule-based**: Configurable rules determine when approval is needed
- **Approval levels**: Different levels of approval (standard, admin-only, multi-person)
- **History tracking**: Complete audit trail of approval requests and decisions

```typescript
// Example of approval check
const approvalResult = humanCollaboration.checkIfApprovalRequired(task);
if (approvalResult.required) {
  const message = humanCollaboration.formatApprovalRequest(task, userProfile);
  // ... send message to user and await approval
}
```

### 3. Correction Handling

The correction system enables learning from human corrections:

- **Categorization**: Automatically categorizes corrections by type
- **Pattern detection**: Identifies patterns in past corrections
- **Memory integration**: Stores corrections for future reference
- **Insight generation**: Extracts insights from corrections

### 4. Clarification Workflows

The clarification system helps agents determine when to ask for more information:

- **Confidence assessment**: Detects low confidence in task understanding
- **Ambiguity detection**: Identifies ambiguous phrases or missing parameters
- **Question generation**: Creates clear, relevant questions
- **Format adaptation**: Adjusts questions to stakeholder profiles

## Usage Examples

### Basic Usage

```typescript
import { humanCollaboration } from '../agents/shared/collaboration';

// Check if a task needs clarification
const needsClarification = await humanCollaboration.checkNeedClarification(task);
if (needsClarification) {
  const questions = await humanCollaboration.generateClarificationQuestions(task);
  const message = humanCollaboration.formatClarificationRequest(task, questions);
  // ... send message to user
}
```

### Stakeholder-Adjusted Communication

```typescript
import { humanCollaboration } from '../agents/shared/collaboration';

// Create a stakeholder profile for a technical expert
const expertProfile = {
  id: "tech-expert",
  tone: "neutral",
  expertiseLevel: "expert",
  preferredFormat: "detailed",
  language: "en"
};

// Apply the profile to a task
const taskWithProfile = humanCollaboration.setStakeholderProfile(task, expertProfile);

// Generate communication adjusted for this stakeholder
const message = humanCollaboration.formatStatusUpdate(taskWithProfile, {
  progress: "75%",
  status: "In progress",
  nextSteps: "Implementing database optimization"
});
```

## Integration with AgentBase

The Human Collaboration system integrates with the AgentBase architecture, providing collaborative capabilities to any agent in the system. 