/**
 * ActionGenerator.ts - Action creation from steps
 * 
 * This component handles the generation of actions for plan steps,
 * including tool selection, parameter generation, and action optimization.
 */

import { ulid } from 'ulid';
import { 
  ActionGenerator as IActionGenerator,
  ActionGenerationOptions,
  ActionGenerationResult,
  ActionDependency,
  ValidationResult,
  ValidationIssue
} from '../interfaces/PlanningInterfaces';
import { PlanStep, PlanAction } from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for action generation
 */
export interface ActionGeneratorConfig {
  /** Maximum number of actions per step */
  maxActionsPerStep: number;
  
  /** Enable tool selection optimization */
  enableToolOptimization: boolean;
  
  /** Enable action validation */
  enableValidation: boolean;
  
  /** Enable action optimization */
  enableOptimization: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Default action timeout (ms) */
  defaultActionTimeoutMs: number;
  
  /** Action generation timeout (ms) */
  generationTimeoutMs: number;
}

/**
 * Default configuration for action generation
 */
const DEFAULT_CONFIG: ActionGeneratorConfig = {
  maxActionsPerStep: 10,
  enableToolOptimization: true,
  enableValidation: true,
  enableOptimization: true,
  enableLogging: true,
  defaultActionTimeoutMs: 60000, // 1 minute
  generationTimeoutMs: 30000 // 30 seconds
};

/**
 * Action template for common patterns
 */
interface ActionTemplate {
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Step pattern that triggers this template */
  stepPattern: RegExp;
  
  /** Generated action types */
  actionTypes: string[];
  
  /** Action descriptions */
  actionDescriptions: string[];
  
  /** Required tools for each action */
  requiredTools: (string | null)[];
  
  /** Estimated time per action (minutes) */
  estimatedTimes: number[];
  
  /** Dependencies between actions */
  dependencies: Array<{ from: number; to: number }>;
}

/**
 * Tool capability mapping
 */
interface ToolCapability {
  /** Tool name */
  name: string;
  
  /** Tool capabilities */
  capabilities: string[];
  
  /** Estimated execution time (minutes) */
  estimatedTime: number;
  
  /** Reliability score (0-1) */
  reliability: number;
}

/**
 * Action generation error
 */
export class ActionGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stepId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ActionGenerationError';
  }
}

/**
 * Implementation of ActionGenerator interface
 */
export class ActionGenerator implements IActionGenerator {
  private readonly logger = createLogger({ moduleId: 'action-generator' });
  private readonly config: ActionGeneratorConfig;
  private readonly actionTemplates: ActionTemplate[];
  private readonly toolCapabilities: ToolCapability[];

  constructor(config: Partial<ActionGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.actionTemplates = this.initializeActionTemplates();
    this.toolCapabilities = this.initializeToolCapabilities();
    
    if (this.config.enableLogging) {
      this.logger.info('ActionGenerator initialized', { config: this.config });
    }
  }

  /**
   * Generate actions for a step
   */
  async generateActions(
    step: PlanStep,
    options: ActionGenerationOptions = {}
  ): Promise<ActionGenerationResult> {
    const generationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting action generation', {
          generationId,
          stepId: step.id,
          stepName: step.name,
          options
        });
      }

      // Validate input
      if (!step.name || step.name.trim().length === 0) {
        throw new ActionGenerationError(
          'Step name cannot be empty',
          'INVALID_STEP',
          step.id,
          false
        );
      }

      // Check for Apify tool first
      const apifyTool = this.detectApifyTool(step);
      let actions: PlanAction[];
      
      if (apifyTool) {
        actions = this.createActionsForApifyTool(step, apifyTool, options);
      } else {
        // Find matching template or generate generic actions
        const template = this.findMatchingTemplate(step);
        
        if (template) {
          actions = this.generateActionsFromTemplate(step, template, options);
        } else {
          actions = this.generateGenericActions(step, options);
        }
      }

      // Optimize tool selection if enabled
      if (this.config.enableToolOptimization && options.availableTools) {
        await this.optimizeToolSelection(actions, options.availableTools);
      }

      // Generate action dependencies
      const dependencies = this.generateActionDependencies(actions, undefined);

      // Optimize action sequence if enabled
      if (this.config.enableOptimization) {
        await this.optimizeActions(actions, options.resourceConstraints);
      }

      // Validate actions if enabled
      if (this.config.enableValidation) {
        // Check if no actions were generated
        if (actions.length === 0) {
          throw new ActionGenerationError(
            'No actions generated for step',
            'VALIDATION_FAILED',
            step.id,
            true,
            { reason: 'maxActionsPerStep is 0 or no valid actions could be generated' }
          );
        }
        
        const validationResults = await this.validateActions(actions, options);
        if (validationResults.some(r => !r.isValid)) {
          throw new ActionGenerationError(
            'Action validation failed',
            'VALIDATION_FAILED',
            step.id,
            true,
            { validationResults }
          );
        }
      }

      // Calculate metrics
      const confidence = this.calculateActionConfidence(actions, options);
      const estimatedTime = this.calculateTotalActionTime(actions);
      const requiredTools = this.extractRequiredTools(actions);

      const generationTime = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.info('Action generation completed', {
          generationId,
          stepId: step.id,
          actionCount: actions.length,
          confidence,
          estimatedTime,
          generationTime
        });
      }

      return {
        actions,
        confidence,
        estimatedTime,
        requiredTools,
        dependencies
      };

    } catch (error) {
      const generationTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Action generation failed', {
          generationId,
          stepId: step.id,
          stepName: step.name,
          error: error instanceof Error ? error.message : String(error),
          generationTime
        });
      }

      throw error;
    }
  }

  /**
   * Optimize action sequence
   */
  async optimizeActions(
    actions: PlanAction[],
    constraints?: Record<string, unknown>
  ): Promise<ActionGenerationResult> {
    if (this.config.enableLogging) {
      this.logger.info('Optimizing action sequence', {
        actionCount: actions.length,
        constraints
      });
    }

    // Optimize action order
    this.optimizeActionOrder(actions);
    
    // Optimize action parameters
    this.optimizeActionParameters(actions, constraints);
    
    // Optimize action timing
    this.optimizeActionTiming(actions);

    const confidence = this.calculateActionConfidence(actions, {});
    const estimatedTime = this.calculateTotalActionTime(actions);
    const requiredTools = this.extractRequiredTools(actions);
    const dependencies = this.generateActionDependencies(actions);

    return {
      actions,
      confidence,
      estimatedTime,
      requiredTools,
      dependencies
    };
  }

  /**
   * Initialize action templates for common patterns
   */
  private initializeActionTemplates(): ActionTemplate[] {
    return [
      {
        name: 'research_actions',
        description: 'Actions for research and information gathering',
        stepPattern: /(?:gather|research|collect|find|search|investigate)/i,
        actionTypes: ['web_search', 'llm_query', 'analysis'],
        actionDescriptions: [
          'Search for relevant information online',
          'Generate research questions and analyze findings',
          'Analyze and synthesize collected information'
        ],
        requiredTools: ['web_search', null, null],
        estimatedTimes: [5, 8, 7],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 }
        ]
      },
      {
        name: 'analysis_actions',
        description: 'Actions for data analysis and processing',
        stepPattern: /(?:analyze|process|examine|evaluate|assess)/i,
        actionTypes: ['llm_query', 'analysis', 'tool_execution'],
        actionDescriptions: [
          'Analyze data using LLM capabilities',
          'Perform detailed analysis of findings',
          'Execute analysis tools and process results'
        ],
        requiredTools: [null, null, 'data_analysis'],
        estimatedTimes: [10, 15, 12],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 }
        ]
      },
      {
        name: 'creation_actions',
        description: 'Actions for creating and building',
        stepPattern: /(?:create|build|develop|implement|design|make)/i,
        actionTypes: ['llm_query', 'tool_execution', 'generic'],
        actionDescriptions: [
          'Generate creation plan and specifications',
          'Execute creation tools and processes',
          'Finalize and validate created output'
        ],
        requiredTools: [null, 'creation_tool', null],
        estimatedTimes: [8, 20, 10],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 }
        ]
      },
      {
        name: 'communication_actions',
        description: 'Actions for communication and sharing',
        stepPattern: /(?:communicate|share|send|notify|report|present)/i,
        actionTypes: ['llm_query', 'tool_execution'],
        actionDescriptions: [
          'Prepare communication content',
          'Send or deliver communication'
        ],
        requiredTools: [null, 'communication_tool'],
        estimatedTimes: [10, 5],
        dependencies: [
          { from: 0, to: 1 }
        ]
      },
      {
        name: 'validation_actions',
        description: 'Actions for testing and validation',
        stepPattern: /(?:test|validate|verify|check|confirm)/i,
        actionTypes: ['analysis', 'tool_execution', 'llm_query'],
        actionDescriptions: [
          'Analyze results for validation',
          'Execute validation tools and tests',
          'Generate validation report and recommendations'
        ],
        requiredTools: [null, 'validation_tool', null],
        estimatedTimes: [8, 12, 6],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 }
        ]
      }
    ];
  }

  /**
   * Initialize tool capabilities
   */
  private initializeToolCapabilities(): ToolCapability[] {
    return [
      {
        name: 'web_search',
        capabilities: ['search', 'information_gathering', 'research'],
        estimatedTime: 3,
        reliability: 0.9
      },
      {
        name: 'data_analysis',
        capabilities: ['analysis', 'processing', 'statistics'],
        estimatedTime: 15,
        reliability: 0.85
      },
      {
        name: 'creation_tool',
        capabilities: ['creation', 'building', 'development'],
        estimatedTime: 25,
        reliability: 0.8
      },
      {
        name: 'communication_tool',
        capabilities: ['communication', 'sharing', 'notification'],
        estimatedTime: 5,
        reliability: 0.95
      },
      {
        name: 'validation_tool',
        capabilities: ['validation', 'testing', 'verification'],
        estimatedTime: 10,
        reliability: 0.9
      },
      {
        name: 'file_processor',
        capabilities: ['file_processing', 'document_handling', 'conversion'],
        estimatedTime: 8,
        reliability: 0.85
      }
    ];
  }

  /**
   * Find matching action template
   */
  private findMatchingTemplate(step: PlanStep): ActionTemplate | null {
    const stepText = `${step.name} ${step.description}`.toLowerCase();
    
    for (const template of this.actionTemplates) {
      if (template.stepPattern.test(stepText)) {
        return template;
      }
    }
    
    return null;
  }

  /**
   * Generate actions from template
   */
  private generateActionsFromTemplate(
    step: PlanStep,
    template: ActionTemplate,
    options: ActionGenerationOptions
  ): PlanAction[] {
    const actions: PlanAction[] = [];
    
    // Respect maxActionsPerStep configuration
    const maxActions = Math.min(template.actionTypes.length, this.config.maxActionsPerStep);
    
    for (let i = 0; i < maxActions; i++) {
      const actionType = template.actionTypes[i];
      const description = template.actionDescriptions[i];
      const requiredTool = template.requiredTools[i];
      const estimatedTime = template.estimatedTimes[i];

      const action: PlanAction = {
        id: ulid(),
        name: this.generateActionName(actionType, step.name),
        description: `${description} for step: ${step.name}`,
        type: actionType,
        parameters: this.generateActionParameters(actionType, step, options, requiredTool),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add estimated time to parameters
      action.parameters.estimatedTimeMinutes = estimatedTime;
      
      // Add required tool if specified
      if (requiredTool) {
        action.parameters.toolName = requiredTool;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Generate generic actions when no template matches
   */
  private generateGenericActions(
    step: PlanStep,
    options: ActionGenerationOptions
  ): PlanAction[] {
    const actions: PlanAction[] = [];
    
    // Analyze step to determine action types needed
    const actionTypes = this.analyzeStepForActionTypes(step);
    
    for (const actionType of actionTypes) {
      const action: PlanAction = {
        id: ulid(),
        name: this.generateActionName(actionType, step.name),
        description: `${actionType} action for step: ${step.name}`,
        type: actionType,
        parameters: this.generateActionParameters(actionType, step, options),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      actions.push(action);
    }

    return actions;
  }

  /**
   * Analyze step to determine needed action types
   */
  private analyzeStepForActionTypes(step: PlanStep): string[] {
    const stepText = `${step.name} ${step.description}`.toLowerCase();
    const actionTypes: string[] = [];

    // Default to LLM query for most steps
    actionTypes.push('llm_query');

    // Add specific action types based on keywords
    if (/(?:search|find|lookup|research)/.test(stepText)) {
      actionTypes.push('web_search');
    }
    
    if (/(?:analyze|process|calculate|compute)/.test(stepText)) {
      actionTypes.push('analysis');
    }
    
    if (/(?:create|build|generate|make)/.test(stepText)) {
      actionTypes.push('tool_execution');
    }
    
    if (/(?:send|notify|communicate|share)/.test(stepText)) {
      actionTypes.push('tool_execution');
    }

    // Ensure at least one action type
    if (actionTypes.length === 1 && actionTypes[0] === 'llm_query') {
      actionTypes.push('generic');
    }

    return actionTypes.slice(0, this.config.maxActionsPerStep);
  }

  /**
   * Generate action name
   */
  private generateActionName(actionType: string, stepName: string): string {
    const actionPrefixes: Record<string, string> = {
      'llm_query': 'Analyze',
      'web_search': 'Search',
      'analysis': 'Process',
      'tool_execution': 'Execute',
      'generic': 'Perform',
      'research': 'Research'
    };

    const prefix = actionPrefixes[actionType] || 'Execute';
    const cleanStepName = stepName.replace(/^(prepare|execute|perform|complete)\s+/i, '');
    
    return `${prefix} ${cleanStepName}`.substring(0, 50);
  }

  /**
   * Generate action parameters
   */
  private generateActionParameters(
    actionType: string,
    step: PlanStep,
    options: ActionGenerationOptions,
    requiredTool?: string | null
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {
      stepId: step.id,
      stepName: step.name,
      actionType,
      timeout: this.config.defaultActionTimeoutMs
    };

    // Add type-specific parameters
    switch (actionType) {
      case 'llm_query':
        parameters.prompt = `Analyze and process: ${step.description}`;
        parameters.maxTokens = 1000;
        break;
        
      case 'web_search':
        parameters.query = this.extractSearchQuery(step);
        parameters.maxResults = 5;
        break;
        
      case 'analysis':
        parameters.analysisType = 'general';
        parameters.inputData = options.stepContext || {};
        break;
        
      case 'tool_execution':
        if (requiredTool) {
          parameters.toolName = requiredTool;
        }
        parameters.toolParams = this.generateToolParameters(step, requiredTool);
        break;
        
      case 'generic':
        parameters.description = step.description;
        break;
    }

    // Add resource constraints if available
    if (options.resourceConstraints) {
      parameters.resourceConstraints = options.resourceConstraints;
    }

    return parameters;
  }

  /**
   * Extract search query from step
   */
  private extractSearchQuery(step: PlanStep): string {
    // Extract key terms from step name and description
    const text = `${step.name} ${step.description}`;
    
    // Remove common words and extract key terms
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));

    return words.slice(0, 5).join(' ');
  }

  /**
   * Generate tool parameters
   */
  private generateToolParameters(step: PlanStep, toolName?: string | null): Record<string, unknown> {
    const params: Record<string, unknown> = {
      stepContext: step.description
    };

    if (toolName) {
      // Add tool-specific parameters
      switch (toolName) {
        case 'web_search':
          params.query = this.extractSearchQuery(step);
          break;
        case 'data_analysis':
          params.analysisType = 'comprehensive';
          break;
        case 'creation_tool':
          params.outputFormat = 'structured';
          break;
        case 'communication_tool':
          params.medium = 'text';
          break;
        case 'validation_tool':
          params.validationType = 'comprehensive';
          break;
      }
    }

    return params;
  }

  /**
   * Optimize tool selection
   */
  private async optimizeToolSelection(
    actions: PlanAction[],
    availableTools: string[]
  ): Promise<void> {
    for (const action of actions) {
      if (action.type === 'tool_execution' && action.parameters.toolName) {
        const currentTool = action.parameters.toolName as string;
        
        // Find better tool if current one is not available
        if (!availableTools.includes(currentTool)) {
          const betterTool = this.findBestAlternativeTool(currentTool, availableTools);
          if (betterTool) {
            action.parameters.toolName = betterTool;
            
            if (this.config.enableLogging) {
              this.logger.debug('Optimized tool selection', {
                actionId: action.id,
                originalTool: currentTool,
                newTool: betterTool
              });
            }
          }
        }
      }
    }
  }

  /**
   * Find best alternative tool
   */
  private findBestAlternativeTool(
    originalTool: string,
    availableTools: string[]
  ): string | null {
    const originalCapability = this.toolCapabilities.find(t => t.name === originalTool);
    if (!originalCapability) return null;

    let bestTool: string | null = null;
    let bestScore = 0;

    for (const toolName of availableTools) {
      const tool = this.toolCapabilities.find(t => t.name === toolName);
      if (!tool) continue;

      // Calculate compatibility score
      const commonCapabilities = tool.capabilities.filter(cap => 
        originalCapability.capabilities.includes(cap)
      );
      
      const score = (commonCapabilities.length / originalCapability.capabilities.length) * tool.reliability;
      
      if (score > bestScore) {
        bestScore = score;
        bestTool = toolName;
      }
    }

    return bestScore > 0.5 ? bestTool : null;
  }

  /**
   * Generate action dependencies
   */
  private generateActionDependencies(
    actions: PlanAction[],
    template?: ActionTemplate
  ): ActionDependency[] {
    const dependencies: ActionDependency[] = [];

    if (template && template.dependencies) {
      // Use template dependencies
      for (const dep of template.dependencies) {
        if (dep.from < actions.length && dep.to < actions.length) {
          dependencies.push({
            dependentActionId: actions[dep.to].id,
            dependsOnActionId: actions[dep.from].id,
            type: 'sequential',
            description: `${actions[dep.to].name} depends on ${actions[dep.from].name}`
          });
        }
      }
    } else {
      // Generate sequential dependencies by default
      for (let i = 1; i < actions.length; i++) {
        dependencies.push({
          dependentActionId: actions[i].id,
          dependsOnActionId: actions[i - 1].id,
          type: 'sequential',
          description: `${actions[i].name} follows ${actions[i - 1].name}`
        });
      }
    }

    return dependencies;
  }

  /**
   * Optimize action order
   */
  private optimizeActionOrder(actions: PlanAction[]): void {
    // Sort actions by type priority and estimated time
    const typePriority: Record<string, number> = {
      'web_search': 1,
      'llm_query': 2,
      'analysis': 3,
      'tool_execution': 4,
      'generic': 5
    };

    actions.sort((a, b) => {
      const aPriority = typePriority[a.type] || 5;
      const bPriority = typePriority[b.type] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same priority, sort by estimated time (shorter first)
      const aTime = a.parameters.estimatedTimeMinutes as number || 10;
      const bTime = b.parameters.estimatedTimeMinutes as number || 10;
      return aTime - bTime;
    });
  }

  /**
   * Optimize action parameters
   */
  private optimizeActionParameters(
    actions: PlanAction[],
    constraints?: Record<string, unknown>
  ): void {
    for (const action of actions) {
      // Optimize timeout based on action type
      if (action.type === 'tool_execution') {
        action.parameters.timeout = this.config.defaultActionTimeoutMs * 2;
      } else if (action.type === 'web_search') {
        action.parameters.timeout = this.config.defaultActionTimeoutMs * 0.5;
      }

      // Apply resource constraints
      if (constraints) {
        action.parameters.resourceConstraints = constraints;
      }
    }
  }

  /**
   * Optimize action timing
   */
  private optimizeActionTiming(actions: PlanAction[]): void {
    // Adjust estimated times based on action complexity
    for (const action of actions) {
      const currentTime = action.parameters.estimatedTimeMinutes as number || 10;
      
      // Adjust based on action type
      let multiplier = 1;
      switch (action.type) {
        case 'web_search':
          multiplier = 0.8;
          break;
        case 'analysis':
          multiplier = 1.2;
          break;
        case 'tool_execution':
          multiplier = 1.5;
          break;
      }
      
      action.parameters.estimatedTimeMinutes = Math.round(currentTime * multiplier);
    }
  }

  /**
   * Validate actions
   */
  private async validateActions(
    actions: PlanAction[],
    options: ActionGenerationOptions
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const action of actions) {
      const issues: ValidationIssue[] = [];
      let score = 1.0;

      // Validate action structure
      if (!action.name || action.name.trim().length === 0) {
        issues.push({
          severity: 'error',
          message: 'Action name is required',
          location: { actionId: action.id, field: 'name' },
          suggestedFix: 'Provide a descriptive action name'
        });
        score -= 0.3;
      }

      if (!action.type || action.type.trim().length === 0) {
        issues.push({
          severity: 'error',
          message: 'Action type is required',
          location: { actionId: action.id, field: 'type' },
          suggestedFix: 'Specify a valid action type'
        });
        score -= 0.3;
      }

      // Validate tool availability
      if (action.type === 'tool_execution' && action.parameters.toolName) {
        const toolName = action.parameters.toolName as string;
        if (options.availableTools && !options.availableTools.includes(toolName)) {
          issues.push({
            severity: 'warning',
            message: `Tool ${toolName} is not available`,
            location: { actionId: action.id, field: 'parameters.toolName' },
            suggestedFix: 'Use an available tool or make the tool available'
          });
          score -= 0.2;
        }
      }

      // Validate parameters
      if (!action.parameters || Object.keys(action.parameters).length === 0) {
        issues.push({
          severity: 'warning',
          message: 'Action parameters are empty',
          location: { actionId: action.id, field: 'parameters' },
          suggestedFix: 'Add appropriate parameters for the action'
        });
        score -= 0.1;
      }

      results.push({
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        score: Math.max(score, 0),
        issues,
        suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
      });
    }

    return results;
  }

  /**
   * Calculate action confidence
   */
  private calculateActionConfidence(
    actions: PlanAction[],
    options: ActionGenerationOptions
  ): number {
    if (actions.length === 0) return 0;

    let totalConfidence = 0;

    for (const action of actions) {
      let actionConfidence = 0.7; // Base confidence

      // Increase confidence for well-defined action types
      if (['llm_query', 'web_search', 'analysis'].includes(action.type)) {
        actionConfidence += 0.1;
      }

      // Increase confidence if tool is available
      if (action.type === 'tool_execution' && action.parameters.toolName) {
        const toolName = action.parameters.toolName as string;
        if (options.availableTools?.includes(toolName)) {
          actionConfidence += 0.1;
        }
      }

      // Increase confidence if parameters are well-defined
      if (action.parameters && Object.keys(action.parameters).length > 2) {
        actionConfidence += 0.1;
      }

      totalConfidence += Math.min(actionConfidence, 1);
    }

    return totalConfidence / actions.length;
  }

  /**
   * Calculate total action time
   */
  private calculateTotalActionTime(actions: PlanAction[]): number {
    return actions.reduce((total, action) => {
      const time = action.parameters.estimatedTimeMinutes as number || 10;
      return total + time;
    }, 0);
  }

  /**
   * Extract required tools
   */
  private extractRequiredTools(actions: PlanAction[]): string[] {
    const tools = new Set<string>();
    
    for (const action of actions) {
      if (action.type === 'tool_execution' && action.parameters.toolName) {
        tools.add(action.parameters.toolName as string);
      }
    }
    
    return Array.from(tools);
  }

  /**
   * Configure action generation behavior
   */
  configure(config: Partial<ActionGeneratorConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('ActionGenerator configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ActionGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    config: ActionGeneratorConfig;
    templateCount: number;
    toolCount: number;
  } {
    return {
      healthy: true,
      config: this.config,
      templateCount: this.actionTemplates.length,
      toolCount: this.toolCapabilities.length
    };
  }

  /**
   * Detect if step requires an Apify tool
   */
  private detectApifyTool(step: PlanStep): string | null {
    const stepText = `${step.name} ${step.description}`.toLowerCase();
    
    // Instagram hashtag scraper
    if (stepText.includes('instagram') && (stepText.includes('hashtag') || stepText.includes('#'))) {
      return 'instagram-hashtag-scraper';
    }
    
    // Actor discovery
    if (stepText.includes('actor') && (stepText.includes('discover') || stepText.includes('find') || stepText.includes('search'))) {
      return 'actor-discovery';
    }
    
    // Web scraper
    if (stepText.includes('scrape') || stepText.includes('extract') || stepText.includes('crawl')) {
      return 'web-scraper';
    }
    
    // Google search
    if (stepText.includes('google') && stepText.includes('search')) {
      return 'google-search-results-scraper';
    }
    
    // YouTube scraper
    if (stepText.includes('youtube') || stepText.includes('video')) {
      return 'youtube-scraper';
    }
    
    // LinkedIn scraper
    if (stepText.includes('linkedin')) {
      return 'linkedin-company-scraper';
    }
    
    // Twitter scraper
    if (stepText.includes('twitter') || stepText.includes('tweet')) {
      return 'twitter-scraper';
    }
    
    // Amazon scraper
    if (stepText.includes('amazon') || stepText.includes('product')) {
      return 'amazon-product-scraper';
    }
    
    // Facebook scraper
    if (stepText.includes('facebook')) {
      return 'facebook-page-scraper';
    }
    
    // TikTok scraper
    if (stepText.includes('tiktok')) {
      return 'tiktok-scraper';
    }
    
    return null;
  }

  /**
   * Create actions for Apify tool
   */
  private createActionsForApifyTool(
    step: PlanStep,
    toolName: string,
    options: ActionGenerationOptions
  ): PlanAction[] {
    const action: PlanAction = {
      id: ulid(),
      name: `Execute ${toolName}`,
      description: `Execute ${toolName} for: ${step.description}`,
      type: 'tool_execution',
      parameters: {
        toolName,
        toolParams: this.generateApifyToolParameters(toolName, step),
        stepId: step.id,
        stepName: step.name,
        timeout: this.config.defaultActionTimeoutMs,
        estimatedTimeMinutes: 10
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return [action];
  }

  /**
   * Generate parameters for Apify tools
   */
  private generateApifyToolParameters(toolName: string, step: PlanStep): Record<string, unknown> {
    const stepText = `${step.name} ${step.description}`;
    const params: Record<string, unknown> = {};

    switch (toolName) {
      case 'instagram-hashtag-scraper':
        params.hashtags = this.extractHashtags(stepText);
        params.resultsLimit = 50;
        break;
        
      case 'actor-discovery':
        params.searchTerm = this.extractSearchQuery(step);
        params.limit = 20;
        break;
        
      case 'web-scraper':
        params.startUrls = this.extractUrls(stepText);
        params.maxRequestsPerCrawl = 100;
        break;
        
      case 'google-search-results-scraper':
        params.queries = [this.extractSearchQuery(step)];
        params.maxPagesPerQuery = 1;
        break;
        
      case 'youtube-scraper':
        params.searchKeywords = [this.extractSearchQuery(step)];
        params.maxResults = 50;
        break;
        
      case 'linkedin-company-scraper':
        params.companyUrls = this.extractUrls(stepText);
        break;
        
      case 'twitter-scraper':
        params.searchTerms = [this.extractSearchQuery(step)];
        params.maxTweets = 100;
        break;
        
      case 'amazon-product-scraper':
        params.searchKeywords = [this.extractSearchQuery(step)];
        params.maxResults = 50;
        break;
        
      case 'facebook-page-scraper':
        params.pageUrls = this.extractUrls(stepText);
        break;
        
      case 'tiktok-scraper':
        params.hashtags = this.extractHashtags(stepText);
        params.maxResults = 50;
        break;
        
      default:
        params.input = stepText;
        break;
    }

    return params;
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];
    
    if (matches.length === 0) {
      // If no hashtags found, extract keywords and convert to hashtags
      const keywords = this.extractKeywords(text);
      return keywords.slice(0, 3).map(keyword => `#${keyword}`);
    }
    
    return matches.slice(0, 5);
  }

  /**
   * Extract URLs from text
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = text.match(urlRegex) || [];
    return matches.slice(0, 10);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    return [...new Set(words)].slice(0, 5);
  }
} 