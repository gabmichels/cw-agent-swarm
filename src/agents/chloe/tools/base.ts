/**
 * Base class for all agent tools
 */

export interface ToolParameter {
  type: string;
  description: string;
  default?: any;
}

export interface ToolParameters {
  [key: string]: ToolParameter;
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

export abstract class BaseTool {
  public name: string;
  public description: string;
  public schema: Record<string, any>;

  constructor(
    name: string,
    description: string,
    schema: Record<string, any> = {}
  ) {
    this.name = name;
    this.description = description;
    this.schema = schema;
  }

  /**
   * Execute the tool with the provided parameters
   * @param params - Parameters for the tool execution
   */
  abstract execute(params: Record<string, any>): Promise<any>;

  /**
   * Validate the parameters against the tool's schema
   */
  validateParams(params: Record<string, any>): boolean {
    // This is a simple validation, can be extended with more complex logic
    for (const [key, def] of Object.entries(this.schema)) {
      if (params[key] === undefined && def.default === undefined) {
        throw new Error(`Missing required parameter: ${key}`);
      }
    }
    return true;
  }

  /**
   * Get the tool's metadata for use in function calling
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
    };
  }
} 