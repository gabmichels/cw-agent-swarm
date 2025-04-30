import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry } from './registry';
import { ToolCreationSystem } from './integration';
import { ToolAdaptation, ToolUsageStats, ToolExecutionResult } from './adaptation';
import { ToolEvaluation, ABTest, ToolFeedback, PerformanceAnalysis } from './evaluation';
import { StrategicToolPlanner, MarketTrend, BusinessImpact, PrioritizedTool } from './strategic';
import { MarketScanner } from './marketScanner';
import { StructuredTool } from '@langchain/core/tools';
import { ReflectionType } from '../../../constants/reflection';

/**
 * Configuration options for the ToolManagementSystem
 */
export interface ToolManagementConfig {
  model: ChatOpenAI;
  toolsDir?: string;
  metadataDir?: string;
  developmentCapacity?: number;
  adaptationEnabled?: boolean;
  evaluationEnabled?: boolean;
  strategicPlanningEnabled?: boolean;
  autoOptimizationEnabled?: boolean;
}

/**
 * Simplified result of a tool execution for reporting
 */
export interface ToolExecutionSummary {
  toolName: string;
  success: boolean;
  executionTime: number;
  errorMessage?: string;
  optimized?: boolean;
  parameters: Record<string, any>;
}

/**
 * The ToolManagementSystem integrates all tool-related components:
 * - Tool Registry (discovery and management)
 * - Tool Creation (synthesis and generation)
 * - Tool Adaptation (optimization and customization)
 * - Tool Evaluation (testing and performance analysis)
 * - Strategic Planning (market alignment and prioritization)
 */
export class ToolManagementSystem {
  private registry: ToolRegistry;
  private creation: ToolCreationSystem;
  private adaptation: ToolAdaptation;
  private evaluation: ToolEvaluation;
  private strategic: StrategicToolPlanner;
  private marketScanner: MarketScanner;
  private model: ChatOpenAI;
  
  private config: ToolManagementConfig;
  private isInitialized: boolean = false;
  
  constructor(agent: any, config: ToolManagementConfig) {
    this.config = {
      ...config,
      toolsDir: config.toolsDir || 'src/agents/chloe/tools',
      metadataDir: config.metadataDir || 'data/tool-metadata',
      developmentCapacity: config.developmentCapacity || 100,
      adaptationEnabled: config.adaptationEnabled !== false,
      evaluationEnabled: config.evaluationEnabled !== false,
      strategicPlanningEnabled: config.strategicPlanningEnabled !== false,
      autoOptimizationEnabled: config.autoOptimizationEnabled !== false
    };
    
    this.model = config.model;
    
    // Initialize registry
    this.registry = new ToolRegistry({
      model: this.model,
      toolsDir: this.config.toolsDir,
      metadataDir: this.config.metadataDir
    });
    
    // Initialize creation system
    this.creation = new ToolCreationSystem(agent);
    
    // Initialize market scanner
    this.marketScanner = new MarketScanner();
    
    // Initialize adaptation layer
    this.adaptation = new ToolAdaptation(this.registry, this.model);
    
    // Initialize evaluation framework
    this.evaluation = new ToolEvaluation(this.registry, this.adaptation, this.model);
    
    // Initialize strategic planner
    this.strategic = new StrategicToolPlanner(
      this.registry,
      this.adaptation,
      this.evaluation,
      this.creation,
      this.marketScanner,
      this.model
    );
    
    // Set developer capacity
    this.strategic.setDeveloperCapacity(this.config.developmentCapacity!);
  }
  
  /**
   * Initialize the tool management system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    console.log('Initializing Tool Management System...');
    
    // Initialize components in sequence
    await this.registry.initialize(this.model);
    console.log('Tool Registry initialized');
    
    // Only initialize strategic components if enabled
    if (this.config.strategicPlanningEnabled) {
      await this.strategic.initialize();
      console.log('Strategic Tool Planner initialized');
    }
    
    this.isInitialized = true;
    console.log('Tool Management System initialized successfully');
  }
  
  /**
   * Execute a tool with optimization and tracking
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    options: {
      abTestId?: string;
      trackExecution?: boolean;
      optimizeParameters?: boolean;
      executionId?: string;
    } = {}
  ): Promise<any> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const trackExecution = options.trackExecution !== false;
    
    // Get the tool
    let resolvedToolName = toolName;
    const startTime = Date.now();
    let optimized = false;
    
    // Check if this is part of an A/B test
    if (options.abTestId && this.config.evaluationEnabled) {
      const variantToolName = this.evaluation.selectToolVariant(options.abTestId);
      if (variantToolName) {
        resolvedToolName = variantToolName;
      }
    }
    
    // Get the tool from registry
    const toolInfo = this.registry.getTool(resolvedToolName);
    if (!toolInfo || !toolInfo.tool) {
      throw new Error(`Tool ${resolvedToolName} not found`);
    }
    
    // Optimize parameters if enabled
    let executionParameters = { ...parameters };
    if (this.config.adaptationEnabled && options.optimizeParameters !== false) {
      try {
        const optimizedParams = await this.adaptation.optimizeParameters(
          resolvedToolName,
          parameters
        );
        executionParameters = optimizedParams;
        optimized = true;
      } catch (error) {
        console.error(`Error optimizing parameters for ${resolvedToolName}:`, error);
        // Fall back to original parameters
      }
    }
    
    // Execute the tool
    try {
      // Directly invoke the tool (no Langchain wrapper)
      const result = await this.invokeTool(toolInfo.tool, executionParameters);
      
      const executionTime = Date.now() - startTime;
      
      // Record the execution if tracking is enabled
      if (trackExecution) {
        const executionResult: ToolExecutionResult = {
          success: true,
          result,
          executionTime,
          parameters: executionParameters
        };
        
        // Record in adaptation system
        if (this.config.adaptationEnabled) {
          this.adaptation.recordExecution(resolvedToolName, executionResult);
        }
        
        // Record for A/B test if applicable
        if (options.abTestId && this.config.evaluationEnabled) {
          this.evaluation.recordTestExecution(options.abTestId, resolvedToolName, executionResult);
        }
      }
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Record the failed execution if tracking is enabled
      if (trackExecution) {
        const executionResult: ToolExecutionResult = {
          success: false,
          result: null,
          executionTime,
          error: errorMessage,
          parameters: executionParameters
        };
        
        // Record in adaptation system
        if (this.config.adaptationEnabled) {
          this.adaptation.recordExecution(resolvedToolName, executionResult);
        }
        
        // Record for A/B test if applicable
        if (options.abTestId && this.config.evaluationEnabled) {
          this.evaluation.recordTestExecution(options.abTestId, resolvedToolName, executionResult);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Create a new tool from description
   */
  async createTool(description: string): Promise<any> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Create the tool
    const result = await this.creation.createToolFromDescription(description);
    
    // If strategic planning is enabled, analyze the new tool
    if (result && result.success && this.config.strategicPlanningEnabled) {
      const toolName = result.tool.name;
      
      // Assess business impact
      this.strategic.assessBusinessImpact(toolName).catch(error => {
        console.error(`Error assessing business impact for ${toolName}:`, error);
      });
    }
    
    return result;
  }
  
  /**
   * Create a variant of an existing tool for A/B testing
   */
  async createToolVariant(
    originalToolName: string,
    variantName: string,
    modifications: {
      description?: string;
      parameters?: Record<string, any>;
      implementation?: string;
    }
  ): Promise<StructuredTool | null> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.evaluationEnabled) {
      console.warn('Tool Evaluation is disabled, cannot create variant');
      return null;
    }
    
    return this.evaluation.createToolVariant(originalToolName, variantName, modifications);
  }
  
  /**
   * Set up an A/B test between two tool variants
   */
  async setupABTest(
    name: string,
    description: string,
    toolA: string,
    toolB: string,
    distribution: number = 0.5
  ): Promise<ABTest | null> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.evaluationEnabled) {
      console.warn('Tool Evaluation is disabled, cannot set up A/B test');
      return null;
    }
    
    return this.evaluation.createABTest(name, description, toolA, toolB, distribution);
  }
  
  /**
   * Complete an A/B test and get results
   */
  async completeABTest(testId: string): Promise<ABTest | null> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.evaluationEnabled) {
      console.warn('Tool Evaluation is disabled, cannot complete A/B test');
      return null;
    }
    
    return this.evaluation.completeABTest(testId);
  }
  
  /**
   * Record user feedback for a tool execution
   */
  async recordToolFeedback(feedback: ToolFeedback): Promise<void> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.evaluationEnabled) {
      console.warn('Tool Evaluation is disabled, feedback not recorded');
      return;
    }
    
    this.evaluation.recordFeedback(feedback);
  }
  
  /**
   * Get performance analysis for a tool
   */
  async getToolAnalysis(
    toolName: string,
    period: 'day' | 'week' | 'month' | 'all' = 'week'
  ): Promise<PerformanceAnalysis | null> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.evaluationEnabled) {
      console.warn('Tool Evaluation is disabled, cannot get tool analysis');
      return null;
    }
    
    // Convert string period to ReflectionType enum
    let reflectionPeriod: ReflectionType;
    
    switch(period) {
      case 'day':
        reflectionPeriod = ReflectionType.DAILY;
        break;
      case 'week':
        reflectionPeriod = ReflectionType.WEEKLY;
        break;
      case 'month':
        reflectionPeriod = ReflectionType.MONTHLY;
        break;
      case 'all':
      default:
        reflectionPeriod = ReflectionType.ALL;
        break;
    }
    
    return this.evaluation.analyzeToolPerformance(toolName, reflectionPeriod);
  }
  
  /**
   * Get business impact assessment for a tool
   */
  async getBusinessImpact(toolName: string): Promise<BusinessImpact | null> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot get business impact');
      return null;
    }
    
    return this.strategic.getBusinessImpact(toolName);
  }
  
  /**
   * Get market trends from the scanner
   */
  async getMarketTrends(): Promise<MarketTrend[]> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot get market trends');
      return [];
    }
    
    return this.strategic.getMarketTrends();
  }
  
  /**
   * Refresh market trends from sources
   */
  async refreshMarketTrends(): Promise<MarketTrend[]> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot refresh market trends');
      return [];
    }
    
    return this.strategic.refreshMarketTrends();
  }
  
  /**
   * Generate new tool ideas based on market trends
   */
  async generateToolIdeas(
    trendLimit: number = 3,
    ideasPerTrend: number = 2
  ): Promise<Array<{trend: MarketTrend; ideas: string[]}>> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot generate tool ideas');
      return [];
    }
    
    return this.strategic.generateToolIdeasFromTrends(trendLimit, ideasPerTrend);
  }
  
  /**
   * Create prioritized tool development framework
   */
  async prioritizeToolDevelopment(): Promise<PrioritizedTool[]> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot prioritize tool development');
      return [];
    }
    
    return this.strategic.createPrioritizationFramework();
  }
  
  /**
   * Allocate development capacity to tools
   */
  async allocateDevelopmentCapacity(
    capacity?: number
  ): Promise<{
    allocations: Array<{tool: string; allocation: number}>;
    remainingCapacity: number;
  }> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot allocate development capacity');
      return { allocations: [], remainingCapacity: capacity || 0 };
    }
    
    return this.strategic.allocateDevelopmentCapacity(capacity);
  }
  
  /**
   * Execute the prioritized tool creation plan
   */
  async executeToolCreationPlan(): Promise<{
    created: string[];
    failed: string[];
  }> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      console.warn('Strategic Planning is disabled, cannot execute tool creation plan');
      return { created: [], failed: [] };
    }
    
    return this.strategic.executeToolCreationPlan();
  }
  
  /**
   * Generate strategic report on tool development
   */
  async generateStrategicReport(): Promise<string> {
    // Ensure the system is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.config.strategicPlanningEnabled) {
      return 'Strategic Planning is disabled, cannot generate strategic report';
    }
    
    return this.strategic.generateStrategicReport();
  }
  
  /**
   * Get tool usage statistics
   */
  getToolStatistics(toolName: string): ToolUsageStats | null {
    if (!this.config.adaptationEnabled) {
      console.warn('Tool Adaptation is disabled, cannot get tool statistics');
      return null;
    }
    
    return this.adaptation.getToolStatistics(toolName);
  }
  
  /**
   * Get all tools from registry
   */
  getAllTools(): any[] {
    return this.registry.getAllTools();
  }
  
  /**
   * Get a specific tool from registry
   */
  getTool(toolName: string): any {
    return this.registry.getTool(toolName);
  }
  
  /**
   * Suggest improvements for a tool based on usage statistics
   */
  async suggestToolImprovements(toolName: string): Promise<string> {
    if (!this.config.adaptationEnabled) {
      return 'Tool Adaptation is disabled, cannot suggest improvements';
    }
    
    return this.adaptation.suggestToolImprovements(toolName);
  }
  
  /**
   * Find similar tools based on usage patterns
   */
  findSimilarTools(toolName: string, minSimilarity: number = 0.7): string[] {
    if (!this.config.adaptationEnabled) {
      console.warn('Tool Adaptation is disabled, cannot find similar tools');
      return [];
    }
    
    return this.adaptation.findSimilarTools(toolName, minSimilarity);
  }
  
  /**
   * Adapt a tool for a new use case
   */
  async adaptToolForNewUseCase(
    originalToolName: string,
    newUseCase: string,
    newParameters: string[] = []
  ): Promise<StructuredTool | null> {
    if (!this.config.adaptationEnabled) {
      console.warn('Tool Adaptation is disabled, cannot adapt tool');
      return null;
    }
    
    return this.adaptation.adaptToolForNewUseCase(
      originalToolName,
      newUseCase,
      newParameters
    );
  }
  
  /**
   * Helper method to invoke a tool with parameters
   */
  private async invokeTool(tool: any, parameters: Record<string, any>): Promise<any> {
    // Different tools have different invocation patterns
    // Try to handle the most common ones
    
    if (typeof tool.invoke === 'function') {
      // LangChain v0.2+ tools use invoke
      return tool.invoke(parameters);
    } else if (typeof tool._call === 'function') {
      // LangChain tools use _call internally
      return tool._call(parameters);
    } else if (typeof tool.execute === 'function') {
      // Some custom tools use execute
      return tool.execute(parameters);
    } else if (typeof tool.call === 'function') {
      // Some tools use call
      return tool.call(parameters);
    } else if (typeof tool.run === 'function') {
      // Some tools use run
      return tool.run(parameters);
    } else if (typeof tool === 'function') {
      // Function-based tools
      return tool(parameters);
    } else {
      throw new Error(`Cannot invoke tool: No supported invocation method found`);
    }
  }
  
  /**
   * Check component status
   */
  getSystemStatus(): Record<string, boolean> {
    return {
      initialized: this.isInitialized,
      adaptationEnabled: this.config.adaptationEnabled || false,
      evaluationEnabled: this.config.evaluationEnabled || false,
      strategicPlanningEnabled: this.config.strategicPlanningEnabled || false,
      autoOptimizationEnabled: this.config.autoOptimizationEnabled || false
    };
  }
} 