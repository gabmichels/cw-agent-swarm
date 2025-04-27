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
  metadata?: Record<string, any>;
}

/**
 * Represents a principle or rule within a domain
 */
export interface KnowledgePrinciple {
  id: string;
  name: string;
  description: string;
  examples: string[];
  applications: string[];
  category: string;
  importance: number; // 1-10 scale
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

/**
 * Represents a research entry or evidence for a concept
 */
export interface ResearchEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  domain: string;
  tags: string[];
  year: number;
  relevance: number; // 0-1 scale
  url?: string;
  metadata?: Record<string, any>;
}

/**
 * Represents a framework or model in a domain
 */
export interface DomainFramework {
  id: string;
  name: string;
  description: string;
  steps: {
    name: string;
    description: string;
    order: number;
  }[];
  applications: string[];
  relatedConcepts: string[];
  category: string;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
} 