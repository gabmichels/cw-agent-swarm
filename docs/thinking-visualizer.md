# Thinking Visualizer Documentation

## Overview

The Thinking Visualizer is a system for visualizing the cognitive processes of an agent during task execution. It provides transparency into how the agent reasons, retrieves information, selects tools, executes actions, and formulates responses.

## Architecture

The Thinking Visualizer consists of the following main components:

1. **ThinkingVisualizer Service** - Core service that creates, manages, and stores visualization data
2. **ThinkingVisualizer Component** - React component to display visualizations
3. **VisualizationRenderer Component** - Component to render visualization graphs using ReactFlow
4. **API Endpoints** - For fetching and storing visualizations

## Data Model

Visualizations are represented as a graph with nodes and edges:

- **Nodes** represent cognitive steps (thinking, tool execution, insights, etc.)
- **Edges** represent connections between steps

### Node Types

- `START` - Beginning of a processing sequence
- `END` - End of processing
- `THINKING` - Agent's reasoning process
- `TOOL_SELECTION` - Selection of a specific tool
- `TOOL_EXECUTION` - Execution of a selected tool
- `CONTEXT_RETRIEVAL` - Retrieval of relevant context
- `RESPONSE_GENERATION` - Generation of the final response
- `ERROR` - Error handling
- `DELEGATION_DECISION` - Decision to delegate to another agent
- `REFLECTION` - Agent reflection on its actions
- `PLANNING` - Planning of task steps
- `INSIGHT` - Insights generated during processing
- `DECISION` - Decision points

### Edge Types

- `FLOW` - Sequential flow between nodes
- `DEPENDENCY` - Dependency relationship
- `ERROR` - Error connection
- `INFLUENCE` - Influence relationship
- `CAUSE` - Causal relationship

## Usage

### Creating Visualizations

```typescript
import { ThinkingVisualizer } from '@/services/thinking/visualization';
import { MemoryService } from '@/server/memory/services/memory/memory-service';

// Initialize visualizer
const memoryService = new MemoryService(...);
const visualizer = new ThinkingVisualizer(memoryService);

// Create visualization
const visualization = visualizer.initializeVisualization(
  'req-123',           // Request ID
  'user-456',          // User ID
  'agent-789',         // Agent ID
  'chat-abc',          // Chat ID
  'How does X work?',  // User message
  'msg-123'            // Message ID
);

// Add thinking node
const thinkingNodeId = visualizer.addThinkingNode(
  visualization,
  'Analyzing the question',
  'The user is asking about X. I need to provide information about...'
);

// Add tool execution node
const toolNodeId = visualizer.addToolExecutionNode(
  visualization,
  'web_search',
  { query: 'how does X work' },
  { results: [...] },
  'completed'
);

// Add response
visualizer.addResponseNode(
  visualization,
  'X works by...',
  'completed'
);

// Finalize and save
visualizer.finalizeVisualization(visualization, 'X works by...');
await visualizer.saveVisualization(visualization);
```

### Displaying Visualizations

```tsx
import ThinkingVisualizer from '@/components/ThinkingVisualizer';

// In your component
<ThinkingVisualizer chatId="chat-123" messageId="msg-456" />
```

## Storage

Visualizations are stored in the memory service using a specialized collection. Each visualization is stored with metadata including:

- Chat ID
- Message ID
- User ID
- Agent ID
- Timestamp
- Source
- Importance score

## Configuration

The visualization feature can be enabled/disabled via the `/api/config/get?key=enableThinkingVisualization` endpoint.

## UI Components

### ThinkingVisualizer

Main container component that fetches and manages visualizations.

### VisualizationRenderer

Renders the visualization graph using ReactFlow and provides detailed views of each node.

## API Endpoints

### GET /api/thinking/visualizations

Fetches visualizations for a specific chat and optionally a specific message.

**Parameters:**
- `chatId` - Required. The ID of the chat to get visualizations for
- `messageId` - Optional. Filter by specific message ID

**Response:**
```json
{
  "visualizations": [
    {
      "id": "vis-123",
      "chatId": "chat-123",
      "messageId": "msg-456",
      "nodes": [...],
      "edges": [...],
      ...
    }
  ]
}
```

### POST /api/thinking/visualizations

Stores a visualization in the memory service.

**Request Body:**
```json
{
  "visualization": {
    "id": "vis-123",
    "chatId": "chat-123",
    "messageId": "msg-456",
    "nodes": [...],
    "edges": [...],
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "visualizationId": "vis-123"
}
``` 