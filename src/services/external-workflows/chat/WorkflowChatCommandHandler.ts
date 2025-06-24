/**
 * WorkflowChatCommandHandler.ts - Chat command detection and processing for N8N workflows
 * 
 * Detects N8N workflow execution requests in chat messages and converts them to
 * structured commands for the execution engine.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { createLogger } from '../../../lib/logging/winston-logger';
import { WorkflowExecutionService } from '../execution/WorkflowExecutionService';
import { WorkflowParameterParser } from '../execution/WorkflowParameterParser';
import { RepositoryManager } from '../integrations/RepositoryManager';

// === Chat Command Interfaces ===

export interface WorkflowChatCommand {
  readonly commandId: string; // ULID format: wf_cmd_[ULID]
  readonly type: WorkflowCommandType;
  readonly workflowReference: WorkflowReference;
  readonly parameters: Record<string, unknown>;
  readonly confidence: number;
  readonly originalMessage: string;
  readonly extractedParameters?: Record<string, unknown>;
  readonly intent: WorkflowCommandIntent;
  readonly urgency: CommandUrgency;
  readonly confirmationRequired: boolean;
}

export type WorkflowCommandType =
  | 'execute_workflow'
  | 'check_status'
  | 'cancel_execution'
  | 'list_workflows'
  | 'get_execution_history'
  | 'schedule_workflow';

export interface WorkflowReference {
  readonly type: 'id' | 'name' | 'category' | 'description_match';
  readonly value: string;
  readonly matchConfidence: number;
  readonly disambiguation?: readonly string[];
}

export interface WorkflowCommandIntent {
  readonly action: string;
  readonly entities: readonly string[];
  readonly timeframe?: string;
  readonly conditions?: readonly string[];
}

export type CommandUrgency = 'low' | 'normal' | 'high' | 'urgent';

export interface ChatContext {
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly conversationHistory?: readonly string[];
  readonly sessionData?: Record<string, unknown>;
}

export interface WorkflowChatResponse {
  readonly responseId: string; // ULID format: wf_resp_[ULID]
  readonly success: boolean;
  readonly message: string;
  readonly command?: WorkflowChatCommand;
  readonly executionId?: string;
  readonly suggestions?: readonly string[];
  readonly clarificationNeeded?: boolean;
  readonly clarificationQuestions?: readonly string[];
  readonly metadata: Record<string, unknown>;
}

// === Configuration ===

export interface WorkflowChatConfig {
  readonly enabled: boolean;
  readonly confidenceThreshold: number;
  readonly autoExecuteThreshold: number;
  readonly confirmationThreshold: number;
  readonly maxSuggestions: number;
  readonly enableNaturalLanguage: boolean;
  readonly enableParameterExtraction: boolean;
  readonly enableWorkflowSuggestions: boolean;
}

const DEFAULT_CONFIG: WorkflowChatConfig = {
  enabled: true,
  confidenceThreshold: 0.6,
  autoExecuteThreshold: 0.85,
  confirmationThreshold: 0.7,
  maxSuggestions: 5,
  enableNaturalLanguage: true,
  enableParameterExtraction: true,
  enableWorkflowSuggestions: true
};

// === Handler Interface ===

export interface IWorkflowChatCommandHandler {
  detectWorkflowCommand(message: string, context: ChatContext): Promise<WorkflowChatCommand | null>;
  processWorkflowCommand(command: WorkflowChatCommand, context: ChatContext): Promise<WorkflowChatResponse>;
  isWorkflowRequest(message: string): boolean;
  suggestWorkflows(query: string, context: ChatContext): Promise<readonly string[]>;
  clarifyWorkflowIntent(message: string, context: ChatContext): Promise<readonly string[]>;
}

// === Implementation ===

export class WorkflowChatCommandHandler implements IWorkflowChatCommandHandler {
  private readonly serviceName = 'WorkflowChatCommandHandler';
  private readonly logger = createLogger({ moduleId: this.serviceName });
  private readonly config: WorkflowChatConfig;

  constructor(
    private readonly parameterParser: WorkflowParameterParser,
    private readonly executionService: WorkflowExecutionService,
    private readonly repositoryManager: RepositoryManager,
    config: Partial<WorkflowChatConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.logger.info(`[${this.serviceName}] Initialized with config`, {
      enabled: this.config.enabled,
      confidenceThreshold: this.config.confidenceThreshold,
      autoExecuteThreshold: this.config.autoExecuteThreshold
    });
  }

  // === Command Detection ===

  async detectWorkflowCommand(
    message: string,
    context: ChatContext
  ): Promise<WorkflowChatCommand | null> {
    if (!this.config.enabled) {
      return null;
    }

    const commandId = `wf_cmd_${ulid()}`;

    this.logger.debug(`[${this.serviceName}] Detecting workflow command`, {
      commandId,
      messageLength: message.length,
      userId: context.userId
    });

    try {
      // 1. Check if this is a workflow request
      if (!this.isWorkflowRequest(message)) {
        return null;
      }

      // 2. Determine command type
      const commandType = this.detectCommandType(message);
      if (!commandType) {
        return null;
      }

      // 3. Extract workflow reference
      const workflowReference = await this.extractWorkflowReference(message, context);
      if (!workflowReference) {
        return null;
      }

      // 4. Extract parameters
      const parameters = this.config.enableParameterExtraction
        ? await this.extractParameters(message, workflowReference.value)
        : {};

      // 5. Analyze intent
      const intent = this.analyzeIntent(message);

      // 6. Determine urgency and confirmation needs
      const urgency = this.determineUrgency(message, intent);
      const confirmationRequired = this.needsConfirmation(commandType, urgency, workflowReference.matchConfidence);

      // 7. Calculate overall confidence
      const confidence = this.calculateConfidence(
        workflowReference.matchConfidence,
        intent,
        parameters,
        commandType
      );

      const command: WorkflowChatCommand = {
        commandId,
        type: commandType,
        workflowReference,
        parameters,
        confidence,
        originalMessage: message,
        extractedParameters: parameters,
        intent,
        urgency,
        confirmationRequired
      };

      this.logger.info(`[${this.serviceName}] Workflow command detected`, {
        commandId,
        type: commandType,
        confidence,
        workflowRef: workflowReference.value,
        urgency,
        confirmationRequired
      });

      return command;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error detecting workflow command`, {
        commandId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // === Command Processing ===

  async processWorkflowCommand(
    command: WorkflowChatCommand,
    context: ChatContext
  ): Promise<WorkflowChatResponse> {
    const responseId = `wf_resp_${ulid()}`;

    this.logger.info(`[${this.serviceName}] Processing workflow command`, {
      responseId,
      commandId: command.commandId,
      type: command.type,
      confidence: command.confidence
    });

    try {
      // Handle different command types
      switch (command.type) {
        case 'execute_workflow':
          return await this.handleExecuteWorkflow(command, context, responseId);

        case 'check_status':
          return await this.handleCheckStatus(command, context, responseId);

        case 'cancel_execution':
          return await this.handleCancelExecution(command, context, responseId);

        case 'list_workflows':
          return await this.handleListWorkflows(command, context, responseId);

        case 'get_execution_history':
          return await this.handleExecutionHistory(command, context, responseId);

        case 'schedule_workflow':
          return await this.handleScheduleWorkflow(command, context, responseId);

        default:
          return {
            responseId,
            success: false,
            message: `Unknown command type: ${command.type}`,
            command,
            metadata: { error: 'UNKNOWN_COMMAND_TYPE' }
          };
      }

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error processing workflow command`, {
        responseId,
        commandId: command.commandId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        responseId,
        success: false,
        message: `Failed to process workflow command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        command,
        metadata: {
          error: 'PROCESSING_ERROR',
          originalError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // === Request Detection ===

  isWorkflowRequest(message: string): boolean {
    const normalizedMessage = message.toLowerCase();

    // Workflow execution keywords
    const executionKeywords = [
      'run workflow', 'execute workflow', 'start workflow',
      'trigger workflow', 'run automation', 'execute automation',
      'start automation', 'run my workflow', 'execute my workflow'
    ];

    // Workflow management keywords
    const managementKeywords = [
      'workflow status', 'check workflow', 'cancel workflow',
      'stop workflow', 'workflow history', 'my workflows',
      'list workflows', 'show workflows'
    ];

    // N8N specific keywords
    const n8nKeywords = [
      'n8n workflow', 'n8n automation', 'n8n execution',
      'automation status', 'workflow execution'
    ];

    // Combined pattern matching
    const allKeywords = [...executionKeywords, ...managementKeywords, ...n8nKeywords];

    return allKeywords.some(keyword => normalizedMessage.includes(keyword)) ||
      this.matchesWorkflowPattern(normalizedMessage);
  }

  // === Workflow Suggestions ===

  async suggestWorkflows(
    query: string,
    context: ChatContext
  ): Promise<readonly string[]> {
    if (!this.config.enableWorkflowSuggestions) {
      return [];
    }

    try {
      // Get available workflows for the user
      const userWorkflows = await this.executionService.getUserWorkflows(context.userId);

      // Filter based on query similarity
      const suggestions = userWorkflows
        .filter(workflow => this.matchesQuery(workflow.name, query))
        .slice(0, this.config.maxSuggestions)
        .map(workflow => workflow.name);

      this.logger.debug(`[${this.serviceName}] Generated workflow suggestions`, {
        query,
        suggestionsCount: suggestions.length,
        userId: context.userId
      });

      return suggestions;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error generating workflow suggestions`, {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Intent Clarification ===

  async clarifyWorkflowIntent(
    message: string,
    context: ChatContext
  ): Promise<readonly string[]> {
    const questions: string[] = [];

    // Check for ambiguous workflow references
    if (this.hasAmbiguousWorkflowReference(message)) {
      questions.push("Which specific workflow would you like me to work with?");
    }

    // Check for missing parameters
    const missingParams = await this.identifyMissingParameters(message, context);
    if (missingParams.length > 0) {
      questions.push(`I need more information about: ${missingParams.join(', ')}`);
    }

    // Check for unclear action
    if (this.hasUnclearAction(message)) {
      questions.push("What would you like me to do with the workflow? (execute, check status, cancel, etc.)");
    }

    this.logger.debug(`[${this.serviceName}] Generated clarification questions`, {
      messageLength: message.length,
      questionsCount: questions.length,
      userId: context.userId
    });

    return questions;
  }

  // === Private Helper Methods ===

  private detectCommandType(message: string): WorkflowCommandType | null {
    const normalizedMessage = message.toLowerCase();

    // Pattern matching for command types
    const patterns: Record<WorkflowCommandType, string[]> = {
      execute_workflow: ['run', 'execute', 'start', 'trigger', 'launch'],
      check_status: ['status', 'check', 'how is', 'is running', 'progress'],
      cancel_execution: ['cancel', 'stop', 'abort', 'halt', 'terminate'],
      list_workflows: ['list', 'show', 'what workflows', 'my workflows'],
      get_execution_history: ['history', 'past runs', 'previous', 'recent runs'],
      schedule_workflow: ['schedule', 'later', 'at', 'remind me', 'every']
    };

    for (const [commandType, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => normalizedMessage.includes(keyword))) {
        return commandType as WorkflowCommandType;
      }
    }

    return null;
  }

  private async extractWorkflowReference(
    message: string,
    context: ChatContext
  ): Promise<WorkflowReference | null> {
    const normalizedMessage = message.toLowerCase();

    // Try to extract workflow name patterns
    const namePatterns = [
      /workflow[:\s]+["']([^"']+)["']/i,
      /called[:\s]+["']([^"']+)["']/i,
      /named[:\s]+["']([^"']+)["']/i,
      /"([^"]+)"\s+workflow/i
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return {
          type: 'name',
          value: match[1].trim(),
          matchConfidence: 0.85
        };
      }
    }

    // Try to extract workflow ID patterns
    const idPattern = /workflow[:\s]+([a-zA-Z0-9-_]+)/i;
    const idMatch = message.match(idPattern);
    if (idMatch && idMatch[1]) {
      return {
        type: 'id',
        value: idMatch[1].trim(),
        matchConfidence: 0.9
      };
    }

    // Fallback to keyword matching
    const keywords = this.extractWorkflowKeywords(normalizedMessage);
    if (keywords.length > 0) {
      return {
        type: 'description_match',
        value: keywords.join(' '),
        matchConfidence: 0.6
      };
    }

    return null;
  }

  private async extractParameters(
    message: string,
    workflowId: string
  ): Promise<Record<string, unknown>> {
    if (!this.config.enableParameterExtraction) {
      return {};
    }

    try {
      const parseResult = await this.parameterParser.parseParameters(message, workflowId);
      return parseResult.parsed;
    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Parameter extraction failed`, {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  private analyzeIntent(message: string): WorkflowCommandIntent {
    const normalizedMessage = message.toLowerCase();

    // Extract action verbs
    const actionWords = ['run', 'execute', 'start', 'stop', 'check', 'cancel', 'list', 'show'];
    const foundActions = actionWords.filter(action => normalizedMessage.includes(action));

    // Extract entities (simple noun extraction)
    const entityWords = this.extractEntities(normalizedMessage);

    // Extract time expressions
    const timeframe = this.extractTimeframe(normalizedMessage);

    return {
      action: foundActions[0] || 'execute',
      entities: entityWords,
      timeframe,
      conditions: []
    };
  }

  private determineUrgency(message: string, intent: WorkflowCommandIntent): CommandUrgency {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'right now', 'emergency'];
    const highKeywords = ['soon', 'quickly', 'fast', 'priority'];
    const lowKeywords = ['later', 'whenever', 'eventually', 'no rush'];

    const normalizedMessage = message.toLowerCase();

    if (urgentKeywords.some(keyword => normalizedMessage.includes(keyword))) {
      return 'urgent';
    }
    if (highKeywords.some(keyword => normalizedMessage.includes(keyword))) {
      return 'high';
    }
    if (lowKeywords.some(keyword => normalizedMessage.includes(keyword))) {
      return 'low';
    }

    return 'normal';
  }

  private needsConfirmation(
    commandType: WorkflowCommandType,
    urgency: CommandUrgency,
    confidence: number
  ): boolean {
    // Always confirm destructive actions
    if (commandType === 'cancel_execution') {
      return true;
    }

    // Confirm low confidence commands
    if (confidence < this.config.confirmationThreshold) {
      return true;
    }

    // Don't confirm high-confidence, non-destructive commands with normal+ urgency
    if (confidence >= this.config.autoExecuteThreshold && urgency !== 'low') {
      return false;
    }

    // Default to confirmation for workflow execution
    return commandType === 'execute_workflow';
  }

  private calculateConfidence(
    workflowMatchConfidence: number,
    intent: WorkflowCommandIntent,
    parameters: Record<string, unknown>,
    commandType: WorkflowCommandType
  ): number {
    let confidence = workflowMatchConfidence * 0.5; // 50% from workflow match

    // Add confidence from intent clarity
    if (intent.action && intent.action !== 'execute') {
      confidence += 0.2;
    }

    // Add confidence from parameter extraction
    if (Object.keys(parameters).length > 0) {
      confidence += 0.15;
    }

    // Add confidence from command type detection
    if (commandType) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  // === Command Handlers ===

  private async handleExecuteWorkflow(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    if (command.confirmationRequired && command.confidence < this.config.autoExecuteThreshold) {
      return {
        responseId,
        success: true,
        message: `I found workflow "${command.workflowReference.value}". Would you like me to execute it?`,
        command,
        clarificationNeeded: true,
        clarificationQuestions: ['Confirm execution?'],
        metadata: { requiresConfirmation: true }
      };
    }

    try {
      const result = await this.executionService.executeWorkflow(context.userId, {
        workflowId: command.workflowReference.value,
        parameters: command.parameters,
        timeoutMs: command.urgency === 'urgent' ? 300000 : 120000 // 5min urgent, 2min normal
      });

      return {
        responseId,
        success: true,
        message: `Workflow "${command.workflowReference.value}" executed successfully! Execution ID: ${result.executionId}`,
        command,
        executionId: result.executionId,
        metadata: {
          workflowId: result.workflowId,
          status: result.status,
          startedAt: result.startedAt.toISOString()
        }
      };

    } catch (error) {
      return {
        responseId,
        success: false,
        message: `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        command,
        metadata: { error: 'EXECUTION_FAILED' }
      };
    }
  }

  private async handleCheckStatus(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    // Implementation for status checking
    return {
      responseId,
      success: true,
      message: `Status checking for "${command.workflowReference.value}" is not yet implemented.`,
      command,
      metadata: { feature: 'status_check', implemented: false }
    };
  }

  private async handleCancelExecution(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    // Implementation for execution cancellation
    return {
      responseId,
      success: true,
      message: `Execution cancellation for "${command.workflowReference.value}" is not yet implemented.`,
      command,
      metadata: { feature: 'cancel_execution', implemented: false }
    };
  }

  private async handleListWorkflows(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    try {
      const workflows = await this.executionService.getUserWorkflows(context.userId);
      const workflowList = workflows.map(w => `• ${w.name} (N8N)`).join('\n');

      return {
        responseId,
        success: true,
        message: `Your available workflows:\n${workflowList}`,
        command,
        metadata: { workflowCount: workflows.length }
      };

    } catch (error) {
      return {
        responseId,
        success: false,
        message: `Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`,
        command,
        metadata: { error: 'LIST_WORKFLOWS_FAILED' }
      };
    }
  }

  private async handleExecutionHistory(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    // Implementation for execution history
    return {
      responseId,
      success: true,
      message: `Execution history for "${command.workflowReference.value}" is not yet implemented.`,
      command,
      metadata: { feature: 'execution_history', implemented: false }
    };
  }

  private async handleScheduleWorkflow(
    command: WorkflowChatCommand,
    context: ChatContext,
    responseId: string
  ): Promise<WorkflowChatResponse> {
    // Implementation for workflow scheduling
    return {
      responseId,
      success: true,
      message: `Workflow scheduling for "${command.workflowReference.value}" is not yet implemented.`,
      command,
      metadata: { feature: 'schedule_workflow', implemented: false }
    };
  }

  // === Utility Methods ===

  private matchesWorkflowPattern(message: string): boolean {
    const patterns = [
      /\b(run|execute|start|trigger)\s+.*(workflow|automation)\b/i,
      /\b(workflow|automation)\s+.*(run|execute|start|trigger)\b/i,
      /\bworkflow\s+status\b/i,
      /\bcancel\s+.*(workflow|automation)\b/i
    ];

    return patterns.some(pattern => pattern.test(message));
  }

  private extractWorkflowKeywords(message: string): string[] {
    const keywords = message
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(the|and|or|but|for|with|from|to|of|in|on|at)$/.test(word));

    return keywords;
  }

  private extractEntities(message: string): string[] {
    // Simple entity extraction - could be enhanced with NLP
    const entities: string[] = [];

    // Extract quoted strings
    const quotedMatches = message.match(/"([^"]+)"/g);
    if (quotedMatches) {
      entities.push(...quotedMatches.map(m => m.slice(1, -1)));
    }

    // Extract capitalized words (potential proper nouns)
    const capitalizedMatches = message.match(/\b[A-Z][a-z]+\b/g);
    if (capitalizedMatches) {
      entities.push(...capitalizedMatches);
    }

    return [...new Set(entities)]; // Remove duplicates
  }

  private extractTimeframe(message: string): string | undefined {
    const timePatterns = [
      /\b(now|immediately|asap)\b/i,
      /\bin\s+(\d+)\s+(minutes?|hours?|days?)\b/i,
      /\bat\s+(\d{1,2}:\d{2})\b/i,
      /\b(today|tomorrow|tonight)\b/i,
      /\b(morning|afternoon|evening)\b/i
    ];

    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  private matchesQuery(workflowName: string, query: string): boolean {
    const normalizedName = workflowName.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    return normalizedName.includes(normalizedQuery) ||
      this.calculateStringSimilarity(normalizedName, normalizedQuery) > 0.6;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for now
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private hasAmbiguousWorkflowReference(message: string): boolean {
    const vague = ['workflow', 'automation', 'it', 'that', 'this'];
    const normalized = message.toLowerCase();

    return vague.some(word => normalized.includes(word)) &&
      !normalized.match(/"[^"]+"/); // No quoted specific names
  }

  private async identifyMissingParameters(
    message: string,
    context: ChatContext
  ): Promise<string[]> {
    // Simple heuristic for now - could be enhanced with workflow schema analysis
    const commonParams = ['email', 'name', 'date', 'amount', 'description'];
    const hasParam = (param: string) => message.toLowerCase().includes(param);

    return commonParams.filter(param => !hasParam(param)).slice(0, 3);
  }

  private hasUnclearAction(message: string): boolean {
    const actions = ['run', 'execute', 'start', 'stop', 'check', 'cancel', 'list'];
    const normalized = message.toLowerCase();

    return !actions.some(action => normalized.includes(action));
  }
} 