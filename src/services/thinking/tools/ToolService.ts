import { IToolService, Tool, ToolDiscoveryOptions, ToolExecutionOptions, ToolExecutionResult, ToolFeedback, ToolUsageStats } from './IToolService';
import { IdGenerator } from '@/utils/ulid';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Implementation of the ToolService
 */
export class ToolService implements IToolService {
  /**
   * Registry of available tools
   */
  private tools: Map<string, Tool> = new Map();
  
  /**
   * Tool execution handlers
   */
  private executors: Map<string, (params: Record<string, any>, context?: any) => Promise<any>> = new Map();
  
  /**
   * Tool usage history for feedback and recommendations
   */
  private toolUsage: Map<string, ToolFeedback[]> = new Map();
  
  /**
   * Intent to tool mapping for quick recommendations
   */
  private intentToolMapping: Map<string, Map<string, number>> = new Map();
  
  /**
   * LLM for tool discovery
   */
  private llm: ChatOpenAI;
  
  /**
   * Constructor
   */
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.1
    });
    
    // Register built-in tools
    this.registerBuiltInTools();
  }
  
  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // File Search Tool
    this.registerTool({
      name: 'File Search',
      description: 'Search for files based on content or metadata',
      categories: ['files', 'search'],
      requiredCapabilities: ['file_access'],
      parameters: [
        {
          name: 'query',
          description: 'Search query',
          type: 'string',
          required: true
        },
        {
          name: 'fileTypes',
          description: 'Types of files to search',
          type: 'array',
          required: false
        },
        {
          name: 'limit',
          description: 'Maximum number of results',
          type: 'number',
          required: false,
          defaultValue: 10
        }
      ],
      isEnabled: true,
      version: '1.0.0'
    });
    
    // Web Search Tool
    this.registerTool({
      name: 'Web Search',
      description: 'Search the web for information',
      categories: ['web', 'search'],
      requiredCapabilities: ['web_access'],
      parameters: [
        {
          name: 'query',
          description: 'Search query',
          type: 'string',
          required: true
        },
        {
          name: 'limit',
          description: 'Maximum number of results',
          type: 'number',
          required: false,
          defaultValue: 5
        }
      ],
      isEnabled: true,
      version: '1.0.0'
    });
    
    // Text Analysis Tool
    this.registerTool({
      name: 'Text Analysis',
      description: 'Analyze text for sentiment, entities, and key information',
      categories: ['analysis', 'nlp'],
      requiredCapabilities: ['text_analysis'],
      parameters: [
        {
          name: 'text',
          description: 'Text to analyze',
          type: 'string',
          required: true
        },
        {
          name: 'analysisTypes',
          description: 'Types of analysis to perform',
          type: 'array',
          required: false,
          defaultValue: ['sentiment', 'entities', 'keywords']
        }
      ],
      isEnabled: true,
      version: '1.0.0'
    });
    
    // Register executors for these tools
    this.executors.set('file-search', this.executeFileSearch.bind(this));
    this.executors.set('web-search', this.executeWebSearch.bind(this));
    this.executors.set('text-analysis', this.executeTextAnalysis.bind(this));
  }
  
  /**
   * Get all registered tools
   */
  async getAllTools(): Promise<Tool[]> {
    return Array.from(this.tools.values()).filter(tool => tool.isEnabled);
  }
  
  /**
   * Discover tools suitable for an intent
   */
  async discoverTools(options: ToolDiscoveryOptions): Promise<Tool[]> {
    try {
      // Try to get recommended tools based on past usage first
      if (options.intent) {
        try {
          const recommendations = await this.getRecommendedTools(options.intent);
          
          // If we have good recommendations and they meet our criteria, use them
          if (recommendations.length > 0) {
            // Filter recommendations based on provided capabilities and categories
            let filteredRecommendations = recommendations;
            
            if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
              filteredRecommendations = filteredRecommendations.filter(rec => 
                options.requiredCapabilities!.every(cap => 
                  rec.tool.requiredCapabilities.includes(cap)
                )
              );
            }
            
            if (options.categories && options.categories.length > 0) {
              filteredRecommendations = filteredRecommendations.filter(rec => 
                options.categories!.some(cat => 
                  rec.tool.categories.includes(cat)
                )
              );
            }
            
            // If we still have recommendations after filtering
            if (filteredRecommendations.length > 0) {
              // Apply limit
              const limitedRecommendations = options.limit 
                ? filteredRecommendations.slice(0, options.limit)
                : filteredRecommendations;
              
              // Extract just the tools
              return limitedRecommendations.map(rec => rec.tool);
            }
          }
        } catch (recError) {
          console.error('Error getting recommendations:', recError);
          // Fall back to normal discovery if recommendations fail
        }
      }
      
      // Proceed with normal discovery (existing code)
      // Get all tools
      const allTools = await this.getAllTools();
      
      // Apply capability filter if provided
      let filteredTools = allTools;
      if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
        filteredTools = filteredTools.filter(tool => 
          options.requiredCapabilities!.every(cap => tool.requiredCapabilities.includes(cap))
        );
      }
      
      // Apply category filter if provided
      if (options.categories && options.categories.length > 0) {
        filteredTools = filteredTools.filter(tool => 
          options.categories!.some(cat => tool.categories.includes(cat))
        );
      }
      
      // If we have a small number of tools, use LLM to rank them
      if (filteredTools.length > 0 && filteredTools.length <= 10) {
        // Use LLM to match intent to tools
        const rankedTools = await this.rankToolsForIntent(options.intent, filteredTools);
        
        // Apply limit if provided
        if (options.limit && options.limit < rankedTools.length) {
          return rankedTools.slice(0, options.limit);
        }
        
        return rankedTools;
      } 
      
      // If we have too many tools or no tools, just return the filtered list
      if (options.limit && options.limit < filteredTools.length) {
        return filteredTools.slice(0, options.limit);
      }
      
      return filteredTools;
    } catch (error) {
      console.error('Error discovering tools:', error);
      return [];
    }
  }
  
  /**
   * Use LLM to rank tools based on relevance to intent
   */
  private async rankToolsForIntent(intent: string, tools: Tool[]): Promise<Tool[]> {
    try {
      // Create system prompt
      const systemPrompt = `You are an AI assistant that can match user intents to the most relevant tools.
Given a user intent and a list of tools, return the tool IDs ranked by relevance to the intent.
Focus on matching the intent's underlying goal to the tool's purpose and capabilities.

Respond in the following JSON format only:
{
  "rankedToolIds": ["tool-id-1", "tool-id-2", "tool-id-3"]
}`;

      // Create human message with intent and tools
      const toolsDescription = tools.map(tool => `ID: ${tool.id}
Name: ${tool.name}
Description: ${tool.description}
Categories: ${tool.categories.join(', ')}
Parameters: ${tool.parameters.map(p => p.name).join(', ')}
`).join('\n\n');

      const humanMessage = `User intent: "${intent}"

Available tools:
${toolsDescription}

Rank these tools based on their relevance to the user's intent, from most relevant to least relevant.`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const rankingData = JSON.parse(jsonMatch[0]);
        
        if (rankingData.rankedToolIds && Array.isArray(rankingData.rankedToolIds)) {
          // Map IDs back to tools, maintaining order
          const toolMap = new Map<string, Tool>();
          tools.forEach(tool => toolMap.set(tool.id, tool));
          
          return rankingData.rankedToolIds
            .filter((id: string) => toolMap.has(id))
            .map((id: string) => toolMap.get(id)!);
        }
      }
      
      // Fallback to the original list if parsing fails
      return tools;
    } catch (error) {
      console.error('Error ranking tools with LLM:', error);
      return tools;
    }
  }
  
  /**
   * Execute a tool
   */
  async executeTool(options: ToolExecutionOptions): Promise<ToolExecutionResult> {
    try {
      const tool = await this.getToolById(options.toolId);
      
      if (!tool) {
        return {
          success: false,
          error: `Tool with ID ${options.toolId} not found`,
          executionTime: 0
        };
      }
      
      // Check if tool is enabled
      if (!tool.isEnabled) {
        return {
          success: false,
          error: `Tool ${tool.name} is currently disabled`,
          executionTime: 0
        };
      }
      
      // Check if we have an executor for this tool
      const executor = this.executors.get(options.toolId);
      
      if (!executor) {
        return {
          success: false,
          error: `No executor registered for tool ${tool.name}`,
          executionTime: 0
        };
      }
      
      // Validate parameters
      for (const param of tool.parameters) {
        if (param.required && (options.parameters[param.name] === undefined)) {
          return {
            success: false,
            error: `Required parameter '${param.name}' is missing`,
            executionTime: 0
          };
        }
      }
      
      // Execute the tool
      const startTime = Date.now();
      
      try {
        const result = await executor(options.parameters, options.context);
        
        const executionTime = Date.now() - startTime;
        
        // Create anonymous usage data for improving recommendations
        if (options.context?.intent && typeof options.context.intent === 'string') {
          this.updateIntentToolMapping(options.context.intent, options.toolId, true);
        }
        
        return {
          success: true,
          data: result,
          executionTime
        };
      } catch (execError) {
        const executionTime = Date.now() - startTime;
        
        // Record failure in intent mapping
        if (options.context?.intent && typeof options.context.intent === 'string') {
          this.updateIntentToolMapping(options.context.intent, options.toolId, false);
        }
        
        return {
          success: false,
          error: `Error executing tool ${tool.name}: ${execError instanceof Error ? execError.message : String(execError)}`,
          executionTime
        };
      }
    } catch (error) {
      console.error('Error in executeTool:', error);
      
      return {
        success: false,
        error: `Internal error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: 0
      };
    }
  }
  
  /**
   * Create a chain of tools for a complex operation
   */
  async createToolChain(
    toolIds: string[],
    contextMapping: Record<string, string>
  ): Promise<Tool> {
    // Validate that all tools exist
    const allTools = await Promise.all(toolIds.map(id => this.getToolById(id)));
    
    if (allTools.some(tool => tool === null)) {
      throw new Error('One or more tools in the chain do not exist');
    }
    
    // Create a new composite tool
    const compositeTool: Omit<Tool, 'id'> = {
      name: `Tool Chain: ${allTools.filter(Boolean).map(t => t!.name).join(' → ')}`,
      description: `Chain of tools: ${allTools.filter(Boolean).map(t => t!.name).join(' → ')}`,
      categories: ['composite', 'chain'],
      requiredCapabilities: Array.from(new Set(
        allTools.filter(Boolean).flatMap(t => t!.requiredCapabilities)
      )),
      parameters: allTools[0]!.parameters,
      isEnabled: true,
      version: '1.0.0'
    };
    
    // Register the composite tool
    const compositeToolId = await this.registerTool(compositeTool);
    
    // Register the executor for this composite tool
    this.executors.set(compositeToolId, async (params, context) => {
      let currentContext = { ...context, ...params };
      
      let results = [];
      
      // Execute each tool in sequence
      for (const toolId of toolIds) {
        // Map context to tool parameters based on contextMapping
        const toolParams: Record<string, any> = {};
        
        // Get the tool
        const tool = await this.getToolById(toolId);
        
        if (!tool) {
          throw new Error(`Tool ${toolId} not found in chain execution`);
        }
        
        // Map parameters from context based on contextMapping
        for (const param of tool.parameters) {
          const mappingKey = `${toolId}.${param.name}`;
          
          if (contextMapping[mappingKey]) {
            toolParams[param.name] = currentContext[contextMapping[mappingKey]];
          } else if (currentContext[param.name] !== undefined) {
            toolParams[param.name] = currentContext[param.name];
          } else if (param.required) {
            throw new Error(`Required parameter ${param.name} for tool ${tool.name} not available in context`);
          }
        }
        
        // Execute the tool
        const result = await this.executeTool({
          toolId,
          parameters: toolParams,
          context: currentContext
        });
        
        if (!result.success) {
          throw new Error(`Error in tool chain at step ${tool.name}: ${result.error}`);
        }
        
        // Add result to context for next tool
        currentContext = {
          ...currentContext,
          [`result_${toolId}`]: result.data,
          lastResult: result.data
        };
        
        results.push({
          toolId,
          result: result.data
        });
      }
      
      return {
        steps: results,
        finalResult: currentContext.lastResult
      };
    });
    
    return (await this.getToolById(compositeToolId))!;
  }
  
  /**
   * Register a new tool
   */
  async registerTool(tool: Omit<Tool, 'id'>): Promise<string> {
    // Generate ID for the tool
    const id = IdGenerator.generate('tool').toString();
    
    // Add the tool to the registry
    this.tools.set(id, {
      ...tool,
      id
    });
    
    console.log(`Registered tool: ${tool.name} (${id})`);
    
    return id;
  }
  
  /**
   * Get a tool by ID
   */
  async getToolById(toolId: string): Promise<Tool | null> {
    const tool = this.tools.get(toolId);
    return tool || null;
  }
  
  /**
   * File search tool implementation
   */
  private async executeFileSearch(params: Record<string, any>): Promise<any> {
    // Placeholder implementation
    console.log(`Executing file search with query: ${params.query}`);
    
    // In a real implementation, this would connect to the FileRetriever service
    return {
      results: [
        {
          id: 'file-1',
          name: 'example.txt',
          type: 'text/plain',
          path: '/documents/example.txt'
        },
        {
          id: 'file-2',
          name: 'notes.md',
          type: 'text/markdown',
          path: '/documents/notes.md'
        }
      ],
      query: params.query,
      totalMatches: 2
    };
  }
  
  /**
   * Web search tool implementation
   */
  private async executeWebSearch(params: Record<string, any>): Promise<any> {
    // Placeholder implementation
    console.log(`Executing web search with query: ${params.query}`);
    
    // In a real implementation, this would connect to a search API
    return {
      results: [
        {
          title: 'Example Search Result 1',
          url: 'https://example.com/result1',
          snippet: 'This is a snippet from the first search result...'
        },
        {
          title: 'Example Search Result 2',
          url: 'https://example.com/result2',
          snippet: 'This is a snippet from the second search result...'
        }
      ],
      query: params.query,
      totalResults: 2
    };
  }
  
  /**
   * Text analysis tool implementation
   */
  private async executeTextAnalysis(params: Record<string, any>): Promise<any> {
    // Placeholder implementation
    console.log(`Executing text analysis on ${params.text.substring(0, 50)}...`);
    
    // In a real implementation, this would use NLP libraries or APIs
    return {
      sentiment: {
        score: 0.8,
        label: 'positive'
      },
      entities: [
        {
          type: 'person',
          value: 'John Doe',
          confidence: 0.9
        },
        {
          type: 'organization',
          value: 'Acme Corp',
          confidence: 0.85
        }
      ],
      keywords: ['example', 'analysis', 'text'],
      text: params.text.substring(0, 100) + (params.text.length > 100 ? '...' : '')
    };
  }
  
  /**
   * Record feedback about a tool execution
   */
  async recordToolFeedback(feedback: ToolFeedback): Promise<boolean> {
    try {
      // Validate that the tool exists
      const tool = await this.getToolById(feedback.toolId);
      
      if (!tool) {
        console.error(`Cannot record feedback for unknown tool: ${feedback.toolId}`);
        return false;
      }
      
      // Store the feedback
      if (!this.toolUsage.has(feedback.toolId)) {
        this.toolUsage.set(feedback.toolId, []);
      }
      
      this.toolUsage.get(feedback.toolId)!.push(feedback);
      
      // Update intent-tool mapping
      this.updateIntentToolMapping(
        feedback.intent, 
        feedback.toolId,
        feedback.wasSuccessful && feedback.wasUseful
      );
      
      console.log(`Recorded feedback for tool ${feedback.toolId} (successful: ${feedback.wasSuccessful}, useful: ${feedback.wasUseful})`);
      
      return true;
    } catch (error) {
      console.error('Error recording tool feedback:', error);
      return false;
    }
  }
  
  /**
   * Update the intent-to-tool mapping for quick recommendations
   */
  private updateIntentToolMapping(intent: string, toolId: string, wasSuccessful: boolean): void {
    if (!this.intentToolMapping.has(intent)) {
      this.intentToolMapping.set(intent, new Map<string, number>());
    }
    
    const toolMapping = this.intentToolMapping.get(intent)!;
    
    // Update score - increase if successful, decrease if not
    const currentScore = toolMapping.get(toolId) || 0;
    const newScore = wasSuccessful ? currentScore + 1 : Math.max(0, currentScore - 0.5);
    
    toolMapping.set(toolId, newScore);
  }
  
  /**
   * Get usage statistics for a tool
   */
  async getToolUsageStats(toolId: string): Promise<ToolUsageStats | null> {
    try {
      // Check if tool exists
      const tool = await this.getToolById(toolId);
      
      if (!tool) {
        return null;
      }
      
      // Get usage data
      const usageData = this.toolUsage.get(toolId) || [];
      
      if (usageData.length === 0) {
        return {
          totalExecutions: 0,
          successfulExecutions: 0,
          usefulExecutions: 0,
          avgExecutionTime: 0,
          topIntents: [],
          commonParameters: {}
        };
      }
      
      // Calculate statistics
      const totalExecutions = usageData.length;
      const successfulExecutions = usageData.filter(usage => usage.wasSuccessful).length;
      const usefulExecutions = usageData.filter(usage => usage.wasUseful).length;
      
      const totalExecutionTime = usageData.reduce((total, usage) => total + usage.executionTime, 0);
      const avgExecutionTime = totalExecutionTime / totalExecutions;
      
      // Calculate top intents
      const intentCounts = new Map<string, number>();
      
      for (const usage of usageData) {
        const currentCount = intentCounts.get(usage.intent) || 0;
        intentCounts.set(usage.intent, currentCount + 1);
      }
      
      const topIntents = Array.from(intentCounts.entries())
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 intents
      
      // Analyze common parameters
      const parameterValues: Record<string, any[]> = {};
      
      for (const usage of usageData) {
        for (const [param, value] of Object.entries(usage.parameters)) {
          if (!parameterValues[param]) {
            parameterValues[param] = [];
          }
          
          if (!parameterValues[param].includes(value)) {
            parameterValues[param].push(value);
          }
          
          // Keep only the 10 most recent values
          if (parameterValues[param].length > 10) {
            parameterValues[param] = parameterValues[param].slice(-10);
          }
        }
      }
      
      return {
        totalExecutions,
        successfulExecutions,
        usefulExecutions,
        avgExecutionTime,
        topIntents,
        commonParameters: parameterValues
      };
    } catch (error) {
      console.error('Error getting tool usage stats:', error);
      return null;
    }
  }
  
  /**
   * Get recommended tools for an intent based on past usage
   */
  async getRecommendedTools(intent: string, limit: number = 3): Promise<Array<{tool: Tool, score: number}>> {
    try {
      // Check if we have direct mappings for this intent
      if (this.intentToolMapping.has(intent)) {
        const toolScores = this.intentToolMapping.get(intent)!;
        
        // Get tools with scores
        const recommendations: Array<{tool: Tool, score: number}> = [];
        
        for (const [toolId, score] of Array.from(toolScores.entries())) {
          const tool = await this.getToolById(toolId);
          
          if (tool && score > 0) {
            recommendations.push({ tool, score });
          }
        }
        
        // Sort by score and apply limit
        return recommendations
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
      
      // If we don't have direct mappings, try semantic matching with similar intents
      // This is a simplified approach - in a production system, you would use embeddings
      
      // Get all known intents
      const allIntents = Array.from(this.intentToolMapping.keys());
      
      if (allIntents.length === 0) {
        return [];
      }
      
      // Get the most similar intent using the LLM
      const mostSimilarIntent = await this.findSimilarIntent(intent, allIntents);
      
      if (mostSimilarIntent && this.intentToolMapping.has(mostSimilarIntent)) {
        const toolScores = this.intentToolMapping.get(mostSimilarIntent)!;
        
        // Get tools with scores, but with a penalty for using semantic matching
        const recommendations: Array<{tool: Tool, score: number}> = [];
        
        for (const [toolId, score] of Array.from(toolScores.entries())) {
          const tool = await this.getToolById(toolId);
          
          if (tool && score > 0) {
            // Apply a 20% penalty for semantic matching vs. exact match
            recommendations.push({ tool, score: score * 0.8 });
          }
        }
        
        // Sort by score and apply limit
        return recommendations
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
      
      // If all else fails, return empty list
      return [];
    } catch (error) {
      console.error('Error getting recommended tools:', error);
      return [];
    }
  }
  
  /**
   * Find a semantically similar intent from a list of known intents
   */
  private async findSimilarIntent(newIntent: string, knownIntents: string[]): Promise<string | null> {
    try {
      // Create system prompt
      const systemPrompt = `You are an AI assistant that can identify semantic similarity between user intents.
Given a new intent and a list of known intents, return the most similar known intent.
Focus on semantic meaning rather than superficial word matching.

Respond with just the most similar intent as a string. If none of the known intents
are semantically similar (similarity less than 60%), respond with "NO_SIMILAR_INTENT".`;

      // Create human message
      const humanMessage = `New intent: "${newIntent}"

Known intents:
${knownIntents.map((intent, i) => `${i+1}. "${intent}"`).join('\n')}

Which of the known intents is most semantically similar to the new intent?`;

      // Call LLM
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse the response
      const content = response.content.toString().trim();
      
      // Check if no similar intent was found
      if (content === 'NO_SIMILAR_INTENT') {
        return null;
      }
      
      // Check if the response matches one of our known intents
      for (const intent of knownIntents) {
        if (content.includes(intent)) {
          return intent;
        }
      }
      
      // If we can't match the response to a known intent, just return the first one
      // This is a fallback and shouldn't happen often with a well-prompted LLM
      return knownIntents[0];
    } catch (error) {
      console.error('Error finding similar intent:', error);
      return null;
    }
  }
} 