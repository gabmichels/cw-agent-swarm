/**
 * ResearchAgent.ts - Specialized agent for research tasks
 * 
 * A sub-agent that specializes in information gathering and research,
 * demonstrating the new multi-agent architecture.
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentBase, AgentBaseConfig, AgentCapabilityLevel } from '../shared/base/AgentBase';
import { MemoryRouter } from '../shared/memory/MemoryRouter';
import { Planner } from '../shared/planning/Planner';
import { ToolRouter } from '../shared/tools/ToolRouter';
import { Executor, ExecutionContext } from '../shared/execution/Executor';

interface ResearchAgentConfig extends AgentBaseConfig {
  researchPrompt?: string;
  defaultSources?: string[];
}

interface ResearchAgentOptions {
  config: ResearchAgentConfig;
}

/**
 * ResearchAgent - Specialized agent for research tasks
 */
export class ResearchAgent extends AgentBase {
  private memoryRouter: MemoryRouter | null = null;
  private planner: Planner | null = null;
  private toolRouter: ToolRouter | null = null;
  private executor: Executor | null = null;
  private researchPrompt: string;
  private defaultSources: string[];
  
  constructor(options: ResearchAgentOptions) {
    // Initialize with advanced capability level for research
    super({
      config: options.config,
      capabilityLevel: AgentCapabilityLevel.ADVANCED,
      toolPermissions: ['web_search', 'file_search', 'memory_search'],
      memoryScopes: ['shortTerm', 'longTerm', 'inbox', 'reflections']
    });
    
    // Set research-specific properties
    this.researchPrompt = options.config.researchPrompt || 
      "You are a research agent specialized in gathering information from various sources.";
    this.defaultSources = options.config.defaultSources || ["web", "memory", "file"];
  }
  
  /**
   * Initialize the research agent
   */
  async initialize(): Promise<void> {
    try {
      // Call parent initialization
      await super.initialize();
      
      console.log(`Initializing ResearchAgent with ID: ${this.getAgentId()}...`);
      
      // Initialize components
      this.memoryRouter = new MemoryRouter({
        defaultNamespace: 'shared',
        enableSharedMemory: true,
        enableAgentIsolation: true
      });
      await this.memoryRouter.initialize();
      
      // Register agent with memory router
      this.memoryRouter.registerAgent(this.getAgentId(), ['shared', 'research']);
      
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
      
      // Register research web search tool
      this.registerResearchTool();
      
      console.log(`ResearchAgent ${this.getAgentId()} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing ResearchAgent:`, error);
      throw error;
    }
  }
  
  /**
   * Register the research tool
   */
  private registerResearchTool(): void {
    if (!this.toolRouter) return;
    
    this.toolRouter.registerTool({
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      requiredParams: ['query'],
      execute: async (params, agentContext) => {
        try {
          console.log(`ResearchAgent performing web search: ${params.query}`);
          
          // This would normally connect to a real search API
          // For now, return a placeholder result
          
          return {
            success: true,
            data: {
              results: [
                {
                  title: `Search result for: ${params.query}`,
                  snippet: `This is a simulated search result for the query: ${params.query}`,
                  url: 'https://example.com/search/result'
                }
              ]
            },
            message: `Found information about ${params.query}`
          };
        } catch (error) {
          return {
            success: false,
            error: `Error performing web search: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      },
      category: 'research',
      requiredCapabilityLevel: AgentCapabilityLevel.STANDARD
    });
    
    // Set tool permissions for this agent
    this.toolRouter.setAgentToolPermissions(this.getAgentId(), ['web_search']);
  }
  
  /**
   * Process a research task
   */
  async processMessage(message: string, options: any = {}): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`ResearchAgent ${this.getAgentId()} processing research task: ${message.substring(0, 50)}...`);
      
      // Store the research query in memory
      await this.memoryRouter?.addMemory(
        this.getAgentId(),
        'research',
        message,
        'research_query',
        {
          importance: 'medium',
          source: 'user',
          tags: ['research', 'query']
        }
      );
      
      // Handle research task directly
      // In a real implementation, this would use the search tool via the executor
      
      return `As a specialized research agent, I've analyzed your query: "${message}"\n\nI would normally search for information using my web_search tool and return relevant findings. This demonstrates how a specialized sub-agent handles tasks delegated by the coordinator.`;
    } catch (error) {
      console.error(`Error processing research task:`, error);
      return `I encountered an error while researching: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Plan and execute a research task
   */
  async planAndExecute(goal: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`ResearchAgent ${this.getAgentId()} planning task: ${goal.substring(0, 50)}...`);
      
      // Create a plan using the static Planner.plan method
      const planResult = await Planner.plan({
        agentId: this.getAgentId(),
        goal,
        tags: options.tags || [],
        additionalContext: {
          maxSteps: options.maxSteps || 5,
          includeReasoning: true,
          context: [this.researchPrompt]
        }
      });
      
      // Store the plan in memory
      await this.memoryRouter?.addMemory(
        this.getAgentId(),
        'research',
        `Research Plan: ${planResult.title}\n\n${planResult.steps.map(s => `- ${s.description}`).join('\n')}`,
        'research_plan',
        {
          importance: 'medium',
          source: 'agent',
          tags: ['research', 'plan']
        }
      );
      
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
   * Shutdown the research agent
   */
  async shutdown(): Promise<void> {
    try {
      // Shutdown all systems in reverse order
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
      
      console.log(`ResearchAgent ${this.getAgentId()} shutdown complete`);
    } catch (error) {
      console.error(`Error during ResearchAgent shutdown:`, error);
      throw error;
    }
  }
} 