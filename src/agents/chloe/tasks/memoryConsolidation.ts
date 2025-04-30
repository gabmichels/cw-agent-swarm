import type { ChloeAgent } from '../core/agent';
import { logger } from '../../../lib/logging';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';

/**
 * Run a memory consolidation task to analyze and organize agent's memories
 * @param agent The ChloeAgent instance
 * @returns Promise resolving to boolean indicating success
 */
export async function runMemoryConsolidation(agent: ChloeAgent): Promise<boolean> {
  try {
    logger.info('Running memory consolidation task via agent scheduler');
    
    // Step 1: Ask agent to reflect on recent activities
    logger.info('Reflecting on recent activities');
    const activityReflection = await agent.reflect(
      'What are the most important activities and insights from my recent operations? What patterns do I notice in my recent work?'
    );
    
    logger.info('Activity reflection completed');
    
    // Step 2: Summarize conversation context
    logger.info('Summarizing conversation contexts');
    try {
      const summary = await agent.summarizeConversation({ maxEntries: 20 });
      logger.info('Conversation summarization completed');
      
      // Ask agent to reflect on the summary
      await agent.reflect(
        `Based on this summary of recent conversations, what are the key themes and priorities I should focus on?\n\nSummary: ${summary}`
      );
    } catch (summarizeError) {
      logger.error('Error during conversation summarization:', summarizeError);
    }
    
    // Step 3: Generate strategic insights
    logger.info('Generating strategic insights');
    try {
      const strategicQuestion = 'Based on my recent interactions and knowledge, what strategic insights can I identify for our marketing efforts?';
      const strategicInsights = await agent.reflect(strategicQuestion);
      
      // Store strategic insights
      if (strategicInsights) {
        // Parse insights into individual points
        const insights = strategicInsights
          .split('\n')
          .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
          .map((line: string) => line.replace(/^[-•]\s+/, '').trim());
        
        // Add each insight to memory using the memory manager
        const memoryManager = agent.getMemoryManager();
        if (memoryManager) {
          for (const insight of insights) {
            try {
              await memoryManager.addMemory(insight, 'strategic', ImportanceLevel.HIGH, MemorySource.SYSTEM, undefined, ['marketing', 'memory_consolidation']);
              logger.info(`Added strategic insight: ${insight.substring(0, 50)}...`);
            } catch (insightError) {
              logger.error('Error adding strategic insight:', insightError);
            }
          }
        } else {
          logger.warn('Memory manager not available for storing insights');
        }
      }
    } catch (strategicError) {
      logger.error('Error generating strategic insights:', strategicError);
    }
    
    // Step 4: Reflect on the memory consolidation
    await agent.reflect(
      'I have completed memory consolidation. I reflected on recent activities, summarized conversations, ' +
      'and generated strategic insights from my knowledge. ' +
      'This process helps me maintain an effective memory system for better decision-making.'
    );
    
    logger.info('Memory consolidation task completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running memory consolidation task:', error);
    return false;
  }
} 