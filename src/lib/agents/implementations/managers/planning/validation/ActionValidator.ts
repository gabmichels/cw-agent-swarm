/**
 * ActionValidator.ts - Action validation component
 * 
 * This component handles comprehensive action validation including parameter validation,
 * tool availability verification, precondition checking, and safety constraint validation.
 */

import { ulid } from 'ulid';
import { 
  ValidationResult,
  ValidationIssue
} from '../interfaces/PlanningInterfaces';
import { 
  PlanAction 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for action validation
 */
export interface ActionValidatorConfig {
  /** Enable parameter validation */
  enableParameterValidation: boolean;
  
  /** Enable tool availability checking */
  enableToolAvailabilityCheck: boolean;
  
  /** Enable precondition checking */
  enablePreconditionCheck: boolean;
  
  /** Enable safety constraint validation */
  enableSafetyValidation: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Maximum parameter count per action */
  maxParametersPerAction: number;
  
  /** Validation timeout (ms) */
  validationTimeoutMs: number;
  
  /** Confidence threshold */
  confidenceThreshold: number;
}

/**
 * Default configuration for action validation
 */
const DEFAULT_CONFIG: ActionValidatorConfig = {
  enableParameterValidation: true,
  enableToolAvailabilityCheck: true,
  enablePreconditionCheck: true,
  enableSafetyValidation: true,
  enableLogging: true,
  maxParametersPerAction: 20,
  validationTimeoutMs: 10000,
  confidenceThreshold: 0.7
};

/**
 * Action validation options
 */
export interface ActionValidationOptions {
  /** Available tools for validation */
  availableTools?: string[];
  
  /** Context for precondition checking */
  context?: Record<string, unknown>;
  
  /** Safety constraints to enforce */
  safetyConstraints?: SafetyConstraint[];
  
  /** Skip certain validation types */
  skipValidation?: {
    parameters?: boolean;
    tools?: boolean;
    preconditions?: boolean;
    safety?: boolean;
  };
}

/**
 * Safety constraint definition
 */
export interface SafetyConstraint {
  /** Constraint name */
  name: string;
  
  /** Constraint type */
  type: 'parameter' | 'tool' | 'resource' | 'permission';
  
  /** Constraint rule */
  rule: string;
  
  /** Error message if violated */
  errorMessage: string;
  
  /** Severity of violation */
  severity: 'error' | 'warning';
}

/**
 * Action validation error
 */
export class ActionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionId: string,
    public readonly validationType: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ActionValidationError';
  }
}

/**
 * Action validator implementation
 */
export class ActionValidator {
  private readonly logger = createLogger({ moduleId: 'action-validator' });
  private readonly config: ActionValidatorConfig;
  private validationHistory: Map<string, ValidationResult> = new Map();
  private safetyConstraints: SafetyConstraint[] = [];

  constructor(config: Partial<ActionValidatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize default safety constraints
    this.initializeDefaultSafetyConstraints();
    
    if (this.config.enableLogging) {
      this.logger.info('ActionValidator initialized', { config: this.config });
    }
  }

  /**
   * Validate a single action
   */
  async validateAction(
    action: PlanAction,
    options: ActionValidationOptions = {}
  ): Promise<ValidationResult> {
    const validationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
                 this.logger.info('Starting action validation', {
           validationId,
           actionId: action.id,
           actionType: action.type,
           actionName: action.name
         });
      }

      const issues: ValidationIssue[] = [];
      let score = 1.0;

      // Parameter validation
      if (this.config.enableParameterValidation && !options.skipValidation?.parameters) {
        const parameterResult = await this.validateParameters(action, options);
        issues.push(...parameterResult.issues);
        score = Math.min(score, parameterResult.score);
      }

      // Tool availability validation
      if (this.config.enableToolAvailabilityCheck && !options.skipValidation?.tools) {
        const toolResult = await this.validateToolAvailability(action, options);
        issues.push(...toolResult.issues);
        score = Math.min(score, toolResult.score);
      }

      // Precondition validation
      if (this.config.enablePreconditionCheck && !options.skipValidation?.preconditions) {
        const preconditionResult = await this.validatePreconditions(action, options);
        issues.push(...preconditionResult.issues);
        score = Math.min(score, preconditionResult.score);
      }

      // Safety validation
      if (this.config.enableSafetyValidation && !options.skipValidation?.safety) {
        const safetyResult = await this.validateSafety(action, options);
        issues.push(...safetyResult.issues);
        score = Math.min(score, safetyResult.score);
      }

      const validationTime = Date.now() - startTime;
      const result: ValidationResult = {
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        score,
        issues,
        suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
      };

      // Store validation history
      this.validationHistory.set(action.id, result);

      if (this.config.enableLogging) {
        this.logger.info('Action validation completed', {
          validationId,
          actionId: action.id,
          isValid: result.isValid,
          score: result.score,
          issueCount: issues.length,
          validationTime
        });
      }

      return result;

    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Action validation failed', {
          validationId,
          actionId: action.id,
          error: error instanceof Error ? error.message : String(error),
          validationTime
        });
      }

      throw new ActionValidationError(
        `Action validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_FAILED',
        action.id,
        'complete',
        { validationId, validationTime }
      );
    }
  }

  /**
   * Validate action parameters
   */
  async validateParameters(
    action: PlanAction,
    options: ActionValidationOptions = {}
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Check if parameters exist
    if (!action.parameters) {
      issues.push({
        severity: 'warning',
        message: 'Action has no parameters',
        location: { actionId: action.id, field: 'parameters' },
        suggestedFix: 'Add required parameters for the action'
      });
      score -= 0.1;
    } else {
      // Check parameter count
      const paramCount = Object.keys(action.parameters).length;
      if (paramCount > this.config.maxParametersPerAction) {
        issues.push({
          severity: 'warning',
          message: `Too many parameters (${paramCount} > ${this.config.maxParametersPerAction})`,
          location: { actionId: action.id, field: 'parameters' },
          suggestedFix: 'Reduce the number of parameters or split the action'
        });
        score -= 0.1;
      }

      // Validate parameter types and values
      for (const [key, value] of Object.entries(action.parameters)) {
        const paramIssues = this.validateParameter(action.id, key, value);
        issues.push(...paramIssues);
        if (paramIssues.some(issue => issue.severity === 'error')) {
          score -= 0.2;
        }
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Validate a single parameter
   */
  private validateParameter(actionId: string, key: string, value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for null/undefined values
    if (value === null || value === undefined) {
      issues.push({
        severity: 'error',
        message: `Parameter '${key}' is null or undefined`,
        location: { actionId, field: `parameters.${key}` },
        suggestedFix: 'Provide a valid value for the parameter'
      });
      return issues;
    }

    // Check for empty strings
    if (typeof value === 'string' && value.trim().length === 0) {
      issues.push({
        severity: 'warning',
        message: `Parameter '${key}' is an empty string`,
        location: { actionId, field: `parameters.${key}` },
        suggestedFix: 'Provide a non-empty string value'
      });
    }

    // Check for very large objects/arrays
    if (typeof value === 'object' && value !== null) {
      const jsonString = JSON.stringify(value);
      if (jsonString.length > 10000) { // 10KB limit
        issues.push({
          severity: 'warning',
          message: `Parameter '${key}' is very large (${jsonString.length} characters)`,
          location: { actionId, field: `parameters.${key}` },
          suggestedFix: 'Consider reducing the parameter size or using references'
        });
      }
    }

    return issues;
  }

  /**
   * Validate tool availability
   */
  async validateToolAvailability(
    action: PlanAction,
    options: ActionValidationOptions = {}
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

         // Check if tool is specified in parameters
     const toolName = action.parameters?.tool as string || action.type;
     if (!toolName || toolName.trim().length === 0) {
       issues.push({
         severity: 'warning',
         message: 'Action should specify a tool in parameters or have a specific type',
         location: { actionId: action.id, field: 'parameters.tool' },
         suggestedFix: 'Specify a tool in parameters or use a specific action type'
       });
       score -= 0.2;
     } else {
       // Check if tool is in available tools list
       if (options.availableTools && !options.availableTools.includes(toolName)) {
         issues.push({
           severity: 'warning',
           message: `Tool '${toolName}' is not in available tools list`,
           location: { actionId: action.id, field: 'parameters.tool' },
           suggestedFix: `Use one of the available tools: ${options.availableTools.join(', ')}`
         });
         score -= 0.2;
       }

       // Validate tool name format
       if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(toolName)) {
         issues.push({
           severity: 'warning',
           message: `Tool name '${toolName}' has invalid format`,
           location: { actionId: action.id, field: 'parameters.tool' },
           suggestedFix: 'Use alphanumeric characters, underscores, and hyphens only'
         });
         score -= 0.1;
       }
     }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Validate action preconditions
   */
  async validatePreconditions(
    action: PlanAction,
    options: ActionValidationOptions = {}
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Check action type specific preconditions
    const typeIssues = this.validateActionTypePreconditions(action, options.context);
    issues.push(...typeIssues);
    if (typeIssues.some(issue => issue.severity === 'error')) {
      score -= 0.3;
    }

    // Check parameter dependencies
    const dependencyIssues = this.validateParameterDependencies(action);
    issues.push(...dependencyIssues);
    if (dependencyIssues.some(issue => issue.severity === 'error')) {
      score -= 0.2;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Validate action type specific preconditions
   */
  private validateActionTypePreconditions(
    action: PlanAction,
    context?: Record<string, unknown>
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    switch (action.type) {
      case 'llm_query':
        if (!action.parameters?.prompt) {
          issues.push({
            severity: 'error',
            message: 'LLM query action requires a prompt parameter',
            location: { actionId: action.id, field: 'parameters.prompt' },
            suggestedFix: 'Add a prompt parameter with the query text'
          });
        }
        break;

      case 'tool_use':
        if (!action.parameters?.input) {
          issues.push({
            severity: 'warning',
            message: 'Tool use action should have input parameters',
            location: { actionId: action.id, field: 'parameters.input' },
            suggestedFix: 'Add input parameters for the tool'
          });
        }
        break;

      case 'analysis':
        if (!action.parameters?.data && !action.parameters?.source) {
          issues.push({
            severity: 'error',
            message: 'Analysis action requires data or source parameter',
            location: { actionId: action.id, field: 'parameters' },
            suggestedFix: 'Add data or source parameter for analysis'
          });
        }
        break;

      case 'research':
        if (!action.parameters?.query && !action.parameters?.topic) {
          issues.push({
            severity: 'error',
            message: 'Research action requires query or topic parameter',
            location: { actionId: action.id, field: 'parameters' },
            suggestedFix: 'Add query or topic parameter for research'
          });
        }
        break;
    }

    return issues;
  }

  /**
   * Validate parameter dependencies
   */
  private validateParameterDependencies(action: PlanAction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!action.parameters) return issues;

    // Check for common parameter dependency patterns
    const params = action.parameters;

    // If there's a file path, check for file operations
    if (params.filePath && !params.operation) {
      issues.push({
        severity: 'warning',
        message: 'File path specified but no operation defined',
        location: { actionId: action.id, field: 'parameters' },
        suggestedFix: 'Add an operation parameter (read, write, delete, etc.)'
      });
    }

    // If there's a URL, check for HTTP method
    if (params.url && !params.method) {
      issues.push({
        severity: 'warning',
        message: 'URL specified but no HTTP method defined',
        location: { actionId: action.id, field: 'parameters' },
        suggestedFix: 'Add a method parameter (GET, POST, PUT, DELETE, etc.)'
      });
    }

    return issues;
  }

  /**
   * Validate safety constraints
   */
  async validateSafety(
    action: PlanAction,
    options: ActionValidationOptions = {}
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Combine default and custom safety constraints
    const allConstraints = [
      ...this.safetyConstraints,
      ...(options.safetyConstraints || [])
    ];

    // Check each safety constraint
    for (const constraint of allConstraints) {
      const violation = this.checkSafetyConstraint(action, constraint);
      if (violation) {
        issues.push({
          severity: constraint.severity,
          message: constraint.errorMessage,
          location: { actionId: action.id, field: constraint.type },
          suggestedFix: `Ensure action complies with ${constraint.name} constraint`
        });
        
        if (constraint.severity === 'error') {
          score -= 0.3;
        } else {
          score -= 0.1;
        }
      }
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Check a single safety constraint
   */
  private checkSafetyConstraint(action: PlanAction, constraint: SafetyConstraint): boolean {
    switch (constraint.type) {
      case 'tool':
        return this.checkToolSafetyConstraint(action, constraint);
      case 'parameter':
        return this.checkParameterSafetyConstraint(action, constraint);
      case 'resource':
        return this.checkResourceSafetyConstraint(action, constraint);
      case 'permission':
        return this.checkPermissionSafetyConstraint(action, constraint);
      default:
        return false;
    }
  }

  /**
   * Check tool safety constraint
   */
     private checkToolSafetyConstraint(action: PlanAction, constraint: SafetyConstraint): boolean {
     if (constraint.rule === 'no_dangerous_tools') {
       const dangerousTools = ['rm', 'delete', 'format', 'shutdown'];
       const toolName = action.parameters?.tool as string || action.type;
       return dangerousTools.some(tool => toolName?.includes(tool));
     }
     return false;
   }

  /**
   * Check parameter safety constraint
   */
  private checkParameterSafetyConstraint(action: PlanAction, constraint: SafetyConstraint): boolean {
    if (constraint.rule === 'no_sensitive_data') {
      const params = JSON.stringify(action.parameters || {}).toLowerCase();
      const sensitivePatterns = ['password', 'secret', 'key', 'token', 'credential'];
      return sensitivePatterns.some(pattern => params.includes(pattern));
    }
    return false;
  }

  /**
   * Check resource safety constraint
   */
  private checkResourceSafetyConstraint(action: PlanAction, constraint: SafetyConstraint): boolean {
    if (constraint.rule === 'no_excessive_resources') {
      // Check for parameters that might indicate excessive resource usage
      const params = action.parameters || {};
      const hasExcessiveMemory = params.maxMemory && Number(params.maxMemory) > 1000000000; // 1GB
      const hasExcessiveTimeout = params.timeout && Number(params.timeout) > 3600000; // 1 hour
      return Boolean(hasExcessiveMemory || hasExcessiveTimeout);
    }
    return false;
  }

  /**
   * Check permission safety constraint
   */
  private checkPermissionSafetyConstraint(action: PlanAction, constraint: SafetyConstraint): boolean {
    if (constraint.rule === 'no_admin_operations') {
      const adminKeywords = ['admin', 'root', 'sudo', 'elevated'];
      const actionStr = JSON.stringify(action).toLowerCase();
      return adminKeywords.some(keyword => actionStr.includes(keyword));
    }
    return false;
  }

  /**
   * Initialize default safety constraints
   */
  private initializeDefaultSafetyConstraints(): void {
    this.safetyConstraints = [
      {
        name: 'No Dangerous Tools',
        type: 'tool',
        rule: 'no_dangerous_tools',
        errorMessage: 'Action uses potentially dangerous tools',
        severity: 'error'
      },
      {
        name: 'No Sensitive Data',
        type: 'parameter',
        rule: 'no_sensitive_data',
        errorMessage: 'Action parameters may contain sensitive data',
        severity: 'warning'
      },
      {
        name: 'No Excessive Resources',
        type: 'resource',
        rule: 'no_excessive_resources',
        errorMessage: 'Action may consume excessive resources',
        severity: 'warning'
      },
      {
        name: 'No Admin Operations',
        type: 'permission',
        rule: 'no_admin_operations',
        errorMessage: 'Action requires administrative permissions',
        severity: 'error'
      }
    ];
  }

  /**
   * Add custom safety constraint
   */
  addSafetyConstraint(constraint: SafetyConstraint): void {
    this.safetyConstraints.push(constraint);
    
    if (this.config.enableLogging) {
      this.logger.info('Safety constraint added', { constraint: constraint.name });
    }
  }

  /**
   * Remove safety constraint
   */
  removeSafetyConstraint(name: string): boolean {
    const initialLength = this.safetyConstraints.length;
    this.safetyConstraints = this.safetyConstraints.filter(c => c.name !== name);
    
    const removed = this.safetyConstraints.length < initialLength;
    if (removed && this.config.enableLogging) {
      this.logger.info('Safety constraint removed', { constraintName: name });
    }
    
    return removed;
  }

  /**
   * Get validation history for an action
   */
  getValidationHistory(actionId: string): ValidationResult | undefined {
    return this.validationHistory.get(actionId);
  }

  /**
   * Clear validation history
   */
  clearValidationHistory(): void {
    this.validationHistory.clear();
  }

  /**
   * Configure validator behavior
   */
  configure(config: Partial<ActionValidatorConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('ActionValidator configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ActionValidatorConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    validationHistorySize: number;
    safetyConstraintsCount: number;
    config: ActionValidatorConfig;
  } {
    return {
      healthy: true,
      validationHistorySize: this.validationHistory.size,
      safetyConstraintsCount: this.safetyConstraints.length,
      config: this.config
    };
  }
} 