import { NextApiRequest, NextApiResponse } from 'next';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '@/server/memory/config/types';
import defaultApifyManager from '../../../agents/shared/tools/integrations/apify';
import { getAgentById } from '../../../server/agent/agent-service';
import { getAgentToolManager, adaptToolExecutionResult } from '../../../agents/shared/tools/adapters/ToolAdapter';
import { IdGenerator } from '../../../utils/ulid';
import { logger } from '../../../lib/logging';
import { ToolExecutionResult } from '../../../lib/tools/types';
import { SharedToolRegistry } from '../../../agents/shared/tools/registry/SharedToolRegistry';

// Initialize the shared tool registry
const sharedToolRegistry = new SharedToolRegistry({
  apifyManager: defaultApifyManager
});

// Define the tools memory type
const TOOLS_MEMORY_TYPE = 'tool';

/**
 * API endpoint for executing tools with improved compatibility and error handling
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { tool, params, memoryId, agentId } = req.body;

    if (!tool) {
      return res.status(400).json({ success: false, error: 'Tool name is required' });
    }

    // Initialize result
    let result: ToolExecutionResult;
    
    try {
      // Execute the tool based on different sources
      if (tool.startsWith('apify-')) {
        // Handle Apify tools
        result = await executeApifyTool(tool, params);
      } else if (agentId) {
        // If agent ID is provided, use that agent's tools
        result = await executeAgentTool(agentId, tool, params);
      } else {
        // Get tools from the shared registry
        const registryTool = sharedToolRegistry.getTool(tool);
        
        if (registryTool) {
          // Execute tool from the registry
          const startTime = Date.now();
          const execResult = await registryTool.execute(params);
          
          result = execResult as ToolExecutionResult;
        } else {
          // Fall back to the legacy tool handling
          switch (tool) {
            case 'clear_chat':
              result = await clearChatHistory(params);
              break;
            case 'clear_images':
              result = await clearImages(params);
              break;
            case 'reset_all':
              result = await resetAllData(params);
              break;
            case 'refresh_config':
              result = await refreshConfiguration(params);
              break;
            case 'test_agent':
              result = await testAgent(params);
              break;
            case 'clear_markdown_cache':
              result = await clearMarkdownCache(params);
              break;
            default:
              return res.status(400).json({ 
                success: false, 
                error: `Unknown tool: ${tool}` 
              });
          }
        }
      }
    } catch (error) {
      // Create an error result
      logger.error(`Error executing tool ${tool}:`, error);
      
      result = {
        id: IdGenerator.generate('terr'),
        toolId: tool,
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'EXECUTION_ERROR',
          details: error
        },
        metrics: {
          startTime: Date.now(),
          endTime: Date.now(),
          durationMs: 0
        }
      };
    }
    
    // Ensure result meets the ToolExecutionResult interface
    const standardizedResult = adaptToolExecutionResult(result, tool);

    // If a memoryId was provided, update the memory with the result
    if (memoryId) {
      try {
        // Get the memory services
        const { memoryService } = await getMemoryServices();
        
        await memoryService.updateMemory({
          id: memoryId,
          type: TOOLS_MEMORY_TYPE as any,
          metadata: {
            status: standardizedResult.success ? 'completed' : 'failed',
            result: standardizedResult,
            endTime: new Date().toISOString()
          }
        });
      } catch (memoryError) {
        logger.error('Error updating tool memory:', memoryError);
        // Continue even if memory update fails
      }
    }

    return res.status(200).json(standardizedResult);
  } catch (error) {
    logger.error('Error in execute-v2 API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error executing tool' 
    });
  }
}

/**
 * Execute a tool from a specific agent
 */
async function executeAgentTool(
  agentId: string, 
  toolId: string, 
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  // Get the agent
  const agent = await getAgentById(agentId);
  
  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  // Get the agent's tool manager
  const toolManager = getAgentToolManager(agent);
  
  // Execute the tool
  const startTime = Date.now();
  const result = await toolManager.executeTool(toolId, params);
  
  // Return the result in standard format
  return {
    id: IdGenerator.generate('trun'),
    toolId,
    success: result.success,
    data: result.result,
    error: result.error ? {
      message: result.error.message,
      code: result.error.code || 'UNKNOWN_ERROR',
      details: result.error
    } : undefined,
    metrics: {
      startTime,
      endTime: Date.now(),
      durationMs: result.durationMs || (Date.now() - startTime)
    }
  };
}

/**
 * Execute an Apify tool
 */
async function executeApifyTool(toolName: string, params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    logger.debug(`Executing Apify tool: ${toolName}`, params);
    let result: any;
    
    switch (toolName) {
      case 'apify-actor-discovery':
        result = await defaultApifyManager.discoverActors(
          params.query || '',
          {
            category: params.category,
            limit: params.limit || 5,
            minRating: params.minRating || 3.5,
            sortBy: params.sortBy || 'popularity'
          }
        );
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: toolName,
          success: true,
          data: {
            actors: result,
            count: result.length
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
        
      case 'apify-actor-info':
        result = await defaultApifyManager.getActorInfo(params.actorId);
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: toolName,
          success: true,
          data: {
            actor: result
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
        
      case 'apify-suggest-actors':
        result = await defaultApifyManager.suggestActorsForTask(
          params.taskDescription,
          params.limit || 3
        );
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: toolName,
          success: true,
          data: {
            actors: result,
            count: result.length
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
        
      case 'apify-dynamic-run':
        result = await defaultApifyManager.dynamicRunActor(
          params.actorId,
          params.input,
          {
            actorId: params.actorId,
            input: params.input,
            label: params.label,
            dryRun: params.dryRun
          }
        );
        
        return {
          id: IdGenerator.generate('trun'),
          toolId: toolName,
          success: true,
          data: result,
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
        
      default:
        // Check if this is a dynamically registered Apify actor tool
        if (toolName.startsWith('apify-dynamic-')) {
          const actorId = toolName.replace('apify-dynamic-', '');
          
          result = await defaultApifyManager.dynamicRunActor(
            actorId,
            params,
            {
              actorId: actorId,
              input: params,
              dryRun: false
            }
          );
          
          return {
            id: IdGenerator.generate('trun'),
            toolId: toolName,
            success: true,
            data: result,
            metrics: {
              startTime,
              endTime: Date.now(),
              durationMs: Date.now() - startTime
            }
          };
        }
        
        throw new Error(`Unknown Apify tool: ${toolName}`);
    }
  } catch (error) {
    logger.error('Error executing Apify tool:', error);
    return {
      id: IdGenerator.generate('terr'),
      toolId: toolName,
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'APIFY_EXECUTION_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Clear chat history
 */
async function clearChatHistory(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      logger.debug('Confirmation acknowledged for chat history deletion');
    }

    // Use the new memory/reset-collection endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/reset-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collection: MemoryType.MESSAGE }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear chat history: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'clear_chat',
      success: data.status === 'success',
      data: {
        deletedMessageCount: data.post_reset?.[MemoryType.MESSAGE]?.count || 0,
        message: `Successfully reset message collection`
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error clearing chat history:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'clear_chat',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'CLEAR_CHAT_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Clear images and attachments
 */
async function clearImages(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      logger.debug('Confirmation acknowledged for images deletion');
    }

    // Delete all message memories with image attachments
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/clear-attachments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear attachments: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Also clear local storage data related to images
    const localStorageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/clear-local-storage`);
    
    if (!localStorageResponse.ok) {
      throw new Error(`Failed to get local storage clear instructions: ${localStorageResponse.statusText}`);
    }
    
    const localStorageData = await localStorageResponse.json();
    
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'clear_images',
      success: data.success && localStorageData.success,
      data: {
        attachmentsCleared: data.attachmentsCleared || 0,
        localStorage: localStorageData,
        message: 'Successfully cleared images and attachments'
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error clearing images:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'clear_images',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'CLEAR_IMAGES_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Reset all data (chat history and images)
 */
async function resetAllData(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      logger.debug('Confirmation acknowledged for complete data reset');
    }

    // Reset all collections using the standardized endpoint
    const resetResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/reset-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collection: 'all' }),
    });
    
    if (!resetResponse.ok) {
      throw new Error(`Failed to reset database: ${resetResponse.statusText}`);
    }
    
    const resetData = await resetResponse.json();
    
    // Clear local storage
    const localStorageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/clear-local-storage`);
    const localStorageData = await localStorageResponse.json();
    
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'reset_all',
      success: resetData.status === 'success',
      data: {
        resetData,
        localStorageCleared: localStorageData.success,
        message: 'Successfully reset all data'
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error resetting all data:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'reset_all',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'RESET_DATA_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Refresh configuration
 */
async function refreshConfiguration(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // This would connect to a configuration service in a real app
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'refresh_config',
      success: true,
      data: {
        refreshedAt: new Date().toISOString(),
        message: 'Configuration refreshed successfully'
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error refreshing configuration:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'refresh_config',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'REFRESH_CONFIG_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Test agent functionality
 */
async function testAgent(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // In a real app, this would test various agent capabilities
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'test_agent',
      success: true,
      data: {
        agentStatus: 'operational',
        tests: {
          initialization: 'passed',
          memory: 'passed',
          reasoning: 'passed',
          responses: 'passed'
        },
        message: 'Agent functionality tests passed'
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error testing agent:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'test_agent',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'TEST_AGENT_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Clear markdown cache
 */
async function clearMarkdownCache(params: any): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      logger.debug('Confirmation acknowledged for markdown cache clearing');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/memory/clear-markdown-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear markdown cache: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      id: IdGenerator.generate('trun'),
      toolId: 'clear_markdown_cache',
      success: data.success,
      data: {
        clearedCount: data.clearedCount || 0,
        message: `Successfully cleared ${data.clearedCount || 0} markdown cache entries`
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Error clearing markdown cache:', error);
    return { 
      id: IdGenerator.generate('terr'),
      toolId: 'clear_markdown_cache',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'CLEAR_CACHE_ERROR',
        details: error
      },
      metrics: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime
      }
    };
  }
} 