# Agent Managers and Capabilities

This document provides a comprehensive overview of all manager types and capabilities in the agent system.

## Overview

Agents in the system are powered by specialized "managers" that handle different aspects of agent functionality. Each manager provides a specific set of capabilities to the agent, and together they form a complete agent system with diverse capabilities.

## Available Manager Types

The system supports the following manager types:

| Manager Type | Description | Interface | Primary Implementation |
|-------------|-------------|-----------|------------------------|
| `MEMORY` | Manages agent memory storage, retrieval, and processing | `MemoryManager` | `DefaultMemoryManager` |
| `PLANNING` | Handles plan creation, execution, and adaptation | `PlanningManager` | `DefaultPlanningManager` |
| `TOOL` | Manages agent tools and tool execution | `ToolManager` | `DefaultToolManager` |
| `KNOWLEDGE` | Manages structured knowledge and knowledge graph | `KnowledgeManager` | `DefaultKnowledgeManager` |
| `REFLECTION` | Enables self-assessment and reflection capabilities | `ReflectionManager` | `DefaultReflectionManager` |
| `SCHEDULER` | Manages task scheduling and execution | `SchedulerManager` | `DefaultSchedulerManager` |
| `INPUT` | Processes and validates input messages | `InputProcessor` | `DefaultInputProcessor` |
| `OUTPUT` | Formats and delivers output messages | `OutputProcessor` | `DefaultOutputProcessor` |
| `AUTONOMY` | Controls autonomous behavior and goal-driven actions | `AutonomyManager` | `DefaultAutonomyManager` |
| `MESSAGING` | Handles inter-agent communication | `MessagingManager` | `(Placeholder)` |
| `LOGGER` | Provides specialized logging capabilities | `LoggerManager` | `(Placeholder)` |
| `FILE_PROCESSING` | Manages file operations | `FileProcessingManager` | `FileProcessingManager` |
| `RESOURCE` | Manages and monitors resource utilization | `ResourceManager` | `DefaultResourceManager` |
| `INTEGRATION` | Handles external service integrations | `IntegrationManager` | `(Placeholder)` |
| `STATUS` | Tracks and reports agent status | `StatusManager` | `StatusManager` |
| `NOTIFICATION` | Manages notifications and delivery across channels | `NotificationManager` | `DefaultNotificationManager` |

## Key Capabilities

Agents equipped with all managers have the following capabilities:

- **Memory Management**: Store, retrieve, and process agent memories
- **Planning**: Create, execute, and adapt complex plans
- **Tool Usage**: Discover, register, and use various tools
- **Knowledge Management**: Maintain and query structured knowledge
- **Reflection**: Self-assess and improve based on past performance
- **Task Scheduling**: Schedule and execute tasks with priority handling
- **Input Processing**: Process and validate different types of input
- **Output Formatting**: Format and customize agent responses
- **Autonomy**: Operate independently with goal-directed behavior
- **Resource Management**: Monitor and optimize resource usage
- **Status Tracking**: Track and report agent status
- **File Operations**: Process and manage files
- **Notifications**: Send and manage notifications across different channels

## Manager Configuration

Each manager type accepts specific configuration options that modify its behavior. Here's a brief overview of key configuration options:

### Memory Manager
```typescript
{
  enabled: true,
  createPrivateScope: true,
  defaultScopeName: string,
  enableAutoPruning: boolean,
  enableAutoConsolidation: boolean,
  pruningIntervalMs: number,
  consolidationIntervalMs: number,
  maxMemoryItems: number
}
```

### Planning Manager
```typescript
{
  enabled: true,
  maxPlans: number,
  enablePlanOptimization: boolean,
  enablePlanAdaptation: boolean,
  enablePlanValidation: boolean
}
```

### Tool Manager
```typescript
{
  enabled: true,
  maxTools: number,
  enableAutoDiscovery: boolean,
  allowUnsafeTool: boolean
}
```

### Scheduler Manager
```typescript
{
  enabled: true,
  maxConcurrentTasks: number,
  maxRetryAttempts: number,
  defaultTaskTimeoutMs: number,
  enableAutoScheduling: boolean,
  schedulingIntervalMs: number,
  enableTaskPrioritization: boolean
}
```

### Autonomy Manager
```typescript
{
  enabled: true,
  autonomyConfig: {
    enableAutonomyOnStartup: boolean,
    enableOpportunityDetection: boolean,
    maxConcurrentTasks: number
  }
}
```

### Notification Manager
```typescript
{
  defaultSenderId: string,
  defaultTtl?: number,
  channels?: ChannelConfig[],
  globalRateLimit?: {
    maxNotifications: number,
    period: number
  }
}
```

## Using Managers

Managers can be accessed from an agent instance using the `getManager` method:

```typescript
const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
const schedulerManager = agent.getManager<SchedulerManager>(ManagerType.SCHEDULER);
```

## Creating Fully Capable Agents

To ensure an agent has all necessary capabilities, all manager types should be instantiated and registered with the agent during initialization. The `bootstrap-agents.ts` file contains implementation for creating fully capable agents with all manager types.

## Manager Implementation Status

- **Fully Implemented**: Memory, Planning, Tool, Knowledge, Scheduler, Autonomy, Input, Output, Status, Resource, Reflection, File Processing
- **Partially Implemented**: Notification
- **Placeholder Only**: Messaging, Logger, Integration

## Future Roadmap

- Complete implementation of placeholder managers
- Add additional specialized managers for:
  - Ethical reasoning
  - Multi-agent coordination
  - Learning and adaptation
  - External API management 