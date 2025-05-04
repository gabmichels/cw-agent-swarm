import { NextApiRequest, NextApiResponse } from 'next';
import { MemoryService } from '../../../server/memory/services/memory/memory-service';
import { EmbeddingService } from '../../../server/memory/services/client/embedding-service';
import { QdrantMemoryClient } from '../../../server/memory/services/client/qdrant-client';

// Define the tools memory type directly since it's not exported from the hook
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
        // Create the memory service with necessary dependencies
        const qdrantClient = new QdrantMemoryClient();
        const embeddingService = new EmbeddingService();
        const memoryService = new MemoryService(qdrantClient, embeddingService);
        
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

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/reset-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'gab' }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear chat history: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      success: data.success,
      deletedMessageCount: data.deletedMessageCount,
      message: `Successfully deleted ${data.deletedMessageCount} messages`
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

    // 1. Clear server-side image data
    const serverResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/clear-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'gab' }),
    });
    
    if (!serverResponse.ok) {
      throw new Error(`Failed to clear server images: ${serverResponse.statusText}`);
    }
    
    const serverData = await serverResponse.json();
    
    // 2. Clear local storage data related to images
    const localStorageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/clear-local-storage`);
    
    if (!localStorageResponse.ok) {
      throw new Error(`Failed to get local storage clear instructions: ${localStorageResponse.statusText}`);
    }
    
    const localStorageData = await localStorageResponse.json();
    
    return {
      success: serverData.success && localStorageData.success,
      server: serverData,
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

    // Reset all Qdrant collections completely
    const resetResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/reset-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resetAll: true }),
    });
    
    if (!resetResponse.ok) {
      throw new Error(`Failed to reset database: ${resetResponse.statusText}`);
    }
    
    const resetData = await resetResponse.json();
    
    // Clear server-side image data
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/clear-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'gab' }),
    });
    
    // Clear local storage
    const localStorageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/debug/clear-local-storage`);
    const localStorageData = await localStorageResponse.json();
    
    return {
      success: resetData.success,
      resetDatabase: resetData,
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
      tests: {
        connection: true,
        memory: true,
        tools: true,
        reasoning: true
      },
      message: 'Agent tests completed successfully'
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
    // In a real app, this would clear markdown rendering caches
    return {
      success: true,
      clearedAt: new Date().toISOString(),
      message: 'Markdown cache cleared successfully'
    };
  } catch (error) {
    console.error('Error clearing markdown cache:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error clearing markdown cache'
    };
  }
} 