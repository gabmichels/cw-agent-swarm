/**
 * Types for knowledge flagging system
 */

/**
 * Source types for flagged knowledge
 */
export type KnowledgeSourceType = 
  | 'conversation' 
  | 'file' 
  | 'market_scan' 
  | 'manual_entry'
  | 'web_search';

/**
 * Status of a flagged knowledge item
 */
export type FlaggedItemStatus = 'pending' | 'approved' | 'rejected';

/**
 * Suggested type of knowledge to be added
 */
export type SuggestedKnowledgeType = 
  | 'concept' 
  | 'principle' 
  | 'framework' 
  | 'research' 
  | 'relationship';

/**
 * A knowledge item flagged for potential addition to the knowledge graph
 */
export interface FlaggedKnowledgeItem {
  id: string;
  title: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceReference: string;
  suggestedType: SuggestedKnowledgeType;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: number; // 0-1 scale
  status: FlaggedItemStatus;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  processedAt?: string; // ISO date string
  metadata?: Record<string, any>;
  
  // Fields for knowledge graph integration
  suggestedProperties: SuggestedKnowledgeProperties;
  
  // Fields for relationship suggestions
  suggestedRelationships?: SuggestedRelationship[];
}

/**
 * Properties suggested for different knowledge types
 */
export type SuggestedKnowledgeProperties = 
  | SuggestedConceptProperties
  | SuggestedPrincipleProperties
  | SuggestedFrameworkProperties
  | SuggestedResearchProperties
  | SuggestedRelationshipProperties;

/**
 * Properties for a suggested concept
 */
export interface SuggestedConceptProperties {
  type: 'concept';
  name: string;
  description: string;
  relatedConcepts?: string[]; // Names or IDs of related concepts
}

/**
 * Properties for a suggested principle
 */
export interface SuggestedPrincipleProperties {
  type: 'principle';
  name: string;
  description: string;
  examples: string[];
  applications: string[];
  importance: number; // 1-10 scale
}

/**
 * Properties for a suggested framework
 */
export interface SuggestedFrameworkProperties {
  type: 'framework';
  name: string;
  description: string;
  steps: {
    name: string;
    description: string;
    order: number;
  }[];
  applications: string[];
}

/**
 * Properties for suggested research
 */
export interface SuggestedResearchProperties {
  type: 'research';
  title: string;
  content: string;
  source: string;
  tags: string[];
  year: number;
  relevance: number; // 0-1 scale
  url?: string;
}

/**
 * Properties for a suggested relationship
 */
export interface SuggestedRelationshipProperties {
  type: 'relationship';
  sourceConceptName: string;
  targetConceptName: string;
  relationshipType: string;
  description: string;
  strength: number; // 0-1 scale
}

/**
 * A suggested relationship between two concepts
 */
export interface SuggestedRelationship {
  sourceConceptName: string;
  targetConceptName: string;
  relationshipType: string;
  description: string;
  strength: number; // 0-1 scale
}

/**
 * Filter options for retrieving flagged items
 */
export interface FlaggedItemsFilter {
  status?: FlaggedItemStatus;
  sourceType?: KnowledgeSourceType;
  suggestedType?: SuggestedKnowledgeType;
  category?: string;
  confidence?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    from?: string;
    to?: string;
  };
}

/**
 * Result of knowledge flagging operation
 */
export interface FlaggingResult {
  success: boolean;
  itemId?: string;
  error?: string;
}

/**
 * Statistics about flagged knowledge items
 */
export interface FlaggingStats {
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  rejectedItems: number;
  bySourceType: Record<KnowledgeSourceType, number>;
  byKnowledgeType: Record<SuggestedKnowledgeType, number>;
  recentlyFlagged: FlaggedKnowledgeItem[];
} 