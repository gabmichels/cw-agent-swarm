import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';
import { MemoryType } from '@/server/memory/config';

/**
 * Entity types that can be extracted
 */
export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  LOCATION = 'location',
  DATE = 'date',
  CONCEPT = 'concept',
  TASK = 'task',
  GOAL = 'goal',
  FILE = 'file',
  CODE = 'code',
  TOOL = 'tool',
  ACTION = 'action',
  REQUIREMENT = 'requirement',
  METRIC = 'metric',
  ERROR = 'error',
  CUSTOM = 'custom'
}

/**
 * Extracted entity with metadata
 */
export interface ExtractedEntity {
  id: string;
  type: EntityType;
  value: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  metadata?: Record<string, unknown>;
  relatedEntities?: string[];
  context?: string;
  source?: string;
  timestamp: string;
}

/**
 * Entity extraction options
 */
export interface EntityExtractionOptions {
  types?: EntityType[];
  minConfidence?: number;
  maxEntities?: number;
  includeContext?: boolean;
  extractRelationships?: boolean;
  language?: string;
}

/**
 * Service for extracting entities from text using LLM
 */
export class EntityExtractor {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2
    });
  }
  
  /**
   * Extract entities from text content
   */
  async extractEntities(
    content: string,
    options: EntityExtractionOptions = {}
  ): Promise<ExtractedEntity[]> {
    try {
      // Set default options
      const {
        types = Object.values(EntityType),
        minConfidence = 0.6,
        maxEntities = 50,
        includeContext = true,
        language = 'en'
      } = options;
      
      // Build system prompt
      const systemPrompt = `You are an AI assistant that extracts entities from text content.
Your task is to identify and extract entities of the following types: ${types.join(', ')}.

For each entity:
- Determine its type from the allowed types
- Extract the exact text value
- Assign a confidence score (0.0 to 1.0)
- Note the character position in text (start and end index)
- Extract relevant context if present
- Identify related entities

Respond in the following JSON format:
{
  "entities": [
    {
      "type": "person",
      "value": "John Smith",
      "confidence": 0.95,
      "startIndex": 45,
      "endIndex": 55,
      "context": "Project lead for AI development",
      "relatedEntities": ["AI development", "Project X"]
    }
  ]
}`;

      // Call LLM for extraction
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Extract entities from this text (${language}): "${content}"`)
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
      
      if (!data.entities || !Array.isArray(data.entities)) {
        console.error('Invalid entities data structure');
        return [];
      }
      
      // Process and validate entities
      const entities: ExtractedEntity[] = [];
      
      for (const entity of data.entities) {
        // Validate required fields
        if (!entity.type || !entity.value || typeof entity.confidence !== 'number') {
          continue;
        }
        
        // Check confidence threshold
        if (entity.confidence < minConfidence) {
          continue;
        }
        
        // Create entity with ID and timestamp
        entities.push({
          id: String(IdGenerator.generate('entity')),
          type: entity.type as EntityType,
          value: entity.value,
          confidence: entity.confidence,
          startIndex: entity.startIndex,
          endIndex: entity.endIndex,
          context: includeContext ? entity.context : undefined,
          relatedEntities: entity.relatedEntities,
          metadata: {
            language,
            extractedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Sort by confidence and limit
      return entities
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxEntities);
        
    } catch (error) {
      console.error('Error extracting entities:', error);
      return [];
    }
  }
  
  /**
   * Map entity type to memory type
   */
  mapToMemoryType(entityType: EntityType): MemoryType {
    switch (entityType) {
      case EntityType.PERSON:
      case EntityType.ORGANIZATION:
      case EntityType.LOCATION:
        return MemoryType.REFERENCE;
      case EntityType.CONCEPT:
        return MemoryType.INSIGHT;
      case EntityType.TASK:
        return MemoryType.TASK;
      case EntityType.GOAL:
        return MemoryType.GOAL;
      case EntityType.ERROR:
        return MemoryType.INSIGHT;
      default:
        return MemoryType.INSIGHT;
    }
  }
} 