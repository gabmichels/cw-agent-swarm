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
  
  /**
   * Retrieve a thought by ID
   */
  async getThought(
    id: string
  ): Promise<{ content: string; metadata: ThoughtMetadata } | null> {
    try {
      const memory = await this.memoryService.getMemory({
        id,
        type: MemoryType.THOUGHT
      });
      
      if (!memory || !memory.payload) {
        return null;
      }
      
      return {
        content: memory.payload.text,
        metadata: memory.payload.metadata as ThoughtMetadata
      };
    } catch (error) {
      console.error('Error retrieving thought:', error);
      return null;
    }
  }
  
  /**
   * Retrieve a reasoning artifact by ID
   * (Reasoning artifacts are stored as thoughts with intention="reasoning")
   */
  async getReasoning(
    id: string
  ): Promise<{ content: string; steps: string[]; conclusion: string; metadata: ThoughtMetadata } | null> {
    try {
      const thought = await this.getThought(id);
      
      if (!thought || thought.metadata.intention !== 'reasoning') {
        return null;
      }
      
      // Parse content to extract steps and conclusion
      const content = thought.content;
      const lines = content.split('\n');
      let steps: string[] = [];
      let conclusion = '';
      
      // Extract steps
      const stepsStartIndex = lines.findIndex(line => line.includes('Reasoning Steps:'));
      const conclusionIndex = lines.findIndex(line => line.includes('Conclusion:'));
      
      if (stepsStartIndex !== -1 && conclusionIndex !== -1) {
        steps = lines
          .slice(stepsStartIndex + 1, conclusionIndex)
          .filter(line => line.trim().length > 0)
          .map(line => {
            const match = line.match(/^\d+\.\s*(.+)$/);
            return match ? match[1] : line;
          });
          
        conclusion = lines[conclusionIndex].replace('Conclusion:', '').trim();
        if (conclusion.length === 0 && conclusionIndex < lines.length - 1) {
          conclusion = lines.slice(conclusionIndex + 1).join('\n').trim();
        }
      }
      
      return {
        content,
        steps,
        conclusion,
        metadata: thought.metadata
      };
    } catch (error) {
      console.error('Error retrieving reasoning:', error);
      return null;
    }
  }
  
  /**
   * Retrieve a reflection by ID
   */
  async getReflection(
    id: string
  ): Promise<{ content: string; metadata: ReflectionMetadata } | null> {
    try {
      const memory = await this.memoryService.getMemory({
        id,
        type: MemoryType.REFLECTION
      });
      
      if (!memory || !memory.payload) {
        return null;
      }
      
      return {
        content: memory.payload.text,
        metadata: memory.payload.metadata as ReflectionMetadata
      };
    } catch (error) {
      console.error('Error retrieving reflection:', error);
      return null;
    }
  }
  
  /**
   * Retrieve an insight by ID
   */
  async getInsight(
    id: string
  ): Promise<{ content: string; metadata: InsightMetadata } | null> {
    try {
      const memory = await this.memoryService.getMemory({
        id,
        type: MemoryType.INSIGHT
      });
      
      if (!memory || !memory.payload) {
        return null;
      }
      
      return {
        content: memory.payload.text,
        metadata: memory.payload.metadata as InsightMetadata
      };
    } catch (error) {
      console.error('Error retrieving insight:', error);
      return null;
    }
  }
  
  /**
   * Retrieve a plan by ID
   */
  async getPlan(
    id: string
  ): Promise<{ content: string; goal: string; steps: string[]; metadata: PlanningMetadata } | null> {
    try {
      const memory = await this.memoryService.getMemory({
        id,
        type: MemoryType.TASK
      });
      
      if (!memory || !memory.payload || 
          (memory.payload.metadata as PlanningMetadata).processType !== CognitiveProcessType.PLANNING) {
        return null;
      }
      
      // Parse content to extract goal and steps
      const content = memory.payload.text;
      const lines = content.split('\n');
      let goal = '';
      let steps: string[] = [];
      
      // Extract goal
      const goalIndex = lines.findIndex(line => line.includes('Goal:'));
      if (goalIndex !== -1) {
        goal = lines[goalIndex].replace('Goal:', '').trim();
      }
      
      // Extract steps
      const stepsStartIndex = lines.findIndex(line => line.includes('Plan Steps:'));
      if (stepsStartIndex !== -1) {
        steps = lines
          .slice(stepsStartIndex + 1)
          .filter(line => line.trim().length > 0)
          .map(line => {
            const match = line.match(/^\d+\.\s*(.+)$/);
            return match ? match[1] : line;
          });
      }
      
      return {
        content,
        goal,
        steps,
        metadata: memory.payload.metadata as PlanningMetadata
      };
    } catch (error) {
      console.error('Error retrieving plan:', error);
      return null;
    }
  }
  
  /**
   * Retrieve a task by ID
   */
  async getTask(
    id: string
  ): Promise<{ title: string; description: string; metadata: TaskMetadata } | null> {
    try {
      const memory = await this.memoryService.getMemory({
        id,
        type: MemoryType.TASK
      });
      
      if (!memory || !memory.payload) {
        return null;
      }
      
      // Since TaskMetadata doesn't have processType, we need to check differently
      // We're expecting a certain structure in the content rather than checking processType
      const content = memory.payload.text;
      const lines = content.split('\n');
      let title = '';
      let description = '';
      
      if (lines.length > 0) {
        title = lines[0].trim();
        description = lines.slice(1).join('\n').trim();
      }
      
      return {
        title,
        description,
        metadata: memory.payload.metadata as TaskMetadata
      };
    } catch (error) {
      console.error('Error retrieving task:', error);
      return null;
    }
  }
  
  /**
   * Retrieve related cognitive artifacts
   * 
   * This method follows relationship links to retrieve connected artifacts
   */
  async getRelatedArtifacts(
    id: string,
    options: {
      types?: Array<CognitiveProcessType | MemoryType>;
      relationshipType?: 'relatedTo' | 'influencedBy' | 'influences';
      limit?: number;
    } = {}
  ): Promise<Array<{
    id: string;
    type: MemoryType;
    content: string;
    metadata: ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata;
  }>> {
    try {
      // Determine memory type
      let memoryType: MemoryType | null = null;
      for (const type of Object.values(MemoryType)) {
        const memory = await this.memoryService.getMemory({
          id,
          type
        });
        
        if (memory) {
          memoryType = type;
          break;
        }
      }
      
      if (!memoryType) {
        return [];
      }
      
      // Get the memory to find related IDs
      const memory = await this.memoryService.getMemory({
        id,
        type: memoryType
      });
      
      if (!memory || !memory.payload || !memory.payload.metadata) {
        return [];
      }
      
      // Extract related IDs based on relationship type
      const metadata = memory.payload.metadata as ThoughtMetadata;
      let relatedIds: string[] = [];
      
      if (options.relationshipType === 'influencedBy' && 'influencedBy' in metadata) {
        relatedIds = metadata.influencedBy || [];
      } else if (options.relationshipType === 'influences') {
        // We need to search for artifacts that list this ID in their influencedBy
        const searchResults = await this.memoryService.searchMemories({
          type: memoryType, // Default to same type, but this might need to be broader
          filter: {
            'metadata.influencedBy': id
          },
          limit: options.limit || 10
        });
        
        relatedIds = searchResults.map(result => result.id);
      } else {
        // Default to relatedTo
        relatedIds = metadata.relatedTo || [];
      }
      
      // Fetch each related memory
      const relatedMemoriesPromises = relatedIds.map(async (relatedId) => {
        // Try each memory type
        for (const type of Object.values(MemoryType)) {
          // Skip if types filter is provided and this type isn't included
          if (options.types && 
              !options.types.includes(type) && 
              !options.types.includes(CognitiveProcessType.THOUGHT)) {
            continue;
          }
          
          const relatedMemory = await this.memoryService.getMemory({
            id: relatedId,
            type
          });
          
          if (relatedMemory && relatedMemory.payload) {
            return {
              id: relatedId,
              type,
              content: relatedMemory.payload.text,
              metadata: relatedMemory.payload.metadata as (
                ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata
              )
            };
          }
        }
        
        return null;
      });
      
      // Resolve all promises
      const relatedMemories = await Promise.all(relatedMemoriesPromises);
      
      // Filter out nulls and respect limit
      return relatedMemories
        .filter((item): item is {
          id: string;
          type: MemoryType;
          content: string;
          metadata: ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata;
        } => item !== null)
        .slice(0, options.limit || relatedMemories.length);
    } catch (error) {
      console.error('Error retrieving related artifacts:', error);
      return [];
    }
  }
  
  /**
   * Traverse a reasoning chain
   * 
   * Follows influence links to reconstruct a chain of reasoning
   */
  async traverseReasoningChain(
    startId: string,
    options: {
      maxDepth?: number;
      direction?: 'forward' | 'backward' | 'both';
    } = {}
  ): Promise<Array<{
    id: string;
    type: MemoryType;
    content: string;
    metadata: ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata;
    depth: number;
  }>> {
    const maxDepth = options.maxDepth || 5;
    const direction = options.direction || 'both';
    const visited = new Set<string>();
    const result: Array<{
      id: string;
      type: MemoryType;
      content: string;
      metadata: ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata;
      depth: number;
    }> = [];
    
    // Helper function for BFS traversal
    const traverseChain = async (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) {
        return;
      }
      
      visited.add(id);
      
      // Try each memory type to find the artifact
      for (const type of Object.values(MemoryType)) {
        const memory = await this.memoryService.getMemory({
          id,
          type
        });
        
        if (memory && memory.payload) {
          result.push({
            id,
            type,
            content: memory.payload.text,
            metadata: memory.payload.metadata as (
              ThoughtMetadata | ReflectionMetadata | InsightMetadata | PlanningMetadata | TaskMetadata
            ),
            depth
          });
          
          // Get influences and influenced-by based on direction
          if (direction === 'forward' || direction === 'both') {
            // Find artifacts influenced by this one
            const influencedArtifacts = await this.getRelatedArtifacts(id, {
              relationshipType: 'influences'
            });
            
            for (const artifact of influencedArtifacts) {
              await traverseChain(artifact.id, depth + 1);
            }
          }
          
          if (direction === 'backward' || direction === 'both') {
            // Find artifacts that influenced this one
            const metadata = memory.payload.metadata as ThoughtMetadata;
            const influencedBy = metadata.influencedBy || [];
            
            for (const influencerId of influencedBy) {
              await traverseChain(influencerId, depth + 1);
            }
          }
          
          break;
        }
      }
    };
    
    // Start traversal from the given ID
    await traverseChain(startId, 0);
    
    // Sort by depth for clearer reasoning chain
    return result.sort((a, b) => a.depth - b.depth);
  }
} 