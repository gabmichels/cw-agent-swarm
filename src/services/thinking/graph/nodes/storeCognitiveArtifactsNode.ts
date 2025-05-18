import { ThinkingState } from '../types';
import { getMemoryServices } from '../../../../server/memory/services';
import { CognitiveArtifactService } from '../../cognitive/CognitiveArtifactService';
import { ImportanceLevel } from '../../../../constants/memory';

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
      console.warn('Missing userId or input, skipping cognitive artifact storage');
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
    console.error('Error storing cognitive artifacts:', error);
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
  
  const thoughtId = await cognitiveService.storeThought(
    content,
    {
      intention: 'intent_analysis',
      confidenceScore: state.intent.confidence,
      importance: ImportanceLevel.MEDIUM,
      tags: ['intent', 'analysis', 'thinking']
    }
  );
  
  if (thoughtId) {
    updatedState.cognitiveArtifacts!.thoughtIds.push(thoughtId);
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
    
    if (entityId) {
      updatedState.cognitiveArtifacts!.entityIds.push(entityId);
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
  
  if (reasoningId) {
    updatedState.cognitiveArtifacts!.reasoningId = reasoningId;
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
        : [],
      tags: ['plan', 'execution']
    }
  );
  
  if (planId) {
    updatedState.cognitiveArtifacts!.planId = planId;
  }
}

/**
 * Store reasoning process
 */
async function storeReasoning(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.reasoning || state.reasoning.length === 0) return;
  
  const reasoningId = await cognitiveService.storeReasoning(
    state.reasoning,
    state.intent?.name || 'Reasoning about user request',
    {
      importance: ImportanceLevel.MEDIUM,
      relatedTo: [
        ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
        ...(updatedState.cognitiveArtifacts?.entityIds || [])
      ],
      influencedBy: updatedState.cognitiveArtifacts?.planId 
        ? [updatedState.cognitiveArtifacts.planId] 
        : [],
      tags: ['reasoning', 'thinking-process']
    }
  );
  
  if (reasoningId) {
    updatedState.cognitiveArtifacts!.reasoningId = reasoningId;
  }
}

/**
 * Store completion insight
 */
async function storeCompletionInsight(
  state: ThinkingState, 
  cognitiveService: CognitiveArtifactService,
  updatedState: ThinkingState
): Promise<void> {
  if (!state.response) return;
  
  const insightContent = `
Request Completion Analysis:

User requested: "${state.input}"
Intent identified: ${state.intent?.name || 'Unknown'}
Entities extracted: ${state.entities?.map(e => `${e.value} (${e.type})`).join(', ') || 'None'}
${state.shouldDelegate 
  ? `Delegated to: ${state.delegationTarget || 'specialist'}`
  : `Handled with ${state.tools?.length || 0} tools and ${state.reasoning?.length || 0} reasoning steps`
}

Response summary: "${state.response.substring(0, 100)}${state.response.length > 100 ? '...' : ''}"
  `.trim();
  
  await cognitiveService.storeInsight(
    insightContent,
    {
      insightType: 'pattern',
      importance: ImportanceLevel.MEDIUM,
      relatedTo: [
        ...(updatedState.cognitiveArtifacts?.thoughtIds || []),
        ...(updatedState.cognitiveArtifacts?.entityIds || []),
        ...(updatedState.cognitiveArtifacts?.reasoningId ? [updatedState.cognitiveArtifacts.reasoningId] : []),
        ...(updatedState.cognitiveArtifacts?.planId ? [updatedState.cognitiveArtifacts.planId] : [])
      ],
      tags: ['completion', 'insight', 'summary']
    }
  );
} 