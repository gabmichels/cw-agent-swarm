/**
 * Conversation Visualization Interface
 * 
 * This module defines interfaces for visualizing agent-to-agent conversations
 * and interaction patterns in the multi-agent system.
 */

import { StructuredId } from '../../../../../../utils/ulid';

/**
 * Visualization node types that can appear in conversation graphs
 */
export enum VisualizationNodeType {
  AGENT = 'agent',
  USER = 'user',
  MESSAGE = 'message',
  CAPABILITY = 'capability',
  TASK = 'task',
  DECISION = 'decision',
  RESOURCE = 'resource'
}

/**
 * Types of relationships between visualization nodes
 */
export enum VisualizationEdgeType {
  SENT = 'sent',
  RECEIVED = 'received',
  REPLIED_TO = 'replied_to',
  REFERENCED = 'referenced',
  ASSIGNED = 'assigned',
  DELEGATED = 'delegated',
  COLLABORATED = 'collaborated',
  INFORMED = 'informed',
  REQUESTED = 'requested',
  PROVIDED = 'provided'
}

/**
 * Node in a conversation visualization graph
 */
export interface VisualizationNode {
  id: string;
  type: VisualizationNodeType;
  label: string;
  properties: Record<string, unknown>;
  timestamp: number;
  size?: number; // Relative importance/size for rendering
  color?: string; // Optional color for visualization
  icon?: string; // Optional icon identifier
}

/**
 * Edge connecting nodes in a conversation visualization graph
 */
export interface VisualizationEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  type: VisualizationEdgeType;
  label?: string;
  properties: Record<string, unknown>;
  timestamp: number;
  weight?: number; // Relationship strength
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

/**
 * Complete visualization graph with nodes and edges
 */
export interface VisualizationGraph {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata: {
    title: string;
    description?: string;
    timeRange: {
      start: number;
      end: number;
    };
    participantCount: number;
    messageCount: number;
  };
}

/**
 * Layout options for rendering visualization graphs
 */
export interface VisualizationLayoutOptions {
  type: 'force' | 'radial' | 'hierarchical' | 'timeline';
  centerNode?: string; // Node to use as center for radial layouts
  groupBy?: 'type' | 'agent' | 'time' | 'capability';
  timeGranularity?: 'second' | 'minute' | 'hour' | 'day';
  includeTypes?: VisualizationNodeType[];
  excludeTypes?: VisualizationNodeType[];
  highlightNodes?: string[];
  maxNodes?: number;
}

/**
 * Filter options for conversation visualization
 */
export interface VisualizationFilterOptions {
  timeRange?: {
    start: number;
    end: number;
  };
  participants?: string[];
  messageTypes?: string[];
  keywords?: string[];
  capabilities?: string[];
  includeEdgeTypes?: VisualizationEdgeType[];
  excludeEdgeTypes?: VisualizationEdgeType[];
  minimumEdgeWeight?: number;
}

/**
 * Interface for conversation visualization service
 */
export interface IConversationVisualizationService {
  /**
   * Generate a visualization graph for a conversation
   * 
   * @param conversationId The ID of the conversation to visualize
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing the conversation
   */
  visualizeConversation(
    conversationId: string | StructuredId,
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph>;

  /**
   * Generate a visualization of agent interaction patterns across multiple conversations
   * 
   * @param agentIds IDs of agents to include in the visualization
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing agent interactions
   */
  visualizeAgentInteractions(
    agentIds: (string | StructuredId)[],
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph>;

  /**
   * Generate a visualization for a specific capability usage across conversations
   * 
   * @param capabilityId ID of the capability to visualize
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing capability usage
   */
  visualizeCapabilityUsage(
    capabilityId: string,
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph>;

  /**
   * Export a visualization graph to a specific format
   * 
   * @param graph The visualization graph to export
   * @param format Format to export the graph to
   * @returns The exported graph data in the specified format
   */
  exportVisualization(
    graph: VisualizationGraph,
    format: 'json' | 'graphml' | 'svg' | 'png'
  ): Promise<Blob | string>;

  /**
   * Generate a time-series visualization of conversation activity
   * 
   * @param conversationId The ID of the conversation to analyze
   * @param timeGranularity Time granularity for the analysis
   * @returns Time series data for the conversation activity
   */
  visualizeConversationTimeline(
    conversationId: string | StructuredId,
    timeGranularity: 'minute' | 'hour' | 'day'
  ): Promise<Array<{time: number, messageCount: number, activeAgents: number}>>;
} 