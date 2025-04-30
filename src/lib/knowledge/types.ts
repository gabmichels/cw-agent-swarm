/**
 * Base types for domain-agnostic knowledge graphs used by various agents
 */

/**
 * Represents a concept or entity in a knowledge graph
 */
export interface KnowledgeConcept {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  relatedConcepts?: string[];
  metadata?: Record<string, unknown>;
  confidence?: number; // 0-1 scale indicating confidence
  source?: string; // Source of this concept
  lastUpdated?: Date;
  examples?: string[]; // Concrete examples of the concept
}

/**
 * Knowledge principle that defines a guideline or rule
 */
export interface KnowledgePrinciple {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  supportingEvidence?: string[];
  exceptions?: string[];
  metadata?: Record<string, unknown>;
  importance: number; // 0-1 scale
  source?: string;
  lastUpdated?: Date;
}

/**
 * Represents a relationship between two concepts
 */
export interface KnowledgeRelationship {
  source: string; // Source concept ID
  target: string; // Target concept ID
  type: string; // Relationship type: "influences", "includes", "specifies", etc.
  description: string;
  strength: number; // 0-1 scale indicating relationship strength
  metadata?: Record<string, unknown>;
  bidirectional?: boolean; // Whether the relationship works both ways
  created?: Date;
  lastUpdated?: Date;
  confidence?: number; // 0-1 scale of confidence in this relationship
}

/**
 * Represents a complete framework or methodology
 */
export interface DomainFramework {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  principles: string[]; // IDs of principles that belong to this framework
  steps: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
    outputs?: string[];
    duration?: {
      min: number;
      max: number;
      unit: 'minutes' | 'hours' | 'days' | 'weeks';
    };
  }>;
  source?: string;
  author?: string;
  year?: number;
  metadata?: Record<string, unknown>;
  lastUpdated?: Date;
}

/**
 * Represents a research entry supporting a concept or principle
 */
export interface ResearchEntry {
  id: string;
  title: string;
  abstract: string;
  findings: string[];
  authors: string[];
  year: number;
  source: string;
  url?: string;
  doi?: string;
  category: string;
  relatedConcepts: string[]; // IDs of related concepts
  metadata?: Record<string, unknown>;
  lastUpdated?: Date;
  relevance: number; // 0-1 scale of relevance to the domain
}

/**
 * Bootstrap source for knowledge graph initialization
 */
export interface KnowledgeBootstrapSource {
  id: string;
  name: string;
  type: "definition" | "framework" | "textbook" | "research" | "case_study";
  category: string;
  subcategory?: string;
  content: string;
  author?: string;
  year?: number;
  metadata?: Record<string, unknown>;
  reliability?: number; // 0-1 scale of reliability of the source
  license?: string; // License information for the content
}

/**
 * Summary of a knowledge graph's contents
 */
export interface KnowledgeGraphSummary {
  totalConcepts: number;
  totalPrinciples: number;
  totalFrameworks: number;
  totalResearch: number;
  totalRelationships: number;
  categories: string[];
  lastUpdated: Date;
  topConcepts: Array<{id: string, name: string, connectedness: number}>;
  coverage: Record<string, number>; // Coverage of different categories (0-1 scale)
} 