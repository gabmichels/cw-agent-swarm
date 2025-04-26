/**
 * Example of using Chloe's LangChain-compatible cognitive tools
 * with a LangChain agent.
 */

import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { StructuredTool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChloeAgent } from '../agent';
import { createLangChainCognitiveTools } from '../tools/cognitiveTools';

async function runAgentWithCognitiveTool() {
  try {
    // Initialize Chloe agent
    console.log('Initializing Chloe agent...');
    const chloeAgent = new ChloeAgent();
    await chloeAgent.initialize();
    console.log('Chloe agent initialized');

    // Get LangChain-compatible tools
    const tools = createLangChainCognitiveTools(
      chloeAgent.getCognitiveMemory(),
      chloeAgent.getKnowledgeGraph()
    );

    // Initialize LLM
    const llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo-1106',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY
    }) as any; // Type assertion to bypass type checking issues

    // Create prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are an intelligent agent with access to Chloe's cognitive memory systems.
Use the available tools to help retrieve information and manage working memory.`],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad")
    ]);

    // Create agent
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools: Object.values(tools),
      prompt
    });

    // Create agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: Object.values(tools),
      verbose: true
    });

    // Add a test memory to retrieve
    await chloeAgent.getCognitiveMemory().addEpisodicMemory(
      "Meeting with marketing team about Q3 campaign planning",
      { 
        importance: "high",
        type: "meeting"
      },
      ["positive"]
    );

    // Run the agent
    console.log('Running agent with cognitive tools...');
    const result = await agentExecutor.invoke({
      input: "Can you check my memory for any information about marketing meetings?"
    });

    console.log('\nAgent output:');
    console.log(result.output);

    // Test working memory operations
    console.log('\nTesting working memory operations...');
    const workingMemoryResult = await agentExecutor.invoke({
      input: "Add 'Need to follow up with the marketing team about budget' to my working memory"
    });

    console.log('\nAgent output:');
    console.log(workingMemoryResult.output);

    // Retrieve working memory
    console.log('\nRetrieving working memory...');
    const retrieveResult = await agentExecutor.invoke({
      input: "What's in my working memory right now?"
    });

    console.log('\nAgent output:');
    console.log(retrieveResult.output);

    // Cleanup
    await chloeAgent.shutdown();
    console.log('Chloe agent shut down');

  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runAgentWithCognitiveTool();
}

export { runAgentWithCognitiveTool }; 