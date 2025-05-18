import { ThinkingState } from '../types';
import { getMemoryServices } from '../../../../server/memory/services';
import { CognitiveArtifactService } from '../../cognitive/CognitiveArtifactService';
import { ImportanceLevel } from '../../../../constants/memory';
import artifactLogger, { ArtifactType, LogLevel } from '../../cognitive/ArtifactLogger';

/**
 * Node for storing cognitive artifacts generated during the thinking process
 * 
 * This node handles the persistent storage of thoughts, reasoning, insights,
 * and other cognitive artifacts in the memory system. It ensures proper
 * metadata and relationship linking for retrieval and context building.
 */
export async function storeCognitiveArtifactsNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    if (!state.userId || !state.input) {
      artifactLogger.logToConsole(LogLevel.WARN, 'Missing userId or input, skipping cognitive artifact storage');
      return state;
    }
    
    // Create an updated state to track stored artifacts
    const updatedState: ThinkingState = {
      ...state,
      cognitiveArtifacts: state.cognitiveArtifacts || {
        thoughtIds: [],
        entityIds: [],
        reasoningId: null,
        planId: null
      }
    };
    
    // Get memory services
    const { memoryService } = await getMemoryServices();
    const cognitiveService = new CognitiveArtifactService(memoryService);
    
    // Determine the stage of the thinking process based on state properties
    const stage = determineThinkingStage(state);
    artifactLogger.logToConsole(LogLevel.DEBUG, `Processing artifacts for stage: ${stage}`);
    
    // Store artifacts based on the current stage
    switch (stage) {
      case 'intent_analysis':
        await storeIntentThought(state, cognitiveService, updatedState);
        break;
        
      case 'entity_extraction':
        await storeEntities(state, cognitiveService, updatedState);
        break;
        
      case 'delegation_assessment':
        await storeDelegationReasoning(state, cognitiveService, updatedState);
        break;
        
      case 'planning':
        await storePlan(state, cognitiveService, updatedState);
        break;
        
      case 'reasoning':
        await storeReasoning(state, cognitiveService, updatedState);
        break;
        
      case 'completion':
        await storeCompletionInsight(state, cognitiveService, updatedState);
        break;
    }
    
    return updatedState;
  } catch (error) {
    artifactLogger.logToConsole(LogLevel.ERROR, `Error storing cognitive artifacts: ${error instanceof Error ? error.message : String(error)}`);
    return state;
  }
}

/**
 * Determine the current stage of the thinking process
 */
function determineThinkingStage(state: ThinkingState): string {
  if (state.response) {
    return 'completion';
  }
  
  if (state.reasoning && state.reasoning.length > 0) {
    return 'reasoning';
  }
  
  if (state.plan && state.plan.length > 0) {
    return 'planning';
  }
  
  if (state.shouldDelegate !== undefined) {
    return 'delegation_assessment';
  }
  
  if (state.entities && state.entities.length > 0) {
    return 'entity_extraction';
  }
  
  if (state.intent) {
    return 'intent_analysis';
  }
  
  return 'initial';
}

/**
 * Store intent analysis as a thought
 */
async function storeIntentThought(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.intent) return;
  
  const content = `
Intent Analysis:
Primary intent: ${state.intent.name} (${state.intent.confidence.toFixed(2)} confidence)
${state.intent.alternatives ? 
  `Alternative intents: ${state.intent.alternatives.map(
    alt => `${alt.name} (${alt.confidence.toFixed(2)})`
  ).join(', ')}` : ''}

From user message: "${state.input}"
  `.trim();
  
  const startTime = performance.now();
  
  try {
    const thoughtId = await cognitiveService.storeThought(
      content,
      {
        intention: 'intent_analysis',
        confidenceScore: state.intent.confidence,
        importance: ImportanceLevel.MEDIUM,
        tags: ['intent', 'analysis', 'thinking']
      }
    );
    
    const endTime = performance.now();
    
    if (thoughtId) {
      updatedState.cognitiveArtifacts!.thoughtIds.push(thoughtId);
      
      // Log successful storage
      artifactLogger.logStorage({
        type: ArtifactType.THOUGHT,
        id: thoughtId,
        userId: state.userId,
        summary: `Intent analysis: ${state.intent.name}`,
        importance: ImportanceLevel.MEDIUM,
        tags: ['intent', 'analysis', 'thinking'],
        stage: 'intent_analysis',
        timestamp: new Date().toISOString(),
        durationMs: Math.round(endTime - startTime)
      });
    }
  } catch (error) {
    artifactLogger.logStorageError(
      error instanceof Error ? error : new Error(String(error)),
      {
        type: ArtifactType.THOUGHT,
        userId: state.userId,
        summary: `Intent analysis: ${state.intent.name}`,
        stage: 'intent_analysis'
      }
    );
  }
}

/**
 * Store extracted entities as thoughts
 */
async function storeEntities(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.entities || state.entities.length === 0) return;
  
  for (const entity of state.entities) {
    const entityContent = `
Entity: ${entity.value}
Type: ${entity.type}
Confidence: ${entity.confidence.toFixed(2)}
From message: "${state.input}"
    `.trim();
    
    const startTime = performance.now();
    
    try {
      const entityId = await cognitiveService.storeThought(
        entityContent,
        {
          intention: 'entity_extraction',
          confidenceScore: entity.confidence,
          importance: ImportanceLevel.MEDIUM,
          relatedTo: updatedState.cognitiveArtifacts?.thoughtIds || [],
          tags: ['entity', entity.type, 'extraction']
        }
      );
      
      const endTime = performance.now();
      
      if (entityId) {
        updatedState.cognitiveArtifacts!.entityIds.push(entityId);
        
        // Log successful storage
        artifactLogger.logStorage({
          type: ArtifactType.ENTITY,
          id: entityId,
          userId: state.userId,
          summary: `Entity: ${entity.value} (${entity.type})`,
          importance: ImportanceLevel.MEDIUM,
          tags: ['entity', entity.type, 'extraction'],
          stage: 'entity_extraction',
          relatedTo: updatedState.cognitiveArtifacts?.thoughtIds,
          timestamp: new Date().toISOString(),
          durationMs: Math.round(endTime - startTime)
        });
      }
    } catch (error) {
      artifactLogger.logStorageError(
        error instanceof Error ? error : new Error(String(error)),
        {
          type: ArtifactType.ENTITY,
          userId: state.userId,
          summary: `Entity: ${entity.value} (${entity.type})`,
          stage: 'entity_extraction'
        }
      );
    }
  }
}

/**
 * Store delegation reasoning
 */
async function storeDelegationReasoning(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (state.shouldDelegate === undefined) return;
  
  const delegationSteps: string[] = [];
  
  // Add context assessment
  delegationSteps.push(`Analyzed user request: "${state.input}"`);
  
  // Add intent analysis
  if (state.intent) {
    delegationSteps.push(`Detected primary intent: ${state.intent.name} with ${state.intent.confidence.toFixed(2)} confidence`);
  }
  
  // Add entities found
  if (state.entities && state.entities.length > 0) {
    delegationSteps.push(`Extracted ${state.entities.length} entities: ${state.entities.map(e => `${e.value} (${e.type})`).join(', ')}`);
  }
  
  // Add delegation decision
  delegationSteps.push(`Assessed my capabilities for handling this request`);
  delegationSteps.push(`Determined that ${state.shouldDelegate ? 'task should be delegated' : 'I can handle this request myself'}`);
  
  // Add delegation target if applicable
  if (state.shouldDelegate && state.delegationTarget) {
    delegationSteps.push(`Identified appropriate delegation target: ${state.delegationTarget}`);
  }
  
  const startTime = performance.now();
  
  try {
    const reasoningId = await cognitiveService.storeReasoning(
      delegationSteps,
      state.shouldDelegate 
        ? `Task should be delegated to an agent with ${state.delegationTarget || 'specialized'} capabilities`
        : 'I will handle this request myself',
      {
        importance: ImportanceLevel.MEDIUM,
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        tags: ['delegation', 'reasoning', 'decision']
      }
    );
    
    const endTime = performance.now();
    
    if (reasoningId) {
      updatedState.cognitiveArtifacts!.reasoningId = reasoningId;
      
      // Log successful storage
      artifactLogger.logStorage({
        type: ArtifactType.REASONING,
        id: reasoningId,
        userId: state.userId,
        summary: `Delegation reasoning: ${state.shouldDelegate ? 'Should delegate' : 'Will handle myself'}`,
        importance: ImportanceLevel.MEDIUM,
        tags: ['delegation', 'reasoning', 'decision'],
        stage: 'delegation_assessment',
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        timestamp: new Date().toISOString(),
        durationMs: Math.round(endTime - startTime)
      });
    }
  } catch (error) {
    artifactLogger.logStorageError(
      error instanceof Error ? error : new Error(String(error)),
      {
        type: ArtifactType.REASONING,
        userId: state.userId,
        summary: `Delegation reasoning: ${state.shouldDelegate ? 'Should delegate' : 'Will handle myself'}`,
        stage: 'delegation_assessment'
      }
    );
  }
}

/**
 * Store execution plan
 */
async function storePlan(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.plan || state.plan.length === 0) return;
  
  const startTime = performance.now();
  
  try {
    const planId = await cognitiveService.storePlan(
      state.intent?.name || 'Execute user request',
      state.plan,
      {
        planType: 'task',
        importance: ImportanceLevel.MEDIUM,
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        influencedBy: updatedState.cognitiveArtifacts?.reasoningId 
          ? [updatedState.cognitiveArtifacts.reasoningId]
          : undefined,
        tags: ['execution', 'plan', 'steps']
      }
    );
    
    const endTime = performance.now();
    
    if (planId) {
      updatedState.cognitiveArtifacts!.planId = planId;
      
      // Log successful storage
      artifactLogger.logStorage({
        type: ArtifactType.PLAN,
        id: planId,
        userId: state.userId,
        summary: `Execution plan with ${state.plan.length} steps`,
        importance: ImportanceLevel.MEDIUM,
        tags: ['execution', 'plan', 'steps'],
        stage: 'planning',
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        timestamp: new Date().toISOString(),
        durationMs: Math.round(endTime - startTime)
      });
    }
  } catch (error) {
    artifactLogger.logStorageError(
      error instanceof Error ? error : new Error(String(error)),
      {
        type: ArtifactType.PLAN,
        userId: state.userId,
        summary: `Execution plan with ${state.plan.length} steps`,
        stage: 'planning'
      }
    );
  }
}

/**
 * Store reasoning steps
 */
async function storeReasoning(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.reasoning || state.reasoning.length === 0) return;
  
  const startTime = performance.now();
  
  try {
    const reasoningId = await cognitiveService.storeReasoning(
      state.reasoning,
      state.intent?.name || 'Process user request',
      {
        importance: ImportanceLevel.MEDIUM,
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        influencedBy: updatedState.cognitiveArtifacts?.planId 
          ? [updatedState.cognitiveArtifacts.planId]
          : undefined,
        tags: ['reasoning', 'thinking', 'steps']
      }
    );
    
    const endTime = performance.now();
    
    if (reasoningId) {
      // We already have a reasoning ID from delegation assessment, so we need to handle this case
      if (updatedState.cognitiveArtifacts!.reasoningId) {
        artifactLogger.logToConsole(
          LogLevel.WARN, 
          `Overwriting existing reasoning ID ${updatedState.cognitiveArtifacts!.reasoningId} with new one ${reasoningId}`
        );
      }
      
      updatedState.cognitiveArtifacts!.reasoningId = reasoningId;
      
      // Log successful storage
      artifactLogger.logStorage({
        type: ArtifactType.REASONING,
        id: reasoningId,
        userId: state.userId,
        summary: `Reasoning steps (${state.reasoning.length})`,
        importance: ImportanceLevel.MEDIUM,
        tags: ['reasoning', 'thinking', 'steps'],
        stage: 'reasoning',
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        timestamp: new Date().toISOString(),
        durationMs: Math.round(endTime - startTime)
      });
    }
  } catch (error) {
    artifactLogger.logStorageError(
      error instanceof Error ? error : new Error(String(error)),
      {
        type: ArtifactType.REASONING,
        userId: state.userId,
        summary: `Reasoning steps (${state.reasoning.length})`,
        stage: 'reasoning'
      }
    );
  }
}

/**
 * Store insights from the completed thinking process
 */
async function storeCompletionInsight(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.response) return;
  
  // Build insight content from the complete thinking process
  let insightContent = `Processed request: "${state.input}"\n\n`;
  
  if (state.intent) {
    insightContent += `Intent: ${state.intent.name} (${state.intent.confidence.toFixed(2)} confidence)\n`;
  }
  
  if (state.entities && state.entities.length > 0) {
    insightContent += `Entities: ${state.entities.map(e => `${e.value} (${e.type})`).join(', ')}\n`;
  }
  
  if (state.shouldDelegate) {
    insightContent += `Delegation: Task was ${state.shouldDelegate ? 'delegated' : 'handled directly'}\n`;
    if (state.delegationTarget) {
      insightContent += `Delegation target: ${state.delegationTarget}\n`;
    }
  }
  
  if (state.plan && state.plan.length > 0) {
    insightContent += `\nExecution plan:\n${state.plan.map((step, i) => `${i+1}. ${step}`).join('\n')}\n`;
  }
  
  if (state.tools && state.tools.length > 0) {
    insightContent += `\nTools used: ${state.tools.join(', ')}\n`;
  }
  
  insightContent += `\nResponse: ${state.response}`;
  
  const startTime = performance.now();
  
  try {
    const insightId = await cognitiveService.storeInsight(
      insightContent,
      {
        insightType: 'pattern',
        importance: ImportanceLevel.MEDIUM,
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        influencedBy: [
          ...(updatedState.cognitiveArtifacts?.reasoningId ? [updatedState.cognitiveArtifacts.reasoningId] : []),
          ...(updatedState.cognitiveArtifacts?.planId ? [updatedState.cognitiveArtifacts.planId] : [])
        ],
        tags: ['completion', 'insight', 'response']
      }
    );
    
    const endTime = performance.now();
    
    if (insightId) {
      // Log successful storage
      artifactLogger.logStorage({
        type: ArtifactType.INSIGHT,
        id: insightId,
        userId: state.userId,
        summary: `Completion insight: ${state.intent?.name || 'Processed user request'}`,
        importance: ImportanceLevel.MEDIUM,
        tags: ['completion', 'insight', 'response'],
        stage: 'completion',
        relatedTo: [
          ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
          ...(updatedState.cognitiveArtifacts?.entityIds || [])
        ],
        timestamp: new Date().toISOString(),
        durationMs: Math.round(endTime - startTime)
      });
    }
  } catch (error) {
    artifactLogger.logStorageError(
      error instanceof Error ? error : new Error(String(error)),
      {
        type: ArtifactType.INSIGHT,
        userId: state.userId,
        summary: `Completion insight: ${state.intent?.name || 'Processed user request'}`,
        stage: 'completion'
      }
    );
  }
} 