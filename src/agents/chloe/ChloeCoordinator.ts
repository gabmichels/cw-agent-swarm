/**
 * ChloeCoordinator.ts - Chloe implementation using the new multi-agent architecture
 * 
 * This module refactors Chloe into a coordinator agent that can:
 * - Delegate tasks to sub-agents
 * - Maintain Chloe's existing persona and capabilities
 * - Work with the new shared architecture
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentBase, AgentBaseConfig, AgentCapabilityLevel } from '../shared/base/AgentBase';
import { AgentCoordinator, DelegationRequest } from '../shared/coordination/AgentCoordinator';
import { MemoryRouter } from '../shared/memory/MemoryRouter';
import { Planner } from '../shared/planning/Planner';
import { ToolRouter } from '../shared/tools/ToolRouter';
import { Executor, ExecutionContext } from '../shared/execution/Executor';

interface ChloeCoordinatorConfig extends AgentBaseConfig {
  coordinatorPrompt?: string;
  personaPath?: string;
}

interface ChloeCoordinatorOptions {
  config: ChloeCoordinatorConfig;
}

/**
 * ChloeCoordinator - Refactored Chloe as a multi-agent coordinator
 */
export class ChloeCoordinator extends AgentBase {
  private coordinator: AgentCoordinator | null = null;
  private memoryRouter: MemoryRouter | null = null;
  private planner: Planner | null = null;
  private toolRouter: ToolRouter | null = null;
  private executor: Executor | null = null;
  private coordinatorPrompt: string;
  private personaPath: string;
  
  constructor(options: ChloeCoordinatorOptions) {
    // Initialize with coordinator capability level
    super({
      config: options.config,
      capabilityLevel: AgentCapabilityLevel.COORDINATOR,
      toolPermissions: ['*'] // Chloe has access to all tools as coordinator
    });
    
    // Set Chloe-specific properties
    this.coordinatorPrompt = options.config.coordinatorPrompt || 
      "You are Chloe, a coordinator agent who delegates tasks to specialized sub-agents.";
    this.personaPath = options.config.personaPath || 'default';
  }
  
  /**
   * Initialize Chloe with all required systems
   */
  async initialize(): Promise<boolean> {
    try {
      // Call parent initialization
      const parentInitSuccess = await super.initialize();
      
      if (!parentInitSuccess) {
        console.error(`Parent initialization failed for ChloeCoordinator ${this.getAgentId()}`);
        return false;
      }
      
      console.log(`Initializing ChloeCoordinator with ID: ${this.getAgentId()}...`);
      
      // Initialize coordinator components
      this.memoryRouter = new MemoryRouter({
        defaultNamespace: 'shared',
        enableSharedMemory: true,
        enableAgentIsolation: true
      });
      await this.memoryRouter.initialize();
      
      // Register Chloe with memory router
      this.memoryRouter.registerAgent(this.getAgentId(), ['shared', 'chloe']);
      
      // Initialize tool router
      this.toolRouter = new ToolRouter({
        accessOptions: {
          enforceCapabilityLevel: true,
          allowAccessToHigherCapability: false,
          trackToolUsage: true
        }
      });
      await this.toolRouter.initialize();
      
      // Initialize model if not already done
      if (!this.model) {
        this.model = new ChatOpenAI({
          modelName: this.config.model || 'gpt-4',
          temperature: this.config.temperature || 0.7
        });
      }
      
      // Initialize planner
      this.planner = new Planner();
      
      // Initialize executor
      this.executor = new Executor(this.model, this.toolRouter);
      await this.executor.initialize();
      
      // Initialize coordinator last
      this.coordinator = new AgentCoordinator({
        defaultAgentId: this.getAgentId(),
        enableLoadBalancing: true,
        enableReliabilityTracking: true
      });
      await this.coordinator.initialize();
      
      console.log(`ChloeCoordinator ${this.getAgentId()} initialized successfully`);
      return true;
    } catch (error) {
      console.error(`Error initializing ChloeCoordinator:`, error);
      return false;
    }
  }
  
  /**
   * Process a message using Chloe's coordination capabilities
   */
  async processMessage(message: string, options: any = {}): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`ChloeCoordinator ${this.getAgentId()} processing message: ${message.substring(0, 50)}...`);
      
      // Analyze the message to determine if it should be delegated
      const shouldDelegate = await this.shouldDelegateTask(message);
      
      if (shouldDelegate.delegate) {
        // Delegate the task to a sub-agent
        const delegationRequest: DelegationRequest = {
          taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          goal: message,
          requiredCapabilities: shouldDelegate.requiredCapabilities,
          requestingAgentId: this.getAgentId(),
          context: options
        };
        
        console.log(`Delegating task to sub-agent with capabilities: ${shouldDelegate.requiredCapabilities?.join(', ')}`);
        const delegationResult = await this.coordinator!.delegateTask(delegationRequest);
        
        if (delegationResult.status === 'accepted') {
          return `I've assigned this task to a specialized agent with expertise in this area. I'll let you know when it's complete. Task ID: ${delegationResult.taskId}`;
        } else {
          // Fall back to handling it directly
          console.log(`Delegation failed, handling task directly: ${delegationResult.error}`);
        }
      }
      
      // If not delegated or delegation failed, handle directly
      return `As Chloe, I'll handle this directly: "${message}"\n\nThis would normally be processed using my planning and execution systems.`;
    } catch (error) {
      console.error(`Error processing message:`, error);
      return `I encountered an error while processing your message: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Plan and execute a task with proper delegation
   */
  async planAndExecute(goal: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`ChloeCoordinator ${this.getAgentId()} planning task: ${goal.substring(0, 50)}...`);
      
      // Determine if this should be delegated
      const shouldDelegate = await this.shouldDelegateTask(goal);
      
      if (shouldDelegate.delegate && this.coordinator) {
        // Delegate the task
        const delegationRequest: DelegationRequest = {
          taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          goal,
          requiredCapabilities: shouldDelegate.requiredCapabilities,
          requestingAgentId: this.getAgentId(),
          context: options
        };
        
        return await this.coordinator.delegateTask(delegationRequest);
      }
      
      // Otherwise, handle it directly
      // Create a plan
      const planResult = await Planner.plan({
        agentId: this.getAgentId(),
        goal,
        tags: options.tags || [],
        additionalContext: {
          maxSteps: options.maxSteps || 5,
          includeReasoning: true,
          context: [this.coordinatorPrompt]
        }
      });
      
      // Execute the plan
      const executionContext: ExecutionContext = {
        agentId: this.getAgentId(),
        sessionId: options.sessionId || `session_${Date.now()}`,
        variables: options
      };
      
      const executionResult = await this.executor!.executePlan(
        planResult,
        executionContext,
        {
          stopOnError: options.stopOnError || false,
          autonomyLevel: options.autonomyLevel || 0.7
        }
      );
      
      return executionResult;
    } catch (error) {
      console.error(`Error in planAndExecute:`, error);
      throw error;
    }
  }
  
  /**
   * Determine if a task should be delegated and what capabilities are needed
   */
  private async shouldDelegateTask(task: string): Promise<{
    delegate: boolean;
    requiredCapabilities?: string[];
    reason?: string;
  }> {
    // This would normally use an LLM to analyze the task
    // For now, we're using a simple rule-based approach
    
    // Check for research tasks
    if (task.toLowerCase().includes('research') || 
        task.toLowerCase().includes('find information') ||
        task.toLowerCase().includes('look up')) {
      return {
        delegate: true,
        requiredCapabilities: ['research'],
        reason: 'This is a research task better suited for a specialized research agent'
      };
    }
    
    // Check for content creation tasks
    if (task.toLowerCase().includes('write') || 
        task.toLowerCase().includes('create content') ||
        task.toLowerCase().includes('article')) {
      return {
        delegate: true,
        requiredCapabilities: ['content_creation'],
        reason: 'This is a content creation task better suited for a specialized writing agent'
      };
    }
    
    // For everything else, handle directly
    return {
      delegate: false,
      reason: 'This task can be handled directly by Chloe'
    };
  }
  
  /**
   * Shutdown all systems
   */
  async shutdown(): Promise<void> {
    try {
      // Shutdown all systems in reverse order
      if (this.coordinator) await this.coordinator.shutdown();
      
      // Handle optional shutdown methods
      if (this.executor && 'shutdown' in this.executor) {
        await (this.executor as any).shutdown();
      }
      
      if (this.planner && 'shutdown' in this.planner) {
        await (this.planner as any).shutdown();
      }
      
      if (this.toolRouter) await this.toolRouter.shutdown();
      if (this.memoryRouter) await this.memoryRouter.shutdown();
      
      // Call parent shutdown
      await super.shutdown();
      
      console.log(`ChloeCoordinator ${this.getAgentId()} shutdown complete`);
    } catch (error) {
      console.error(`Error during ChloeCoordinator shutdown:`, error);
      throw error;
    }
  }
  
  /**
   * Get registered sub-agents
   */
  getRegisteredAgents(): any {
    if (!this.coordinator) {
      return {};
    }
    
    return this.coordinator.getRegisteredAgents();
  }
} 