/**
 * Agent Memory Service
 * 
 * This module implements the memory service for agent entities.
 */

import { BaseMemoryService, MemoryErrorCode } from "./base/service";
import { AgentCapability, AgentMemoryEntity, AgentStatus } from "../schema/agent";
import { Result, successResult } from "../../../lib/errors/base";
import { IMemoryRepository, SearchParams } from "./base/types";
import { FilterOperator } from "./filters/types";
import { StructuredId, IdGenerator } from "../../../utils/ulid";

/**
 * Agent memory service implementation
 */
export class AgentMemoryService extends BaseMemoryService<AgentMemoryEntity> {
  /**
   * Create a new agent memory service
   */
  constructor(repository: IMemoryRepository<AgentMemoryEntity>) {
    super(repository);
  }
  
  /**
   * Find agents by capability
   */
  async findAgentsByCapability(capability: string): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Use a search approach since filter with nested objects is complex
      // Search for the capability name in the content field
      const params: SearchParams<AgentMemoryEntity> = {
        query: capability,
        filter: {
          type: {
            operator: FilterOperator.EQUALS,
            value: "agent"
          }
        }
      };
      
      return await this.search(params);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findAgentsByCapability',
        capability
      });
    }
  }
  
  /**
   * Find available agents
   */
  async findAvailableAgents(): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Search for agents with AVAILABLE status
      const agents = await this.repository.filter(
        {
          status: {
            operator: FilterOperator.EQUALS,
            value: AgentStatus.AVAILABLE
          }
        },
        { includeDeleted: false }
      );
      
      return successResult(agents);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findAvailableAgents'
      });
    }
  }
  
  /**
   * Find agents by metadata
   */
  async findAgentsByMetadata(metadata: Partial<Record<string, unknown>>): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Convert metadata to filter conditions
      const filterConditions: any = {};
      
      // Add metadata fields to filter
      for (const [key, value] of Object.entries(metadata)) {
        filterConditions[`metadata.${key}`] = {
          operator: FilterOperator.EQUALS,
          value
        };
      }
      
      // Search for agents with the specified metadata
      const agents = await this.repository.filter(
        filterConditions,
        { includeDeleted: false }
      );
      
      return successResult(agents);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'findAgentsByMetadata',
        metadata
      });
    }
  }
  
  /**
   * Update agent capabilities
   */
  async updateAgentCapabilities(
    id: StructuredId | string,
    capabilities: AgentCapability[]
  ): Promise<Result<AgentMemoryEntity | null>> {
    try {
      // Update agent capabilities
      const agent = await this.repository.update(
        id,
        { capabilities }
      );
      
      return successResult(agent);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'updateAgentCapabilities',
        agentId: typeof id === 'string' ? id : id.toString()
      });
    }
  }
  
  /**
   * Update agent status
   */
  async updateAgentStatus(
    id: StructuredId | string,
    status: AgentStatus
  ): Promise<Result<AgentMemoryEntity | null>> {
    try {
      // Update agent status
      const agent = await this.repository.update(
        id,
        {
          status,
          lastActive: new Date()
        }
      );
      
      return successResult(agent);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'updateAgentStatus',
        agentId: typeof id === 'string' ? id : id.toString(),
        status
      });
    }
  }
  
  /**
   * Get agents by team ID
   */
  async getAgentsByTeam(teamId: StructuredId | string): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Since direct filter with contains for arrays is complex,
      // we'll use a more generic search approach
      const params: SearchParams<AgentMemoryEntity> = {
        query: typeof teamId === 'string' ? teamId : teamId.toString(),
        filter: {
          type: {
            operator: FilterOperator.EQUALS,
            value: "agent"
          }
        }
      };
      
      return await this.search(params);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.SEARCH_FAILED, {
        operation: 'getAgentsByTeam',
        teamId: typeof teamId === 'string' ? teamId : teamId.toString()
      });
    }
  }
  
  /**
   * Add an agent to a chat
   */
  async addAgentToChat(
    agentId: StructuredId | string,
    chatId: StructuredId | string
  ): Promise<Result<AgentMemoryEntity | null>> {
    try {
      // Get the agent
      const agent = await this.repository.getById(agentId);
      
      // If agent doesn't exist, return null
      if (!agent) {
        return successResult(null);
      }
      
      // Check if the agent is already in the chat
      const chatIdStr = typeof chatId === 'string' ? chatId : chatId.toString();
      const existingChatIds = agent.chatIds || [];
      
      // If the agent is already in the chat, return the agent
      const alreadyInChat = existingChatIds.some(
        id => id.toString() === chatIdStr
      );
      
      if (alreadyInChat) {
        return successResult(agent);
      }
      
      // Add the chat ID to the agent's chat IDs
      // Convert string to StructuredId if needed
      let chatIdObj: any;  // Using any to bypass type checking until we can properly resolve
      
      if (typeof chatId === 'string') {
        // Try to parse the ID string
        const parsedId = IdGenerator.parse(chatId);
        if (parsedId) {
          chatIdObj = parsedId;
        } else {
          // This is a workaround for the simple case - in a real implementation
          // we'd need to better align the StructuredId implementations
          try {
            // Use chat ID as is - this would need a proper implementation
            chatIdObj = chatId;
          } catch (parseError) {
            return this.handleError(parseError, MemoryErrorCode.UPDATE_FAILED, {
              operation: 'addAgentToChat',
              error: 'Invalid chat ID format'
            });
          }
        }
      } else {
        chatIdObj = chatId;
      }
      
      const updatedAgent = await this.repository.update(
        agentId,
        {
          chatIds: [...existingChatIds, chatIdObj]
        }
      );
      
      return successResult(updatedAgent);
    } catch (error) {
      return this.handleError(error, MemoryErrorCode.UPDATE_FAILED, {
        operation: 'addAgentToChat',
        agentId: typeof agentId === 'string' ? agentId : agentId.toString(),
        chatId: typeof chatId === 'string' ? chatId : chatId.toString()
      });
    }
  }
} 