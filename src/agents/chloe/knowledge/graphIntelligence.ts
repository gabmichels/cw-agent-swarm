/**
 * Graph Intelligence Engine for Chloe's Knowledge Graph
 * Provides advanced features for automating knowledge extraction, 
 * relationship discovery, and insight generation.
 */

import { KnowledgeGraphManager } from './graphManager';
import { KnowledgeNode, KnowledgeEdge, KnowledgeNodeType, KnowledgeEdgeType } from './graph';

export class GraphIntelligenceEngine {
  constructor(private graph: KnowledgeGraphManager) {}

  /**
   * Automatically extracts knowledge from text content and adds it to the graph
   * @param content The text content to analyze for knowledge extraction
   * @param contextTags Optional tags to associate with extracted knowledge
   */
  async autoExpandFromText(content: string, contextTags: string[] = []): Promise<void> {
    try {
      console.log('📚 Expanding knowledge graph from text...');
      
      // This would use LLM to extract entities and relationships
      // For demonstration, we'll implement a simplified version
      
      // Example extracted concepts (in a real implementation, this would come from LLM)
      const extractedConcepts = [
        { label: 'Bitcoin', type: 'concept' as KnowledgeNodeType, description: 'A decentralized digital currency' },
        { label: 'Halving cycles', type: 'trend' as KnowledgeNodeType, description: 'The periodic halving of Bitcoin mining rewards' },
        { label: 'Glassnode', type: 'tool' as KnowledgeNodeType, description: 'On-chain analytics platform' }
      ];
      
      // Add the extracted concepts to the graph
      const addedNodeIds = [];
      
      for (const concept of extractedConcepts) {
        const nodeId = `${concept.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        await this.graph.addNode({
          id: nodeId,
          label: concept.label,
          type: concept.type,
          description: concept.description,
          tags: [...contextTags, concept.type],
          metadata: {
            extractedFrom: 'text',
            extractedAt: new Date().toISOString()
          }
        });
        
        addedNodeIds.push(nodeId);
        console.log(`✅ Added ${concept.type} node: ${concept.label}`);
      }
      
      // Auto-link nodes based on their types (simplified example)
      if (addedNodeIds.length >= 2) {
        for (let i = 0; i < addedNodeIds.length; i++) {
          for (let j = i + 1; j < addedNodeIds.length; j++) {
            const node1 = await this.graph.getNodeById(addedNodeIds[i]);
            const node2 = await this.graph.getNodeById(addedNodeIds[j]);
            
            if (node1 && node2) {
              // Determine relationship type based on node types
              let relationType: KnowledgeEdgeType = 'related_to';
              
              if (node1.type === 'tool' || node2.type === 'tool') {
                relationType = 'used_by';
              } else if (node1.type === 'trend' || node2.type === 'trend') {
                relationType = 'supports';
              }
              
              await this.graph.addEdge({
                from: node1.id,
                to: node2.id,
                type: relationType,
                strength: 0.7, // Initial confidence
                label: `Auto-linked ${node1.type} to ${node2.type}`
              });
              
              console.log(`✅ Linked ${node1.label} to ${node2.label} (${relationType})`);
            }
          }
        }
      }
      
      console.log(`📊 Knowledge graph expanded with ${extractedConcepts.length} new nodes`);
    } catch (error) {
      console.error('Error in autoExpandFromText:', error);
      throw error;
    }
  }

  /**
   * Discovers potentially missing relationships between existing nodes
   * based on similarity, co-occurrence, or other patterns
   */
  async discoverMissingRelationships(): Promise<void> {
    try {
      console.log('🔍 Discovering missing relationships...');
      
      // This would use embedding similarity or other algorithms to find potential relationships
      // For demonstration, we'll implement a simplified version
      
      // Get all nodes
      const allNodes = await this.graph.getAllNodes();
      
      // Example logic: nodes with similar tags might be related
      const potentialRelationships: Array<{from: KnowledgeNode, to: KnowledgeNode, confidence: number}> = [];
      
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const node1 = allNodes[i];
          const node2 = allNodes[j];
          
          // Skip if already directly connected
          const relatedNodes = await this.graph.queryRelatedNodes(node1.id);
          if (relatedNodes.some(node => node.id === node2.id)) {
            continue;
          }
          
          // Check for tag overlap
          const node1Tags = node1.tags || [];
          const node2Tags = node2.tags || [];
          
          const sharedTags = node1Tags.filter(tag => node2Tags.includes(tag));
          
          if (sharedTags.length > 0) {
            const confidence = sharedTags.length / Math.max(node1Tags.length, node2Tags.length);
            
            if (confidence > 0.3) { // Threshold for suggested relationship
              potentialRelationships.push({
                from: node1,
                to: node2,
                confidence
              });
            }
          }
        }
      }
      
      // Add the discovered relationships
      let addedCount = 0;
      
      for (const rel of potentialRelationships) {
        await this.graph.addEdge({
          from: rel.from.id,
          to: rel.to.id,
          type: 'related_to',
          strength: rel.confidence,
          label: `Discovered relationship based on shared tags: ${rel.from.tags?.filter(tag => rel.to.tags?.includes(tag)).join(', ')}`
        });
        
        addedCount++;
        console.log(`✅ Added relationship between ${rel.from.label} and ${rel.to.label} (confidence: ${rel.confidence.toFixed(2)})`);
      }
      
      console.log(`📊 Added ${addedCount} new relationships to knowledge graph`);
    } catch (error) {
      console.error('Error in discoverMissingRelationships:', error);
      throw error;
    }
  }

  /**
   * Extracts insights from the graph structure and pattern analysis
   * @returns Array of insight strings
   */
  async extractInsights(): Promise<string[]> {
    try {
      console.log('💡 Extracting insights from knowledge graph...');
      
      const insights: string[] = [];
      
      // This would use graph algorithms to find patterns and insights
      // For demonstration, we'll implement a simplified version
      
      // Get all nodes and edges
      const allNodes = await this.graph.getAllNodes();
      const allEdges = await this.graph.getAllEdges();
      
      // Example insight: Central nodes (highest degree)
      const nodeDegrees = new Map<string, number>();
      
      for (const edge of allEdges) {
        nodeDegrees.set(edge.from, (nodeDegrees.get(edge.from) || 0) + 1);
        nodeDegrees.set(edge.to, (nodeDegrees.get(edge.to) || 0) + 1);
      }
      
      // Fix for linter error: Convert Map to array before sorting
      const degreeEntries: [string, number][] = [];
      nodeDegrees.forEach((value, key) => {
        degreeEntries.push([key, value]);
      });
      
      const sortedNodes = degreeEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (sortedNodes.length > 0) {
        const centralNodes = await Promise.all(
          sortedNodes.map(async ([id, degree]) => {
            const node = await this.graph.getNodeById(id);
            return node ? `${node.label} (${degree} connections)` : '';
          })
        );
        
        const centralNodesInsight = `Central concepts in your knowledge graph: ${centralNodes.filter(Boolean).join(', ')}`;
        insights.push(centralNodesInsight);
        
        // Store insight as a node
        await this.graph.addNode({
          id: `insight-central-${Date.now()}`,
          label: 'Central Concepts Insight',
          type: 'insight',
          description: centralNodesInsight,
          tags: ['graph_analysis', 'centrality'],
          metadata: {
            createdAt: new Date().toISOString(),
            insightType: 'centrality'
          }
        });
      }
      
      // Example insight: Potential knowledge gaps (disconnected components)
      // Find all unique node types in the graph
      const nodeTypes = new Set<KnowledgeNodeType>();
      for (const node of allNodes) {
        nodeTypes.add(node.type);
      }
      
      // Fix for linter error: Convert Set to array before iterating
      const nodeTypesArray = Array.from(nodeTypes);
      
      // Check if any node type has no connections to other types
      const disconnectedTypes: string[] = [];
      
      for (const type of nodeTypesArray) {
        const typeNodes = allNodes.filter(node => node.type === type);
        
        // Check if nodes of this type connect to nodes of other types
        let hasConnectionToOtherType = false;
        
        for (const node of typeNodes) {
          const connectedNodes = await this.graph.queryRelatedNodes(node.id);
          if (connectedNodes.some(n => n.type !== type)) {
            hasConnectionToOtherType = true;
            break;
          }
        }
        
        if (!hasConnectionToOtherType && typeNodes.length > 0) {
          disconnectedTypes.push(type);
        }
      }
      
      if (disconnectedTypes.length > 0) {
        const gapInsight = `Potential knowledge gap: ${disconnectedTypes.join(', ')} are isolated from other knowledge types.`;
        insights.push(gapInsight);
        
        // Store insight as a node
        await this.graph.addNode({
          id: `insight-gap-${Date.now()}`,
          label: 'Knowledge Gap Insight',
          type: 'insight',
          description: gapInsight,
          tags: ['graph_analysis', 'knowledge_gap'],
          metadata: {
            createdAt: new Date().toISOString(),
            insightType: 'knowledge_gap'
          }
        });
      }
      
      console.log(`💡 Extracted ${insights.length} insights from knowledge graph`);
      return insights;
    } catch (error) {
      console.error('Error in extractInsights:', error);
      throw error;
    }
  }
} 