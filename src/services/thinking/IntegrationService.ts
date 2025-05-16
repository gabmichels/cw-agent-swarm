import { IdGenerator } from '@/utils/ulid';
import { ThinkingService } from './ThinkingService';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { MemoryConsolidator } from './memory/MemoryConsolidator';
import { DelegationService } from './delegation/DelegationService';
import { CollaborativeAgentService } from './delegation/CollaborativeAgentService';
import { SharedMemoryService } from './delegation/SharedMemoryService';
import { TaskProgressTracker } from './delegation/TaskProgressTracker';
import { ToolService } from './tools/ToolService';
import { ToolFeedbackService } from './tools/ToolFeedbackService';
import { ToolRegistry } from './tools/ToolRegistry';
import { PluginSystem } from './tools/PluginSystem';
import { QueryEnhancer } from './retrieval/QueryEnhancer';
import { ResultReranker } from './retrieval/ResultReranker';
import { ThinkingResult } from './types';
import { UnifiedAgentService, UnifiedAgentConfig, UnifiedAgentResponse } from './UnifiedAgentService';
import { StructuredId, structuredIdToString } from '@/types/structured-id';
import { ThinkingVisualizer, VisualizationNodeType, ThinkingVisualization } from './visualization';

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
  private unifiedAgentService: UnifiedAgentService;

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
    // Initialize the unified agent service
    this.unifiedAgentService = options.unifiedAgentService || 
                             new UnifiedAgentService(options.unifiedAgentConfig || {});
    
    // Set up configurations
    this.telemetryEnabled = options.enableTelemetry || false;
    this.visualizationEnabled = options.enableVisualization || false;
    this.abTestingEnabled = options.enableABTesting || false;
    this.parallelProcessingEnabled = options.enableParallelProcessing || false;
    
    // Initialize visualization service
    this.visualizer = options.visualizer || new ThinkingVisualizer();
    
    // Initialize request handlers
    this.requestHandlers = new Map();
    this.initializeRequestHandlers();
    
    // Initialize parallel processors
    this.parallelProcessors = [];
    if (this.parallelProcessingEnabled) {
      this.initializeParallelProcessors();
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
   * Initializes the parallel processors
   */
  private initializeParallelProcessors(): void {
    this.parallelProcessors = [
      {
        name: 'memory_retrieval',
        processor: async (request: { message: string; context: ExtendedRequestContext; requestId: string; nodeId: string }) => {
          // Initialize memory retrieval node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.CONTEXT_RETRIEVAL,
            'Memory Retrieval',
            { stage: 'start' }
          );
          
          try {
            // Actual memory retrieval implementation would go here
            const memoryRetriever = new MemoryRetriever();
            const memories = await memoryRetriever.retrieveMemories({
              userId: this.getUserIdString(request.context.userId),
              query: request.message
            });
            
            // Complete the node with results
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              memoriesCount: memories ? memories.memoryIds.length : 0,
              memoryResults: memories
            });
            
            return { 
              memories,
              nodeId
            };
          } catch (error) {
            // Complete the node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            // Return empty results
            return { 
              memories: [],
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        }
      },
      {
        name: 'file_retrieval',
        processor: async (request: { message: string; context: ExtendedRequestContext; requestId: string }) => {
          // Initialize file retrieval node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.CONTEXT_RETRIEVAL,
            'File Retrieval',
            { stage: 'start' }
          );
          
          try {
            // Actual file retrieval implementation would go here
            // For now, return empty results
            const files: any[] = [];
            
            // Complete the node with results
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              filesCount: files.length,
              fileResults: files
            });
            
            return { 
              files,
              nodeId
            };
          } catch (error) {
            // Complete the node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            // Return empty results
            return { 
              files: [],
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        }
      },
      {
        name: 'thinking',
        processor: async (request: { 
          message: string; 
          context: ExtendedRequestContext; 
          requestId: string;
          memoryResults: { memories: any[]; nodeId: string };
          fileResults: { files: any[]; nodeId: string };
        }) => {
          // Initialize thinking node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.THINKING,
            'Analyzing Intent',
            { stage: 'start' }
          );
          
          try {
            // Use the thinking service to analyze the message
            const thinkingService = new ThinkingService();
            const thinking = await thinkingService.analyzeIntent(
              request.message,
              {
                userId: this.getUserIdString(request.context.userId),
                // Just simulate for now, since we don't have the exact types
                chatHistory: [],
                workingMemory: request.memoryResults.memories,
                contextFiles: request.fileResults.files
              }
            );
            
            // Complete the node with results
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              intent: thinking.intent,
              entities: thinking.entities,
              shouldDelegate: thinking.shouldDelegate
            });
            
            return {
              thinking,
              nodeId
            };
          } catch (error) {
            // Complete the node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            // Return empty results
            return {
              thinking: null,
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        dependency: ['memory_retrieval', 'file_retrieval']
      },
      {
        name: 'delegation_decision',
        processor: async (request: {
          message: string;
          context: ExtendedRequestContext;
          requestId: string;
          thinkingResults: { thinking: ThinkingResult; nodeId: string };
        }) => {
          // Skip if thinking returned no results
          if (!request.thinkingResults?.thinking) {
            return { delegate: false };
          }
          
          // Initialize delegation node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.DELEGATION_DECISION,
            'Delegation Decision',
            { stage: 'start' }
          );
          
          try {
            // Check if we should delegate
            const delegationService = new DelegationService();
            let delegationDecision = { delegate: false, confidence: 0, reason: '' };
            
            if (request.thinkingResults.thinking.shouldDelegate && 
                request.context.options?.enableDelegation !== false) {
              // This is a placeholder - in a real implementation, DelegationService would have this method
              // For now we just simulate the decision
              delegationDecision = {
                delegate: Math.random() > 0.7, // Simulate a delegation decision
                confidence: Math.random(),
                reason: 'Simulation of delegation decision'
              };
            }
            
            // Complete node with decision
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              delegationDecision
            });
            
            return {
              ...delegationDecision,
              nodeId
            };
          } catch (error) {
            // Complete node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            return {
              delegate: false,
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        dependency: ['thinking']
      },
      {
        name: 'tool_selection',
        processor: async (request: {
          message: string;
          context: ExtendedRequestContext;
          requestId: string;
          thinkingResults: { thinking: ThinkingResult; nodeId: string };
          delegationResults: { delegate: boolean; nodeId: string };
        }) => {
          // Skip if we're delegating or thinking returned no results
          if (request.delegationResults?.delegate || !request.thinkingResults?.thinking) {
            return { tools: [] };
          }
          
          // Initialize tool selection node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.TOOL_SELECTION,
            'Tool Selection',
            { stage: 'start' }
          );
          
          try {
            // Get recommended tools based on intent
            const toolService = new ToolService();
            const tools = request.context.options?.enableTools !== false
              ? await toolService.getRecommendedTools(
                  request.thinkingResults.thinking.intent.primary,
                  5
                )
              : [];
            
            // Complete node with selected tools
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              toolCount: tools.length,
              tools: tools.map(t => ({ id: t.tool.id, name: t.tool.name }))
            });
            
            return {
              tools,
              nodeId
            };
          } catch (error) {
            // Complete node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            return {
              tools: [],
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        dependency: ['thinking', 'delegation_decision']
      },
      {
        name: 'tool_execution',
        processor: async (request: {
          message: string;
          context: ExtendedRequestContext;
          requestId: string;
          thinkingResults: { thinking: ThinkingResult; nodeId: string };
          toolSelectionResults: { tools: any[]; nodeId: string };
        }) => {
          // Skip if no tools selected or thinking returned no results
          if (!request.toolSelectionResults?.tools?.length || !request.thinkingResults?.thinking) {
            return { toolResults: [] };
          }
          
          // Initialize tool execution node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.TOOL_EXECUTION,
            'Tool Execution',
            { stage: 'start' }
          );
          
          try {
            // Execute each tool
            const toolService = new ToolService();
            const toolResults = [];
            
            for (const toolInfo of request.toolSelectionResults.tools) {
              try {
                // Add sub-node for this tool execution
                const toolNodeId = this.visualizer.addNode(
                  request.requestId,
                  VisualizationNodeType.TOOL_EXECUTION,
                  `Executing: ${toolInfo.tool.name}`,
                  { stage: 'start', toolId: toolInfo.tool.id }
                );
                
                // Extract parameters from entities
                const parameters = this.extractToolParameters(
                  toolInfo.tool,
                  request.thinkingResults.thinking.entities
                );
                
                // Execute tool
                const executionResult = await toolService.executeTool({
                  toolId: toolInfo.tool.id,
                  parameters,
                  context: {
                    userId: this.getUserIdString(request.context.userId),
                    intent: request.thinkingResults.thinking.intent.primary,
                    entities: request.thinkingResults.thinking.entities
                  }
                });
                
                // Complete tool node
                this.visualizer.completeNode(
                  request.requestId,
                  toolNodeId,
                  {
                    stage: 'complete',
                    parameters,
                    result: executionResult.data,
                    success: executionResult.success
                  }
                );
                
                // Add to results
                toolResults.push({
                  toolId: toolInfo.tool.id,
                  toolName: toolInfo.tool.name,
                  input: parameters,
                  output: executionResult.data,
                  success: executionResult.success,
                  error: executionResult.error
                });
              } catch (error) {
                console.error(`Error executing tool ${toolInfo.tool.id}:`, error);
                
                // Add failed execution to results
                toolResults.push({
                  toolId: toolInfo.tool.id,
                  toolName: toolInfo.tool.name,
                  input: {},
                  output: null,
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
            
            // Complete the main tool execution node
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              toolResultCount: toolResults.length,
              successCount: toolResults.filter(r => r.success).length
            });
            
            return {
              toolResults,
              nodeId
            };
          } catch (error) {
            // Complete node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            return {
              toolResults: [],
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        dependency: ['tool_selection']
      },
      {
        name: 'response_generation',
        processor: async (request: {
          message: string;
          context: ExtendedRequestContext;
          requestId: string;
          thinkingResults: { thinking: ThinkingResult; nodeId: string };
          memoryResults: { memories: any[]; nodeId: string };
          toolExecutionResults: { toolResults: any[]; nodeId: string };
        }) => {
          // Skip if thinking returned no results
          if (!request.thinkingResults?.thinking) {
            return { response: 'I apologize, but I encountered an error while processing your request.' };
          }
          
          // Initialize response generation node
          const nodeId = this.visualizer.addNode(
            request.requestId,
            VisualizationNodeType.RESPONSE_GENERATION,
            'Generating Response',
            { stage: 'start' }
          );
          
          try {
            // Generate response - using a simulated approach since we don't have access to the real implementation
            // In a real implementation, this would call UnifiedAgentService.generateResponse
            const response = `This is a simulated response to the query: "${request.message}". In a real implementation, this would use the thinking result to generate a proper response.`;
            
            // Complete node with response
            this.visualizer.completeNode(request.requestId, nodeId, {
              stage: 'complete',
              responseLength: response.length
            });
            
            return {
              response,
              nodeId
            };
          } catch (error) {
            // Complete node with error
            this.visualizer.completeNode(
              request.requestId,
              nodeId,
              { stage: 'error' },
              error instanceof Error ? error : new Error(String(error))
            );
            
            return {
              response: 'I apologize, but I encountered an error while generating a response to your request.',
              nodeId,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        dependency: ['thinking', 'memory_retrieval', 'tool_execution']
      }
    ];
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
    let visualizationId: string | null = null;
    if (this.visualizationEnabled) {
      visualizationId = this.visualizer.initializeVisualization(
        requestId, 
        this.getUserIdString(context.userId), 
        message
      );
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
      
      // Finalize visualization if enabled
      if (this.visualizationEnabled) {
        this.visualizer.finalizeVisualization(requestId, response);
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
      // Handle visualization if enabled
      if (this.visualizationEnabled) {
        this.visualizer.handleError(
          requestId, 
          error instanceof Error ? error : new Error(String(error))
        );
      }
      
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
    // Build a dependency graph
    const dependencyGraph = new Map<string, string[]>();
    const processors = new Map<string, (request: any) => Promise<any>>();
    
    // Initialize the graph and processors
    for (const processor of this.parallelProcessors) {
      dependencyGraph.set(processor.name, processor.dependency || []);
      processors.set(processor.name, processor.processor);
    }
    
    // Determine processing order (simplified topological sort)
    const processed = new Set<string>();
    const results = new Map<string, any>();
    
    // Initial request data
    const requestData: Record<string, any> = {
      message,
      context,
      requestId
    };
    
    // Keep processing until all processors are executed
    while (processed.size < this.parallelProcessors.length) {
      let progress = false;
      
      // Find processors whose dependencies are satisfied
      for (const processor of this.parallelProcessors) {
        if (processed.has(processor.name)) continue;
        
        const dependencies = dependencyGraph.get(processor.name) || [];
        const dependenciesSatisfied = dependencies.every(dep => processed.has(dep));
        
        if (dependenciesSatisfied) {
          // Execute this processor
          const processorFn = processors.get(processor.name)!;
          
          // Gather inputs from dependencies
          const processorInput = { ...requestData };
          for (const dep of dependencies) {
            processorInput[`${dep}Results`] = results.get(dep);
          }
          
          // Execute and store results
          results.set(processor.name, await processorFn(processorInput));
          processed.add(processor.name);
          progress = true;
        }
      }
      
      // If no progress in this iteration, we have a cycle
      if (!progress && processed.size < this.parallelProcessors.length) {
        throw new Error('Dependency cycle detected in parallel processors');
      }
    }
    
    // Combine results to form final response
    return this.combineParallelResults(results, message, context, requestId);
  }

  /**
   * Combines the results from parallel processing
   * 
   * @param results The results from parallel processing
   * @param message The original message
   * @param context The request context
   * @param requestId The request ID
   * @returns The combined response
   */
  private combineParallelResults(
    results: Map<string, any>,
    message: string,
    context: ExtendedRequestContext,
    requestId: string
  ): Promise<UnifiedAgentResponse> {
    // Extract key results
    const thinking = results.get('thinking')?.thinking;
    const toolResults = results.get('tool_execution')?.toolResults || [];
    const responseResult = results.get('response_generation');
    const delegationResult = results.get('delegation_decision');
    
    // Build the response
    const response: UnifiedAgentResponse = {
      id: requestId,
      response: responseResult?.response || 'I apologize, but I was unable to process your request.',
      thinking: thinking,
      toolsUsed: toolResults.length > 0 ? toolResults : undefined,
      delegation: delegationResult?.delegate ? {
        delegated: true,
        agentId: delegationResult.agentId,
        agentName: delegationResult.agentName,
        taskId: delegationResult.taskId
      } : undefined,
      metrics: {
        totalTime: Date.now() - (context.options?.startTime || Date.now()),
        thinkingTime: 0,
        retrievalTime: 0,
        toolExecutionTime: 0,
        llmTime: 0
      }
    };
    
    return Promise.resolve(response);
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
   * Generates a visualization of the thinking process
   * 
   * @param requestId The request ID
   * @param response The response
   * @returns The visualization ID
   */
  private generateVisualization(requestId: string, response: UnifiedAgentResponse): string | null {
    // This is now handled by the ThinkingVisualizer
    return requestId;
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
   * Gets visualization data for a request
   * 
   * @param requestId The request ID
   * @returns The visualization data
   */
  getVisualizationForRequest(requestId: string): ThinkingVisualization | null {
    return this.visualizer.getVisualization(requestId);
  }

  /**
   * Gets all visualizations
   * 
   * @returns All visualizations
   */
  getAllVisualizations(): ThinkingVisualization[] {
    return this.visualizer.getAllVisualizations();
  }
} 