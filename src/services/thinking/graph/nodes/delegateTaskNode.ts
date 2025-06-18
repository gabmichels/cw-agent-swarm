import { ThinkingState } from '../types';
import { IdGenerator } from '@/utils/ulid';
import { getMemoryServices } from '../../../../server/memory/services';
import { ImportanceLevel, MemorySource, MemoryType } from '../../../../constants/memory';
import { CognitiveArtifactService } from '../../cognitive/CognitiveArtifactService';
import { createTaskMetadata, createAgentToAgentMessageMetadata } from '../../../../server/memory/services/helpers/metadata-helpers';
import { 
  createAgentId, 
  createStructuredId,
  EntityNamespace,
  EntityType
} from '../../../../types/entity-identifier';
import { TaskPriority, TaskStatus, MessagePriority } from '../../../../types/metadata';

/**
 * Node for delegating a task to another agent
 * Creates a formal delegation record and prepares the task for handoff
 */
export async function delegateTaskNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.intent || !state.delegationTarget) {
      console.warn('Missing required information for delegation');
      return {
        ...state,
        response: "I can't complete this delegation because I'm missing key information."
      };
    }
    
    // Get memory service
    const { memoryService } = await getMemoryServices();
    const cognitiveService = new CognitiveArtifactService(memoryService);
    
    // Create a task ID for tracking
    const taskId = IdGenerator.generate('task').toString();
    
    // Calculate priority based on state
    const priority = state.intent.confidence > 0.8 ? TaskPriority.HIGH :
                    state.intent.confidence > 0.5 ? TaskPriority.MEDIUM :
                    TaskPriority.LOW;
    
    // Create target agent ID
    const targetAgentId = createStructuredId(
      EntityNamespace.AGENT, 
      EntityType.AGENT, 
      state.delegationTarget
    );
    
    // Current agent ID (from persona or default)
    const currentAgentId = state.agentPersona?.name 
      ? createAgentId(state.agentPersona.name) 
      : createStructuredId(EntityNamespace.AGENT, EntityType.AGENT, 'assistant');
    
    // Formalize the request with details from the current context
    const delegationRequest = {
      taskId,
      intent: state.intent.name,
      query: state.input,
      entities: state.entities || [],
      context: {
        reasoning: state.reasoning || [],
        delegationReason: state.delegationReason || 'Specialized capabilities required'
      }
    };
    
    // Store the task with proper metadata
    await cognitiveService.storeTask(
      `Handle ${state.intent.name} request`,
      `Delegated task: ${state.input}`,
      {
        status: TaskStatus.PENDING,
        priority,
        importance: ImportanceLevel.HIGH,
        tags: ['delegated', state.delegationTarget, 'task'],
        relatedTo: state.cognitiveArtifacts?.thoughtIds || []
      }
    );
    
    // Map TaskPriority to MessagePriority
    let messagePriority: MessagePriority;
    switch(priority) {
      case TaskPriority.HIGH:
        messagePriority = MessagePriority.HIGH;
        break;
      case TaskPriority.MEDIUM:
        messagePriority = MessagePriority.NORMAL;
        break;
      case TaskPriority.LOW:
        messagePriority = MessagePriority.LOW;
        break;
      default:
        messagePriority = MessagePriority.NORMAL;
    }
    
    // Store an agent-to-agent message for the delegation
    const messageId = await memoryService.addMemory({
      type: MemoryType.MESSAGE,
      content: JSON.stringify(delegationRequest),
      metadata: createAgentToAgentMessageMetadata(
        currentAgentId,
        targetAgentId,
        createStructuredId(EntityNamespace.CHAT, EntityType.CHAT, state.userId),
        { id: IdGenerator.generate('thread').toString(), position: 0 },
        {
          communicationType: 'request',
          priority: messagePriority,
          requiresResponse: true,
          conversationContext: {
            taskId,
            purpose: `Delegation of ${state.intent.name} task`,
            sharedContext: {
              originalQuery: state.input,
              intent: state.intent,
              entities: state.entities
            }
          }
        }
      )
    });
    
    // Create a nicely formatted response for the user
    const response = `I've delegated this task to our ${state.delegationTarget} specialist who can better assist with this request. The specialist will handle your request: "${state.input}". Your task has been assigned ID: ${taskId}.`;
    
    console.log(`Delegated task to ${state.delegationTarget} with task ID ${taskId}`);
    
    // Return updated state with the taskId stored in reasoning instead of a custom property
    return {
      ...state,
      response,
      reasoning: [
        ...(state.reasoning || []),
        `Task delegated to ${state.delegationTarget} specialist with ID ${taskId}`
      ]
    };
  } catch (error) {
    console.error('Error in delegateTaskNode:', error);
    // Return a fallback response
    return {
      ...state,
      response: `I attempted to delegate this task to a specialist, but encountered an error: ${error instanceof Error ? error.message : String(error)}. Please try again or rephrase your request.`,
      reasoning: [
        ...(state.reasoning || []),
        `Delegation error: ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
} 