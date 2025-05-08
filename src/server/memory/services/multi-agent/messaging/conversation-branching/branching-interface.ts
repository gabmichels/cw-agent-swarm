/**
 * Conversation Branching Interface
 * 
 * This module defines interfaces for creating and managing conversation branches in
 * multi-agent conversations. It enables parallel conversation threads, alternative
 * scenarios, and variant exploration.
 */

import { StructuredId } from '../../../../../../utils/ulid';
import { ConversationState, ParticipantType, ParticipantRole } from '../conversation-manager';

/**
 * Branch type indicating purpose of the branch
 */
export enum BranchType {
  ALTERNATIVE = 'alternative',       // Represents an alternative approach or solution
  EXPLORATION = 'exploration',       // Used for exploring a particular idea or concept
  HYPOTHETICAL = 'hypothetical',     // Contains hypothetical scenarios or what-if situations
  PRIVATE = 'private',               // Private communication between specific participants
  SPECIALIZED = 'specialized',       // Focused on a specific topic or capability
  PARALLEL = 'parallel',             // Run a parallel conversation thread
  DEBUGGING = 'debugging',           // For debugging or troubleshooting
  PLANNING = 'planning',             // For planning and coordination
  ARCHIVE = 'archive'                // For archived/completed conversation paths
}

/**
 * Branch status
 */
export enum BranchStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  MERGED = 'merged',
  ABANDONED = 'abandoned'
}

/**
 * Branch relationship to other branches
 */
export enum BranchRelationship {
  PARENT = 'parent',          // Branch from which this branch was created
  CHILD = 'child',            // Branch created from this branch
  MERGED_FROM = 'merged_from', // Branch merged from
  MERGED_INTO = 'merged_into'  // Branch merged into
}

/**
 * Merge strategy for combining branches
 */
export enum MergeStrategy {
  REPLACE = 'replace',          // Replace target with source content
  APPEND = 'append',            // Append source content to target
  SELECTIVE = 'selective',      // Selectively merge specific messages
  SUMMARIZE = 'summarize',      // Create a summary of the source branch
  INTERLEAVE = 'interleave'     // Interleave messages by timestamp
}

/**
 * Conversation branch representing a divergent conversation path
 */
export interface ConversationBranch {
  id: string;
  conversationId: string;
  name: string;
  description?: string;
  branchType: BranchType;
  status: BranchStatus;
  parentBranchId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  participants: string[];  // Participant IDs
  messageCount: number;
  firstMessageId?: string;
  lastMessageId?: string;
  relationships: BranchRelationship[];
  relatedBranches: Array<{
    branchId: string;
    relationship: BranchRelationship;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Message in a conversation branch
 */
export interface BranchMessage {
  id: string;
  branchId: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  content: string | Record<string, unknown>;
  format: string;
  timestamp: number;
  referencedMessageIds?: string[];
  isVisibleToAll: boolean;
  visibleToParticipantIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Branch creation options
 */
export interface BranchCreationOptions {
  name: string;
  description?: string;
  branchType: BranchType;
  parentBranchId?: string;
  initialParticipants?: string[];
  initialMessage?: {
    senderId: string;
    content: string | Record<string, unknown>;
    format: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Branch merge options
 */
export interface BranchMergeOptions {
  sourceBranchId: string;
  targetBranchId: string;
  strategy: MergeStrategy;
  messageIds?: string[];  // For selective merging
  summarizerId?: string;  // For summarize strategy, ID of agent to create summary
  mergeReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Merge result
 */
export interface BranchMergeResult {
  success: boolean;
  mergedMessageIds: string[];
  targetBranchId: string;
  summary?: string;
  errors?: string[];
}

/**
 * Interface for conversation branching service
 */
export interface IConversationBranchingService {
  /**
   * Create a new conversation branch
   * 
   * @param conversationId ID of the conversation
   * @param options Branch creation options
   * @returns The created branch
   */
  createBranch(
    conversationId: string | StructuredId,
    options: BranchCreationOptions
  ): Promise<ConversationBranch>;

  /**
   * Get a conversation branch by ID
   * 
   * @param branchId ID of the branch to retrieve
   * @returns The conversation branch
   */
  getBranch(
    branchId: string
  ): Promise<ConversationBranch>;

  /**
   * Get all branches for a conversation
   * 
   * @param conversationId ID of the conversation
   * @returns Array of conversation branches
   */
  getBranches(
    conversationId: string | StructuredId
  ): Promise<ConversationBranch[]>;

  /**
   * Update a conversation branch
   * 
   * @param branchId ID of the branch to update
   * @param updates Updates to apply to the branch
   * @returns The updated branch
   */
  updateBranch(
    branchId: string,
    updates: Partial<ConversationBranch>
  ): Promise<ConversationBranch>;

  /**
   * Add a message to a branch
   * 
   * @param branchId ID of the branch
   * @param message Message to add
   * @returns The added message
   */
  addMessage(
    branchId: string,
    message: Omit<BranchMessage, 'id' | 'branchId' | 'timestamp'>
  ): Promise<BranchMessage>;

  /**
   * Get messages in a branch
   * 
   * @param branchId ID of the branch
   * @param options Query options
   * @returns Array of messages in the branch
   */
  getMessages(
    branchId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<BranchMessage[]>;

  /**
   * Merge branches
   * 
   * @param options Merge options
   * @returns Merge result
   */
  mergeBranches(
    options: BranchMergeOptions
  ): Promise<BranchMergeResult>;

  /**
   * Get branch relationships
   * 
   * @param branchId ID of the branch
   * @returns Related branches with relationship types
   */
  getBranchRelationships(
    branchId: string
  ): Promise<Array<{
    branchId: string;
    relationship: BranchRelationship;
  }>>;

  /**
   * Find the common ancestor of two branches
   * 
   * @param firstBranchId ID of the first branch
   * @param secondBranchId ID of the second branch
   * @returns The common ancestor branch or null if none exists
   */
  findCommonAncestor(
    firstBranchId: string,
    secondBranchId: string
  ): Promise<ConversationBranch | null>;

  /**
   * Compare two branches
   * 
   * @param firstBranchId ID of the first branch
   * @param secondBranchId ID of the second branch
   * @returns Comparison result with differences
   */
  compareBranches(
    firstBranchId: string,
    secondBranchId: string
  ): Promise<{
    commonMessages: string[];
    uniqueToFirst: string[];
    uniqueToSecond: string[];
    divergencePoint?: string;
  }>;
} 