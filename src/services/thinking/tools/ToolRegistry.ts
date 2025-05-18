import { IdGenerator } from '@/utils/ulid';
import { Tool } from '../../../interfaces/tools';
import { ToolService } from './ToolService';

/**
 * Tool capability information
 */
export interface ToolCapability {
  /**
   * Unique ID for the capability
   */
  id: string;
  
  /**
   * Name of the capability
   */
  name: string;
  
  /**
   * Description of what this capability provides
   */
  description: string;
  
  /**
   * Category of the capability
   */
  category: string;
  
  /**
   * Required permissions to use this capability
   */
  requiredPermissions: string[];
  
  /**
   * Metadata for the capability
   */
  metadata?: Record<string, any>;
}

/**
 * Tool version information
 */
export interface ToolVersion {
  /**
   * Version number (semver)
   */
  version: string;
  
  /**
   * When this version was released
   */
  releasedAt: Date;
  
  /**
   * Whether this version is still supported
   */
  isSupported: boolean;
  
  /**
   * Changes in this version
   */
  changes: Array<{
    /**
     * Type of change
     */
    type: 'feature' | 'bugfix' | 'improvement' | 'breaking';
    
    /**
     * Description of the change
     */
    description: string;
  }>;
  
  /**
   * Deprecation notice (if applicable)
   */
  deprecationNotice?: string;
}

// Define basic tool executor interface
type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>;

/**
 * Registry for tools and their executors.
 * Ensures that tools discovered by the system have corresponding executors.
 */
export class ToolRegistry {
  private toolService: ToolService;
  private toolExecutors: Map<string, ToolExecutor> = new Map();
  
  constructor(toolService: ToolService) {
    this.toolService = toolService;
    this.registerDefaultExecutors();
  }
  
  /**
   * Register a tool executor
   */
  registerExecutor(toolId: string, executor: ToolExecutor): void {
    this.toolExecutors.set(toolId, executor);
    // Also register with the tool service
    this.toolService.registerExecutor(toolId, executor);
  }
  
  /**
   * Register a new tool with its executor
   */
  async registerTool(
    tool: Omit<Tool, 'id'>,
    executor: ToolExecutor
  ): Promise<string> {
    // Register the tool with the tool service
    const toolId = await this.toolService.registerTool(tool);
    
    // Register the executor
    this.registerExecutor(toolId, executor);
    
    return toolId;
  }
  
  /**
   * Get executor for a tool
   */
  getExecutor(toolId: string): ToolExecutor | undefined {
    return this.toolExecutors.get(toolId);
  }
  
  /**
   * Register default executors for built-in tools
   */
  private registerDefaultExecutors(): void {
    // Register executors for common tools that might be discovered
    this.registerBasicExecutors();
    this.registerWebExecutors();
    this.registerAnalysisExecutors();
    this.registerUtilityExecutors();
  }
  
  /**
   * Register basic executors for common operations
   */
  private registerBasicExecutors(): void {
    // Basic information retrieval
    this.registerExecutor(
      'tool_01JVDFK488XH8G5YEMZ0ZJDHFC', 
      async (params) => {
        console.log('Executing basic info retrieval tool with params:', params);
        return {
          result: "Successfully retrieved basic information",
          data: { message: "This is simulated data from the basic info tool" }
        };
      }
    );
    
    // Basic action executor
    this.registerExecutor(
      'tool_01JVDFK488TPDH1W4DZTDP4Q2K',
      async (params) => {
        console.log('Executing basic action tool with params:', params);
        return {
          success: true,
          message: "Action performed successfully",
          details: { action: params.action || "default_action" }
        };
      }
    );
    
    // File operations
    this.registerExecutor(
      'file-search',
      async (params) => {
        console.log('Executing file search with params:', params);
        return {
          files: [
            { name: "example1.txt", path: "/path/to/example1.txt", snippet: "Example content..." },
            { name: "example2.txt", path: "/path/to/example2.txt", snippet: "More example content..." }
          ]
        };
      }
    );
  }
  
  /**
   * Register web-related executors
   */
  private registerWebExecutors(): void {
    // Web search
    this.registerExecutor(
      'web-search',
      async (params) => {
        console.log('Executing web search with params:', params);
        return {
          results: [
            { title: "Example result 1", url: "https://example.com/1", snippet: "Example snippet 1..." },
            { title: "Example result 2", url: "https://example.com/2", snippet: "Example snippet 2..." }
          ]
        };
      }
    );
    
    // Web scraping
    this.registerExecutor(
      'tool_01JVDFK488YN14YJ70K2M50N6Z',
      async (params) => {
        console.log('Executing web scraping tool with params:', params);
        return {
          content: "This is simulated content from a web page",
          metadata: { url: params.url || "https://example.com", timestamp: new Date().toISOString() }
        };
      }
    );
  }
  
  /**
   * Register analysis-related executors
   */
  private registerAnalysisExecutors(): void {
    // Text analysis
    this.registerExecutor(
      'text-analysis',
      async (params) => {
        console.log('Executing text analysis with params:', params);
        return {
          sentiment: "positive",
          entities: [
            { type: "person", value: "John Smith", confidence: 0.85 },
            { type: "location", value: "New York", confidence: 0.92 }
          ],
          keywords: ["example", "analysis", "text"]
        };
      }
    );
  }
  
  /**
   * Register utility executors
   */
  private registerUtilityExecutors(): void {
    // Generate a unique ID
    this.registerExecutor(
      'generate-id',
      async (params) => {
        const prefix = (params.prefix as string) || 'id';
        return {
          id: IdGenerator.generate(prefix)
        };
      }
    );
    
    // Current date/time
    this.registerExecutor(
      'get-datetime',
      async (params) => {
        const format = (params.format as string) || 'iso';
        if (format === 'iso') {
          return { datetime: new Date().toISOString() };
        } else {
          return { datetime: new Date().toString() };
        }
      }
    );
  }
} 