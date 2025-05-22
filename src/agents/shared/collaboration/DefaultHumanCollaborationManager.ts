/**
 * Default implementation of the Human Collaboration Manager
 * 
 * This file provides a concrete implementation of the human collaboration
 * interface that combines stakeholder management, approval workflows,
 * and correction handling.
 */

import { 
  HumanCollaborationManager, 
  StakeholderProfile, 
  ApprovalRule, 
  Correction, 
  CollaborativeTask,
  DEFAULT_PROFILE,
  ApprovalHistoryEntry
} from './interfaces/HumanCollaboration.interface';
import { StakeholderManager } from './stakeholder/StakeholderManager';
import { approvalConfig } from './approval/ApprovalConfigurationManager';
import { CorrectionHandler } from './correction/CorrectionHandler';
import { BaseManager } from '../base/managers/BaseManager';
import { ConsoleLogger } from '../../../agents/utils/logging/ConsoleLogger';

// Interface for memory interaction
interface MemoryInterface {
  addMemory(params: Record<string, any>): Promise<any>;
  searchMemories(query: string, options?: Record<string, any>): Promise<Array<{
    id: string;
    content: string;
    category?: string;
    source?: string;
    context?: string;
    tags?: string[];
    timestamp?: Date;
  }>>;
}

/**
 * Default implementation of the human collaboration manager
 */
export class DefaultHumanCollaborationManager implements HumanCollaborationManager {
  private memoryManager?: MemoryInterface;
  private ready = false;
  protected logger = new ConsoleLogger('human-collaboration');
  
  constructor() {
    // Initialize the logger
    this.logger.setLogLevel('info');
  }
  
  /**
   * Initialize the collaboration manager
   * 
   * @param config Manager configuration
   * @returns Promise resolving to initialization success
   */
  async initialize(config?: Record<string, unknown>): Promise<boolean> {
    this.logger.info('Initializing Human Collaboration Manager');
    
    // Store memory manager reference if provided
    if (config?.memoryManager) {
      this.memoryManager = config.memoryManager as MemoryInterface;
    }
    
    this.ready = true;
    this.logger.info('Human Collaboration Manager initialized');
    return true;
  }
  
  /**
   * Check if a task needs clarification before proceeding
   * 
   * @param task The planned task to evaluate
   * @returns Promise resolving to true if clarification is needed
   */
  async checkNeedClarification(task: CollaborativeTask): Promise<boolean> {
    // Check for low confidence score
    if (task.confidenceScore !== undefined && task.confidenceScore < 0.6) {
      return true;
    }

    // Check for missing required parameters
    if (task.requiredParams && task.params) {
      const missingParams = task.requiredParams.filter(param => 
        !task.params || task.params[param] === undefined || task.params[param] === null
      );
      if (missingParams.length > 0) {
        return true;
      }
    }

    // Check for uncertainty in the task description or reasoning
    const uncertaintyWords = [
      'maybe', 'somehow', 'not sure', 'uncertain', 'unclear', 
      'ambiguous', 'perhaps', 'possibly', 'might', 'could be'
    ];
    
    const textToCheck = `${task.goal} ${task.reasoning || ''}`;
    
    return uncertaintyWords.some(word => 
      textToCheck.toLowerCase().includes(word.toLowerCase())
    );
  }
  
  /**
   * Generate questions to ask the user to clarify the task
   * 
   * @param task The planned task that needs clarification
   * @param stakeholderProfile Optional stakeholder profile for tone adjustment
   * @returns Promise resolving to an array of questions
   */
  async generateClarificationQuestions(
    task: CollaborativeTask,
    stakeholderProfile?: StakeholderProfile
  ): Promise<string[]> {
    const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
    const questions: string[] = [];
    const ambiguities = this.findAmbiguities(task);
    
    // Generate questions for missing parameters
    if (ambiguities.missingParams.length > 0) {
      for (const param of ambiguities.missingParams.slice(0, 2)) { // Limit to 2 param questions
        const baseQuestion = `Could you provide a value for the "${param}" parameter?`;
        questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
      }
      
      // If there are more missing params, create a combined question
      if (ambiguities.missingParams.length > 2) {
        const remainingParams = ambiguities.missingParams.slice(2).join('", "');
        const baseQuestion = `Could you also provide values for the "${remainingParams}" parameters?`;
        questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
      }
    }
    
    // Generate questions for uncertainty phrases
    if (ambiguities.uncertainPhrases.length > 0) {
      // Deduplicate and limit to 2 phrases
      const uniquePhrases = Array.from(new Set(ambiguities.uncertainPhrases)).slice(0, 2);
      
      for (const phrase of uniquePhrases) {
        // Extract the uncertain part and create a question
        const cleanPhrase = phrase.trim().replace(/^[.!?,\s]+|[.!?,\s]+$/g, '');
        const baseQuestion = `Could you clarify what you mean by "${cleanPhrase}"?`;
        questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
      }
    }
    
    // If no specific questions were generated but clarification is needed
    if (questions.length === 0 && task.confidenceScore !== undefined && task.confidenceScore < 0.6) {
      const baseQuestion = "I'm not entirely confident about this task. Could you provide more details?";
      questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
    }
    
    // Limit to 3 questions at most
    return questions.slice(0, 3);
  }
  
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
  ): string {
    const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
    
    // Generate the base clarification message
    return StakeholderManager.generateStakeholderMessage(
      "clarification",
      { questions },
      profile
    );
  }
  
  /**
   * Check if a task requires approval before execution
   * 
   * @param task The planned task to evaluate
   * @returns Object indicating if approval is required and the rule if applicable
   */
  checkIfApprovalRequired(task: CollaborativeTask): { 
    required: boolean; 
    rule?: ApprovalRule;
  } {
    return approvalConfig.checkApprovalRequired(task);
  }
  
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
  ): string {
    const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
    
    // Get the approval requirement with rule details
    const approvalCheck = this.checkIfApprovalRequired(task);
    
    // Determine the reason for approval
    let approvalReason = "This task requires approval based on defined rules";
    
    if (approvalCheck.rule) {
      approvalReason = approvalCheck.rule.reason || approvalCheck.rule.description;
      
      // Record this approval request in history if not already recorded
      if (!task.approvalEntryId) {
        const taskTitle = task.subGoals?.find((sg: any) => sg.id === task.currentSubGoalId)?.description || task.goal;
        const entry = approvalConfig.recordApprovalRequest(
          task.id || `task_${Date.now()}`,
          taskTitle,
          approvalCheck.rule,
          task.currentSubGoalId
        );
        
        // Store the approval entry ID on the task for future reference
        task.approvalEntryId = entry.id;
      }
    }
    
    // Generate the base approval message
    return StakeholderManager.generateStakeholderMessage(
      "approval",
      {
        taskDescription: task.subGoals?.find((sg: any) => sg.id === task.currentSubGoalId)?.description || task.goal,
        goal: task.goal,
        reason: approvalReason
      },
      profile
    );
  }
  
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
    approvedBy: string = 'user',
    notes?: string
  ): CollaborativeTask {
    // Create a new task object to avoid mutating the original
    const updatedTask = { ...task };
    
    // Update the task approval properties
    updatedTask.approvalGranted = approved;
    updatedTask.approvedBy = approvedBy;
    updatedTask.approvalNotes = notes;
    
    // If the task has an approval entry ID, record the decision in history
    if (updatedTask.approvalEntryId) {
      approvalConfig.recordApprovalDecision(
        updatedTask.approvalEntryId,
        approved,
        approvedBy,
        'user', // Default role
        notes
      );
    }
    
    return updatedTask;
  }
  
  /**
   * Get approval history for a specific task
   * 
   * @param taskId The ID of the task
   * @returns Promise resolving to array of approval history entries
   */
  async getApprovalHistory(taskId: string): Promise<ApprovalHistoryEntry[]> {
    return approvalConfig.getTaskApprovalHistory(taskId);
  }
  
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
  ): CollaborativeTask {
    return {
      ...task,
      stakeholderProfile: profile
    };
  }
  
  /**
   * Handle a correction to a task
   * 
   * @param task The task being corrected
   * @param correction The correction details
   * @returns Promise resolving to the updated task with correction notes
   */
  async handleCorrection(
    task: CollaborativeTask,
    correction: Correction
  ): Promise<CollaborativeTask> {
    // Create adapter for CorrectionHandler to use our MemoryInterface
    const memoryAdapter = this.memoryManager ? {
      addMemory: this.memoryManager.addMemory.bind(this.memoryManager),
      searchMemories: async (options: { query: string; filters?: Array<{ field: string; value: any }>; limit?: number; }) => {
        const results = await this.memoryManager!.searchMemories(
          options.query, 
          { 
            limit: options.limit,
            metadata: options.filters?.reduce((obj, filter) => {
              obj[filter.field] = filter.value;
              return obj;
            }, {} as Record<string, any>) 
          }
        );
        
        // Transform results to match CorrectionHandler's expected format
        return results.map(result => ({
          id: result.id,
          content: result.content,
          category: result.category || '',
          source: result.source || 'unknown',
          context: result.context,
          tags: result.tags,
          timestamp: result.timestamp
        }));
      }
    } : undefined;
    
    return CorrectionHandler.handleCorrection(task, correction, memoryAdapter);
  }
  
  /**
   * Check for past corrections that may be relevant to the current task
   * 
   * @param task The current task plan
   * @returns Promise resolving to object with correction suggestions
   */
  async checkPastCorrections(
    task: CollaborativeTask
  ): Promise<{
    hasSimilarCorrections: boolean;
    suggestedAdjustments: string[];
    relevantCorrections: string[];
  }> {
    // Create adapter for CorrectionHandler to use our MemoryInterface
    const memoryAdapter = this.memoryManager ? {
      addMemory: this.memoryManager.addMemory.bind(this.memoryManager),
      searchMemories: async (options: { query: string; filters?: Array<{ field: string; value: any }>; limit?: number; }) => {
        const results = await this.memoryManager!.searchMemories(
          options.query, 
          { 
            limit: options.limit,
            metadata: options.filters?.reduce((obj, filter) => {
              obj[filter.field] = filter.value;
              return obj;
            }, {} as Record<string, any>) 
          }
        );
        
        // Transform results to match CorrectionHandler's expected format
        return results.map(result => ({
          id: result.id,
          content: result.content,
          category: result.category || '',
          source: result.source || 'unknown',
          context: result.context,
          tags: result.tags,
          timestamp: result.timestamp
        }));
      }
    } : undefined;
    
    return CorrectionHandler.checkPastCorrections(task, memoryAdapter);
  }
  
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
  ): CollaborativeTask {
    return CorrectionHandler.applyCorrection(task, correction);
  }
  
  /**
   * Add an approval rule
   * 
   * @param rule The rule to add
   * @returns Promise resolving to success
   */
  async addApprovalRule(rule: ApprovalRule): Promise<boolean> {
    approvalConfig.addRule(rule);
    return true;
  }
  
  /**
   * Remove an approval rule
   * 
   * @param ruleId The ID of the rule to remove
   * @returns Promise resolving to success
   */
  async removeApprovalRule(ruleId: string): Promise<boolean> {
    return approvalConfig.removeRule(ruleId);
  }
  
  /**
   * Get all approval rules
   * 
   * @returns Promise resolving to array of approval rules
   */
  async getAllApprovalRules(): Promise<ApprovalRule[]> {
    return approvalConfig.getAllRules();
  }
  
  /**
   * Adjust the tone of a message based on stakeholder profile
   * 
   * @param input The original message text
   * @param profile The stakeholder profile to adjust for
   * @returns The adjusted message text
   */
  adjustTone(input: string, profile?: StakeholderProfile): string {
    return StakeholderManager.adjustTone(input, profile || DEFAULT_PROFILE);
  }
  
  /**
   * Find ambiguous elements in a task
   * 
   * @param task The planned task to analyze
   * @returns An object containing different types of ambiguities
   */
  private findAmbiguities(task: CollaborativeTask): {
    missingParams: string[];
    uncertainPhrases: string[];
  } {
    const result = {
      missingParams: [] as string[],
      uncertainPhrases: [] as string[]
    };
    
    // Check for missing required parameters
    if (task.requiredParams && task.params) {
      result.missingParams = task.requiredParams.filter(param => 
        !task.params || task.params[param] === undefined || task.params[param] === null
      );
    }
    
    // Find uncertainty phrases in the task description or reasoning
    const uncertaintyWords = [
      'maybe', 'somehow', 'not sure', 'uncertain', 'unclear', 
      'ambiguous', 'perhaps', 'possibly', 'might', 'could be'
    ];
    
    const textToCheck = `${task.goal} ${task.reasoning || ''}`;
    
    // Find phrases containing uncertainty words (with surrounding context)
    for (const word of uncertaintyWords) {
      const regex = new RegExp(`[^.!?]*\\b${word}\\b[^.!?]*[.!?]`, 'gi');
      const matches = textToCheck.match(regex) || [];
      
      result.uncertainPhrases.push(...matches);
    }
    
    return result;
  }
}

// Export a singleton instance for easier use
export const humanCollaboration = new DefaultHumanCollaborationManager(); 