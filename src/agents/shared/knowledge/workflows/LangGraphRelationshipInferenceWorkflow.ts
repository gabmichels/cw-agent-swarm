/**
 * LangGraphRelationshipInferenceWorkflow.ts - LangGraph-based relationship inference
 * 
 * This workflow uses LangGraph's StateGraph to orchestrate multi-step relationship inference
 * with vector similarity, semantic analysis, and intelligent reasoning.
 */

import { ulid } from 'ulid';
import { OpenAI } from 'openai';
// Use require for LangGraph to avoid TypeScript definition issues
const { StateGraph, START, END, Annotation } = require('@langchain/langgraph');
import { 
  KnowledgeNode, 
  KnowledgeEdge, 
  KnowledgeEdgeType,
  InferredEdge,
  InferenceOptions 
} from '../interfaces/KnowledgeGraph.interface';
import { QdrantKnowledgeStore } from '../QdrantKnowledgeStore';

/**
 * Configuration for LangGraph Relationship Inference Workflow
 */
export interface LangGraphRelationshipInferenceConfig {
  openAIApiKey?: string;
  knowledgeStore: QdrantKnowledgeStore;
  minConfidenceThreshold?: number;
  maxCandidates?: number;
  embeddingModel?: string;
}

/**
 * Workflow-specific interfaces
 */
export interface PotentialRelationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly potentialType: KnowledgeEdgeType;
  readonly semanticSimilarity: number;
  readonly reasoning: string;
  readonly confidence: number;
  readonly supportingEvidence: ReadonlyArray<string>;
}

export interface ReasoningStep {
  readonly stepId: string;
  readonly stepType: 'analysis' | 'scoring' | 'validation' | 'filtering';
  readonly input: unknown;
  readonly output: unknown;
  readonly reasoning: string;
  readonly timestamp: Date;
  readonly executionTimeMs: number;
}

/**
 * LangGraph-based Relationship Inference Workflow
 */
export class LangGraphRelationshipInferenceWorkflow {
  private readonly openai: OpenAI | null;
  private readonly config: Required<LangGraphRelationshipInferenceConfig>;
  private readonly graph: any; // Will be typed when LangGraph types are fixed
  
  constructor(config: LangGraphRelationshipInferenceConfig) {
    // Initialize OpenAI client with proper error handling
    this.openai = config.openAIApiKey ? new OpenAI({ 
      apiKey: config.openAIApiKey 
    }) : null;
    
    this.config = {
      openAIApiKey: config.openAIApiKey || '',
      knowledgeStore: config.knowledgeStore,
      minConfidenceThreshold: config.minConfidenceThreshold || 0.5,
      maxCandidates: config.maxCandidates || 20,
      embeddingModel: config.embeddingModel || 'text-embedding-ada-002'
    };

    // Build the LangGraph workflow
    this.graph = this.buildWorkflow();
  }

  /**
   * Build the LangGraph workflow
   */
  private buildWorkflow() {
    // Use Annotation for state definition
    const RelationshipInferenceState = Annotation.Root({
      // Input data
      nodeId: Annotation(),
      inferenceId: Annotation(),
      processingStartTime: Annotation(),
      
      // Processing state
      currentStep: Annotation(),
      sourceNode: Annotation({
        default: () => null,
      }),
      
      // Candidates and analysis
      candidateNodes: Annotation({
        default: () => [],
      }),
      potentialRelationships: Annotation({
        default: () => [],
      }),
      
      // Final results
      inferredEdges: Annotation({
        default: () => [],
      }),
      
      // Processing metadata
      confidence: Annotation({
        default: () => 0,
      }),
      errors: Annotation({
        default: () => [],
      }),
      reasoningSteps: Annotation({
        default: () => [],
      }),
    });
    
    return new StateGraph(RelationshipInferenceState)
      .addNode('initialize', this.initializeInference.bind(this))
      .addNode('get_source_node', this.getSourceNodeNode.bind(this))
      .addNode('find_candidates', this.findCandidateNodesNode.bind(this))
      .addNode('analyze_relationships', this.analyzeRelationshipsNode.bind(this))
      .addNode('validate_and_filter', this.validateAndFilterNode.bind(this))
      .addNode('convert_to_edges', this.convertToEdgesNode.bind(this))
      .addNode('finalize', this.finalizeInference.bind(this))
      .addEdge(START, 'initialize')
      .addEdge('initialize', 'get_source_node')
      .addEdge('get_source_node', 'find_candidates')
      .addEdge('find_candidates', 'analyze_relationships')
      .addEdge('analyze_relationships', 'validate_and_filter')
      .addEdge('validate_and_filter', 'convert_to_edges')
      .addEdge('convert_to_edges', 'finalize')
      .addEdge('finalize', END)
      .compile();
  }

  /**
   * Execute relationship inference workflow
   */
  async inferRelationships(options: InferenceOptions): Promise<ReadonlyArray<InferredEdge>> {
    const inferenceId = ulid();
    const startTime = Date.now();

    try {
      // Validate input options
      this.validateInferenceOptions(options);

      // Initialize state
      const initialState = {
        nodeId: options.nodeId,
        inferenceId,
        processingStartTime: startTime,
        currentStep: 'initialize',
      };

      // Execute the workflow
      const result = await this.graph.invoke(initialState);

      return result.inferredEdges || [];

    } catch (error) {
      console.error('LangGraph relationship inference failed:', error);
      return [];
    }
  }

  /**
   * Initialize inference node
   */
  private async initializeInference(state: any) {
    const reasoningStep: ReasoningStep = {
      stepId: ulid(),
      stepType: 'analysis',
      input: { nodeId: state.nodeId },
      output: { initialized: true },
      reasoning: `Starting relationship inference for node: ${state.nodeId}`,
      timestamp: new Date(),
      executionTimeMs: 0
    };

    return {
      currentStep: 'get_source_node',
      reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
    };
  }

  /**
   * Get source node node
   */
  private async getSourceNodeNode(state: any) {
    const startTime = Date.now();

    try {
      const sourceNode = await this.config.knowledgeStore.getNode(state.nodeId);
      
      if (!sourceNode) {
        return {
          currentStep: 'finalize',
          errors: [...(state.errors || []), `Source node not found: ${state.nodeId}`],
        };
      }

      const reasoningStep: ReasoningStep = {
        stepId: ulid(),
        stepType: 'analysis',
        input: { nodeId: state.nodeId },
        output: { sourceNode },
        reasoning: `Retrieved source node: ${sourceNode.label}`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      };

      return {
        currentStep: 'find_candidates',
        sourceNode,
        reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
      };

    } catch (error) {
      return {
        currentStep: 'finalize',
        errors: [...(state.errors || []), `Failed to get source node: ${error}`],
      };
    }
  }

  /**
   * Find candidate nodes node
   */
  private async findCandidateNodesNode(state: any) {
    const startTime = Date.now();

    try {
      const candidateNodes = await this.findCandidateNodes(state.sourceNode, state);
      
      const reasoningStep: ReasoningStep = {
        stepId: ulid(),
        stepType: 'analysis',
        input: { sourceNode: state.sourceNode },
        output: { candidateCount: candidateNodes.length },
        reasoning: `Found ${candidateNodes.length} candidate nodes for relationship inference`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      };

      return {
        currentStep: 'analyze_relationships',
        candidateNodes,
        reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
      };

    } catch (error) {
      return {
        currentStep: 'finalize',
        errors: [...(state.errors || []), `Failed to find candidates: ${error}`],
      };
    }
  }

  /**
   * Analyze relationships node
   */
  private async analyzeRelationshipsNode(state: any) {
    const startTime = Date.now();

    try {
      const potentialRelationships: PotentialRelationship[] = [];
      
      for (const candidate of state.candidateNodes || []) {
        const relationship = await this.analyzeRelationshipPair(state.sourceNode, candidate);
        if (relationship) {
          potentialRelationships.push(relationship);
        }
      }

      const reasoningStep: ReasoningStep = {
        stepId: ulid(),
        stepType: 'scoring',
        input: { candidateNodes: state.candidateNodes },
        output: { potentialRelationships },
        reasoning: `Analyzed relationships and found ${potentialRelationships.length} potential relationships`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      };

      return {
        currentStep: 'validate_and_filter',
        potentialRelationships,
        reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
      };

    } catch (error) {
      return {
        currentStep: 'validate_and_filter',
        potentialRelationships: [],
        errors: [...(state.errors || []), `Failed to analyze relationships: ${error}`],
      };
    }
  }

  /**
   * Validate and filter node
   */
  private async validateAndFilterNode(state: any) {
    const startTime = Date.now();

    const validatedRelationships = (state.potentialRelationships || [])
      .filter((rel: PotentialRelationship) => rel.confidence >= this.config.minConfidenceThreshold)
      .sort((a: PotentialRelationship, b: PotentialRelationship) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10

    const reasoningStep: ReasoningStep = {
      stepId: ulid(),
      stepType: 'validation',
      input: { potentialRelationships: state.potentialRelationships },
      output: { validatedRelationships },
      reasoning: `Validated and filtered to ${validatedRelationships.length} high-confidence relationships`,
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };

    return {
      currentStep: 'convert_to_edges',
      potentialRelationships: validatedRelationships,
      reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
    };
  }

  /**
   * Convert to edges node
   */
  private async convertToEdgesNode(state: any) {
    const inferredEdges: InferredEdge[] = (state.potentialRelationships || []).map((rel: PotentialRelationship) => ({
      from: rel.from,
      to: rel.to,
      type: rel.potentialType,
      label: this.generateRelationshipLabel(rel),
      strength: rel.confidence,
      createdAt: new Date(),
      updatedAt: new Date(),
      properties: {
        semanticSimilarity: rel.semanticSimilarity.toString(),
        reasoning: rel.reasoning,
        supportingEvidence: JSON.stringify(rel.supportingEvidence)
      },
      metadata: {
        inferenceId: state.inferenceId,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0',
        source: 'LangGraphRelationshipInferenceWorkflow'
      },
      inferenceConfidence: rel.confidence,
      inferenceMethod: 'langgraph_workflow',
      reasoning: rel.reasoning,
    }));

    return {
      currentStep: 'finalize',
      inferredEdges,
    };
  }

  /**
   * Finalize inference node
   */
  private async finalizeInference(state: any) {
    const processingTime = Date.now() - (state.processingStartTime || Date.now());
    
    const reasoningStep: ReasoningStep = {
      stepId: ulid(),
      stepType: 'validation',
      input: { inferredEdges: state.inferredEdges },
      output: { completed: true },
      reasoning: `Inference completed with ${state.inferredEdges?.length || 0} inferred relationships in ${processingTime}ms`,
      timestamp: new Date(),
      executionTimeMs: processingTime
    };

    return {
      currentStep: 'completed',
      reasoningSteps: [...(state.reasoningSteps || []), reasoningStep],
    };
  }

  /**
   * Find candidate nodes for relationship inference
   */
  private async findCandidateNodes(
    sourceNode: KnowledgeNode, 
    state: any
  ): Promise<ReadonlyArray<KnowledgeNode>> {
    try {
      // Use vector similarity search if available
      if (this.config.knowledgeStore && typeof (this.config.knowledgeStore as any).findSimilarNodes === 'function') {
        const similarNodes = await (this.config.knowledgeStore as any).findSimilarNodes(
          sourceNode.label + ' ' + (sourceNode.description || ''),
          {
            limit: this.config.maxCandidates,
            minSimilarity: 0.3,
            excludeIds: [sourceNode.id]
          }
        );
        return similarNodes;
      }

      // Fallback: get some nodes from the store using findNodes
      if (this.config.knowledgeStore && typeof (this.config.knowledgeStore as any).findNodes === 'function') {
        const nodes = await (this.config.knowledgeStore as any).findNodes('', {
          limit: this.config.maxCandidates,
          excludeIds: [sourceNode.id]
        });
        return nodes.slice(0, this.config.maxCandidates);
      }

      // Last resort: return empty array
      return [];

    } catch (error) {
      console.warn('Failed to find candidate nodes:', error);
      return [];
    }
  }

  /**
   * Analyze relationship between two nodes
   */
  private async analyzeRelationshipPair(
    sourceNode: KnowledgeNode,
    targetNode: KnowledgeNode
  ): Promise<PotentialRelationship | null> {
    try {
      if (this.openai) {
        return await this.analyzeRelationshipWithLLM(sourceNode, targetNode);
      } else {
        return this.analyzeRelationshipSimple(sourceNode, targetNode);
      }
    } catch (error) {
      console.warn('Relationship analysis failed:', error);
      return this.analyzeRelationshipSimple(sourceNode, targetNode);
    }
  }

  /**
   * Analyze relationship using LLM
   */
  private async analyzeRelationshipWithLLM(
    sourceNode: KnowledgeNode,
    targetNode: KnowledgeNode
  ): Promise<PotentialRelationship | null> {
    if (!this.openai) {
      return this.analyzeRelationshipSimple(sourceNode, targetNode);
    }

    try {
      const prompt = this.buildRelationshipAnalysisPrompt(sourceNode, targetNode);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        return this.analyzeRelationshipSimple(sourceNode, targetNode);
      }

      // Parse the LLM response
      const analysis = JSON.parse(result.trim());
      
      if (analysis.hasRelationship && analysis.confidence > 0.3) {
        return {
          id: ulid(),
          from: sourceNode.id,
          to: targetNode.id,
          potentialType: this.mapToKnowledgeEdgeType(analysis.relationshipType),
          semanticSimilarity: analysis.semanticSimilarity || 0.5,
          reasoning: analysis.reasoning || 'LLM analysis',
          confidence: analysis.confidence,
          supportingEvidence: analysis.evidence || [],
        };
      }

      return null;

    } catch (error) {
      console.warn('LLM relationship analysis failed:', error);
      return this.analyzeRelationshipSimple(sourceNode, targetNode);
    }
  }

  /**
   * Simple relationship analysis without LLM
   */
  private analyzeRelationshipSimple(
    sourceNode: KnowledgeNode,
    targetNode: KnowledgeNode
  ): PotentialRelationship | null {
    // Simple heuristic: check for common words
    const sourceWords = new Set(sourceNode.label.toLowerCase().split(/\s+/));
    const targetWords = new Set(targetNode.label.toLowerCase().split(/\s+/));
    
    const commonWords = new Set([...sourceWords].filter(word => targetWords.has(word)));
    const similarity = commonWords.size / Math.max(sourceWords.size, targetWords.size);
    
    if (similarity > 0.2) {
      return {
        id: ulid(),
        from: sourceNode.id,
        to: targetNode.id,
        potentialType: KnowledgeEdgeType.RELATED_TO,
        semanticSimilarity: similarity,
        reasoning: `Shared ${commonWords.size} common words: ${Array.from(commonWords).join(', ')}`,
        confidence: Math.min(similarity * 2, 0.8),
        supportingEvidence: [`Common words: ${Array.from(commonWords).join(', ')}`],
      };
    }

    return null;
  }

  /**
   * Build relationship analysis prompt for LLM
   */
  private buildRelationshipAnalysisPrompt(sourceNode: KnowledgeNode, targetNode: KnowledgeNode): string {
    return `Analyze the potential relationship between these two knowledge entities:

Source Entity:
- Label: "${sourceNode.label}"
- Type: ${sourceNode.type}
- Description: ${sourceNode.description || 'N/A'}

Target Entity:
- Label: "${targetNode.label}"
- Type: ${targetNode.type}
- Description: ${targetNode.description || 'N/A'}

Determine if there is a meaningful relationship between these entities and respond with JSON:

{
  "hasRelationship": boolean,
  "relationshipType": "RELATED_TO|DEPENDS_ON|SUPPORTS|USED_BY|PART_OF|LEADS_TO|SIMILAR_TO|INFLUENCES",
  "confidence": number (0-1),
  "semanticSimilarity": number (0-1),
  "reasoning": "detailed explanation",
  "evidence": ["supporting evidence point 1", "supporting evidence point 2"]
}

Focus on semantic meaning and logical connections.`;
  }

  /**
   * Map string to KnowledgeEdgeType
   */
  private mapToKnowledgeEdgeType(typeString: string): KnowledgeEdgeType {
    const typeMap: Record<string, KnowledgeEdgeType> = {
      'RELATED_TO': KnowledgeEdgeType.RELATED_TO,
      'DEPENDS_ON': KnowledgeEdgeType.DEPENDS_ON,
      'CONTRADICTS': KnowledgeEdgeType.CONTRADICTS,
      'SUPPORTS': KnowledgeEdgeType.SUPPORTS,
      'USED_BY': KnowledgeEdgeType.USED_BY,
      'REPORTED_BY': KnowledgeEdgeType.REPORTED_BY,
      'PRODUCED_BY': KnowledgeEdgeType.PRODUCED_BY,
      'PART_OF': KnowledgeEdgeType.PART_OF,
      'LEADS_TO': KnowledgeEdgeType.LEADS_TO,
      'SIMILAR_TO': KnowledgeEdgeType.SIMILAR_TO,
      'DERIVED_FROM': KnowledgeEdgeType.DERIVED_FROM,
      'INFLUENCES': KnowledgeEdgeType.INFLUENCES,
      'CATEGORIZES': KnowledgeEdgeType.CATEGORIZES,
      'REFERENCES': KnowledgeEdgeType.REFERENCES,
    };
    
    return typeMap[typeString?.toUpperCase()] || KnowledgeEdgeType.RELATED_TO;
  }

  /**
   * Generate relationship label
   */
  private generateRelationshipLabel(relationship: PotentialRelationship): string {
    const typeLabel = relationship.potentialType.toLowerCase().replace('_', ' ');
    return `${typeLabel} (confidence: ${Math.round(relationship.confidence * 100)}%)`;
  }

  /**
   * Validate inference options
   */
  private validateInferenceOptions(options: InferenceOptions): void {
    if (!options.nodeId) {
      throw new Error('Node ID is required for relationship inference');
    }
    
    if (typeof options.nodeId !== 'string' || options.nodeId.trim().length === 0) {
      throw new Error('Node ID must be a non-empty string');
    }
  }
} 