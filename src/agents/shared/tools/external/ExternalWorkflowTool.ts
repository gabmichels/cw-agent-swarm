import { BaseTool, ToolResult } from '../../../../lib/shared/types/agentTypes';
import { 
  WorkflowPlatform, 
  WorkflowParameter, 
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  ValidationResult,
  WorkflowIdGenerator
} from '../../../../services/external-workflows/interfaces/ExternalWorkflowInterfaces';
import { N8nService } from '../../../../services/external-workflows/N8nService';
import { ZapierService } from '../../../../services/external-workflows/ZapierService';
import { 
  WorkflowExecutionError, 
  WorkflowValidationError 
} from '../../../../services/external-workflows/errors/ExternalWorkflowErrors';

/**
 * External workflow tool configuration
 */
export interface ExternalWorkflowToolConfig {
  readonly workflowId: string;
  readonly platform: WorkflowPlatform;
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly WorkflowParameter[];
  readonly nlpTriggers: readonly string[];
  readonly estimatedDurationMs: number;
  readonly tags: readonly string[];
}

/**
 * External workflow tool that executes workflows on external platforms
 * Integrates with the agent tool system to provide seamless workflow execution
 */
export class ExternalWorkflowTool extends BaseTool {
  private readonly n8nService?: N8nService;
  private readonly zapierService?: ZapierService;

  constructor(
    private readonly config: ExternalWorkflowToolConfig,
    n8nService?: N8nService,
    zapierService?: ZapierService
  ) {
    super();
    this.n8nService = n8nService;
    this.zapierService = zapierService;
  }

  /**
   * Get tool name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get tool description
   */
  get description(): string {
    return this.config.description;
  }

  /**
   * Get tool parameters schema
   */
  get parameters(): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: {},
      required: []
    };

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of this.config.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description || `Parameter: ${param.name}`,
        ...(param.defaultValue !== undefined && { default: param.defaultValue }),
        ...(param.validation && {
          ...(param.validation.min !== undefined && { minimum: param.validation.min }),
          ...(param.validation.max !== undefined && { maximum: param.validation.max }),
          ...(param.validation.pattern && { pattern: param.validation.pattern }),
          ...(param.validation.enum && { enum: param.validation.enum })
        })
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    schema.properties = properties;
    schema.required = required;

    return schema;
  }

  /**
   * Execute the external workflow
   */
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const executionId = WorkflowIdGenerator.generate('ext_wf');
    
    try {
      // Get the appropriate service based on platform
      const service = this.getWorkflowService();
      if (!service) {
        throw new WorkflowExecutionError(
          this.config.workflowId,
          `No service configured for platform: ${this.config.platform}`
        );
      }

      // Validate parameters
      const validationResult = await this.validateToolParameters(params);
      if (!validationResult.isValid) {
        throw new WorkflowValidationError(
          this.config.workflowId,
          validationResult.errors.map(e => e.message)
        );
      }

      // Create execution request
      const executionRequest: WorkflowExecutionRequest = {
        workflowId: this.config.workflowId,
        parameters: params,
        initiatedBy: {
          type: 'agent',
          id: 'external-workflow-tool', // This would be injected from agent context
          name: this.config.name
        },
        priority: 'normal',
        timeoutMs: this.config.estimatedDurationMs * 2 // Allow 2x estimated time
      };

      // Execute workflow
      const result = await service.executeWorkflow(executionRequest);

      // Return tool result
      return {
        success: result.status === 'completed',
        data: result.result,
        metadata: {
          executionId: result.executionId.toString(),
          platform: this.config.platform,
          workflowId: this.config.workflowId,
          durationMs: result.durationMs,
          status: result.status,
          logs: result.logs,
          cost: result.costUsd
        },
        error: result.error ? {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details
        } : undefined
      };

    } catch (error) {
      // Handle execution errors
      if (error instanceof WorkflowValidationError || 
          error instanceof WorkflowExecutionError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.context
          },
          metadata: {
            executionId: executionId.toString(),
            platform: this.config.platform,
            workflowId: this.config.workflowId,
            status: 'failed'
          }
        };
      }

      // Handle unexpected errors
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: { error: error instanceof Error ? error.stack : error }
        },
        metadata: {
          executionId: executionId.toString(),
          platform: this.config.platform,
          workflowId: this.config.workflowId,
          status: 'failed'
        }
      };
    }
  }

  /**
   * Check if the tool can handle a given input
   */
  canHandle(input: string): boolean {
    const inputLower = input.toLowerCase();
    return this.config.nlpTriggers.some(trigger => 
      this.isMessageMatch(inputLower, trigger.toLowerCase())
    );
  }

  /**
   * Get match confidence for a given input
   */
  getMatchConfidence(input: string): number {
    const inputLower = input.toLowerCase();
    let maxConfidence = 0;

    for (const trigger of this.config.nlpTriggers) {
      const triggerLower = trigger.toLowerCase();
      const confidence = this.calculateMatchConfidence(inputLower, triggerLower);
      maxConfidence = Math.max(maxConfidence, confidence);
    }

    return maxConfidence;
  }

  /**
   * Extract parameters from natural language input
   */
  extractParameters(input: string): Record<string, unknown> {
    const extractedParams: Record<string, unknown> = {};
    
    // Basic parameter extraction - this could be enhanced with NLP
    for (const param of this.config.parameters) {
      if (param.defaultValue !== undefined) {
        extractedParams[param.name] = param.defaultValue;
      }
    }

    // Simple keyword-based extraction
    const inputLower = input.toLowerCase();
    
    // Look for parameter patterns like "parameter_name: value" or "parameter_name=value"
    const patterns = [
      /(\w+):\s*([^,\n]+)/g,
      /(\w+)=([^,\s]+)/g,
      /(\w+)\s+is\s+([^,\n]+)/gi,
      /set\s+(\w+)\s+to\s+([^,\n]+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(inputLower)) !== null) {
        const paramName = match[1].trim();
        const paramValue = match[2].trim();
        
        // Check if this matches any of our parameters
        const parameter = this.config.parameters.find(p => 
          p.name.toLowerCase() === paramName ||
          p.name.toLowerCase().includes(paramName) ||
          paramName.includes(p.name.toLowerCase())
        );

        if (parameter) {
          extractedParams[parameter.name] = this.convertParameterValue(paramValue, parameter.type);
        }
      }
    }

    return extractedParams;
  }

  /**
   * Get the appropriate workflow service based on platform
   */
  private getWorkflowService() {
    switch (this.config.platform) {
      case 'n8n':
        return this.n8nService;
      case 'zapier':
        return this.zapierService;
      default:
        return null;
    }
  }

  /**
   * Validate tool parameters against schema
   */
  private async validateToolParameters(params: Record<string, unknown>): Promise<ValidationResult> {
    const errors: Array<{ field: string; code: string; message: string; value?: unknown }> = [];

    for (const parameter of this.config.parameters) {
      const value = params[parameter.name];

      // Check required parameters
      if (parameter.required && (value === undefined || value === null)) {
        errors.push({
          field: parameter.name,
          code: 'REQUIRED_PARAMETER_MISSING',
          message: `Required parameter '${parameter.name}' is missing`
        });
        continue;
      }

      // Skip validation for optional missing parameters
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateParameterType(value, parameter.type)) {
        errors.push({
          field: parameter.name,
          code: 'INVALID_PARAMETER_TYPE',
          message: `Parameter '${parameter.name}' must be of type ${parameter.type}`,
          value
        });
      }

      // Additional validation rules
      if (parameter.validation) {
        const validation = parameter.validation;
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));

        if (validation.min !== undefined && !isNaN(numValue) && numValue < validation.min) {
          errors.push({
            field: parameter.name,
            code: 'PARAMETER_BELOW_MINIMUM',
            message: `Parameter '${parameter.name}' must be at least ${validation.min}`,
            value
          });
        }

        if (validation.max !== undefined && !isNaN(numValue) && numValue > validation.max) {
          errors.push({
            field: parameter.name,
            code: 'PARAMETER_ABOVE_MAXIMUM',
            message: `Parameter '${parameter.name}' must be at most ${validation.max}`,
            value
          });
        }

        if (validation.pattern && typeof value === 'string') {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push({
              field: parameter.name,
              code: 'PARAMETER_PATTERN_MISMATCH',
              message: `Parameter '${parameter.name}' does not match required pattern`,
              value
            });
          }
        }

        if (validation.enum && !validation.enum.includes(value)) {
          errors.push({
            field: parameter.name,
            code: 'PARAMETER_NOT_IN_ENUM',
            message: `Parameter '${parameter.name}' must be one of: ${validation.enum.join(', ')}`,
            value
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true; // Unknown type, allow it
    }
  }

  /**
   * Convert parameter value to appropriate type
   */
  private convertParameterValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
          return true;
        }
        if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
          return false;
        }
        return value;
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'array':
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return value.split(',').map(item => item.trim());
        }
      default:
        return value;
    }
  }

  /**
   * Check if message matches trigger with fuzzy matching
   */
  private isMessageMatch(message: string, trigger: string): boolean {
    const messageWords = message.split(' ').filter(word => word.length > 2);
    const triggerWords = trigger.split(' ').filter(word => word.length > 2);
    
    if (triggerWords.length === 0) return false;
    
    const matchCount = triggerWords.filter(word => 
      messageWords.some(msgWord => 
        msgWord.includes(word) || word.includes(msgWord)
      )
    ).length;
    
    return matchCount / triggerWords.length > 0.6; // 60% match threshold
  }

  /**
   * Calculate match confidence between input and trigger
   */
  private calculateMatchConfidence(input: string, trigger: string): number {
    const inputWords = input.split(' ').filter(word => word.length > 2);
    const triggerWords = trigger.split(' ').filter(word => word.length > 2);
    
    if (triggerWords.length === 0) return 0;
    
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const triggerWord of triggerWords) {
      const exactMatch = inputWords.some(inputWord => inputWord === triggerWord);
      if (exactMatch) {
        exactMatches++;
      } else {
        const partialMatch = inputWords.some(inputWord => 
          inputWord.includes(triggerWord) || triggerWord.includes(inputWord)
        );
        if (partialMatch) {
          partialMatches++;
        }
      }
    }
    
    // Weight exact matches more heavily than partial matches
    const score = (exactMatches * 1.0 + partialMatches * 0.5) / triggerWords.length;
    return Math.min(score, 1.0);
  }
} 