import { ChloeAgent } from '../agent';
import { logger } from '../../../lib/logging';

/**
 * Execute memory consolidation task
 * This task processes recent memories, analyzes them for importance,
 * and generates insights from patterns in the agent's experiences
 */
export async function runMemoryConsolidation(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running memory consolidation task');
    
    // Reflect on recent memories to extract insights
    await agent.reflect(
      'Review my recent interactions and memories. What patterns do I notice? What insights can I extract from these experiences to improve my knowledge and capabilities?'
    );
    
    logger.info('Memory consolidation completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running memory consolidation task:', error);
    return false;
  }
} 