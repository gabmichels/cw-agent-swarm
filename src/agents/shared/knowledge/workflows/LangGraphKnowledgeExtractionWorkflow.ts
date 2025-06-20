/**
 * LangGraphKnowledgeExtractionWorkflow.ts - LangGraph-based knowledge extraction
 * 
 * This workflow uses LangGraph's StateGraph to orchestrate multi-step knowledge extraction
 * with proper state management, error handling, and intelligent reasoning.
 */

import { ulid } from 'ulid';
import { OpenAI } from 'openai';
// Use require for LangGraph to avoid TypeScript definition issues
const { StateGraph, START, END, Annotation } = require('@langchain/langgraph');
import { 
  KnowledgeNode, 
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  KnowledgeExtractionOptions,
  KnowledgeExtractionResult
} from '../interfaces/KnowledgeGraph.interface';
import { QdrantKnowledgeStore } from '../QdrantKnowledgeStore';

/**
 * Configuration for LangGraph Knowledge Extraction Workflow
 */
export interface LangGraphKnowledgeExtractionConfig {
  openAIApiKey?: string;
  qdrantStore?: QdrantKnowledgeStore;
  extractionModel?: string;
  maxEntities?: number;
  maxRelationships?: number;
  minConfidenceThreshold?: number;
}

/**
 * Workflow-specific interfaces
 */
interface ExtractedEntity {
  id: string;
  text: string;
  type: string;
  confidence: number;
  positions?: Array<{ start: number; end: number }>;
  properties?: Record<string, string | number | boolean | null>;
  extractionMethod?: string;
}

interface ExtractedRelationship {
  id: string;
  sourceEntity?: ExtractedEntity;
  targetEntity?: ExtractedEntity;
  type: string;
  confidence: number;
  evidence?: string[];
  reasoning?: string;
  properties?: Record<string, string | number | boolean | null>;
  extractionMethod?: string;
}

interface ExtractionStep {
  stepId: string;
  type: string;
  timestamp: Date;
  status: 'completed' | 'failed' | 'skipped';
  details: string;
  confidence: number;
  processingTime?: number;
}

/**
 * LangGraph-based Knowledge Extraction Workflow
 */
export class LangGraphKnowledgeExtractionWorkflow {
  private readonly openai: OpenAI | null;
  private readonly config: Required<LangGraphKnowledgeExtractionConfig>;
  private readonly graph: any; // Will be typed when LangGraph types are fixed

  constructor(config: LangGraphKnowledgeExtractionConfig = {}) {
    this.openai = config.openAIApiKey ? new OpenAI({ apiKey: config.openAIApiKey }) : null;
    
    this.config = {
      openAIApiKey: config.openAIApiKey || '',
      qdrantStore: config.qdrantStore || null as any,
      extractionModel: config.extractionModel || 'gpt-4',
      maxEntities: config.maxEntities || 50,
      maxRelationships: config.maxRelationships || 100,
      minConfidenceThreshold: config.minConfidenceThreshold || 0.3
    };

    // Build the LangGraph workflow
    this.graph = this.buildWorkflow();
  }

  /**
   * Build the LangGraph workflow
   */
  private buildWorkflow() {
    // Use Annotation for state definition
    const KnowledgeExtractionState = Annotation.Root({
      // Input data
      content: Annotation(),
      source: Annotation(),
      extractionId: Annotation(),
      
      // Processing state
      currentStep: Annotation(),
      processingStartTime: Annotation(),
      
      // Extracted data
      rawEntities: Annotation({
        default: () => [],
      }),
      rawRelationships: Annotation({
        default: () => [],
      }),
      
      // Final results
      nodes: Annotation({
        default: () => [],
      }),
      edges: Annotation({
        default: () => [],
      }),
      
      // Processing metadata
      confidence: Annotation({
        default: () => 0,
      }),
      errors: Annotation({
        default: () => [],
      }),
      steps: Annotation({
        default: () => [],
      }),
    });
    
    return new StateGraph(KnowledgeExtractionState)
      .addNode('initialize', this.initializeExtraction.bind(this))
      .addNode('extract_entities', this.extractEntitiesNode.bind(this))
      .addNode('extract_relationships', this.extractRelationshipsNode.bind(this))
      .addNode('create_nodes', this.createKnowledgeNodesNode.bind(this))
      .addNode('create_edges', this.createKnowledgeEdgesNode.bind(this))
      .addNode('finalize', this.finalizeExtraction.bind(this))
      .addEdge(START, 'initialize')
      .addEdge('initialize', 'extract_entities')
      .addEdge('extract_entities', 'extract_relationships')
      .addEdge('extract_relationships', 'create_nodes')
      .addEdge('create_nodes', 'create_edges')
      .addEdge('create_edges', 'finalize')
      .addEdge('finalize', END)
      .compile();
  }

  /**
   * Execute the knowledge extraction workflow
   */
  public async extractKnowledge(options: KnowledgeExtractionOptions): Promise<KnowledgeExtractionResult> {
    const extractionId = ulid();
    const startTime = Date.now();

    try {
      // Initialize state
      const initialState = {
        content: options.content,
        source: options.source || 'unknown',
        extractionId,
        currentStep: 'initialize',
        processingStartTime: startTime,
      };

      // Execute the workflow
      const result = await this.graph.invoke(initialState);

      // Return formatted result
      return {
        nodes: result.nodes || [],
        edges: result.edges || [],
        confidence: result.confidence || 0,
        stats: {
          processingTimeMs: Date.now() - startTime,
          entityCount: result.rawEntities?.length || 0,
          relationshipCount: result.rawRelationships?.length || 0,
          avgConfidence: result.confidence || 0
        }
      };

    } catch (error) {
      console.error('LangGraph knowledge extraction failed:', error);
      
      return {
        nodes: [],
        edges: [],
        confidence: 0,
        stats: {
          processingTimeMs: Date.now() - startTime,
          entityCount: 0,
          relationshipCount: 0,
          avgConfidence: 0
        }
      };
    }
  }

  /**
   * Initialize extraction node
   */
  private async initializeExtraction(state: any) {
    const step: ExtractionStep = {
      stepId: ulid(),
      type: 'initialize',
      timestamp: new Date(),
      status: 'completed',
      details: `Initialized extraction for content length: ${state.content.length}`,
      confidence: 1.0
    };

    return {
      currentStep: 'extract_entities',
      steps: [...(state.steps || []), step],
    };
  }

  /**
   * Extract entities node
   */
  private async extractEntitiesNode(state: any) {
    const startTime = Date.now();

    try {
      const entities = await this.extractEntities(state.content, state);
      
      const step: ExtractionStep = {
        stepId: ulid(),
        type: 'extract_entities',
        timestamp: new Date(),
        status: 'completed',
        details: `Extracted ${entities.length} entities`,
        confidence: 0.8,
        processingTime: Date.now() - startTime
      };

      return {
        currentStep: 'extract_relationships',
        rawEntities: entities,
        steps: [...(state.steps || []), step],
      };

    } catch (error) {
      const step: ExtractionStep = {
        stepId: ulid(),
        type: 'extract_entities',
        timestamp: new Date(),
        status: 'failed',
        details: `Entity extraction failed: ${error}`,
        confidence: 0,
        processingTime: Date.now() - startTime
      };

      return {
        currentStep: 'extract_relationships',
        rawEntities: [],
        errors: [...(state.errors || []), `Entity extraction failed: ${error}`],
        steps: [...(state.steps || []), step],
      };
    }
  }

  /**
   * Extract relationships node
   */
  private async extractRelationshipsNode(state: any) {
    const startTime = Date.now();

    try {
      const relationships = await this.extractRelationships(state.content, state.rawEntities || [], state);
      
      const step: ExtractionStep = {
        stepId: ulid(),
        type: 'extract_relationships',
        timestamp: new Date(),
        status: 'completed',
        details: `Extracted ${relationships.length} relationships`,
        confidence: 0.8,
        processingTime: Date.now() - startTime
      };

      return {
        currentStep: 'create_nodes',
        rawRelationships: relationships,
        steps: [...(state.steps || []), step],
      };

    } catch (error) {
      const step: ExtractionStep = {
        stepId: ulid(),
        type: 'extract_relationships',
        timestamp: new Date(),
        status: 'failed',
        details: `Relationship extraction failed: ${error}`,
        confidence: 0,
        processingTime: Date.now() - startTime
      };

      return {
        currentStep: 'create_nodes',
        rawRelationships: [],
        errors: [...(state.errors || []), `Relationship extraction failed: ${error}`],
        steps: [...(state.steps || []), step],
      };
    }
  }

  /**
   * Create knowledge nodes node
   */
  private async createKnowledgeNodesNode(state: any) {
    const nodes = this.createKnowledgeNodes(state.rawEntities || [], state);
    
    return {
      currentStep: 'create_edges',
      nodes,
    };
  }

  /**
   * Create knowledge edges node
   */
  private async createKnowledgeEdgesNode(state: any) {
    const edges = this.createKnowledgeEdges(state.rawRelationships || []);
    
    return {
      currentStep: 'finalize',
      edges,
    };
  }

  /**
   * Finalize extraction node
   */
  private async finalizeExtraction(state: any) {
    // Calculate final confidence
    const avgConfidence = this.calculateAverageConfidence([
      ...(state.rawEntities || []).map((e: ExtractedEntity) => e.confidence),
      ...(state.rawRelationships || []).map((r: ExtractedRelationship) => r.confidence)
    ]);

    const step: ExtractionStep = {
      stepId: ulid(),
      type: 'finalize',
      timestamp: new Date(),
      status: 'completed',
      details: `Extraction completed with ${state.nodes?.length || 0} nodes and ${state.edges?.length || 0} edges`,
      confidence: avgConfidence,
      processingTime: Date.now() - (state.processingStartTime || Date.now())
    };

    return {
      currentStep: 'completed',
      confidence: avgConfidence,
      steps: [...(state.steps || []), step],
    };
  }

  /**
   * Extract entities from content
   */
  private async extractEntities(content: string, state: any): Promise<ExtractedEntity[]> {
    try {
      if (this.openai) {
        return await this.extractEntitiesWithLLM(content, state);
      } else {
        return await this.extractEntitiesWithFallback(content);
      }
    } catch (error) {
      console.warn('Entity extraction failed, using fallback:', error);
      return await this.extractEntitiesWithFallback(content);
    }
  }

  /**
   * Extract entities using LLM
   */
  private async extractEntitiesWithLLM(content: string, state: any): Promise<ExtractedEntity[]> {
    if (!this.openai) {
      return this.extractEntitiesWithFallback(content);
    }

    try {
      const prompt = `Extract structured entities from the following content. Return a JSON array of entities with id, text, type, and confidence (0-1).

Content: ${content}

Extract entities like: people, organizations, concepts, tools, tasks, insights, trends, etc.

Return format:
[{"id": "entity_1", "text": "entity name", "type": "CONCEPT", "confidence": 0.9}]`;

      const response = await this.openai.chat.completions.create({
        model: this.config.extractionModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response
      const entities = JSON.parse(result.trim());
      
      return entities.map((entity: any) => ({
        id: entity.id || ulid(),
        text: entity.text || '',
        type: entity.type || 'ENTITY',
        confidence: entity.confidence || 0.5,
        extractionMethod: 'llm',
        properties: entity.properties || {},
      }));

    } catch (error) {
      console.warn('LLM entity extraction failed:', error);
      return this.extractEntitiesWithFallback(content);
    }
  }

  /**
   * Extract entities using fallback method
   */
  private async extractEntitiesWithFallback(content: string): Promise<ExtractedEntity[]> {
    // Simple keyword-based extraction as fallback
    const words = content.split(/\s+/).filter(word => word.length > 3);
    const uniqueWords = [...new Set(words)];
    
    return uniqueWords.slice(0, this.config.maxEntities).map(word => ({
      id: ulid(),
      text: word,
      type: 'CONCEPT',
      confidence: 0.3,
      extractionMethod: 'fallback',
    }));
  }

  /**
   * Extract relationships
   */
  private async extractRelationships(
    content: string, 
    entities: ExtractedEntity[], 
    state: any
  ): Promise<ExtractedRelationship[]> {
    try {
      if (this.openai && entities.length > 1) {
        return await this.extractRelationshipsWithLLM(content, entities, state);
      } else {
        return await this.extractRelationshipsWithFallback(entities);
      }
    } catch (error) {
      console.warn('Relationship extraction failed, using fallback:', error);
      return await this.extractRelationshipsWithFallback(entities);
    }
  }

  /**
   * Extract relationships using LLM
   */
  private async extractRelationshipsWithLLM(
    content: string,
    entities: ExtractedEntity[],
    state: any
  ): Promise<ExtractedRelationship[]> {
    if (!this.openai || entities.length < 2) {
      return this.extractRelationshipsWithFallback(entities);
    }

    try {
      const entityList = entities.map(e => `"${e.text}"`).join(', ');
      
      const prompt = `Analyze relationships between these entities in the given content: ${entityList}

Content: ${content}

Return a JSON array of relationships with sourceEntity, targetEntity, type, confidence, and reasoning.

Relationship types: RELATED_TO, DEPENDS_ON, SUPPORTS, USED_BY, PART_OF, LEADS_TO, SIMILAR_TO, INFLUENCES

Return format:
[{"sourceEntity": "entity1", "targetEntity": "entity2", "type": "RELATED_TO", "confidence": 0.8, "reasoning": "explanation"}]`;

      const response = await this.openai.chat.completions.create({
        model: this.config.extractionModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from LLM');
      }

      const relationships = JSON.parse(result.trim());
      
      return relationships.map((rel: any) => ({
        id: ulid(),
        sourceEntity: entities.find(e => e.text === rel.sourceEntity),
        targetEntity: entities.find(e => e.text === rel.targetEntity),
        type: rel.type || 'RELATED_TO',
        confidence: rel.confidence || 0.5,
        reasoning: rel.reasoning || '',
        extractionMethod: 'llm',
      })).filter((rel: ExtractedRelationship) => rel.sourceEntity && rel.targetEntity);

    } catch (error) {
      console.warn('LLM relationship extraction failed:', error);
      return this.extractRelationshipsWithFallback(entities);
    }
  }

  /**
   * Extract relationships using fallback method
   */
  private async extractRelationshipsWithFallback(entities: ExtractedEntity[]): Promise<ExtractedRelationship[]> {
    const relationships: ExtractedRelationship[] = [];
    
    // Create simple relationships between adjacent entities
    for (let i = 0; i < entities.length - 1 && i < 10; i++) {
      relationships.push({
        id: ulid(),
        sourceEntity: entities[i],
        targetEntity: entities[i + 1],
        type: 'RELATED_TO',
        confidence: 0.3,
        extractionMethod: 'fallback',
      });
    }
    
    return relationships;
  }

  /**
   * Create knowledge nodes from extracted entities
   */
  private createKnowledgeNodes(entities: ExtractedEntity[], state: any): KnowledgeNode[] {
    return entities.map(entity => ({
      id: entity.id,
      label: entity.text,
      type: this.mapToKnowledgeNodeType(entity.type),
      description: `Extracted entity: ${entity.text}`,
      confidence: entity.confidence,
      source: state.source || 'extraction',
      createdAt: new Date(),
      updatedAt: new Date(),
      properties: entity.properties || {},
      metadata: {
        extractionId: state.extractionId,
        extractionMethod: entity.extractionMethod,
      },
    }));
  }

  /**
   * Create knowledge edges from extracted relationships
   */
  private createKnowledgeEdges(relationships: ExtractedRelationship[]): KnowledgeEdge[] {
    return relationships
      .filter(rel => rel.sourceEntity && rel.targetEntity)
      .map(rel => ({
        from: rel.sourceEntity!.id,
        to: rel.targetEntity!.id,
        type: this.mapToKnowledgeEdgeType(rel.type),
        label: rel.type.toLowerCase().replace('_', ' '),
        strength: rel.confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
        properties: rel.properties || {},
        metadata: {
          reasoning: rel.reasoning,
          extractionMethod: rel.extractionMethod,
        },
      }));
  }

  /**
   * Map string to KnowledgeNodeType
   */
  private mapToKnowledgeNodeType(typeString: string): KnowledgeNodeType {
    const typeMap: Record<string, KnowledgeNodeType> = {
      'TASK': KnowledgeNodeType.TASK,
      'CONCEPT': KnowledgeNodeType.CONCEPT,
      'TREND': KnowledgeNodeType.TREND,
      'TOOL': KnowledgeNodeType.TOOL,
      'STRATEGY': KnowledgeNodeType.STRATEGY,
      'INSIGHT': KnowledgeNodeType.INSIGHT,
      'PROJECT': KnowledgeNodeType.PROJECT,
      'AGENT': KnowledgeNodeType.AGENT,
      'ENTITY': KnowledgeNodeType.ENTITY,
      'PROCESS': KnowledgeNodeType.PROCESS,
      'RESOURCE': KnowledgeNodeType.RESOURCE,
      'METRIC': KnowledgeNodeType.METRIC,
      'EVENT': KnowledgeNodeType.EVENT,
      'DECISION': KnowledgeNodeType.DECISION,
    };
    
    return typeMap[typeString.toUpperCase()] || KnowledgeNodeType.CONCEPT;
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
    
    return typeMap[typeString.toUpperCase()] || KnowledgeEdgeType.RELATED_TO;
  }

  /**
   * Calculate average confidence from confidence scores
   */
  private calculateAverageConfidence(confidenceScores: number[]): number {
    if (confidenceScores.length === 0) return 0;
    const sum = confidenceScores.reduce((acc, score) => acc + score, 0);
    return sum / confidenceScores.length;
  }
} 