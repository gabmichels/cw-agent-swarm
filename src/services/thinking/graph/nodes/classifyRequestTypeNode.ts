import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import {
  EMAIL_TOOL_NAMES,
  CALENDAR_TOOL_NAMES,
  SPREADSHEET_TOOL_NAMES,
  FILE_TOOL_NAMES,
  CONNECTION_TOOL_NAMES,
  CORE_TOOL_NAMES,
  CORE_TOOL_NAME_LIST,
  REQUEST_TYPES,
  ALL_WORKSPACE_TOOL_NAME_LIST,
  type RequestType
} from '../../../../constants/tool-names';

// Enhanced schema to include tool availability analysis
const requestTypeSchema = z.object({
  type: z.enum(['PURE_LLM_TASK', 'EXTERNAL_TOOL_TASK', 'SCHEDULED_TASK']).describe("Classification of the request type"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
  reasoning: z.string().describe("Explanation of why this classification was chosen"),
  requiredTools: z.array(z.string()).describe("List of tools that would be needed for this request"),
  availableTools: z.array(z.string()).describe("List of tools that are currently available to this agent"),
  missingTools: z.array(z.string()).describe("List of required tools that are not available to this agent"),
  delegationSuggested: z.boolean().describe("Whether this task should be delegated due to missing tools"),
  suggestedSchedule: z.object({
    timeExpression: z.string().nullable().optional().describe("Natural language time expression from user (e.g., 'in 2 minutes', 'tomorrow at 3pm', 'next Friday')"),
    recurring: z.boolean().optional().describe("Whether this should be a recurring task"),
    intervalExpression: z.string().optional().describe("Interval expression like '1h', '1d', 'weekly' if recurring")
  }).optional().describe("Scheduling information if this is a scheduled task")
});

/**
 * Discover available tools for the agent
 */
async function discoverAgentTools(state: ThinkingState): Promise<string[]> {
  const baseTools = [...CORE_TOOL_NAME_LIST];

  try {
    // Get agent context from state
    const agentContext = (state as any).agentContext;
    if (!agentContext?.agent) {
      console.log('🔧 No agent context available, using fallback tools');
      return [...baseTools, ...ALL_WORKSPACE_TOOL_NAME_LIST];
    }

    const agent = agentContext.agent;

    // Try to get available tool names from the agent
    if (typeof agent.getAvailableToolNames === 'function') {
      try {
        const agentTools = await agent.getAvailableToolNames();
        if (Array.isArray(agentTools) && agentTools.length > 0) {
          console.log(`🔧 Retrieved ${agentTools.length} tools from agent.getAvailableToolNames()`);
          return [...baseTools, ...agentTools];
        }
      } catch (error) {
        console.warn('Failed to get tools from agent.getAvailableToolNames():', error);
      }
    }

    // Try to get workspace tools
    if (agent.workspaceIntegration || agent.workspaceACGIntegration) {
      try {
        const workspaceIntegration = agent.workspaceACGIntegration || agent.workspaceIntegration;

        if (typeof workspaceIntegration.getAvailableTools === 'function') {
          const workspaceTools = await workspaceIntegration.getAvailableTools(agent.agentId || agent.id);
          if (Array.isArray(workspaceTools)) {
            const toolNames = workspaceTools.map((tool: any) => tool.name || tool.id);
            console.log(`🔧 Retrieved ${toolNames.length} workspace tools`);
            return [...baseTools, ...toolNames];
          }
        }
      } catch (error) {
        console.warn('Failed to get workspace tools:', error);
      }
    }

    // Fallback: return all known workspace tools
    console.log('🔧 Using fallback: all known workspace tools');
    return [...baseTools, ...ALL_WORKSPACE_TOOL_NAME_LIST];

  } catch (error) {
    console.error('Error discovering agent tools:', error);
    return [...baseTools, ...ALL_WORKSPACE_TOOL_NAME_LIST];
  }
}

/**
 * Deterministic tool requirement analysis based on request intent and content
 */
function analyzeToolRequirements(input: string, intent: string, availableTools: string[]): {
  requiredTools: string[];
  missingTools: string[];
  delegationSuggested: boolean;
  reasoning: string;
} {
  const inputLower = input.toLowerCase();
  const intentLower = intent.toLowerCase();
  const requiredTools: string[] = [];

  // Email-related requests
  if (inputLower.includes('email') || inputLower.includes('send') && inputLower.includes('@') ||
    intentLower.includes('email') || intentLower.includes('send_email')) {

    // Determine specific email tools needed
    if (inputLower.includes('send') || inputLower.includes('compose')) {
      if (availableTools.includes(EMAIL_TOOL_NAMES.SMART_SEND_EMAIL)) {
        requiredTools.push(EMAIL_TOOL_NAMES.SMART_SEND_EMAIL);
      } else if (availableTools.includes(EMAIL_TOOL_NAMES.SEND_EMAIL)) {
        requiredTools.push(EMAIL_TOOL_NAMES.SEND_EMAIL);
      }
    }

    if (inputLower.includes('read') || inputLower.includes('find') || inputLower.includes('search')) {
      if (availableTools.includes(EMAIL_TOOL_NAMES.READ_SPECIFIC_EMAIL)) {
        requiredTools.push(EMAIL_TOOL_NAMES.READ_SPECIFIC_EMAIL);
      }
      if (availableTools.includes(EMAIL_TOOL_NAMES.SEARCH_EMAILS)) {
        requiredTools.push(EMAIL_TOOL_NAMES.SEARCH_EMAILS);
      }
    }

    if (inputLower.includes('reply')) {
      if (availableTools.includes(EMAIL_TOOL_NAMES.REPLY_TO_EMAIL)) {
        requiredTools.push(EMAIL_TOOL_NAMES.REPLY_TO_EMAIL);
      }
    }
  }

  // Calendar-related requests
  if (inputLower.includes('calendar') || inputLower.includes('schedule') || inputLower.includes('meeting') ||
    inputLower.includes('appointment') || intentLower.includes('calendar')) {

    if (inputLower.includes('schedule') || inputLower.includes('create') || inputLower.includes('book')) {
      if (availableTools.includes(CALENDAR_TOOL_NAMES.SCHEDULE_EVENT)) {
        requiredTools.push(CALENDAR_TOOL_NAMES.SCHEDULE_EVENT);
      }
    }

    if (inputLower.includes('read') || inputLower.includes('check') || inputLower.includes('view')) {
      if (availableTools.includes(CALENDAR_TOOL_NAMES.READ_CALENDAR)) {
        requiredTools.push(CALENDAR_TOOL_NAMES.READ_CALENDAR);
      }
    }

    if (inputLower.includes('availability') || inputLower.includes('free time') || inputLower.includes('available')) {
      if (availableTools.includes(CALENDAR_TOOL_NAMES.FIND_AVAILABILITY)) {
        requiredTools.push(CALENDAR_TOOL_NAMES.FIND_AVAILABILITY);
      }
    }
  }

  // Spreadsheet-related requests
  if (inputLower.includes('spreadsheet') || inputLower.includes('excel') || inputLower.includes('sheet') ||
    inputLower.includes('data') && (inputLower.includes('analyze') || inputLower.includes('create'))) {

    if (inputLower.includes('create') || inputLower.includes('new')) {
      if (availableTools.includes(SPREADSHEET_TOOL_NAMES.CREATE_SPREADSHEET)) {
        requiredTools.push(SPREADSHEET_TOOL_NAMES.CREATE_SPREADSHEET);
      }
    }

    if (inputLower.includes('read') || inputLower.includes('view') || inputLower.includes('analyze')) {
      if (availableTools.includes(SPREADSHEET_TOOL_NAMES.READ_SPREADSHEET)) {
        requiredTools.push(SPREADSHEET_TOOL_NAMES.READ_SPREADSHEET);
      }
      if (availableTools.includes(SPREADSHEET_TOOL_NAMES.ANALYZE_SPREADSHEET_DATA)) {
        requiredTools.push(SPREADSHEET_TOOL_NAMES.ANALYZE_SPREADSHEET_DATA);
      }
    }

    if (inputLower.includes('update') || inputLower.includes('edit') || inputLower.includes('modify')) {
      if (availableTools.includes(SPREADSHEET_TOOL_NAMES.UPDATE_SPREADSHEET)) {
        requiredTools.push(SPREADSHEET_TOOL_NAMES.UPDATE_SPREADSHEET);
      }
    }
  }

  // File-related requests
  if (inputLower.includes('file') || inputLower.includes('document') || inputLower.includes('drive') ||
    inputLower.includes('upload') || inputLower.includes('download')) {

    if (inputLower.includes('search') || inputLower.includes('find')) {
      if (availableTools.includes(FILE_TOOL_NAMES.SEARCH_FILES)) {
        requiredTools.push(FILE_TOOL_NAMES.SEARCH_FILES);
      }
    }

    if (inputLower.includes('create') || inputLower.includes('new')) {
      if (availableTools.includes(FILE_TOOL_NAMES.CREATE_FILE)) {
        requiredTools.push(FILE_TOOL_NAMES.CREATE_FILE);
      }
    }

    if (inputLower.includes('share') || inputLower.includes('permission')) {
      if (availableTools.includes(FILE_TOOL_NAMES.SHARE_FILE)) {
        requiredTools.push(FILE_TOOL_NAMES.SHARE_FILE);
      }
    }
  }

  // Calculate missing tools
  const missingTools = requiredTools.filter(tool => !availableTools.includes(tool));

  // Suggest delegation if critical tools are missing
  const delegationSuggested = missingTools.length > 0 && requiredTools.length > 0;

  // Generate reasoning
  let reasoning = `Tool analysis: Required ${requiredTools.length} tools, ${missingTools.length} missing. `;
  if (requiredTools.length === 0) {
    reasoning += 'No specific tools required for this request.';
  } else if (missingTools.length === 0) {
    reasoning += 'All required tools available.';
  } else {
    reasoning += `Missing: ${missingTools.join(', ')}.`;
  }

  return {
    requiredTools,
    missingTools,
    delegationSuggested,
    reasoning
  };
}

/**
 * Deterministic request type classification
 */
function classifyRequestType(input: string, intent: string, toolAnalysis: ReturnType<typeof analyzeToolRequirements>): {
  type: RequestType;
  confidence: number;
  reasoning: string;
} {
  const inputLower = input.toLowerCase();

  // Check for scheduling indicators
  const schedulingKeywords = [
    'in ', 'minutes', 'hours', 'tomorrow', 'next week', 'schedule', 'remind me',
    'send later', 'deliver automatically', 'at ', 'pm', 'am'
  ];

  const hasSchedulingIndicators = schedulingKeywords.some(keyword => inputLower.includes(keyword));

  if (hasSchedulingIndicators) {
    return {
      type: REQUEST_TYPES.SCHEDULED_TASK,
      confidence: 0.9,
      reasoning: 'Request contains time-based scheduling indicators'
    };
  }

  // Check if external tools are required
  if (toolAnalysis.requiredTools.length > 0) {
    return {
      type: REQUEST_TYPES.EXTERNAL_TOOL_TASK,
      confidence: 0.9,
      reasoning: `Request requires external tools: ${toolAnalysis.requiredTools.join(', ')}`
    };
  }

  // Check for external data requirements
  const externalDataKeywords = ['current', 'latest', 'real-time', 'today', 'now', 'recent'];
  const hasExternalDataRequest = externalDataKeywords.some(keyword => inputLower.includes(keyword));

  if (hasExternalDataRequest) {
    return {
      type: REQUEST_TYPES.EXTERNAL_TOOL_TASK,
      confidence: 0.7,
      reasoning: 'Request may require real-time or current data'
    };
  }

  // Default to pure LLM task
  return {
    type: REQUEST_TYPES.PURE_LLM_TASK,
    confidence: 0.8,
    reasoning: 'Request can be fulfilled with LLM knowledge and reasoning alone'
  };
}

/**
 * Node for classifying request type to enable smart routing
 * Now with deterministic analysis instead of LLM guessing
 */
export async function classifyRequestTypeNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.intent) {
      console.warn('Missing input or intent for request type classification');
      return {
        ...state,
        requestType: {
          type: REQUEST_TYPES.PURE_LLM_TASK,
          confidence: 0.5,
          reasoning: 'Missing input or intent, defaulting to pure LLM task',
          requiredTools: [],
          availableTools: [],
          missingTools: [],
          delegationSuggested: false
        }
      };
    }

    // 🎯 Dynamic tool discovery with enhanced agent context
    console.log('🔍 CLASSIFYING REQUEST TYPE:', {
      input: state.input.substring(0, 100),
      intent: state.intent?.name,
      entities: state.entities?.length || 0,
      hasAgent: !!(state.metadata?.agent)
    });

    // Create agent context for tool discovery
    const agentContext = state.metadata?.agent ? {
      agent: state.metadata.agent
    } : undefined;

    // Add agent context to state for tool discovery
    const stateWithContext = agentContext ? {
      ...state,
      agentContext
    } : state;

    const availableTools = await discoverAgentTools(stateWithContext);
    console.log(`🔧 Discovered ${availableTools.length} available tools for agent:`, availableTools);

    // 🏗️ DETERMINISTIC ANALYSIS - No more LLM guessing
    const toolAnalysis = analyzeToolRequirements(state.input, state.intent.name, availableTools);
    const classification = classifyRequestType(state.input, state.intent.name, toolAnalysis);

    const requestType = {
      type: classification.type,
      confidence: classification.confidence,
      reasoning: `${classification.reasoning}. ${toolAnalysis.reasoning}`,
      requiredTools: toolAnalysis.requiredTools,
      availableTools: availableTools,
      missingTools: toolAnalysis.missingTools,
      delegationSuggested: toolAnalysis.delegationSuggested
    };

    console.log(`🧠 Enhanced Classification: ${requestType.type} (confidence: ${requestType.confidence.toFixed(2)})`);
    console.log(`🔧 Required tools: ${requestType.requiredTools.join(', ')}`);
    console.log(`✅ Available tools: ${requestType.availableTools.length}`);
    console.log(`❌ Missing tools: ${requestType.missingTools.join(', ')}`);
    console.log(`🤝 Delegation suggested: ${requestType.delegationSuggested}`);

    // Enhanced reasoning chain
    const classificationReasoning = [
      `Request Type: ${requestType.type} (confidence: ${requestType.confidence.toFixed(2)})`,
      `Reasoning: ${requestType.reasoning}`,
      `Agent has ${requestType.availableTools.length} available tools`,
      `Required tools: ${requestType.requiredTools.join(', ') || 'none'}`,
      `Missing tools: ${requestType.missingTools.join(', ') || 'none'}`,
      `Delegation suggested: ${requestType.delegationSuggested}`
    ];

    return {
      ...state,
      requestType,
      reasoning: [...(state.reasoning || []), ...classificationReasoning]
    };

  } catch (error) {
    console.error('Error in enhanced classifyRequestTypeNode:', error);

    // Enhanced fallback with tool info
    const availableTools = await discoverAgentTools(state).catch(() => [CORE_TOOL_NAMES.GENERAL_LLM_CAPABILITIES]);

    return {
      ...state,
      requestType: {
        type: REQUEST_TYPES.PURE_LLM_TASK,
        confidence: 0.3,
        reasoning: `Classification failed: ${error instanceof Error ? error.message : String(error)}. Defaulting to pure LLM task.`,
        requiredTools: [],
        availableTools,
        missingTools: [],
        delegationSuggested: false
      },
      reasoning: [...(state.reasoning || []), `Error in classification: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 