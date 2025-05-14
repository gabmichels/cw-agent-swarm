/**
 * ToolAdapter.ts - Adapter for tool interface compatibility
 * 
 * This file provides adapter utilities to handle the differences between
 * various tool interfaces across the system, ensuring compatibility
 * and proper type conversion.
 */

import { Tool as RegistryTool, ToolCategory, ToolExecutionResult } from '../../../../lib/tools/types';
import { Tool as ManagerTool, ToolManager } from '../../../../lib/agents/base/managers/ToolManager';
import { logger } from '../../../../lib/logging';
import { IdGenerator } from '../../../../utils/ulid';

/**
 * Adapts a registry tool to be compatible with the tool manager interface
 * 
 * @param registryTool Tool from the shared registry
 * @returns Tool compatible with tool manager
 */
export function adaptRegistryToolToManagerTool(registryTool: RegistryTool): ManagerTool {
  logger.debug(`Adapting registry tool ${registryTool.id} to manager tool format`);
  
  return {
    id: registryTool.id,
    name: registryTool.name,
    description: registryTool.description,
    // Convert single category to array of categories for ManagerTool
    categories: registryTool.category ? [registryTool.category] : [],
    enabled: registryTool.enabled,
    // Add default values for properties that exist in ManagerTool but not in RegistryTool
    capabilities: [],
    version: '1.0.0',
    experimental: false,
    costPerUse: 1,
    timeoutMs: 30000,
    metadata: registryTool.metadata,
    
    // Adapt the execute method signature
    execute: async (params: unknown, context?: unknown): Promise<unknown> => {
      try {
        // Convert params to Record<string, unknown> as expected by registry tool
        const typedParams = params as Record<string, unknown>;
        
        // Call the original execute method
        const result = await registryTool.execute(typedParams);
        
        // Return the result data
        return result.data || result;
      } catch (error) {
        // Log and re-throw the error
        logger.error(`Error executing adapted tool ${registryTool.id}:`, error);
        throw error;
      }
    }
  };
}

/**
 * Adapts a manager tool result to ensure it meets ToolExecutionResult interface
 * 
 * @param result Result from tool execution
 * @param toolId ID of the tool that produced the result
 * @returns Standardized tool execution result
 */
export function adaptToolExecutionResult(result: unknown, toolId: string): ToolExecutionResult {
  try {
    // If result is already a ToolExecutionResult, return it
    if (
      result && 
      typeof result === 'object' &&
      'success' in result &&
      'toolId' in result
    ) {
      return result as ToolExecutionResult;
    }
    
    // Generate a proper structured ID for the result
    const resultId = IdGenerator.generate('trun');
    const now = Date.now();
    
    // Otherwise, create a standardized result
    return {
      id: resultId,
      toolId,
      success: true,
      data: result,
      metrics: {
        startTime: now,
        endTime: now,
        durationMs: 0
      }
    };
  } catch (error) {
    // If adaptation fails, return an error result
    logger.error(`Error adapting tool result for ${toolId}:`, error);
    
    // Generate a proper structured ID for the error result
    const errorId = IdGenerator.generate('terr');
    const now = Date.now();
    
    return {
      id: errorId,
      toolId,
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'ADAPTATION_ERROR',
        details: error
      },
      metrics: {
        startTime: now,
        endTime: now,
        durationMs: 0
      }
    };
  }
}

/**
 * Gets a tool manager from an agent, safely handling errors
 * 
 * @param agent The agent to get the tool manager from
 * @param defaultErrorMessage Optional custom error message
 * @returns The tool manager, or throws an error if not found
 */
export function getAgentToolManager(agent: any, defaultErrorMessage?: string): ToolManager {
  if (!agent) {
    throw new Error(defaultErrorMessage || 'Agent not found');
  }
  
  try {
    // Use getManager method if available (preferred approach)
    if (typeof agent.getManager === 'function') {
      const toolManager = agent.getManager('tool') as ToolManager;
      
      if (!toolManager) {
        throw new Error(defaultErrorMessage || `Agent ${agent.getAgentId?.() || 'unknown'} does not have a tool manager`);
      }
      
      return toolManager;
    }
    
    // Legacy fallback: direct property access
    if (agent.toolManager) {
      logger.warn(`Accessing toolManager property directly on agent ${agent.getAgentId?.() || 'unknown'} - consider updating to use getManager('tool')`);
      return agent.toolManager as ToolManager;
    }
    
    throw new Error(defaultErrorMessage || `Agent ${agent.getAgentId?.() || 'unknown'} does not have a tool manager`);
  } catch (error) {
    // Enhanced error messaging with agent info
    const agentId = agent.getAgentId?.() || agent.id || 'unknown';
    const errorMsg = defaultErrorMessage || `Failed to get tool manager for agent ${agentId}`;
    
    logger.error(errorMsg, error);
    throw new Error(errorMsg);
  }
} 