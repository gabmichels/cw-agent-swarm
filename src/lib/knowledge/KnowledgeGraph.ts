import fs from 'fs';
import path from 'path';
import { 
  KnowledgeConcept as Concept,
  KnowledgePrinciple as Principle,
  DomainFramework as Framework,
  ResearchEntry as Research,
  KnowledgeRelationship as Relationship,
  // KnowledgeGraphSummary, // Removed import as it's not exported
  // Assuming Input types are needed, map them or define placeholders:
  // ConceptInput, PrincipleInput, FrameworkInput, ResearchInput, RelationshipInput
} from './types'; 

// Placeholder for summary type if not exported from ./types
interface KnowledgeGraphSummaryPlaceholder {
  totalConcepts: number;
  totalPrinciples: number;
  totalFrameworks: number;
  totalResearch: number;
  totalRelationships: number;
  categories: string[];
}

// --- Define Input types based on the main types --- 
// These are often subsets of the main types without id, createdAt, updatedAt

type ConceptInput = Omit<Concept, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
type PrincipleInput = Omit<Principle, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
type FrameworkInput = Omit<Framework, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
type ResearchInput = Omit<Research, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
type RelationshipInput = Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };


export class KnowledgeGraph {
  protected domain: string;
  protected dataDir: string;
  protected concepts: Map<string, Concept> = new Map();
  protected principles: Map<string, Principle> = new Map();
  protected frameworks: Map<string, Framework> = new Map();
  protected research: Map<string, Research> = new Map();
  protected relationships: Relationship[] = [];

  constructor(domain: string, dataDir?: string) {
    this.domain = domain;
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'knowledge', domain);
    this.ensureDirectoryExists();
  }

  public getDomain(): string {
    return this.domain;
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`Created knowledge graph directory: ${this.dataDir}`);
    }
  }

  // --- Placeholder methods used by MarketingKnowledgeGraph ---

  public getConceptsByCategory(category: string): Concept[] {
    console.warn(`getConceptsByCategory not fully implemented for ${category}`);
    return Array.from(this.concepts.values()).filter(c => c.category === category);
  }

  public getFrameworksByCategory(category: string): Framework[] {
    console.warn(`getFrameworksByCategory not fully implemented for ${category}`);
     return Array.from(this.frameworks.values()).filter(f => f.category === category);
  }

  public getPrinciplesByCategory(category: string): Principle[] {
    console.warn(`getPrinciplesByCategory not fully implemented for ${category}`);
    return Array.from(this.principles.values()).filter(p => p.category === category);
  }

  public getResearchByTags(tags: string[]): Research[] {
    console.warn(`getResearchByTags not fully implemented for tags: ${tags.join(', ')}`);
    return Array.from(this.research.values()).filter(r => 
      tags.some(tag => r.tags?.includes(tag))
    );
  }

  public getAllConcepts(): Concept[] {
    return Array.from(this.concepts.values());
  }

  public findConcepts(name: string): Concept[] {
    console.warn(`findConcepts not fully implemented for name: ${name}`);
    const lowerName = name.toLowerCase();
    return Array.from(this.concepts.values()).filter(c => 
      c.name.toLowerCase().includes(lowerName)
    );
  }

  // --- Placeholder methods used by KnowledgeFlaggingService ---

  public getSummary(): KnowledgeGraphSummaryPlaceholder { // Using placeholder type
      const allConcepts = Array.from(this.concepts.values());
      const allPrinciples = Array.from(this.principles.values());
      const allFrameworks = Array.from(this.frameworks.values());
      const allResearch = Array.from(this.research.values());
      
      const categories = new Set<string>();
      allConcepts.forEach(c => c.category && categories.add(c.category));
      allPrinciples.forEach(p => p.category && categories.add(p.category));
      allFrameworks.forEach(f => f.category && categories.add(f.category));
      allResearch.forEach(r => r.domain && categories.add(r.domain));

      return {
          totalConcepts: allConcepts.length,
          totalPrinciples: allPrinciples.length,
          totalFrameworks: allFrameworks.length,
          totalResearch: allResearch.length,
          totalRelationships: this.relationships.length,
          categories: Array.from(categories),
      };
  }

  public addConcept(conceptInput: ConceptInput): string {
      const id = conceptInput.id || `concept_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const concept: Concept = {
          ...conceptInput,
          id: id,
          // Cast necessary fields if ConceptInput is less strict than Concept
          relatedConcepts: conceptInput.relatedConcepts || [],
          // Assuming createdAt and updatedAt should be added here
          // createdAt: new Date().toISOString(),
          // updatedAt: new Date().toISOString(),
      };
      this.concepts.set(id, concept);
      console.log(`Added concept: ${concept.name}`);
      return id;
  }

  public addPrinciple(principleInput: PrincipleInput): string {
      const id = principleInput.id || `principle_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const principle: Principle = {
           ...principleInput,
           id: id,
          // createdAt: new Date().toISOString(),
          // updatedAt: new Date().toISOString(),
      };
      this.principles.set(id, principle);
      console.log(`Added principle: ${principle.name}`);
      return id;
  }

  public addFramework(frameworkInput: FrameworkInput): string {
      const id = frameworkInput.id || `framework_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const framework: Framework = {
            ...frameworkInput,
            id: id,
           // createdAt: new Date().toISOString(),
           // updatedAt: new Date().toISOString(),
      };
      this.frameworks.set(id, framework);
      console.log(`Added framework: ${framework.name}`);
      return id;
  }

  public addResearch(researchInput: ResearchInput): string {
      const id = researchInput.id || `research_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const researchItem: Research = {
            ...researchInput,
            id: id,
           // createdAt: new Date().toISOString(),
           // updatedAt: new Date().toISOString(),
      };
      this.research.set(id, researchItem);
      console.log(`Added research: ${researchItem.title}`);
      return id;
  }

  public addRelationship(relationshipInput: RelationshipInput): string {
      // Relationships might not need a separate ID unless stored individually
      // const id = relationshipInput.id || `relationship_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const relationship: Relationship = {
          ...relationshipInput, // Contains source, target, type etc.
          // id: id,
          // createdAt: new Date().toISOString(),
          // updatedAt: new Date().toISOString(),
      };
      this.relationships.push(relationship);
      console.log(`Added relationship between ${relationship.source} and ${relationship.target}`);
      return "relation-" + this.relationships.length; // Return index or similar
  }

  public async save(): Promise<void> {
    console.warn("KnowledgeGraph save method not fully implemented.");
    // Implement saving logic for all maps (concepts, principles, etc.)
    try {
        const conceptsFile = path.join(this.dataDir, 'concepts.json');
        fs.writeFileSync(conceptsFile, JSON.stringify(Array.from(this.concepts.values()), null, 2));
        // Add saving for principles, frameworks, research, relationships
        console.log(`Saved ${this.concepts.size} concepts to ${conceptsFile}`);
    } catch (error) {
        console.error("Error saving knowledge graph:", error);
    }
  }
    
  public async load(): Promise<void> {
    console.warn("KnowledgeGraph load method not fully implemented.");
    try {
        const conceptsFile = path.join(this.dataDir, 'concepts.json');
        if (fs.existsSync(conceptsFile)) {
            const items = JSON.parse(fs.readFileSync(conceptsFile, 'utf-8')) as Concept[];
            this.concepts = new Map(items.map(item => [item.id, item]));
            console.log(`Loaded ${this.concepts.size} concepts`);
        }
        // Add loading for principles, frameworks, research, relationships
    } catch(error) {
        console.error("Error loading knowledge graph:", error);
    }
  }
} 