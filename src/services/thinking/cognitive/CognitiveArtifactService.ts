import { 
  MemoryType,
  MemoryErrorCode 
} from '../../../server/memory/config';

import { 
  createThoughtMetadata,
  createReflectionMetadata,
  createInsightMetadata,
  createPlanningMetadata,
  createTaskMetadata
} from '../../../server/memory/services/helpers/metadata-helpers';

import {
  createStructuredId,
  createAgentId,
  StructuredId
} from '../../../types/structured-id';

import {
  CognitiveProcessType,
  ThoughtMetadata,
  ReflectionMetadata,
  InsightMetadata,
  PlanningMetadata,
  TaskMetadata,
  TaskStatus,
  TaskPriority
} from '../../../types/metadata';

import { MemoryService } from '../../../server/memory/services/memory/memory-service';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';

/**
 * Service for storing and retrieving cognitive artifacts
 * Ensures all artifacts are persisted with proper metadata and relationships
 */
export class CognitiveArtifactService {
  private memoryService: MemoryService;
  private agentId: StructuredId;
  
  constructor(memoryService: MemoryService, agentId?: string) {
    this.memoryService = memoryService;
    this.agentId = createAgentId(agentId || 'default');
  }
  
  /**
   * Store a cognitive thought in memory with proper metadata
   */
  async storeThought(
    content: string,
    options: {
      intention?: string;
      confidenceScore?: number;
      importance?: ImportanceLevel;
      relatedTo?: string[];
      influencedBy?: string[];
      contextId?: string;
      tags?: string[];
      category?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Create proper thought metadata
      const metadata = createThoughtMetadata(
        this.agentId,
        {
          processType: CognitiveProcessType.THOUGHT,
          intention: options.intention,
          confidenceScore: options.confidenceScore,
          relatedTo: options.relatedTo || [],
          influencedBy: options.influencedBy || [],
          contextId: options.contextId,
          importance: options.importance || ImportanceLevel.MEDIUM,
          tags: options.tags || [],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.THOUGHT,
        content,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing thought:', error);
      return null;
    }
  }
  
  /**
   * Store reasoning steps with proper metadata and relationships
   */
  async storeReasoning(
    steps: string[],
    conclusion: string,
    options: {
      importance?: ImportanceLevel;
      relatedTo?: string[];
      influencedBy?: string[];
      contextId?: string;
      confidence?: number;
      tags?: string[];
      category?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Format the content to include all reasoning steps
      const content = `
Reasoning Steps:
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Conclusion: ${conclusion}
      `.trim();
      
      // Create proper thought metadata with reasoning intention
      const metadata = createThoughtMetadata(
        this.agentId,
        {
          processType: CognitiveProcessType.THOUGHT,
          intention: 'reasoning',
          confidenceScore: options.confidence || 0.8,
          relatedTo: options.relatedTo || [],
          influencedBy: options.influencedBy || [],
          contextId: options.contextId,
          importance: options.importance || ImportanceLevel.MEDIUM,
          tags: [...(options.tags || []), 'reasoning', 'logic-chain'],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.THOUGHT,
        content,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing reasoning:', error);
      return null;
    }
  }
  
  /**
   * Store a reflection with proper metadata
   */
  async storeReflection(
    content: string,
    options: {
      reflectionType?: 'experience' | 'behavior' | 'strategy' | 'performance';
      timeScope?: 'immediate' | 'short-term' | 'long-term';
      importance?: ImportanceLevel;
      relatedTo?: string[];
      influencedBy?: string[];
      contextId?: string;
      tags?: string[];
      category?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Create proper reflection metadata
      const metadata = createReflectionMetadata(
        this.agentId,
        {
          processType: CognitiveProcessType.REFLECTION,
          reflectionType: options.reflectionType || 'experience',
          timeScope: options.timeScope || 'immediate',
          relatedTo: options.relatedTo || [],
          influencedBy: options.influencedBy || [],
          contextId: options.contextId,
          importance: options.importance || ImportanceLevel.MEDIUM,
          tags: [...(options.tags || []), 'reflection'],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.REFLECTION,
        content,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing reflection:', error);
      return null;
    }
  }
  
  /**
   * Store an insight with proper metadata
   */
  async storeInsight(
    content: string,
    options: {
      insightType?: 'pattern' | 'implication' | 'prediction' | 'opportunity';
      applicationContext?: string[];
      validityPeriod?: {
        from?: string;
        to?: string;
      };
      importance?: ImportanceLevel;
      relatedTo?: string[];
      influencedBy?: string[];
      contextId?: string;
      tags?: string[];
      category?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Create proper insight metadata
      const metadata = createInsightMetadata(
        this.agentId,
        {
          processType: CognitiveProcessType.INSIGHT,
          insightType: options.insightType || 'pattern',
          applicationContext: options.applicationContext || [],
          validityPeriod: options.validityPeriod,
          relatedTo: options.relatedTo || [],
          influencedBy: options.influencedBy || [],
          contextId: options.contextId,
          importance: options.importance || ImportanceLevel.HIGH,
          tags: [...(options.tags || []), 'insight'],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.INSIGHT,
        content,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing insight:', error);
      return null;
    }
  }
  
  /**
   * Store planning information with proper metadata
   */
  async storePlan(
    goal: string,
    steps: string[],
    options: {
      planType?: 'task' | 'strategy' | 'contingency';
      estimatedSteps?: number;
      dependsOn?: string[];
      importance?: ImportanceLevel;
      relatedTo?: string[];
      influencedBy?: string[];
      contextId?: string;
      tags?: string[];
      category?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Format content to include goal and steps
      const content = `
Goal: ${goal}

Plan Steps:
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}
      `.trim();
      
      // Create proper planning metadata
      const metadata = createPlanningMetadata(
        this.agentId,
        {
          processType: CognitiveProcessType.PLANNING,
          planType: options.planType || 'task',
          estimatedSteps: options.estimatedSteps || steps.length,
          dependsOn: options.dependsOn || [],
          relatedTo: options.relatedTo || [],
          influencedBy: options.influencedBy || [],
          contextId: options.contextId,
          importance: options.importance || ImportanceLevel.HIGH,
          tags: [...(options.tags || []), 'plan'],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.TASK,
        content,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing plan:', error);
      return null;
    }
  }
  
  /**
   * Store a task with proper metadata
   */
  async storeTask(
    title: string,
    description: string,
    options: {
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
      parentTaskId?: string;
      subtaskIds?: string[];
      dependsOn?: string[];
      blockedBy?: string[];
      importance?: ImportanceLevel;
      relatedTo?: string[];
      tags?: string[];
    } = {}
  ): Promise<string | null> {
    try {
      // Create proper task metadata
      const metadata = createTaskMetadata(
        title,
        options.status || TaskStatus.PENDING,
        options.priority || TaskPriority.MEDIUM,
        this.agentId,
        {
          description,
          dueDate: options.dueDate,
          parentTaskId: options.parentTaskId,
          subtaskIds: options.subtaskIds || [],
          dependsOn: options.dependsOn || [],
          blockedBy: options.blockedBy || [],
          importance: options.importance || ImportanceLevel.MEDIUM,
          tags: [...(options.tags || []), 'task'],
          source: MemorySource.AGENT
        }
      );
      
      // Add the memory with proper metadata
      const result = await this.memoryService.addMemory({
        type: MemoryType.TASK,
        content: `${title}: ${description}`,
        metadata
      });
      
      return result.success ? (result.id || null) : null;
    } catch (error) {
      console.error('Error storing task:', error);
      return null;
    }
  }
  
  /**
   * Store thinking result from thinking service
   * Preserves the complete reasoning process and establishes links between thoughts
   */
  async storeThinkingResult(
    thinking: {
      intent: {
        primary: string;
        confidence: number;
        alternatives?: Array<{intent: string, confidence: number}>;
      };
      entities?: Array<{type: string, value: string, confidence: number}>;
      reasoning?: string[];
      planSteps?: string[];
      shouldDelegate?: boolean;
    },
    userId: string,
    message: string,
    options: {
      contextId?: string;
      importance?: ImportanceLevel;
      relatedMemories?: string[];
    } = {}
  ): Promise<{
    thoughtId: string | null;
    planId: string | null;
    entityIds: string[];
  }> {
    // Track created memory IDs for relationships
    const memoryIds: string[] = [];
    const entityIds: string[] = [];
    
    try {
      // 1. Store the main thought (intent analysis)
      const intentThoughtContent = `
Analysis of user message: "${message}"

Primary intent: ${thinking.intent.primary} (${thinking.intent.confidence.toFixed(2)} confidence)
${thinking.intent.alternatives ? 
  `Alternative intents: ${thinking.intent.alternatives.map(
    alt => `${alt.intent} (${alt.confidence.toFixed(2)})`
  ).join(', ')}` : ''}
      `.trim();
      
      const intentThoughtId = await this.storeThought(
        intentThoughtContent,
        {
          intention: 'intent_analysis',
          confidenceScore: thinking.intent.confidence,
          importance: options.importance || ImportanceLevel.MEDIUM,
          relatedTo: options.relatedMemories || [],
          contextId: options.contextId,
          tags: ['intent', 'analysis', 'thinking']
        }
      );
      
      if (intentThoughtId) {
        memoryIds.push(intentThoughtId);
      }
      
      // 2. Store entities as separate thoughts with relationships to the intent thought
      if (thinking.entities && thinking.entities.length > 0) {
        for (const entity of thinking.entities) {
          const entityContent = `
Entity: ${entity.value}
Type: ${entity.type}
Confidence: ${entity.confidence.toFixed(2)}
From message: "${message}"
          `.trim();
          
          const entityId = await this.storeThought(
            entityContent,
            {
              intention: 'entity_extraction',
              confidenceScore: entity.confidence,
              importance: ImportanceLevel.MEDIUM,
              relatedTo: [...memoryIds],
              contextId: options.contextId,
              tags: ['entity', entity.type, 'extraction']
            }
          );
          
          if (entityId) {
            entityIds.push(entityId);
          }
        }
      }
      
      // 3. Store reasoning process with links to intent thought
      let reasoningId: string | null = null;
      if (thinking.reasoning && thinking.reasoning.length > 0) {
        reasoningId = await this.storeReasoning(
          thinking.reasoning,
          thinking.intent.primary,
          {
            importance: options.importance || ImportanceLevel.MEDIUM,
            relatedTo: [...memoryIds, ...entityIds],
            contextId: options.contextId,
            confidence: thinking.intent.confidence,
            tags: ['reasoning', 'thinking-process']
          }
        );
        
        if (reasoningId) {
          memoryIds.push(reasoningId);
        }
      }
      
      // 4. Store plan if available
      let planId: string | null = null;
      if (thinking.planSteps && thinking.planSteps.length > 0) {
        planId = await this.storePlan(
          thinking.intent.primary,
          thinking.planSteps,
          {
            planType: 'task',
            importance: options.importance || ImportanceLevel.MEDIUM,
            relatedTo: [...memoryIds],
            influencedBy: reasoningId ? [reasoningId] : [],
            contextId: options.contextId,
            tags: ['plan', 'execution']
          }
        );
      }
      
      return {
        thoughtId: intentThoughtId,
        planId,
        entityIds
      };
    } catch (error) {
      console.error('Error storing thinking result:', error);
      return {
        thoughtId: null,
        planId: null,
        entityIds: []
      };
    }
  }
} 