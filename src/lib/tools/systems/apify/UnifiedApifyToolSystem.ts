/**
 * Unified Apify Tool System
 * 
 * Integrates the Apify tool system with the unified foundation while
 * preserving all existing functionality and domain expertise.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID identifiers for business logic
 * - NO string literals - use centralized constants
 * - Dependency injection throughout
 * - Preserve domain expertise
 * - Interface-first design
 */

import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { UnifiedToolDefinition, ToolParameters, ExecutionContext, ToolResult } from '../../foundation/types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';
import { APIFY_TOOL_NAMES } from '../../../../constants/tool-names';
import { createToolId } from '../../foundation/utils/ToolIdUtils';
import { IApifyManager } from '../../../../agents/shared/tools/integrations/apify/ApifyManager.interface';
import { createApifyTools } from '../../../../agents/shared/tools/integrations/apify/ApifyToolFactory';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { ToolFoundationError, ToolExecutionError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Unified Apify Tool System
 * 
 * Provides centralized management of all Apify tools through the unified foundation
 * while preserving the existing Apify domain expertise and functionality.
 */
export class UnifiedApifyToolSystem {
  private initialized = false;
  private registeredTools = new Set<string>();

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly apifyManager: IApifyManager,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Initialize the Apify tool system with the unified foundation
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Unified Apify Tool System');

      // Register all Apify tools with the foundation
      await this.registerAllApifyTools();

      this.initialized = true;
      this.logger.info('Unified Apify Tool System initialized successfully', {
        registeredTools: this.registeredTools.size
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Unified Apify Tool System', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Register all Apify tools with the unified foundation
   */
  private async registerAllApifyTools(): Promise<void> {
    // Get all Apify tools from the existing factory
    const apifyTools = createApifyTools(this.apifyManager);

    // Convert and register each tool
    for (const [toolName, toolDef] of Object.entries(apifyTools)) {
      try {
        // Create unified tool definition
        const unifiedTool: UnifiedToolDefinition = {
          id: createToolId(),
          name: toolName,
          displayName: this.formatDisplayName(toolName),
          description: toolDef.description,
          category: this.determineToolCategory(toolName),
          capabilities: this.determineToolCapabilities(toolName),
          status: ToolStatus.ACTIVE,
          enabled: true,

          // Parameters from the existing tool schema
          parameters: {
            type: 'object',
            properties: this.convertZodSchemaToJsonSchema(toolDef.schema),
            required: this.extractRequiredFields(toolDef.schema)
          },

          // Execution function that wraps the original tool
          executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
            return this.executeApifyTool(toolName, toolDef, params, context);
          },

          // Metadata
          metadata: {
            version: '1.0.0',
            author: 'apify-integration',
            provider: 'apify',
            tags: this.generateToolTags(toolName),
            documentation: toolDef.description,
            timeout: 120000 // 2 minutes for web scraping
          },

          // Additional properties for the tool
          requiresWorkspace: false
        };

        // Register with foundation
        const result = await this.foundation.registerTool(unifiedTool);

        if (result.success) {
          this.registeredTools.add(toolName);
          this.logger.debug('Registered Apify tool with foundation', {
            toolName,
            toolId: unifiedTool.id
          });
        } else {
          this.logger.warn('Failed to register Apify tool with foundation', {
            toolName,
            errors: result.errors
          });
        }

      } catch (error) {
        this.logger.error('Error registering Apify tool', {
          toolName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Execute an Apify tool through the unified foundation
   */
  private async executeApifyTool(
    toolName: string,
    toolDef: any,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Executing Apify tool', {
        toolName,
        params: Object.keys(params),
        contextId: context.traceId || context.sessionId
      });

      // Execute the original tool function
      const result = await toolDef.func(params);

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.info('Apify tool executed successfully', {
        toolName,
        duration,
        contextId: context.traceId || context.sessionId
      });

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: duration,
          toolId: toolName,
          toolName,
          timestamp: new Date().toISOString(),
          context: {
            provider: 'apify',
            agentId: context.agentId,
            sessionId: context.sessionId
          }
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.error('Apify tool execution failed', {
        toolName,
        duration,
        contextId: context.traceId || context.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolExecutionError(
        `Apify tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          toolId: toolName,
          toolName,
          executionTimeMs: duration
        }
      );
    }
  }

  /**
   * Determine tool category based on tool name
   */
  private determineToolCategory(toolName: string): ToolCategory {
    if (toolName.includes('instagram') || toolName.includes('facebook') ||
      toolName.includes('twitter') || toolName.includes('linkedin') ||
      toolName.includes('reddit') || toolName.includes('youtube')) {
      return ToolCategory.SOCIAL_MEDIA;
    }

    if (toolName.includes('scraper') || toolName.includes('crawler') ||
      toolName.includes('web') || toolName.includes('content')) {
      return ToolCategory.WEB_SCRAPING;
    }

    if (toolName.includes('discovery') || toolName.includes('suggest') ||
      toolName.includes('info')) {
      return ToolCategory.DISCOVERY;
    }

    return ToolCategory.DATA_PROCESSING;
  }

  /**
   * Determine tool capabilities based on tool name and functionality
   */
  private determineToolCapabilities(toolName: string): ToolCapability[] {
    const capabilities: ToolCapability[] = [ToolCapability.DATA_EXTRACTION];

    if (toolName.includes('scraper') || toolName.includes('crawler')) {
      capabilities.push(ToolCapability.WEB_SCRAPING);
    }

    if (toolName.includes('instagram') || toolName.includes('facebook') ||
      toolName.includes('twitter') || toolName.includes('linkedin')) {
      capabilities.push(ToolCapability.SOCIAL_MEDIA_ANALYSIS);
    }

    if (toolName.includes('discovery') || toolName.includes('suggest')) {
      capabilities.push(ToolCapability.TOOL_DISCOVERY);
    }

    if (toolName.includes('dynamic') || toolName.includes('run')) {
      capabilities.push(ToolCapability.DYNAMIC_EXECUTION);
    }

    return capabilities;
  }

  /**
   * Format display name from tool name
   */
  private formatDisplayName(toolName: string): string {
    return toolName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate tags for tool categorization
   */
  private generateToolTags(toolName: string): string[] {
    const tags = ['apify', 'web-scraping'];

    if (toolName.includes('instagram')) tags.push('instagram', 'social-media');
    if (toolName.includes('facebook')) tags.push('facebook', 'social-media');
    if (toolName.includes('twitter')) tags.push('twitter', 'social-media');
    if (toolName.includes('linkedin')) tags.push('linkedin', 'social-media');
    if (toolName.includes('youtube')) tags.push('youtube', 'video');
    if (toolName.includes('reddit')) tags.push('reddit', 'forum');
    if (toolName.includes('discovery')) tags.push('discovery', 'search');
    if (toolName.includes('dynamic')) tags.push('dynamic', 'flexible');

    return tags;
  }

  /**
   * Convert Zod schema to JSON Schema format
   */
  private convertZodSchemaToJsonSchema(zodSchema: any): Record<string, any> {
    // This is a simplified conversion - in production you'd use a proper Zod to JSON Schema converter
    // For now, we'll provide basic schema structures based on common Apify tool patterns

    if (zodSchema._def?.typeName === 'ZodObject') {
      const properties: Record<string, any> = {};

      for (const [key, value] of Object.entries(zodSchema._def.shape() || {})) {
        properties[key] = this.convertZodTypeToJsonSchema(value);
      }

      return properties;
    }

    // Fallback for common Apify tool parameters
    return {
      query: { type: 'string', description: 'Search query or input' },
      limit: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum number of results' },
      dryRun: { type: 'boolean', description: 'Whether to perform a dry run' }
    };
  }

  /**
   * Convert individual Zod type to JSON Schema
   */
  private convertZodTypeToJsonSchema(zodType: any): any {
    const typeName = zodType._def?.typeName;

    switch (typeName) {
      case 'ZodString':
        return { type: 'string', description: zodType._def.description || 'String parameter' };
      case 'ZodNumber':
        return { type: 'number', description: zodType._def.description || 'Number parameter' };
      case 'ZodBoolean':
        return { type: 'boolean', description: zodType._def.description || 'Boolean parameter' };
      case 'ZodArray':
        return { type: 'array', description: zodType._def.description || 'Array parameter' };
      case 'ZodObject':
        return { type: 'object', description: zodType._def.description || 'Object parameter' };
      default:
        return { type: 'string', description: 'Parameter' };
    }
  }

  /**
   * Extract required fields from Zod schema
   */
  private extractRequiredFields(zodSchema: any): string[] {
    // This is a simplified extraction - in production you'd properly parse the Zod schema
    // For now, return common required fields for Apify tools
    return ['query']; // Most Apify tools require at least a query parameter
  }

  /**
   * Execute Apify tool through the unified foundation
   */
  async executeTool(toolName: string, params: ToolParameters, context: ExecutionContext): Promise<ToolResult> {
    if (!this.initialized) {
      throw new ToolFoundationError('Apify tool system not initialized');
    }

    if (!this.registeredTools.has(toolName)) {
      throw new ToolFoundationError(`Apify tool not registered: ${toolName}`);
    }

    return this.foundation.executeTool(toolName, params, context);
  }

  /**
   * Get all registered Apify tools
   */
  async getRegisteredTools(): Promise<string[]> {
    return Array.from(this.registeredTools);
  }

  /**
   * Check if the system is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    healthy: boolean;
    registeredTools: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    if (!this.initialized) {
      issues.push('System not initialized');
    }

    if (this.registeredTools.size === 0) {
      issues.push('No tools registered');
    }

    return {
      healthy: issues.length === 0,
      registeredTools: this.registeredTools.size,
      issues
    };
  }
}