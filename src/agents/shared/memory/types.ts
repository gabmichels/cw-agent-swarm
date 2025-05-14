/**
 * Type definitions for agent memory systems
 */

/**
 * Knowledge entry for adding to agent memory
 */
export interface KnowledgeEntry {
  /**
   * Title of the knowledge entry
   */
  title: string;
  
  /**
   * Content of the knowledge entry
   */
  content: string;
  
  /**
   * Source of the knowledge (e.g., markdown, web, etc.)
   */
  source: string;
  
  /**
   * Tags associated with the knowledge
   */
  tags: string[];
  
  /**
   * Importance level of the knowledge
   */
  importance: string;
  
  /**
   * Optional file path for file-based knowledge
   */
  filePath?: string;
  
  /**
   * Last modified timestamp for tracking changes
   */
  lastModified?: string;
}

/**
 * Result of adding knowledge to memory
 */
export interface KnowledgeAddResult {
  /**
   * ID of the created knowledge entry
   */
  id: string;
  
  /**
   * Success status
   */
  success: boolean;
}

/**
 * Base interface for agent memory systems
 */
export interface IAgentMemory {
  /**
   * Add knowledge to the agent's memory
   */
  addKnowledge(knowledge: KnowledgeEntry): Promise<KnowledgeAddResult>;
  
  /**
   * Remove knowledge from the agent's memory
   */
  removeKnowledge(id: string): Promise<boolean>;
  
  /**
   * Search the agent's knowledge
   */
  searchKnowledge(query: string, options?: any): Promise<any[]>;
} 