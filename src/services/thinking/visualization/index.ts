/**
 * Visualization module for thinking processes
 * Exports the visualization service, types, and utilities
 */
import { v4 as uuidv4 } from 'uuid';
import { ThinkingVisualizer } from './ThinkingVisualizer';
import type { 
  ThinkingVisualization, 
  VisualizationNodeType, 
  VisualizationEdgeType,
  VisualizationNode,
  VisualizationEdge,
  VisualizationMetadata
} from './types';

// Re-export types and service
export { ThinkingVisualizer };
export type { 
  ThinkingVisualization, 
  VisualizationNodeType, 
  VisualizationEdgeType,
  VisualizationNode,
  VisualizationEdge,
  VisualizationMetadata
};

/**
 * Create a sample thinking visualization for testing
 */
export function createSampleVisualization(): ThinkingVisualization {
  const visualization: ThinkingVisualization = {
    id: uuidv4(),
    requestId: uuidv4(),
    userId: 'user-123',
    agentId: 'agent-default',
    chatId: 'chat-456',
    messageId: 'msg-789',
    message: 'Tell me about cognitive architectures',
    timestamp: Date.now(),
    nodes: [],
    edges: [],
    metrics: {
      totalDuration: 2500,
      startTime: Date.now() - 2500,
      endTime: Date.now()
    }
  };

  // Add nodes and edges
  const startNode = {
    id: uuidv4(),
    type: 'start' as VisualizationNodeType,
    label: 'Start Processing',
    data: {
      message: 'Tell me about cognitive architectures',
    },
    metrics: {
      startTime: visualization.metrics.startTime,
      endTime: visualization.metrics.startTime + 10,
      duration: 10
    },
    status: 'completed' as const
  };
  visualization.nodes.push(startNode);

  const thinkingNode = {
    id: uuidv4(),
    type: 'thinking' as VisualizationNodeType,
    label: 'Analyzing Request',
    data: {
      content: 'The user is asking for information about cognitive architectures. I should provide an overview of what cognitive architectures are, their key components, and some examples.'
    },
    metrics: {
      startTime: visualization.metrics.startTime + 20,
      endTime: visualization.metrics.startTime + 300,
      duration: 280
    },
    status: 'completed' as const
  };
  visualization.nodes.push(thinkingNode);

  const contextNode = {
    id: uuidv4(),
    type: 'context_retrieval' as VisualizationNodeType,
    label: 'Retrieving Context',
    data: {
      query: 'cognitive architectures definition components examples',
      resultCount: 3
    },
    metrics: {
      startTime: visualization.metrics.startTime + 310,
      endTime: visualization.metrics.startTime + 700,
      duration: 390
    },
    status: 'completed' as const
  };
  visualization.nodes.push(contextNode);

  const toolSelectionNode = {
    id: uuidv4(),
    type: 'tool_selection' as VisualizationNodeType,
    label: 'Selected Tool: Web Search',
    data: {
      toolName: 'web_search',
      reasoning: 'I need current information about cognitive architectures to provide an up-to-date response.',
      options: ['web_search', 'knowledge_base']
    },
    metrics: {
      startTime: visualization.metrics.startTime + 710,
      endTime: visualization.metrics.startTime + 850,
      duration: 140
    },
    status: 'completed' as const
  };
  visualization.nodes.push(toolSelectionNode);

  const toolExecutionNode = {
    id: uuidv4(),
    type: 'tool_execution' as VisualizationNodeType,
    label: 'Executing: Web Search',
    data: {
      toolName: 'web_search',
      params: {
        query: 'cognitive architectures definition recent developments'
      },
      result: {
        snippets: [
          {
            title: 'Cognitive Architecture - Wikipedia',
            content: 'A cognitive architecture is a hypothesis about the fixed structures that provide a mind, whether in natural or artificial systems...'
          },
          {
            title: 'Comparison of Cognitive Architectures',
            content: 'The most well-known cognitive architectures include ACT-R, Soar, CLARION, and newer approaches like LIDA...'
          }
        ]
      }
    },
    metrics: {
      startTime: visualization.metrics.startTime + 860,
      endTime: visualization.metrics.startTime + 1500,
      duration: 640
    },
    status: 'completed' as const
  };
  visualization.nodes.push(toolExecutionNode);

  const insightNode = {
    id: uuidv4(),
    type: 'insight' as VisualizationNodeType,
    label: 'Insight: Pattern Recognition',
    data: {
      content: 'Most cognitive architectures share common components including perception, attention, memory, and reasoning systems.',
      insightType: 'pattern'
    },
    metrics: {
      startTime: visualization.metrics.startTime + 1510,
      endTime: visualization.metrics.startTime + 1700,
      duration: 190
    },
    status: 'completed' as const
  };
  visualization.nodes.push(insightNode);

  const responseNode = {
    id: uuidv4(),
    type: 'response_generation' as VisualizationNodeType,
    label: 'Generating Response',
    data: {
      response: 'Cognitive architectures are frameworks that define the structure and organization of intelligent systems. They model how different cognitive processes like perception, memory, reasoning, and learning interact to produce intelligent behavior...'
    },
    metrics: {
      startTime: visualization.metrics.startTime + 1710,
      endTime: visualization.metrics.startTime + 2400,
      duration: 690
    },
    status: 'completed' as const
  };
  visualization.nodes.push(responseNode);

  const endNode = {
    id: uuidv4(),
    type: 'end' as VisualizationNodeType,
    label: 'Processing Complete',
    data: {},
    metrics: {
      startTime: visualization.metrics.startTime + 2410,
      endTime: visualization.metrics.endTime,
      duration: 90
    },
    status: 'completed' as const
  };
  visualization.nodes.push(endNode);

  // Create edges
  const flowEdge1 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: startNode.id,
    target: thinkingNode.id
  };
  visualization.edges.push(flowEdge1);

  const flowEdge2 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: thinkingNode.id,
    target: contextNode.id
  };
  visualization.edges.push(flowEdge2);

  const flowEdge3 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: contextNode.id,
    target: toolSelectionNode.id
  };
  visualization.edges.push(flowEdge3);

  const flowEdge4 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: toolSelectionNode.id,
    target: toolExecutionNode.id
  };
  visualization.edges.push(flowEdge4);

  const flowEdge5 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: toolExecutionNode.id,
    target: insightNode.id
  };
  visualization.edges.push(flowEdge5);

  const flowEdge6 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: insightNode.id,
    target: responseNode.id
  };
  visualization.edges.push(flowEdge6);

  const flowEdge7 = {
    id: uuidv4(),
    type: 'flow' as VisualizationEdgeType,
    source: responseNode.id,
    target: endNode.id
  };
  visualization.edges.push(flowEdge7);

  // Add the thinking insights 
  visualization.response = responseNode.data.response;

  return visualization;
} 