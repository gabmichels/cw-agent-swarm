import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { AgentMemoryEntity } from '../../schema/agent';
import { AppError } from '../../../../lib/errors/base';
import { IMemoryClient } from '../client/types';
import { BaseMemorySchema, MemoryPoint } from '../../models';
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
  NOT_FOUND = 'AGENT_MEMORY_NOT_FOUND'
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
}

/**
 * Agent memory service implementation
 */
export class DefaultAgentMemoryService implements AgentMemoryService {
  private readonly memoryClient: IMemoryClient;
  private readonly collectionName: string;
  private readonly agentIdToUuidMap: Map<string, string> = new Map();
  private readonly uuidToAgentIdMap: Map<string, string> = new Map();

  /**
   * Create a new agent memory service
   */
  constructor(memoryClient: IMemoryClient, collectionName: string = 'agents') {
    this.memoryClient = memoryClient;
    this.collectionName = collectionName;
  }

  /**
   * Convert an agent ID to a valid Qdrant UUID
   * 
   * @param agentId The agent ID to convert
   * @returns A UUID derived from the agent ID
   */
  private getUuidForAgentId(agentId: string): string {
    // Check if we already have a UUID for this agent ID
    if (this.agentIdToUuidMap.has(agentId)) {
      return this.agentIdToUuidMap.get(agentId)!;
    }
    
    // Create a deterministic UUID from the agent ID
    // We use MD5 to create a stable hash that we can convert to a UUID format
    const md5Hash = createHash('md5').update(agentId).digest('hex');
    // Format as UUID (8-4-4-4-12)
    const uuid = `${md5Hash.substring(0, 8)}-${md5Hash.substring(8, 12)}-${md5Hash.substring(12, 16)}-${md5Hash.substring(16, 20)}-${md5Hash.substring(20, 32)}`;
    
    // Store the mapping
    this.agentIdToUuidMap.set(agentId, uuid);
    this.uuidToAgentIdMap.set(uuid, agentId);
    
    return uuid;
  }

  /**
   * Get the original agent ID from a UUID
   * 
   * @param uuid The UUID to convert back
   * @returns The original agent ID, or the UUID if no mapping exists
   */
  private getAgentIdFromUuid(uuid: string): string {
    return this.uuidToAgentIdMap.get(uuid) || uuid;
  }

  /**
   * Create a dummy embedding vector with the correct dimensions
   * This is needed to ensure compatibility with Qdrant
   */
  private createDummyVector(size = 1536) {
    return Array(size).fill(0).map(() => Math.random() * 0.01);
  }

  /**
   * Adapt agent entity to format required by Qdrant memory system
   */
  private adaptAgentToMemoryPoint(agent: AgentMemoryEntity, qdrantId: string): any {
    // Create a memory point compatible with Qdrant
    return {
      id: qdrantId,
      vector: this.createDummyVector(),
      payload: {
        ...agent,
        id: qdrantId,
        metadata: {
          ...agent.metadata,
          _originalId: typeof agent.id === 'string' ? agent.id : agent.id.toString()
        },
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
        const generatedId = IdGenerator.generate(IdPrefix.AGENT);
        agent.id = generatedId;
      }
      
      const originalId = typeof agent.id === 'string' ? agent.id : agent.id.toString();
      const qdrantId = this.getUuidForAgentId(originalId);
      
      console.log('--------------------------------');
      console.log('AGENT CREATION DEBUG:');
      console.log('Original agent ID:', originalId);
      console.log('Converted Qdrant UUID:', qdrantId);
      
      // Create a memory point compatible with Qdrant
      const point = this.adaptAgentToMemoryPoint(agent, qdrantId);
      console.log('Adapted memory point:', JSON.stringify(point, null, 2));
      
      console.log(`Storing agent ${originalId} with Qdrant UUID ${qdrantId}`);
      
      try {
        console.log('Calling addPoint on memoryClient...');
        console.log(`Vector length: ${point.vector.length}`);
        console.log(`Point ID (Qdrant UUID): ${point.id}`);
        try {
          await this.memoryClient.addPoint(this.collectionName, point);
          console.log('addPoint call completed successfully');
        } catch (innerError: unknown) {
          const typedError = innerError as Error;
          console.error('INNER ERROR in addPoint call:', innerError);
          console.error('Error details:', JSON.stringify({
            message: typedError.message || 'Unknown error',
            stack: typedError.stack || 'No stack trace',
            collectionName: this.collectionName,
            pointId: point.id,
            vectorLength: point.vector?.length
          }, null, 2));
          throw innerError;
        }
      } catch (addPointError) {
        console.error('ERROR in addPoint call:', addPointError);
        throw addPointError;
      }
      
      // Verify that the agent was stored successfully
      console.log('Verifying agent was stored successfully...');
      try {
        console.log(`Calling getPoints for ${qdrantId}...`);
        const storedAgents = await this.memoryClient.getPoints(
          this.collectionName,
          [qdrantId]
        );
        console.log('getPoints result:', JSON.stringify(storedAgents, null, 2));
        
        if (!storedAgents || storedAgents.length === 0) {
          console.error(`Failed to verify agent ${originalId} was stored in Qdrant`);
          return failureResult(
            new AppError(`Failed to verify agent ${originalId} was stored in Qdrant`, AgentMemoryErrorCode.CREATE_FAILED)
          );
        }
        
        console.log(`Successfully verified agent with id "${qdrantId}" was stored in Qdrant`);
      } catch (verifyError) {
        console.error('ERROR in verification:', verifyError);
        return failureResult(
          new AppError(`Error verifying agent: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`, AgentMemoryErrorCode.CREATE_FAILED)
        );
      }
      
      console.log('Agent creation successful!');
      console.log('--------------------------------');
      
      return { isError: false, value: originalId };
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
      
      const originalId = typeof agent.id === 'string' ? agent.id : agent.id.toString();
      const qdrantId = this.getUuidForAgentId(originalId);
      
      // Create a memory point compatible with Qdrant
      const point = this.adaptAgentToMemoryPoint(agent, qdrantId);

      // First check if the agent exists
      const existingAgents = await this.memoryClient.getPoints(
        this.collectionName,
        [qdrantId]
      );

      if (!existingAgents || existingAgents.length === 0) {
        return failureResult(new AppError(`Agent ${originalId} not found`, AgentMemoryErrorCode.NOT_FOUND));
      }

      await this.memoryClient.updatePoint(this.collectionName, qdrantId, point);
      return { isError: false, value: originalId };
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
      const qdrantId = this.getUuidForAgentId(agentId);
      
      const agents = await this.memoryClient.getPoints(
        this.collectionName,
        [qdrantId]
      );

      if (!agents || agents.length === 0) {
        return failureResult(new AppError(`Agent ${agentId} not found`, AgentMemoryErrorCode.NOT_FOUND));
      }

      // Extract the agent from the payload
      const memoryPoint = agents[0];
      const agent = memoryPoint.payload as any;
      
      // Restore the original agent ID
      if (agent.metadata && agent.metadata._originalId) {
        if (typeof agent.id === 'string') {
          agent.id = agent.metadata._originalId;
        } else if (agent.id) {
          // This is a structured ID, we might need to parse the string back
          try {
            agent.id = IdGenerator.parse(agent.metadata._originalId) || 
                      IdGenerator.generate(IdPrefix.AGENT);
          } catch (e) {
            console.warn(`Could not parse agent ID: ${agent.metadata._originalId}, using as string`);
            agent.id = agent.metadata._originalId as unknown as StructuredId;
          }
        }
      } else if (typeof agent.id === 'string') {
        agent.id = agentId;
      }
      
      return { isError: false, value: agent as AgentMemoryEntity };
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
      
      // Get all agents from the storage
      const searchResult = await this.memoryClient.searchPoints(
        this.collectionName,
        {
          vector: dummyVector,
          limit: 1000,
          filter: {},
          includeVectors: false
        }
      );

      if (!searchResult || searchResult.length === 0) {
        return { isError: false, value: [] };
      }

      console.log(`Raw searchResult contains ${searchResult.length} items`);
      if (searchResult.length > 0) {
        console.log('First item id:', searchResult[0].id);
        console.log('First item metadata:', JSON.stringify(searchResult[0].payload.metadata || {}, null, 2));
      }

      // Extract agents from the results
      const agents = searchResult.map((result) => {
        const agentData = result.payload as any;
        let originalId;
        
        // Log the ID conversion process
        console.log(`Processing agent: ${result.id}`);
        console.log(`Original payload ID: ${agentData.id}`);
        console.log(`Metadata contains _originalId: ${agentData.metadata && agentData.metadata._originalId ? 'yes' : 'no'}`);
        
        // Restore original agent ID if available
        if (agentData.metadata && agentData.metadata._originalId) {
          originalId = agentData.metadata._originalId;
          console.log(`Using _originalId from metadata: ${originalId}`);
          
          // Update the agent data ID to original value
          agentData.id = originalId;
        } else if (typeof agentData.id === 'string' && this.uuidToAgentIdMap.has(agentData.id)) {
          originalId = this.getAgentIdFromUuid(agentData.id);
          console.log(`Using mapped ID from UUID: ${originalId}`);
          
          // Update the agent data ID
          agentData.id = originalId;
        } else {
          console.log(`No ID mapping found, keeping original ID: ${agentData.id}`);
        }
        
        return agentData as AgentMemoryEntity;
      });

      console.log(`Returning ${agents.length} agents with correctly mapped IDs`);
      return { isError: false, value: agents };
    } catch (error) {
      console.error('Error getting agents from memory service:', error);
      return failureResult(
        new AppError(`Error getting agents: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.LIST_FAILED)
      );
    }
  }

  /**
   * Delete an agent
   * 
   * @param agentId ID of the agent to delete
   * @returns Success or error
   */
  async deleteAgent(agentId: string): Promise<Result<boolean>> {
    try {
      const qdrantId = this.getUuidForAgentId(agentId);
      
      await this.memoryClient.deletePoint(this.collectionName, qdrantId);
      
      // Remove from our maps
      const uuid = this.agentIdToUuidMap.get(agentId);
      if (uuid) {
        this.agentIdToUuidMap.delete(agentId);
        this.uuidToAgentIdMap.delete(uuid);
      }
      
      return { isError: false, value: true };
    } catch (error) {
      console.error('Error deleting agent from memory service:', error);
      return failureResult(
        new AppError(`Error deleting agent: ${error instanceof Error ? error.message : String(error)}`, AgentMemoryErrorCode.DELETE_FAILED)
      );
    }
  }
} 