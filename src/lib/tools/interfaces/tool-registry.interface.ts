/**
 * Interface for Tool Registry - responsible for tool registration and lookup
 */
import { Tool } from '../types';

export interface IToolRegistry {
  /**
   * Register a tool with the registry
   * @param tool Tool to register
   */
  registerTool(tool: Tool): void;

  /**
   * Register multiple tools at once
   * @param tools Array of tools to register
   */
  registerTools(tools: Tool[]): void;

  /**
   * Get a tool by its ID
   * @param toolId Unique identifier of the tool
   * @returns The tool if found, null otherwise
   */
  getTool(toolId: string): Tool | null;

  /**
   * Get all registered tools
   * @returns Array of all registered tools
   */
  getAllTools(): Tool[];

  /**
   * Find tools matching specific criteria
   * @param criteria Search criteria for tools
   * @returns Array of matching tools
   */
  findTools(criteria: Partial<Tool>): Tool[];

  /**
   * Check if a tool with given ID exists
   * @param toolId Unique identifier of the tool
   * @returns True if tool exists, false otherwise
   */
  hasTool(toolId: string): boolean;

  /**
   * Remove a tool from the registry
   * @param toolId Unique identifier of the tool to remove
   * @returns True if tool was removed, false if not found
   */
  removeTool(toolId: string): boolean;
} 