/**
 * Types of knowledge sources
 */
export enum KnowledgeSourceType {
  CONVERSATION = 'conversation',
  DOCUMENT = 'document',
  TASK = 'task',
  MEMORY = 'memory',
  EXTERNAL = 'external'
}

/**
 * Types of suggested knowledge
 */
export enum SuggestedKnowledgeType {
  CONCEPT = 'concept',
  RELATIONSHIP = 'relationship',
  FACT = 'fact',
  RULE = 'rule',
  PROCEDURE = 'procedure'
}

/**
 * Status of a flagged knowledge item
 */
export enum FlaggedItemStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_REVIEW = 'needs_review'
}

/**
 * Interface for a flagged knowledge item
 */
export interface FlaggedKnowledgeItem {
  id: string;
  type: SuggestedKnowledgeType;
  source: KnowledgeSourceType;
  content: string;
  timestamp: number;
  status: FlaggedItemStatus;
  metadata?: Record<string, unknown>;
  context?: string;
  confidence?: number;
  reviewer?: string;
  reviewNotes?: string;
  reviewTimestamp?: number;
} 