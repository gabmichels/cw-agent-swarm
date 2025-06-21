import { QdrantClient } from '@qdrant/js-client-rest';
import { 
  ExternalWorkflowConfig, 
  WorkflowIdGenerator,
  WorkflowPlatform,
  WorkflowParameter
} from '../interfaces/ExternalWorkflowInterfaces';
import { 
  WorkflowConfigurationError,
  WorkflowNotFoundError 
} from '../errors/ExternalWorkflowErrors';

/**
 * Agent entity with external workflows
 */
export interface AgentEntity {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly capabilities?: readonly string[];
  readonly externalWorkflows?: readonly ExternalWorkflowConfig[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isActive: boolean;
  readonly tags?: readonly string[];
}

/**
 * Workflow search filters
 */
export interface WorkflowSearchFilters {
  readonly platform?: WorkflowPlatform;
  readonly tags?: readonly string[];
  readonly isActive?: boolean;
  readonly nameContains?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

/**
 * Workflow match result
 */
export interface WorkflowMatch {
  readonly workflow: ExternalWorkflowConfig;
  readonly confidence: number;
  readonly matchedTriggers: readonly string[];
  readonly suggestedParams?: Record<string, unknown>;
}

/**
 * Agent workflow storage service
 * Manages external workflow configurations for agents using Qdrant vector database
 */
export class AgentWorkflowStorage {
  private readonly collectionName = 'agents';

  constructor(private readonly qdrantClient: QdrantClient) {}

  /**
   * Save workflow configuration to agent
   */
  async saveWorkflowToAgent(
    agentId: string, 
    workflow: Omit<ExternalWorkflowConfig, 'id' | 'createdAt' | 'executionCount' | 'lastExecuted'>
  ): Promise<ExternalWorkflowConfig> {
    try {
      // Generate workflow ID
      const workflowId = WorkflowIdGenerator.generate('wf');
      
      // Create complete workflow config
      const completeWorkflow: ExternalWorkflowConfig = {
        id: workflowId,
        createdAt: new Date(),
        executionCount: 0,
        ...workflow
      };

      // Get current agent data
      const agent = await this.getAgentEntity(agentId);
      
      // Add workflow to agent's workflows
      const updatedWorkflows = [...(agent.externalWorkflows || []), completeWorkflow];
      
      // Update agent entity
      const updatedAgent: AgentEntity = {
        ...agent,
        externalWorkflows: updatedWorkflows,
        updatedAt: new Date()
      };

      // Save to Qdrant
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: agentId,
          payload: JSON.parse(JSON.stringify(updatedAgent)) as Record<string, unknown>,
          vector: await this.generateAgentVector(updatedAgent)
        }]
      });

      return completeWorkflow;

    } catch (error) {
      throw new WorkflowConfigurationError(
        'unknown',
        `Failed to save workflow to agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, workflow, error }
      );
    }
  }

  /**
   * Get all workflows for an agent
   */
  async getAgentWorkflows(agentId: string): Promise<readonly ExternalWorkflowConfig[]> {
    try {
      const agent = await this.getAgentEntity(agentId);
      return agent.externalWorkflows || [];
    } catch (error) {
      throw new WorkflowConfigurationError(
        agentId,
        `Failed to get agent workflows: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, error }
      );
    }
  }

  /**
   * Find workflow by trigger matching
   */
  async findWorkflowByTrigger(
    agentId: string, 
    userInput: string,
    minConfidence = 0.6
  ): Promise<WorkflowMatch | null> {
    try {
      const workflows = await this.getAgentWorkflows(agentId);
      const activeWorkflows = workflows.filter(wf => wf.isActive);
      
      let bestMatch: WorkflowMatch | null = null;
      let maxConfidence = 0;

      for (const workflow of activeWorkflows) {
        const matchResult = this.calculateTriggerMatch(userInput, workflow);
        
        if (matchResult.confidence >= minConfidence && matchResult.confidence > maxConfidence) {
          maxConfidence = matchResult.confidence;
          bestMatch = {
            workflow,
            confidence: matchResult.confidence,
            matchedTriggers: matchResult.matchedTriggers,
            suggestedParams: this.extractParametersFromInput(userInput, workflow.parameters)
          };
        }
      }

      return bestMatch;

    } catch (error) {
      throw new WorkflowConfigurationError(
        agentId,
        `Failed to find workflow by trigger: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, userInput, error }
      );
    }
  }

  /**
   * Get agent entity from Qdrant
   */
  private async getAgentEntity(agentId: string): Promise<AgentEntity> {
    try {
      const result = await this.qdrantClient.retrieve(this.collectionName, {
        ids: [agentId],
        with_payload: true
      });

      if (result.length === 0) {
        // Create new agent entity if not found
        const newAgent: AgentEntity = {
          id: agentId,
          name: `Agent ${agentId}`,
          externalWorkflows: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };

        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points: [{
            id: agentId,
            payload: JSON.parse(JSON.stringify(newAgent)) as Record<string, unknown>,
            vector: await this.generateAgentVector(newAgent)
          }]
        });

        return newAgent;
      }

      const payload = result[0].payload as Record<string, unknown>;
      
      // Properly reconstruct workflow IDs
      const externalWorkflows = payload.externalWorkflows as any[];
      const reconstructedWorkflows = externalWorkflows?.map(wf => ({
        ...wf,
        id: typeof wf.id === 'string' ? WorkflowIdGenerator.parse(wf.id) : wf.id,
        createdAt: new Date(wf.createdAt),
        lastExecuted: wf.lastExecuted ? new Date(wf.lastExecuted) : undefined
      })) || [];
      
      return {
        id: payload.id as string,
        name: payload.name as string,
        description: payload.description as string | undefined,
        capabilities: payload.capabilities as readonly string[] | undefined,
        externalWorkflows: reconstructedWorkflows,
        createdAt: new Date(payload.createdAt as string),
        updatedAt: new Date(payload.updatedAt as string),
        isActive: payload.isActive as boolean,
        tags: payload.tags as readonly string[] | undefined
      };

    } catch (error) {
      throw new WorkflowConfigurationError(
        agentId,
        `Failed to get agent entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId, error }
      );
    }
  }

  /**
   * Generate vector embedding for agent (placeholder implementation)
   */
  private async generateAgentVector(agent: AgentEntity): Promise<number[]> {
    // Placeholder implementation - replace with real embedding service
    const text = [
      agent.name,
      agent.description || '',
      ...(agent.capabilities || []),
      ...(agent.externalWorkflows || []).flatMap(wf => [
        wf.name,
        wf.description,
        ...wf.nlpTriggers,
        ...wf.tags
      ])
    ].join(' ');

    // Simple hash-based vector generation
    const vector: number[] = new Array(384).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % vector.length] += charCode / 1000;
    }

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Calculate trigger match confidence
   */
  private calculateTriggerMatch(
    userInput: string, 
    workflow: ExternalWorkflowConfig
  ): { confidence: number; matchedTriggers: string[] } {
    const inputLower = userInput.toLowerCase();
    const inputWords = inputLower.split(/\s+/).filter(word => word.length > 2);
    
    let maxConfidence = 0;
    const matchedTriggers: string[] = [];

    for (const trigger of workflow.nlpTriggers) {
      const triggerLower = trigger.toLowerCase();
      const triggerWords = triggerLower.split(/\s+/).filter(word => word.length > 2);
      
      if (triggerWords.length === 0) continue;

      // Calculate word overlap
      const matchingWords = triggerWords.filter(triggerWord =>
        inputWords.some(inputWord => 
          inputWord.includes(triggerWord) || triggerWord.includes(inputWord)
        )
      );

      const confidence = matchingWords.length / triggerWords.length;
      
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
      }
      
      if (confidence > 0.4) {
        matchedTriggers.push(trigger);
      }
    }

    return {
      confidence: maxConfidence,
      matchedTriggers
    };
  }

  /**
   * Extract parameters from user input
   */
  private extractParametersFromInput(
    input: string, 
    parameters: readonly WorkflowParameter[]
  ): Record<string, unknown> {
    const extractedParams: Record<string, unknown> = {};
    const inputLower = input.toLowerCase();

    // Simple parameter extraction patterns
    const patterns = [
      /(\w+):\s*([^,\n]+)/g,
      /(\w+)=([^,\s]+)/g,
      /(\w+)\s+is\s+([^,\n]+)/gi,
      /set\s+(\w+)\s+to\s+([^,\n]+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(inputLower)) !== null) {
        const paramName = match[1].trim();
        const paramValue = match[2].trim();
        
        // Find matching parameter
        const parameter = parameters.find(p => 
          p.name.toLowerCase() === paramName ||
          p.name.toLowerCase().includes(paramName) ||
          paramName.includes(p.name.toLowerCase())
        );

        if (parameter) {
          extractedParams[parameter.name] = this.convertValue(paramValue, parameter.type);
        }
      }
    }

    // Set default values for missing parameters
    for (const parameter of parameters) {
      if (!(parameter.name in extractedParams) && parameter.defaultValue !== undefined) {
        extractedParams[parameter.name] = parameter.defaultValue;
      }
    }

    return extractedParams;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        const lowerValue = value.toLowerCase();
        return ['true', 'yes', '1', 'on'].includes(lowerValue);
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'array':
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return value.split(',').map(item => item.trim());
        }
      default:
        return value;
    }
  }
}