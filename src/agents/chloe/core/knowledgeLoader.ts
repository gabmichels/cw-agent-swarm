import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export interface KnowledgeContent {
  content: string;
  category: string;
  subcategory: string;
  filename: string;
}

export class KnowledgeLoader {
  private knowledgeBase: Map<string, KnowledgeContent[]> = new Map();
  private readonly knowledgeDir: string;

  constructor(knowledgeDir: string = 'data/knowledge') {
    this.knowledgeDir = knowledgeDir;
  }

  /**
   * Load all knowledge files
   */
  async loadAllKnowledge(): Promise<void> {
    try {
      // Load company knowledge (shared across all agents)
      await this.loadCompanyKnowledge();

      // Load domain-specific knowledge
      await this.loadDomainKnowledge();

      // Load agent-specific knowledge
      await this.loadAgentKnowledge();
    } catch (error) {
      console.error('Error loading knowledge:', error);
      throw error;
    }
  }

  /**
   * Load company knowledge
   */
  private async loadCompanyKnowledge(): Promise<void> {
    const companyFiles = await glob('company/**/*.md', { cwd: this.knowledgeDir });
    
    for (const file of companyFiles) {
      const content = await this.readMarkdownFile(file);
      const { category, subcategory } = this.parseFilePath(file);
      
      this.addToKnowledgeBase('company', {
        content,
        category,
        subcategory,
        filename: path.basename(file, '.md')
      });
    }
  }

  /**
   * Load domain-specific knowledge
   */
  private async loadDomainKnowledge(): Promise<void> {
    const domainFiles = await glob('domains/**/*.md', { cwd: this.knowledgeDir });
    
    for (const file of domainFiles) {
      const content = await this.readMarkdownFile(file);
      const { category, subcategory } = this.parseFilePath(file);
      
      this.addToKnowledgeBase('domains', {
        content,
        category,
        subcategory,
        filename: path.basename(file, '.md')
      });
    }
  }

  /**
   * Load agent-specific knowledge
   */
  private async loadAgentKnowledge(): Promise<void> {
    const agentFiles = await glob('agents/**/*.md', { cwd: this.knowledgeDir });
    
    for (const file of agentFiles) {
      const content = await this.readMarkdownFile(file);
      const { category, subcategory } = this.parseFilePath(file);
      
      this.addToKnowledgeBase('agents', {
        content,
        category,
        subcategory,
        filename: path.basename(file, '.md')
      });
    }
  }

  /**
   * Read markdown file content
   */
  private async readMarkdownFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.knowledgeDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Parse file path to get category and subcategory
   */
  private parseFilePath(filePath: string): { category: string; subcategory: string } {
    const parts = filePath.split('/');
    return {
      category: parts[0],
      subcategory: parts[1] || ''
    };
  }

  /**
   * Add content to knowledge base
   */
  private addToKnowledgeBase(type: string, content: KnowledgeContent): void {
    if (!this.knowledgeBase.has(type)) {
      this.knowledgeBase.set(type, []);
    }
    this.knowledgeBase.get(type)!.push(content);
  }

  /**
   * Get knowledge content by type and category
   */
  getKnowledge(type: string, category?: string, subcategory?: string): KnowledgeContent[] {
    const knowledge = this.knowledgeBase.get(type) || [];
    
    return knowledge.filter(item => {
      if (category && item.category !== category) return false;
      if (subcategory && item.subcategory !== subcategory) return false;
      return true;
    });
  }

  /**
   * Get all knowledge content
   */
  getAllKnowledge(): Map<string, KnowledgeContent[]> {
    return this.knowledgeBase;
  }

  /**
   * Get knowledge content for a specific agent
   */
  getAgentKnowledge(agentId: string): KnowledgeContent[] {
    const agentKnowledge = this.getKnowledge('agents', agentId);
    const companyKnowledge = this.getKnowledge('company');
    const domainKnowledge = this.getKnowledge('domains');
    
    return [...agentKnowledge, ...companyKnowledge, ...domainKnowledge];
  }

  /**
   * Get knowledge content for a specific domain
   */
  getDomainKnowledge(domain: string): KnowledgeContent[] {
    return this.getKnowledge('domains', domain);
  }
} 