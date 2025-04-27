import { KnowledgeGraph } from '../../../lib/knowledge/KnowledgeGraph';

/**
 * Specific marketing categories
 */
export type MarketingCategory = 
  | 'marketing-fundamentals'
  | 'marketing-strategy'
  | 'branding'
  | 'digital-marketing'
  | 'content-marketing'
  | 'social-media-marketing'
  | 'email-marketing'
  | 'search-marketing'
  | 'analytics'
  | 'customer-experience'
  | 'marketing-channels'
  | 'market-research'
  | 'product-marketing'
  | 'pricing-strategy'
  | 'marketing-communications'
  | 'consumer-psychology';

/**
 * Marketing-specific knowledge graph
 */
export class MarketingKnowledgeGraph extends KnowledgeGraph {
  constructor(dataDir?: string) {
    super('marketing', dataDir);
  }

  /**
   * Get marketing concepts by specific marketing category
   */
  public getMarketingConceptsByCategory(category: MarketingCategory) {
    return this.getConceptsByCategory(category);
  }

  /**
   * Get marketing frameworks by category
   */
  public getMarketingFrameworksByCategory(category: MarketingCategory) {
    return this.getFrameworksByCategory(category);
  }

  /**
   * Get marketing principles by category 
   */
  public getMarketingPrinciplesByCategory(category: MarketingCategory) {
    return this.getPrinciplesByCategory(category);
  }

  /**
   * Find research related to specific marketing tags
   */
  public getMarketingResearchByTags(tags: string[]) {
    return this.getResearchByTags(tags);
  }

  /**
   * Find concepts related to a marketing campaign objective
   */
  public getConceptsForCampaignObjective(objective: string) {
    // Find concepts that could help with a specific campaign objective
    const lowerObjective = objective.toLowerCase();
    const keywords = this.extractKeywords(lowerObjective);

    return this.getAllConcepts().filter(concept => {
      const lowerName = concept.name.toLowerCase();
      const lowerDesc = concept.description.toLowerCase();
      
      // Check if any keywords are present in the concept
      return keywords.some(keyword => 
        lowerName.includes(keyword) || 
        lowerDesc.includes(keyword)
      );
    });
  }

  /**
   * Find frameworks relevant to a specific marketing task
   */
  public getFrameworksForMarketingTask(task: string) {
    const lowerTask = task.toLowerCase();
    const keywords = this.extractKeywords(lowerTask);

    // Return all frameworks that might be relevant for this task
    return Array.from(this.frameworks.values()).filter(framework => {
      const lowerName = framework.name.toLowerCase();
      const lowerDesc = framework.description.toLowerCase();
      
      // Check if any keywords are present in the framework
      return keywords.some(keyword => 
        lowerName.includes(keyword) || 
        lowerDesc.includes(keyword)
      );
    });
  }

  /**
   * Extract marketing-relevant keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in a production system this would be more sophisticated
    const commonWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'of', 'that',
      'this', 'these', 'those', 'it', 'they', 'them', 'their', 'our', 'my', 'your', 'his', 'her'
    ]);
    
    return text
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 3 && !commonWords.has(word)) // Filter short and common words
      .map(word => word.toLowerCase());
  }
} 