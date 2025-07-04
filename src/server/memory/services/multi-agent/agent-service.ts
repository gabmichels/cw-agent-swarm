import { AgentMemoryEntity, AgentStatus } from '../../schema/agent';
import { AppError } from '../../../../lib/errors/base';
import { IMemoryClient } from '../client/types';
import { BaseMemorySchema } from '../../models';
import { IdGenerator, IdPrefix, StructuredId } from '../../../../utils/ulid';

/**
 * Error codes for agent memory operations
 */
enum AgentMemoryErrorCode {
  CREATE_FAILED = 'AGENT_MEMORY_CREATE_FAILED',
  UPDATE_FAILED = 'AGENT_MEMORY_UPDATE_FAILED',
  GET_FAILED = 'AGENT_MEMORY_GET_FAILED',
  LIST_FAILED = 'AGENT_MEMORY_LIST_FAILED',
  DELETE_FAILED = 'AGENT_MEMORY_DELETE_FAILED',
  VALIDATION_FAILED = 'AGENT_MEMORY_VALIDATION_FAILED',
  NOT_FOUND = 'AGENT_MEMORY_NOT_FOUND',
  SEARCH_FAILED = 'AGENT_MEMORY_SEARCH_FAILED',
  COUNT_FAILED = 'AGENT_MEMORY_COUNT_FAILED'
}

/**
 * Interface for success/error results
 */
export interface Result<T> {
  isError: boolean;
  value: T;
  error?: AppError;
}

/**
 * Creates a failure result
 */
function failureResult<T>(error: AppError): Result<T> {
  return {
    isError: true,
    value: null as unknown as T,
    error
  };
}

/**
 * Interface for agent memory service
 */
export interface AgentMemoryService {
  createAgent(agent: AgentMemoryEntity): Promise<Result<string>>;
  updateAgent(agent: AgentMemoryEntity): Promise<Result<string>>;
  getAgent(agentId: string): Promise<Result<AgentMemoryEntity>>;
  getAgents(): Promise<Result<AgentMemoryEntity[]>>;
  deleteAgent(agentId: string): Promise<Result<boolean>>;
  findAgents(filter: Record<string, any>, limit?: number, offset?: number): Promise<Result<AgentMemoryEntity[]>>;
  countAgents(filter: Record<string, any>): Promise<Result<number>>;
}

/**
 * Agent memory service implementation
 */
export class DefaultAgentMemoryService implements AgentMemoryService {
  private readonly memoryClient: IMemoryClient;
  private readonly collectionName: string;

  /**
   * Create a new agent memory service
   */
  constructor(memoryClient: IMemoryClient, collectionName: string = 'agents') {
    this.memoryClient = memoryClient;
    this.collectionName = collectionName;
  }

  /**
   * Create a dummy vector for agent operations
   */
  private createDummyVector(size = 1536) {
    return Array(size).fill(0);
  }

  /**
   * Adapt agent to memory point compatible with Qdrant
   * FIXED: Generate UUID for point ID and store agent ID in payload
   */
  private adaptAgentToMemoryPoint(agent: AgentMemoryEntity): any {
    // FIXED: Generate a UUID for the point ID instead of using agent ID
    // This prevents "Bad Request" errors from Qdrant
    const { v4: uuidv4 } = require('uuid');

    return {
      id: uuidv4(), // Use UUID for Qdrant point ID
      vector: this.createDummyVector(),
      payload: {
        ...agent,
        // Store the agent ID in payload for searching
        agentId: agent.id,
        // Add required BaseMemorySchema fields
        text: agent.name,
        timestamp: new Date().toISOString(),
        type: 'agent'
      }
    };
  }

  /**
   * Create a new agent
   * 
   * @param agent Agent data to store
   * @returns ID of the agent or error
   */
  async createAgent(agent: AgentMemoryEntity): Promise<Result<string>> {
    try {
      if (!agent.id) {
        agent.id = IdGenerator.generate(IdPrefix.AGENT).toString();
      }

      // Create a memory point compatible with Qdrant
      const point = this.adaptAgentToMemoryPoint(agent);

      try {
        await this.memoryClient.addPoint(this.collectionName, point);
      } catch (innerError: unknown) {
        const typedError = innerError as Error;
        console.error('Error in addPoint call:', {
          message: typedError.message || 'Unknown error',
          stack: typedError.stack || 'No stack trace',
          collectionName: this.collectionName,
          pointId: point.id,
          vectorLength: point.vector?.length
        });
        throw innerError;
      }

      // Verify agent was stored by searching for agent ID in payload
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: this.createDummyVector(),
          limit: 1,
          filter: {
            should: [
              {
                key: 'id',
                match: {
                  value: agent.id
                }
              },
              {
                key: 'agentId',
                match: {
                  value: agent.id
                }
              }
            ]
          },
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return failureResult(
          new AppError(`Failed to verify agent ${agent.id} was stored`, AgentMemoryErrorCode.CREATE_FAILED)
        );
      }

      return { isError: false, value: agent.id };
    } catch (error) {
      console.error('Error creating agent in memory service:', error);
      return failureResult(
        new AppError(`Error creating agent: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.CREATE_FAILED)
      );
    }
  }

  /**
   * Update an existing agent
   * 
   * @param agent Agent data to update
   * @returns ID of the agent or error
   */
  async updateAgent(agent: AgentMemoryEntity): Promise<Result<string>> {
    try {
      if (!agent.id) {
        return failureResult(new AppError('Agent ID is required for update', AgentMemoryErrorCode.VALIDATION_FAILED));
      }

      // Try searching by both 'id' and 'agentId' fields to handle different storage formats
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: this.createDummyVector(),
          limit: 1,
          filter: {
            should: [
              {
                key: 'id',
                match: {
                  value: agent.id
                }
              },
              {
                key: 'agentId',
                match: {
                  value: agent.id
                }
              }
            ]
          },
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return failureResult(new AppError(`Agent ${agent.id} not found`, AgentMemoryErrorCode.NOT_FOUND));
      }

      // Get the UUID point ID from the search result
      const pointId = searchResult[0].id;

      // Create updated memory point (with new UUID)
      const updatedPoint = this.adaptAgentToMemoryPoint(agent);

      // Update using the found UUID point ID
      await this.memoryClient.updatePoint(this.collectionName, pointId, updatedPoint);
      return { isError: false, value: agent.id };
    } catch (error) {
      console.error('Error updating agent in memory service:', error);
      return failureResult(
        new AppError(`Error updating agent: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.UPDATE_FAILED)
      );
    }
  }

  /**
   * Get an agent by ID
   * 
   * @param agentId ID of the agent to retrieve
   * @returns Agent data or error
   */
  async getAgent(agentId: string): Promise<Result<AgentMemoryEntity>> {
    try {
      // Try searching by both 'id' and 'agentId' fields to handle different storage formats
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: this.createDummyVector(),
          limit: 1,
          filter: {
            should: [
              {
                key: 'id',
                match: {
                  value: agentId
                }
              },
              {
                key: 'agentId',
                match: {
                  value: agentId
                }
              }
            ]
          },
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return failureResult(new AppError(`Agent ${agentId} not found`, AgentMemoryErrorCode.NOT_FOUND));
      }

      // Extract agent from the first result
      const agent = searchResult[0].payload as unknown as AgentMemoryEntity;

      // Ensure required fields are present
      if (!agent.name) {
        agent.name = 'Unnamed Agent';
      }

      // Ensure the ID is properly set
      agent.id = agentId;

      return { isError: false, value: agent };
    } catch (error) {
      console.error('Error getting agent from memory service:', error);
      return failureResult(
        new AppError(`Error getting agent: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.GET_FAILED)
      );
    }
  }

  /**
   * Get all agents
   * 
   * @returns All agents or error
   */
  async getAgents(): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Create a proper 1536-dimensional vector for search
      const dummyVector = this.createDummyVector(1536);

      // Get all agents from the storage using search with a high limit
      // This is more efficient than scrolling for small collections
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: dummyVector,
          // Increase limit to handle more agents if needed
          limit: 10000,
          filter: {},
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return { isError: false, value: [] };
      }

      // Extract agents from the results and ensure they have the correct type
      const agents = searchResult.map((result) => result.payload as unknown as AgentMemoryEntity);

      return { isError: false, value: agents };
    } catch (error) {
      console.error('Error getting agents from memory service:', error);
      return failureResult(
        new AppError(`Error getting agents: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.LIST_FAILED)
      );
    }
  }

  /**
   * Find agents by filter criteria
   * 
   * @param filter Filter criteria
   * @param limit Maximum number of results to return
   * @param offset Number of results to skip
   * @returns Matching agents or error
   */
  async findAgents(
    filter: Record<string, any> = {},
    limit: number = 10,
    offset: number = 0
  ): Promise<Result<AgentMemoryEntity[]>> {
    try {
      // Create a proper 1536-dimensional vector for search
      const dummyVector = this.createDummyVector(1536);

      // Convert filter object to Qdrant filter format
      const qdrantFilter: any = { must: [] };

      // Add each filter condition
      for (const [key, value] of Object.entries(filter)) {
        // Handle array values (like tags)
        if (Array.isArray(value)) {
          // If empty array, skip this filter
          if (value.length === 0) continue;

          // For arrays, match any of the values
          const shouldConditions = value.map(val => ({
            key,
            match: { value: val }
          }));

          qdrantFilter.must.push({ should: shouldConditions });
        }
        // Handle regular values
        else if (value !== undefined && value !== null) {
          qdrantFilter.must.push({
            key,
            match: { value }
          });
        }
      }

      // If no filter conditions were added, use an empty filter
      if (qdrantFilter.must.length === 0) {
        delete qdrantFilter.must;
      }

      // Get agents from the storage using search
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: dummyVector,
          limit,
          offset,
          filter: qdrantFilter,
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return { isError: false, value: [] };
      }

      // Extract agents from the results
      const agents = searchResult.map((result) => result.payload as unknown as AgentMemoryEntity);

      return { isError: false, value: agents };
    } catch (error) {
      console.error('Error finding agents from memory service:', error);
      return failureResult(
        new AppError(`Error finding agents: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.SEARCH_FAILED)
      );
    }
  }

  /**
   * Count agents by filter criteria
   * 
   * @param filter Filter criteria
   * @returns Count of matching agents or error
   */
  async countAgents(filter: Record<string, any> = {}): Promise<Result<number>> {
    try {
      // Convert filter object to Qdrant filter format
      const qdrantFilter: any = { must: [] };

      // Add each filter condition
      for (const [key, value] of Object.entries(filter)) {
        // Handle array values (like tags)
        if (Array.isArray(value)) {
          // If empty array, skip this filter
          if (value.length === 0) continue;

          // For arrays, match any of the values
          const shouldConditions = value.map(val => ({
            key,
            match: { value: val }
          }));

          qdrantFilter.must.push({ should: shouldConditions });
        }
        // Handle regular values
        else if (value !== undefined && value !== null) {
          qdrantFilter.must.push({
            key,
            match: { value }
          });
        }
      }

      // If no filter conditions were added, use an empty filter
      if (qdrantFilter.must.length === 0) {
        delete qdrantFilter.must;
      }

      // Get total count if no filter
      if (!filter || Object.keys(filter).length === 0) {
        try {
          const count = await this.memoryClient.getPointCount(this.collectionName);
          return { isError: false, value: count };
        } catch (countError) {
          console.warn('Failed to get point count, falling back to search:', countError);
          // Continue with search method
        }
      }

      // Count by performing a search with high limit
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: this.createDummyVector(1536),
          limit: 10000, // Use a high limit to get all matching agents
          filter: qdrantFilter,
          includeVectors: false
        }
      );

      return { isError: false, value: searchResult?.length || 0 };
    } catch (error) {
      console.error('Error counting agents from memory service:', error);
      return failureResult(
        new AppError(`Error counting agents: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.COUNT_FAILED)
      );
    }
  }

  /**
   * Delete an agent by ID
   * 
   * @param agentId Agent ID to delete
   * @returns Success or error
   */
  async deleteAgent(agentId: string): Promise<Result<boolean>> {
    try {
      if (!agentId) {
        return failureResult(new AppError('Agent ID is required for delete', AgentMemoryErrorCode.VALIDATION_FAILED));
      }

      // Try searching by both 'id' and 'agentId' fields to handle different storage formats
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: this.createDummyVector(),
          limit: 1,
          filter: {
            should: [
              {
                key: 'id',
                match: {
                  value: agentId
                }
              },
              {
                key: 'agentId',
                match: {
                  value: agentId
                }
              }
            ]
          },
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return failureResult(new AppError(`Agent ${agentId} not found`, AgentMemoryErrorCode.NOT_FOUND));
      }

      // Delete the point using its Qdrant point ID
      const pointId = searchResult[0].id;
      await this.memoryClient.deletePoint(this.collectionName, pointId);

      return { isError: false, value: true };
    } catch (error) {
      console.error('Error deleting agent from memory service:', error);
      return failureResult(
        new AppError(`Error deleting agent: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.DELETE_FAILED)
      );
    }
  }

  // Alias methods for API compatibility

  /**
   * Alias for getAgent - matches API handler expectations
   */
  async getById(agentId: string): Promise<{ isError: boolean; data?: AgentMemoryEntity; error?: any }> {
    const result = await this.getAgent(agentId);
    return {
      isError: result.isError,
      data: result.isError ? undefined : result.value,
      error: result.error
    };
  }

  /**
   * Alias for updateAgent - matches API handler expectations
   */
  async update(agentId: string, updateData: Partial<AgentMemoryEntity>): Promise<{ isError: boolean; data?: AgentMemoryEntity; error?: any }> {
    // First get the existing agent
    const existingResult = await this.getAgent(agentId);
    if (existingResult.isError) {
      return {
        isError: true,
        error: existingResult.error
      };
    }

    // Merge the update data with existing agent
    const updatedAgent = { ...existingResult.value, ...updateData, id: agentId };
    const result = await this.updateAgent(updatedAgent);

    if (result.isError) {
      return {
        isError: true,
        error: result.error
      };
    }

    // Return the updated agent
    const getResult = await this.getAgent(agentId);
    return {
      isError: getResult.isError,
      data: getResult.isError ? undefined : getResult.value,
      error: getResult.error
    };
  }

  /**
   * Alias for deleteAgent - matches API handler expectations
   */
  async delete(agentId: string): Promise<{ isError: boolean; data?: boolean; error?: any }> {
    const result = await this.deleteAgent(agentId);
    return {
      isError: result.isError,
      data: result.isError ? undefined : result.value,
      error: result.error
    };
  }

  /**
   * Update agent status - matches API handler expectations
   */
  async updateAgentStatus(agentId: string, status: string): Promise<{ isError: boolean; data?: AgentMemoryEntity; error?: any }> {
    return this.update(agentId, { status: status as AgentStatus });
  }

  /**
   * Update agent capabilities - matches API handler expectations
   */
  async updateAgentCapabilities(agentId: string, capabilities: any[]): Promise<{ isError: boolean; data?: AgentMemoryEntity; error?: any }> {
    return this.update(agentId, { capabilities });
  }
} 