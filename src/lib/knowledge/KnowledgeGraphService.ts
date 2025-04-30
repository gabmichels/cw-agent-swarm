import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { KnowledgeGraph } from './KnowledgeGraph';
import { 
  KnowledgeConcept,
  KnowledgePrinciple,
  DomainFramework as Framework,
  ResearchEntry as Research,
  KnowledgeRelationship
} from './types';
import { FlaggedKnowledgeItem } from './flagging/types';
import { logger } from '../logging';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Quality score for knowledge items
 */
export interface QualityScore {
  accuracy: number; // 0-1 scale
  relevance: number; // 0-1 scale
  uniqueness: number; // 0-1 scale
  completeness: number; // 0-1 scale
  overall: number; // 0-1 scale (weighted average)
}

/**
 * Suggested relationship between concepts
 */
export interface SuggestedGraphRelationship {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  relationshipType: string;
  description: string;
  confidence: number; // 0-1 scale
}

/**
 * Service to manage knowledge graph operations
 * Implements Milestone 4.1 requirements:
 * - Knowledge addition pipeline
 * - Relationship suggestion between concepts
 * - Quality scoring for knowledge items
 */
export class KnowledgeGraphService {
  private knowledgeGraph: KnowledgeGraph;
  private qualityScores: Map<string, QualityScore> = new Map();
  
  constructor(knowledgeGraph: KnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph;
  }
  
  /**
   * Add approved item to knowledge graph with quality scoring
   */
  public async addApprovedItem(item: FlaggedKnowledgeItem): Promise<string | null> {
    try {
      logger.info(`Adding approved item to knowledge graph: ${item.title}`);
      
      // Calculate quality score for the item
      const qualityScore = await this.calculateQualityScore(item);
      
      // Process based on item type
      let itemId: string | null = null;
      
      switch (item.suggestedType) {
        case 'concept':
          itemId = this.addConcept(item, qualityScore);
          break;
        case 'principle':
          itemId = this.addPrinciple(item, qualityScore);
          break;
        case 'framework':
          itemId = this.addFramework(item, qualityScore);
          break;
        case 'research':
          itemId = this.addResearch(item, qualityScore);
          break;
        case 'relationship':
          itemId = this.addRelationship(item, qualityScore);
          break;
        default:
          logger.error(`Unknown item type: ${item.suggestedType}`);
          return null;
      }
      
      // Generate relationship suggestions for concepts
      if (item.suggestedType === 'concept' && itemId) {
        await this.generateRelationshipSuggestions(itemId);
      }
      
      // Save the graph after changes
      await this.knowledgeGraph.save();
      
      return itemId;
    } catch (error) {
      logger.error(`Error adding item to knowledge graph: ${error}`);
      return null;
    }
  }
  
  /**
   * Calculate quality score for knowledge item
   */
  private async calculateQualityScore(item: FlaggedKnowledgeItem): Promise<QualityScore> {
    try {
      logger.info(`Calculating quality score for item: ${item.title}`);
      
      // Get domain summary to check relevance and uniqueness
      const knowledgeSummary = this.knowledgeGraph.getSummary();
      
      // Use LLM to evaluate the quality
      const prompt = `
You are a knowledge quality assessor for a ${this.knowledgeGraph.getDomain()} knowledge graph.
Evaluate the quality of the following knowledge item based on these criteria:

1. Accuracy: How factually correct is the information (0-1 scale)
2. Relevance: How relevant is it to the domain of ${this.knowledgeGraph.getDomain()} (0-1 scale)
3. Uniqueness: How distinctive is this from existing knowledge in the system (0-1 scale)
4. Completeness: How comprehensive is the information provided (0-1 scale)

Item Type: ${item.suggestedType}
Item Title: ${item.title}
Item Content: ${item.content}
Suggested Category: ${item.suggestedCategory}
Domain: ${this.knowledgeGraph.getDomain()}
Existing Categories: ${knowledgeSummary.categories.join(', ')}

Provide your assessment as a JSON object with numerical scores (0-1 scale) for each criterion and an overall weighted score:
{
  "accuracy": 0.0-1.0,
  "relevance": 0.0-1.0,
  "uniqueness": 0.0-1.0,
  "completeness": 0.0-1.0,
  "overall": 0.0-1.0,
  "reasoning": "Brief explanation of your assessment"
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a knowledge quality assessment system that evaluates factual accuracy, relevance, uniqueness, and completeness." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      if (!content) {
        // Default scores if LLM fails
        return {
          accuracy: 0.7,
          relevance: 0.7,
          uniqueness: 0.7,
          completeness: 0.7,
          overall: 0.7
        };
      }

      const parsed = JSON.parse(content);
      
      // Calculate overall score if not provided
      if (!parsed.overall) {
        // Weighted average with emphasis on accuracy and relevance
        parsed.overall = (
          parsed.accuracy * 0.4 + 
          parsed.relevance * 0.3 + 
          parsed.uniqueness * 0.15 + 
          parsed.completeness * 0.15
        );
      }
      
      logger.info(`Quality score for "${item.title}": ${parsed.overall.toFixed(2)}`);
      
      return {
        accuracy: parsed.accuracy,
        relevance: parsed.relevance,
        uniqueness: parsed.uniqueness,
        completeness: parsed.completeness,
        overall: parsed.overall
      };
    } catch (error) {
      logger.error(`Error calculating quality score: ${error}`);
      // Return default score if scoring fails
      return {
        accuracy: 0.7,
        relevance: 0.7, 
        uniqueness: 0.7,
        completeness: 0.7,
        overall: 0.7
      };
    }
  }
  
  /**
   * Add concept to knowledge graph
   */
  private addConcept(item: FlaggedKnowledgeItem, qualityScore: QualityScore): string {
    const properties = item.suggestedProperties as any;
    
    // Add quality metadata to concept
    const conceptId = this.knowledgeGraph.addConcept({
      name: properties.name,
      description: properties.description,
      category: item.suggestedCategory,
      subcategory: item.suggestedSubcategory,
      relatedConcepts: properties.relatedConcepts || [],
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        qualityScore
      }
    });
    
    // Store quality score for future reference
    this.qualityScores.set(conceptId, qualityScore);
    
    // Process any explicit relationships from the flagged item
    if (item.suggestedRelationships && item.suggestedRelationships.length > 0) {
      this.processExplicitRelationships(conceptId, item.suggestedRelationships);
    }
    
    return conceptId;
  }
  
  /**
   * Add principle to knowledge graph
   */
  private addPrinciple(item: FlaggedKnowledgeItem, qualityScore: QualityScore): string {
    const properties = item.suggestedProperties as any;
    
    const principleId = this.knowledgeGraph.addPrinciple({
      name: properties.name,
      description: properties.description,
      category: item.suggestedCategory,
      importance: properties.importance || qualityScore.overall * 10, // Scale to 0-10
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        qualityScore,
        examples: properties.examples || [],
        applications: properties.applications || []
      }
    });
    
    this.qualityScores.set(principleId, qualityScore);
    return principleId;
  }
  
  /**
   * Add framework to knowledge graph
   */
  private addFramework(item: FlaggedKnowledgeItem, qualityScore: QualityScore): string {
    const properties = item.suggestedProperties as any;
    
    // Ensure each step has an ID
    const stepsWithIds = (properties.steps || []).map((step: any) => ({
      id: `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: step.name,
      description: step.description,
      order: step.order
    }));
    
    const frameworkId = this.knowledgeGraph.addFramework({
      name: properties.name,
      description: properties.description,
      steps: stepsWithIds,
      principles: [], // Required field
      category: item.suggestedCategory,
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        qualityScore,
        applications: properties.applications || [],
        relatedConcepts: properties.relatedConcepts || []
      }
    });
    
    this.qualityScores.set(frameworkId, qualityScore);
    return frameworkId;
  }
  
  /**
   * Add research to knowledge graph
   */
  private addResearch(item: FlaggedKnowledgeItem, qualityScore: QualityScore): string {
    const properties = item.suggestedProperties as any;
    
    const researchId = this.knowledgeGraph.addResearch({
      title: properties.title,
      abstract: properties.content || "",
      findings: [],
      authors: [properties.source || "Unknown"],
      source: properties.source || "Unknown",
      year: properties.year || new Date().getFullYear(),
      category: item.suggestedCategory,
      relatedConcepts: [],
      relevance: qualityScore.relevance * 10, // Scale to 0-10
      url: properties.url,
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        qualityScore,
        originalContent: properties.content,
        tags: properties.tags || []
      }
    });
    
    this.qualityScores.set(researchId, qualityScore);
    return researchId;
  }
  
  /**
   * Add relationship to knowledge graph
   */
  private addRelationship(item: FlaggedKnowledgeItem, qualityScore: QualityScore): string {
    const properties = item.suggestedProperties as any;
    
    // Try to find the source and target concepts in the knowledge graph
    const sourceConcepts = this.knowledgeGraph.findConcepts(properties.sourceConceptName);
    const targetConcepts = this.knowledgeGraph.findConcepts(properties.targetConceptName);
    
    if (sourceConcepts.length === 0 || targetConcepts.length === 0) {
      logger.error(`Cannot add relationship: source or target concept not found`);
      return "";
    }
    
    // Use the first matching concept for each
    const sourceConcept = sourceConcepts[0];
    const targetConcept = targetConcepts[0];
    
    // Add the relationship to the knowledge graph
    const relationshipId = this.knowledgeGraph.addRelationship({
      source: sourceConcept.id,
      target: targetConcept.id,
      type: properties.relationshipType,
      description: properties.description,
      strength: properties.strength * qualityScore.overall, // Adjust strength by quality
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        qualityScore
      }
    });
    
    return relationshipId;
  }
  
  /**
   * Process explicit relationships from flagged item
   */
  private processExplicitRelationships(
    conceptId: string, 
    relationships: any[]
  ): void {
    for (const relationship of relationships) {
      // Find target concept
      const targetConcepts = this.knowledgeGraph.findConcepts(relationship.targetConceptName);
      
      if (targetConcepts.length > 0) {
        // Add relationship to the first matching target concept
        this.knowledgeGraph.addRelationship({
          source: conceptId,
          target: targetConcepts[0].id,
          type: relationship.relationshipType,
          description: relationship.description,
          strength: relationship.strength,
          metadata: {
            explicit: true,
            addedAt: new Date().toISOString()
          }
        });
      }
    }
  }
  
  /**
   * Generate relationship suggestions for a concept
   */
  public async generateRelationshipSuggestions(conceptId: string): Promise<SuggestedGraphRelationship[]> {
    try {
      logger.info(`Generating relationship suggestions for concept: ${conceptId}`);
      
      // Get the concept details
      const concepts = this.knowledgeGraph.getAllConcepts();
      const concept = concepts.find(c => c.id === conceptId);
      
      if (!concept) {
        logger.error(`Concept not found: ${conceptId}`);
        return [];
      }
      
      // Get 10 other potentially related concepts
      const otherConcepts = concepts
        .filter(c => c.id !== conceptId)
        .slice(0, 10);
      
      if (otherConcepts.length === 0) {
        logger.info(`No other concepts found for relationship suggestions`);
        return [];
      }
      
      // Create map of concept ID to name for easier reference
      const conceptMap = new Map<string, string>();
      concepts.forEach(c => conceptMap.set(c.id, c.name));
      
      // Use LLM to suggest potential relationships
      const prompt = `
You are a knowledge graph relationship expert for the domain of ${this.knowledgeGraph.getDomain()}.
Suggest potential meaningful relationships between this concept and other concepts in the knowledge base.

Focus Concept:
- ID: ${concept.id}
- Name: ${concept.name}
- Description: ${concept.description}
- Category: ${concept.category || 'None'}

Other Concepts:
${otherConcepts.map(c => `- ID: ${c.id}\n  Name: ${c.name}\n  Description: ${c.description}\n  Category: ${c.category || 'None'}`).join('\n\n')}

For each relationship, consider these relationship types:
- "influences": indicates the source concept has an effect on the target
- "contains": indicates the source concept includes the target as a component
- "implements": indicates the source puts the target into practice
- "relies_on": indicates the source depends on the target
- "contradicts": indicates the source opposes or negates the target
- "related_to": general relationship when more specific types don't apply

Suggest up to 5 high-quality relationships as a JSON array:
[
  {
    "sourceId": "concept-id",
    "targetId": "concept-id",
    "relationshipType": "one of the types above",
    "description": "Brief description of how they relate",
    "confidence": 0.0-1.0
  }
]

Only include relationships with confidence of 0.6 or higher. Don't force relationships if they don't make sense.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a knowledge graph relationship expert that identifies meaningful connections between concepts." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const suggestions = parsed.relationships || parsed; // Handle different response formats
      
      if (!Array.isArray(suggestions)) {
        return [];
      }
      
      // Enrich suggestions with concept names
      const enrichedSuggestions = suggestions.map((suggestion: any) => ({
        sourceId: suggestion.sourceId,
        sourceName: conceptMap.get(suggestion.sourceId) || '',
        targetId: suggestion.targetId,
        targetName: conceptMap.get(suggestion.targetId) || '',
        relationshipType: suggestion.relationshipType,
        description: suggestion.description,
        confidence: suggestion.confidence
      }));
      
      logger.info(`Generated ${enrichedSuggestions.length} relationship suggestions for concept: ${concept.name}`);
      
      return enrichedSuggestions;
    } catch (error) {
      logger.error(`Error generating relationship suggestions: ${error}`);
      return [];
    }
  }
  
  /**
   * Apply a suggested relationship to the knowledge graph
   */
  public applyRelationshipSuggestion(suggestion: SuggestedGraphRelationship): string {
    try {
      logger.info(`Applying relationship suggestion: ${suggestion.sourceName} -> ${suggestion.targetName}`);
      
      const relationshipId = this.knowledgeGraph.addRelationship({
        source: suggestion.sourceId,
        target: suggestion.targetId,
        type: suggestion.relationshipType,
        description: suggestion.description,
        strength: suggestion.confidence,
        metadata: {
          suggested: true,
          appliedAt: new Date().toISOString(),
          confidence: suggestion.confidence
        }
      });
      
      // Save the knowledge graph
      this.knowledgeGraph.save();
      
      return relationshipId;
    } catch (error) {
      logger.error(`Error applying relationship suggestion: ${error}`);
      return "";
    }
  }
  
  /**
   * Get quality score for a knowledge item
   */
  public getQualityScore(itemId: string): QualityScore | null {
    return this.qualityScores.get(itemId) || null;
  }
} 