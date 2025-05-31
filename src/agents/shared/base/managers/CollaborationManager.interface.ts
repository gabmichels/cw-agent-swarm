/**
 * CollaborationManager.interface.ts - Collaboration Manager Interface
 * 
 * This file defines the collaboration manager interface that handles human
 * collaboration, approval workflows, stakeholder management, and clarification protocols.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration for the collaboration manager
 */
export interface CollaborationManagerConfig extends ManagerConfig {
  /** Whether to enable automatic clarification checking */
  enableClarificationChecking?: boolean;
  
  /** Whether to enable approval workflows */
  enableApprovalWorkflows?: boolean;
  
  /** Default stakeholder profile */
  defaultStakeholderProfile?: {
    name: string;
    role: string;
    communicationStyle: 'formal' | 'casual' | 'technical';
    expertise: string[];
  };
  
  /** Approval configuration */
  approvalConfig?: {
    /** Default approval timeout in minutes */
    defaultTimeoutMinutes?: number;
    
    /** Whether to require approval for high-risk tasks */
    requireApprovalForHighRisk?: boolean;
    
    /** Approval levels configuration */
    approvalLevels?: Array<{
      id: string;
      name: string;
      requiredApprovers: number;
      allowedRoles: string[];
    }>;
  };
}

/**
 * Collaborative task interface
 */
export interface CollaborativeTask {
  /** Task ID */
  id: string;
  
  /** Task goal or description */
  goal: string;
  
  /** Task sub-goals */
  subGoals?: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    children?: Array<{ id: string; description: string }>;
  }>;
  
  /** Current sub-goal being worked on */
  currentSubGoalId?: string;
  
  /** Stakeholder profile */
  stakeholderProfile?: {
    name: string;
    role: string;
    communicationStyle: 'formal' | 'casual' | 'technical';
    expertise: string[];
  };
  
  /** Approval status */
  approvalGranted?: boolean;
  
  /** Who approved the task */
  approvedBy?: string;
  
  /** Approval notes */
  approvalNotes?: string;
  
  /** Approval entry ID for tracking */
  approvalEntryId?: string;
  
  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of approval check
 */
export interface ApprovalCheckResult {
  /** Whether approval is required */
  required: boolean;
  
  /** The approval rule that triggered (if any) */
  rule?: {
    id: string;
    name: string;
    description: string;
    reason: string;
    approvalLevel: string;
  };
  
  /** Estimated approval time */
  estimatedApprovalTime?: number;
  
  /** Required approver roles */
  requiredRoles?: string[];
}

/**
 * Stakeholder profile interface
 */
export interface StakeholderProfile {
  /** Stakeholder name */
  name: string;
  
  /** Stakeholder role */
  role: string;
  
  /** Communication style preference */
  communicationStyle: 'formal' | 'casual' | 'technical';
  
  /** Areas of expertise */
  expertise: string[];
  
  /** Preferred response format */
  preferredFormat?: 'brief' | 'detailed' | 'technical';
  
  /** Communication preferences */
  preferences?: {
    /** Preferred communication channels */
    channels?: string[];
    
    /** Availability hours */
    availabilityHours?: {
      start: string;
      end: string;
      timezone: string;
    };
    
    /** Response time expectations */
    expectedResponseTime?: number;
  };
}

/**
 * Approval history entry
 */
export interface ApprovalHistoryEntry {
  /** Entry ID */
  id: string;
  
  /** Associated task ID */
  taskId: string;
  
  /** Sub-goal ID (if applicable) */
  subGoalId?: string;
  
  /** Task title */
  taskTitle: string;
  
  /** When approval was requested */
  requestedAt: Date;
  
  /** When decision was made */
  decidedAt?: Date;
  
  /** Whether it was approved */
  approved: boolean;
  
  /** Who approved it */
  approvedBy?: string;
  
  /** Approver role */
  approverRole?: string;
  
  /** Approval reason */
  reason: string;
  
  /** Additional notes */
  notes?: string;
  
  /** Rule ID that triggered approval */
  ruleId: string;
  
  /** Rule name */
  ruleName: string;
}

/**
 * Collaboration manager interface
 */
export interface CollaborationManager extends BaseManager {
  /**
   * Check if a task needs clarification before proceeding
   * 
   * @param task The task to evaluate
   * @returns Promise resolving to true if clarification is needed
   */
  checkNeedClarification(task: CollaborativeTask): Promise<boolean>;
  
  /**
   * Generate clarification questions for a task
   * 
   * @param task The task that needs clarification
   * @param stakeholderProfile Optional stakeholder profile for tone adjustment
   * @returns Promise resolving to array of clarification questions
   */
  generateClarificationQuestions(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string[]>;
  
  /**
   * Format a clarification request message
   * 
   * @param task The task requiring clarification
   * @param questions Array of clarification questions
   * @param stakeholderProfile Optional stakeholder profile
   * @returns Formatted clarification message
   */
  formatClarificationRequest(
    task: CollaborativeTask,
    questions: string[],
    stakeholderProfile?: StakeholderProfile
  ): Promise<string>;
  
  /**
   * Check if a task requires approval before execution
   * 
   * @param task The task to evaluate
   * @returns Promise resolving to approval check result
   */
  checkIfApprovalRequired(task: CollaborativeTask): Promise<ApprovalCheckResult>;
  
  /**
   * Format an approval request message
   * 
   * @param task The task requiring approval
   * @param stakeholderProfile Optional stakeholder profile
   * @returns Promise resolving to formatted approval message
   */
  formatApprovalRequest(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string>;
  
  /**
   * Apply an approval decision to a task
   * 
   * @param task The task to apply approval to
   * @param approved Whether the task is approved
   * @param approvedBy Who approved the task
   * @param notes Optional approval notes
   * @returns Promise resolving to updated task
   */
  applyApprovalDecision(
    task: CollaborativeTask,
    approved: boolean,
    approvedBy: string,
    notes?: string
  ): Promise<CollaborativeTask>;
  
  /**
   * Get approval history for a specific task
   * 
   * @param taskId The task ID
   * @returns Promise resolving to approval history entries
   */
  getApprovalHistory(taskId: string): Promise<ApprovalHistoryEntry[]>;
  
  /**
   * Add an approval rule
   * 
   * @param rule The approval rule to add
   * @returns Promise resolving to success status
   */
  addApprovalRule(rule: {
    id: string;
    name: string;
    description: string;
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
    approvalLevel: string;
    enabled: boolean;
  }): Promise<boolean>;
  
  /**
   * Remove an approval rule
   * 
   * @param ruleId The rule ID to remove
   * @returns Promise resolving to success status
   */
  removeApprovalRule(ruleId: string): Promise<boolean>;
  
  /**
   * Get all approval rules
   * 
   * @returns Promise resolving to array of approval rules
   */
  getAllApprovalRules(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
    approvalLevel: string;
    enabled: boolean;
  }>>;
  
  /**
   * Update stakeholder profile
   * 
   * @param profile The stakeholder profile to update
   * @returns Promise resolving to success status
   */
  updateStakeholderProfile(profile: StakeholderProfile): Promise<boolean>;
  
  /**
   * Get current stakeholder profile
   * 
   * @returns Promise resolving to current stakeholder profile
   */
  getStakeholderProfile(): Promise<StakeholderProfile | null>;
} 