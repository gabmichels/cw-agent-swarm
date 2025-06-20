/**
 * Multi-Agent Delegation Example
 * 
 * This example demonstrates how DefaultAgent automatically includes
 * multi-agent delegation capabilities when communication manager is enabled.
 * 
 * The system now uses GENERIC DELEGATION - no hardcoded methods needed!
 * Agents can discover and delegate ANY tool to ANY capable agent automatically.
 */

import { DefaultAgent } from '../agents/shared/DefaultAgent';

async function multiAgentDelegationExample() {
  // Create an agent with communication manager enabled (now default in bootstrap)
  const agent = new DefaultAgent({
    id: 'demo-agent-1',
    name: 'Demo Agent',
    description: 'Agent with multi-agent capabilities',
    
    // Communication manager is now enabled by default in bootstrap-agents.ts
    // This automatically includes:
    // - MultiAgentDelegationService
    // - Agent capability discovery
    // - Automatic tool registration
    // - Generic delegation system
  });

  await agent.initialize();
  
  console.log('🚀 Agent initialized with automatic multi-agent delegation capabilities');
  console.log('📋 Available delegation methods:');
  console.log('   • delegateToolToAgent(toolName, params, options) - Generic delegation');
  console.log('   • findAgentsForTool(toolName, category, options) - Find capable agents');
  console.log('   • registerCapabilitiesFromTools() - Auto-register this agent\'s tools');
  console.log('   • analyzeForDelegation(message) - Detect delegation opportunities');

  // =======================================================================
  // 🔥 THE MAGIC: Natural Language Processing with Automatic Delegation
  // =======================================================================
  
  console.log('\n🎯 Testing automatic delegation detection...\n');
  
  // Example 1: Email delegation (automatically detected and handled)
  console.log('👤 User: "Send an email to john@company.com about the quarterly report"');
  try {
    const response = await agent.processUserInput('Send an email to john@company.com about the quarterly report');
    console.log(`🤖 Agent: ${response.content}`);
    
    if (response.metadata?.delegated) {
      console.log(`✅ Automatically delegated to: ${response.metadata.delegationTool} agent`);
    }
    
  } catch (error) {
    console.log('⚠️ Delegation failed (expected in demo):', error instanceof Error ? error.message : String(error));
  }

  console.log('\n---\n');

  // Example 2: Social media delegation (automatically detected and handled)
  console.log('👤 User: "Post to LinkedIn about our new product launch #innovation #tech"');
  try {
    const response = await agent.processUserInput('Post to LinkedIn about our new product launch #innovation #tech');
    console.log(`🤖 Agent: ${response.content}`);
    
    if (response.metadata?.delegated) {
      console.log(`✅ Automatically delegated to: ${response.metadata.delegationTool} agent`);
    }
    
  } catch (error) {
    console.log(`❌ Error processing request: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n---\n');

  // Example 3: Data analysis delegation (automatically detected and handled)  
  console.log('👤 User: "Analyze the sales data from last quarter and generate a report"');
  try {
    const response = await agent.processUserInput('Analyze the sales data from last quarter and generate a report');
    console.log(`🤖 Agent: ${response.content}`);
    
    if (response.metadata?.delegated) {
      console.log(`✅ Automatically delegated to: ${response.metadata.delegationTool} agent`);
    }
    
  } catch (error) {
    console.log(`❌ Error processing request: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n---\n');

  // =======================================================================
  // 🛠️ Direct API Usage (for programmatic access)
  // =======================================================================
  
  console.log('🔧 Testing direct delegation API...\n');

  // Example 4: Direct tool delegation
  console.log('🔧 Direct delegation: delegateToolToAgent("sendEmail", {...})');
  try {
    const delegationResult = await agent.delegateToolToAgent(
      'sendEmail',
      {
        to: ['team@company.com'],
        subject: 'Weekly Update',
        body: 'Here is the weekly team update...',
        priority: 'normal'
      },
      {
        toolCategory: 'email',
        priority: 'normal',
        timeout: 30000
      }
    );
    
    console.log('✅ Direct delegation successful:', delegationResult);
    
  } catch (error) {
    console.log('⚠️ Direct delegation failed (expected in demo):', error instanceof Error ? error.message : String(error));
  }

  console.log('\n---\n');

  // Example 5: Find agents for specific tools
  console.log('🔍 Finding agents capable of handling "createPost" tool...');
  try {
    const capableAgents = await agent.findAgentsForTool('createPost', 'social_media');
    console.log(`✅ Found ${capableAgents.length} capable agents:`, capableAgents);
    
  } catch (error) {
    console.log('⚠️ Agent discovery failed (expected in demo):', error instanceof Error ? error.message : String(error));
  }

  console.log('\n---\n');

  // Example 6: Analyze delegation opportunities
  console.log('🧠 Analyzing message for delegation opportunities...');
  try {
    const analysis = await agent.analyzeForDelegation('Create a file with the meeting notes and upload it to the shared drive');
    console.log('📊 Delegation analysis:', {
      needsDelegation: analysis.needsDelegation,
      suggestedTool: analysis.suggestedTool,
      suggestedCategory: analysis.suggestedCategory,
      reasoning: analysis.reasoning
    });
    
  } catch (error) {
    console.log('⚠️ Analysis failed (expected in demo):', error instanceof Error ? error.message : String(error));
  }

  console.log('\n=======================================================================');
  console.log('🎉 Multi-Agent Delegation Demo Complete!');
  console.log('');
  console.log('🔑 Key Features Demonstrated:');
  console.log('   ✅ Automatic delegation detection from natural language');
  console.log('   ✅ Generic tool delegation (no hardcoded methods)');
  console.log('   ✅ Agent capability discovery and registration');
  console.log('   ✅ Intelligent parameter extraction from user messages');
  console.log('   ✅ Fallback handling when delegation fails');
  console.log('   ✅ Direct API access for programmatic delegation');
  console.log('');
  console.log('🚀 Your Agent Swarm is now fully equipped for multi-agent collaboration!');
  console.log('=======================================================================\n');
}

// Run the example
if (require.main === module) {
  multiAgentDelegationExample().catch(console.error);
}

export { multiAgentDelegationExample }; 