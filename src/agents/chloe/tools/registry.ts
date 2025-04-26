import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { z } from 'zod';

/**
 * Interface for tool metadata
 */
export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  inputs: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  outputs: {
    name: string;
    type: string;
    description: string;
  }[];
  successMetrics: string[];
  examples: {
    input: Record<string, any>;
    output: any;
  }[];
  createdAt: string;
  updatedAt: string;
  version: string;
  author: string;
  source?: string;
  tags: string[];
  usageCount: number;
  successRate: number;
  avgExecutionTime: number;
  status: 'active' | 'deprecated' | 'experimental' | 'stable';
}

/**
 * Interface for registered tools
 */
export interface RegisteredTool {
  tool: StructuredTool;
  metadata: ToolMetadata;
  implementation?: any;
}

/**
 * Interface for tool discovery results
 */
export interface DiscoveryResult {
  source: string;
  discoveredTools: Array<{
    name: string;
    description: string;
    endpoints?: string[];
    parameters?: Record<string, any>;
    category?: string;
  }>;
  raw?: any;
}

/**
 * ToolRegistry class for managing agent tools
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private model: ChatOpenAI | null = null;
  private toolsDir: string;
  private metadataDir: string;
  
  constructor(options?: {
    toolsDir?: string;
    metadataDir?: string;
    model?: ChatOpenAI;
  }) {
    this.toolsDir = options?.toolsDir || path.join(process.cwd(), 'src/agents/chloe/tools');
    this.metadataDir = options?.metadataDir || path.join(process.cwd(), 'data/tool-metadata');
    this.model = options?.model || null;
    
    // Create metadata directory if it doesn't exist
    this.ensureDirectoryExists(this.metadataDir).catch(console.error);
  }
  
  /**
   * Ensure a directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  /**
   * Initialize the registry
   */
  async initialize(model?: ChatOpenAI): Promise<void> {
    if (model) {
      this.model = model;
    }
    
    // Load existing tools from the tools directory
    await this.loadBuiltInTools();
    
    // Load custom tools from metadata directory
    await this.loadCustomTools();
    
    console.log(`ToolRegistry initialized with ${this.tools.size} tools`);
  }
  
  /**
   * Load built-in tools from the tools directory
   */
  private async loadBuiltInTools(): Promise<void> {
    try {
      // Get all files from the tools directory
      const files = await fs.readdir(this.toolsDir);
      
      // Filter for TypeScript files but exclude index.ts
      const toolFiles = files.filter(file => 
        file.endsWith('.ts') && 
        file !== 'index.ts' && 
        file !== 'registry.ts'
      );
      
      for (const file of toolFiles) {
        try {
          // Import the tool module
          const toolModule = await import(path.join(this.toolsDir, file));
          
          // Get the tool class/function from the module
          const toolKeys = Object.keys(toolModule).filter(key => 
            key.includes('Tool') || 
            (typeof toolModule[key] === 'function' && toolModule[key].name.includes('Tool'))
          );
          
          for (const key of toolKeys) {
            const ToolClass = toolModule[key];
            
            // Skip if not a constructor or function
            if (typeof ToolClass !== 'function') continue;
            
            try {
              // Instantiate the tool
              const toolInstance = new ToolClass();
              
              // Check if it's a valid tool with name and description
              if (toolInstance.name && toolInstance.description) {
                // Create basic metadata
                const metadata: ToolMetadata = {
                  name: toolInstance.name,
                  description: toolInstance.description,
                  category: this.inferCategory(toolInstance.name, toolInstance.description),
                  capabilities: this.inferCapabilities(toolInstance.name, toolInstance.description),
                  inputs: this.inferInputs(toolInstance),
                  outputs: this.inferOutputs(toolInstance),
                  successMetrics: ['completion', 'accuracy'],
                  examples: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: '1.0.0',
                  author: 'system',
                  tags: this.inferTags(toolInstance.name, toolInstance.description),
                  usageCount: 0,
                  successRate: 1.0,
                  avgExecutionTime: 0,
                  status: 'active'
                };
                
                // Register the tool
                this.registerTool(toolInstance, metadata);
                console.log(`Loaded built-in tool: ${toolInstance.name}`);
              }
            } catch (error) {
              console.error(`Error instantiating tool ${key} from ${file}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error importing tool from ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading built-in tools:', error);
    }
  }
  
  /**
   * Load custom tools from the metadata directory
   */
  private async loadCustomTools(): Promise<void> {
    try {
      // Check if metadata directory exists
      try {
        await fs.access(this.metadataDir);
      } catch {
        // Directory doesn't exist yet, create it
        await fs.mkdir(this.metadataDir, { recursive: true });
        return; // No custom tools yet
      }
      
      // Get all JSON files from the metadata directory
      const files = await fs.readdir(this.metadataDir);
      const metadataFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of metadataFiles) {
        try {
          // Read and parse the metadata file
          const metadataContent = await fs.readFile(path.join(this.metadataDir, file), 'utf-8');
          const metadata = JSON.parse(metadataContent) as ToolMetadata;
          
          // Check if there's a corresponding implementation file
          const implementationPath = path.join(this.metadataDir, `${metadata.name}.js`);
          try {
            await fs.access(implementationPath);
            
            // Load the implementation
            const implementation = require(implementationPath);
            
            // Create a tool instance
            const toolInstance = this.createToolFromImplementation(implementation, metadata);
            
            if (toolInstance) {
              // Register the tool
              this.registerTool(toolInstance, metadata, implementation);
              console.log(`Loaded custom tool: ${metadata.name}`);
            }
          } catch (error) {
            console.error(`Error loading implementation for ${metadata.name}:`, error);
          }
        } catch (error) {
          console.error(`Error loading metadata from ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading custom tools:', error);
    }
  }
  
  /**
   * Create a tool instance from an implementation
   */
  private createToolFromImplementation(implementation: any, metadata: ToolMetadata): StructuredTool | null {
    try {
      // If the implementation exports a Tool class instance directly
      if (implementation.name && implementation.description && typeof implementation.call === 'function') {
        return implementation;
      }
      
      // If the implementation exports a function
      if (typeof implementation === 'function' || typeof implementation.execute === 'function') {
        const execFn = typeof implementation === 'function' ? implementation : implementation.execute;
        
        // Create a custom tool with proper constructor arguments
        const tool = new StructuredTool({
          name: metadata.name,
          description: metadata.description,
          schema: z.object({
            input: z.string().describe('The input to the tool')
          }),
          func: async (input: any) => {
            return await execFn(input);
          }
        });
        
        return tool;
      }
      
      return null;
    } catch (error) {
      console.error(`Error creating tool from implementation for ${metadata.name}:`, error);
      return null;
    }
  }
  
  /**
   * Register a tool with the registry
   */
  registerTool(tool: StructuredTool, metadata: Partial<ToolMetadata>, implementation?: any): void {
    // Get name and description safely from tool
    const toolName = (tool as any).name || metadata.name || 'unnamed-tool';
    const toolDescription = (tool as any).description || metadata.description || 'No description available';
    
    // Create full metadata object with defaults
    const fullMetadata: ToolMetadata = {
      name: metadata.name || toolName,
      description: metadata.description || toolDescription,
      category: metadata.category || this.inferCategory(toolName, toolDescription),
      capabilities: metadata.capabilities || this.inferCapabilities(toolName, toolDescription),
      inputs: metadata.inputs || this.inferInputs(tool),
      outputs: metadata.outputs || this.inferOutputs(tool),
      successMetrics: metadata.successMetrics || ['completion', 'accuracy'],
      examples: metadata.examples || [],
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: metadata.updatedAt || new Date().toISOString(),
      version: metadata.version || '1.0.0',
      author: metadata.author || 'system',
      source: metadata.source,
      tags: metadata.tags || this.inferTags(toolName, toolDescription),
      usageCount: metadata.usageCount || 0,
      successRate: metadata.successRate || 1.0,
      avgExecutionTime: metadata.avgExecutionTime || 0,
      status: metadata.status || 'active'
    };
    
    // Add to the registry
    this.tools.set(toolName, {
      tool,
      metadata: fullMetadata,
      implementation
    });
    
    // Save metadata to disk for custom tools
    if (implementation) {
      this.saveToolMetadata(fullMetadata).catch(console.error);
    }
  }
  
  /**
   * Save tool metadata to disk
   */
  private async saveToolMetadata(metadata: ToolMetadata): Promise<void> {
    try {
      // Ensure metadata directory exists
      await this.ensureDirectoryExists(this.metadataDir);
      
      // Write metadata to file
      const metadataPath = path.join(this.metadataDir, `${metadata.name}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error saving metadata for ${metadata.name}:`, error);
    }
  }
  
  /**
   * Get all registered tools
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get a specific tool by name
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): RegisteredTool[] {
    return this.getAllTools().filter(tool => 
      tool.metadata.category.toLowerCase() === category.toLowerCase()
    );
  }
  
  /**
   * Get tools by capability
   */
  getToolsByCapability(capability: string): RegisteredTool[] {
    return this.getAllTools().filter(tool => 
      tool.metadata.capabilities.some(cap => 
        cap.toLowerCase() === capability.toLowerCase()
      )
    );
  }
  
  /**
   * Get tools by tag
   */
  getToolsByTag(tag: string): RegisteredTool[] {
    return this.getAllTools().filter(tool => 
      tool.metadata.tags.some(t => 
        t.toLowerCase() === tag.toLowerCase()
      )
    );
  }
  
  /**
   * Search for tools by query
   */
  searchTools(query: string): RegisteredTool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(tool => 
      tool.metadata.name.toLowerCase().includes(lowerQuery) ||
      tool.metadata.description.toLowerCase().includes(lowerQuery) ||
      tool.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      tool.metadata.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * Get the appropriate tools for a task
   */
  async getToolsForTask(task: string): Promise<RegisteredTool[]> {
    // First try simple keyword matching
    const keywordResults = this.searchTools(task);
    
    // If we have results from keywords, return them
    if (keywordResults.length > 0) {
      return keywordResults;
    }
    
    // Otherwise, use LLM to find appropriate tools
    if (this.model) {
      try {
        const toolDescriptions = this.getAllTools().map(tool => ({
          name: tool.metadata.name,
          description: tool.metadata.description,
          capabilities: tool.metadata.capabilities.join(', ')
        }));
        
        const prompt = `
        Task: ${task}
        
        Available tools:
        ${toolDescriptions.map(tool => `- ${tool.name}: ${tool.description} (Capabilities: ${tool.capabilities})`).join('\n')}
        
        Which tools would be most appropriate for this task? Return a JSON array of tool names, ordered by relevance.
        `;
        
        const response = await this.model.invoke(prompt);
        
        // Parse the tool names from the response
        const toolNames = this.extractToolNames(response.content);
        
        // Get the tools by name
        return toolNames
          .map(name => this.getTool(name))
          .filter((tool): tool is RegisteredTool => tool !== undefined);
      } catch (error) {
        console.error('Error getting tools for task:', error);
        return keywordResults;
      }
    }
    
    // Fallback to keyword results
    return keywordResults;
  }
  
  /**
   * Extract tool names from LLM response
   */
  private extractToolNames(response: string): string[] {
    try {
      // Try to parse JSON array directly
      if (response.includes('[') && response.includes(']')) {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // Fallback: extract names by line
      return response
        .split('\n')
        .map(line => {
          // Look for patterns like "1. ToolName" or "- ToolName"
          const match = line.match(/(?:\d+\.|-)?\s*"?([A-Za-z0-9_]+)"?/);
          return match ? match[1] : null;
        })
        .filter((name): name is string => name !== null);
    } catch (error) {
      console.error('Error extracting tool names:', error);
      return [];
    }
  }
  
  /**
   * Record tool usage statistics
   */
  recordToolUsage(name: string, success: boolean, executionTimeMs: number): void {
    const tool = this.tools.get(name);
    if (tool) {
      const { metadata } = tool;
      
      // Update stats
      metadata.usageCount += 1;
      
      // Update success rate using rolling average
      metadata.successRate = (metadata.successRate * (metadata.usageCount - 1) + (success ? 1 : 0)) / metadata.usageCount;
      
      // Update execution time using rolling average
      metadata.avgExecutionTime = (metadata.avgExecutionTime * (metadata.usageCount - 1) + executionTimeMs) / metadata.usageCount;
      
      // Update timestamp
      metadata.updatedAt = new Date().toISOString();
      
      // Save updated metadata for custom tools
      if (tool.implementation) {
        this.saveToolMetadata(metadata).catch(console.error);
      }
    }
  }
  
  /**
   * Discover new tools from various sources
   */
  async discoverTools(source: string, options?: any): Promise<DiscoveryResult> {
    switch (source) {
      case 'npm':
        return await this.discoverFromNpm(options?.packageName || options?.query);
      case 'openapi':
        return await this.discoverFromOpenApi(options?.url);
      case 'github':
        return await this.discoverFromGithub(options?.repo || options?.query);
      case 'directory':
        return await this.discoverFromDirectory(options?.directory);
      default:
        throw new Error(`Unsupported discovery source: ${source}`);
    }
  }
  
  /**
   * Discover tools from npm package
   */
  private async discoverFromNpm(packageNameOrQuery: string): Promise<DiscoveryResult> {
    try {
      // Fetch package info from npm registry
      let packageName = packageNameOrQuery;
      
      // If it's a query, search for packages
      if (packageNameOrQuery.includes(' ') || !packageNameOrQuery.match(/^[@a-zA-Z0-9_\-\/]+$/)) {
        const searchUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(packageNameOrQuery)}&size=10`;
        const searchResponse = await axios.get(searchUrl);
        const results = searchResponse.data.objects;
        
        if (results.length === 0) {
          return {
            source: 'npm',
            discoveredTools: [],
            raw: { error: 'No packages found' }
          };
        }
        
        // Use the first result
        packageName = results[0].package.name;
      }
      
      // Fetch package details
      const packageUrl = `https://registry.npmjs.org/${packageName}`;
      const packageResponse = await axios.get(packageUrl);
      const packageData = packageResponse.data;
      
      // Extract tool information
      const discoveredTools = [];
      const latestVersion = packageData['dist-tags']?.latest;
      
      if (latestVersion && packageData.versions[latestVersion]) {
        const versionData = packageData.versions[latestVersion];
        
        // Create a base tool from the package itself
        discoveredTools.push({
          name: this.sanitizeToolName(packageName),
          description: versionData.description || packageData.description || `Tool for ${packageName}`,
          category: 'npm-package',
          endpoints: Object.keys(versionData.exports || versionData.main ? { main: versionData.main } : {})
        });
        
        // Additional extraction can be done here for complex packages
      }
      
      return {
        source: 'npm',
        discoveredTools,
        raw: packageData
      };
    } catch (error) {
      console.error('Error discovering tools from npm:', error);
      return {
        source: 'npm',
        discoveredTools: [],
        raw: { error: String(error) }
      };
    }
  }
  
  /**
   * Discover tools from OpenAPI specification
   */
  private async discoverFromOpenApi(url: string): Promise<DiscoveryResult> {
    try {
      // Fetch OpenAPI spec
      const response = await axios.get(url);
      const openApiSpec = response.data;
      
      // Extract endpoints as potential tools
      const paths = openApiSpec.paths || {};
      const discoveredTools = [];
      
      // Extract API information
      const apiName = openApiSpec.info?.title || 'API';
      const apiDescription = openApiSpec.info?.description || `OpenAPI from ${url}`;
      
      // Group endpoints by tag
      const endpointsByTag: Record<string, { path: string; method: string; operation: any }[]> = {};
      
      for (const path in paths) {
        const methods = paths[path];
        for (const method in methods) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            const operation = methods[method];
            const tags = operation.tags || ['default'];
            
            for (const tag of tags) {
              if (!endpointsByTag[tag]) {
                endpointsByTag[tag] = [];
              }
              
              endpointsByTag[tag].push({ path, method, operation });
            }
          }
        }
      }
      
      // Create tools for each tag
      for (const tag in endpointsByTag) {
        const endpoints = endpointsByTag[tag];
        const operationIds = endpoints
          .map(endpoint => endpoint.operation.operationId || `${endpoint.method.toUpperCase()} ${endpoint.path}`)
          .filter(Boolean);
        
        discoveredTools.push({
          name: this.sanitizeToolName(`${apiName}_${tag}`),
          description: `${tag} operations for ${apiName}: ${operationIds.join(', ')}`,
          category: 'api',
          endpoints: operationIds
        });
      }
      
      return {
        source: 'openapi',
        discoveredTools,
        raw: openApiSpec
      };
    } catch (error) {
      console.error('Error discovering tools from OpenAPI:', error);
      return {
        source: 'openapi',
        discoveredTools: [],
        raw: { error: String(error) }
      };
    }
  }
  
  /**
   * Discover tools from GitHub repository
   */
  private async discoverFromGithub(repoOrQuery: string): Promise<DiscoveryResult> {
    // This is a simplified implementation. In a real system, this would use the GitHub API
    // and perform more sophisticated analysis of the repository.
    return {
      source: 'github',
      discoveredTools: [{
        name: this.sanitizeToolName(`github_${repoOrQuery.replace(/\//g, '_')}`),
        description: `Tool for interacting with GitHub repository ${repoOrQuery}`,
        category: 'repository',
        endpoints: ['getFiles', 'getContent', 'search']
      }]
    };
  }
  
  /**
   * Discover tools from a local directory
   */
  private async discoverFromDirectory(directory: string): Promise<DiscoveryResult> {
    try {
      // Get all files from the directory
      const files = await fs.readdir(directory);
      
      // Filter for JavaScript and TypeScript files
      const codeFiles = files.filter(file => 
        file.endsWith('.js') || 
        file.endsWith('.ts') || 
        file.endsWith('.jsx') || 
        file.endsWith('.tsx')
      );
      
      // Extract potential tools
      const discoveredTools = [];
      
      for (const file of codeFiles) {
        try {
          // Read file content
          const content = await fs.readFile(path.join(directory, file), 'utf-8');
          
          // Look for potential tool definitions
          // This is a simple heuristic, a real implementation would use AST parsing
          const classMatch = content.match(/class\s+(\w+)(?:Tool|Agent|Handler)/);
          if (classMatch) {
            const name = classMatch[1];
            
            // Look for description or comment
            const descriptionMatch = content.match(/\/\*\*\s*([\s\S]*?)\s*\*\/|\/\/\s*(.+)/);
            const description = descriptionMatch 
              ? (descriptionMatch[1] || descriptionMatch[2]).replace(/\s*\*\s*/g, ' ').trim()
              : `Tool discovered from ${file}`;
            
            discoveredTools.push({
              name: this.sanitizeToolName(name),
              description,
              category: 'local',
              source: path.join(directory, file)
            });
          }
        } catch (error) {
          console.error(`Error analyzing file ${file}:`, error);
        }
      }
      
      return {
        source: 'directory',
        discoveredTools
      };
    } catch (error) {
      console.error('Error discovering tools from directory:', error);
      return {
        source: 'directory',
        discoveredTools: []
      };
    }
  }
  
  /**
   * Sanitize a string to be used as a tool name
   */
  private sanitizeToolName(name: string): string {
    // Replace non-alphanumeric characters with underscores
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_') // Replace multiple underscores with a single one
      .replace(/^_|_$/g, '') // Remove leading and trailing underscores
      .replace(/^(\d)/, '_$1'); // Ensure it doesn't start with a number
  }
  
  /**
   * Generate tool code from a discovery result
   */
  async generateToolCode(discovery: DiscoveryResult, toolIndex: number): Promise<{
    code: string;
    metadata: ToolMetadata;
  }> {
    if (!this.model) {
      throw new Error('LLM model is required for code generation');
    }
    
    if (toolIndex >= discovery.discoveredTools.length) {
      throw new Error('Tool index out of bounds');
    }
    
    const toolInfo = discovery.discoveredTools[toolIndex];
    
    const promptTemplate = `
    You are an expert JavaScript/TypeScript developer creating a tool for a AI agent system.
    
    Create a tool that implements the following:
    
    Name: ${toolInfo.name}
    Description: ${toolInfo.description}
    Category: ${toolInfo.category || 'utility'}
    ${toolInfo.endpoints ? `Endpoints: ${toolInfo.endpoints.join(', ')}` : ''}
    ${toolInfo.parameters ? `Parameters: ${JSON.stringify(toolInfo.parameters, null, 2)}` : ''}
    
    Source: ${discovery.source}
    ${discovery.source === 'npm' ? 'NPM Package: ' + (discovery.raw?.name || 'unknown') : ''}
    ${discovery.source === 'openapi' ? 'OpenAPI URL: ' + (toolInfo.endpoints?.[0] || 'unknown') : ''}
    
    The tool should:
    1. Extend the Tool class from LangChain (or be compatible with it)
    2. Have proper error handling
    3. Be well-documented with JSDoc comments
    4. Include proper TypeScript types
    5. Handle all the expected input parameters
    
    Return ONLY the code for this tool with no additional explanations.
    `;
    
    // Fix the model.invoke() call to use a string
    const systemPrompt = 'You are a skilled TypeScript developer specialized in creating tools for AI agent systems.';
    const fullPrompt = `${systemPrompt}\n\n${promptTemplate}`;
    const response = await this.model.invoke(fullPrompt);
    
    // Extract the code from the response
    const codeMatch = response.content.match(/```(?:typescript|js|javascript)?\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1] : response.content;
    
    // Generate metadata
    const metadata: ToolMetadata = {
      name: toolInfo.name,
      description: toolInfo.description,
      category: toolInfo.category || 'utility',
      capabilities: this.inferCapabilities(toolInfo.name, toolInfo.description),
      inputs: [], // Would need to extract from generated code
      outputs: [], // Would need to extract from generated code
      successMetrics: ['completion', 'accuracy'],
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      author: 'ai-generated',
      source: discovery.source,
      tags: this.inferTags(toolInfo.name, toolInfo.description),
      usageCount: 0,
      successRate: 1.0,
      avgExecutionTime: 0,
      status: 'experimental'
    };
    
    return { code, metadata };
  }
  
  /**
   * Create a new tool from generated code
   */
  async createToolFromGeneratedCode(code: string, metadata: ToolMetadata): Promise<string> {
    try {
      // Ensure directories exist
      await this.ensureDirectoryExists(this.metadataDir);
      
      // Save metadata
      const metadataPath = path.join(this.metadataDir, `${metadata.name}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      
      // Save implementation
      const implementationPath = path.join(this.metadataDir, `${metadata.name}.js`);
      
      // Simple transformation from TypeScript to JavaScript
      // In a real system, this would use a proper compiler
      const jsCode = code
        .replace(/import\s+{\s*Tool\s*}\s+from\s+['"]@langchain\/core\/tools['"];?/g, 
                'const { Tool } = require("@langchain/core/tools");')
        .replace(/import\s+(\S+)\s+from\s+(['"])([^'"]+)\2;?/g, 
                'const $1 = require("$3");')
        .replace(/export\s+(default\s+)?/g, 'module.exports = ')
        .replace(/:\s*[A-Za-z<>\[\]|]+/g, '') // Remove TypeScript type annotations
        .replace(/<[A-Za-z<>\[\]|,\s]+>/g, ''); // Remove generic type parameters
      
      await fs.writeFile(implementationPath, jsCode, 'utf-8');
      
      return implementationPath;
    } catch (error) {
      console.error('Error creating tool from generated code:', error);
      throw error;
    }
  }
  
  /**
   * Infer the category of a tool from its name and description
   */
  private inferCategory(name: string, description: string): string {
    const nameAndDesc = (name + ' ' + description).toLowerCase();
    
    if (nameAndDesc.includes('search') || nameAndDesc.includes('find') || nameAndDesc.includes('lookup')) {
      return 'search';
    }
    
    if (nameAndDesc.includes('api') || nameAndDesc.includes('fetch') || nameAndDesc.includes('request')) {
      return 'api';
    }
    
    if (nameAndDesc.includes('file') || nameAndDesc.includes('read') || nameAndDesc.includes('write')) {
      return 'file';
    }
    
    if (nameAndDesc.includes('calculate') || nameAndDesc.includes('compute') || nameAndDesc.includes('math')) {
      return 'calculation';
    }
    
    if (nameAndDesc.includes('transform') || nameAndDesc.includes('convert') || nameAndDesc.includes('format')) {
      return 'transformation';
    }
    
    return 'utility';
  }
  
  /**
   * Infer the capabilities of a tool from its name and description
   */
  private inferCapabilities(name: string, description: string): string[] {
    const nameAndDesc = (name + ' ' + description).toLowerCase();
    const capabilities: string[] = [];
    
    // Common capabilities
    if (nameAndDesc.includes('search') || nameAndDesc.includes('find') || nameAndDesc.includes('lookup')) {
      capabilities.push('search');
    }
    
    if (nameAndDesc.includes('api') || nameAndDesc.includes('http') || nameAndDesc.includes('request')) {
      capabilities.push('api-access');
    }
    
    if (nameAndDesc.includes('file') || nameAndDesc.includes('read') || nameAndDesc.includes('write')) {
      capabilities.push('file-system');
    }
    
    if (nameAndDesc.includes('analyze') || nameAndDesc.includes('process') || nameAndDesc.includes('extract')) {
      capabilities.push('data-processing');
    }
    
    if (nameAndDesc.includes('json') || nameAndDesc.includes('xml') || nameAndDesc.includes('parse')) {
      capabilities.push('data-parsing');
    }
    
    // If no specific capabilities were found, add a generic one
    if (capabilities.length === 0) {
      capabilities.push('utility');
    }
    
    return capabilities;
  }
  
  /**
   * Infer the inputs of a tool from its instance
   */
  private inferInputs(tool: StructuredTool): Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }> {
    // This is a simple implementation
    // In a real system, this would analyze the tool's schema or source code
    return [{
      name: 'input',
      type: 'string',
      description: 'The input to the tool',
      required: true
    }];
  }
  
  /**
   * Infer the outputs of a tool from its instance
   */
  private inferOutputs(tool: StructuredTool): Array<{
    name: string;
    type: string;
    description: string;
  }> {
    // This is a simple implementation
    // In a real system, this would analyze the tool's schema or source code
    return [{
      name: 'output',
      type: 'string',
      description: 'The output from the tool'
    }];
  }
  
  /**
   * Infer tags for a tool from its name and description
   */
  private inferTags(name: string, description: string): string[] {
    const nameAndDesc = (name + ' ' + description).toLowerCase();
    const tags: Set<string> = new Set();
    
    // Common tags based on keywords
    const keywordToTag: Record<string, string> = {
      'search': 'search',
      'find': 'search',
      'api': 'api',
      'request': 'api',
      'http': 'api',
      'file': 'file-system',
      'read': 'read',
      'write': 'write',
      'json': 'json',
      'xml': 'xml',
      'parse': 'parsing',
      'transform': 'transformation',
      'convert': 'conversion',
      'calculate': 'calculation',
      'math': 'math',
      'analyze': 'analysis'
    };
    
    for (const [keyword, tag] of Object.entries(keywordToTag)) {
      if (nameAndDesc.includes(keyword)) {
        tags.add(tag);
      }
    }
    
    // Add name as a tag
    tags.add(name.toLowerCase());
    
    return Array.from(tags);
  }
} 