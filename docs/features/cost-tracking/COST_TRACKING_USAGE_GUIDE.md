# Cost Tracking System - Usage Guide

## Overview

The Cost Tracking System provides comprehensive monitoring and analysis of costs across all tools, APIs, and external workflows in the Agent Swarm platform. It tracks costs for:

- **Apify Tools**: Web scraping, social media scraping, data extraction
- **OpenAI API**: Chat completions, embeddings, function calls
- **External Workflows**: N8N, Zapier, Make, Power Automate
- **Deep Research**: Multi-step research operations
- **Infrastructure**: Vector database, storage, compute

## Quick Start

### 1. Initialize Cost Tracking

```typescript
import { PrismaClient } from '@prisma/client';
import { getCostTrackingManager } from '../services/cost-tracking/CostTrackingManager';

const prisma = new PrismaClient();
const costManager = getCostTrackingManager(prisma);
```

### 2. Track Apify Tool Usage

```typescript
// Example: Track Reddit search cost
const result = await apifyManager.runRedditSearch('AI trends', false, 10);

await costManager.apify.trackRedditSearch({
  query: 'AI trends',
  limit: 10,
  result: result,
  executionTimeMs: 5000,
  initiatedBy: {
    type: 'agent',
    id: 'agent-123',
    name: 'Research Agent'
  },
  sessionId: 'session-456',
  departmentId: 'marketing'
});
```

### 3. Track OpenAI API Usage

```typescript
// Example: Track chat completion cost
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Analyze this data...' }]
});

await costManager.openai.trackCompletion({
  model: 'gpt-4',
  inputTokens: completion.usage?.prompt_tokens || 0,
  outputTokens: completion.usage?.completion_tokens || 0,
  operation: 'data_analysis',
  initiatedBy: {
    type: 'user',
    id: 'user-789',
    name: 'John Doe'
  },
  sessionId: 'session-456',
  departmentId: 'analytics'
});
```

### 4. Track Workflow Execution

```typescript
// Example: Track N8N workflow execution
await costManager.workflows.trackN8NExecution({
  workflowId: 'wf-001',
  workflowName: 'Lead Processing Workflow',
  executionId: 'exec-123',
  success: true,
  executionTimeMs: 12000,
  nodesExecuted: 8,
  initiatedBy: {
    type: 'system',
    id: 'system',
    name: 'Automation System'
  },
  sessionId: 'session-456',
  departmentId: 'sales'
});
```

## Advanced Usage

### Cost Estimation Before Execution

```typescript
// Estimate Apify cost before execution
const apifyEstimate = costManager.apify.estimateApifyCost({
  toolName: 'apify-reddit-search',
  expectedResults: 50,
  estimatedTimeMs: 30000
});

console.log(`Estimated cost: $${apifyEstimate.estimatedCost.toFixed(4)}`);
console.log(`Cost tier: ${apifyEstimate.costTier}`);

// Estimate OpenAI cost before execution
const openaiEstimate = costManager.openai.estimateCompletionCost({
  model: 'gpt-4',
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500
});

console.log(`Estimated cost: $${openaiEstimate.estimatedCost.toFixed(4)}`);
```

### Cost Summaries and Reporting

```typescript
// Get cost summary for the last month
const summary = await costManager.getCostSummary({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  departmentId: 'marketing'
});

console.log(`Total cost: $${summary.totalCostUsd.toFixed(2)}`);
console.log(`Operations: ${summary.totalOperations}`);
console.log(`Top cost drivers:`, summary.topCostDrivers);
```

### Budget Management

```typescript
// Create a monthly budget for marketing department
const budget = await costManager.createBudget({
  name: 'Marketing Q1 2024',
  period: 'monthly',
  budgetUsd: 500.00,
  spentUsd: 0,
  remainingUsd: 500.00,
  utilizationPercent: 0,
  categories: ['apify_tools', 'openai_api'],
  departmentId: 'marketing',
  alertThresholds: {
    warning: 75,
    critical: 90,
    maximum: 100
  },
  status: 'active',
  autoActions: {
    onWarning: 'notify',
    onCritical: 'throttle',
    onMaximum: 'block'
  },
  validFrom: new Date('2024-01-01'),
  validTo: new Date('2024-03-31')
});
```

### Cost Alerts

```typescript
// Create a cost spike alert
const alert = await costManager.createAlert({
  name: 'High Apify Usage Alert',
  type: 'cost_spike',
  conditions: {
    categories: ['apify_tools'],
    costThresholdUsd: 50.00,
    percentageIncrease: 200,
    timeWindow: 'day'
  },
  severity: 'warning',
  enabled: true,
  cooldownMinutes: 60,
  notifications: {
    email: ['admin@company.com'],
    slack: ['#alerts-channel']
  }
});
```

## Integration Examples

### Integrating with Existing Apify Manager

```typescript
// Modify existing Apify tool to include cost tracking
export class EnhancedApifyManager extends DefaultApifyManager {
  constructor(private costManager: CostTrackingManager) {
    super();
  }

  async runRedditSearch(
    query: string, 
    dryRun = false, 
    maxResults = 10,
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string },
    sessionId?: string,
    departmentId?: string
  ): Promise<ApifyToolResult> {
    const startTime = Date.now();
    
    // Execute the original operation
    const result = await super.runRedditSearch(query, dryRun, maxResults);
    
    const executionTime = Date.now() - startTime;
    
    // Track the cost
    await this.costManager.apify.trackRedditSearch({
      query,
      limit: maxResults,
      result,
      executionTimeMs: executionTime,
      initiatedBy,
      sessionId,
      departmentId
    });
    
    return result;
  }
}
```

### Integrating with OpenAI Wrapper

```typescript
// Create a cost-aware OpenAI wrapper
export class CostTrackingOpenAI {
  constructor(
    private openai: OpenAI,
    private costManager: CostTrackingManager
  ) {}

  async createChatCompletion(
    params: ChatCompletionCreateParams,
    metadata: {
      operation: string;
      initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
      sessionId?: string;
      departmentId?: string;
    }
  ) {
    const completion = await this.openai.chat.completions.create(params);
    
    // Track the cost
    await this.costManager.openai.trackCompletion({
      model: params.model,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      operation: metadata.operation,
      initiatedBy: metadata.initiatedBy,
      sessionId: metadata.sessionId,
      departmentId: metadata.departmentId
    });
    
    return completion;
  }
}
```

## API Endpoints

### Get Cost Summary

```bash
GET /api/cost-tracking/summary?startDate=2024-01-01&endDate=2024-01-31&departmentId=marketing
```

Response:
```json
{
  "success": true,
  "data": {
    "totalCostUsd": 125.45,
    "totalOperations": 1250,
    "averageCostPerOperation": 0.1004,
    "byCategory": {
      "apify_tools": 75.30,
      "openai_api": 45.15,
      "n8n_workflows": 5.00
    },
    "byService": {
      "apify": 75.30,
      "openai": 45.15,
      "n8n": 5.00
    },
    "topCostDrivers": [
      {
        "service": "apify",
        "operation": "reddit_search",
        "cost": 35.20,
        "percentage": 28.05
      }
    ]
  }
}
```

### Create Budget

```bash
POST /api/cost-tracking/budgets
Content-Type: application/json

{
  "name": "Marketing Q1 2024",
  "period": "monthly",
  "budgetUsd": 500.00,
  "categories": ["apify_tools", "openai_api"],
  "departmentId": "marketing",
  "alertThresholds": {
    "warning": 75,
    "critical": 90,
    "maximum": 100
  },
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": "2024-03-31T23:59:59Z"
}
```

## Best Practices

### 1. Always Include Context

```typescript
// Good: Include all relevant context
await costManager.apify.trackWebSearch({
  query: 'competitor analysis',
  limit: 20,
  result,
  executionTimeMs: 8000,
  initiatedBy: {
    type: 'agent',
    id: 'research-agent-001',
    name: 'Market Research Agent'
  },
  sessionId: 'research-session-123',
  departmentId: 'marketing'
});

// Bad: Missing context
await costManager.apify.trackWebSearch({
  query: 'search',
  limit: 10,
  result,
  executionTimeMs: 5000,
  initiatedBy: { type: 'agent', id: 'agent' }
});
```

### 2. Use Consistent Naming

```typescript
// Use consistent operation names
const operations = {
  COMPETITOR_RESEARCH: 'competitor_research',
  LEAD_GENERATION: 'lead_generation',
  CONTENT_ANALYSIS: 'content_analysis',
  MARKET_INTELLIGENCE: 'market_intelligence'
};
```

### 3. Set Up Monitoring and Alerts

```typescript
// Set up comprehensive monitoring
const alerts = [
  {
    name: 'Daily Cost Spike',
    type: 'cost_spike',
    conditions: { costThresholdUsd: 100, timeWindow: 'day' },
    severity: 'warning'
  },
  {
    name: 'Budget Threshold',
    type: 'budget_threshold',
    conditions: { percentageIncrease: 80 },
    severity: 'critical'
  }
];

for (const alertConfig of alerts) {
  await costManager.createAlert(alertConfig);
}
```

### 4. Regular Cost Reviews

```typescript
// Weekly cost review automation
async function weeklyReview() {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  
  const summary = await costManager.getCostSummary({
    startDate: lastWeek,
    endDate: now
  });
  
  const optimizations = await costManager.getOptimizationRecommendations({
    startDate: lastWeek,
    endDate: now,
    minSavings: 5.00
  });
  
  // Send report to stakeholders
  await sendCostReport(summary, optimizations);
}
```

## Troubleshooting

### Common Issues

1. **Missing Cost Data**: Ensure all tool executions include cost tracking calls
2. **Incorrect Estimates**: Update cost configurations based on actual usage
3. **Performance Impact**: Cost tracking is designed to be non-blocking
4. **Data Consistency**: Use transactions for critical cost recording operations

### Error Handling

```typescript
try {
  await costManager.apify.trackWebSearch(params);
} catch (error) {
  // Cost tracking failures should not break main operations
  logger.warn('Cost tracking failed', { error: error.message, params });
  // Continue with main operation
}
```

## Migration Guide

### From Legacy Cost Tracking

```typescript
// Old approach
function recordCost(tool: string, cost: number) {
  // Simple cost recording
}

// New approach
await costManager.apify.trackActorExecution({
  actorId: 'apify/web-scraper',
  toolName: 'web-scraper',
  operation: 'web_scraping',
  input: { url: 'example.com' },
  result: result,
  executionTimeMs: 5000,
  initiatedBy: { type: 'agent', id: 'agent-123' },
  sessionId: 'session-456'
});
```

This comprehensive cost tracking system provides complete visibility into your platform's operational costs while enabling proactive cost management and optimization. 