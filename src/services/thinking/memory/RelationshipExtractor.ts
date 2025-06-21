import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';
import { ExtractedEntity, EntityType } from './EntityExtractor';

/**
 * Types of relationships between entities
 */
export enum RelationshipType {
  PART_OF = 'part_of',
  DEPENDS_ON = 'depends_on',
  RELATED_TO = 'related_to',
  CAUSES = 'causes',
  FOLLOWS = 'follows',
  REFERENCES = 'references',
  IMPLEMENTS = 'implements',
  USES = 'uses',
  CREATES = 'creates',
  MODIFIES = 'modifies',
  BLOCKS = 'blocks',
  ENABLES = 'enables',
  CUSTOM = 'custom'
}

/**
 * Extracted relationship between entities
 */
export interface ExtractedRelationship {
  id: string;
  type: RelationshipType;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: number;
  label?: string;
  metadata?: Record<string, unknown>;
  context?: string;
  strength?: number;
  timestamp: string;
}

/**
 * Options for relationship extraction
 */
export interface RelationshipExtractionOptions {
  types?: RelationshipType[];
  minConfidence?: number;
  maxRelationships?: number;
  includeContext?: boolean;
  language?: string;
}

/**
 * Service for extracting relationships between entities using LLM
 */
export class RelationshipExtractor {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME,
      temperature: 0.2
    });
  }
  
  /**
   * Extract relationships between entities in text content
   */
  async extractRelationships(
    content: string,
    entities: ExtractedEntity[],
    options: RelationshipExtractionOptions = {}
  ): Promise<ExtractedRelationship[]> {
    try {
      if (entities.length < 2) {
        return []; // Need at least 2 entities for relationships
      }
      
      // Set default options
      const {
        types = Object.values(RelationshipType),
        minConfidence = 0.6,
        maxRelationships = 100,
        includeContext = true,
        language = 'en'
      } = options;
      
      // Build system prompt
      const systemPrompt = `You are an AI assistant that identifies relationships between entities in text.
Your task is to analyze the relationships between the provided entities and identify connections of these types: ${types.join(', ')}.

For each relationship:
- Determine the relationship type from the allowed types
- Identify the source and target entities
- Assign a confidence score (0.0 to 1.0)
- Provide a descriptive label for the relationship
- Extract relevant context if present
- Assign a relationship strength score (0.0 to 1.0)

The entities are:
${entities.map(e => `- ${e.value} (${e.type}, ID: ${e.id})`).join('\n')}

Respond in the following JSON format:
{
  "relationships": [
    {
      "type": "depends_on",
      "sourceEntityId": "entity_123",
      "targetEntityId": "entity_456",
      "confidence": 0.85,
      "label": "requires for implementation",
      "context": "Component X depends on library Y for encryption",
      "strength": 0.9
    }
  ]
}`;

      // Call LLM for extraction
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Analyze relationships between entities in this text (${language}): "${content}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('Invalid LLM response format');
        return [];
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      if (!data.relationships || !Array.isArray(data.relationships)) {
        console.error('Invalid relationships data structure');
        return [];
      }
      
      // Process and validate relationships
      const relationships: ExtractedRelationship[] = [];
      
      for (const rel of data.relationships) {
        // Validate required fields
        if (!rel.type || !rel.sourceEntityId || !rel.targetEntityId || typeof rel.confidence !== 'number') {
          continue;
        }
        
        // Check confidence threshold
        if (rel.confidence < minConfidence) {
          continue;
        }
        
        // Verify entity IDs exist
        const sourceEntity = entities.find(e => e.id === rel.sourceEntityId);
        const targetEntity = entities.find(e => e.id === rel.targetEntityId);
        
        if (!sourceEntity || !targetEntity) {
          continue;
        }
        
        // Create relationship with ID and timestamp
        relationships.push({
          id: String(IdGenerator.generate('relationship')),
          type: rel.type as RelationshipType,
          sourceEntityId: rel.sourceEntityId,
          targetEntityId: rel.targetEntityId,
          confidence: rel.confidence,
          label: rel.label,
          context: includeContext ? rel.context : undefined,
          strength: rel.strength,
          metadata: {
            language,
            extractedAt: new Date().toISOString(),
            sourceEntityType: sourceEntity.type,
            targetEntityType: targetEntity.type
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Sort by confidence and limit
      return relationships
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxRelationships);
        
    } catch (error) {
      console.error('Error extracting relationships:', error);
      return [];
    }
  }
  
  /**
   * Generate a descriptive label for a relationship type
   */
  private generateRelationshipLabel(type: RelationshipType): string {
    switch (type) {
      case RelationshipType.PART_OF:
        return 'is part of';
      case RelationshipType.DEPENDS_ON:
        return 'depends on';
      case RelationshipType.RELATED_TO:
        return 'is related to';
      case RelationshipType.CAUSES:
        return 'causes';
      case RelationshipType.FOLLOWS:
        return 'follows';
      case RelationshipType.REFERENCES:
        return 'references';
      case RelationshipType.IMPLEMENTS:
        return 'implements';
      case RelationshipType.USES:
        return 'uses';
      case RelationshipType.CREATES:
        return 'creates';
      case RelationshipType.MODIFIES:
        return 'modifies';
      case RelationshipType.BLOCKS:
        return 'blocks';
      case RelationshipType.ENABLES:
        return 'enables';
      case RelationshipType.CUSTOM:
        return 'is connected to';
      default:
        return 'is connected to';
    }
  }
} 