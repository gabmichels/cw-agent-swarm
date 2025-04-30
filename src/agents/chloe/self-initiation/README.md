# Chloe Self-Initiation System

A comprehensive system that enables Chloe to proactively identify opportunities and schedule her own tasks without human triggering.

## Overview

The Chloe Self-Initiation System consists of two primary components:

1. **Opportunity Detection Engine** - Continuously monitors various data sources to identify potential tasks
2. **Autonomous Scheduler** - Allows Chloe to schedule and execute her own tasks based on detected opportunities

This system enhances Chloe's autonomy by enabling her to identify tasks and take action proactively, rather than only responding to human requests.

## Components

### Opportunity Detection Engine

The Opportunity Detection Engine monitors various data sources to identify potential tasks:

- Calendar events (meetings, deadlines)
- Market data (trends, anomalies)
- News feeds (competitor movements, industry updates)
- Memory patterns (recurring topics, strategic insights)
- Recurring cycles (weekly/monthly tasks)

Each detected opportunity is scored for confidence, strategic importance, and time sensitivity.

### Autonomous Scheduler

The Autonomous Scheduler creates and schedules tasks based on detected opportunities:

- Integrates with Chloe's existing scheduler system
- Balances autonomous tasks with human-directed tasks
- Provides human oversight through approval gates
- Self-monitors performance and adjusts confidence thresholds

## Usage

### Basic Integration

```typescript
import { ChloeSelfInitiationSystem } from './agents/chloe/self-initiation';
import { ChloeAgent } from './agents/chloe/core/agent';

// Get agent instance
const agent = new ChloeAgent();

// Create self-initiation system
const selfInitSystem = new ChloeSelfInitiationSystem(agent);

// Initialize and start the system
await selfInitSystem.initialize({
  autoStart: true,
  requireApproval: true  // Require human approval for autonomous tasks
});
```

### Strategic Planner Integration

For better task prioritization, connect the system to Chloe's Strategic Planner:

```typescript
import { StrategicToolPlanner } from './agents/chloe/strategy/strategicPlanner';
import { ChloeSelfInitiationSystem } from './agents/chloe/self-initiation';

// Create strategic planner
const strategicPlanner = new StrategicToolPlanner({ 
  model: llmModel,
  businessGoals: ["Increase market share", "Improve customer satisfaction"]
});

// Connect to self-initiation system
selfInitSystem.setStrategicPlanner(strategicPlanner);
```

### Human Oversight

The system provides methods for human oversight and approval:

```typescript
// Get pending autonomous tasks
const pendingTasks = selfInitSystem.getAutonomousScheduler().getTasks({ status: 'pending' });

// Approve a specific task
selfInitSystem.getAutonomousScheduler().approveTask('task-id-123');

// Reject a specific task
selfInitSystem.getAutonomousScheduler().rejectTask('task-id-456');

// Request approval for all pending tasks (sends notifications)
await selfInitSystem.requestApproval();
```

### System Status

Monitor the system's status and performance:

```typescript
// Get system status
const status = selfInitSystem.getStatus();
console.log(`System active: ${status.isActive}`);
console.log(`Pending tasks: ${status.pendingTasks}`);
console.log(`Success rate: ${status.performanceMetrics.successRate}`);

// Start or stop the system
selfInitSystem.start();  // Start system
selfInitSystem.stop();   // Stop system
```

## Configuration Options

The self-initiation system can be configured with these options:

| Option | Description | Default |
|--------|-------------|---------|
| `autoStart` | Automatically start the system on initialization | `false` |
| `requireApproval` | Require human approval for autonomous tasks | `true` |
| `strategicPlanner` | StrategicToolPlanner instance for task scoring | `null` |

## Architecture

The system follows these patterns:

1. **Observer Pattern** - Event listeners for different data sources
2. **Strategy Pattern** - Different detection strategies for different opportunity types
3. **Factory Pattern** - Creation of appropriate task types for different opportunities

## Fallback Mechanisms

The system includes several fallback mechanisms:

- Auto-disabling if success rate falls below threshold
- Capacity awareness to prevent overcommitment
- Error handling and logging of autonomous decisions
- Human notification for critical issues

## Extension

To add new opportunity types, extend the system as follows:

1. Add a new detection method in `OpportunityDetector`
2. Register a new event listener in the constructor
3. Implement the detection logic
4. Add appropriate filters and metadata

---

For more information, see the source code and unit tests in the `src/agents/chloe/self-initiation` directory. 