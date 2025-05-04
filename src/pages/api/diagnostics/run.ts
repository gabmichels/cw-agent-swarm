import { NextApiRequest, NextApiResponse } from 'next';
import { MemoryService } from '../../../server/memory/services/memory/memory-service';
import { EmbeddingService } from '../../../server/memory/services/client/embedding-service';
import { QdrantMemoryClient } from '../../../server/memory/services/client/qdrant-client';

// Define the diagnostics memory type directly since it's not exported from the hook
const DIAGNOSTICS_MEMORY_TYPE = 'diagnostic';

/**
 * API endpoint for running diagnostics with memory integration
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { type, params, memoryId } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Diagnostic type is required' });
    }

    // Run the diagnostic based on the type
    let result;
    switch (type) {
      case 'system':
        result = await runSystemDiagnostic(params);
        break;
      case 'chat':
        result = await runChatDiagnostic(params);
        break;
      case 'agent':
        result = await runAgentDiagnostic(params);
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown diagnostic type: ${type}` });
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
          type: DIAGNOSTICS_MEMORY_TYPE as any,
          metadata: {
            status: result.success ? 'completed' : 'failed',
            result,
            endTime: new Date().toISOString()
          }
        });
      } catch (memoryError) {
        console.error('Error updating diagnostic memory:', memoryError);
        // Continue even if memory update fails
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error running diagnostic:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error running diagnostic' 
    });
  }
}

/**
 * Run system diagnostic
 */
async function runSystemDiagnostic(params: any) {
  try {
    // This would be a real system diagnostic in a production app
    const diagnosticResults = {
      memory: runMemoryCheck(params?.checkMemory),
      disk: runDiskCheck(params?.checkDisk),
      network: runNetworkCheck(params?.checkNetwork),
      runtime: runRuntimeCheck(params?.checkRuntime)
    };
    
    // Check if all enabled checks passed
    const success = Object.entries(diagnosticResults)
      .filter(([key, value]) => {
        const checkParam = `check${key.charAt(0).toUpperCase() + key.slice(1)}`;
        return params?.[checkParam] === true;
      })
      .every(([_, check]) => check.status === 'ok');
    
    return {
      success,
      timestamp: new Date().toISOString(),
      results: diagnosticResults
    };
  } catch (error) {
    console.error('Error running system diagnostic:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error running system diagnostic' 
    };
  }
}

/**
 * Run chat diagnostic
 */
async function runChatDiagnostic(params: any) {
  try {
    // This would be a real chat diagnostic in a production app
    const diagnosticResults = {
      messageCounts: checkMessageCounts(params?.checkMessageCounts),
      conversationStructure: checkConversationStructure(params?.checkConversationStructure),
      responseTimes: checkResponseTimes(params?.checkResponseTimes)
    };
    
    // Check if all enabled checks passed
    const success = Object.entries(diagnosticResults)
      .filter(([key, value]) => {
        // Convert from camelCase to checkCamelCase
        const checkParam = `check${key.charAt(0).toUpperCase() + key.slice(1)}`;
        return params?.[checkParam] === true;
      })
      .every(([_, check]) => check.status === 'ok');
    
    return {
      success,
      timestamp: new Date().toISOString(),
      results: diagnosticResults
    };
  } catch (error) {
    console.error('Error running chat diagnostic:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error running chat diagnostic' 
    };
  }
}

/**
 * Run agent diagnostic
 */
async function runAgentDiagnostic(params: any) {
  try {
    // This would be a real agent diagnostic in a production app
    const diagnosticResults = {
      agentStatus: checkAgentStatus(params?.checkAgentStatus),
      configurationIntegrity: checkConfigurationIntegrity(params?.checkConfigurationIntegrity),
      toolAvailability: checkToolAvailability(params?.checkToolAvailability)
    };
    
    // Check if all enabled checks passed
    const success = Object.entries(diagnosticResults)
      .filter(([key, value]) => {
        // Convert from camelCase to checkCamelCase
        const checkParam = `check${key.charAt(0).toUpperCase() + key.slice(1)}`;
        return params?.[checkParam] === true;
      })
      .every(([_, check]) => check.status === 'ok');
    
    return {
      success,
      timestamp: new Date().toISOString(),
      results: diagnosticResults
    };
  } catch (error) {
    console.error('Error running agent diagnostic:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error running agent diagnostic' 
    };
  }
}

// Helper functions for system diagnostics
function runMemoryCheck(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    return {
      status: 'ok',
      totalMemory: process.memoryUsage().heapTotal,
      usedMemory: process.memoryUsage().heapUsed,
      rss: process.memoryUsage().rss
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error running memory check'
    };
  }
}

function runDiskCheck(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock disk check - in a real app we would check actual disk usage
    return {
      status: 'ok',
      diskSpace: {
        total: 500 * 1024 * 1024 * 1024, // 500 GB
        free: 250 * 1024 * 1024 * 1024,  // 250 GB
        used: 250 * 1024 * 1024 * 1024   // 250 GB
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error running disk check'
    };
  }
}

function runNetworkCheck(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock network check - in a real app we would check actual network status
    return {
      status: 'ok',
      connectivity: true,
      latency: 50, // ms
      uptime: 99.98 // percentage
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error running network check'
    };
  }
}

function runRuntimeCheck(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    return {
      status: 'ok',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error running runtime check'
    };
  }
}

// Helper functions for chat diagnostics
function checkMessageCounts(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock message count check - in a real app we would query the database
    return {
      status: 'ok',
      userMessages: 1250,
      assistantMessages: 1248,
      totalMessages: 2498,
      averagePerConversation: 12.5
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking message counts'
    };
  }
}

function checkConversationStructure(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock conversation structure check - in a real app we would analyze real conversations
    return {
      status: 'ok',
      validStructure: true,
      averageDepth: 8.3,
      maxDepth: 42,
      orphanedMessages: 0
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking conversation structure'
    };
  }
}

function checkResponseTimes(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock response time check - in a real app we would analyze real response times
    return {
      status: 'ok',
      averageResponseTime: 1250, // ms
      p95ResponseTime: 3500,     // ms
      p99ResponseTime: 5000,     // ms
      slowestResponse: 8500      // ms
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking response times'
    };
  }
}

// Helper functions for agent diagnostics
function checkAgentStatus(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock agent status check - in a real app we would check the actual agent status
    return {
      status: 'ok',
      online: true,
      responsive: true,
      healthScore: 98, // percentage
      lastHealthCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking agent status'
    };
  }
}

function checkConfigurationIntegrity(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock configuration check - in a real app we would validate all settings
    return {
      status: 'ok',
      validConfig: true,
      missingSettings: 0,
      deprecatedSettings: 2,
      securityIssues: 0
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking configuration integrity'
    };
  }
}

function checkToolAvailability(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Mock tool availability check - in a real app we would check all required tools
    return {
      status: 'ok',
      availableTools: 12,
      unavailableTools: 0,
      partialTools: 1,
      toolsInventory: {
        core: { available: 5, total: 5 },
        advanced: { available: 4, total: 4 },
        experimental: { available: 3, total: 4 }
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking tool availability'
    };
  }
} 