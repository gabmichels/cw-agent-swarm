import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry, ToolMetadata } from './registry';
import path from 'path';
import fs from 'fs/promises';

/**
 * Possible tool templates for different purposes
 */
export enum ToolTemplate {
  API_CLIENT = 'api_client',
  DATA_PROCESSOR = 'data_processor',
  FILE_SYSTEM = 'file_system',
  SEARCH = 'search',
  TRANSFORMATION = 'transformation',
  UTILITY = 'utility'
}

/**
 * Input parameters for tool generation
 */
export interface ToolGenerationParams {
  name: string;
  description: string;
  purpose: string;
  capabilities: string[];
  category?: string;
  inputs?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  outputDescription?: string;
  template?: ToolTemplate;
  exampleUsage?: string;
}

/**
 * Represents a generated tool
 */
export interface GeneratedTool {
  name: string;
  code: string;
  metadata: ToolMetadata;
  path?: string;
  description?: string;
  category?: string;
  implementation?: string;
}

/**
 * ToolSynthesis class for generating new tools
 */
export class ToolSynthesis {
  private registry: ToolRegistry;
  private model: ChatOpenAI;
  private outputDir: string;
  private sandboxDir: string;
  
  constructor(options: {
    registry: ToolRegistry;
    model: ChatOpenAI;
    outputDir?: string;
    sandboxDir?: string;
  }) {
    this.registry = options.registry;
    this.model = options.model;
    this.outputDir = options.outputDir || path.join(process.cwd(), 'data/tool-metadata');
    this.sandboxDir = options.sandboxDir || path.join(process.cwd(), 'data/tool-sandbox');
    
    // Create necessary directories
    this.ensureDirectories().catch(console.error);
  }
  
  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(this.sandboxDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }
  
  /**
   * Save a tool code to file
   */
  private async saveToolToFile(name: string, code: string): Promise<string> {
    const filePath = path.join(this.sandboxDir, `${name}.ts`);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }
  
  /**
   * Get the template for a tool based on its type
   */
  private getTemplateForTool(templateType: ToolTemplate | string): Promise<string> {
    // Convert string to enum if needed
    const template = typeof templateType === 'string' 
      ? (Object.values(ToolTemplate).includes(templateType as any) 
          ? templateType as ToolTemplate 
          : ToolTemplate.UTILITY)
      : templateType;
    
    return this.getTemplateCode(template);
  }
  
  /**
   * Extract text content from model response
   */
  private extractTextFromResponse(response: { content: string }, pattern: RegExp | null = null): string {
    const content = response.content;
    if (!pattern) return content;

    const match = content.match(pattern);
    return match ? match[1] : content;
  }

  /**
   * Generate a new tool based on a natural language description
   */
  async generateToolFromDescription(toolDescription: string): Promise<GeneratedTool | null> {
    try {
      // Infer the tool parameters from the description
      const parameters = await this.inferToolParameters(toolDescription);
      if (!parameters) {
        console.error('Failed to infer tool parameters from description');
        return null;
      }

      // Generate the tool code
      const toolCode = await this.generateTool(parameters, toolDescription);
      if (!toolCode) {
        console.error('Failed to generate tool code');
        return null;
      }

      // Save the tool to a file
      const toolPath = await this.saveToolToFile(parameters.name, toolCode);
      
      // Create tool metadata including required fields from the registry definition
      const toolMetadata: ToolMetadata = {
        name: parameters.name,
        description: parameters.description,
        category: parameters.category || 'UTILITY',
        capabilities: parameters.capabilities || [],
        inputs: [],
        outputs: [],
        successMetrics: [],
        examples: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        author: 'Chloe',
        tags: [],
        usageCount: 0,
        successRate: 0,
        avgExecutionTime: 0,
        status: 'experimental'
      };

      // Attempt to register the tool
      try {
        // Create a dummy implementation for registration
        const dummyTool = {
          name: parameters.name,
          description: parameters.description,
          schema: {},
          _call: async () => ({ result: "Not implemented" })
        };
        
        this.registry.registerTool(dummyTool as any, toolMetadata);
        console.log(`Tool ${parameters.name} registered successfully`);
      } catch (error) {
        console.error('Failed to register tool:', error);
        // Continue execution even if registration fails
      }

      return {
        name: parameters.name,
        code: toolCode,
        metadata: toolMetadata,
        path: toolPath,
        description: parameters.description,
        category: parameters.category
      };
    } catch (error: unknown) {
      console.error('Error in generateToolFromDescription:', error);
      return null;
    }
  }
  
  /**
   * Infers the tool parameters from a natural language description
   */
  private async inferToolParameters(description: string): Promise<ToolGenerationParams | null> {
    try {
      const prompt = `
Analyze the following tool description and extract structured parameters:
${description}

Return a JSON object with the following properties:
- name: A concise, camelCase name for the tool (e.g., "webSearch", "calculateMortgage")
- description: A clear one-sentence description of what the tool does
- category: The tool category (API_CLIENT, DATA_PROCESSOR, FILE_SYSTEM, UI_INTERACTION, KNOWLEDGE_RETRIEVAL, or CUSTOM)
- capabilities: Array of capabilities this tool provides
- inputSchema: JSON Schema for the tool's input parameters
- outputSchema: JSON Schema for the tool's output
- template: The most appropriate template (${Object.values(ToolTemplate).join(', ')})

JSON response:
`;

      const result = await this.model.invoke(prompt);
      
      try {
        // Parse the result as JSON
        let jsonResult;
        const jsonText = this.extractTextFromResponse(result, /```json\n([\s\S]*?)\n```/) || 
                         this.extractTextFromResponse(result, /```([\s\S]*?)```/) || 
                         result.content;
        
        jsonResult = JSON.parse(jsonText);
        
        // Validate the parsed JSON against expected structure
        if (!jsonResult.name || !jsonResult.description) {
          console.error('Missing required properties in inferred parameters');
          return null;
        }
        
        return jsonResult as ToolGenerationParams;
      } catch (parseError) {
        console.error('Failed to parse result as JSON:', parseError);
        console.debug('Raw result:', result);
        return null;
      }
    } catch (error: unknown) {
      console.error('Error in inferToolParameters:', error);
      return null;
    }
  }
  
  /**
   * Generates tool code based on parameters and description
   */
  private async generateTool(parameters: ToolGenerationParams, description: string): Promise<string | null> {
    try {
      const template = await this.getTemplateForTool(parameters.template || parameters.category || ToolTemplate.UTILITY);
      
      const prompt = `
Generate a TypeScript implementation for a tool with the following parameters:
${JSON.stringify(parameters, null, 2)}

Original description: ${description}

Use this template as a starting point:
${template}

Create a complete, functional implementation with proper error handling and documentation.
The tool should export a default class that extends BaseTool or implements the Tool interface.
Ensure the tool handles edge cases and provides clear error messages.

Return ONLY the complete TypeScript code with no additional explanation.
`;

      const result = await this.model.invoke(prompt);
      
      // Extract the code from the model's response
      return this.extractTextFromResponse(result, /```typescript\n([\s\S]*?)\n```/) || 
             this.extractTextFromResponse(result, /```ts\n([\s\S]*?)\n```/) || 
             result.content;
    } catch (error: unknown) {
      console.error('Error in generateTool:', error);
      return null;
    }
  }
  
  /**
   * Get template code for a specific template type
   */
  private async getTemplateCode(template: ToolTemplate): Promise<string> {
    switch (template) {
      case ToolTemplate.API_CLIENT:
        return `
import { Tool } from '@langchain/core/tools';
import axios from 'axios';

/**
 * Tool for making API requests to external services
 */
export class ApiClientTool extends Tool {
  name = 'ApiClientTool';
  description = 'Makes requests to external APIs and returns the response';
  
  constructor(private baseUrl: string = '') {
    super();
  }
  
  /**
   * Make a request to an API
   * @param input - The input parameters
   * @returns The API response data
   */
  async _call(input: { 
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, any>;
    data?: Record<string, any>;
    headers?: Record<string, string>;
  }): Promise<any> {
    try {
      const { endpoint, method = 'GET', params, data, headers } = input;
      const url = this.baseUrl ? \`\${this.baseUrl}\${endpoint}\` : endpoint;
      
      const response = await axios({
        url,
        method,
        params,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(\`API request failed: \${error.message}. Status: \${error.response?.status || 'unknown'}\`);
      }
      throw new Error(\`API request failed: \${error.message}\`);
    }
  }
}`;

      case ToolTemplate.DATA_PROCESSOR:
        return `
import { Tool } from '@langchain/core/tools';

/**
 * Tool for processing and transforming data
 */
export class DataProcessorTool extends Tool {
  name = 'DataProcessorTool';
  description = 'Processes and transforms data structures';
  
  /**
   * Process data based on specified operations
   * @param input - The input parameters
   * @returns The processed data
   */
  async _call(input: { 
    data: any; 
    operation: 'filter' | 'map' | 'sort' | 'group' | 'extract';
    criteria?: string | Record<string, any>;
    targetField?: string;
  }): Promise<any> {
    try {
      const { data, operation, criteria, targetField } = input;
      
      if (!data) {
        throw new Error('No data provided');
      }
      
      switch (operation) {
        case 'filter':
          return this.filterData(data, criteria);
          
        case 'map':
          return this.mapData(data, targetField);
          
        case 'sort':
          return this.sortData(data, targetField, criteria as 'asc' | 'desc');
          
        case 'group':
          return this.groupData(data, targetField);
          
        case 'extract':
          return this.extractData(data, targetField);
          
        default:
          throw new Error(\`Unsupported operation: \${operation}\`);
      }
    } catch (error) {
      throw new Error(\`Data processing failed: \${error.message}\`);
    }
  }
  
  private filterData(data: any[], criteria: any): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array for filtering');
    }
    
    if (typeof criteria === 'string') {
      // Simple string matching
      return data.filter(item => 
        JSON.stringify(item).toLowerCase().includes(criteria.toLowerCase())
      );
    } else if (typeof criteria === 'object') {
      // Object property matching
      return data.filter(item => {
        for (const [key, value] of Object.entries(criteria)) {
          if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    throw new Error('Invalid filter criteria');
  }
  
  private mapData(data: any[], targetField?: string): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array for mapping');
    }
    
    if (targetField) {
      return data.map(item => item[targetField]);
    }
    
    return data;
  }
  
  private sortData(data: any[], targetField?: string, direction: 'asc' | 'desc' = 'asc'): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array for sorting');
    }
    
    const sorted = [...data].sort((a, b) => {
      const valueA = targetField ? a[targetField] : a;
      const valueB = targetField ? b[targetField] : b;
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB);
      }
      
      return valueA - valueB;
    });
    
    return direction === 'desc' ? sorted.reverse() : sorted;
  }
  
  private groupData(data: any[], targetField: string): Record<string, any[]> {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array for grouping');
    }
    
    if (!targetField) {
      throw new Error('Target field is required for grouping');
    }
    
    return data.reduce((groups, item) => {
      const key = item[targetField];
      if (!key) return groups;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(item);
      return groups;
    }, {});
  }
  
  private extractData(data: any, targetField: string): any {
    if (!targetField) {
      throw new Error('Target field is required for extraction');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.extractNestedField(item, targetField));
    }
    
    return this.extractNestedField(data, targetField);
  }
  
  private extractNestedField(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }
}`;

      case ToolTemplate.FILE_SYSTEM:
        return `
import { Tool } from '@langchain/core/tools';
import fs from 'fs/promises';
import path from 'path';

/**
 * Tool for interacting with the file system
 */
export class FileSystemTool extends Tool {
  name = 'FileSystemTool';
  description = 'Interacts with the file system (read, write, list files)';
  
  constructor(private basePath: string = process.cwd()) {
    super();
  }
  
  /**
   * Execute file system operations
   * @param input - The input parameters
   * @returns The operation result
   */
  async _call(input: { 
    operation: 'read' | 'write' | 'list' | 'exists' | 'mkdir' | 'delete';
    path: string;
    content?: string;
    encoding?: BufferEncoding;
  }): Promise<any> {
    try {
      const { operation, path: filePath, content, encoding = 'utf-8' } = input;
      const fullPath = this.resolvePath(filePath);
      
      // Security check - ensure path is within allowed directory
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Access denied: Path is outside the allowed directory');
      }
      
      switch (operation) {
        case 'read':
          return await this.readFile(fullPath, encoding);
          
        case 'write':
          if (!content) {
            throw new Error('Content is required for write operation');
          }
          await this.writeFile(fullPath, content, encoding);
          return { success: true, path: fullPath };
          
        case 'list':
          return await this.listFiles(fullPath);
          
        case 'exists':
          return await this.fileExists(fullPath);
          
        case 'mkdir':
          await this.createDirectory(fullPath);
          return { success: true, path: fullPath };
          
        case 'delete':
          await this.deleteFile(fullPath);
          return { success: true, path: fullPath };
          
        default:
          throw new Error(\`Unsupported operation: \${operation}\`);
      }
    } catch (error) {
      throw new Error(\`File system operation failed: \${error.message}\`);
    }
  }
  
  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.basePath, filePath);
  }
  
  private isPathSafe(fullPath: string): boolean {
    const normalizedPath = path.normalize(fullPath);
    const normalizedBasePath = path.normalize(this.basePath);
    return normalizedPath.startsWith(normalizedBasePath);
  }
  
  private async readFile(filePath: string, encoding: BufferEncoding): Promise<string> {
    try {
      return await fs.readFile(filePath, { encoding });
    } catch (error) {
      throw new Error(\`Failed to read file: \${error.message}\`);
    }
  }
  
  private async writeFile(filePath: string, content: string, encoding: BufferEncoding): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });
      
      await fs.writeFile(filePath, content, { encoding });
    } catch (error) {
      throw new Error(\`Failed to write file: \${error.message}\`);
    }
  }
  
  private async listFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files;
    } catch (error) {
      throw new Error(\`Failed to list files: \${error.message}\`);
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(\`Failed to create directory: \${error.message}\`);
    }
  }
  
  private async deleteFile(filePath: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      throw new Error(\`Failed to delete file: \${error.message}\`);
    }
  }
}`;

      case ToolTemplate.SEARCH:
        return `
import { Tool } from '@langchain/core/tools';

/**
 * Tool for searching through data sources
 */
export class SearchTool extends Tool {
  name = 'SearchTool';
  description = 'Searches through specified data sources and returns relevant results';
  
  /**
   * Perform a search
   * @param input - The input parameters
   * @returns The search results
   */
  async _call(input: { 
    query: string;
    sources?: string[];
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<any> {
    try {
      const { query, sources = ['default'], limit = 10, filters = {} } = input;
      
      if (!query) {
        throw new Error('No query provided');
      }
      
      // This is a placeholder - replace with actual search implementation
      const results = await Promise.all(
        sources.map(source => this.searchSource(source, query, filters, limit))
      );
      
      const flatResults = results.flat();
      
      // Deduplicate and limit results
      const uniqueResults = this.deduplicateResults(flatResults);
      return uniqueResults.slice(0, limit);
    } catch (error) {
      throw new Error(\`Search failed: \${error.message}\`);
    }
  }
  
  private async searchSource(
    source: string, 
    query: string, 
    filters: Record<string, any>,
    limit: number
  ): Promise<any[]> {
    // Implement search for different sources
    // This is a placeholder - replace with actual implementation
    return [
      {
        id: '1',
        title: \`Placeholder result for \${query} from \${source}\`,
        snippet: 'This is a placeholder result.',
        source: source,
        relevance: 0.9
      }
    ];
  }
  
  private deduplicateResults(results: any[]): any[] {
    const seen = new Set();
    return results.filter(item => {
      const key = item.id || JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}`;

      case ToolTemplate.TRANSFORMATION:
        return `
import { Tool } from '@langchain/core/tools';

/**
 * Tool for transforming data between different formats
 */
export class TransformationTool extends Tool {
  name = 'TransformationTool';
  description = 'Transforms data between different formats (JSON, XML, CSV, etc.)';
  
  /**
   * Transform data between formats
   * @param input - The input parameters
   * @returns The transformed data
   */
  async _call(input: { 
    data: string;
    inputFormat: 'json' | 'xml' | 'csv' | 'yaml' | 'text';
    outputFormat: 'json' | 'xml' | 'csv' | 'yaml' | 'text';
    options?: Record<string, any>;
  }): Promise<string> {
    try {
      const { data, inputFormat, outputFormat, options = {} } = input;
      
      if (!data) {
        throw new Error('No data provided');
      }
      
      // Parse the input data
      const parsedData = this.parseData(data, inputFormat);
      
      // Transform to the output format
      return this.formatData(parsedData, outputFormat, options);
    } catch (error) {
      throw new Error(\`Transformation failed: \${error.message}\`);
    }
  }
  
  private parseData(data: string, format: string): any {
    switch (format) {
      case 'json':
        try {
          return JSON.parse(data);
        } catch (error) {
          throw new Error(\`Invalid JSON: \${error.message}\`);
        }
        
      case 'csv':
        return this.parseCsv(data);
        
      case 'xml':
        return this.parseXml(data);
        
      case 'yaml':
        return this.parseYaml(data);
        
      case 'text':
        return data;
        
      default:
        throw new Error(\`Unsupported input format: \${format}\`);
    }
  }
  
  private formatData(data: any, format: string, options: Record<string, any>): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, options.indent || 2);
        
      case 'csv':
        return this.formatCsv(data, options);
        
      case 'xml':
        return this.formatXml(data, options);
        
      case 'yaml':
        return this.formatYaml(data, options);
        
      case 'text':
        return String(data);
        
      default:
        throw new Error(\`Unsupported output format: \${format}\`);
    }
  }
  
  // CSV parsing and formatting
  private parseCsv(csv: string): any[] {
    const lines = csv.split('\\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const entry = {};
      
      headers.forEach((header, index) => {
        entry[header] = values[index] || '';
      });
      
      result.push(entry);
    }
    
    return result;
  }
  
  private formatCsv(data: any, options: Record<string, any>): string {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array to format as CSV');
    }
    
    if (data.length === 0) {
      return '';
    }
    
    const headers = options.headers || Object.keys(data[0]);
    const rows = [headers];
    
    for (const item of data) {
      const row = headers.map(header => {
        const value = item[header] || '';
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return \`"\${value.replace(/"/g, '""')}"\`;
        }
        return value;
      });
      
      rows.push(row);
    }
    
    return rows.map(row => row.join(',')).join('\\n');
  }
  
  // XML parsing and formatting - simplified versions
  private parseXml(xml: string): any {
    // This is a very simplified XML parser
    // In a real implementation, use a proper XML parser library
    throw new Error('XML parsing not implemented in this template');
  }
  
  private formatXml(data: any, options: Record<string, any>): string {
    // This is a very simplified XML formatter
    // In a real implementation, use a proper XML formatter library
    throw new Error('XML formatting not implemented in this template');
  }
  
  // YAML parsing and formatting - simplified versions
  private parseYaml(yaml: string): any {
    // This is a placeholder
    // In a real implementation, use a proper YAML parser library
    throw new Error('YAML parsing not implemented in this template');
  }
  
  private formatYaml(data: any, options: Record<string, any>): string {
    // This is a placeholder
    // In a real implementation, use a proper YAML formatter library
    throw new Error('YAML formatting not implemented in this template');
  }
}`;

      case ToolTemplate.UTILITY:
      default:
        return `
import { Tool } from '@langchain/core/tools';

/**
 * A utility tool for generic operations
 */
export class UtilityTool extends Tool {
  name = 'UtilityTool';
  description = 'A general purpose utility tool';
  
  /**
   * Execute the utility function
   * @param input - The input parameters
   * @returns The function result
   */
  async _call(input: string | { [key: string]: any }): Promise<any> {
    try {
      // Parse input if it's a string
      const params = typeof input === 'string' 
        ? { input } 
        : input;
      
      // Implement your utility function here
      return {
        result: \`Processed: \${JSON.stringify(params)}\`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(\`Utility operation failed: \${error.message}\`);
    }
  }
}`;
    }
  }
  
  /**
   * Save a generated tool to disk and register it with the registry
   */
  async saveAndRegisterTool(tool: GeneratedTool): Promise<string> {
    try {
      // Create directories if they don't exist
      await this.ensureDirectories();
      
      // Save the tool code to a file in the sandbox directory first
      const sandboxPath = path.join(this.sandboxDir, `${tool.name}.ts`);
      await fs.writeFile(sandboxPath, tool.code, 'utf-8');
      
      // Save metadata to the output directory
      const metadataPath = path.join(this.outputDir, `${tool.name}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(tool.metadata, null, 2), 'utf-8');
      
      // Convert TypeScript to JavaScript (this is a simplified approach)
      const jsCode = tool.code
        .replace(/import\s+{\s*Tool\s*}\s+from\s+['"]@langchain\/core\/tools['"];?/g, 
                'const { Tool } = require("@langchain/core/tools");')
        .replace(/import\s+(\S+)\s+from\s+(['"])([^'"]+)\2;?/g, 
                'const $1 = require("$3");')
        .replace(/export\s+(default\s+)?/g, 'module.exports = ')
        .replace(/:\s*[A-Za-z<>\[\]|]+/g, '') // Remove TypeScript type annotations
        .replace(/<[A-Za-z<>\[\]|,\s]+>/g, ''); // Remove generic type parameters
      
      // Save the JavaScript version to the output directory
      const jsPath = path.join(this.outputDir, `${tool.name}.js`);
      await fs.writeFile(jsPath, jsCode, 'utf-8');
      
      console.log(`Tool saved to ${jsPath} and ${metadataPath}`);
      
      // Register the tool with the registry - don't try to use the private createToolFromImplementation
      try {
        // Use require to load the JS implementation
        // This is a simplified approach - in production, would need more robust loading
        const implementation = require(jsPath);
        
        // Create an instance and register it
        let toolInstance;
        try {
          // Try to create a new instance if it's a class
          toolInstance = new implementation();
        } catch (instanceError) {
          // If that fails, use the implementation directly
          toolInstance = implementation;
        }
        
        if (toolInstance) {
          this.registry.registerTool(toolInstance, tool.metadata);
          console.log(`Tool ${tool.name} registered successfully`);
        } else {
          console.error(`Failed to create tool instance for ${tool.name}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error registering tool with registry: ${errorMessage}`);
      }
      
      // Return the JavaScript path
      return jsPath;
    } catch (error: unknown) {
      console.error('Error saving and registering tool:', error);
      throw error;
    }
  }
  
  /**
   * Test a generated tool in the sandbox environment
   */
  async testTool(tool: GeneratedTool, testInput: any): Promise<any> {
    try {
      // Save to sandbox directory
      const sandboxPath = path.join(this.sandboxDir, `${tool.name}.ts`);
      await fs.writeFile(sandboxPath, tool.code, 'utf-8');
      
      // Convert TypeScript to JavaScript (simplified approach)
      const jsCode = tool.code
        .replace(/import\s+{\s*Tool\s*}\s+from\s+['"]@langchain\/core\/tools['"];?/g, 
                'const { Tool } = require("@langchain/core/tools");')
        .replace(/import\s+(\S+)\s+from\s+(['"])([^'"]+)\2;?/g, 
                'const $1 = require("$3");')
        .replace(/export\s+(default\s+)?/g, 'module.exports = ')
        .replace(/:\s*[A-Za-z<>\[\]|]+/g, '') // Remove TypeScript type annotations
        .replace(/<[A-Za-z<>\[\]|,\s]+>/g, ''); // Remove generic type parameters
      
      const jsPath = path.join(this.sandboxDir, `${tool.name}.js`);
      await fs.writeFile(jsPath, jsCode, 'utf-8');
      
      // Load the tool
      // This is simplified - in a real implementation, use proper sandbox techniques
      const ToolClass = require(jsPath);
      const toolInstance = typeof ToolClass === 'function' ? new ToolClass() : ToolClass;
      
      if (!toolInstance || typeof toolInstance._call !== 'function') {
        throw new Error('Invalid tool implementation');
      }
      
      // Test the tool
      const startTime = Date.now();
      let result;
      let success = false;
      
      try {
        result = await toolInstance._call(testInput);
        success = true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result = { error: errorMessage };
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success,
        executionTime,
        result,
        input: testInput
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error testing tool:', error);
      return {
        success: false,
        error: errorMessage,
        input: testInput
      };
    }
  }
} 