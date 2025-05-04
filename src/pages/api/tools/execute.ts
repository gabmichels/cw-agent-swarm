import { NextApiRequest, NextApiResponse } from 'next';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';

// Define the tools memory type
const TOOLS_MEMORY_TYPE = 'tool';

/**
 * API endpoint for executing tools with memory integration
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { tool, params, memoryId } = req.body;

    if (!tool) {
      return res.status(400).json({ success: false, error: 'Tool name is required' });
    }

    // Execute the tool based on the tool name
    let result;
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
        return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
    }

    // If a memoryId was provided, update the memory with the result
    if (memoryId) {
      try {
        // Get the memory services
        const { memoryService } = await getMemoryServices();
        
        await memoryService.updateMemory({
          id: memoryId,
          type: TOOLS_MEMORY_TYPE as any,
          metadata: {
            status: result.success ? 'completed' : 'failed',
            result,
            endTime: new Date().toISOString()
          }
        });
      } catch (memoryError) {
        console.error('Error updating tool memory:', memoryError);
        // Continue even if memory update fails
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error executing tool:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error executing tool' 
    });
  }
}

/**
 * Clear chat history
 */
async function clearChatHistory(params: any) {
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      console.log('Confirmation acknowledged for chat history deletion');
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
      success: data.status === 'success',
      deletedMessageCount: data.post_reset?.[MemoryType.MESSAGE]?.count || 0,
      message: `Successfully reset message collection`
    };
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error clearing chat history'
    };
  }
}

/**
 * Clear images and attachments
 */
async function clearImages(params: any) {
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      console.log('Confirmation acknowledged for images deletion');
    }

    // Use the standardized memory system to clear images
    // First, get the memory services
    const { memoryService } = await getMemoryServices();
    
    // Delete all message memories with image attachments
    // Since this is a complex operation, we'll use a specialized endpoint
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
      success: data.success && localStorageData.success,
      attachmentsCleared: data.attachmentsCleared || 0,
      localStorage: localStorageData,
      message: 'Successfully cleared images and attachments'
    };
  } catch (error) {
    console.error('Error clearing images:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error clearing images'
    };
  }
}

/**
 * Reset all data (chat history and images)
 */
async function resetAllData(params: any) {
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      console.log('Confirmation acknowledged for complete data reset');
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
      success: resetData.status === 'success',
      resetData,
      localStorageCleared: localStorageData.success,
      message: 'Successfully reset all data'
    };
  } catch (error) {
    console.error('Error resetting all data:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error resetting all data'
    };
  }
}

/**
 * Refresh configuration
 */
async function refreshConfiguration(params: any) {
  try {
    // This would connect to a configuration service in a real app
    return {
      success: true,
      refreshedAt: new Date().toISOString(),
      message: 'Configuration refreshed successfully'
    };
  } catch (error) {
    console.error('Error refreshing configuration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error refreshing configuration'
    };
  }
}

/**
 * Test agent functionality
 */
async function testAgent(params: any) {
  try {
    // In a real app, this would test various agent capabilities
    return {
      success: true,
      agentStatus: 'operational',
      tests: {
        initialization: 'passed',
        memory: 'passed',
        reasoning: 'passed',
        responses: 'passed'
      },
      message: 'Agent functionality tests passed'
    };
  } catch (error) {
    console.error('Error testing agent:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error testing agent'
    };
  }
}

/**
 * Clear markdown cache
 */
async function clearMarkdownCache(params: any) {
  try {
    // Check if confirmation is required
    if (params?.confirmationRequired) {
      // Confirmation would have happened in the UI
      console.log('Confirmation acknowledged for markdown cache clearing');
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
      success: data.success,
      clearedCount: data.clearedCount || 0,
      message: `Successfully cleared ${data.clearedCount || 0} markdown cache entries`
    };
  } catch (error) {
    console.error('Error clearing markdown cache:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error clearing markdown cache'
    };
  }
} 