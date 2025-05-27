/**
 * Improvement Action Manager
 * 
 * Handles CRUD operations for improvement actions, action lifecycle management,
 * and action prioritization. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  ImprovementActionManager as IImprovementActionManager,
  ImprovementAction,
  ActionListOptions,
  ValidationResult
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for action management errors
 */
export class ActionManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ActionManagementError';
  }
}

/**
 * Implementation of ImprovementActionManager interface
 */
export class ImprovementActionManager implements IImprovementActionManager {
  private actions: Map<string, ImprovementAction> = new Map();
  private readonly maxActions: number;

  constructor(config: { maxActions?: number } = {}) {
    this.maxActions = config.maxActions || 1000;
  }

  /**
   * Create a new improvement action
   */
  async createAction(action: Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImprovementAction> {
    // Validate action data
    const validation = await this.validateActionData(action);
    if (!validation.isValid) {
      throw new ActionManagementError(
        `Invalid action data: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR',
        { errors: validation.errors, action }
      );
    }

    // Check if we're at capacity
    if (this.actions.size >= this.maxActions) {
      throw new ActionManagementError(
        `Maximum number of actions (${this.maxActions}) reached`,
        'CAPACITY_EXCEEDED',
        { currentCount: this.actions.size, maxActions: this.maxActions }
      );
    }

    const now = new Date();
    const newAction: ImprovementAction = {
      id: ulid(),
      createdAt: now,
      updatedAt: now,
      ...action
    };

    this.actions.set(newAction.id, newAction);
    return newAction;
  }

  /**
   * Get an improvement action by ID
   */
  async getAction(actionId: string): Promise<ImprovementAction | null> {
    return this.actions.get(actionId) || null;
  }

  /**
   * Update an improvement action
   */
  async updateAction(
    actionId: string, 
    updates: Partial<Omit<ImprovementAction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ImprovementAction> {
    const existingAction = this.actions.get(actionId);
    if (!existingAction) {
      throw new ActionManagementError(
        `Action not found: ${actionId}`,
        'ACTION_NOT_FOUND',
        { actionId }
      );
    }

    // Validate updates
    const validation = await this.validateActionUpdate(updates);
    if (!validation.isValid) {
      throw new ActionManagementError(
        `Invalid update data: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR',
        { errors: validation.errors, updates }
      );
    }

    const updatedAction: ImprovementAction = {
      ...existingAction,
      ...updates,
      updatedAt: new Date()
    };

    this.actions.set(actionId, updatedAction);
    return updatedAction;
  }

  /**
   * List improvement actions with filtering and sorting
   */
  async listActions(options: ActionListOptions = {}): Promise<ImprovementAction[]> {
    let actions = Array.from(this.actions.values());

    // Apply filters
    if (options.status && options.status.length > 0) {
      actions = actions.filter(action => options.status!.includes(action.status));
    }

    if (options.targetArea && options.targetArea.length > 0) {
      actions = actions.filter(action => options.targetArea!.includes(action.targetArea));
    }

    if (options.priority && options.priority.length > 0) {
      actions = actions.filter(action => options.priority!.includes(action.priority));
    }

    if (options.minExpectedImpact !== undefined) {
      actions = actions.filter(action => action.expectedImpact >= options.minExpectedImpact!);
    }

    // Apply sorting
    if (options.sortBy) {
      const direction = options.sortDirection === 'desc' ? -1 : 1;
      actions.sort((a, b) => {
        let aValue: number | Date;
        let bValue: number | Date;

        switch (options.sortBy) {
          case 'createdAt':
            aValue = a.createdAt;
            bValue = b.createdAt;
            break;
          case 'priority':
            aValue = this.getPriorityWeight(a.priority);
            bValue = this.getPriorityWeight(b.priority);
            break;
          case 'expectedImpact':
            aValue = a.expectedImpact;
            bValue = b.expectedImpact;
            break;
          case 'difficulty':
            aValue = a.difficulty;
            bValue = b.difficulty;
            break;
          default:
            return 0;
        }

        if (aValue instanceof Date && bValue instanceof Date) {
          return direction * (aValue.getTime() - bValue.getTime());
        }
        return direction * ((aValue as number) - (bValue as number));
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || actions.length;
    return actions.slice(offset, offset + limit);
  }

  /**
   * Delete an improvement action
   */
  async deleteAction(actionId: string): Promise<boolean> {
    const exists = this.actions.has(actionId);
    if (exists) {
      this.actions.delete(actionId);
    }
    return exists;
  }

  /**
   * Execute an improvement action (mark as in progress)
   */
  async executeAction(actionId: string): Promise<boolean> {
    const action = this.actions.get(actionId);
    if (!action) {
      return false;
    }

    if (action.status !== 'accepted') {
      throw new ActionManagementError(
        `Action must be in 'accepted' status to execute, current status: ${action.status}`,
        'INVALID_STATUS',
        { actionId, currentStatus: action.status }
      );
    }

    await this.updateAction(actionId, { status: 'in_progress' });
    return true;
  }

  /**
   * Get actions by status
   */
  async getActionsByStatus(status: ImprovementAction['status']): Promise<ImprovementAction[]> {
    return this.listActions({ status: [status] });
  }

  /**
   * Get actions by priority
   */
  async getActionsByPriority(priority: ImprovementAction['priority']): Promise<ImprovementAction[]> {
    return this.listActions({ priority: [priority] });
  }

  /**
   * Get action statistics
   */
  async getStats(): Promise<Record<string, unknown>> {
    const actions = Array.from(this.actions.values());
    const statusCounts = this.countByProperty(actions, 'status');
    const priorityCounts = this.countByProperty(actions, 'priority');
    const targetAreaCounts = this.countByProperty(actions, 'targetArea');

    return {
      total: actions.length,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      byTargetArea: targetAreaCounts,
      averageExpectedImpact: this.calculateAverage(actions, 'expectedImpact'),
      averageDifficulty: this.calculateAverage(actions, 'difficulty')
    };
  }

  /**
   * Clear all actions (for testing)
   */
  async clear(): Promise<void> {
    this.actions.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateActionData(action: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!action.title || action.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!action.description || action.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!action.sourceInsightId || action.sourceInsightId.trim().length === 0) {
      errors.push('Source insight ID is required');
    }

    // Validate enums
    const validStatuses = ['suggested', 'accepted', 'in_progress', 'completed', 'rejected'];
    if (action.status && !validStatuses.includes(action.status)) {
      errors.push(`Invalid status: ${action.status}`);
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (action.priority && !validPriorities.includes(action.priority)) {
      errors.push(`Invalid priority: ${action.priority}`);
    }

    const validTargetAreas = ['tools', 'planning', 'learning', 'knowledge', 'execution', 'interaction'];
    if (action.targetArea && !validTargetAreas.includes(action.targetArea)) {
      errors.push(`Invalid target area: ${action.targetArea}`);
    }

    // Validate numeric ranges
    if (action.expectedImpact !== undefined && (action.expectedImpact < 0 || action.expectedImpact > 1)) {
      errors.push('Expected impact must be between 0 and 1');
    }

    if (action.difficulty !== undefined && (action.difficulty < 0 || action.difficulty > 1)) {
      errors.push('Difficulty must be between 0 and 1');
    }

    // Validate implementation steps
    if (action.implementationSteps) {
      if (!Array.isArray(action.implementationSteps)) {
        errors.push('Implementation steps must be an array');
      } else {
        action.implementationSteps.forEach((step, index) => {
          if (!step.description || step.description.trim().length === 0) {
            errors.push(`Implementation step ${index + 1} must have a description`);
          }
          const validStepStatuses = ['pending', 'completed', 'failed'];
          if (step.status && !validStepStatuses.includes(step.status)) {
            errors.push(`Invalid step status at index ${index + 1}: ${step.status}`);
          }
        });
      }
    }

    // Warnings
    if (action.title && action.title.length > 100) {
      warnings.push('Title is quite long, consider shortening');
    }

    if (action.description && action.description.length > 1000) {
      warnings.push('Description is very long, consider summarizing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }

  private async validateActionUpdate(updates: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // For updates, only validate fields that are being updated
    // Required fields validation only if they are being set to empty values
    if (updates.title !== undefined && (!updates.title || updates.title.trim().length === 0)) {
      errors.push('Title cannot be empty');
    }

    if (updates.description !== undefined && (!updates.description || updates.description.trim().length === 0)) {
      errors.push('Description cannot be empty');
    }

    if (updates.sourceInsightId !== undefined && (!updates.sourceInsightId || updates.sourceInsightId.trim().length === 0)) {
      errors.push('Source insight ID cannot be empty');
    }

    // Validate enums if provided
    const validStatuses = ['suggested', 'accepted', 'in_progress', 'completed', 'rejected'];
    if (updates.status && !validStatuses.includes(updates.status)) {
      errors.push(`Invalid status: ${updates.status}`);
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (updates.priority && !validPriorities.includes(updates.priority)) {
      errors.push(`Invalid priority: ${updates.priority}`);
    }

    const validTargetAreas = ['tools', 'planning', 'learning', 'knowledge', 'execution', 'interaction'];
    if (updates.targetArea && !validTargetAreas.includes(updates.targetArea)) {
      errors.push(`Invalid target area: ${updates.targetArea}`);
    }

    // Validate numeric ranges if provided
    if (updates.expectedImpact !== undefined && (updates.expectedImpact < 0 || updates.expectedImpact > 1)) {
      errors.push('Expected impact must be between 0 and 1');
    }

    if (updates.difficulty !== undefined && (updates.difficulty < 0 || updates.difficulty > 1)) {
      errors.push('Difficulty must be between 0 and 1');
    }

    // Validate implementation steps if provided
    if (updates.implementationSteps) {
      if (!Array.isArray(updates.implementationSteps)) {
        errors.push('Implementation steps must be an array');
      } else {
        updates.implementationSteps.forEach((step, index) => {
          if (!step.description || step.description.trim().length === 0) {
            errors.push(`Implementation step ${index + 1} must have a description`);
          }
          const validStepStatuses = ['pending', 'completed', 'failed'];
          if (step.status && !validStepStatuses.includes(step.status)) {
            errors.push(`Invalid step status at index ${index + 1}: ${step.status}`);
          }
        });
      }
    }

    // Warnings
    if (updates.title && updates.title.length > 100) {
      warnings.push('Title is quite long, consider shortening');
    }

    if (updates.description && updates.description.length > 1000) {
      warnings.push('Description is very long, consider summarizing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }

  private getPriorityWeight(priority: ImprovementAction['priority']): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[priority];
  }

  private countByProperty(
    items: ImprovementAction[], 
    property: keyof ImprovementAction
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const value = String(item[property]);
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  private calculateAverage(
    items: ImprovementAction[], 
    property: keyof ImprovementAction
  ): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (Number(item[property]) || 0), 0);
    return sum / items.length;
  }
} 