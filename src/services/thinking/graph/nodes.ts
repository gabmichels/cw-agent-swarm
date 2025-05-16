import { ThinkingState, Entity } from '../graph/types';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { FileRetriever } from '../files/FileRetriever';
import { DelegationService } from '../delegation/DelegationService';
import { ToolService } from '../tools/ToolService';

// Create the LLM model for thinking processing
const thinkingLLM = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.2
});

// Create the file retriever
const fileRetriever = new FileRetriever();

// Create the delegation service
const delegationService = new DelegationService();

// Create the tool service
const toolService = new ToolService();

/**
 * Node to retrieve context including memories and files
 */
export async function retrieveContextNode(
  state: ThinkingState
): Promise<ThinkingState> {
  try {
    console.log('Retrieving context:', state.userId, state.input.substring(0, 50));
    
    // Retrieve relevant files
    const fileOptions = {
      query: state.input,
      userId: state.userId,
      limit: 3, // Limit to top 3 most relevant files
      searchMethod: 'hybrid' as const
    };
    
    let contextFiles = state.contextFiles || [];
    
    try {
      // Get files relevant to the query
      const { files } = await fileRetriever.retrieveRelevantFiles(fileOptions);
      
      if (files && files.length > 0) {
        console.log(`Retrieved ${files.length} files for context`);
        
        // Search within the files for relevant content
        const searchResults = await fileRetriever.searchWithinFiles(
          files,
          state.input,
          { limit: 5 } // Limit chunks to avoid context overflow
        );
        
        // Add file content snippets to file metadata for better context
        const enhancedFiles = searchResults.files.map(file => {
          // Find chunks for this file
          const fileChunks = searchResults.chunks.filter(chunk => 
            chunk.fileId === file.id
          );
          
          // Extract content snippets
          const snippets = fileChunks.map(chunk => chunk.content);
          
          // Return enhanced file with content snippets
          return {
            ...file,
            metadata: {
              ...file.metadata,
              contentSnippets: snippets
            }
          };
        });
        
        // Update context files
        contextFiles = enhancedFiles;
      }
    } catch (fileError) {
      console.error('Error retrieving file context:', fileError);
    }
    
    // Placeholder implementation for memory retrieval
    // In a real implementation, this would be replaced with the MemoryRetriever
    
    return {
      ...state,
      contextMemories: state.contextMemories || [],
      contextFiles
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
    
    if (!state.delegationTarget || !state.intent) {
      console.error('Missing delegation target or intent');
      return {
        ...state,
        response: 'Unable to delegate task: missing required information.'
      };
    }
    
    // Extract required capabilities based on delegation target
    let requiredCapabilities: string[] = [];
    
    // Map delegation target to capabilities
    switch (state.delegationTarget) {
      case 'research-agent':
        requiredCapabilities = ['research', 'information_retrieval'];
        break;
      case 'creative-agent':
        requiredCapabilities = ['content_creation', 'writing'];
        break;
      case 'coding-agent':
        requiredCapabilities = ['coding', 'debugging'];
        break;
      case 'data-agent':
        requiredCapabilities = ['data_analysis', 'visualization'];
        break;
      default:
        // Extract capabilities from the target string if not a known agent
        requiredCapabilities = [state.delegationTarget];
    }
    
    // Decide if this is an urgent task based on intent
    // For demonstration, we'll consider certain keywords as indicators of urgency
    const isUrgent = state.input.toLowerCase().includes('urgent') || 
                      state.input.toLowerCase().includes('asap') ||
                      state.input.toLowerCase().includes('immediately');
    
    // Get priority from intent confidence
    const priority = Math.round(state.intent.confidence * 10);
    
    // Collect context for delegation
    const context = {
      entities: state.entities || [],
      intent: state.intent,
      reasoning: state.reasoning || [],
      files: state.contextFiles?.map(file => file.id) || []
    };
    
    // Delegate the task using the delegation service
    const delegationResult = await delegationService.delegateTask(
      state.userId,
      state.input,
      requiredCapabilities,
      priority,
      isUrgent,
      context
    );
    
    if (delegationResult.success) {
      return {
        ...state,
        response: `Task delegated to a specialized agent (${delegationResult.agentId}). ${
          delegationResult.estimatedWaitTime 
            ? `Estimated processing time: ${Math.round(delegationResult.estimatedWaitTime / 1000)} seconds.` 
            : ''
        }`
      };
    } else {
      return {
        ...state,
        response: `Task delegation status: ${delegationResult.reason}`
      };
    }
  } catch (error) {
    console.error('Error in delegateTaskNode:', error);
    return {
      ...state,
      response: `Error delegating task: ${error instanceof Error ? error.message : String(error)}`
    };
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
    
    // Skip if no intent is available
    if (!state.intent) {
      return {
        ...state,
        tools: []
      };
    }
    
    // Extract category and capability hints from the input and entities
    const categories: string[] = [];
    const capabilities: string[] = [];
    
    // Look for file-related keywords
    if (state.input.toLowerCase().includes('file') || 
        state.input.toLowerCase().includes('document')) {
      categories.push('files');
      capabilities.push('file_access');
    }
    
    // Look for search-related keywords
    if (state.input.toLowerCase().includes('search') || 
        state.input.toLowerCase().includes('find') ||
        state.input.toLowerCase().includes('look up')) {
      categories.push('search');
    }
    
    // Look for web-related keywords
    if (state.input.toLowerCase().includes('web') || 
        state.input.toLowerCase().includes('internet') ||
        state.input.toLowerCase().includes('online')) {
      categories.push('web');
      capabilities.push('web_access');
    }
    
    // Look for analysis-related keywords
    if (state.input.toLowerCase().includes('analyze') || 
        state.input.toLowerCase().includes('sentiment') ||
        state.input.toLowerCase().includes('extract')) {
      categories.push('analysis');
      capabilities.push('text_analysis');
    }
    
    try {
      // Use the ToolService to discover relevant tools
      const discoveredTools = await toolService.discoverTools({
        intent: state.intent.name,
        categories: categories.length > 0 ? categories : undefined,
        requiredCapabilities: capabilities.length > 0 ? capabilities : undefined,
        limit: 3 // Limit to top 3 tools
      });
      
      console.log(`Discovered ${discoveredTools.length} tools for intent: ${state.intent.name}`);
      
      // Extract tool IDs for the state
      const toolIds = discoveredTools.map(tool => tool.id);
      
      return {
        ...state,
        tools: toolIds
      };
    } catch (toolError) {
      console.error('Error discovering tools:', toolError);
      
      // Fallback to simple rule-based selection
      const tools: string[] = [];
      
      if (categories.includes('files')) {
        tools.push('file-search');
      }
      
      if (categories.includes('web')) {
        tools.push('web-search');
      }
      
      if (categories.includes('analysis')) {
        tools.push('text-analysis');
      }
      
      return {
        ...state,
        tools
      };
    }
  } catch (error) {
    console.error('Error in selectToolsNode:', error);
    return {
      ...state,
      tools: []
    };
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
    
    // Execute selected tools if available
    const toolResults: Record<string, any> = {};
    
    if (state.tools && state.tools.length > 0) {
      console.log(`Executing ${state.tools.length} tools`);
      
      for (const toolId of state.tools) {
        try {
          // Extract parameters from entities and input for tool execution
          const toolParams = extractToolParameters(toolId, state);
          
          // Execute the tool
          const toolResult = await toolService.executeTool({
            toolId,
            parameters: toolParams,
            context: {
              intent: state.intent,
              entities: state.entities,
              input: state.input
            }
          });
          
          if (toolResult.success) {
            console.log(`Tool ${toolId} executed successfully`);
            toolResults[toolId] = toolResult.data;
            
            // Add reasoning about the tool execution
            const toolReasoning = `Tool execution: Used ${toolId} to gather information.`;
            state.reasoning = [...(state.reasoning || []), toolReasoning];
          } else {
            console.error(`Tool ${toolId} execution failed:`, toolResult.error);
            const errorReasoning = `Tool execution failed: ${toolResult.error}`;
            state.reasoning = [...(state.reasoning || []), errorReasoning];
          }
        } catch (toolError) {
          console.error(`Error executing tool ${toolId}:`, toolError);
          const errorReasoning = `Tool execution error: ${toolError instanceof Error ? toolError.message : String(toolError)}`;
          state.reasoning = [...(state.reasoning || []), errorReasoning];
        }
      }
    }
    
    // Define system prompt for advanced reasoning
    const systemPrompt = `You are an AI assistant that uses advanced reasoning to solve problems.
Use a step-by-step Chain-of-Thought approach to reason through the user's request.
Consider multiple perspectives and potential approaches.

${state.tools && state.tools.length > 0 ? `I have already executed tools to gather information. Use the tool results in your reasoning.` : ''}

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

${Object.keys(toolResults).length > 0 ? `Tool Results:
${Object.entries(toolResults).map(([toolId, result]) => 
  `Tool ${toolId}: ${JSON.stringify(result).substring(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`
).join('\n')}` : ''}

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
        reasoning: allReasoning,
        toolResults
      };
    } catch (llmError) {
      console.error('Error calling LLM for advanced reasoning:', llmError);
      
      // Fallback to simple reasoning
      const reasoning = [
        `Intent: ${state.intent?.name}`,
        `Entities: ${state.entities?.map((e: Entity) => e.value).join(', ') || 'None'}`,
        `Tools: ${state.tools?.join(', ') || 'None'}`,
        ...Object.entries(toolResults).map(([toolId, result]) => 
          `Tool ${toolId} result: ${typeof result === 'object' ? 'Data retrieved successfully' : String(result)}`
        )
      ];
      
      return {
        ...state,
        reasoning: [...(state.reasoning || []), ...reasoning],
        toolResults
      };
    }
  } catch (error) {
    console.error('Error in applyReasoningNode:', error);
    return state;
  }
}

/**
 * Helper function to extract parameters for a tool from the state
 */
function extractToolParameters(toolId: string, state: ThinkingState): Record<string, any> {
  // Get the tool to understand required parameters
  const tool = toolService.getToolById(toolId);
  
  // Default parameters
  const params: Record<string, any> = {};
  
  // For file search tool
  if (toolId === 'file-search') {
    // Find an entity that might be a search query
    const searchEntity = state.entities?.find(e => 
      e.type === 'query' || e.type === 'search_term' || e.type === 'keyword'
    );
    
    // If we found a specific search entity, use it
    if (searchEntity) {
      params.query = searchEntity.value;
    } else {
      // Otherwise, use the most relevant part of the input
      // This is a simplification - in a real system, we'd do more sophisticated extraction
      params.query = extractSearchQuery(state.input, state.intent?.name || '');
    }
    
    // Look for file type entities
    const fileTypeEntity = state.entities?.find(e => e.type === 'file_type');
    if (fileTypeEntity) {
      params.fileTypes = [fileTypeEntity.value];
    }
  }
  
  // For web search tool
  else if (toolId === 'web-search') {
    // Similar approach as with file search
    const searchEntity = state.entities?.find(e => 
      e.type === 'query' || e.type === 'search_term' || e.type === 'keyword'
    );
    
    if (searchEntity) {
      params.query = searchEntity.value;
    } else {
      params.query = extractSearchQuery(state.input, state.intent?.name || '');
    }
  }
  
  // For text analysis tool
  else if (toolId === 'text-analysis') {
    // Find a text entity to analyze
    const textEntity = state.entities?.find(e => e.type === 'text' || e.type === 'content');
    
    if (textEntity) {
      params.text = textEntity.value;
    } else {
      // If no specific text entity found, use the entire input
      params.text = state.input;
    }
    
    // Set default analysis types
    params.analysisTypes = ['sentiment', 'entities', 'keywords'];
  }
  
  return params;
}

/**
 * Helper function to extract a search query from text
 */
function extractSearchQuery(input: string, intent: string): string {
  // This is a basic extraction - in a real system, we'd use more advanced NLP
  
  // Look for common search patterns
  const searchPatterns = [
    /find (?:information about|details on|) (.*?)(?:\.|\?|$)/i,
    /search (?:for|) (.*?)(?:\.|\?|$)/i,
    /look up (.*?)(?:\.|\?|$)/i,
    /tell me about (.*?)(?:\.|\?|$)/i
  ];
  
  for (const pattern of searchPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If no pattern matched, combine intent with input
  return `${intent} ${input.substring(0, 100)}`;
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

${state.toolResults && Object.keys(state.toolResults).length > 0 ? 
  `I have used tools to gather information for you. Use this information to provide a more accurate response.` : ''}

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

${state.toolResults && Object.keys(state.toolResults).length > 0 ? `
Tool Results:
${Object.entries(state.toolResults).map(([toolId, result]) => 
  `Tool ${toolId}: ${JSON.stringify(result, null, 2).substring(0, 300)}${JSON.stringify(result).length > 300 ? '...' : ''}`
).join('\n\n')}
` : ''}

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