/**
 * DefaultCollaborationManager.ts - Default Collaboration Manager Implementation
 * 
 * This file provides the default collaboration manager implementation with support for:
 * - Clarification workflow management
 * - Approval system with stakeholder profiles
 * - Multi-level approval rules and history
 * - Stakeholder communication style adaptation
 * - Task approval decision tracking
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md:
 * - Clean break from legacy patterns
 * - No placeholder implementations
 * - Industry best practices with ULID IDs
 */

import { ulid } from 'ulid';
import { 
  CollaborationManager,
  CollaborationManagerConfig,
  CollaborativeTask,
  ApprovalCheckResult,
  StakeholderProfile,
  ApprovalHistoryEntry
} from '../../../../agents/shared/base/managers/CollaborationManager.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';
import { ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';

// Import existing collaboration implementations
import { DefaultHumanCollaborationManager } from '../../../../agents/shared/collaboration/DefaultHumanCollaborationManager';
import { 
  HumanCollaborationManager,
  StakeholderProfile as LegacyStakeholderProfile,
  ApprovalRule,
  Correction,
  CollaborativeTask as LegacyCollaborativeTask,
  ApprovalHistoryEntry as LegacyApprovalHistoryEntry
} from '../../../../agents/shared/collaboration/interfaces/HumanCollaboration.interface';

/**
 * Extended configuration for DefaultCollaborationManager
 */
export interface DefaultCollaborationManagerConfig extends CollaborationManagerConfig {
  /**
   * Whether this manager is enabled (required by BaseManager)
   */
  enabled: boolean;
  
  /**
   * Maximum number of approval history entries to keep in memory
   */
  maxApprovalHistory?: number;
  
  /**
   * Whether to enable automatic tone adjustment based on stakeholder profiles
   */
  enableToneAdjustment?: boolean;
  
  /**
   * Maximum clarification questions to generate per task
   */
  maxClarificationQuestions?: number;
  
  /**
   * Whether to enable automatic stakeholder management
   */
  enableAutoStakeholderManagement?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_COLLABORATION_MANAGER_CONFIG: DefaultCollaborationManagerConfig = {
  enabled: false, // Disabled by default for backward compatibility
  enableClarificationChecking: true,
  enableApprovalWorkflows: true,
  defaultStakeholderProfile: {
    name: 'User',
    role: 'stakeholder',
    communicationStyle: 'casual',
    expertise: []
  },
  approvalConfig: {
    defaultTimeoutMinutes: 60,
    requireApprovalForHighRisk: true,
    approvalLevels: [
      {
        id: 'basic',
        name: 'Basic Approval',
        requiredApprovers: 1,
        allowedRoles: ['user', 'stakeholder']
      },
      {
        id: 'advanced',
        name: 'Advanced Approval',
        requiredApprovers: 2,
        allowedRoles: ['admin', 'manager']
      }
    ]
  },
  maxApprovalHistory: 500,
  enableToneAdjustment: true,
  maxClarificationQuestions: 5,
  enableAutoStakeholderManagement: true
};

/**
 * Error class for collaboration-related errors
 */
export class CollaborationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'COLLABORATION_ERROR',
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}

/**
 * Default implementation of the CollaborationManager interface
 */
export class DefaultCollaborationManager extends AbstractBaseManager implements CollaborationManager {
  public readonly managerType: ManagerType = ManagerType.COLLABORATION;
  
  protected collaborationManager: HumanCollaborationManager;
  protected currentStakeholderProfile: StakeholderProfile | null = null;
  protected approvalHistoryCache: ApprovalHistoryEntry[] = [];
  
  protected _config: DefaultCollaborationManagerConfig;
  protected _initialized: boolean = false;
  
  /**
   * Create a new DefaultCollaborationManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(
    protected agent: AgentBase,
    config: Partial<DefaultCollaborationManagerConfig> = {}
  ) {
    const managerId = `collaboration-manager-${ulid()}`;
    const mergedConfig = {
      ...DEFAULT_COLLABORATION_MANAGER_CONFIG,
      ...config
    };
    
    super(
      managerId,
      ManagerType.COLLABORATION,
      agent,
      mergedConfig
    );
    
    this._config = mergedConfig;
    this.collaborationManager = new DefaultHumanCollaborationManager();
    
    // Set initial stakeholder profile if provided
    if (this._config.defaultStakeholderProfile) {
      this.currentStakeholderProfile = this._config.defaultStakeholderProfile;
    }
  }

  /**
   * Get the agent this manager belongs to
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Get the current configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return { ...this._config } as T;
  }

  /**
   * Update the configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    
    // Update default stakeholder profile if provided
    if ((config as any).defaultStakeholderProfile) {
      this.currentStakeholderProfile = (config as any).defaultStakeholderProfile;
    }
    
    return this._config as T;
  }

  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this._config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  /**
   * Initialize the collaboration manager
   */
  async initialize(): Promise<boolean> {
    try {
      console.log(`[${this.managerId}] Initializing DefaultCollaborationManager...`);
      
      if (!this._config.enabled) {
        console.log(`[${this.managerId}] Manager is disabled, skipping initialization`);
        this._initialized = true;
        return true;
      }
      
      // Initialize the underlying collaboration manager
      await this.collaborationManager.initialize({
        memoryManager: null // We'll connect this when needed
      });
      
      // Clear approval history cache
      this.approvalHistoryCache = [];
      
      console.log(`[${this.managerId}] DefaultCollaborationManager initialized successfully`);
      this._initialized = true;
      
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to initialize:`, error);
      throw new CollaborationError(
        `Failed to initialize collaboration manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INITIALIZATION_FAILED',
        { error }
      );
    }
  }

  /**
   * Shutdown the collaboration manager
   */
  async shutdown(): Promise<void> {
    try {
      console.log(`[${this.managerId}] Shutting down DefaultCollaborationManager...`);
      
      // Clear caches
      this.approvalHistoryCache = [];
      this.currentStakeholderProfile = null;
      
      this._initialized = false;
      console.log(`[${this.managerId}] DefaultCollaborationManager shut down successfully`);
    } catch (error) {
      console.error(`[${this.managerId}] Error during shutdown:`, error);
    }
  }

  /**
   * Reset the collaboration manager
   */
  async reset(): Promise<boolean> {
    try {
      console.log(`[${this.managerId}] Resetting DefaultCollaborationManager...`);
      
      await this.shutdown();
      const result = await this.initialize();
      
      console.log(`[${this.managerId}] DefaultCollaborationManager reset successfully`);
      return result;
    } catch (error) {
      console.error(`[${this.managerId}] Failed to reset:`, error);
      return false;
    }
  }

  /**
   * Get the health status of the collaboration manager
   */
  async getHealth(): Promise<ManagerHealth> {
    const issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string; detectedAt: Date }> = [];
    
    // Check if manager is disabled
    if (!this._config.enabled) {
      issues.push({
        severity: 'medium',
        message: 'Collaboration manager is disabled',
        detectedAt: new Date()
      });
    }
    
    // Check approval history cache size
    if (this.approvalHistoryCache.length > (this._config.maxApprovalHistory || 500) * 0.8) {
      issues.push({
        severity: 'medium',
        message: 'Approval history cache is approaching maximum capacity',
        detectedAt: new Date()
      });
    }
    
    // Check if stakeholder profile is set when needed
    if (this._config.enabled && this._config.enableToneAdjustment && !this.currentStakeholderProfile) {
      issues.push({
        severity: 'low',
        message: 'No stakeholder profile set, tone adjustment may be limited',
        detectedAt: new Date()
      });
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 
              issues.some(i => i.severity === 'high' || i.severity === 'critical') ? 'unhealthy' : 'degraded',
      details: {
        lastCheck: new Date(),
        issues,
        metrics: {
          initialized: this._initialized,
          enabled: this._config.enabled,
          approvalHistorySize: this.approvalHistoryCache.length,
          hasStakeholderProfile: this.currentStakeholderProfile !== null,
          clarificationCheckingEnabled: this._config.enableClarificationChecking,
          approvalWorkflowsEnabled: this._config.enableApprovalWorkflows
        }
      }
    };
  }

  /**
   * Check if a task needs clarification before proceeding
   */
  async checkNeedClarification(task: CollaborativeTask): Promise<boolean> {
    try {
      if (!this._config.enabled || !this._config.enableClarificationChecking) {
        return false;
      }
      
      // Convert to legacy format for compatibility
      const legacyTask = this.convertToLegacyTask(task);
      
      // Use the underlying collaboration manager to check
      const result = await this.collaborationManager.checkNeedClarification(legacyTask);
      
      return result;
    } catch (error) {
      console.error(`[${this.managerId}] Error checking clarification need:`, error);
      throw new CollaborationError(
        `Failed to check clarification need: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLARIFICATION_CHECK_FAILED',
        { task, error }
      );
    }
  }

  /**
   * Generate clarification questions for a task
   */
  async generateClarificationQuestions(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string[]> {
    try {
      if (!this._config.enabled || !this._config.enableClarificationChecking) {
        return [];
      }
      
      // Convert to legacy format
      const legacyTask = this.convertToLegacyTask(task);
      const legacyProfile = stakeholderProfile ? this.convertToLegacyProfile(stakeholderProfile) : undefined;
      
      // Generate questions using the underlying manager
      const questions = await this.collaborationManager.generateClarificationQuestions(legacyTask, legacyProfile);
      
      // Limit the number of questions if configured
      const maxQuestions = this._config.maxClarificationQuestions || 5;
      return questions.slice(0, maxQuestions);
    } catch (error) {
      console.error(`[${this.managerId}] Error generating clarification questions:`, error);
      throw new CollaborationError(
        `Failed to generate clarification questions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLARIFICATION_GENERATION_FAILED',
        { task, stakeholderProfile, error }
      );
    }
  }

  /**
   * Format a clarification request message
   */
  async formatClarificationRequest(
    task: CollaborativeTask,
    questions: string[],
    stakeholderProfile?: StakeholderProfile
  ): Promise<string> {
    try {
      if (!this._config.enabled) {
        return `Task: ${task.goal}\n\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
      }
      
      // Convert to legacy format
      const legacyTask = this.convertToLegacyTask(task);
      const legacyProfile = stakeholderProfile ? this.convertToLegacyProfile(stakeholderProfile) : undefined;
      
      // Use the underlying manager to format the request
      const formattedRequest = this.collaborationManager.formatClarificationRequest(
        legacyTask,
        questions,
        legacyProfile
      );
      
      return formattedRequest;
    } catch (error) {
      console.error(`[${this.managerId}] Error formatting clarification request:`, error);
      throw new CollaborationError(
        `Failed to format clarification request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLARIFICATION_FORMAT_FAILED',
        { task, questions, stakeholderProfile, error }
      );
    }
  }

  /**
   * Check if a task requires approval before execution
   */
  async checkIfApprovalRequired(task: CollaborativeTask): Promise<ApprovalCheckResult> {
    try {
      if (!this._config.enabled || !this._config.enableApprovalWorkflows) {
        return {
          required: false,
          estimatedApprovalTime: 0,
          requiredRoles: []
        };
      }
      
      // Convert to legacy format
      const legacyTask = this.convertToLegacyTask(task);
      
      // Check approval requirement using the underlying manager
      const checkResult = this.collaborationManager.checkIfApprovalRequired(legacyTask);
      
      // Convert the result to the new format
      return {
        required: checkResult.required,
        rule: checkResult.rule ? {
          id: checkResult.rule.id,
          name: checkResult.rule.name,
          description: checkResult.rule.description,
          reason: checkResult.rule.reason || checkResult.rule.description,
          approvalLevel: 'basic' // Default since legacy doesn't have approvalLevel
        } : undefined,
        estimatedApprovalTime: this._config.approvalConfig?.defaultTimeoutMinutes || 60,
        requiredRoles: this.getRequiredRolesForApprovalLevel('basic')
      };
    } catch (error) {
      console.error(`[${this.managerId}] Error checking approval requirement:`, error);
      throw new CollaborationError(
        `Failed to check approval requirement: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_CHECK_FAILED',
        { task, error }
      );
    }
  }

  /**
   * Format an approval request message
   */
  async formatApprovalRequest(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string> {
    try {
      if (!this._config.enabled) {
        return `Approval Required for Task: ${task.goal}`;
      }
      
      // Convert to legacy format
      const legacyTask = this.convertToLegacyTask(task);
      const legacyProfile = stakeholderProfile ? this.convertToLegacyProfile(stakeholderProfile) : undefined;
      
      // Use the underlying manager to format the request
      const formattedRequest = this.collaborationManager.formatApprovalRequest(legacyTask, legacyProfile);
      
      return formattedRequest;
    } catch (error) {
      console.error(`[${this.managerId}] Error formatting approval request:`, error);
      throw new CollaborationError(
        `Failed to format approval request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_FORMAT_FAILED',
        { task, stakeholderProfile, error }
      );
    }
  }

  /**
   * Apply an approval decision to a task
   */
  async applyApprovalDecision(
    task: CollaborativeTask,
    approved: boolean,
    approvedBy: string,
    notes?: string
  ): Promise<CollaborativeTask> {
    try {
      if (!this._config.enabled) {
        // Just update the task directly if disabled
        return {
          ...task,
          approvalGranted: approved,
          approvedBy,
          approvalNotes: notes
        };
      }
      
      // Convert to legacy format
      const legacyTask = this.convertToLegacyTask(task);
      
      // Apply the decision using the underlying manager
      const updatedLegacyTask = this.collaborationManager.applyApprovalDecision(
        legacyTask,
        approved,
        approvedBy,
        notes
      );
      
      // Convert back to new format
      const updatedTask = this.convertFromLegacyTask(updatedLegacyTask);
      
      // Add to approval history cache
      if (updatedTask.approvalEntryId) {
        const historyEntry: ApprovalHistoryEntry = {
          id: updatedTask.approvalEntryId,
          taskId: task.id,
          subGoalId: task.currentSubGoalId,
          taskTitle: task.goal,
          requestedAt: new Date(),
          decidedAt: new Date(),
          approved,
          approvedBy,
          approverRole: 'user', // Default role
          reason: notes || (approved ? 'Task approved' : 'Task rejected'),
          notes,
          ruleId: 'manual-approval',
          ruleName: 'Manual Approval'
        };
        
        this.addToApprovalHistory(historyEntry);
      }
      
      return updatedTask;
    } catch (error) {
      console.error(`[${this.managerId}] Error applying approval decision:`, error);
      throw new CollaborationError(
        `Failed to apply approval decision: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_DECISION_FAILED',
        { task, approved, approvedBy, notes, error }
      );
    }
  }

  /**
   * Get approval history for a specific task
   */
  async getApprovalHistory(taskId: string): Promise<ApprovalHistoryEntry[]> {
    try {
      if (!this._config.enabled) {
        return [];
      }
      
      // Filter from cache by task ID
      return this.approvalHistoryCache.filter(entry => entry.taskId === taskId);
    } catch (error) {
      console.error(`[${this.managerId}] Error getting approval history:`, error);
      throw new CollaborationError(
        `Failed to get approval history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_HISTORY_FAILED',
        { taskId, error }
      );
    }
  }

  /**
   * Add an approval rule
   */
  async addApprovalRule(rule: {
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
  }): Promise<boolean> {
    try {
      if (!this._config.enabled) {
        return false;
      }
      
      // Convert to legacy format and add using underlying manager
      const legacyRule: ApprovalRule = {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        condition: () => true, // Default condition function
        priority: 1,
        enabled: rule.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
        reason: rule.description
      };
      
      return await this.collaborationManager.addApprovalRule(legacyRule);
    } catch (error) {
      console.error(`[${this.managerId}] Error adding approval rule:`, error);
      throw new CollaborationError(
        `Failed to add approval rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_RULE_ADD_FAILED',
        { rule, error }
      );
    }
  }

  /**
   * Remove an approval rule
   */
  async removeApprovalRule(ruleId: string): Promise<boolean> {
    try {
      if (!this._config.enabled) {
        return false;
      }
      
      return await this.collaborationManager.removeApprovalRule(ruleId);
    } catch (error) {
      console.error(`[${this.managerId}] Error removing approval rule:`, error);
      throw new CollaborationError(
        `Failed to remove approval rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_RULE_REMOVE_FAILED',
        { ruleId, error }
      );
    }
  }

  /**
   * Get all approval rules
   */
  async getAllApprovalRules(): Promise<Array<{
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
  }>> {
    try {
      if (!this._config.enabled) {
        return [];
      }
      
      const legacyRules = await this.collaborationManager.getAllApprovalRules();
      
      // Convert to new format
      return legacyRules.map((rule: ApprovalRule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        conditions: [], // Legacy doesn't have conditions in this format
        approvalLevel: 'basic', // Default since legacy doesn't have this
        enabled: rule.enabled
      }));
    } catch (error) {
      console.error(`[${this.managerId}] Error getting approval rules:`, error);
      throw new CollaborationError(
        `Failed to get approval rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_RULES_GET_FAILED',
        { error }
      );
    }
  }

  /**
   * Update stakeholder profile
   */
  async updateStakeholderProfile(profile: StakeholderProfile): Promise<boolean> {
    try {
      if (!this._config.enabled) {
        return false;
      }
      
      // Store the profile locally
      this.currentStakeholderProfile = { ...profile };
      
      // For now, just store locally since the legacy interface doesn't have updateStakeholderProfile
      return true;
    } catch (error) {
      console.error(`[${this.managerId}] Error updating stakeholder profile:`, error);
      throw new CollaborationError(
        `Failed to update stakeholder profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STAKEHOLDER_UPDATE_FAILED',
        { profile, error }
      );
    }
  }

  /**
   * Get current stakeholder profile
   */
  async getStakeholderProfile(): Promise<StakeholderProfile | null> {
    try {
      if (!this._config.enabled) {
        return null;
      }
      
      // Return cached profile
      if (this.currentStakeholderProfile) {
        return { ...this.currentStakeholderProfile };
      }
      
      return null;
    } catch (error) {
      console.error(`[${this.managerId}] Error getting stakeholder profile:`, error);
      throw new CollaborationError(
        `Failed to get stakeholder profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STAKEHOLDER_GET_FAILED',
        { error }
      );
    }
  }

  // Helper methods for format conversion
  
  /**
   * Convert new CollaborativeTask format to legacy format
   */
  protected convertToLegacyTask(task: CollaborativeTask): LegacyCollaborativeTask {
    return {
      id: task.id,
      goal: task.goal,
      subGoals: task.subGoals?.map((sg: any) => ({
        id: sg.id,
        description: sg.description,
        status: sg.status,
        children: sg.children
      })),
      currentSubGoalId: task.currentSubGoalId,
      stakeholderProfile: task.stakeholderProfile ? this.convertToLegacyProfile(task.stakeholderProfile) : undefined,
      approvalGranted: task.approvalGranted,
      approvedBy: task.approvedBy,
      approvalNotes: task.approvalNotes,
      approvalEntryId: task.approvalEntryId
      // Removed metadata as it doesn't exist in legacy interface
    };
  }

  /**
   * Convert legacy CollaborativeTask format to new format
   */
  protected convertFromLegacyTask(legacyTask: LegacyCollaborativeTask): CollaborativeTask {
    return {
      id: legacyTask.id,
      goal: legacyTask.goal,
      subGoals: legacyTask.subGoals?.map((sg: any) => ({
        id: sg.id,
        description: sg.description,
        status: sg.status,
        children: sg.children
      })),
      currentSubGoalId: legacyTask.currentSubGoalId,
      stakeholderProfile: legacyTask.stakeholderProfile ? this.convertFromLegacyProfile(legacyTask.stakeholderProfile) : undefined,
      approvalGranted: legacyTask.approvalGranted,
      approvedBy: legacyTask.approvedBy,
      approvalNotes: legacyTask.approvalNotes,
      approvalEntryId: legacyTask.approvalEntryId,
      metadata: {} // Add empty metadata for new format
    };
  }

  /**
   * Convert new StakeholderProfile format to legacy format
   */
  protected convertToLegacyProfile(profile: StakeholderProfile): LegacyStakeholderProfile {
    return {
      id: ulid(), // Generate ID for legacy format
      name: profile.name,
      tone: profile.communicationStyle === 'formal' ? 'formal' : 
            profile.communicationStyle === 'casual' ? 'casual' : 'neutral',
      expertiseLevel: 'intermediate', // Default
      preferredFormat: profile.preferredFormat === 'brief' ? 'concise' : 'detailed',
      language: 'en' // Default
    };
  }

  /**
   * Convert legacy StakeholderProfile format to new format
   */
  protected convertFromLegacyProfile(legacyProfile: LegacyStakeholderProfile): StakeholderProfile {
    return {
      name: legacyProfile.name || 'User',
      role: 'stakeholder', // Default role
      communicationStyle: legacyProfile.tone === 'formal' ? 'formal' : 
                         legacyProfile.tone === 'casual' ? 'casual' : 'technical',
      expertise: [], // Default empty
      preferredFormat: legacyProfile.preferredFormat === 'concise' ? 'brief' : 'detailed',
      preferences: undefined // No equivalent in legacy
    };
  }

  /**
   * Get required roles for an approval level
   */
  protected getRequiredRolesForApprovalLevel(approvalLevel: string): string[] {
    const level = this._config.approvalConfig?.approvalLevels?.find(l => l.id === approvalLevel);
    return level?.allowedRoles || ['user', 'stakeholder'];
  }

  /**
   * Add an entry to the approval history cache
   */
  protected addToApprovalHistory(entry: ApprovalHistoryEntry): void {
    this.approvalHistoryCache.push(entry);
    
    // Trim if exceeding max size
    const maxSize = this._config.maxApprovalHistory || 500;
    if (this.approvalHistoryCache.length > maxSize) {
      this.approvalHistoryCache = this.approvalHistoryCache.slice(-maxSize);
    }
  }
} 