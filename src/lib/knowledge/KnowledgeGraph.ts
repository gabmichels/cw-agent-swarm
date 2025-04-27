import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeConcept, 
  KnowledgePrinciple, 
  KnowledgeRelationship, 
  ResearchEntry,
  DomainFramework
} from './types';

/**
 * Base class for knowledge graphs that can be extended for specific domains
 */
export class KnowledgeGraph {
  protected concepts: Map<string, KnowledgeConcept>;
  protected principles: Map<string, KnowledgePrinciple>;
  protected relationships: KnowledgeRelationship[];
  protected research: Map<string, ResearchEntry>;
  protected frameworks: Map<string, DomainFramework>;
  protected dataDir: string;
  protected domain: string;

  constructor(domain: string, dataDir?: string) {
    this.domain = domain;
    this.concepts = new Map();
    this.principles = new Map();
    this.relationships = [];
    this.research = new Map();
    this.frameworks = new Map();
    
    // Set default data directory
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'knowledge', domain);
    
    // Ensure the directory exists
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the knowledge data directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`Created knowledge directory: ${this.dataDir}`);
    }
  }

  /**
   * Add a concept to the knowledge graph
   */
  public addConcept(concept: Omit<KnowledgeConcept, 'id'>): string {
    const id = uuidv4();
    const newConcept: KnowledgeConcept = {
      ...concept,
      id
    };
    
    this.concepts.set(id, newConcept);
    return id;
  }

  /**
   * Add a principle to the knowledge graph
   */
  public addPrinciple(principle: Omit<KnowledgePrinciple, 'id'>): string {
    const id = uuidv4();
    const newPrinciple: KnowledgePrinciple = {
      ...principle,
      id
    };
    
    this.principles.set(id, newPrinciple);
    return id;
  }

  /**
   * Add a relationship between concepts
   */
  public addRelationship(relationship: KnowledgeRelationship): void {
    // Validate that source and target concepts exist
    if (!this.concepts.has(relationship.source)) {
      throw new Error(`Source concept ${relationship.source} does not exist`);
    }
    
    if (!this.concepts.has(relationship.target)) {
      throw new Error(`Target concept ${relationship.target} does not exist`);
    }
    
    this.relationships.push(relationship);
  }

  /**
   * Add a research entry to the knowledge graph
   */
  public addResearch(research: Omit<ResearchEntry, 'id'>): string {
    const id = uuidv4();
    const newResearch: ResearchEntry = {
      ...research,
      id
    };
    
    this.research.set(id, newResearch);
    return id;
  }

  /**
   * Add a framework to the knowledge graph
   */
  public addFramework(framework: Omit<DomainFramework, 'id'>): string {
    const id = uuidv4();
    const newFramework: DomainFramework = {
      ...framework,
      id
    };
    
    this.frameworks.set(id, newFramework);
    return id;
  }

  /**
   * Get a concept by ID
   */
  public getConcept(id: string): KnowledgeConcept | undefined {
    return this.concepts.get(id);
  }

  /**
   * Get all concepts in the knowledge graph
   */
  public getAllConcepts(): KnowledgeConcept[] {
    return Array.from(this.concepts.values());
  }

  /**
   * Get concepts by category
   */
  public getConceptsByCategory(category: string): KnowledgeConcept[] {
    return this.getAllConcepts().filter(concept => concept.category === category);
  }

  /**
   * Get related concepts
   */
  public getRelatedConcepts(conceptId: string): KnowledgeConcept[] {
    const concept = this.concepts.get(conceptId);
    if (!concept) return [];
    
    // Get directly related concepts from the concept's relatedConcepts array
    const directlyRelated = concept.relatedConcepts
      ? concept.relatedConcepts
          .map(id => this.concepts.get(id))
          .filter((c): c is KnowledgeConcept => c !== undefined)
      : [];
    
    // Get concepts connected via relationships
    const connectedIds = this.relationships
      .filter(rel => rel.source === conceptId || rel.target === conceptId)
      .map(rel => rel.source === conceptId ? rel.target : rel.source);
    
    const connectedConcepts = connectedIds
      .map(id => this.concepts.get(id))
      .filter((c): c is KnowledgeConcept => c !== undefined);
    
    // Combine both lists, removing duplicates
    const combined = [...directlyRelated];
    
    for (const concept of connectedConcepts) {
      if (!combined.some(c => c.id === concept.id)) {
        combined.push(concept);
      }
    }
    
    return combined;
  }

  /**
   * Find concepts by name or description (fuzzy search)
   */
  public findConcepts(query: string): KnowledgeConcept[] {
    query = query.toLowerCase();
    
    return this.getAllConcepts().filter(concept => 
      concept.name.toLowerCase().includes(query) || 
      concept.description.toLowerCase().includes(query)
    );
  }

  /**
   * Get principles by category
   */
  public getPrinciplesByCategory(category: string): KnowledgePrinciple[] {
    return Array.from(this.principles.values())
      .filter(principle => principle.category === category);
  }

  /**
   * Get frameworks by category
   */
  public getFrameworksByCategory(category: string): DomainFramework[] {
    return Array.from(this.frameworks.values())
      .filter(framework => framework.category === category);
  }

  /**
   * Get research entries by domain and tags
   */
  public getResearchByTags(tags: string[]): ResearchEntry[] {
    return Array.from(this.research.values())
      .filter(entry => tags.some(tag => entry.tags.includes(tag)));
  }

  /**
   * Save the knowledge graph to disk
   */
  public async save(): Promise<void> {
    try {
      const conceptsFile = path.join(this.dataDir, 'concepts.json');
      const principlesFile = path.join(this.dataDir, 'principles.json');
      const relationshipsFile = path.join(this.dataDir, 'relationships.json');
      const researchFile = path.join(this.dataDir, 'research.json');
      const frameworksFile = path.join(this.dataDir, 'frameworks.json');

      fs.writeFileSync(conceptsFile, JSON.stringify(Array.from(this.concepts.values()), null, 2));
      fs.writeFileSync(principlesFile, JSON.stringify(Array.from(this.principles.values()), null, 2));
      fs.writeFileSync(relationshipsFile, JSON.stringify(this.relationships, null, 2));
      fs.writeFileSync(researchFile, JSON.stringify(Array.from(this.research.values()), null, 2));
      fs.writeFileSync(frameworksFile, JSON.stringify(Array.from(this.frameworks.values()), null, 2));
      
      console.log(`Knowledge graph saved to ${this.dataDir}`);
    } catch (error) {
      console.error('Error saving knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Load the knowledge graph from disk
   */
  public async load(): Promise<void> {
    try {
      // Check if the files exist before loading
      const conceptsFile = path.join(this.dataDir, 'concepts.json');
      const principlesFile = path.join(this.dataDir, 'principles.json');
      const relationshipsFile = path.join(this.dataDir, 'relationships.json');
      const researchFile = path.join(this.dataDir, 'research.json');
      const frameworksFile = path.join(this.dataDir, 'frameworks.json');
      
      if (fs.existsSync(conceptsFile)) {
        const concepts = JSON.parse(fs.readFileSync(conceptsFile, 'utf-8')) as KnowledgeConcept[];
        this.concepts = new Map(concepts.map(c => [c.id, c]));
      }
      
      if (fs.existsSync(principlesFile)) {
        const principles = JSON.parse(fs.readFileSync(principlesFile, 'utf-8')) as KnowledgePrinciple[];
        this.principles = new Map(principles.map(p => [p.id, p]));
      }
      
      if (fs.existsSync(relationshipsFile)) {
        this.relationships = JSON.parse(fs.readFileSync(relationshipsFile, 'utf-8')) as KnowledgeRelationship[];
      }
      
      if (fs.existsSync(researchFile)) {
        const research = JSON.parse(fs.readFileSync(researchFile, 'utf-8')) as ResearchEntry[];
        this.research = new Map(research.map(r => [r.id, r]));
      }
      
      if (fs.existsSync(frameworksFile)) {
        const frameworks = JSON.parse(fs.readFileSync(frameworksFile, 'utf-8')) as DomainFramework[];
        this.frameworks = new Map(frameworks.map(f => [f.id, f]));
      }
      
      console.log(`Knowledge graph loaded from ${this.dataDir}`);
    } catch (error) {
      console.error('Error loading knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Get the domain of this knowledge graph
   */
  public getDomain(): string {
    return this.domain;
  }

  /**
   * Get a summary of the knowledge graph
   */
  public getSummary(): {
    domain: string;
    conceptCount: number;
    principleCount: number;
    relationshipCount: number;
    researchCount: number;
    frameworkCount: number;
    categories: string[];
  } {
    const allConcepts = this.getAllConcepts();
    const categoriesSet = new Set<string>();
    allConcepts.forEach(c => categoriesSet.add(c.category));
    const categories = Array.from(categoriesSet);
    
    return {
      domain: this.domain,
      conceptCount: this.concepts.size,
      principleCount: this.principles.size,
      relationshipCount: this.relationships.length,
      researchCount: this.research.size,
      frameworkCount: this.frameworks.size,
      categories
    };
  }
} 