// Chloe Autonomy System Integration

import { ChloeAgent } from './core/agent';
import { initializeAutonomy } from './scheduler';
import { getMemoryServices } from '../../server/memory/services';
import { AutonomySystem } from '../../lib/shared/types/agentTypes';
import { MemoryType, ImportanceLevel } from '../../server/memory/config';
import { MessageMetadata } from '../../types/metadata';

/**
 * Initialize Chloe's full autonomy system with:
 * - Memory integration via Qdrant
 * - Scheduled tasks for planning and execution
 * - Daily reflections and summaries
 */
export async function initializeChloeAutonomy(agent: ChloeAgent): Promise<{
  status: 'success' | 'partial' | 'failed';
  message: string;
  autonomySystem?: AutonomySystem;
}> {
  try {
    console.log('Initializing Chloe autonomy system...');
    
    // Step 1: Ensure memory system is initialized
    try {
      const { client, memoryService } = await getMemoryServices();
      // Check if services are initialized
      const status = await client.getStatus();
      if (!status.initialized) {
        throw new Error('Memory services not properly initialized');
      }
      console.log('Memory system initialized successfully');
    } catch (memoryError) {
      console.error('Error initializing memory system:', memoryError);
      return {
        status: 'partial',
        message: 'Memory system initialization failed, proceeding with limited functionality'
      };
    }
    
    // Step 2: Initialize autonomy scheduling
    try {
      const autonomySystem = initializeAutonomy(agent);
      console.log('Autonomy scheduling initialized successfully');
      
      // Step 3: Perform an initial system reflection
      await agent.reflect('What are my key responsibilities as a Chief Marketing Officer?');
      console.log('Initial system reflection completed');
      
      return {
        status: 'success',
        message: 'Chloe autonomy system fully initialized',
        autonomySystem
      };
    } catch (schedulerError) {
      console.error('Error initializing autonomy scheduling:', schedulerError);
      return {
        status: 'partial',
        message: 'Scheduler initialization failed, memory system is working but autonomous tasks will not run'
      };
    }
  } catch (error) {
    console.error('Fatal error initializing Chloe autonomy system:', error);
    return {
      status: 'failed',
      message: `Autonomy system initialization failed completely: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Run a diagnostic check on Chloe's autonomy systems
 */
export async function diagnoseAutonomySystem(): Promise<{
  memory: { status: string; messageCount: number };
  scheduler: { status: string; activeTasks: number };
  planning: { status: string; };
}> {
  try {
    // Check memory system using new services
    const { client, searchService } = await getMemoryServices();
    const status = await client.getStatus();
    
    // Get message count
    const messageCount = await client.getPointCount(
      'memory_message', // Collection name for messages
      { type: MemoryType.MESSAGE }
    );
    
    // Placeholder for scheduler and planning checks
    // In a real implementation, this would check the actual systems
    
    return {
      memory: {
        status: status.initialized ? 'operational' : 'error',
        messageCount
      },
      scheduler: {
        status: 'operational',
        activeTasks: 5 // Default tasks
      },
      planning: {
        status: 'operational'
      }
    };
  } catch (error) {
    console.error('Error diagnosing autonomy system:', error);
    return {
      memory: { status: 'error', messageCount: 0 },
      scheduler: { status: 'unknown', activeTasks: 0 },
      planning: { status: 'unknown' }
    };
  }
}

/**
 * Get recent chat messages for a user
 */
export async function getRecentChatMessages(options: {
  userId?: string;
  limit?: number;
  since?: Date;
  roles?: string[];
} = {}): Promise<Array<{ role: string; content: string; timestamp: string }>> {
  try {
    const { searchService } = await getMemoryServices();
    
    // Build filter based on options
    const filter: Record<string, any> = {
      type: MemoryType.MESSAGE
    };
    
    // Add user filter if specified
    if (options.userId) {
      filter.userId = options.userId;
    }
    
    // Add timestamp filter if specified
    if (options.since) {
      filter.timestamp = { $gte: options.since.toISOString() };
    }
    
    // Add role filter if specified
    if (options.roles && options.roles.length > 0) {
      filter.role = { $in: options.roles };
    }
    
    // Search for messages
    const results = await searchService.search("", {
      types: [MemoryType.MESSAGE],
      limit: options.limit || 20,
      filter
    });
    
    // Convert to expected format
    return results.map(result => {
      const payload = result.point.payload as any;
      const metadata = payload.metadata as MessageMetadata;
      return {
        role: metadata?.role?.toString() || 'user',
        content: payload.content || payload.text || '',
        timestamp: payload.timestamp || new Date().toISOString()
      };
    }).sort((a, b) => {
      // Sort by timestamp (oldest first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  } catch (error) {
    console.error('Error getting recent chat messages:', error);
    return [];
  }
}

/**
 * Summarize recent chat history
 */
export async function summarizeChat(options: {
  userId?: string;
  limit?: number;
  since?: Date;
} = {}): Promise<string> {
  try {
    // Get recent messages
    const messages = await getRecentChatMessages({
      userId: options.userId,
      limit: options.limit || 30,
      since: options.since,
      roles: ['user', 'assistant']
    });
    
    if (messages.length === 0) {
      return "No recent conversation history found.";
    }
    
    // Build conversation text
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    // For a real implementation, you might want to use an LLM to generate a summary
    // This is a placeholder that returns formatted recent messages
    const messageCount = messages.length;
    const timeRange = messages.length > 0 ? 
      `from ${new Date(messages[0].timestamp).toLocaleString()} to ${new Date(messages[messages.length-1].timestamp).toLocaleString()}` : 
      '';
    
    return `Recent conversation history (${messageCount} messages) ${timeRange}:\n\n${conversationText}`;
  } catch (error) {
    console.error('Error summarizing chat:', error);
    return "Error generating conversation summary.";
  }
}
