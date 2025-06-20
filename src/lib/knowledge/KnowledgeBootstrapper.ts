import { DefaultKnowledgeGraph } from '../../agents/shared/knowledge/DefaultKnowledgeGraph';
import { KnowledgeNodeType, KnowledgeNode } from '../../agents/shared/knowledge/interfaces/KnowledgeGraph.interface';
import { logger } from '../logging';
import { KnowledgeBootstrapSource } from './types';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Base class for bootstrapping a knowledge graph with initial data
 */
export abstract class KnowledgeBootstrapper {
  protected knowledgeGraph: DefaultKnowledgeGraph;

  constructor(knowledgeGraph: DefaultKnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph;
  }

  /**
   * Bootstrap the knowledge graph with default sources
   */
  public async bootstrap(): Promise<void> {
    logger.info(`Bootstrapping knowledge graph...`);
    
    // Get the default sources for this domain
    const sources = this.getDefaultSources();
    
    for (const source of sources) {
      await this.processSource(source);
    }
    
    // Save the knowledge graph after bootstrapping
    await this.knowledgeGraph.initialize();
    
    const stats = await this.knowledgeGraph.getStats();
    logger.info(`Knowledge graph bootstrapped successfully.`);
    logger.info(`Stats: ${JSON.stringify(stats, null, 2)}`);
  }

  /**
   * Process a single knowledge source
   */
  protected async processSource(source: KnowledgeBootstrapSource): Promise<void> {
    logger.info(`Processing source: ${source.name}`);
    
    // Extract concepts from the source
    const concepts = await this.extractConcepts(source);
    
    // Add concepts to the knowledge graph
    for (const concept of concepts) {
      try {
        const nodeId = await this.knowledgeGraph.addNode({
          label: concept.name,
          type: KnowledgeNodeType.CONCEPT,
          description: concept.description,
          tags: ['concept'],
          metadata: {
            addedAt: new Date().toISOString(),
            source: 'bootstrap',
            conceptId: `concept_${concept.name.toLowerCase().replace(/\s+/g, '_')}`
          }
        });
      } catch (error) {
        logger.error(`Error adding concept ${concept.name}:`, error);
      }
    }
    
    // Extract principles if source type is appropriate
    if (source.type === 'framework' || source.type === 'textbook') {
      const principles = await this.extractPrinciples(source);
      
      // Add principles to the knowledge graph
      for (const principle of principles) {
        try {
          const nodeId = await this.knowledgeGraph.addNode({
            label: principle.name,
            type: KnowledgeNodeType.CONCEPT, // Using CONCEPT since PRINCIPLE is not in enum
            description: principle.description,
            tags: ['principle'],
            metadata: {
              addedAt: new Date().toISOString(),
              source: 'bootstrap',
              principleId: `principle_${principle.name.toLowerCase().replace(/\s+/g, '_')}`,
              examples: principle.examples,
              applications: principle.applications,
              importance: principle.importance
            }
          });
        } catch (error) {
          logger.error(`Error adding principle ${principle.name}:`, error);
        }
      }
    }
    
    // If the source is a framework, add it as a framework node
    if (source.type === 'framework') {
      const framework = await this.extractFramework(source);
      
      try {
        const nodeId = await this.knowledgeGraph.addNode({
          label: source.name,
          type: KnowledgeNodeType.PROCESS, // Using PROCESS since FRAMEWORK is not in enum
          description: framework.description,
          tags: ['framework'],
          metadata: {
            addedAt: new Date().toISOString(),
            source: 'bootstrap',
            frameworkId: `framework_${source.name.toLowerCase().replace(/\s+/g, '_')}`,
            steps: framework.steps,
            applications: framework.applications
          }
        });
      } catch (error) {
        logger.error(`Error adding framework ${source.name}:`, error);
      }
    }
    
    // If the source is research or case study, add as research
    if (source.type === 'research' || source.type === 'case_study') {
      try {
        const nodeId = await this.knowledgeGraph.addNode({
          label: source.name,
          type: KnowledgeNodeType.INSIGHT, // Using INSIGHT since RESEARCH is not in enum
          description: source.content.substring(0, 500),
          tags: ['research'],
          metadata: {
            addedAt: new Date().toISOString(),
            source: 'bootstrap',
            researchId: `research_${source.name.toLowerCase().replace(/\s+/g, '_')}`,
            fullContent: source.content
          }
        });
      } catch (error) {
        logger.error(`Error adding research ${source.name}:`, error);
      }
    }
  }

  /**
   * Extract concepts from a knowledge source
   */
  protected async extractConcepts(source: KnowledgeBootstrapSource): Promise<Array<{ name: string; description: string }>> {
    try {
      const prompt = `
Extract the key concepts from this ${source.type} about ${source.name}.
For each concept, provide:
1. Name: A concise title for the concept
2. Description: A clear, detailed explanation of the concept

Format as a JSON array of objects with name and description properties.

SOURCE CONTENT:
${source.content.substring(0, 4000)}
`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: "You are a knowledge extraction system that identifies and extracts key concepts from domain content." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      return parsed.concepts || [];
    } catch (error) {
      logger.error('Error extracting concepts:', error);
      return [];
    }
  }

  /**
   * Extract principles from a knowledge source
   */
  protected async extractPrinciples(source: KnowledgeBootstrapSource): Promise<Array<{ 
    name: string; 
    description: string; 
    examples: string[]; 
    applications: string[];
    importance: number;
  }>> {
    try {
      const prompt = `
Extract the key principles or rules from this ${source.type} about ${source.name}.
For each principle, provide:
1. Name: A concise title for the principle
2. Description: A clear explanation of the principle
3. Examples: 2-3 examples of the principle in action
4. Applications: 2-3 ways to apply this principle
5. Importance: A number from 1-10 indicating how important this principle is

Format as a JSON array of objects with these properties.

SOURCE CONTENT:
${source.content.substring(0, 4000)}
`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: "You are a knowledge extraction system that identifies and extracts key principles from domain content." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      return parsed.principles || [];
    } catch (error) {
      logger.error('Error extracting principles:', error);
      return [];
    }
  }

  /**
   * Extract framework details from a knowledge source
   */
  protected async extractFramework(source: KnowledgeBootstrapSource): Promise<{
    description: string;
    steps: Array<{ name: string; description: string; order: number }>;
    applications: string[];
  }> {
    try {
      const prompt = `
Extract the details of the framework described in this content about ${source.name}.
Provide:
1. Description: A concise overview of the framework
2. Steps: The sequential steps or components of the framework, each with:
   - Name: The step name
   - Description: What happens in this step
   - Order: The numerical position in the sequence
3. Applications: 3-5 practical ways to apply this framework

Format as a JSON object with these properties.

SOURCE CONTENT:
${source.content.substring(0, 4000)}
`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: "You are a knowledge extraction system that analyzes and structures frameworks from domain content." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return { description: '', steps: [], applications: [] };
      }

      const parsed = JSON.parse(content);
      return {
        description: parsed.description || '',
        steps: parsed.steps || [],
        applications: parsed.applications || []
      };
    } catch (error) {
      logger.error('Error extracting framework:', error);
      return { description: '', steps: [], applications: [] };
    }
  }

  /**
   * Get default knowledge sources for this domain
   * Each domain-specific bootstrapper must implement this
   */
  protected abstract getDefaultSources(): KnowledgeBootstrapSource[];
} 