# Ethics and Bias Oversight Module

This module provides an ethical governance layer for the agent core platform. It ensures that agent outputs are checked against configurable ethics policies before being delivered.

## Components

### 1. EthicsPolicy

A configurable registry of ethics rules. Each rule includes:
- A unique identifier
- Human-readable description
- Severity level
- Test function to detect violations

### 2. BiasAuditor

Executes ethics rules against content and reports violations:
- Scans text for rule violations
- Logs violations to the AgentMonitor
- Generates human-readable violation reports

### 3. EthicsMiddleware

Enforces ethics policies at key integration points:
- Hooks into Planner and ToolRouter
- Configurable blocking/modification of unethical content
- Support for rule overrides and escalation paths

## Integration Points

The module is integrated at two critical points:

1. **Planning Stage**: All plans generated by the Planner are checked before execution.
2. **Tool Execution**: All tool outputs are validated before being returned to agents.

## Configuration Options

The ethics middleware can be configured with several options:

- `blockOutput`: Block output with violations
- `blockThreshold`: Severity threshold for blocking
- `attemptAutoFix`: Automatically modify content to address violations
- `ignoredRuleIds`: Rules to ignore (for overrides)
- `enableEscalation`: Escalate high-severity violations

## Adding Custom Rules

You can extend the ethics policy with custom rules:

```typescript
import { addEthicsRule } from './ethics';

addEthicsRule({
  id: 'my-custom-rule',
  description: 'Avoid specific problematic patterns',
  severity: 'high',
  test: (content) => /pattern-to-detect/i.test(content)
});
```

## Usage Example

```typescript
import { enforceEthics } from './ethics';

// Check content against ethics rules
const { output, violations, wasBlocked } = await enforceEthics({
  agentId: 'agent-123',
  taskId: 'task-456',
  output: 'Content to check',
  options: {
    blockOutput: true,
    blockThreshold: 'high'
  }
});

// Handle any violations
if (violations && violations.length > 0) {
  console.log('Ethics violations detected:', violations);
}
```

## Monitoring and Auditing

All ethics violations are logged to the AgentMonitor with:
- Rule ID and description
- Severity level
- Content snippet containing the violation
- Agent and task context 