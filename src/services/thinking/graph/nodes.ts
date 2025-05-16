import { ThinkingState, Entity } from '../graph/types';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Create the LLM model for thinking processing
const thinkingLLM = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.2
});

/**
 * Node to retrieve context including memories and files
 */
export async function retrieveContextNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Retrieving context:', state.userId, state.input.substring(0, 50));
    
    // Placeholder implementation - will be replaced with actual memory retrieval
    return {
      ...state,
      contextMemories: state.contextMemories || [],
      contextFiles: state.contextFiles || []
    };
  } catch (error) {
    console.error('Error in retrieveContextNode:', error);
    return state;
  }
}

/**
 * Node to analyze user intent
 */
export async function analyzeIntentNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Analyzing intent:', state.input.substring(0, 50));
    
    // Define the system prompt for intent analysis
    const systemPrompt = `You are an AI assistant analyzing user messages to identify intent.
Your task is to determine what the user really wants based on their message.
Provide a concise name for the intent and a confidence score from 0.0 to 1.0.
Also provide up to 2 alternative intents that might apply.

Respond in the following JSON format only:
{
  "intent": {
    "name": "primary intent name",
    "confidence": 0.95,
    "alternatives": [
      {"name": "alternative intent 1", "confidence": 0.7},
      {"name": "alternative intent 2", "confidence": 0.5}
    ]
  }
}`;

    // User message with context if available
    let userMessage = state.input;
    
    if (state.contextMemories && state.contextMemories.length > 0) {
      userMessage += `\n\nContext from memory:\n${state.contextMemories.map(m => m.content).join('\n')}`;
    }
    
    if (state.contextFiles && state.contextFiles.length > 0) {
      userMessage += `\n\nRelevant files:\n${state.contextFiles.map(f => f.name).join('\n')}`;
    }

    try {
      // Call the LLM to analyze intent
      // Use the call method with proper message formatting
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const intentData = JSON.parse(content);
      
      // Update state with intent information
      return {
        ...state,
        intent: intentData.intent
      };
    } catch (llmError) {
      console.error('Error calling LLM for intent analysis:', llmError);
      // Fallback to simple intent extraction
      return {
        ...state,
        intent: {
          name: `Process: ${state.input.substring(0, 20)}...`,
          confidence: 0.6,
          alternatives: [
            { name: `Understand: ${state.input.substring(0, 15)}...`, confidence: 0.4 }
          ]
        }
      };
    }
  } catch (error) {
    console.error('Error in analyzeIntentNode:', error);
    return state;
  }
}

/**
 * Node to extract entities from user input
 */
export async function extractEntitiesNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Extracting entities from:', state.input.substring(0, 50));
    
    // Define system prompt for entity extraction
    const systemPrompt = `You are an AI assistant that extracts key entities from user messages.
Your task is to identify important information that should be remembered for context.
Focus on extracting: people, organizations, dates, locations, actions, file references, and concepts.
For each entity, provide a type, value, and confidence score from 0.0 to 1.0.

Respond in the following JSON format only:
{
  "entities": [
    {
      "type": "person",
      "value": "John Smith",
      "confidence": 0.95
    },
    {
      "type": "date",
      "value": "next Tuesday",
      "confidence": 0.8
    },
    ...
  ]
}`;

    // Prepare message with input and intent
    let userMessage = state.input;
    
    // Add intent context if available
    if (state.intent) {
      userMessage += `\n\nDetected intent: ${state.intent.name} (${state.intent.confidence})`;
    }
    
    try {
      // Call LLM for entity extraction
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const entityData = JSON.parse(content);
      
      // Extract entities and add to state
      const extractedEntities = entityData.entities || [];
      
      return {
        ...state,
        entities: [...(state.entities || []), ...extractedEntities]
      };
    } catch (llmError) {
      console.error('Error calling LLM for entity extraction:', llmError);
      
      // Fallback to simple keyword-based entity extraction
      const entities = [];
      
      // Simple keyword-based entity extraction for demonstration
      if (state.input.toLowerCase().includes('file') || state.input.toLowerCase().includes('document')) {
        entities.push({
          type: 'file_request',
          value: 'file operation',
          confidence: 0.7
        });
      }
      
      if (state.input.toLowerCase().includes('create') || state.input.toLowerCase().includes('make')) {
        entities.push({
          type: 'action',
          value: 'create',
          confidence: 0.8
        });
      }
      
      return {
        ...state,
        entities: [...(state.entities || []), ...entities]
      };
    }
  } catch (error) {
    console.error('Error in extractEntitiesNode:', error);
    return state;
  }
}

/**
 * Node to assess whether to delegate the task
 */
export async function assessDelegationNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Assessing delegation for:', state.intent?.name);
    
    // Define system prompt for delegation assessment
    const systemPrompt = `You are an AI assistant that determines whether a task should be delegated to a specialized agent.
Consider whether the task requires specific expertise, tools, or capabilities beyond what a general assistant can provide.

Available specialized agents and their capabilities:
- research-agent: specialized in deep research, information gathering, and synthesis
- creative-agent: specialized in content creation, writing, and creative tasks
- coding-agent: specialized in software development, debugging, and technical implementation
- data-agent: specialized in data analysis, visualization, and numerical processing

Evaluate the user's request based on the intent and entities, then decide if it should be delegated.

Respond in the following JSON format only:
{
  "delegation": {
    "shouldDelegate": true|false,
    "targetAgent": "agent-name|null",
    "confidence": 0.95,
    "reason": "Concise explanation for the decision"
  }
}`;

    // Skip delegation assessment if no intent available
    if (!state.intent) {
      return {
        ...state,
        shouldDelegate: false,
        delegationReason: 'No clear intent identified',
        delegationTarget: undefined
      };
    }
    
    // Prepare context for delegation assessment
    const contextMessage = `
Intent: ${state.intent.name} (${state.intent.confidence})
User message: ${state.input}
Entities: ${state.entities?.map(e => `${e.type}: ${e.value}`).join(', ') || 'None'}
`;

    try {
      // Call LLM for delegation assessment
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(contextMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const delegationData = JSON.parse(content);
      
      // Extract delegation decision
      const delegation = delegationData.delegation;
      
      return {
        ...state,
        shouldDelegate: delegation.shouldDelegate,
        delegationReason: delegation.reason,
        delegationTarget: delegation.shouldDelegate ? delegation.targetAgent : undefined
      };
    } catch (llmError) {
      console.error('Error calling LLM for delegation assessment:', llmError);
      
      // Fallback to simple assessment
      const shouldDelegate = false;
      const delegationReason = 'Task can be handled directly (fallback decision)';
      
      return {
        ...state,
        shouldDelegate,
        delegationReason,
        delegationTarget: shouldDelegate ? 'specialized-agent' : undefined
      };
    }
  } catch (error) {
    console.error('Error in assessDelegationNode:', error);
    return state;
  }
}

/**
 * Node to delegate the task to another agent
 */
export async function delegateTaskNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Delegating task to:', state.delegationTarget);
    
    // Placeholder implementation - will be replaced with actual delegation
    return {
      ...state,
      response: `Task delegated to ${state.delegationTarget}`
    };
  } catch (error) {
    console.error('Error in delegateTaskNode:', error);
    return state;
  }
}

/**
 * Node to plan task execution
 */
export async function planExecutionNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Planning execution for:', state.intent?.name);
    
    // Skip planning if no intent available
    if (!state.intent) {
      return {
        ...state,
        plan: ['Gather more information to clarify user intent']
      };
    }
    
    // Define system prompt for execution planning
    const systemPrompt = `You are an AI assistant that creates execution plans to fulfill user requests.
Based on the user's intent and extracted entities, create a step-by-step plan for completing the task.
Each step should be clear, actionable, and progress toward fulfilling the user's request.

Focus on breaking down complex tasks into manageable steps.
Include any relevant tools or resources needed for each step.

Respond in the following JSON format only:
{
  "plan": {
    "steps": [
      "Step 1: Specific action description",
      "Step 2: Specific action description",
      "Step 3: Specific action description"
    ],
    "requiredTools": ["tool_name1", "tool_name2"],
    "estimatedComplexity": "low|medium|high",
    "reasoning": "Brief explanation of the approach"
  }
}`;

    // Prepare context message with all relevant information
    const contextMessage = `
Intent: ${state.intent.name} (${state.intent.confidence})
User message: ${state.input}
Entities: ${state.entities?.map(e => `${e.type}: ${e.value}`).join(', ') || 'None'}

Available tools:
- search_tool: Search for information online
- file_manager: Create, read, update files
- code_executor: Run code and return results
- database_tool: Query and modify database
- calendar_tool: Schedule events and set reminders
- email_tool: Send and read emails
`;

    try {
      // Call LLM for execution planning
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(contextMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const planData = JSON.parse(content);
      
      // Extract plan information
      const plan = planData.plan;
      
      // Add tools to state if provided
      const tools = plan.requiredTools || [];
      
      // Add reasoning to reasoning array
      const reasoning = state.reasoning || [];
      if (plan.reasoning) {
        reasoning.push(`Planning rationale: ${plan.reasoning}`);
      }
      
      return {
        ...state,
        plan: plan.steps,
        tools: [...(state.tools || []), ...tools],
        reasoning
      };
    } catch (llmError) {
      console.error('Error calling LLM for execution planning:', llmError);
      
      // Fallback to simple planning
      const plan = [
        'Analyze user request',
        'Gather relevant context',
        'Generate response'
      ];
      
      return {
        ...state,
        plan
      };
    }
  } catch (error) {
    console.error('Error in planExecutionNode:', error);
    return state;
  }
}

/**
 * Node to select tools for execution
 */
export async function selectToolsNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Selecting tools for:', state.intent?.name);
    
    // Placeholder implementation - will be replaced with LLM-based tool selection
    const tools: string[] = [];
    
    // Simple rule-based tool selection for demonstration
    if (state.input.toLowerCase().includes('file') || state.input.toLowerCase().includes('document')) {
      tools.push('file_manager');
    }
    
    if (state.input.toLowerCase().includes('search') || state.input.toLowerCase().includes('find')) {
      tools.push('search_tool');
    }
    
    return {
      ...state,
      tools
    };
  } catch (error) {
    console.error('Error in selectToolsNode:', error);
    return state;
  }
}

/**
 * Node to apply reasoning framework
 */
export async function applyReasoningNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Applying reasoning for:', state.intent?.name);
    
    // Skip reasoning if no intent or plan available
    if (!state.intent || !state.plan || state.plan.length === 0) {
      return {
        ...state,
        reasoning: [...(state.reasoning || []), 'Insufficient information for detailed reasoning']
      };
    }
    
    // Define system prompt for advanced reasoning
    const systemPrompt = `You are an AI assistant that uses advanced reasoning to solve problems.
Use a step-by-step Chain-of-Thought approach to reason through the user's request.
Consider multiple perspectives and potential approaches.

For complex problems, explore different branches of thought (Tree-of-Thought).
For each reasoning step, consider:
1. What information is relevant to this step?
2. What assumptions am I making?
3. What alternatives should I consider?
4. What are potential issues or edge cases?

Respond in the following JSON format only:
{
  "reasoning": {
    "chainOfThought": [
      "First, I understand that the user wants to...",
      "Given the context, I need to consider...",
      "The best approach appears to be..."
    ],
    "alternativeApproaches": [
      "An alternative would be to...",
      "Another possibility is..."
    ],
    "potentialIssues": [
      "One challenge might be...",
      "I should be careful about..."
    ],
    "confidence": "low|medium|high",
    "summary": "Concise summary of reasoning"
  }
}`;

    // Prepare context with all available information
    const contextMessage = `
Intent: ${state.intent.name} (${state.intent.confidence})
User message: ${state.input}
Entities: ${state.entities?.map(e => `${e.type}: ${e.value}`).join(', ') || 'None'}
Tools selected: ${state.tools?.join(', ') || 'None'}

Execution plan:
${state.plan.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Previous reasoning steps:
${state.reasoning?.join('\n') || 'None'}
`;

    try {
      // Call LLM for advanced reasoning
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(contextMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Parse the response
      const content = response.content.toString();
      const reasoningData = JSON.parse(content);
      
      // Extract reasoning information
      const reasoning = reasoningData.reasoning;
      
      // Combine all reasoning into a single array
      const allReasoning = [
        ...(state.reasoning || []),
        ...reasoning.chainOfThought,
        ...(reasoning.alternativeApproaches.map((alt: string) => `Alternative: ${alt}`) || []),
        ...(reasoning.potentialIssues.map((issue: string) => `Consideration: ${issue}`) || [])
      ];
      
      // Add summary as final reasoning step
      if (reasoning.summary) {
        allReasoning.push(`Summary: ${reasoning.summary}`);
      }
      
      return {
        ...state,
        reasoning: allReasoning
      };
    } catch (llmError) {
      console.error('Error calling LLM for advanced reasoning:', llmError);
      
      // Fallback to simple reasoning
      const reasoning = [
        `Intent: ${state.intent?.name}`,
        `Entities: ${state.entities?.map((e: Entity) => e.value).join(', ') || 'None'}`,
        `Tools: ${state.tools?.join(', ') || 'None'}`
      ];
      
      return {
        ...state,
        reasoning: [...(state.reasoning || []), ...reasoning]
      };
    }
  } catch (error) {
    console.error('Error in applyReasoningNode:', error);
    return state;
  }
}

/**
 * Node to generate the final response
 */
export async function generateResponseNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Generating response for:', state.intent?.name);
    
    // If delegation is chosen, skip response generation
    if (state.shouldDelegate) {
      return {
        ...state,
        response: `Task will be delegated to ${state.delegationTarget}`
      };
    }
    
    // Define system prompt for response generation
    const systemPrompt = `You are a helpful AI assistant generating a thoughtful response to the user.
Based on your understanding of the user's intent, the entities extracted, and the reasoning process,
create a clear, helpful, and accurate response.

Do not mention your internal reasoning process or the fact that you've analyzed their intent.
Simply respond as a helpful assistant addressing their needs.

Your response should be:
- Concise but complete
- Directly addressing the user's needs
- Well-structured and easy to understand
- Friendly and helpful in tone

DO NOT include any JSON formatting in your response. Just provide the plain text response.`;

    // Prepare context with all the thinking information
    const contextMessage = `
User message: ${state.input}

Intent: ${state.intent?.name} (${state.intent?.confidence || 0})
Entities: ${state.entities?.map(e => `${e.type}: ${e.value}`).join(', ') || 'None'}

Execution plan:
${state.plan?.map((step, index) => `${index + 1}. ${step}`).join('\n') || 'No plan available'}

Key reasoning insights:
${state.reasoning?.slice(-3)?.join('\n') || 'No reasoning available'}

Based on this analysis, generate a helpful response to the user's request.
`;

    try {
      // Call LLM for response generation
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(contextMessage)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await thinkingLLM.call(messages);
      
      // Extract response text
      const responseText = response.content.toString();
      
      return {
        ...state,
        response: responseText
      };
    } catch (llmError) {
      console.error('Error calling LLM for response generation:', llmError);
      
      // Fallback to simple response
      const response = `I'll help with: ${state.intent?.name || 'your request'}`;
      
      return {
        ...state,
        response
      };
    }
  } catch (error) {
    console.error('Error in generateResponseNode:', error);
    return state;
  }
} 