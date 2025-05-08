/**
 * Conversation Visualization Service Implementation
 * 
 * This service provides visualization capabilities for multi-agent conversations,
 * including graph generation, timeline analysis, and export functions.
 */

import { v4 as uuidv4 } from 'uuid';
import { StructuredId } from '../../../../../../utils/ulid';
import { AnyMemoryService } from '../../../memory/memory-service-wrappers';
import { MemoryType } from '../../../../config';
import { MessagingFactory } from '../factory';
import {
  VisualizationNodeType,
  VisualizationEdgeType,
  VisualizationNode,
  VisualizationEdge,
  VisualizationGraph,
  VisualizationFilterOptions,
  VisualizationLayoutOptions,
  IConversationVisualizationService
} from './visualization-interface';

// Define extended ConversationMessage interface that includes recipientId
interface ExtendedConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  format: string;
  isVisibleToAll: boolean;
  recipientId?: string;
  referencedMessageIds?: string[];
  visibleToParticipantIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Implementation of the Conversation Visualization Service
 */
export class ConversationVisualizationService implements IConversationVisualizationService {
  constructor(
    private readonly memoryService: AnyMemoryService
  ) {}

  /**
   * Generate a visualization graph for a conversation
   * 
   * @param conversationId The ID of the conversation to visualize
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing the conversation
   */
  async visualizeConversation(
    conversationId: string | StructuredId,
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph> {
    // Get conversation from memory service
    const conversationManager = await MessagingFactory.getConversationManager();
    const conversation = await conversationManager.getConversation(typeof conversationId === 'string' ? conversationId : conversationId.toString());
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    // Get messages for this conversation
    // Using getMessagesForParticipant with no participant filter to get all messages
    const messages = await conversationManager.getMessagesForParticipant(conversation.id, '', { limit: 1000 });
    
    // Create nodes and edges
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];
    
    // Add participant nodes
    for (const participant of conversation.participants) {
      nodes.push({
        id: participant.id,
        type: participant.type === 'agent' ? VisualizationNodeType.AGENT : VisualizationNodeType.USER,
        label: participant.name || participant.id,
        properties: {
          role: participant.role,
          joinedAt: participant.joinedAt,
          lastActiveAt: participant.lastActiveAt
        },
        timestamp: participant.joinedAt
      });
    }
    
    // Add message nodes and edges
    const messageMap = new Map<string, any>();
    
    for (const message of messages) {
      // Cast to extended type to access recipientId
      const extendedMessage = message as ExtendedConversationMessage;
      
      // Apply message filtering if specified
      if (filterOptions) {
        if (filterOptions.timeRange && 
            (message.timestamp < filterOptions.timeRange.start || 
             message.timestamp > filterOptions.timeRange.end)) {
          continue;
        }
        
        if (filterOptions.participants && 
            !filterOptions.participants.includes(message.senderId)) {
          continue;
        }
        
        // Additional filters can be applied here
      }
      
      // Create message node
      const messageNode: VisualizationNode = {
        id: message.id,
        type: VisualizationNodeType.MESSAGE,
        label: this.truncateContent(message.content),
        properties: {
          format: message.format,
          timestamp: message.timestamp,
          referencedMessageIds: message.referencedMessageIds || []
        },
        timestamp: message.timestamp
      };
      
      nodes.push(messageNode);
      messageMap.set(message.id, message);
      
      // Create sender edge
      edges.push({
        id: `sent_${uuidv4()}`,
        source: message.senderId,
        target: message.id,
        type: VisualizationEdgeType.SENT,
        properties: {
          timestamp: message.timestamp
        },
        timestamp: message.timestamp
      });
      
      // Create recipient edges if applicable
      if (extendedMessage.recipientId) {
        edges.push({
          id: `received_${uuidv4()}`,
          source: message.id,
          target: extendedMessage.recipientId,
          type: VisualizationEdgeType.RECEIVED,
          properties: {
            timestamp: message.timestamp
          },
          timestamp: message.timestamp
        });
      }
      
      // Create reference edges for messages that reference other messages
      if (message.referencedMessageIds && message.referencedMessageIds.length > 0) {
        for (const referencedId of message.referencedMessageIds) {
          edges.push({
            id: `ref_${uuidv4()}`,
            source: message.id,
            target: referencedId,
            type: VisualizationEdgeType.REFERENCED,
            properties: {
              timestamp: message.timestamp
            },
            timestamp: message.timestamp
          });
        }
      }
    }
    
    // Apply layout options if specified
    if (layoutOptions) {
      this.applyLayoutOptions(nodes, edges, layoutOptions);
    }
    
    // Calculate time range for the metadata
    const timestamps = nodes.map(n => n.timestamp).filter(t => !!t);
    const startTime = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const endTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
    
    // Create and return the visualization graph
    return {
      nodes,
      edges,
      metadata: {
        title: `Conversation: ${conversation.name || conversation.id}`,
        description: conversation.description,
        timeRange: {
          start: startTime,
          end: endTime
        },
        participantCount: conversation.participants.length,
        messageCount: messages.length
      }
    };
  }

  /**
   * Generate a visualization of agent interaction patterns across multiple conversations
   * 
   * @param agentIds IDs of agents to include in the visualization
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing agent interactions
   */
  async visualizeAgentInteractions(
    agentIds: (string | StructuredId)[],
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph> {
    // Normalize agent IDs to strings
    const normalizedAgentIds = agentIds.map(id => typeof id === 'string' ? id : id.toString());
    
    // Find all conversations involving these agents
    const conversationManager = await MessagingFactory.getConversationManager();
    
    // Get all conversations and filter those with the specified agents
    // This is a workaround since getConversationsWithParticipants doesn't exist
    const allConversations = await this.getAllConversations();
    const conversations = allConversations.filter(conversation => 
      conversation.participants.some((participant: { id: string }) => 
        normalizedAgentIds.includes(participant.id)
      )
    );
    
    // Create nodes for each agent
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];
    const agentInteractions = new Map<string, Map<string, number>>();
    
    // Initialize agent interaction tracking
    for (const agentId of normalizedAgentIds) {
      agentInteractions.set(agentId, new Map<string, number>());
      
      // Add agent node
      const agent = await this.getAgentDetails(agentId);
      nodes.push({
        id: agentId,
        type: VisualizationNodeType.AGENT,
        label: agent?.name || agentId,
        properties: {
          capabilities: agent?.capabilities || []
        },
        timestamp: Date.now()
      });
    }
    
    // Process all conversations to build interaction graph
    for (const conversation of conversations) {
      // Get messages for this conversation
      const messages = await conversationManager.getMessagesForParticipant(conversation.id, '', { limit: 1000 });
      
      // Track agent interactions based on message sending/receiving
      for (const message of messages) {
        // Cast to extended type to access recipientId
        const extendedMessage = message as ExtendedConversationMessage;
        
        if (!normalizedAgentIds.includes(message.senderId)) {
          continue;
        }
        
        // If there's a direct recipient and it's one of our target agents
        if (extendedMessage.recipientId && normalizedAgentIds.includes(extendedMessage.recipientId)) {
          // Update interaction count from sender to recipient
          const senderInteractions = agentInteractions.get(message.senderId);
          if (senderInteractions) {
            const currentCount = senderInteractions.get(extendedMessage.recipientId) || 0;
            senderInteractions.set(extendedMessage.recipientId, currentCount + 1);
          }
        } 
        // Otherwise, consider it an interaction with all agents in the conversation
        else if (!extendedMessage.recipientId) {
          const senderInteractions = agentInteractions.get(message.senderId);
          if (senderInteractions) {
            // Add interaction with all other agents in the conversation
            for (const participant of conversation.participants) {
              if (participant.id !== message.senderId && 
                  normalizedAgentIds.includes(participant.id) &&
                  participant.type === 'agent') {
                const currentCount = senderInteractions.get(participant.id) || 0;
                senderInteractions.set(participant.id, currentCount + 1);
              }
            }
          }
        }
      }
    }
    
    // Create edges based on interaction counts
    // Fix Map iteration with Array.from
    for (const [sourceId, interactions] of Array.from(agentInteractions.entries())) {
      for (const [targetId, count] of Array.from(interactions.entries())) {
        if (count > 0) {
          edges.push({
            id: `interact_${uuidv4()}`,
            source: sourceId,
            target: targetId,
            type: VisualizationEdgeType.COLLABORATED,
            label: `${count} interactions`,
            properties: {
              count
            },
            weight: count,
            timestamp: Date.now()
          });
        }
      }
    }
    
    // Apply layout options if specified
    if (layoutOptions) {
      this.applyLayoutOptions(nodes, edges, layoutOptions);
    }
    
    // Return the visualization graph
    return {
      nodes,
      edges,
      metadata: {
        title: `Agent Interaction Network`,
        description: `Visualization of interactions between ${agentIds.length} agents`,
        timeRange: {
          start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          end: Date.now()
        },
        participantCount: agentIds.length,
        messageCount: edges.reduce((sum, edge) => sum + (edge.properties.count as number || 0), 0)
      }
    };
  }

  /**
   * Generate a visualization for a specific capability usage across conversations
   * 
   * @param capabilityId ID of the capability to visualize
   * @param filterOptions Optional filters to apply to the visualization
   * @param layoutOptions Optional layout preferences for the visualization
   * @returns A visualization graph representing capability usage
   */
  async visualizeCapabilityUsage(
    capabilityId: string,
    filterOptions?: VisualizationFilterOptions,
    layoutOptions?: VisualizationLayoutOptions
  ): Promise<VisualizationGraph> {
    // Get capability registry to find agents with this capability
    const capabilityRegistry = await MessagingFactory.getCapabilityRegistry();
    const agents = await capabilityRegistry.findProviders(capabilityId);
    
    if (!agents || agents.length === 0) {
      throw new Error(`No agents found with capability: ${capabilityId}`);
    }
    
    // Create nodes and edges
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];
    
    // Add capability node as central node
    nodes.push({
      id: capabilityId,
      type: VisualizationNodeType.CAPABILITY,
      label: capabilityId,
      properties: {},
      timestamp: Date.now(),
      size: 2 // Make capability node larger
    });
    
    // Add agent nodes and connect to capability
    for (const agentId of agents) {
      const agent = await this.getAgentDetails(agentId);
      const agentNode: VisualizationNode = {
        id: agentId,
        type: VisualizationNodeType.AGENT,
        label: agent?.name || agentId,
        properties: {
          capabilities: agent?.capabilities || []
        },
        timestamp: Date.now()
      };
      
      nodes.push(agentNode);
      
      // Connect agent to capability
      edges.push({
        id: `provides_${uuidv4()}`,
        source: agentId,
        target: capabilityId,
        type: VisualizationEdgeType.PROVIDED,
        properties: {},
        timestamp: Date.now()
      });
    }
    
    // Get usage metrics for each agent separately
    for (const agentId of agents) {
      try {
        const metrics = await capabilityRegistry.getCapabilityMetrics(agentId, capabilityId);
        
        if (metrics) {
          // Find the edge from this agent to the capability
          const edgeIndex = edges.findIndex(e => e.source === agentId && e.target === capabilityId);
          
          if (edgeIndex >= 0) {
            edges[edgeIndex].weight = metrics.usageCount;
            edges[edgeIndex].label = `${metrics.usageCount} uses`;
            edges[edgeIndex].properties = {
              ...edges[edgeIndex].properties,
              successRate: metrics.successRate,
              averageLatency: metrics.averageLatency,
              lastUsed: metrics.lastUsed
            };
          }
        }
      } catch (error) {
        console.error(`Error getting capability metrics for agent ${agentId}: ${error}`);
      }
    }
    
    // Apply layout options if specified
    if (layoutOptions) {
      this.applyLayoutOptions(nodes, edges, layoutOptions);
    } else {
      // Default to radial layout with capability at center
      this.applyLayoutOptions(nodes, edges, {
        type: 'radial',
        centerNode: capabilityId
      });
    }
    
    // Return the visualization graph
    return {
      nodes,
      edges,
      metadata: {
        title: `Capability Usage: ${capabilityId}`,
        description: `Visualization of agents providing capability ${capabilityId}`,
        timeRange: {
          start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          end: Date.now()
        },
        participantCount: agents.length,
        messageCount: edges.reduce((sum, edge) => sum + (edge.weight || 0), 0)
      }
    };
  }

  /**
   * Export a visualization graph to a specific format
   * 
   * @param graph The visualization graph to export
   * @param format Format to export the graph to
   * @returns The exported graph data in the specified format
   */
  async exportVisualization(
    graph: VisualizationGraph,
    format: 'json' | 'graphml' | 'svg' | 'png'
  ): Promise<Blob | string> {
    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
        
      case 'graphml':
        return this.convertToGraphML(graph);
        
      case 'svg':
      case 'png':
        throw new Error(`Export to ${format} format is not yet implemented`);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate a time-series visualization of conversation activity
   * 
   * @param conversationId The ID of the conversation to analyze
   * @param timeGranularity Time granularity for the analysis
   * @returns Time series data for the conversation activity
   */
  async visualizeConversationTimeline(
    conversationId: string | StructuredId,
    timeGranularity: 'minute' | 'hour' | 'day'
  ): Promise<Array<{time: number, messageCount: number, activeAgents: number}>> {
    const conversationManager = await MessagingFactory.getConversationManager();
    const conversation = await conversationManager.getConversation(
      typeof conversationId === 'string' ? conversationId : conversationId.toString()
    );
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    // Get messages for this conversation
    const messages = await conversationManager.getMessagesForParticipant(conversation.id, '', { limit: 1000 });
    
    // Determine time buckets based on granularity
    const msMultiplier = timeGranularity === 'minute' ? 60 * 1000 :
                          timeGranularity === 'hour' ? 60 * 60 * 1000 :
                          24 * 60 * 60 * 1000; // day
    
    // Create buckets for timeline data
    const timelineBuckets = new Map<number, { messageCount: number, activeAgents: Set<string> }>();
    
    // Process messages into time buckets
    for (const message of messages) {
      const bucketTime = Math.floor(message.timestamp / msMultiplier) * msMultiplier;
      
      if (!timelineBuckets.has(bucketTime)) {
        timelineBuckets.set(bucketTime, { messageCount: 0, activeAgents: new Set<string>() });
      }
      
      const bucket = timelineBuckets.get(bucketTime)!;
      bucket.messageCount++;
      bucket.activeAgents.add(message.senderId);
    }
    
    // Convert to array of time series points using Array.from for safer Map iteration
    const timelineData = Array.from(timelineBuckets.entries())
      .map(([time, data]) => ({
        time,
        messageCount: data.messageCount,
        activeAgents: data.activeAgents.size
      }))
      .sort((a, b) => a.time - b.time);
    
    return timelineData;
  }

  /**
   * Helper method to apply layout options to nodes and edges
   */
  private applyLayoutOptions(
    nodes: VisualizationNode[],
    edges: VisualizationEdge[],
    options: VisualizationLayoutOptions
  ): void {
    // Filter nodes by type if specified
    if (options.includeTypes && options.includeTypes.length > 0) {
      const filteredNodeIds = new Set<string>();
      
      // Keep only nodes of included types
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (!options.includeTypes.includes(nodes[i].type)) {
          nodes.splice(i, 1);
        } else {
          filteredNodeIds.add(nodes[i].id);
        }
      }
      
      // Remove edges that reference removed nodes
      for (let i = edges.length - 1; i >= 0; i--) {
        if (!filteredNodeIds.has(edges[i].source) || !filteredNodeIds.has(edges[i].target)) {
          edges.splice(i, 1);
        }
      }
    }
    
    // Exclude specific node types if specified
    if (options.excludeTypes && options.excludeTypes.length > 0) {
      const removedNodeIds = new Set<string>();
      
      // Remove nodes of excluded types
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (options.excludeTypes.includes(nodes[i].type)) {
          removedNodeIds.add(nodes[i].id);
          nodes.splice(i, 1);
        }
      }
      
      // Remove edges that reference removed nodes
      for (let i = edges.length - 1; i >= 0; i--) {
        if (removedNodeIds.has(edges[i].source) || removedNodeIds.has(edges[i].target)) {
          edges.splice(i, 1);
        }
      }
    }
    
    // Limit the number of nodes if specified
    if (options.maxNodes && nodes.length > options.maxNodes) {
      // Sort nodes by importance (using size or other criteria)
      nodes.sort((a, b) => (b.size || 1) - (a.size || 1));
      
      // Keep track of nodes to remove
      const nodesToRemove = new Set<string>();
      for (let i = options.maxNodes; i < nodes.length; i++) {
        nodesToRemove.add(nodes[i].id);
      }
      
      // Remove excess nodes
      nodes.splice(options.maxNodes);
      
      // Remove edges that reference removed nodes
      for (let i = edges.length - 1; i >= 0; i--) {
        if (nodesToRemove.has(edges[i].source) || nodesToRemove.has(edges[i].target)) {
          edges.splice(i, 1);
        }
      }
    }
    
    // Set node colors based on type for better visualization
    for (const node of nodes) {
      // Assign colors based on node type
      switch (node.type) {
        case VisualizationNodeType.AGENT:
          node.color = '#4285F4'; // Blue
          break;
        case VisualizationNodeType.USER:
          node.color = '#34A853'; // Green
          break;
        case VisualizationNodeType.MESSAGE:
          node.color = '#FBBC05'; // Yellow
          break;
        case VisualizationNodeType.CAPABILITY:
          node.color = '#EA4335'; // Red
          break;
        case VisualizationNodeType.TASK:
          node.color = '#9C27B0'; // Purple
          break;
        case VisualizationNodeType.DECISION:
          node.color = '#FF6D00'; // Orange
          break;
        case VisualizationNodeType.RESOURCE:
          node.color = '#009688'; // Teal
          break;
      }
      
      // Highlight specific nodes if requested
      if (options.highlightNodes && options.highlightNodes.includes(node.id)) {
        node.size = (node.size || 1) * 1.5; // Increase size
        // Add a bright border or other highlight indicator
      }
    }
    
    // For radial layout, place the center node in the middle
    if (options.type === 'radial' && options.centerNode) {
      const centerNodeIndex = nodes.findIndex(n => n.id === options.centerNode);
      if (centerNodeIndex >= 0) {
        // Increase size of center node
        nodes[centerNodeIndex].size = (nodes[centerNodeIndex].size || 1) * 2;
      }
    }
  }

  /**
   * Convert a visualization graph to GraphML format
   */
  private convertToGraphML(graph: VisualizationGraph): string {
    let graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="type" for="node" attr.name="type" attr.type="string"/>
  <key id="timestamp" for="node" attr.name="timestamp" attr.type="long"/>
  <key id="properties" for="node" attr.name="properties" attr.type="string"/>
  <key id="color" for="node" attr.name="color" attr.type="string"/>
  <key id="size" for="node" attr.name="size" attr.type="double"/>
  
  <key id="edgeLabel" for="edge" attr.name="label" attr.type="string"/>
  <key id="edgeType" for="edge" attr.name="type" attr.type="string"/>
  <key id="edgeTimestamp" for="edge" attr.name="timestamp" attr.type="long"/>
  <key id="edgeProperties" for="edge" attr.name="properties" attr.type="string"/>
  <key id="edgeWeight" for="edge" attr.name="weight" attr.type="double"/>
  <key id="edgeStyle" for="edge" attr.name="style" attr.type="string"/>
  <key id="edgeColor" for="edge" attr.name="color" attr.type="string"/>
  
  <graph id="G" edgedefault="directed">
`;

    // Add nodes
    for (const node of graph.nodes) {
      graphml += `    <node id="${this.escapeXml(node.id)}">\n`;
      graphml += `      <data key="label">${this.escapeXml(node.label)}</data>\n`;
      graphml += `      <data key="type">${this.escapeXml(node.type)}</data>\n`;
      graphml += `      <data key="timestamp">${node.timestamp}</data>\n`;
      graphml += `      <data key="properties">${this.escapeXml(JSON.stringify(node.properties))}</data>\n`;
      
      if (node.color) {
        graphml += `      <data key="color">${this.escapeXml(node.color)}</data>\n`;
      }
      
      if (node.size) {
        graphml += `      <data key="size">${node.size}</data>\n`;
      }
      
      graphml += `    </node>\n`;
    }
    
    // Add edges
    for (const edge of graph.edges) {
      graphml += `    <edge id="${this.escapeXml(edge.id)}" source="${this.escapeXml(edge.source)}" target="${this.escapeXml(edge.target)}">\n`;
      
      if (edge.label) {
        graphml += `      <data key="edgeLabel">${this.escapeXml(edge.label)}</data>\n`;
      }
      
      graphml += `      <data key="edgeType">${this.escapeXml(edge.type)}</data>\n`;
      graphml += `      <data key="edgeTimestamp">${edge.timestamp}</data>\n`;
      graphml += `      <data key="edgeProperties">${this.escapeXml(JSON.stringify(edge.properties))}</data>\n`;
      
      if (edge.weight) {
        graphml += `      <data key="edgeWeight">${edge.weight}</data>\n`;
      }
      
      if (edge.style) {
        graphml += `      <data key="edgeStyle">${this.escapeXml(edge.style)}</data>\n`;
      }
      
      if (edge.color) {
        graphml += `      <data key="edgeColor">${this.escapeXml(edge.color)}</data>\n`;
      }
      
      graphml += `    </edge>\n`;
    }
    
    graphml += `  </graph>\n</graphml>`;
    
    return graphml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Truncate message content for display in visualization
   */
  private truncateContent(content: string | Record<string, unknown>): string {
    if (typeof content === 'string') {
      return content.length > 40 ? content.substring(0, 37) + '...' : content;
    } else {
      return JSON.stringify(content).length > 40 ? 
        JSON.stringify(content).substring(0, 37) + '...' : 
        JSON.stringify(content);
    }
  }

  /**
   * Get agent details from memory
   */
  private async getAgentDetails(agentId: string): Promise<any | null> {
    try {
      // Get agent from memory
      const result = await this.memoryService.searchMemories({
        type: 'agent' as unknown as MemoryType,
        filter: {
          id: agentId
        },
        limit: 1
      });
      
      if (result && result.length > 0) {
        return result[0].payload;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting agent details: ${error}`);
      return null;
    }
  }

  /**
   * Get all conversations from memory
   * Helper method to work around missing getConversationsWithParticipants
   */
  private async getAllConversations(): Promise<any[]> {
    try {
      // Search for all conversations in memory
      const result = await this.memoryService.searchMemories({
        type: 'conversation' as unknown as MemoryType,
        limit: 100
      });
      
      return result.map(item => item.payload);
    } catch (error) {
      console.error(`Error getting conversations: ${error}`);
      return [];
    }
  }
} 