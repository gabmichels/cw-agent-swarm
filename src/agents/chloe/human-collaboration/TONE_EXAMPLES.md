# Stakeholder-Aware Tone Adjustment Examples

This document demonstrates how Chloe's communication changes based on stakeholder profiles.

## Stakeholder Profile Attributes

The `StakeholderProfile` interface supports the following attributes:

| Attribute | Values | Effect |
|-----------|--------|--------|
| `tone` | "formal", "casual", "neutral" | Adjusts language formality (vocabulary, contractions, salutations) |
| `expertiseLevel` | "beginner", "intermediate", "expert" | Adjusts technical depth and explanations |
| `preferredFormat` | "concise", "detailed" | Adjusts level of detail and message length |
| `language` | String code (e.g., "en") | Language preference (foundation for future multilingual support) |

## Examples of Tone Adjustments

### Clarification Requests

#### Original Message
```
I need to clarify some aspects of this task before proceeding:

1. Could you provide a value for the "timeframe" parameter?
2. Could you clarify what you mean by "reach key stakeholders"?

Please provide more information so I can proceed with confidence.
```

#### For Formal Executive (C-Level)
```
Dear Stakeholder,

I require clarification regarding certain aspects of this task before proceeding:

1. Would you kindly provide a value for the "timeframe" parameter?
2. Would you kindly clarify what you mean by "reach key stakeholders"?

Please provide additional information so I can proceed with confidence.

Kind regards,
Chloe
```

#### For Casual Team Member
```
Hey! 

I need to clear up a couple things before I get started:

1. Can you tell me what timeframe you're thinking?
2. What do you mean by "reach key stakeholders"?

Let me know so I can get this right!

Cheers,
Chloe
```

#### For Technical Expert (Concise)
```
Need clarification:

1. Timeframe value?
2. Define "reach key stakeholders"
```

### Approval Requests

#### Original Message
```
This task requires approval before execution:

**Task**: Create and publish a blog post on recent market trends

**Goal**: Increase thought leadership presence in the industry

**Reason for approval**: This task involves posting content externally
```

#### For Formal Stakeholder
```
Dear Stakeholder,

This task requires approval prior to execution:

**Task**: Create and publish a blog post on recent market trends

**Goal**: Increase thought leadership presence in the industry

**Reason for approval**: This task involves posting content externally to organizational channels

Kindly provide your authorization to proceed with this task.

Kind regards,
Chloe
```

#### For Beginner (Detailed Format)
```
Hey! 

I need your approval before I can do this task:

**Task**: Create and publish a blog post (an article for our website) on recent market trends

**Goal**: Increase thought leadership presence in the industry (help us be seen as experts)

**Reason for approval**: This task involves posting content externally (putting things on public websites). Don't worry, I'll guide you through this.

Please let me know if I can go ahead with this! 

Cheers,
Chloe

Please note that providing detailed information helps ensure the task is completed correctly and efficiently.
```

## How Profiles Are Injected

Stakeholder profiles can be injected into the system in three ways:

1. **Task-level**: By setting `task.stakeholderProfile` directly with `setStakeholderProfile()` function
2. **Per request**: By passing a profile to individual message formatter functions
3. **Default fallback**: Using `DEFAULT_PROFILE` when no specific profile is provided

The implementation allows dynamic profile changes between requests, enabling Chloe to adapt her communication style based on the current audience.

## Supported Profile Attributes and Their Uses

### Tone ("formal", "casual", "neutral")
- Formal: Uses complete sentences, avoids contractions, adds salutations, uses more sophisticated vocabulary
- Casual: Uses contractions, informal greetings, simpler vocabulary, more direct language
- Neutral: Balanced approach suitable for most business communications

### Expertise Level ("beginner", "intermediate", "expert")
- Beginner: Adds explanations for technical terms, includes reassurances, simplifies concepts
- Intermediate: Standard level of detail, balanced explanations
- Expert: Removes redundant explanations, assumes domain knowledge, focuses on specifics

### Preferred Format ("concise", "detailed")
- Concise: Removes filler words, shortens sentences, focuses on key information
- Detailed: Expands content with examples, additional context, and explanations

## Integration Points

The stakeholder-aware tone system is integrated at these key points:

1. **PlannedTask Interface**: Extended to include optional `stakeholderProfile`
2. **Message Generation**: All user-facing messages use the tone adjustment system
3. **Clarification Requests**: Questions are adjusted based on stakeholder profile
4. **Approval Requests**: Approval messages are adjusted for the intended audience 