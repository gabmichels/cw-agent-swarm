/**
 * ToolIntegrationService - Handles tool integration with agents
 * 
 * This service provides a streamlined interface for managing tools across agents,
 * focusing on core tool management functionality.
 */

import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { Tool, ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import { ManagerType } from '../../../agents/shared/base/managers/ManagerType';
import { logger } from '../../../lib/logging';

/**
 * Service for integrating tools with agents
 */
export class ToolIntegrationService {
  /**
   * Register a tool with an agent
   * 
   * @param agent The agent to register the tool with
   * @param tool The tool to register
   * @returns Promise resolving to the registered tool
   */
  async registerTool(agent: AgentBase, tool: Tool): Promise<Tool> {
    try {
      logger.debug(`Registering tool ${tool.id} with agent ${agent.getAgentId()}`);
      
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      const registeredTool = await toolManager.registerTool(tool);
      logger.debug(`Successfully registered tool ${tool.id}`);
      
      return registeredTool;
    } catch (error) {
      logger.error(`Failed to register tool ${tool.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Unregister a tool from an agent
   * 
   * @param agent The agent to unregister the tool from
   * @param toolId The ID of the tool to unregister
   * @returns Promise resolving to true if unregistered, false if not found
   */
  async unregisterTool(agent: AgentBase, toolId: string): Promise<boolean> {
    try {
      logger.debug(`Unregistering tool ${toolId} from agent ${agent.getAgentId()}`);
      
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      const result = await toolManager.unregisterTool(toolId);
      
      if (result) {
        logger.debug(`Successfully unregistered tool ${toolId}`);
      } else {
        logger.warn(`Tool ${toolId} not found for unregistration`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to unregister tool ${toolId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get tools from an agent matching the filter criteria
   * 
   * @param agent The agent to get tools from
   * @param filter Optional filter criteria
   * @returns Promise resolving to matching tools
   */
  async getTools(
    agent: AgentBase,
    filter?: {
      enabled?: boolean;
      categories?: string[];
      capabilities?: string[];
      experimental?: boolean;
    }
  ): Promise<Tool[]> {
    try {
      logger.debug(`Getting tools from agent ${agent.getAgentId()}`);
      
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      const tools = await toolManager.getTools(filter);
      logger.debug(`Retrieved ${tools.length} tools`);
      
      return tools;
    } catch (error) {
      logger.error('Failed to get tools:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific tool from an agent
   * 
   * @param agent The agent to get the tool from
   * @param toolId The ID of the tool to get
   * @returns Promise resolving to the tool or null if not found
   */
  async getTool(agent: AgentBase, toolId: string): Promise<Tool | null> {
    try {
      logger.debug(`Getting tool ${toolId} from agent ${agent.getAgentId()}`);
      
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error(`Agent ${agent.getAgentId()} does not have a tool manager`);
      }
      
      const tool = await toolManager.getTool(toolId);
      
      if (tool) {
        logger.debug(`Successfully retrieved tool ${toolId}`);
      } else {
        logger.debug(`Tool ${toolId} not found`);
      }
      
      return tool;
    } catch (error) {
      logger.error(`Failed to get tool ${toolId}:`, error);
      throw error;
    }
  }
} 