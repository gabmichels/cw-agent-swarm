import { ChloeAgent } from '../agent';
import { ToolRegistry } from './registry';
import { ToolSynthesis } from './synthesis';
import { ChatOpenAI } from '@langchain/openai';
import path from 'path';

/**
 * ToolCreationSystem class integrates the tool registry and synthesis with Chloe
 */
export class ToolCreationSystem {
  private agent: ChloeAgent;
  private registry: ToolRegistry;
  private synthesis: ToolSynthesis;
  private model: ChatOpenAI;
  
  constructor(agent: ChloeAgent) {
    this.agent = agent;
    
    // Get the model from the agent if available
    this.model = agent.getModel() || new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0.7,
    });
    
    // Initialize the registry
    this.registry = new ToolRegistry({
      model: this.model,
      toolsDir: path.join(process.cwd(), 'src/agents/chloe/tools'),
      metadataDir: path.join(process.cwd(), 'data/tool-metadata')
    });
    
    // Initialize the synthesis
    this.synthesis = new ToolSynthesis({
      registry: this.registry,
      model: this.model
    });
  }
  
  /**
   * Initialize the tool creation system
   */
  async initialize(): Promise<void> {
    console.log('Initializing ToolCreationSystem...');
    
    // Initialize the registry
    await this.registry.initialize(this.model);
    
    console.log('ToolCreationSystem initialized successfully');
  }
  
  /**
   * Get the tool registry
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
  
  /**
   * Get the tool synthesis
   */
  getSynthesis(): ToolSynthesis {
    return this.synthesis;
  }
  
  /**
   * Discover tools from a source
   */
  async discoverTools(source: string, options?: any): Promise<any> {
    try {
      return await this.registry.discoverTools(source, options);
    } catch (error) {
      console.error('Error discovering tools:', error);
      throw error;
    }
  }
  
  /**
   * Create a new tool from a natural language description
   */
  async createToolFromDescription(description: string): Promise<any> {
    try {
      console.log(`Creating tool from description: ${description}`);
      
      // Generate the tool
      const generatedTool = await this.synthesis.generateToolFromDescription(description);
      
      // If no tool was generated, return failure
      if (!generatedTool) {
        return {
          success: false,
          error: 'Failed to generate tool'
        };
      }
      
      // Test the tool with a simple input
      const testResult = await this.synthesis.testTool(generatedTool, { input: 'test' });
      
      // Only save and register if test was successful
      if (testResult.success) {
        // Save and register the tool
        const toolPath = await this.synthesis.saveAndRegisterTool(generatedTool);
        
        return {
          success: true,
          tool: {
            name: generatedTool.name,
            description: generatedTool.metadata.description,
            path: toolPath
          },
          testResult
        };
      } else {
        return {
          success: false,
          error: 'Tool test failed',
          testResult
        };
      }
    } catch (error) {
      console.error('Error creating tool from description:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get appropriate tools for a task
   */
  async getToolsForTask(task: string): Promise<any[]> {
    try {
      const tools = await this.registry.getToolsForTask(task);
      return tools.map(tool => ({
        name: tool.metadata.name,
        description: tool.metadata.description,
        category: tool.metadata.category,
        capabilities: tool.metadata.capabilities
      }));
    } catch (error) {
      console.error('Error getting tools for task:', error);
      return [];
    }
  }
  
  /**
   * Analyze memory for potential tool creation needs
   */
  async analyzeMemoryForToolNeeds(): Promise<string[]> {
    try {
      // Get cognitive memory from agent
      const cognitiveMemory = this.agent.getCognitiveMemory();
      
      // Get recent memories - using getRelevantMemories as a fallback since getRecentEpisodes doesn't exist
      const recentEpisodes = await cognitiveMemory.getRelevantMemories("", 50);
      
      // If no memories available, return empty array
      if (!recentEpisodes || recentEpisodes.length === 0) {
        return [];
      }
      
      // Combine memories into a single context
      const memoryContext = recentEpisodes
        .map((episode: any) => episode.text || episode.content)
        .join('\n\n');
      
      // Use LLM to analyze for tool needs
      const systemPrompt = 'You are an AI tool developer. Analyze the following conversation history and identify needs for new tools. Respond only with a JSON array of short tool descriptions, or an empty array if no new tools are needed.';
      const userPrompt = `Memory context:\n${memoryContext}\n\nBased on these interactions, what new tools might be useful? Return a JSON array of tool descriptions.`;
      
      const response = await this.model.invoke(systemPrompt + "\n\n" + userPrompt);
      
      // Extract tool descriptions from the response
      try {
        // Try to extract JSON array
        const jsonContent = response.content;
        const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const toolNeeds = JSON.parse(jsonMatch[0]);
          return Array.isArray(toolNeeds) ? toolNeeds : [];
        }
        
        return [];
      } catch (error) {
        console.error('Error parsing tool needs:', error);
        return [];
      }
    } catch (error) {
      console.error('Error analyzing memory for tool needs:', error);
      return [];
    }
  }
  
  /**
   * Create missing tools based on memory analysis
   */
  async createMissingTools(): Promise<{
    toolsCreated: number;
    toolDescriptions: string[];
  }> {
    try {
      // Analyze memory for tool needs
      const toolNeeds = await this.analyzeMemoryForToolNeeds();
      
      // If no tool needs found, return
      if (toolNeeds.length === 0) {
        return {
          toolsCreated: 0,
          toolDescriptions: []
        };
      }
      
      // Create tools for each need
      const createdTools = [];
      for (const description of toolNeeds) {
        try {
          const result = await this.createToolFromDescription(description);
          if (result.success) {
            createdTools.push(description);
          }
        } catch (error) {
          console.error(`Error creating tool for "${description}":`, error);
        }
      }
      
      return {
        toolsCreated: createdTools.length,
        toolDescriptions: createdTools
      };
    } catch (error) {
      console.error('Error creating missing tools:', error);
      return {
        toolsCreated: 0,
        toolDescriptions: []
      };
    }
  }
  
  /**
   * Schedule periodic tool creation
   */
  schedulePeriodicToolCreation(intervalHours: number = 24): NodeJS.Timeout {
    console.log(`Scheduling periodic tool creation every ${intervalHours} hours`);
    
    // Convert hours to milliseconds
    const interval = intervalHours * 60 * 60 * 1000;
    
    // Set up the interval
    const timer = setInterval(async () => {
      console.log('Running periodic tool creation...');
      try {
        const result = await this.createMissingTools();
        console.log(`Created ${result.toolsCreated} new tools`);
        
        if (result.toolsCreated > 0) {
          console.log('New tools created:', result.toolDescriptions);
        }
      } catch (error) {
        console.error('Error in periodic tool creation:', error);
      }
    }, interval);
    
    return timer;
  }
  
  /**
   * Find and adapt external APIs to create new tools
   */
  async adaptExternalAPIs(searchQuery: string): Promise<{
    success: boolean;
    discoveredAPIs: number;
    toolsCreated: number;
  }> {
    try {
      // First try to discover OpenAPI specifications
      const openApiDiscovery = await this.discoverFromString(searchQuery);
      
      if (openApiDiscovery.length === 0) {
        return {
          success: false,
          discoveredAPIs: 0,
          toolsCreated: 0
        };
      }
      
      // Create tools for each discovered API
      let toolsCreated = 0;
      for (const api of openApiDiscovery) {
        try {
          // Try to discover from OpenAPI
          const discovery = await this.registry.discoverTools('openapi', { url: api.url });
          
          if (discovery.discoveredTools.length > 0) {
            // Create a tool for the first discovered endpoint
            const toolIndex = 0;
            const { code, metadata } = await this.registry.generateToolCode(discovery, toolIndex);
            
            // Save the generated tool
            await this.registry.createToolFromGeneratedCode(code, metadata);
            
            toolsCreated++;
          }
        } catch (error) {
          console.error(`Error creating tool for API ${api.url}:`, error);
        }
      }
      
      return {
        success: toolsCreated > 0,
        discoveredAPIs: openApiDiscovery.length,
        toolsCreated
      };
    } catch (error) {
      console.error('Error adapting external APIs:', error);
      return {
        success: false,
        discoveredAPIs: 0,
        toolsCreated: 0
      };
    }
  }
  
  /**
   * Discover OpenAPI specifications from a search query
   */
  private async discoverFromString(query: string): Promise<Array<{ name: string; url: string }>> {
    try {
      // Use LLM to generate potential OpenAPI URLs
      const systemPrompt = 'You are an API discovery assistant. Based on the user query, list potential public APIs that might have OpenAPI/Swagger specifications available. Return a JSON array of objects with name and url properties.';
      const userPrompt = `Find public APIs related to: ${query}`;
      
      const response = await this.model.invoke(systemPrompt + "\n\n" + userPrompt);
      
      // Extract API URLs from the response
      try {
        const jsonContent = response.content;
        const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const apis = JSON.parse(jsonMatch[0]);
          return Array.isArray(apis) ? apis : [];
        }
        
        return [];
      } catch (error) {
        console.error('Error parsing API discovery response:', error);
        return [];
      }
    } catch (error) {
      console.error('Error discovering APIs from string:', error);
      return [];
    }
  }
} 