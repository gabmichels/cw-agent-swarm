/**
 * Implementation of tool registry for managing available tools
 */
import { IToolRegistry } from '../interfaces/tool-registry.interface';
import { Tool } from '../types';

export class ToolRegistry implements IToolRegistry {
  /**
   * Map of registered tools by ID
   */
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool with the registry
   * @param tool Tool to register
   * @throws Error if a tool with the same ID is already registered
   */
  registerTool(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID ${tool.id} is already registered`);
    }
    
    // Validate the tool has all required properties
    if (!tool.id || !tool.name || !tool.description || !tool.execute) {
      throw new Error(`Tool is missing required properties`);
    }
    
    this.tools.set(tool.id, tool);
  }

  /**
   * Register multiple tools at once
   * @param tools Array of tools to register
   * @throws Error if any tool registration fails
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Get a tool by its ID
   * @param toolId Unique identifier of the tool
   * @returns The tool if found, null otherwise
   */
  getTool(toolId: string): Tool | null {
    return this.tools.get(toolId) || null;
  }

  /**
   * Get all registered tools
   * @returns Array of all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Find tools matching specific criteria
   * @param criteria Search criteria for tools
   * @returns Array of matching tools
   */
  findTools(criteria: Partial<Tool>): Tool[] {
    return this.getAllTools().filter(tool => {
      // Check each criterion against the tool
      for (const [key, value] of Object.entries(criteria)) {
        // Skip if tool doesn't have the property or values don't match
        if (!(key in tool) || tool[key as keyof Tool] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if a tool with given ID exists
   * @param toolId Unique identifier of the tool
   * @returns True if tool exists, false otherwise
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Remove a tool from the registry
   * @param toolId Unique identifier of the tool to remove
   * @returns True if tool was removed, false if not found
   */
  removeTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }
} 