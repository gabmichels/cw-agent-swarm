/**
 * RelationshipInferenceWorkflow.ts - Intelligent relationship discovery workflow
 * 
 * This workflow uses multi-step reasoning to discover and validate relationships
 * between knowledge nodes using vector similarity and semantic analysis.
 */

import { ulid } from 'ulid';
import { OpenAI } from 'openai';
import { 
  KnowledgeNode, 
  KnowledgeEdge, 
  KnowledgeEdgeType,
  InferredEdge,
  InferenceOptions 
} from '../interfaces/KnowledgeGraph.interface';
import { QdrantKnowledgeStore } from '../QdrantKnowledgeStore';

/**
 * Configuration for Relationship Inference Workflow
 */
export interface RelationshipInferenceConfig {
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
 * Custom error types for relationship inference
 */
export class RelationshipInferenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'RelationshipInferenceError';
  }
}

export class InferenceValidationError extends RelationshipInferenceError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_FAILED', context);
    this.name = 'InferenceValidationError';
  }
}

/**
 * Simplified Relationship Inference Workflow
 * 
 * Avoids LangGraph API compatibility issues while providing comprehensive
 * relationship inference capabilities.
 */
export class RelationshipInferenceWorkflow {
  private readonly openai: OpenAI | null;
  private readonly config: Required<RelationshipInferenceConfig>;
  
  constructor(config: RelationshipInferenceConfig) {
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
  }

  /**
   * Execute relationship inference workflow
   */
  async inferRelationships(options: InferenceOptions): Promise<ReadonlyArray<InferredEdge>> {
    const inferenceId = ulid();
    const startTime = Date.now();
    const reasoningChain: ReasoningStep[] = [];

    try {
      // Validate input options
      this.validateInferenceOptions(options);

      // Step 1: Get source node
      const sourceNode = await this.config.knowledgeStore.getNode(options.nodeId);
      if (!sourceNode) {
        throw new RelationshipInferenceError(
          `Source node not found: ${options.nodeId}`,
          'NODE_NOT_FOUND'
        );
      }

      reasoningChain.push({
        stepId: ulid(),
        stepType: 'analysis',
        input: { nodeId: options.nodeId },
        output: { sourceNode },
        reasoning: `Retrieved source node: ${sourceNode.label}`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      });

      // Step 2: Find candidate nodes
      const targetCandidates = await this.findCandidateNodes(sourceNode, options);
      
      reasoningChain.push({
        stepId: ulid(),
        stepType: 'analysis',
        input: { sourceNode, options },
        output: { candidateCount: targetCandidates.length },
        reasoning: `Found ${targetCandidates.length} candidate nodes for relationship inference`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      });

      // Step 3: Analyze potential relationships
      const potentialRelationships: PotentialRelationship[] = [];
      for (const candidate of targetCandidates) {
        const relationship = await this.analyzeRelationshipPair(sourceNode, candidate);
        if (relationship) {
          potentialRelationships.push(relationship);
        }
      }

      reasoningChain.push({
        stepId: ulid(),
        stepType: 'scoring',
        input: { targetCandidates },
        output: { potentialRelationships },
        reasoning: `Analyzed relationships and found ${potentialRelationships.length} potential relationships`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      });

      // Step 4: Validate and filter relationships
      const validatedRelationships = potentialRelationships
        .filter(rel => rel.confidence >= this.config.minConfidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, options.maxInferences || 10);

      reasoningChain.push({
        stepId: ulid(),
        stepType: 'validation',
        input: { potentialRelationships },
        output: { validatedRelationships },
        reasoning: `Validated and filtered to ${validatedRelationships.length} high-confidence relationships`,
        timestamp: new Date(),
        executionTimeMs: Date.now() - startTime
      });

      // Step 5: Convert to InferredEdges
      const inferredEdges: InferredEdge[] = validatedRelationships.map(rel => ({
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
          inferenceId,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0',
          source: 'RelationshipInferenceWorkflow'
        },
        inferenceConfidence: rel.confidence,
        inferenceMethod: 'semantic_analysis',
        reasoning: rel.reasoning
      }));

      return inferredEdges;

    } catch (error) {
      throw new RelationshipInferenceError(
        'Failed to execute relationship inference workflow',
        'EXECUTION_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Find candidate nodes for relationship inference
   */
  private async findCandidateNodes(
    sourceNode: KnowledgeNode, 
    options: InferenceOptions
  ): Promise<ReadonlyArray<KnowledgeNode>> {
    try {
      // Use vector similarity search if available
      const searchResults = await this.config.knowledgeStore.searchNodes(
        sourceNode.label + ' ' + (sourceNode.description || ''),
        {
          limit: this.config.maxCandidates,
          scoreThreshold: 0.3 // Lower threshold for candidates
        }
      );

      // Extract nodes from search results, filtering out the source node
      const candidateNodes = searchResults
        .map(result => result.node)
        .filter(node => node.id !== sourceNode.id);

      if (candidateNodes.length > 0) {
        return candidateNodes;
      }

      // Fallback to getting nearby nodes
      const allNodes = await this.config.knowledgeStore.getAllNodes();
      return allNodes
        .filter(node => node.id !== sourceNode.id)
        .slice(0, this.config.maxCandidates);
    } catch (error) {
      console.warn('Failed to find candidate nodes, using empty list:', error);
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
        // Use LLM for sophisticated analysis
        const prompt = this.buildRelationshipAnalysisPrompt(sourceNode, targetNode);
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        });

        const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
        
        if (analysis.hasRelationship && analysis.confidence > 0.3) {
          return {
            id: ulid(),
            from: sourceNode.id,
            to: targetNode.id,
            potentialType: this.mapToKnowledgeEdgeType(analysis.relationshipType),
            semanticSimilarity: analysis.semanticSimilarity || 0.5,
            reasoning: analysis.reasoning || 'LLM-based analysis',
            confidence: analysis.confidence,
            supportingEvidence: analysis.evidence || []
          };
        }
      }

      // Fallback to simple analysis
      return this.analyzeRelationshipSimple(sourceNode, targetNode);
    } catch (error) {
      console.warn('Relationship analysis failed, using simple method:', error);
      return this.analyzeRelationshipSimple(sourceNode, targetNode);
    }
  }

  /**
   * Simple relationship analysis fallback
   */
  private analyzeRelationshipSimple(
    sourceNode: KnowledgeNode,
    targetNode: KnowledgeNode
  ): PotentialRelationship | null {
    // Simple similarity based on label overlap
    const sourceWords = sourceNode.label.toLowerCase().split(/\s+/);
    const targetWords = targetNode.label.toLowerCase().split(/\s+/);
    
    const commonWords = sourceWords.filter(word => 
      targetWords.includes(word) && word.length > 3
    );
    
    if (commonWords.length > 0) {
      const similarity = commonWords.length / Math.max(sourceWords.length, targetWords.length);
      
      if (similarity > 0.2) {
        return {
          id: ulid(),
          from: sourceNode.id,
          to: targetNode.id,
          potentialType: KnowledgeEdgeType.RELATED_TO,
          semanticSimilarity: similarity,
          reasoning: `Nodes share common terms: ${commonWords.join(', ')}`,
          confidence: Math.min(0.7, similarity * 2),
          supportingEvidence: [`Common words: ${commonWords.join(', ')}`]
        };
      }
    }

    return null;
  }

  /**
   * Build relationship analysis prompt for LLM
   */
  private buildRelationshipAnalysisPrompt(sourceNode: KnowledgeNode, targetNode: KnowledgeNode): string {
    return `Analyze the relationship between these two knowledge nodes:

Source Node:
- Label: ${sourceNode.label}
- Type: ${sourceNode.type}
- Description: ${sourceNode.description || 'N/A'}

Target Node:
- Label: ${targetNode.label}
- Type: ${targetNode.type}
- Description: ${targetNode.description || 'N/A'}

Return a JSON object with:
{
  "hasRelationship": boolean,
  "relationshipType": "related_to" | "depends_on" | "part_of" | "similar_to" | "influences" | "supports",
  "confidence": number (0-1),
  "semanticSimilarity": number (0-1),
  "reasoning": "explanation of the relationship",
  "evidence": ["evidence1", "evidence2"]
}

Focus on meaningful semantic relationships, not just superficial similarity.`;
  }

  /**
   * Map string to KnowledgeEdgeType
   */
  private mapToKnowledgeEdgeType(typeString: string): KnowledgeEdgeType {
    const typeMap: Record<string, KnowledgeEdgeType> = {
      'depends_on': KnowledgeEdgeType.DEPENDS_ON,
      'part_of': KnowledgeEdgeType.PART_OF,
      'used_by': KnowledgeEdgeType.USED_BY,
      'similar_to': KnowledgeEdgeType.SIMILAR_TO,
      'influences': KnowledgeEdgeType.INFLUENCES,
      'related_to': KnowledgeEdgeType.RELATED_TO,
      'supports': KnowledgeEdgeType.SUPPORTS,
      'contradicts': KnowledgeEdgeType.CONTRADICTS,
      'references': KnowledgeEdgeType.REFERENCES,
      'categorizes': KnowledgeEdgeType.CATEGORIZES
    };

    return typeMap[typeString.toLowerCase()] || KnowledgeEdgeType.RELATED_TO;
  }

  /**
   * Generate relationship label
   */
  private generateRelationshipLabel(relationship: PotentialRelationship): string {
    const typeLabels: Record<KnowledgeEdgeType, string> = {
      [KnowledgeEdgeType.RELATED_TO]: 'related to',
      [KnowledgeEdgeType.DEPENDS_ON]: 'depends on',
      [KnowledgeEdgeType.PART_OF]: 'part of',
      [KnowledgeEdgeType.SIMILAR_TO]: 'similar to',
      [KnowledgeEdgeType.INFLUENCES]: 'influences',
      [KnowledgeEdgeType.SUPPORTS]: 'supports',
      [KnowledgeEdgeType.CONTRADICTS]: 'contradicts',
      [KnowledgeEdgeType.USED_BY]: 'used by',
      [KnowledgeEdgeType.PRODUCED_BY]: 'produced by',
      [KnowledgeEdgeType.REPORTED_BY]: 'reported by',
      [KnowledgeEdgeType.LEADS_TO]: 'leads to',
      [KnowledgeEdgeType.DERIVED_FROM]: 'derived from',
      [KnowledgeEdgeType.CATEGORIZES]: 'categorizes',
      [KnowledgeEdgeType.REFERENCES]: 'references'
    };

    return typeLabels[relationship.potentialType] || 'related to';
  }

  /**
   * Validate inference options
   */
  private validateInferenceOptions(options: InferenceOptions): void {
    if (!options.nodeId) {
      throw new InferenceValidationError('nodeId is required for inference');
    }

    if (options.minConfidence !== undefined && 
        (options.minConfidence < 0 || options.minConfidence > 1)) {
      throw new InferenceValidationError('minConfidence must be between 0 and 1');
    }

    if (options.maxInferences !== undefined && options.maxInferences < 1) {
      throw new InferenceValidationError('maxInferences must be greater than 0');
    }
  }
}