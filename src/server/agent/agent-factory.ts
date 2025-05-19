/**
 * Custom Agent Factory that properly preserves IDs
 * 
 * This factory creates agents from database entities with the correct ID handling
 */

import { AgentFactory } from '../../agents/shared/AgentFactory';
import { AgentMemoryEntity } from '../memory/schema/agent';
import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { IdGenerator } from '../../utils/ulid';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { logger } from '../../lib/logging';

export class CustomAgentFactory {
  /**
   * Create an agent instance from a database entity while preserving the ID
   */
  static createFromDbEntity(entity: AgentMemoryEntity): DefaultAgent {
    // Generate a valid agent ID if none exists
    const agentId = entity.id || IdGenerator.generate('agent').toString();
    
    // Create a deep copy of the entity to avoid modifying the original
    const entityCopy = JSON.parse(JSON.stringify(entity)) as AgentMemoryEntity;
    
    // Force ID to be set properly
    entityCopy.id = agentId;
    
    // Log the entity data for debugging
    logger.debug(`Creating agent from database entity with ID: ${agentId}`);
    
    // Create the agent from the entity
    const agent = new DefaultAgent({
      ...entityCopy as any,
      id: agentId,
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableKnowledgeManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      managersConfig: {
        memoryManager: {
          enabled: true
        },
        planningManager: {
          enabled: true
        },
        knowledgeManager: {
          enabled: true
        },
        toolManager: {
          enabled: true
        },
        schedulerManager: {
          enabled: true
        }
      }
    });
    
    // Verify ID is set correctly
    if (agent.getAgentId() !== agentId) {
      logger.warn(`Agent ID mismatch: expected ${agentId}, got ${agent.getAgentId()}`);
      
      // Try to fix the ID through backdoors
      try {
        (agent as any).config.id = agentId;
        (agent as any)._id = agentId;
        (agent as any).agentId = agentId;
      } catch (error) {
        logger.error(`Failed to fix agent ID: ${error}`);
      }
    }
    
    return agent;
  }
} 