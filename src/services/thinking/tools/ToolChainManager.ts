import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';
import { Tool, ToolExecutionResult } from './ToolService';

/**
 * A step in a tool chain
 */
export interface ChainStep {
  id: string;
  toolId: string;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  transformations: Array<{
    from: string;
    to: string;
    transformation: string;
  }>;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

/**
 * A tool chain definition
 */
export interface ToolChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    author: string;
  };
}

/**
 * Result of a tool chain execution
 */
export interface ChainExecutionResult {
  chainId: string;
  success: boolean;
  results: Record<string, ToolExecutionResult>;
  error?: string;
  duration: number;
  stepOrder: string[];
}

/**
 * Service for managing tool chains
 */
export class ToolChainManager {
  private llm: ChatOpenAI;
  private chains: Map<string, ToolChain> = new Map();
  private toolService: any; // Reference to ToolService
  
  constructor(toolService: any) {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4.1-2025-04-14",
      temperature: 0.2
    });
    this.toolService = toolService;
  }
  
  /**
   * Create a new tool chain using LLM planning
   */
  async createChain(
    goal: string,
    availableTools: Tool[],
    context?: string
  ): Promise<ToolChain> {
    try {
      // Build planning prompt
      const systemPrompt = `You are an AI assistant that creates tool chains to accomplish complex tasks.
Your task is to analyze the goal and create a sequence of tool executions that will achieve it.

Available tools:
${availableTools.map(tool => `
${tool.name}:
- Description: ${tool.description}
- Parameters: ${Object.entries(tool.parameters).map(([name, type]) => `${name}: ${type}`).join(', ')}
- Returns: ${tool.returns}
`).join('\n')}

For each step in the chain, specify:
1. Which tool to use
2. Required parameters
3. Dependencies on previous steps
4. Any needed transformations of data between steps

Respond in JSON format:
{
  "name": "Chain name",
  "description": "Detailed description of what this chain does",
  "steps": [
    {
      "toolId": "tool_name",
      "parameters": {
        "param1": "value1"
      },
      "dependsOn": ["step_id"],
      "transformations": [
        {
          "from": "previous_step.output.field",
          "to": "current_param",
          "transformation": "transformation logic"
        }
      ]
    }
  ]
}`;

      // Call LLM for chain planning
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Create a tool chain for this goal: "${goal}"
${context ? `\nAdditional context: ${context}` : ''}`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid chain planning response format');
      }
      
      const planData = JSON.parse(jsonMatch[0]);
      
      // Create chain with generated plan
      const chain: ToolChain = {
        id: String(IdGenerator.generate('chain')),
        name: planData.name,
        description: planData.description,
        steps: planData.steps.map((step: any, index: number) => ({
          id: String(IdGenerator.generate('step')),
          toolId: step.toolId,
          parameters: step.parameters,
          dependsOn: step.dependsOn || [],
          transformations: step.transformations || [],
          retryConfig: {
            maxRetries: 3,
            backoffMs: 1000
          }
        })),
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          author: 'system'
        }
      };
      
      // Validate chain
      await this.validateChain(chain, availableTools);
      
      // Store chain
      this.chains.set(chain.id, chain);
      
      return chain;
      
    } catch (error) {
      console.error('Error creating tool chain:', error);
      throw error;
    }
  }
  
  /**
   * Execute a tool chain
   */
  async executeChain(
    chainId: string,
    initialParameters: Record<string, unknown> = {}
  ): Promise<ChainExecutionResult> {
    try {
      const chain = this.chains.get(chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not found`);
      }
      
      const startTime = Date.now();
      const results: Record<string, ToolExecutionResult> = {};
      const stepOrder: string[] = [];
      
      // Build execution graph
      const graph = this.buildExecutionGraph(chain);
      
      // Execute steps in order
      for (const step of graph) {
        try {
          // Prepare parameters with transformations
          const parameters = await this.prepareStepParameters(
            step,
            initialParameters,
            results
          );
          
          // Execute tool with retry logic
          const result = await this.executeStepWithRetry(step, parameters);
          
          // Store result
          results[step.id] = result;
          stepOrder.push(step.id);
          
        } catch (error) {
          const stepError = error instanceof Error ? error : new Error(String(error));
          console.error(`Error executing step ${step.id}:`, stepError);
          return {
            chainId,
            success: false,
            results,
            error: `Error in step ${step.id}: ${stepError.message}`,
            duration: Date.now() - startTime,
            stepOrder
          };
        }
      }
      
      return {
        chainId,
        success: true,
        results,
        duration: Date.now() - startTime,
        stepOrder
      };
      
    } catch (error) {
      console.error('Error executing tool chain:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  
  /**
   * Validate a tool chain
   */
  private async validateChain(
    chain: ToolChain,
    availableTools: Tool[]
  ): Promise<void> {
    // Check that all tools exist
    for (const step of chain.steps) {
      const tool = availableTools.find(t => t.name === step.toolId);
      if (!tool) {
        throw new Error(`Tool ${step.toolId} not found`);
      }
      
      // Check parameter types
      for (const [param, value] of Object.entries(step.parameters)) {
        if (!(param in tool.parameters)) {
          throw new Error(`Invalid parameter ${param} for tool ${step.toolId}`);
        }
      }
      
      // Check dependencies exist
      for (const dep of step.dependsOn) {
        if (!chain.steps.find(s => s.id === dep)) {
          throw new Error(`Dependency ${dep} not found`);
        }
      }
    }
    
    // Check for cycles
    const graph = this.buildExecutionGraph(chain);
    if (graph.length !== chain.steps.length) {
      throw new Error('Circular dependencies detected in chain');
    }
  }
  
  /**
   * Build execution graph (topological sort)
   */
  private buildExecutionGraph(chain: ToolChain): ChainStep[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const graph: ChainStep[] = [];
    
    const visit = (stepId: string) => {
      if (temp.has(stepId)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(stepId)) {
        return;
      }
      
      temp.add(stepId);
      
      const step = chain.steps.find(s => s.id === stepId)!;
      for (const dep of step.dependsOn) {
        visit(dep);
      }
      
      temp.delete(stepId);
      visited.add(stepId);
      graph.push(step);
    };
    
    for (const step of chain.steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }
    
    return graph;
  }
  
  /**
   * Prepare parameters for a step
   */
  private async prepareStepParameters(
    step: ChainStep,
    initialParameters: Record<string, unknown>,
    previousResults: Record<string, ToolExecutionResult>
  ): Promise<Record<string, unknown>> {
    const parameters = { ...step.parameters };
    
    // Apply transformations
    for (const transform of step.transformations) {
      const [stepId, ...path] = transform.from.split('.');
      let value: unknown = stepId === 'input' ? 
        initialParameters[path[0]] :
        previousResults[stepId].output;
      
      // Navigate path
      for (let i = stepId === 'input' ? 1 : 0; i < path.length; i++) {
        value = (value as Record<string, unknown>)[path[i]];
      }
      
      // Transform value if needed
      if (transform.transformation !== 'direct') {
        value = await this.transformValue(value, transform.transformation);
      }
      
      parameters[transform.to] = value;
    }
    
    return parameters;
  }
  
  /**
   * Transform a value using LLM if needed
   */
  private async transformValue(
    value: unknown,
    transformation: string
  ): Promise<unknown> {
    if (transformation === 'direct') {
      return value;
    }
    
    // Use LLM for complex transformations
    const messages = [
      new SystemMessage(`You are an AI assistant that transforms data.
Transform the input value according to this logic: ${transformation}

Input value:
${JSON.stringify(value, null, 2)}

Respond with the transformed value in JSON format.`),
      new HumanMessage('Transform the value.')
    ];
    
    // @ts-ignore - LangChain types may not be up to date
    const response = await this.llm.call(messages);
    
    // Parse response
    const responseContent = response.content.toString();
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid transformation response format');
    }
    
    return JSON.parse(jsonMatch[0]);
  }
  
  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry(
    step: ChainStep,
    parameters: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const { maxRetries, backoffMs } = step.retryConfig || { maxRetries: 3, backoffMs: 1000 };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute tool
        return await this.toolService.executeTool(step.toolId, parameters);
      } catch (error) {
        const typedError = error instanceof Error ? error : new Error(String(error));
        lastError = typedError;
        if (attempt < maxRetries) {
          // Wait with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, backoffMs * Math.pow(2, attempt))
          );
          continue;
        }
      }
    }
    
    throw lastError || new Error(`Failed to execute step ${step.id} after ${maxRetries} retries`);
  }
} 