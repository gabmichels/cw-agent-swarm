/**
 * Human Collaboration Interface
 * 
 * This file defines the core interfaces for human collaboration capabilities
 * including stakeholder management, approval workflows, and correction handling.
 */

/**
 * Interface representing a stakeholder profile with communication preferences
 */
export interface StakeholderProfile {
  id: string;
  name?: string;
  tone?: "formal" | "casual" | "neutral";
  expertiseLevel?: "beginner" | "intermediate" | "expert";
  preferredFormat?: "concise" | "detailed";
  language?: string;
}

/**
 * Default profile to use when no specific profile is provided
 */
export const DEFAULT_PROFILE: StakeholderProfile = {
  id: "default",
  tone: "neutral",
  expertiseLevel: "intermediate",
  preferredFormat: "concise",
  language: "en"
};

/**
 * Types of operations that may require approval
 */
export enum ApprovalOperationType {
  EXTERNAL_POST = 'external_post',
  DATA_MODIFICATION = 'data_modification',
  STRATEGIC_TASK = 'strategic_task',
  TOOL_USAGE = 'tool_usage',
  HIGH_RESOURCE = 'high_resource',
  SENSITIVE_DATA = 'sensitive_data',
  AUTONOMOUS = 'autonomous',
  CUSTOM = 'custom'
}

/**
 * Defines a rule for when approval is required
 */
export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  condition: (task: any) => boolean;
  priority: number; // Higher priority rules are evaluated first
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  reason?: string; // Reason shown to the user when approval is required
}

/**
 * Configuration for different approval levels
 */
export interface ApprovalLevel {
  id: string;
  name: string;
  description: string;
  requiredApprovers: number; // Number of approvers needed
  allowedApproverRoles: string[]; // Roles that can approve
  expiresAfter?: number; // Time in minutes after which approval expires
  enabled: boolean;
}

/**
 * Entry tracking an approval decision
 */
export interface ApprovalHistoryEntry {
  id: string;
  taskId: string;
  subGoalId?: string;
  taskTitle: string;
  requestedAt: Date;
  decidedAt?: Date;
  approved: boolean;
  approvedBy?: string;
  approverRole?: string;
  reason: string;
  notes?: string;
  ruleId: string;
  ruleName: string;
}

/**
 * Interface for filtering approval history entries
 */
export interface ApprovalHistoryFilter {
  taskId?: string;
  approved?: boolean;
  approvedBy?: string;
  ruleId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Interface for a human correction to an agent's work
 */
export interface Correction {
  taskId: string;
  originalPlan: string;
  correctionText: string;
  correctedBy: string;
  timestamp: number;
  category?: 'misunderstanding' | 'tool_misuse' | 'missed_context' | 'wrong_approach' | 'other';
}

/**
 * Interface for a task with human collaboration metadata
 */
export interface CollaborativeTask {
  id: string;
  goal: string;
  subGoals?: any[];
  currentSubGoalId?: string;
  reasoning?: string;
  confidenceScore?: number;
  params?: Record<string, any>;
  requiredParams?: string[];
  type?: string;
  isStrategic?: boolean;
  toolName?: string;
  requiresApproval?: boolean;
  approvalGranted?: boolean;
  blockedReason?: string;
  stakeholderProfile?: StakeholderProfile;
  // Correction-related fields
  wasCorrected?: boolean;
  correctionNotes?: string[];
  correctionCategory?: 'misunderstanding' | 'tool_misuse' | 'missed_context' | 'wrong_approach' | 'other';
  correctionTimestamp?: number;
  // Approval tracking
  approvalEntryId?: string;
  approvedBy?: string;
  approvalNotes?: string;
}

/**
 * Interface for the human collaboration system
 */
export interface HumanCollaborationManager {
  /**
   * Initialize the collaboration manager
   * 
   * @param config Manager configuration
   * @returns Promise resolving to initialization success
   */
  initialize(config?: Record<string, unknown>): Promise<boolean>;
  
  /**
   * Check if a task needs clarification before proceeding
   * 
   * @param task The planned task to evaluate
   * @returns Promise resolving to true if clarification is needed
   */
  checkNeedClarification(task: CollaborativeTask): Promise<boolean>;
  
  /**
   * Generate questions to ask the user to clarify the task
   * 
   * @param task The planned task that needs clarification
   * @param stakeholderProfile Optional stakeholder profile for tone adjustment
   * @returns Promise resolving to an array of questions
   */
  generateClarificationQuestions(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string[]>;
  
  /**
   * Format a clarification request with appropriate tone
   * 
   * @param task The task requiring clarification
   * @param questions Array of clarification questions
   * @param stakeholderProfile Optional stakeholder profile
   * @returns A formatted message adjusted for the stakeholder
   */
  formatClarificationRequest(
    task: CollaborativeTask,
    questions: string[],
    stakeholderProfile?: StakeholderProfile
  ): string;
  
  /**
   * Check if a task requires approval before execution
   * 
   * @param task The planned task to evaluate
   * @returns Object indicating if approval is required and the rule if applicable
   */
  checkIfApprovalRequired(task: CollaborativeTask): { 
    required: boolean; 
    rule?: ApprovalRule;
  };
  
  /**
   * Format an approval request with appropriate tone
   * 
   * @param task The task requiring approval
   * @param stakeholderProfile Optional stakeholder profile
   * @returns A formatted message adjusted for the stakeholder
   */
  formatApprovalRequest(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): string;
  
  /**
   * Apply an approval decision to a task
   * 
   * @param task The task to apply approval to
   * @param approved Whether the task is approved
   * @param approvedBy Who approved the task
   * @param notes Optional notes about the approval decision
   * @returns The updated task with approval information
   */
  applyApprovalDecision(
    task: CollaborativeTask,
    approved: boolean,
    approvedBy?: string,
    notes?: string
  ): CollaborativeTask;
  
  /**
   * Get approval history for a specific task
   * 
   * @param taskId The ID of the task
   * @returns Promise resolving to array of approval history entries
   */
  getApprovalHistory(taskId: string): Promise<ApprovalHistoryEntry[]>;
  
  /**
   * Set a stakeholder profile for a task
   * 
   * @param task The task to update
   * @param profile The stakeholder profile to apply
   * @returns The updated task with stakeholder profile
   */
  setStakeholderProfile(
    task: CollaborativeTask,
    profile: StakeholderProfile
  ): CollaborativeTask;
  
  /**
   * Handle a correction to a task
   * 
   * @param task The task being corrected
   * @param correction The correction details
   * @returns Promise resolving to the updated task with correction notes
   */
  handleCorrection(
    task: CollaborativeTask,
    correction: Correction
  ): Promise<CollaborativeTask>;
  
  /**
   * Check for past corrections that may be relevant to the current task
   * 
   * @param task The current task plan
   * @returns Promise resolving to object with correction suggestions
   */
  checkPastCorrections(
    task: CollaborativeTask
  ): Promise<{
    hasSimilarCorrections: boolean;
    suggestedAdjustments: string[];
    relevantCorrections: string[];
  }>;
  
  /**
   * Apply a correction to a task
   * 
   * @param task The current task
   * @param correction The correction to apply
   * @returns The updated task with the correction applied
   */
  applyCorrection(
    task: CollaborativeTask,
    correction: Correction
  ): CollaborativeTask;
  
  /**
   * Add an approval rule
   * 
   * @param rule The rule to add
   * @returns Promise resolving to success
   */
  addApprovalRule(rule: ApprovalRule): Promise<boolean>;
  
  /**
   * Remove an approval rule
   * 
   * @param ruleId The ID of the rule to remove
   * @returns Promise resolving to success
   */
  removeApprovalRule(ruleId: string): Promise<boolean>;
  
  /**
   * Get all approval rules
   * 
   * @returns Promise resolving to array of approval rules
   */
  getAllApprovalRules(): Promise<ApprovalRule[]>;
  
  /**
   * Adjust the tone of a message based on stakeholder profile
   * 
   * @param input The original message text
   * @param profile The stakeholder profile to adjust for
   * @returns The adjusted message text
   */
  adjustTone(input: string, profile?: StakeholderProfile): string;
} 