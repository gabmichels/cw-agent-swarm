import { KnowledgeGraph } from './KnowledgeGraph';
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
  protected knowledgeGraph: KnowledgeGraph;

  constructor(knowledgeGraph: KnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph;
  }

  /**
   * Bootstrap the knowledge graph with default sources
   */
  public async bootstrap(): Promise<void> {
    console.log(`Bootstrapping ${this.knowledgeGraph.getDomain()} knowledge graph...`);
    
    // Get the default sources for this domain
    const sources = this.getDefaultSources();
    
    for (const source of sources) {
      await this.processSource(source);
    }
    
    // Save the knowledge graph after bootstrapping
    await this.knowledgeGraph.save();
    
    console.log(`${this.knowledgeGraph.getDomain()} knowledge graph bootstrapped successfully.`);
    console.log(this.knowledgeGraph.getSummary());
  }

  /**
   * Process a single knowledge source
   */
  protected async processSource(source: KnowledgeBootstrapSource): Promise<void> {
    console.log(`Processing source: ${source.name}`);
    
    // Extract concepts from the source
    const concepts = await this.extractConcepts(source);
    
    // Add concepts to the knowledge graph
    for (const concept of concepts) {
      try {
        this.knowledgeGraph.addConcept({
          name: concept.name,
          description: concept.description,
          category: source.category,
          subcategory: source.subcategory,
          relatedConcepts: []
        });
      } catch (error) {
        console.error(`Error adding concept ${concept.name}:`, error);
      }
    }
    
    // Extract principles if source type is appropriate
    if (source.type === 'framework' || source.type === 'textbook') {
      const principles = await this.extractPrinciples(source);
      
      // Add principles to the knowledge graph
      for (const principle of principles) {
        try {
          this.knowledgeGraph.addPrinciple({
            name: principle.name,
            description: principle.description,
            category: source.category,
            importance: principle.importance,
            metadata: {
              examples: principle.examples,
              applications: principle.applications
            }
          });
        } catch (error) {
          console.error(`Error adding principle ${principle.name}:`, error);
        }
      }
    }
    
    // If the source is a framework, add it as a framework
    if (source.type === 'framework') {
      const framework = await this.extractFramework(source);
      
      try {
        this.knowledgeGraph.addFramework({
          name: source.name,
          description: framework.description,
          steps: framework.steps.map(step => ({
            id: `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            name: step.name,
            description: step.description,
            order: step.order
          })),
          principles: [],
          category: source.category
        });
      } catch (error) {
        console.error(`Error adding framework ${source.name}:`, error);
      }
    }
    
    // If the source is research or case study, add as research
    if (source.type === 'research' || source.type === 'case_study') {
      try {
        this.knowledgeGraph.addResearch({
          title: source.name,
          abstract: source.content.substring(0, 500),
          findings: [],
          authors: [source.author || 'Unknown'],
          year: source.year || new Date().getFullYear(),
          source: source.author || 'Unknown',
          category: source.category,
          relatedConcepts: [],
          relevance: 0.9
        });
      } catch (error) {
        console.error(`Error adding research ${source.name}:`, error);
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
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are a knowledge extraction system that identifies and extracts key concepts from domain content." 
          },
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
      return parsed.concepts || [];
    } catch (error) {
      console.error('Error extracting concepts:', error);
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
5. Importance: A number from 1-10 indicating how important this principle is in the domain of ${source.category}

Format as a JSON array of objects with these properties.

SOURCE CONTENT:
${source.content.substring(0, 4000)}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are a knowledge extraction system that identifies and extracts key principles from domain content." 
          },
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
      return parsed.principles || [];
    } catch (error) {
      console.error('Error extracting principles:', error);
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
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are a knowledge extraction system that analyzes and structures frameworks from domain content." 
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
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
      console.error('Error extracting framework:', error);
      return { description: '', steps: [], applications: [] };
    }
  }

  /**
   * Get default knowledge sources for this domain
   * Each domain-specific bootstrapper must implement this
   */
  protected abstract getDefaultSources(): KnowledgeBootstrapSource[];
} 