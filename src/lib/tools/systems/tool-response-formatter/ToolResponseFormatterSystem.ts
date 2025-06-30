/**
 * Tool Response Formatter System - Unified Foundation Integration
 * 
 * Integrates comprehensive tool response formatting functionality with the unified tool foundation
 * while preserving all existing response formatting domain logic and services.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Foundation integration without disrupting existing services
 * - Centralized constants (no string literals)
 * - Dependency injection throughout
 * - Comprehensive error handling
 * - ULID identifiers for business logic
 */

import {
  IUnifiedToolFoundation,
  UnifiedToolDefinition,
  ToolCategory,
  ToolCapability,
  ToolStatus,
  TOOL_RESPONSE_FORMATTER_TOOLS,
  ToolResult,
  ToolParameters,
  ExecutionContext
} from '../../foundation';
import { logger } from '../../../../lib/logging';
import { ulid } from 'ulid';
import { ToolResponseFormatterIntegrationService, ToolResponseFormatterConfig } from './ToolResponseFormatterIntegrationService';

/**
 * Tool Response Formatter System Configuration
 */
export interface ToolResponseFormatterSystemConfig {
  enableLLMFormatting: boolean;
  enableResponseValidation: boolean;
  enableContextualAdaptation: boolean;
  enableMultiModalFormatting: boolean;
}

/**
 * Tool Response Formatter System - Foundation Integration
 * 
 * Provides unified access to response formatting functionality through the foundation
 * while preserving all existing domain-specific formatting logic.
 */
export class ToolResponseFormatterSystem {
  private foundation: IUnifiedToolFoundation | null = null;
  private readonly config: ToolResponseFormatterSystemConfig;
  private integrationService: ToolResponseFormatterIntegrationService;

  constructor(config: ToolResponseFormatterSystemConfig) {
    this.config = config;
    this.integrationService = new ToolResponseFormatterIntegrationService({
      enableLLMFormatting: config.enableLLMFormatting,
      enableResponseValidation: config.enableResponseValidation,
      enableContextualAdaptation: config.enableContextualAdaptation,
      enableMultiModalFormatting: config.enableMultiModalFormatting
    });
  }

  /**
   * Initialize the tool response formatter system with the foundation
   */
  async initialize(foundation: IUnifiedToolFoundation): Promise<void> {
    this.foundation = foundation;

    try {
      await this.registerToolResponseFormatterTools();

      logger.info('Tool response formatter system initialized successfully', {
        toolsRegistered: this.getToolResponseFormatterToolCount()
      });
    } catch (error) {
      logger.error('Failed to initialize tool response formatter system', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register all tool response formatter tools with the foundation
   */
  private async registerToolResponseFormatterTools(): Promise<void> {
    if (!this.foundation) {
      throw new Error('Foundation not initialized');
    }

    const toolDefinitions = this.createToolResponseFormatterToolDefinitions();

    for (const toolDef of toolDefinitions) {
      await this.foundation.registerTool(toolDef);
    }
  }

  /**
   * Create tool definitions for all response formatter tools
   */
  private createToolResponseFormatterToolDefinitions(): UnifiedToolDefinition[] {
    return [
      this.createFormatToolResponseTool(),
      this.createAdaptResponseStyleTool(),
      this.createValidateResponseQualityTool(),
      ...this.createPlaceholderTools()
    ];
  }

  /**
   * Create Format Tool Response tool definition
   */
  private createFormatToolResponseTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_TOOL_RESPONSE,
      displayName: 'Format Tool Response',
      category: ToolCategory.FORMATTING,
      capabilities: [ToolCapability.RESPONSE_FORMATTING],
      status: ToolStatus.ACTIVE,
      description: 'Format tool response for better readability',
      parameters: {
        type: 'object',
        properties: {
          response: { type: 'string', description: 'Raw response to format' },
          format: { type: 'string', description: 'Target format (markdown, html, plain)' },
          context: { type: 'string', description: 'Context for formatting' }
        },
        required: ['response', 'format']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'tool-response-formatter-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.formatToolResponse(params, context);
      }
    };
  }

  /**
   * Create Adapt Response Style tool definition
   */
  private createAdaptResponseStyleTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: TOOL_RESPONSE_FORMATTER_TOOLS.ADAPT_RESPONSE_STYLE,
      displayName: 'Adapt Response Style',
      category: ToolCategory.FORMATTING,
      capabilities: [ToolCapability.STYLE_ADAPTATION],
      status: ToolStatus.ACTIVE,
      description: 'Adapt response style to target audience',
      parameters: {
        type: 'object',
        properties: {
          response: { type: 'string', description: 'Response to adapt' },
          targetAudience: { type: 'string', description: 'Target audience (technical, business, general)' },
          tone: { type: 'string', description: 'Desired tone (formal, casual, friendly)' }
        },
        required: ['response', 'targetAudience']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'tool-response-formatter-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.adaptResponseStyle(params, context);
      }
    };
  }

  /**
   * Create Validate Response Quality tool definition
   */
  private createValidateResponseQualityTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: TOOL_RESPONSE_FORMATTER_TOOLS.VALIDATE_RESPONSE_QUALITY,
      displayName: 'Validate Response Quality',
      category: ToolCategory.VALIDATION,
      capabilities: [ToolCapability.QUALITY_VALIDATION],
      status: ToolStatus.ACTIVE,
      description: 'Validate response quality and completeness',
      parameters: {
        type: 'object',
        properties: {
          response: { type: 'string', description: 'Response to validate' },
          criteria: { type: 'array', items: { type: 'string' }, description: 'Validation criteria' },
          minQualityScore: { type: 'number', description: 'Minimum quality score (0-100)' }
        },
        required: ['response']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'tool-response-formatter-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.validateResponseQuality(params, context);
      }
    };
  }

  /**
   * Create placeholder tool definitions for tools not yet fully implemented
   */
  private createPlaceholderTools(): UnifiedToolDefinition[] {
    const remainingTools = [
      TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_ERROR_RESPONSE,
      TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_SUCCESS_RESPONSE,
      TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_PARTIAL_RESPONSE,
      TOOL_RESPONSE_FORMATTER_TOOLS.PERSONALIZE_RESPONSE,
      TOOL_RESPONSE_FORMATTER_TOOLS.ADJUST_TONE,
      TOOL_RESPONSE_FORMATTER_TOOLS.APPLY_PERSONA,
      TOOL_RESPONSE_FORMATTER_TOOLS.GET_RESPONSE_TEMPLATE,
      TOOL_RESPONSE_FORMATTER_TOOLS.CREATE_RESPONSE_TEMPLATE,
      TOOL_RESPONSE_FORMATTER_TOOLS.UPDATE_RESPONSE_TEMPLATE,
      TOOL_RESPONSE_FORMATTER_TOOLS.DELETE_RESPONSE_TEMPLATE,
      TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_WITH_CONTEXT,
      TOOL_RESPONSE_FORMATTER_TOOLS.ENHANCE_RESPONSE,
      TOOL_RESPONSE_FORMATTER_TOOLS.GET_STYLE_RECOMMENDATIONS
    ];

    return remainingTools.map(toolName => ({
      id: ulid(),
      name: toolName,
      displayName: toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      category: ToolCategory.FORMATTING,
      capabilities: [ToolCapability.RESPONSE_FORMATTING],
      status: ToolStatus.ACTIVE,
      description: `${toolName} tool`,
      parameters: { type: 'object', properties: {}, required: [] },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'tool-response-formatter-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { message: `${toolName} tool is registered but not yet implemented` },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: toolName,
            toolName: toolName,
            timestamp: new Date().toISOString()
          }
        };
      }
    }));
  }

  /**
   * Get the number of response formatter tools registered
   */
  private getToolResponseFormatterToolCount(): number {
    return Object.keys(TOOL_RESPONSE_FORMATTER_TOOLS).length;
  }

  /**
   * Cleanup method for testing and shutdown
   */
  async cleanup(): Promise<void> {
    // Cleanup any resources if needed
    logger.info('Tool response formatter system cleanup completed');
  }
} 