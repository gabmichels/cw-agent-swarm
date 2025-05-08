/**
 * Approval Configuration System
 * 
 * Provides a flexible, rule-based system for defining approval criteria
 * for different types of tasks and operations.
 */

import { PlanningTask } from '../graph/nodes/types';

/**
 * Defines a rule for when approval is required
 */
export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  condition: (task: PlanningTask) => boolean;
  priority: number; // Higher priority rules are evaluated first
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  reason?: string; // Reason shown to the user when approval is required
}

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
 * Main class to manage the approval configuration and rule evaluation
 */
export class ApprovalConfigurationManager {
  private rules: Map<string, ApprovalRule> = new Map();
  private levels: Map<string, ApprovalLevel> = new Map();
  private history: ApprovalHistoryEntry[] = [];
  
  // Singleton pattern
  private static instance: ApprovalConfigurationManager;
  
  private constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultLevels();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ApprovalConfigurationManager {
    if (!ApprovalConfigurationManager.instance) {
      ApprovalConfigurationManager.instance = new ApprovalConfigurationManager();
    }
    return ApprovalConfigurationManager.instance;
  }
  
  /**
   * Initialize default approval rules
   */
  private initializeDefaultRules(): void {
    const now = new Date();
    
    // External posting rule
    this.addRule({
      id: 'rule_external_post',
      name: 'External Content Posting',
      description: 'Requires approval for tasks that post content to external platforms',
      condition: (task: PlanningTask) => task.type === 'external_post',
      priority: 100,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      reason: 'This task involves posting content externally'
    });
    
    // Strategic task rule
    this.addRule({
      id: 'rule_strategic_task',
      name: 'Strategic Task Execution',
      description: 'Requires approval for tasks marked as strategic',
      condition: (task: PlanningTask) => task.isStrategic === true,
      priority: 90,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      reason: 'This is a strategic task that requires review'
    });
    
    // New tool usage rule
    this.addRule({
      id: 'rule_new_tool',
      name: 'New Tool Usage',
      description: 'Requires approval for tasks using new or sensitive tools',
      condition: (task: PlanningTask) => {
        // Check in metadata or failureDetails for tool information
        const toolName = task.metadata?.toolName || task.failureDetails?.toolName;
        return toolName === 'new_tool';
      },
      priority: 80,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      reason: 'This task uses a tool that requires approval'
    });
    
    // High priority task rule
    this.addRule({
      id: 'rule_high_priority',
      name: 'High Priority Task',
      description: 'Requires approval for high priority tasks',
      condition: (task: PlanningTask) => {
        // Check if any subgoals have high priority
        const hasHighPrioritySubgoals = task.subGoals.some(sg => sg.priority >= 8);
        // Or check in metadata for priority score
        const priorityScore = task.metadata?.priorityScore as number;
        return hasHighPrioritySubgoals || (priorityScore !== undefined && priorityScore >= 0.8);
      },
      priority: 70,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      reason: 'This high-priority task requires approval due to its importance'
    });
    
    // Sensitive data access rule
    this.addRule({
      id: 'rule_sensitive_data',
      name: 'Sensitive Data Access',
      description: 'Requires approval for tasks accessing sensitive data',
      condition: (task: PlanningTask) => {
        const sensitiveKeywords = ['password', 'credential', 'secret', 'personal', 'confidential', 'private'];
        return sensitiveKeywords.some(keyword => 
          task.goal.toLowerCase().includes(keyword) || 
          (task.subGoals || []).some((sg) => sg.description.toLowerCase().includes(keyword))
        );
      },
      priority: 95,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      reason: 'This task involves access to potentially sensitive data'
    });
  }
  
  /**
   * Initialize default approval levels
   */
  private initializeDefaultLevels(): void {
    // Standard approval level
    this.addLevel({
      id: 'level_standard',
      name: 'Standard Approval',
      description: 'Standard approval for most operations',
      requiredApprovers: 1,
      allowedApproverRoles: ['user', 'admin'],
      enabled: true
    });
    
    // Admin-only approval level
    this.addLevel({
      id: 'level_admin',
      name: 'Admin Approval',
      description: 'Admin-only approval for sensitive operations',
      requiredApprovers: 1,
      allowedApproverRoles: ['admin'],
      expiresAfter: 60 * 24, // 24 hours
      enabled: true
    });
    
    // Multi-approver level
    this.addLevel({
      id: 'level_multi',
      name: 'Multi-Person Approval',
      description: 'Requires approval from multiple people',
      requiredApprovers: 2,
      allowedApproverRoles: ['user', 'admin', 'manager'],
      expiresAfter: 60 * 72, // 72 hours
      enabled: true
    });
  }
  
  /**
   * Add or update an approval rule
   */
  public addRule(rule: ApprovalRule): void {
    this.rules.set(rule.id, rule);
  }
  
  /**
   * Remove an approval rule
   */
  public removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }
  
  /**
   * Get all approval rules
   */
  public getAllRules(): ApprovalRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Add or update an approval level
   */
  public addLevel(level: ApprovalLevel): void {
    this.levels.set(level.id, level);
  }
  
  /**
   * Remove an approval level
   */
  public removeLevel(levelId: string): boolean {
    return this.levels.delete(levelId);
  }
  
  /**
   * Get all approval levels
   */
  public getAllLevels(): ApprovalLevel[] {
    return Array.from(this.levels.values())
      .filter(level => level.enabled);
  }
  
  /**
   * Check if a task requires approval and return the matching rule if it does
   */
  public checkApprovalRequired(task: PlanningTask): { required: boolean; rule?: ApprovalRule } {
    const rules = this.getAllRules();
    
    for (const rule of rules) {
      if (rule.condition(task)) {
        return { required: true, rule };
      }
    }
    
    return { required: false };
  }
  
  /**
   * Record an approval request
   */
  public recordApprovalRequest(
    taskId: string,
    taskTitle: string,
    rule: ApprovalRule,
    subGoalId?: string
  ): ApprovalHistoryEntry {
    const entry: ApprovalHistoryEntry = {
      id: `approval_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      taskId,
      subGoalId,
      taskTitle,
      requestedAt: new Date(),
      approved: false,
      reason: rule.reason || rule.description,
      ruleId: rule.id,
      ruleName: rule.name
    };
    
    this.history.push(entry);
    return entry;
  }
  
  /**
   * Record an approval decision
   */
  public recordApprovalDecision(
    entryId: string,
    approved: boolean,
    approvedBy?: string,
    approverRole?: string,
    notes?: string
  ): ApprovalHistoryEntry | null {
    const entryIndex = this.history.findIndex(entry => entry.id === entryId);
    
    if (entryIndex === -1) {
      return null;
    }
    
    const updatedEntry: ApprovalHistoryEntry = {
      ...this.history[entryIndex],
      decidedAt: new Date(),
      approved,
      approvedBy,
      approverRole,
      notes
    };
    
    this.history[entryIndex] = updatedEntry;
    return updatedEntry;
  }
  
  /**
   * Get approval history entries
   */
  public getApprovalHistory(
    filter?: {
      taskId?: string;
      approved?: boolean;
      approvedBy?: string;
      ruleId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): ApprovalHistoryEntry[] {
    let results = [...this.history];
    
    if (filter) {
      if (filter.taskId) {
        results = results.filter(entry => entry.taskId === filter.taskId);
      }
      
      if (filter.approved !== undefined) {
        results = results.filter(entry => entry.approved === filter.approved);
      }
      
      if (filter.approvedBy) {
        results = results.filter(entry => entry.approvedBy === filter.approvedBy);
      }
      
      if (filter.ruleId) {
        results = results.filter(entry => entry.ruleId === filter.ruleId);
      }
      
      if (filter.startDate) {
        const startDate = filter.startDate;
        results = results.filter(entry => entry.requestedAt >= startDate);
      }
      
      if (filter.endDate) {
        const endDate = filter.endDate;
        results = results.filter(entry => entry.requestedAt <= endDate);
      }
    }
    
    // Sort by requested date (newest first)
    return results.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }
  
  /**
   * Get approval history for a specific task
   */
  public getTaskApprovalHistory(taskId: string): ApprovalHistoryEntry[] {
    return this.getApprovalHistory({ taskId });
  }
  
  /**
   * Export approval history to JSON format
   */
  public exportApprovalHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }
  
  /**
   * Import approval history from JSON format
   */
  public importApprovalHistory(json: string): boolean {
    try {
      const data = JSON.parse(json) as ApprovalHistoryEntry[];
      
      if (!Array.isArray(data)) {
        return false;
      }
      
      // Convert string dates back to Date objects
      this.history = data.map(entry => ({
        ...entry,
        requestedAt: new Date(entry.requestedAt),
        decidedAt: entry.decidedAt ? new Date(entry.decidedAt) : undefined
      }));
      
      return true;
    } catch (error) {
      console.error('Error importing approval history:', error);
      return false;
    }
  }
}

// Export singleton instance
export const approvalConfig = ApprovalConfigurationManager.getInstance(); 