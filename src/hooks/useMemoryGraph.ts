import { useState, useCallback, useEffect } from 'react';
import { MemoryType } from '../server/memory/config';
import useMemory from './useMemory';

/**
 * Node types for graph visualization
 */
export enum NodeType {
  MESSAGE = 'message',
  KNOWLEDGE = 'knowledge',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
  OTHER = 'other'
}

/**
 * Edge types for graph visualization
 */
export enum EdgeType {
  REFERENCES = 'references',
  RESPONDS_TO = 'responds_to',
  DERIVES_FROM = 'derives_from',
  PART_OF = 'part_of',
  RELATED_TO = 'related_to'
}

/**
 * Graph node interface
 */
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  data: any; // Original memory data
  size?: number; // Node size for visualization
  color?: string; // Node color
}

/**
 * Graph edge interface
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  weight?: number; // Edge weight/strength
}

/**
 * Graph data structure
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Parameters for useMemoryGraph hook
 */
interface UseMemoryGraphParams {
  rootId?: string; // Central node ID (if any)
  types?: MemoryType[]; // Memory types to include
  depth?: number; // How many levels of relationships to follow
  limit?: number; // Maximum number of nodes
}

/**
 * Hook for memory relationship visualization
 */
export default function useMemoryGraph({
  rootId,
  types = Object.values(MemoryType),
  depth = 2,
  limit = 50
}: UseMemoryGraphParams = {}) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Use the base memory hook
  const { getMemory, searchMemories } = useMemory();
  
  /**
   * Map memory type to node type
   */
  const getNodeType = (memoryType: string): NodeType => {
    const type = memoryType.toLowerCase();
    
    if (type.includes('message')) return NodeType.MESSAGE;
    if (type.includes('knowledge') || type.includes('insight') || type.includes('fact')) return NodeType.KNOWLEDGE;
    if (type.includes('thought') || type.includes('reflection')) return NodeType.THOUGHT;
    if (type.includes('document') || type.includes('file')) return NodeType.DOCUMENT;
    if (type.includes('task') || type.includes('goal')) return NodeType.TASK;
    
    return NodeType.OTHER;
  };
  
  /**
   * Get node color based on type
   */
  const getNodeColor = (nodeType: NodeType): string => {
    switch (nodeType) {
      case NodeType.MESSAGE: return '#4F46E5'; // Indigo
      case NodeType.KNOWLEDGE: return '#10B981'; // Emerald
      case NodeType.THOUGHT: return '#F59E0B'; // Amber
      case NodeType.DOCUMENT: return '#6366F1'; // Violet
      case NodeType.TASK: return '#EF4444'; // Red
      case NodeType.OTHER: return '#9CA3AF'; // Gray
      default: return '#9CA3AF';
    }
  };
  
  /**
   * Get a node's importance value to determine its size
   */
  const getNodeImportance = (memory: any): number => {
    const metadata = memory.metadata || {};
    
    // Base size
    let size = 1;
    
    // Increase size based on importance
    const importance = metadata.importance?.toLowerCase() || '';
    if (importance === 'high' || importance === 'critical') {
      size += 0.5;
    }
    
    // Increase size for flagged items
    if (metadata.flagged) {
      size += 0.3;
    }
    
    // Increase size for items with many tags
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      size += Math.min(0.5, metadata.tags.length * 0.1);
    }
    
    return size;
  };
  
  /**
   * Create a graph node from memory data
   */
  const createNode = (memory: any): GraphNode => {
    // Extract text content for the label from the actual memory structure
    const text = memory.text || memory.content || '';
    // Truncate long labels
    const label = text.length > 50 ? text.substring(0, 47) + '...' : text;
    
    // Determine node type from memory type
    const memoryType = memory.type || 'other';
    const nodeType = getNodeType(memoryType);
    
    // Create the node
    return {
      id: memory.id,
      label,
      type: nodeType,
      data: memory,
      size: getNodeImportance(memory),
      color: getNodeColor(nodeType)
    };
  };
  
  /**
   * Determine edge type based on relationship
   */
  const getEdgeType = (sourceType: string, targetType: string, metadata: any): EdgeType => {
    // Check explicit relationship type if available
    if (metadata?.relationship_type) {
      const relationship = metadata.relationship_type.toLowerCase();
      
      if (relationship.includes('reference')) return EdgeType.REFERENCES;
      if (relationship.includes('response')) return EdgeType.RESPONDS_TO;
      if (relationship.includes('derive')) return EdgeType.DERIVES_FROM;
      if (relationship.includes('part')) return EdgeType.PART_OF;
    }
    
    // Infer relationship based on memory types
    if (sourceType.includes('message') && targetType.includes('message')) {
      return EdgeType.RESPONDS_TO;
    }
    
    if (sourceType.includes('thought') && 
       (targetType.includes('message') || targetType.includes('knowledge'))) {
      return EdgeType.DERIVES_FROM;
    }
    
    if (sourceType.includes('knowledge') && targetType.includes('document')) {
      return EdgeType.PART_OF;
    }
    
    // Default relationship
    return EdgeType.RELATED_TO;
  };
  
  /**
   * Create an edge between two nodes
   */
  const createEdge = (
    sourceId: string, 
    targetId: string, 
    sourceType: string, 
    targetType: string,
    metadata: any = {}
  ): GraphEdge => {
    const edgeType = getEdgeType(sourceType, targetType, metadata);
    
    return {
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: edgeType,
      label: edgeType.replace('_', ' '),
      weight: metadata.weight || 1
    };
  };
  
  /**
   * Load graph data from memories
   */
  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const processedIds = new Set<string>();
      const processedEdgeIds = new Set<string>();
      const processedNodeIds = new Set<string>();
      
      // Function to process a memory and its relationships
      const processMemory = async (memoryId: string, currentDepth: number = 0) => {
        // Skip if we've already processed this memory or reached depth limit
        if (processedIds.has(memoryId) || currentDepth > depth) {
          return;
        }
        
        // Mark as processed to avoid cycles
        processedIds.add(memoryId);
        
        try {
          // Get memory data
          const memory = await getMemory(memoryId);
          
          // Create a node for this memory (with deduplication)
          if (!processedNodeIds.has(memory.id)) {
            const node = createNode(memory);
            nodes.push(node);
            processedNodeIds.add(memory.id);
          }
          
          // Stop if we've reached depth limit
          if (currentDepth >= depth) {
            return;
          }
          
          // Get related memories
          const metadata = memory.metadata || {};
          
          // Process explicit references
          const references = metadata.references || [];
          for (const refId of references) {
            if (!processedIds.has(refId) && nodes.length < limit) {
              await processMemory(refId, currentDepth + 1);
              
              // Create edge with deduplication
              const edgeId = `${memory.id}-${refId}`;
              if (!processedEdgeIds.has(edgeId)) {
                edges.push(createEdge(
                  memory.id, 
                  refId, 
                  memory.type || '', 
                  '', // Will be filled in when we process the referenced memory
                  { relationship_type: 'references' }
                ));
                processedEdgeIds.add(edgeId);
              }
            }
          }
          
                      // Find semantically related memories using regular memory API
            if (nodes.length < limit) {
              let relatedMemories = [];
              try {
                const response = await fetch('/api/memory?limit=' + Math.min(10, limit - nodes.length));
                const data = await response.json();
                relatedMemories = data.memories || [];
                console.log('Found related memories:', relatedMemories.length);
              } catch (error) {
                console.error('Failed to fetch related memories:', error);
                relatedMemories = [];
              }
            
            // Filter out the current memory and already processed memories
            const newRelated = relatedMemories.filter((related: any) => {
              return related.id !== memory.id && !processedIds.has(related.id);
            });
            
            // Process each related memory
            for (const related of newRelated) {
              if (nodes.length < limit) {
                // Use the memory directly since it's already in the right format
                
                // Add the related memory node (with deduplication)
                if (!processedNodeIds.has(related.id)) {
                  const relatedNode = createNode(related);
                  nodes.push(relatedNode);
                  processedNodeIds.add(related.id);
                }
                processedIds.add(related.id);
                
                // Create an edge with deduplication
                const edgeId = `${memory.id}-${related.id}`;
                if (!processedEdgeIds.has(edgeId)) {
                  edges.push(createEdge(
                    memory.id,
                    related.id,
                    memory.type || '',
                    related.type || '',
                    { weight: 0.5 }
                  ));
                  processedEdgeIds.add(edgeId);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing memory ${memoryId}:`, error);
        }
      };
      
      // Start processing from the root ID if provided
      if (rootId) {
        await processMemory(rootId);
      } else {
        // Without a root ID, get recent memories of specified types and create a simple graph
        const response = await fetch('/api/memory?limit=' + Math.min(10, limit));
        const data = await response.json();
        const recentMemories = data.memories || [];
        
        console.log('useMemoryGraph: searchMemories returned:', recentMemories.length, 'results');
        console.log('useMemoryGraph: first result structure:', recentMemories[0]);
        console.log('useMemoryGraph: types filter:', types);
        console.log('useMemoryGraph: memory types found:', recentMemories.map((r: any) => {
          return r.type;
        }));
        
        // Create nodes for each memory and find relationships between them
        const memoryNodes: { [id: string]: any } = {};
        
        for (const memory of recentMemories) {
          // Use the memory directly since it's already in the right format from /api/memory
          
          if (nodes.length < limit && !processedIds.has(memory.id)) {
            // Create a node for this memory (with deduplication)
            if (!processedNodeIds.has(memory.id)) {
              const node = createNode(memory);
              nodes.push(node);
              processedNodeIds.add(memory.id);
            }
            memoryNodes[memory.id] = memory;
            processedIds.add(memory.id);
          }
        }
        
        // Create relationships between memories based on semantic similarity
        const memoryList = Object.values(memoryNodes);
        for (let i = 0; i < memoryList.length; i++) {
          for (let j = i + 1; j < memoryList.length; j++) {
            const memory1 = memoryList[i] as any;
            const memory2 = memoryList[j] as any;
            
            // Create relationships based on content similarity or type matching
            const shouldConnect = (
              // Same type memories are related
              memory1.type === memory2.type ||
              // Messages and documents are related
              (memory1.type === 'message' && memory2.type === 'document') ||
              (memory1.type === 'document' && memory2.type === 'message') ||
              // Check for shared tags
              (memory1.metadata?.tags && memory2.metadata?.tags &&
               memory1.metadata.tags.some((tag: string) => 
                 memory2.metadata.tags.includes(tag)))
            );
            
            if (shouldConnect) {
              // Create edge with deduplication
              const edgeId = `${memory1.id}-${memory2.id}`;
              if (!processedEdgeIds.has(edgeId)) {
                edges.push(createEdge(
                  memory1.id,
                  memory2.id,
                  memory1.type || '',
                  memory2.type || '',
                  { weight: 0.7 }
                ));
                processedEdgeIds.add(edgeId);
              }
            }
          }
        }
      }
      
      // Final deduplication to ensure no duplicates
      const uniqueNodes = nodes.filter((node, index, self) => 
        index === self.findIndex(n => n.id === node.id)
      );
      const uniqueEdges = edges.filter((edge, index, self) => 
        index === self.findIndex(e => e.id === edge.id)
      );
      
      // Update graph data
      console.log('useMemoryGraph: Final graph data - nodes:', uniqueNodes.length, 'edges:', uniqueEdges.length);
      setGraphData({ nodes: uniqueNodes, edges: uniqueEdges });
    } catch (error) {
      console.error('Error loading memory graph:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [rootId, types, depth, limit, getMemory, searchMemories]);
  
  // Load graph on initial render and when dependencies change
  useEffect(() => {
    loadGraph();
  }, [loadGraph]);
  
  return {
    graphData,
    isLoading,
    error,
    refresh: loadGraph
  };
} 