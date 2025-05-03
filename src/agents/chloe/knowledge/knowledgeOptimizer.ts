/**
 * Knowledge Optimizer for Chloe
 * 
 * Implements tools for maintaining and optimizing the knowledge graph:
 * - Pruning stale or irrelevant nodes
 * - Discovering new relationships between existing nodes
 * - Extracting insights from the knowledge graph structure
 */

import { KnowledgeGraphManager, KnowledgeNode, KnowledgeEdge } from './graphManager';
import { KnowledgeEdgeType } from './graph';

interface GraphHealth {
  totalNodes: number;
  totalEdges: number;
  orphanedNodes: number;
  densityScore: number;
  needsOptimization: boolean;
  reason: string;
}

export class KnowledgeOptimizer {
  private graph: KnowledgeGraphManager;
  
  constructor(private graphManager: KnowledgeGraphManager) {
    this.graph = graphManager;
  }

  /**
   * Prune stale or irrelevant nodes from the knowledge graph
   * Identifies and removes nodes that are:
   * - Low relevance (haven't been accessed in a long time)
   * - Orphaned (no connections to other nodes)
   * - Outdated (superseded by newer information)
   */
  async pruneStaleNodes(): Promise<void> {
    const allNodes = await this.graph.getAllNodes();
    const nodesToRemove: string[] = [];
    
    for (const node of allNodes) {
      // Skip pruning for core knowledge nodes that should be preserved
      if (node.metadata?.core === true || node.metadata?.preserve === true) {
        continue;
      }
      
      // Check if the node is orphaned (no connections)
      const relatedNodes = await this.graph.queryRelatedNodes(node.id);
      if (relatedNodes.length === 0) {
        nodesToRemove.push(node.id);
        continue;
      }
      
      // Check if the node has low relevance score
      if (node.metadata?.relevanceScore !== undefined && node.metadata.relevanceScore < 0.3) {
        nodesToRemove.push(node.id);
        continue;
      }
      
      // Check if the node is outdated
      if (node.metadata?.timestamp) {
        const nodeDate = new Date(node.metadata.timestamp);
        const ageInDays = (Date.now() - nodeDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // If the node is older than 90 days and hasn't been accessed recently
        if (ageInDays > 90 && node.metadata.lastAccessed === undefined) {
          nodesToRemove.push(node.id);
          continue;
        }
      }
    }
    
    // Remove the identified nodes
    for (const nodeId of nodesToRemove) {
      await this.graph.removeNode(nodeId);
    }
    
    // Log the pruning activity
    console.log(`Pruned ${nodesToRemove.length} stale nodes from the knowledge graph`);
  }

  /**
   * Discover new relationships between existing nodes in the knowledge graph
   * Uses co-occurrence, semantic similarity, and pattern analysis
   * to identify potential new connections
   */
  async discoverNewRelationships(): Promise<void> {
    const allNodes = await this.graph.getAllNodes();
    const newEdges: KnowledgeEdge[] = [];
    
    // Get node pairs that don't already have direct connections
    const nodePairs: [KnowledgeNode, KnowledgeNode][] = [];
    
    // Find all potential node pairs - O(n²) operation, 
    // so we'd want to optimize this for larger graphs
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const nodeA = allNodes[i];
        const nodeB = allNodes[j];
        
        // Check if there's already an edge between these nodes
        const existingPath = await this.graph.findPath(nodeA.id, nodeB.id);
        if (existingPath.length === 0) {
          nodePairs.push([nodeA, nodeB]);
        }
      }
    }
    
    // Analyze each potential pair for new relationships
    for (const [nodeA, nodeB] of nodePairs) {
      // 1. Check for type-based relationships
      if (nodeA.type === nodeB.type) {
        // Nodes of the same type might be related
        newEdges.push({
          from: nodeA.id,
          to: nodeB.id,
          type: 'related_to',
          strength: 0.5,
          label: `Similar ${nodeA.type}`
        });
        continue;
      }
      
      // 2. Check for co-occurrence in memory sources (simplified version)
      if (
        nodeA.metadata?.sourcePaths && 
        nodeB.metadata?.sourcePaths && 
        this.hasCommonElement(nodeA.metadata.sourcePaths, nodeB.metadata.sourcePaths)
      ) {
        newEdges.push({
          from: nodeA.id,
          to: nodeB.id,
          type: 'related_to',
          strength: 0.7,
          label: 'Co-occurred in source'
        });
        continue;
      }
      
      // 3. Check for related metadata tags
      if (
        nodeA.metadata?.tags && 
        nodeB.metadata?.tags && 
        this.hasCommonElement(nodeA.metadata.tags, nodeB.metadata.tags)
      ) {
        newEdges.push({
          from: nodeA.id,
          to: nodeB.id,
          type: 'related_to',
          strength: 0.6,
          label: 'Related by tags'
        });
        continue;
      }
      
      // 4. Check temporal proximity (created around the same time)
      if (
        nodeA.metadata?.timestamp && 
        nodeB.metadata?.timestamp
      ) {
        const timeA = new Date(nodeA.metadata.timestamp).getTime();
        const timeB = new Date(nodeB.metadata.timestamp).getTime();
        const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
        
        if (diffHours < 24) {
          newEdges.push({
            from: nodeA.id,
            to: nodeB.id,
            type: 'related_to',
            strength: 0.4,
            label: 'Created at similar time'
          });
        }
      }
    }
    
    // Add the discovered edges to the graph
    for (const edge of newEdges) {
      await this.graph.addEdge(edge);
    }
    
    // Log the relationship discovery activity
    console.log(`Discovered ${newEdges.length} new relationships in the knowledge graph`);
  }

  /**
   * Extract insights from the knowledge graph structure
   * Identifies central nodes, clusters, and frequently accessed paths
   * to surface potentially valuable insights
   */
  async extractGraphInsights(): Promise<string[]> {
    const insights: string[] = [];
    const allNodes = await this.graph.getAllNodes();
    
    // 1. Find central nodes (nodes with the most connections)
    const nodeConnections = new Map<string, number>();
    
    for (const node of allNodes) {
      const relatedNodes = await this.graph.queryRelatedNodes(node.id);
      nodeConnections.set(node.id, relatedNodes.length);
    }
    
    // Sort nodes by connection count - fix for Map iteration
    const nodeConnectionsArray = Array.from(nodeConnections.entries());
    const sortedNodes = nodeConnectionsArray
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Get top 5 most connected nodes
    
    if (sortedNodes.length > 0) {
      const centralNodes = await Promise.all(
        sortedNodes.map(async ([id, count]) => {
          const node = await this.graph.getNodeById(id);
          return {
            label: node?.label || id,
            count
          };
        })
      );
      
      insights.push(
        `Most central concepts: ${centralNodes.map(n => `${n.label} (${n.count} connections)`).join(', ')}`
      );
    }
    
    // 2. Identify node clusters
    // (This would be a more complex algorithm in production, simplified here)
    const nodeTypes = new Map<string, number>();
    
    for (const node of allNodes) {
      if (!node.type) continue;
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    }
    
    // Fix for Map iteration
    const nodeTypesArray = Array.from(nodeTypes.entries());
    const dominantTypes = nodeTypesArray
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 node types
    
    if (dominantTypes.length > 0) {
      insights.push(
        `Most common knowledge types: ${dominantTypes.map(([type, count]) => `${type} (${count} nodes)`).join(', ')}`
      );
    }
    
    // 3. Generate frequency insights
    // Look at node creation timestamps to identify trends
    const recentNodes = allNodes.filter(node => 
      node.metadata?.timestamp && 
      (new Date(node.metadata.timestamp).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    );
    
    const recentNodeTypes = new Map<string, number>();
    for (const node of recentNodes) {
      if (!node.type) continue;
      recentNodeTypes.set(node.type, (recentNodeTypes.get(node.type) || 0) + 1);
    }
    
    // Fix for Map iteration
    const recentNodeTypesArray = Array.from(recentNodeTypes.entries());
    const trendingTypes = recentNodeTypesArray
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 trending node types
    
    if (trendingTypes.length > 0) {
      insights.push(
        `Trending knowledge areas: ${trendingTypes.map(([type, count]) => `${type} (${count} new nodes)`).join(', ')}`
      );
    }
    
    // 4. Check for knowledge gaps
    const nodeTypeCount = new Map<string, number>();
    for (const node of allNodes) {
      if (!node.type) continue;
      nodeTypeCount.set(node.type, (nodeTypeCount.get(node.type) || 0) + 1);
    }
    
    // Fix for Map iteration
    const nodeTypeCountArray = Array.from(nodeTypeCount.entries());
    const knowledgeGaps = nodeTypeCountArray
      .filter(([_, count]) => count < 3) // Types with very few nodes
      .map(([type]) => type);
    
    if (knowledgeGaps.length > 0) {
      insights.push(
        `Potential knowledge gaps in: ${knowledgeGaps.join(', ')}`
      );
    }
    
    // 5. Analyze metadata-based patterns
    if (allNodes.some(node => node.metadata?.importance)) {
      const highImportanceNodes = allNodes.filter(node => 
        node.metadata?.importance === 'high' || (typeof node.metadata?.importance === 'number' && node.metadata?.importance > 0.8)
      );
      
      if (highImportanceNodes.length > 0) {
        const highImportanceTypes = new Map<string, number>();
        for (const node of highImportanceNodes) {
          if (!node.type) continue;
          highImportanceTypes.set(node.type, (highImportanceTypes.get(node.type) || 0) + 1);
        }
        
        // Fix for Map iteration
        const highImportanceTypesArray = Array.from(highImportanceTypes.entries());
        const keyTypes = highImportanceTypesArray
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3); // Top 3
        
        if (keyTypes.length > 0) {
          insights.push(
            `High-importance knowledge areas: ${keyTypes.map(([type, count]) => `${type} (${count} nodes)`).join(', ')}`
          );
        }
      }
    }
    
    return insights;
  }
  
  /**
   * Check the health of the knowledge graph
   * Determines if the graph needs optimization based on various metrics
   */
  async checkGraphHealth(): Promise<GraphHealth> {
    const allNodes = await this.graph.getAllNodes();
    const allEdges = await this.graph.getAllEdges();
    
    // Count orphaned nodes (nodes with no connections)
    let orphanedNodes = 0;
    for (const node of allNodes) {
      const relatedNodes = await this.graph.queryRelatedNodes(node.id);
      if (relatedNodes.length === 0) {
        orphanedNodes++;
      }
    }
    
    // Calculate graph density
    // Density = actual edges / potential edges
    // For a directed graph, potential edges = n * (n-1)
    const potentialEdges = allNodes.length * (allNodes.length - 1);
    const density = potentialEdges > 0 ? allEdges.length / potentialEdges : 0;
    
    // Determine if optimization is needed
    let needsOptimization = false;
    let reason = "";
    
    if (orphanedNodes > allNodes.length * 0.2) { // More than 20% orphaned
      needsOptimization = true;
      reason = `${orphanedNodes} orphaned nodes (${Math.round(orphanedNodes/allNodes.length*100)}% of graph)`;
    } else if (density < 0.05 && allNodes.length > 20) { // Very sparse graph
      needsOptimization = true;
      reason = `Low graph density (${density.toFixed(3)}) with ${allNodes.length} nodes`;
    } else if (allNodes.length > 100 && allEdges.length < allNodes.length) { 
      // Large graph with fewer edges than nodes
      needsOptimization = true;
      reason = `Large graph (${allNodes.length} nodes) with insufficient connections (${allEdges.length} edges)`;
    }
    
    return {
      totalNodes: allNodes.length,
      totalEdges: allEdges.length,
      orphanedNodes,
      densityScore: density,
      needsOptimization,
      reason
    };
  }
  
  /**
   * Helper method to check if two arrays have at least one common element
   */
  private hasCommonElement<T>(arrayA: T[], arrayB: T[]): boolean {
    return arrayA.some(item => arrayB.includes(item));
  }
} 