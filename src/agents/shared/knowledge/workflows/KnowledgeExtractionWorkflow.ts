/**
 * KnowledgeExtractionWorkflow.ts - LangGraph workflow for intelligent knowledge extraction
 * 
 * This workflow uses multi-step reasoning to extract structured knowledge from unstructured content,
 * creating nodes and relationships with confidence scoring and validation.
 */

import { ulid } from 'ulid';
import { OpenAI } from 'openai';
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
 * Configuration for Knowledge Extraction Workflow
 */
export interface KnowledgeExtractionConfig {
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
  properties?: Record<string, unknown>;
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
  properties?: Record<string, unknown>;
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
 * Knowledge Extraction Workflow
 * 
 * Simplified workflow implementation that avoids LangGraph API compatibility issues
 * while providing comprehensive knowledge extraction capabilities.
 */
export class KnowledgeExtractionWorkflow {
  private readonly openai: OpenAI | null;
  private readonly config: Required<KnowledgeExtractionConfig>;

  constructor(config: KnowledgeExtractionConfig = {}) {
    this.openai = config.openAIApiKey ? new OpenAI({ apiKey: config.openAIApiKey }) : null;
    
    this.config = {
      openAIApiKey: config.openAIApiKey || '',
      qdrantStore: config.qdrantStore || null as any,
      extractionModel: config.extractionModel || 'gpt-4',
      maxEntities: config.maxEntities || 50,
      maxRelationships: config.maxRelationships || 100,
      minConfidenceThreshold: config.minConfidenceThreshold || 0.3
    };
  }

  /**
   * Execute knowledge extraction workflow
   */
  public async extractKnowledge(options: KnowledgeExtractionOptions): Promise<KnowledgeExtractionResult> {
    const startTime = Date.now();
    const extractionId = ulid();
    const steps: ExtractionStep[] = [];

    try {
      // Step 1: Initialize extraction
      steps.push({
        stepId: ulid(),
        type: 'initialize',
        timestamp: new Date(),
        status: 'completed',
        details: `Initialized extraction for content length: ${options.content.length}`,
        confidence: 1.0
      });

      // Step 2: Extract entities
      const entities = await this.extractEntities(options.content, options);
      steps.push({
        stepId: ulid(),
        type: 'extract_entities',
        timestamp: new Date(),
        status: 'completed',
        details: `Extracted ${entities.length} entities`,
        confidence: 0.8,
        processingTime: Date.now() - startTime
      });

      // Step 3: Extract relationships
      const relationships = await this.extractRelationships(options.content, entities, options);
      steps.push({
        stepId: ulid(),
        type: 'extract_relationships',
        timestamp: new Date(),
        status: 'completed',
        details: `Extracted ${relationships.length} relationships`,
        confidence: 0.8,
        processingTime: Date.now() - startTime
      });

      // Step 4: Create knowledge nodes
      const nodes = this.createKnowledgeNodes(entities, options);
      
      // Step 5: Create knowledge edges
      const edges = this.createKnowledgeEdges(relationships);

      // Calculate final confidence
      const avgConfidence = this.calculateAverageConfidence([
        ...entities.map(e => e.confidence),
        ...relationships.map(r => r.confidence)
      ]);

      const result: KnowledgeExtractionResult = {
        nodes,
        edges,
        confidence: avgConfidence,
        stats: {
          processingTimeMs: Date.now() - startTime,
          entityCount: entities.length,
          relationshipCount: relationships.length,
          avgConfidence
        }
      };

      return result;

    } catch (error) {
      console.error('Knowledge extraction failed:', error);
      
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
   * Extract entities from content
   */
  private async extractEntities(content: string, options: KnowledgeExtractionOptions): Promise<ExtractedEntity[]> {
    try {
      if (this.openai) {
        return await this.extractEntitiesWithLLM(content, options);
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
  private async extractEntitiesWithLLM(content: string, options: KnowledgeExtractionOptions): Promise<ExtractedEntity[]> {
    if (!this.openai) {
      return this.extractEntitiesWithFallback(content);
    }

    try {
      const prompt = `Extract entities from the following content. Return a JSON array of entities with properties: id, text, type, confidence.

Content: ${content.substring(0, 2000)}

Return only the JSON array, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: this.config.extractionModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"entities": []}');
      const entities = result.entities || [];

      return entities.map((entity: any) => ({
        id: entity.id || ulid(),
        text: entity.text || '',
        type: entity.type || 'ENTITY',
        confidence: entity.confidence || 0.7,
        extractionMethod: 'llm'
      })).slice(0, this.config.maxEntities);
    } catch (error) {
      console.warn('LLM entity extraction failed, using fallback:', error);
      return this.extractEntitiesWithFallback(content);
    }
  }

  /**
   * Extract entities using simple fallback method
   */
  private async extractEntitiesWithFallback(content: string): Promise<ExtractedEntity[]> {
    try {
      const words = content.split(/\s+/).filter(word => word.length > 3);
      const entities: ExtractedEntity[] = [];
      
      words.forEach((word, index) => {
        if (word.match(/^[A-Z]/) && entities.length < 10) {
          entities.push({
            id: ulid(),
            text: word.replace(/[^\w]/g, ''),
            type: 'ENTITY',
            confidence: 0.6,
            extractionMethod: 'fallback'
          });
        }
      });
      
      return entities;
    } catch (error) {
      console.warn('Fallback entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract relationships from content and entities
   */
  private async extractRelationships(
    content: string, 
    entities: ExtractedEntity[], 
    options: KnowledgeExtractionOptions
  ): Promise<ExtractedRelationship[]> {
    try {
      if (this.openai && entities.length > 1) {
        return await this.extractRelationshipsWithLLM(content, entities, options);
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
    options: KnowledgeExtractionOptions
  ): Promise<ExtractedRelationship[]> {
    if (!this.openai || entities.length === 0) {
      return this.extractRelationshipsWithFallback(entities);
    }

    try {
      const entitiesText = entities.map(e => `${e.id}: ${e.text}`).join('\n');
      const prompt = `Given these entities and content, extract relationships. Return a JSON array of relationships with properties: id, sourceEntityId, targetEntityId, type, confidence.

Entities:
${entitiesText}

Content: ${content.substring(0, 1500)}

Return only the JSON array, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: this.config.extractionModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"relationships": []}');
      const relationships = result.relationships || [];

      return relationships.map((rel: any) => {
        const sourceEntity = entities.find(e => e.id === rel.sourceEntityId);
        const targetEntity = entities.find(e => e.id === rel.targetEntityId);
        
        return {
          id: rel.id || ulid(),
          sourceEntity,
          targetEntity,
          type: rel.type || 'RELATED_TO',
          confidence: rel.confidence || 0.6,
          extractionMethod: 'llm'
        };
      }).filter((rel: any) => rel.sourceEntity && rel.targetEntity)
        .slice(0, this.config.maxRelationships);
    } catch (error) {
      console.warn('LLM relationship extraction failed, using fallback:', error);
      return this.extractRelationshipsWithFallback(entities);
    }
  }

  /**
   * Extract relationships using simple fallback method
   */
  private async extractRelationshipsWithFallback(entities: ExtractedEntity[]): Promise<ExtractedRelationship[]> {
    try {
      const relationships: ExtractedRelationship[] = [];
      
      // Simple co-occurrence relationships
      for (let i = 0; i < entities.length && relationships.length < 5; i++) {
        for (let j = i + 1; j < entities.length && relationships.length < 5; j++) {
          relationships.push({
            id: ulid(),
            sourceEntity: entities[i],
            targetEntity: entities[j],
            type: 'RELATED_TO',
            confidence: 0.5,
            extractionMethod: 'fallback'
          });
        }
      }
      
      return relationships;
    } catch (error) {
      console.warn('Fallback relationship extraction failed:', error);
      return [];
    }
  }

  /**
   * Create knowledge nodes from extracted entities
   */
  private createKnowledgeNodes(entities: ExtractedEntity[], options: KnowledgeExtractionOptions): KnowledgeNode[] {
    return entities.map(entity => ({
      id: entity.id,
      type: this.mapToKnowledgeNodeType(entity.type),
      label: entity.text,
      description: `Extracted entity: ${entity.text}`,
      confidence: entity.confidence,
      source: options.source || 'knowledge_extraction',
      createdAt: new Date(),
      updatedAt: new Date(),
      properties: {
        extractionMethod: entity.extractionMethod || 'llm',
        positions: entity.positions ? JSON.stringify(entity.positions) : null
      },
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0',
        source: 'KnowledgeExtractionWorkflow',
        confidence: entity.confidence
      }
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
        label: rel.type || 'RELATED_TO',
        strength: rel.confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
        properties: {
          evidence: rel.evidence ? JSON.stringify(rel.evidence) : null,
          reasoning: rel.reasoning || null,
          extractionMethod: rel.extractionMethod || 'llm'
        },
        metadata: {
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0',
          source: 'KnowledgeExtractionWorkflow',
          confidence: rel.confidence
        }
      }));
  }

  /**
   * Map string to KnowledgeNodeType
   */
  private mapToKnowledgeNodeType(typeString: string): KnowledgeNodeType {
    const typeMap: Record<string, KnowledgeNodeType> = {
      'concept': KnowledgeNodeType.CONCEPT,
      'tool': KnowledgeNodeType.TOOL,
      'process': KnowledgeNodeType.PROCESS,
      'agent': KnowledgeNodeType.AGENT,
      'entity': KnowledgeNodeType.ENTITY,
      'strategy': KnowledgeNodeType.STRATEGY,
      'insight': KnowledgeNodeType.INSIGHT,
      'project': KnowledgeNodeType.PROJECT,
      'task': KnowledgeNodeType.TASK,
      'trend': KnowledgeNodeType.TREND,
      'resource': KnowledgeNodeType.RESOURCE,
      'metric': KnowledgeNodeType.METRIC,
      'event': KnowledgeNodeType.EVENT,
      'decision': KnowledgeNodeType.DECISION
    };

    return typeMap[typeString.toLowerCase()] || KnowledgeNodeType.CONCEPT;
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
   * Calculate average confidence
   */
  private calculateAverageConfidence(confidenceScores: number[]): number {
    if (confidenceScores.length === 0) return 0;
    
    const total = confidenceScores.reduce((acc, score) => acc + score, 0);
    return total / confidenceScores.length;
  }
} 