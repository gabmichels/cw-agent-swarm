import { IdGenerator } from '@/utils/ulid';
// Note: Using foundation UnifiedToolRegistry instead of legacy ToolRegistry
import { StructuredId, structuredIdToString } from '@/types/entity-identifier';
import { UnifiedAgentConfig, UnifiedAgentResponse, UnifiedAgentService } from './UnifiedAgentService';
import { ThinkingVisualizer } from './visualization/ThinkingVisualizer';

/**
 * Extended RequestContext with support for StructuredId and startTime
 */
interface ExtendedRequestContext {
  /**
   * User ID
   */
  userId: string | StructuredId;

  /**
   * Previous conversation history
   */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;

  /**
   * Attached files
   */
  attachedFiles?: Array<{
    id: string;
    name: string;
    type: string;
    content?: string;
  }>;

  /**
   * Additional context
   */
  additionalContext?: Record<string, any>;

  /**
   * Processing options
   */
  options?: {
    /**
     * Whether to enable streaming
     */
    stream?: boolean;

    /**
     * Whether to save the response to history
     */
    saveToHistory?: boolean;

    /**
     * Whether to enable delegation
     */
    enableDelegation?: boolean;

    /**
     * Whether to enable tools
     */
    enableTools?: boolean;

    /**
     * Whether to skip retrieval
     */
    skipRetrieval?: boolean;

    /**
     * Start time for telemetry
     */
    startTime?: number;
  };
}

/**
 * Service responsible for the end-to-end integration of all agent components
 */
export class IntegrationService {
  /**
   * The unified agent service
   */
  private unifiedAgentService!: UnifiedAgentService;

  /**
   * Request handler mappings for processing
   */
  private requestHandlers: Map<string, (message: string, context: ExtendedRequestContext) => Promise<UnifiedAgentResponse>>;

  /**
   * Telemetry and monitoring service
   */
  private telemetryEnabled: boolean;

  /**
   * Visualization enabled
   */
  private visualizationEnabled: boolean;

  /**
   * A/B testing enabled
   */
  private abTestingEnabled: boolean;

  /**
   * Parallel processing enabled
   */
  private parallelProcessingEnabled: boolean;

  /**
   * The request processors that can be run in parallel
   */
  private parallelProcessors: Array<{
    name: string;
    processor: (request: any) => Promise<any>;
    dependency?: string[];
  }>;

  /**
   * Visualization service for tracking and displaying the thinking process
   */
  private visualizer: ThinkingVisualizer;

  /**
   * Creates an instance of IntegrationService.
   * @param {Object} options Configuration options
   */
  constructor(options: {
    unifiedAgentService?: UnifiedAgentService;
    unifiedAgentConfig?: UnifiedAgentConfig;
    enableTelemetry?: boolean;
    enableVisualization?: boolean;
    enableABTesting?: boolean;
    enableParallelProcessing?: boolean;
    visualizer?: ThinkingVisualizer;
  } = {}) {
    // Set up configurations
    this.telemetryEnabled = options.enableTelemetry || false;
    this.visualizationEnabled = options.enableVisualization || false;
    this.abTestingEnabled = options.enableABTesting || false;
    this.parallelProcessingEnabled = options.enableParallelProcessing || false;

    // Initialize request handlers
    this.requestHandlers = new Map();

    // Initialize parallel processors
    this.parallelProcessors = [];

    // Initialize the unified agent service
    if (options.unifiedAgentService) {
      this.unifiedAgentService = options.unifiedAgentService;
    } else {
      // Create a stub implementation for browser
      if (typeof window !== 'undefined') {
        // In browser: create a minimal implementation
        this.unifiedAgentService = {
          processMessage: async (message: string, context: any) => {
            console.warn('UnifiedAgentService not available in browser');
            return {
              id: IdGenerator.generate('response'),
              response: "This functionality is only available in the server environment."
            } as unknown as UnifiedAgentResponse;
          }
        } as unknown as UnifiedAgentService;
      } else {
        // In Node.js: initialize properly
        this.initializeUnifiedAgentService(options.unifiedAgentConfig || {});
      }
    }

    // Initialize visualization service with default storage adapters
    this.visualizer = options.visualizer || new ThinkingVisualizer();

    // Initialize request handlers
    this.initializeRequestHandlers();

    // Initialize parallel processors if enabled
    if (this.parallelProcessingEnabled) {
      this.initializeParallelProcessors();
    }
  }

  /**
   * Initialize the unified agent service with proper dynamic import to avoid browser issues
   */
  private async initializeUnifiedAgentService(config: UnifiedAgentConfig): Promise<void> {
    try {
      // Dynamically import to avoid webpack errors
      const { UnifiedAgentService } = await import('./UnifiedAgentService');
      this.unifiedAgentService = new UnifiedAgentService(config);
    } catch (error) {
      console.error('Failed to initialize UnifiedAgentService:', error);
      // Create a minimal working implementation
      this.unifiedAgentService = {
        processMessage: async (message: string, context: any) => {
          return {
            id: IdGenerator.generate('response'),
            response: "Failed to initialize agent service. Please try again later."
          } as unknown as UnifiedAgentResponse;
        }
      } as unknown as UnifiedAgentService;
    }
  }

  /**
   * Initializes the request handlers
   */
  private initializeRequestHandlers(): void {
    // Default handler
    this.requestHandlers.set('default', async (message, context) => {
      return this.unifiedAgentService.processMessage(message, {
        ...context,
        userId: this.getUserIdString(context.userId)
      });
    });

    // Content creation handler
    this.requestHandlers.set('content_creation', async (message, context) => {
      // Specialized handler for content creation requests
      return this.unifiedAgentService.processMessage(message, {
        ...context,
        userId: this.getUserIdString(context.userId),
        options: {
          ...context.options,
          enableTools: true,
          enableDelegation: true
        }
      });
    });

    // Research handler
    this.requestHandlers.set('research', async (message, context) => {
      // Specialized handler for research requests
      return this.unifiedAgentService.processMessage(message, {
        ...context,
        userId: this.getUserIdString(context.userId),
        options: {
          ...context.options,
          enableTools: true,
          enableDelegation: true
        }
      });
    });

    // Code generation handler
    this.requestHandlers.set('code', async (message, context) => {
      // Specialized handler for code-related requests
      return this.unifiedAgentService.processMessage(message, {
        ...context,
        userId: this.getUserIdString(context.userId),
        options: {
          ...context.options,
          enableTools: true,
          skipRetrieval: false
        }
      });
    });
  }

  /**
   * Initializes the parallel processors (stripped-down version for browser compatibility)
   */
  private initializeParallelProcessors(): void {
    // Implementation simplified for browser compatibility - no references to node:events dependent modules
    this.parallelProcessors = [];
  }

  /**
   * Extracts tool parameters from entities
   * @param tool Tool definition
   * @param entities Entities extracted from user message
   * @returns Tool parameters
   */
  private extractToolParameters(tool: any, entities: any[]): Record<string, any> {
    const parameters: Record<string, any> = {};

    // For each tool parameter, try to find a matching entity
    if (tool.parameters) {
      for (const param of tool.parameters) {
        // Find entity that matches the parameter by type or name
        const matchingEntity = entities.find(entity =>
          entity.type.toLowerCase() === param.name.toLowerCase() ||
          entity.type.toLowerCase() === param.description?.toLowerCase()
        );

        if (matchingEntity) {
          // Convert value based on parameter type
          switch (param.type) {
            case 'number':
              parameters[param.name] = Number(matchingEntity.value);
              break;
            case 'boolean':
              parameters[param.name] = Boolean(matchingEntity.value);
              break;
            default:
              parameters[param.name] = matchingEntity.value;
          }
        } else if (param.required) {
          // For required parameters, use default value or null
          parameters[param.name] = param.defaultValue !== undefined
            ? param.defaultValue
            : null;
        }
      }
    }

    return parameters;
  }

  /**
   * Processes a message in the unified agent system
   * 
   * @param message The message to process
   * @param context The request context
   * @returns The processing result
   */
  async processMessage(message: string, context: ExtendedRequestContext): Promise<UnifiedAgentResponse> {
    const requestId = IdGenerator.generateString('req');

    // Initialize visualization if enabled
    if (this.visualizationEnabled) {
      // Note: Simplified for browser compatibility - just log instead of creating visualization
      console.log(`[Visualization] Creating visualization for request: ${requestId}`);
    }

    // Ensure we have a startTime for telemetry
    const contextWithStartTime: ExtendedRequestContext = {
      ...context,
      options: {
        ...context.options,
        startTime: context.options?.startTime || Date.now()
      }
    };

    // Start telemetry if enabled
    if (this.telemetryEnabled) {
      this.recordTelemetry(
        requestId,
        this.getUserIdString(contextWithStartTime.userId),
        'start',
        {
          message_length: message.length,
          has_files: (contextWithStartTime.attachedFiles?.length || 0) > 0,
          options: contextWithStartTime.options
        }
      );
    }

    try {
      // Analyze the message type to determine which handler to use
      const intent = await this.determineMessageIntent(message);

      // Get the appropriate handler
      const handler = this.requestHandlers.get(intent) || this.requestHandlers.get('default')!;

      // If parallel processing is enabled, use it
      let response: UnifiedAgentResponse;

      if (this.parallelProcessingEnabled) {
        response = await this.processInParallel(requestId, message, contextWithStartTime);
      } else {
        response = await handler(message, contextWithStartTime);
      }

      // A/B testing if enabled
      if (this.abTestingEnabled) {
        response = await this.applyABTesting(message, contextWithStartTime, response);
      }

      // End telemetry if enabled
      if (this.telemetryEnabled) {
        this.recordTelemetry(
          requestId,
          this.getUserIdString(contextWithStartTime.userId),
          'end',
          {
            response_length: response.response.length,
            thinking_steps: response.thinking?.reasoning?.length || 0,
            tools_used: response.toolsUsed?.length || 0,
            processing_time: Date.now() - (contextWithStartTime.options?.startTime || Date.now())
          }
        );
      }

      return response;
    } catch (error) {
      // Record error telemetry
      if (this.telemetryEnabled) {
        this.recordTelemetry(
          requestId,
          this.getUserIdString(contextWithStartTime.userId),
          'error',
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        );
      }

      throw error;
    }
  }

  /**
   * Helper method to convert StructuredId to string if needed
   * 
   * @param userId The user ID, which can be a string or StructuredId
   * @returns The user ID as a string
   */
  private getUserIdString(userId: string | StructuredId): string {
    if (typeof userId === 'string') {
      return userId;
    }
    return structuredIdToString(userId);
  }

  /**
   * Determines the intent of a message to route to the proper handler
   * 
   * @param message The user message
   * @returns The intent category
   */
  private async determineMessageIntent(message: string): Promise<string> {
    // For now, use a simple approach
    // In a real implementation, this would use a more sophisticated intent classification system

    if (message.toLowerCase().includes('write') ||
      message.toLowerCase().includes('create content')) {
      return 'content_creation';
    }

    if (message.toLowerCase().includes('research') ||
      message.toLowerCase().includes('find information')) {
      return 'research';
    }

    if (message.toLowerCase().includes('code') ||
      message.toLowerCase().includes('function') ||
      message.toLowerCase().includes('program')) {
      return 'code';
    }

    return 'default';
  }

  /**
   * Processes the request using parallel execution for independent components
   * Browser-safe implementation that doesn't rely on visualization or node:events modules
   * 
   * @param requestId The request ID
   * @param message The user message
   * @param context The request context
   * @returns The processing result
   */
  private async processInParallel(
    requestId: string,
    message: string,
    context: ExtendedRequestContext
  ): Promise<UnifiedAgentResponse> {
    // Just use the default handler for browser environments
    const handler = this.requestHandlers.get('default')!;
    return handler(message, context);
  }

  /**
   * Applies A/B testing to the response
   * 
   * @param message The user message
   * @param context The request context
   * @param baseResponse The base response
   * @returns The potentially modified response
   */
  private async applyABTesting(
    message: string,
    context: ExtendedRequestContext,
    baseResponse: UnifiedAgentResponse
  ): Promise<UnifiedAgentResponse> {
    // Implement a real A/B testing system
    // For now, we'll just return the original response with A/B test metadata

    // Create alternate responses with slight variations (just for demonstration)
    const variations = [
      {
        id: 'variation_1',
        response: baseResponse.response.trim(),
        variantType: 'original'
      },
      {
        id: 'variation_2',
        response: baseResponse.response.trim() + ' Does that help?',
        variantType: 'polite'
      },
      {
        id: 'variation_3',
        response: 'To answer your question: ' + baseResponse.response.trim(),
        variantType: 'direct'
      }
    ];

    // Select a variant (in a real system, this would be based on user assignment)
    const selectedVariantId = `variation_${(Math.floor(Math.random() * 3) + 1)}`;
    const selectedVariant = variations.find(v => v.id === selectedVariantId) || variations[0];

    // Update the response with the selected variant
    return {
      ...baseResponse,
      response: selectedVariant.response,
      debug: {
        ...baseResponse.debug,
        abTesting: {
          experimentId: 'response_style_test',
          variantId: selectedVariant.id,
          variantType: selectedVariant.variantType,
          variations
        }
      }
    };
  }

  /**
   * Records telemetry for the request
   * 
   * @param requestId The request ID
   * @param userId The user ID
   * @param eventType The event type
   * @param details The event details
   */
  private recordTelemetry(
    requestId: string,
    userId: string,
    eventType: 'start' | 'end' | 'error',
    details?: Record<string, any>
  ): void {
    // In a real implementation, this would record telemetry to a storage system
    // For now, just log it to console
    console.log(`Telemetry [${eventType}] for request ${requestId} from user ${userId}:`, details);
  }

  /**
   * Gets all telemetry for a request
   * 
   * @param requestId The request ID
   * @returns The telemetry events
   */
  getTelemetryForRequest(requestId: string): any[] {
    // In a real implementation, this would retrieve telemetry from storage
    return [];
  }

  /**
   * Gets visualization data for a request - browser safe implementation
   * 
   * @param requestId The request ID
   * @returns The visualization data (null in browser context)
   */
  async getVisualizationForRequest(requestId: string): Promise<any> {
    try {
      return await this.visualizer.getVisualization(requestId);
    } catch (error) {
      console.error('Error retrieving visualization:', error);
      return null;
    }
  }


} 