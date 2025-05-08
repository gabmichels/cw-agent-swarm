# Human Approval Workflow Architecture Diagrams

## System Overview

The Human Approval Workflow provides a flexible, rule-based system for defining and enforcing approval requirements throughout the agent system. 

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                   Human Approval Workflow System                 │
│                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐      ┌───────────┐ │
│  │                 │      │                 │      │           │ │
│  │  Configuration  │◄────►│   Evaluation    │◄────►│  History  │ │
│  │    Management   │      │      Engine     │      │  Tracking │ │
│  │                 │      │                 │      │           │ │
│  └─────────────────┘      └─────────────────┘      └───────────┘ │
│           ▲                       ▲                      ▲       │
└───────────┼───────────────────────┼──────────────────────┼───────┘
            │                       │                      │
            ▼                       ▼                      ▼
┌──────────────────┐     ┌────────────────────┐    ┌──────────────┐
│                  │     │                    │    │              │
│  Task Planning   │     │  Task Execution    │    │   Reporting  │
│     System       │     │     System         │    │    System    │
│                  │     │                    │    │              │
└──────────────────┘     └────────────────────┘    └──────────────┘
```

## Component Architecture

The Human Approval Workflow consists of several integrated components:

```
┌─────────────────────────────────────────────────────────────────┐
│                 ApprovalConfigurationManager                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │             │    │              │    │                   │  │
│  │  Rule       │    │  Approval    │    │  History          │  │
│  │  Management │    │  Level       │    │  Management       │  │
│  │             │    │  Management  │    │                   │  │
│  └─────────────┘    └──────────────┘    └───────────────────┘  │
│                                                                 │
│  ┌─────────────────────────┐    ┌───────────────────────────┐  │
│  │                         │    │                           │  │
│  │  Approval Evaluation    │    │  Import/Export            │  │
│  │                         │    │  Functionality            │  │
│  └─────────────────────────┘    └───────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
               ▲
               │ provides services to
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Human Collaboration                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐    ┌────────────────┐    ┌────────────┐  │
│  │                   │    │                │    │            │  │
│  │  Approval         │    │  Message       │    │  Decision  │  │
│  │  Requirements     │    │  Formatting    │    │  Handling  │  │
│  │                   │    │                │    │            │  │
│  └───────────────────┘    └────────────────┘    └────────────┘  │
│                                                                 │
│  ┌────────────────────────────┐    ┌──────────────────────────┐ │
│  │                            │    │                          │ │
│  │  Clarification             │    │  Stakeholder             │ │
│  │  Detection                 │    │  Profile Integration     │ │
│  │                            │    │                          │ │
│  └────────────────────────────┘    └──────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
               ▲
               │ used by
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Execution System                       │
└─────────────────────────────────────────────────────────────────┘
```

## Approval Processing Flow

This diagram illustrates the flow of approval processing within the system:

```
┌──────────┐     ┌─────────────┐     ┌───────────────┐
│          │     │             │     │               │
│   Task   │────►│  Approval   │────►│  Execution    │
│ Creation │     │  Evaluation │ No  │               │
│          │     │  Required?  │     │               │
└──────────┘     └─────┬───────┘     └───────────────┘
                       │ Yes
                       ▼
              ┌─────────────────┐     ┌───────────────┐
              │                 │     │               │
              │  Generate       │────►│  User         │
              │  Approval       │     │  Interface    │
              │  Request        │     │               │
              └─────────────────┘     └───────┬───────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │                 │
                                    │  User Decision  │
                                    │                 │
                                    └────────┬────────┘
                                             │
                      ┌────────────────────┐ │ ┌────────────────────┐
                      │                    │ │ │                    │
                      │   Abort/Reject     │◄─┴─►   Approve         │
                      │                    │   │                    │
                      └────────┬───────────┘   └──────────┬─────────┘
                               │                          │
                               ▼                          ▼
                     ┌───────────────────┐     ┌───────────────────┐
                     │                   │     │                   │
                     │  Record Rejection │     │  Record Approval  │
                     │                   │     │                   │
                     └─────────┬─────────┘     └─────────┬─────────┘
                               │                         │
                               ▼                         ▼
                     ┌───────────────────┐     ┌───────────────────┐
                     │                   │     │                   │
                     │   Task Aborted    │     │  Resume Task      │
                     │                   │     │  Execution        │
                     └───────────────────┘     └───────────────────┘
```

## Integration with Task Execution System

The approval system integrates directly with the task execution flow:

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Task Execution System                           │
│                                                                        │
│  ┌──────────┐      ┌───────────┐      ┌──────────────┐      ┌────────┐ │
│  │          │      │           │      │              │      │        │ │
│  │  Decide  │─────►│  Execute  │─────►│  Reflect     │─────►│ Finalize│ │
│  │  Next    │      │  Step     │      │  Progress    │      │        │ │
│  │  Step    │◄─────│           │◄─────│              │◄─────│        │ │
│  │          │      │           │      │              │      │        │ │
│  └──────────┘      └─────┬─────┘      └──────────────┘      └────────┘ │
│                          │                                              │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
                           │ Approval check
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Human Approval System                           │
│                                                                        │
│  ┌──────────────┐      ┌────────────────┐      ┌─────────────────────┐ │
│  │              │      │                │      │                     │ │
│  │  Check       │─────►│  Record        │─────►│  Format            ││ │
│  │  Approval    │      │  Approval      │      │  Approval          ││ │
│  │  Required    │      │  Request       │      │  Request           ││ │
│  │              │      │                │      │                     │ │
│  └──────────────┘      └────────────────┘      └─────────────────────┘ │
│           ▲                    ▲                          │            │
└───────────┼────────────────────┼──────────────────────────┼────────────┘
            │                    │                          │
            │                    │                          ▼
┌───────────┴────────────────────┴──────────────────────────┴────────────┐
│                                                                        │
│                         User Interface                                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────┐     ┌─────────────┐     ┌────────────┐     ┌────────────┐
│          │     │             │     │            │     │            │
│   Task   │────►│  Approval   │────►│  Approval  │────►│  History   │
│   Data   │     │  Rules      │     │  Decision  │     │  Storage   │
│          │     │             │     │            │     │            │
└──────────┘     └─────────────┘     └────────────┘     └────────────┘
      │                 ▲                  ▲                  │
      │                 │                  │                  │
      │                 ▼                  │                  ▼
      │          ┌─────────────┐           │           ┌────────────┐
      │          │             │           │           │            │
      └─────────►│  Rule       │           └───────────│  Reporting │
                 │  Config     │                       │  System    │
                 │             │                       │            │
                 └─────────────┘                       └────────────┘
```

## Rule Evaluation Process

```
┌─────────────────┐
│                 │
│  Get All Rules  │
│                 │
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│                    │
│  Sort By Priority  │
│                    │
└────────┬───────────┘
         │
         ▼
┌────────────────────────┐     ┌─────────────────┐
│                        │     │                 │
│ Evaluate First Rule    │─Yes─► Return Required │
│ Condition Matches?     │     │                 │
│                        │     └─────────────────┘
└────────┬───────────────┘
         │ No
         ▼
┌────────────────────────┐
│                        │
│ Evaluate Next Rule     │
│                        │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐     ┌─────────────────┐
│                        │     │                 │
│ Any Rules Left?        │─No──► Return Not      │
│                        │     │ Required        │
└────────────────────────┘     │                 │
                               └─────────────────┘
```

## System Class Diagram

```
┌────────────────────────────┐
│ ApprovalConfigurationManager │
├────────────────────────────┤
│ - rules: Map<string, Rule>  │
│ - levels: Map<string, Level>│
│ - history: HistoryEntry[]   │
├────────────────────────────┤
│ + getInstance()            │
│ + addRule()                │
│ + removeRule()             │
│ + getAllRules()            │
│ + addLevel()               │
│ + removeLevel()            │
│ + getAllLevels()           │
│ + checkApprovalRequired()  │
│ + recordApprovalRequest()  │
│ + recordApprovalDecision() │
│ + getApprovalHistory()     │
│ + getTaskApprovalHistory() │
│ + exportApprovalHistory()  │
│ + importApprovalHistory()  │
└────────────┬───────────────┘
             │
             │ uses
             ▼
┌────────────────────────────┐      ┌────────────────────────┐
│      ApprovalRule          │      │     ApprovalLevel      │
├────────────────────────────┤      ├────────────────────────┤
│ + id: string               │      │ + id: string           │
│ + name: string             │      │ + name: string         │
│ + description: string      │      │ + description: string  │
│ + condition: Function      │      │ + requiredApprovers: # │
│ + priority: number         │      │ + allowedApproverRoles │
│ + enabled: boolean         │      │ + expiresAfter: number │
│ + createdAt: Date          │      │ + enabled: boolean     │
│ + updatedAt: Date          │      │                        │
│ + createdBy: string        │      │                        │
│ + reason: string           │      │                        │
└────────────────────────────┘      └────────────────────────┘

┌────────────────────────────┐      ┌────────────────────────┐
│  ApprovalHistoryEntry      │      │  HumanCollaboration    │
├────────────────────────────┤      ├────────────────────────┤
│ + id: string               │      │ + checkIfApprovalReq.. │
│ + taskId: string           │      │ + formatApprovalReq..  │
│ + subGoalId: string        │      │ + applyApprovalDecision│
│ + taskTitle: string        │      │ + getApprovalHistory   │
│ + requestedAt: Date        │      │                        │
│ + decidedAt: Date          │      │                        │
│ + approved: boolean        │      │                        │
│ + approvedBy: string       │      │                        │
│ + approverRole: string     │      │                        │
│ + reason: string           │      │                        │
│ + notes: string            │      │                        │
│ + ruleId: string           │      │                        │
│ + ruleName: string         │      │                        │
└────────────────────────────┘      └────────────────────────┘
```

## Integration with Planning Graph

The approval system integrates with the planning graph execution flow:

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│                 │     │             │     │             │
│ Planning Node   │────►│ Decide Node │────►│ Execute Node│
│                 │     │             │     │             │
└─────────────────┘     └──────┬──────┘     └──────┬──────┘
                               │                   │
                               │                   │
                               ▼                   ▼
                        ┌─────────────┐     ┌─────────────┐
                        │             │     │             │
                        │ Approval    │     │ Approval    │
                        │ Check       │     │ Check       │
                        │             │     │             │
                        └──────┬──────┘     └──────┬──────┘
                               │                   │
                               │                   │
                               ▼                   ▼
                        ┌─────────────┐     ┌─────────────┐
                        │             │     │             │
                        │ Route:      │     │ Route:      │
                        │ Normal      │     │ Request     │
                        │             │     │ Approval    │
                        └─────────────┘     └─────────────┘
```

## Human Collaboration System Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                     Human Collaboration System                  │
│                                                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────────────┐    │
│  │            │    │            │    │                    │    │
│  │ Approval   │◄──►│Clarification│◄──►│ Stakeholder        │    │
│  │ Workflow   │    │ Detection  │    │ Profile Management │    │
│  │            │    │            │    │                    │    │
│  └─────┬──────┘    └────────────┘    └────────────────────┘    │
│        │                                                        │
└────────┼────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌────────────────────┐
│                    │
│ Autonomous         │
│ Scheduler          │
│                    │
└────────────────────┘
```

These diagrams provide a comprehensive view of the Human Approval Workflow architecture, its components, and its integration with other systems in the agent framework. 