/**
 * ExecutionTraceKnowledgeConnector
 * 
 * This service provides functionality to link execution trace data with knowledge graph entities.
 * It enables visualization of how decisions in the execution process are informed by the knowledge graph.
 */

import { ExecutionTrace, GraphNode, GraphEdge, TraceToKnowledgeMapping } from './types';

export class ExecutionTraceKnowledgeConnector {
  /**
   * Maps execution trace steps to relevant knowledge graph entities.
   * 
   * @param executionTrace The execution trace steps
   * @param knowledgeNodes Knowledge graph nodes
   * @param knowledgeEdges Knowledge graph edges
   * @returns Mappings between trace steps and knowledge entities
   */
  mapTraceToKnowledge(
    executionTrace: ExecutionTrace[],
    knowledgeNodes: GraphNode[],
    knowledgeEdges: GraphEdge[]
  ): TraceToKnowledgeMapping[] {
    return executionTrace.map((traceStep, index) => {
      // Get trace step content (what the step is about)
      const stepContent = traceStep.step;
      
      // Find matching knowledge nodes based on content similarity
      const relevantNodes = this.findRelevantNodes(stepContent, knowledgeNodes);
      const relevantNodeIds = relevantNodes.map(node => node.id);
      
      // Find relevant edges that connect the matched nodes
      const relevantEdgeIds = this.findRelevantEdges(relevantNodeIds, knowledgeEdges);
      
      // Generate mapping with confidence score
      return {
        traceStepId: `trace-${index}`,
        relevantNodeIds,
        relevantEdgeIds,
        confidenceScore: this.calculateConfidenceScore(relevantNodes, traceStep),
        explanation: this.generateExplanation(traceStep, relevantNodes)
      };
    });
  }
  
  /**
   * Find knowledge nodes relevant to an execution trace step
   */
  private findRelevantNodes(
    stepContent: string, 
    knowledgeNodes: GraphNode[]
  ): GraphNode[] {
    // Extract keywords from step content
    const keywords = this.extractKeywords(stepContent);
    
    // Find nodes that match the keywords
    // In a real implementation, this would use semantic matching
    return knowledgeNodes.filter(node => {
      const nodeText = `${node.label} ${node.description || ''}`;
      // Check if any keyword is contained in the node text
      return keywords.some(keyword => 
        nodeText.toLowerCase().includes(keyword.toLowerCase())
      );
    });
  }
  
  /**
   * Find edges that connect relevant nodes
   */
  private findRelevantEdges(
    nodeIds: string[], 
    edges: GraphEdge[]
  ): string[] {
    // Find edges where both source and target are in the relevant nodes
    const relevantEdges = edges.filter(edge => 
      nodeIds.includes(edge.from) && nodeIds.includes(edge.to)
    );
    
    return relevantEdges.map(edge => edge.id || `${edge.from}-${edge.to}`);
  }
  
  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple implementation - extract words longer than 3 chars
    // In a real implementation, this would use NLP techniques
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return Array.from(new Set(words)); // Remove duplicates
  }
  
  /**
   * Calculate confidence score for the mapping
   */
  private calculateConfidenceScore(
    nodes: GraphNode[], 
    trace: ExecutionTrace
  ): number {
    // Simple implementation - based on number of matched nodes
    // In a real implementation, this would use more sophisticated scoring
    const baseScore = Math.min(nodes.length * 0.2, 0.8);
    
    // Adjust score based on trace status
    const statusMultiplier = 
      trace.status === 'success' ? 1.0 : 
      trace.status === 'error' ? 0.7 : 0.9;
    
    return Math.min(baseScore * statusMultiplier, 1.0);
  }
  
  /**
   * Generate human-readable explanation for the mapping
   */
  private generateExplanation(
    trace: ExecutionTrace, 
    nodes: GraphNode[]
  ): string {
    if (nodes.length === 0) {
      return "No direct knowledge graph connections found.";
    }
    
    const nodeLabels = nodes.slice(0, 3).map(n => n.label).join(", ");
    const status = trace.status === 'success' ? 'successfully executed' : 
                   trace.status === 'error' ? 'failed' : 'processed';
    
    return `The "${trace.step}" step ${status} using knowledge from ${nodeLabels}${nodes.length > 3 ? ' and others' : ''}.`;
  }
  
  /**
   * Highlight traces and knowledge entities that are connected
   * 
   * @param mappings The mappings between traces and knowledge entities
   * @param selectedTraceId Optional trace ID to focus on
   * @returns Highlighted node and edge IDs
   */
  getHighlights(
    mappings: TraceToKnowledgeMapping[],
    selectedTraceId?: string
  ): { nodeIds: string[], edgeIds: string[] } {
    if (!selectedTraceId) {
      // If no trace is selected, return empty highlights
      return { nodeIds: [], edgeIds: [] };
    }
    
    // Find the mapping for the selected trace
    const mapping = mappings.find(m => m.traceStepId === selectedTraceId);
    
    if (!mapping) {
      return { nodeIds: [], edgeIds: [] };
    }
    
    return {
      nodeIds: mapping.relevantNodeIds,
      edgeIds: mapping.relevantEdgeIds
    };
  }
} 