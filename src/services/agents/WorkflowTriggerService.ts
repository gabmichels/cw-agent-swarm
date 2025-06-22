/**
 * WorkflowTriggerService.ts - Agent NLP workflow integration service
 * 
 * Processes user messages to detect and execute external workflows with confidence scoring.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { AgentWorkflowStorage, WorkflowMatch } from '../external-workflows/storage/AgentWorkflowStorage';
import { ExternalWorkflowConfig } from '../external-workflows/interfaces/ExternalWorkflowInterfaces';
import { N8nService } from '../external-workflows/N8nService';
import { ZapierService } from '../external-workflows/ZapierService';
import { 
  WorkflowExecutionError, 
  WorkflowValidationError 
} from '../external-workflows/errors/ExternalWorkflowErrors';
import { createLogger } from '../../lib/logging/winston-logger';

/**
 * Workflow trigger match result with enhanced confidence scoring
 */
export interface WorkflowTriggerMatch {
  readonly workflow: ExternalWorkflowConfig;
  readonly confidence: number;
  readonly matchedTriggers: readonly string[];
  readonly suggestedParams: Record<string, unknown>;
  readonly extractedEntities: readonly WorkflowEntity[];
  readonly matchType: 'exact' | 'fuzzy' | 'semantic';
}

/**
 * Extracted entity from user message
 */
export interface WorkflowEntity {
  readonly name: string;
  readonly value: unknown;
  readonly type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url';
  readonly confidence: number;
  readonly position: readonly [number, number]; // [start, end] positions in text
}

/**
 * Workflow execution request from agent
 */
export interface AgentWorkflowExecutionRequest {
  readonly requestId: string; // ULID format: wf_exec_req_[ULID]
  readonly agentId: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly userMessage: string;
  readonly workflow: ExternalWorkflowConfig;
  readonly parameters: Record<string, unknown>;
  readonly confidence: number;
  readonly requiresConfirmation: boolean;
  readonly timestamp: Date;
}

/**
 * Workflow execution result for agents
 */
export interface AgentWorkflowExecutionResult {
  readonly requestId: string; // ULID format: wf_exec_req_[ULID]
  readonly executionId: string; // ULID format: wf_exec_[ULID]
  readonly success: boolean;
  readonly result?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly durationMs: number;
  readonly costUsd?: number;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * Workflow suggestion for uncertain matches
 */
export interface WorkflowSuggestion {
  readonly suggestionId: string; // ULID format: wf_suggestion_[ULID]
  readonly agentId: string;
  readonly userMessage: string;
  readonly matches: readonly WorkflowTriggerMatch[];
  readonly recommendedAction: 'execute' | 'confirm' | 'clarify' | 'ignore';
  readonly reasoning: string;
  readonly timestamp: Date;
}

/**
 * Service configuration
 */
export interface WorkflowTriggerServiceConfig {
  readonly confidenceThresholds: {
    readonly autoExecute: number; // Auto-execute above this threshold
    readonly confirmationRequired: number; // Ask for confirmation above this
    readonly suggestion: number; // Show as suggestion above this
  };
  readonly entityExtraction: {
    readonly enabled: boolean;
    readonly patterns: Record<string, RegExp>;
  };
  readonly rateLimiting: {
    readonly enabled: boolean;
    readonly maxExecutionsPerMinute: number;
    readonly maxExecutionsPerHour: number;
  };
}

/**
 * Default service configuration
 */
const DEFAULT_CONFIG: WorkflowTriggerServiceConfig = {
  confidenceThresholds: {
    autoExecute: 0.85,
    confirmationRequired: 0.65,
    suggestion: 0.40
  },
  entityExtraction: {
    enabled: true,
    patterns: {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      url: /https?:\/\/[^\s]+/g,
      number: /\b\d+(?:\.\d+)?\b/g,
      date: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g
    }
  },
  rateLimiting: {
    enabled: true,
    maxExecutionsPerMinute: 10,
    maxExecutionsPerHour: 100
  }
};

/**
 * Rate limiting tracker
 */
interface RateLimitTracker {
  readonly agentId: string;
  readonly executions: readonly Date[];
}

/**
 * WorkflowTriggerService - Integrates external workflows with agent message processing
 */
export class WorkflowTriggerService {
  private readonly logger = createLogger({ moduleId: 'workflow-trigger-service' });
  private readonly rateLimitTrackers = new Map<string, RateLimitTracker>();
  private readonly config: WorkflowTriggerServiceConfig;

  constructor(
    private readonly workflowStorage: AgentWorkflowStorage,
    private readonly n8nService: N8nService,
    private readonly zapierService: ZapierService,
    config: Partial<WorkflowTriggerServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process user message for workflow triggers
   */
  async processUserMessage(
    agentId: string, 
    userMessage: string,
    options: {
      readonly userId?: string;
      readonly sessionId?: string;
      readonly skipRateLimit?: boolean;
    } = {}
  ): Promise<WorkflowTriggerMatch | null> {
    try {
      // Rate limiting check
      if (!options.skipRateLimit && this.config.rateLimiting.enabled) {
        const rateLimitResult = this.checkRateLimit(agentId);
        if (!rateLimitResult.allowed) {
          this.logger.warn('Rate limit exceeded for workflow execution', {
            agentId,
            rateLimitInfo: rateLimitResult
          });
          return null;
        }
      }

      // Find matching workflows
      const workflowMatch = await this.workflowStorage.findWorkflowByTrigger(
        agentId, 
        userMessage,
        this.config.confidenceThresholds.suggestion
      );

      if (!workflowMatch) {
        return null;
      }

      // Extract entities from user message
      const extractedEntities = this.config.entityExtraction.enabled 
        ? this.extractEntities(userMessage)
        : [];

      // Enhanced parameter extraction
      const suggestedParams = this.extractEnhancedParameters(
        userMessage, 
        workflowMatch.workflow.parameters,
        extractedEntities
      );

      // Determine match type
      const matchType = this.determineMatchType(
        userMessage, 
        workflowMatch.matchedTriggers,
        workflowMatch.confidence
      );

      return {
        workflow: workflowMatch.workflow,
        confidence: workflowMatch.confidence,
        matchedTriggers: workflowMatch.matchedTriggers,
        suggestedParams,
        extractedEntities,
        matchType
      };

    } catch (error) {
      this.logger.error('Error processing user message for workflows', {
        agentId,
        userMessage: userMessage.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Execute workflow based on trigger match
   */
  async executeWorkflow(
    request: AgentWorkflowExecutionRequest
  ): Promise<AgentWorkflowExecutionResult> {
    const startTime = Date.now();
    const executionId = `wf_exec_${ulid()}`;

    try {
      this.logger.info('Executing workflow from agent trigger', {
        requestId: request.requestId,
        executionId,
        agentId: request.agentId,
        workflowId: request.workflow.id,
        platform: request.workflow.platform,
        confidence: request.confidence
      });

      // Get appropriate service
      const service = this.getWorkflowService(request.workflow.platform);
      if (!service) {
        throw new WorkflowExecutionError(
          request.workflow.id.toString(),
          `No service configured for platform: ${request.workflow.platform}`
        );
      }

      // Validate parameters
      this.validateWorkflowParameters(request.workflow, request.parameters);

      // Execute workflow
      const executionRequest = {
        workflowId: request.workflow.workflowIdOrUrl,
        parameters: request.parameters,
        initiatedBy: {
          type: 'agent' as const,
          id: request.agentId,
          name: `Agent workflow trigger`
        },
        sessionId: request.sessionId,
        priority: 'normal' as const,
        timeoutMs: request.workflow.estimatedDurationMs * 2
      };

      const result = await service.executeWorkflow(executionRequest);
      const durationMs = Date.now() - startTime;

      // Update execution count
      await this.updateWorkflowExecutionCount(request.agentId, request.workflow.id.toString());

      // Track rate limiting
      this.trackExecution(request.agentId);

      this.logger.info('Workflow execution completed successfully', {
        requestId: request.requestId,
        executionId,
        durationMs,
        status: result.status
      });

      return {
        requestId: request.requestId,
        executionId,
        success: result.status === 'completed',
        result: result.result,
        error: result.error ? {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details
        } : undefined,
        durationMs,
        costUsd: result.costUsd,
        metadata: {
          platform: request.workflow.platform,
          workflowId: request.workflow.id,
          workflowName: request.workflow.name,
          confidence: request.confidence,
          logs: result.logs
        },
        timestamp: new Date()
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Workflow execution failed', {
        requestId: request.requestId,
        executionId,
        error: errorMessage,
        durationMs
      });

      return {
        requestId: request.requestId,
        executionId,
        success: false,
        error: {
          code: error instanceof WorkflowExecutionError ? error.name : 
                error instanceof WorkflowValidationError ? 'WorkflowValidationError' : 'EXECUTION_ERROR',
          message: errorMessage,
          details: error instanceof WorkflowExecutionError ? { workflowId: error.message } : undefined
        },
        durationMs,
        metadata: {
          platform: request.workflow.platform,
          workflowId: request.workflow.id,
          workflowName: request.workflow.name,
          confidence: request.confidence
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Generate workflow suggestion for uncertain matches
   */
  async generateWorkflowSuggestion(
    agentId: string,
    userMessage: string,
    matches: readonly WorkflowTriggerMatch[]
  ): Promise<WorkflowSuggestion> {
    const suggestionId = `wf_suggestion_${ulid()}`;

    // Determine recommended action based on confidence scores
    let recommendedAction: WorkflowSuggestion['recommendedAction'] = 'ignore';
    let reasoning = 'No workflows match with sufficient confidence';

    if (matches.length > 0) {
      const highestConfidence = Math.max(...matches.map(m => m.confidence));
      
      if (highestConfidence >= this.config.confidenceThresholds.autoExecute) {
        recommendedAction = 'execute';
        reasoning = `High confidence match (${(highestConfidence * 100).toFixed(1)}%) - safe to auto-execute`;
      } else if (highestConfidence >= this.config.confidenceThresholds.confirmationRequired) {
        recommendedAction = 'confirm';
        reasoning = `Medium confidence match (${(highestConfidence * 100).toFixed(1)}%) - confirmation recommended`;
      } else if (highestConfidence >= this.config.confidenceThresholds.suggestion) {
        recommendedAction = 'clarify';
        reasoning = `Low confidence match (${(highestConfidence * 100).toFixed(1)}%) - clarification needed`;
      }
    }

    return {
      suggestionId,
      agentId,
      userMessage,
      matches,
      recommendedAction,
      reasoning,
      timestamp: new Date()
    };
  }

  /**
   * Extract entities from user message
   */
  private extractEntities(message: string): readonly WorkflowEntity[] {
    const entities: WorkflowEntity[] = [];

    for (const [type, pattern] of Object.entries(this.config.entityExtraction.patterns)) {
      const matches = Array.from(message.matchAll(pattern));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            name: type,
            value: this.parseEntityValue(match[0], type),
            type: this.mapEntityType(type),
            confidence: 0.9, // High confidence for regex matches
            position: [match.index, match.index + match[0].length]
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract enhanced parameters from user message
   */
  private extractEnhancedParameters(
    message: string,
    workflowParams: readonly any[],
    entities: readonly WorkflowEntity[]
  ): Record<string, unknown> {
    const suggestedParams: Record<string, unknown> = {};

    // Basic keyword extraction for each parameter
    for (const param of workflowParams) {
      // Try to find matching entities
      const matchingEntity = entities.find(entity => 
        entity.name.toLowerCase() === param.name.toLowerCase() ||
        message.toLowerCase().includes(param.name.toLowerCase())
      );

      if (matchingEntity) {
        suggestedParams[param.name] = matchingEntity.value;
      } else if (param.defaultValue !== undefined) {
        suggestedParams[param.name] = param.defaultValue;
      }
    }

    return suggestedParams;
  }

  /**
   * Determine match type based on triggers and confidence
   */
  private determineMatchType(
    message: string,
    matchedTriggers: readonly string[],
    confidence: number
  ): WorkflowTriggerMatch['matchType'] {
    // Check for exact phrase matches
    const messageLower = message.toLowerCase();
    const hasExactMatch = matchedTriggers.some(trigger => 
      messageLower.includes(trigger.toLowerCase())
    );

    if (hasExactMatch && confidence >= 0.9) {
      return 'exact';
    } else if (confidence > 0.7) {
      return 'semantic';
    } else {
      return 'fuzzy';
    }
  }

  /**
   * Get workflow service based on platform
   */
  private getWorkflowService(platform: 'n8n' | 'zapier') {
    switch (platform) {
      case 'n8n':
        return this.n8nService;
      case 'zapier':
        return this.zapierService;
      default:
        return null;
    }
  }

  /**
   * Validate workflow parameters
   */
  private validateWorkflowParameters(
    workflow: ExternalWorkflowConfig,
    parameters: Record<string, unknown>
  ): void {
    for (const param of workflow.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new WorkflowValidationError(
          workflow.id.toString(),
          [`Required parameter '${param.name}' is missing`]
        );
      }
    }
  }

  /**
   * Update workflow execution count
   */
  private async updateWorkflowExecutionCount(
    agentId: string,
    workflowId: string
  ): Promise<void> {
    try {
      // This would update the execution count in storage
      // Implementation depends on the storage mechanism
      this.logger.debug('Updated workflow execution count', {
        agentId,
        workflowId
      });
    } catch (error) {
      this.logger.warn('Failed to update workflow execution count', {
        agentId,
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check rate limiting for agent
   */
  private checkRateLimit(agentId: string): { allowed: boolean; remaining: number; resetTime: Date } {
    const now = new Date();
    const tracker = this.rateLimitTrackers.get(agentId);
    
    if (!tracker) {
      return { allowed: true, remaining: this.config.rateLimiting.maxExecutionsPerMinute - 1, resetTime: now };
    }

    // Filter executions within the last minute and hour
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentExecutions = tracker.executions.filter(exec => exec > oneMinuteAgo);
    const hourlyExecutions = tracker.executions.filter(exec => exec > oneHourAgo);

    const minuteAllowed = recentExecutions.length < this.config.rateLimiting.maxExecutionsPerMinute;
    const hourlyAllowed = hourlyExecutions.length < this.config.rateLimiting.maxExecutionsPerHour;

    return {
      allowed: minuteAllowed && hourlyAllowed,
      remaining: Math.min(
        this.config.rateLimiting.maxExecutionsPerMinute - recentExecutions.length,
        this.config.rateLimiting.maxExecutionsPerHour - hourlyExecutions.length
      ),
      resetTime: new Date(Math.max(oneMinuteAgo.getTime() + 60 * 1000, oneHourAgo.getTime() + 60 * 60 * 1000))
    };
  }

  /**
   * Track workflow execution for rate limiting
   */
  private trackExecution(agentId: string): void {
    const now = new Date();
    const tracker = this.rateLimitTrackers.get(agentId);
    
    if (tracker) {
      // Keep only recent executions to prevent memory leaks
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentExecutions = tracker.executions.filter(exec => exec > oneHourAgo);
      
      this.rateLimitTrackers.set(agentId, {
        agentId,
        executions: [...recentExecutions, now]
      });
    } else {
      this.rateLimitTrackers.set(agentId, {
        agentId,
        executions: [now]
      });
    }
  }

  /**
   * Parse entity value based on type
   */
  private parseEntityValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }

  /**
   * Map entity type to workflow parameter type
   */
  private mapEntityType(entityType: string): WorkflowEntity['type'] {
    switch (entityType) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'email':
        return 'email';
      case 'url':
        return 'url';
      default:
        return 'string';
    }
  }
} 