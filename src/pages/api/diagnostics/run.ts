import { NextApiRequest, NextApiResponse } from 'next';
import { getMemoryServices } from '../../../server/memory/services';

// Define the diagnostics memory type
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
        // Get memory services from the standardized system
        const { memoryService } = await getMemoryServices();
        
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
      memory: await runMemoryCheck(params?.checkMemory),
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
      messageCounts: await checkMessageCounts(params?.checkMessageCounts),
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
async function runMemoryCheck(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Get memory services for checking database memory usage
    const { memoryService } = await getMemoryServices();
    
    // Get process memory usage
    const processMemory = {
      totalMemory: process.memoryUsage().heapTotal,
      usedMemory: process.memoryUsage().heapUsed,
      rss: process.memoryUsage().rss
    };
    
    return {
      status: 'ok',
      process: processMemory
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
async function checkMessageCounts(enabled = true) {
  if (!enabled) return { status: 'skipped' };
  
  try {
    // Use standardized memory system to check message counts
    const { memoryService } = await getMemoryServices();
    
    // In a real app, we would get actual message counts from the memory system
    return {
      status: 'ok',
      counts: {
        total: 100,
        user: 50,
        assistant: 50
      },
      averagePerDay: 10
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
    // Mock conversation structure check - in a real app we would analyze actual conversations
    return {
      status: 'ok',
      threadsDetected: 5,
      averageLength: 10,
      topicCoherence: 0.85
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
    // Mock response time check - in a real app we would analyze actual response times
    return {
      status: 'ok',
      averageResponseTime: 2500, // ms
      p95ResponseTime: 5000, // ms
      slowestResponses: [
        { timestamp: '2023-01-01T12:00:00Z', duration: 8000 },
        { timestamp: '2023-01-02T14:30:00Z', duration: 7500 }
      ]
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
    // Mock agent status check - in a real app we would check actual agent status
    return {
      status: 'ok',
      agentLoaded: true,
      modelVersion: 'gpt-4.1-2025-04-14',
      uptime: 86400, // seconds
      lastConfigUpdate: '2023-01-01T00:00:00Z'
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
    // Mock configuration integrity check - in a real app we would validate actual configuration
    return {
      status: 'ok',
      configValid: true,
      validationErrors: [],
      lastValidated: '2023-01-01T12:00:00Z'
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
    // Mock tool availability check - in a real app we would check actual tool availability
    return {
      status: 'ok',
      toolsAvailable: ['calculator', 'weather', 'search', 'calendar'],
      toolsUnavailable: [],
      lastToolError: null
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error checking tool availability'
    };
  }
} 