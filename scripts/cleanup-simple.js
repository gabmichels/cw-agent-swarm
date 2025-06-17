// Use built-in fetch (Node.js 18+)

const KLEO_ID = '34d75975-4a1f-167a-743d-92190d910ae0';
const BASE_URL = 'http://localhost:3000';

async function getAgents() {
  try {
    const response = await fetch(`${BASE_URL}/api/multi-agent/agents`);
    const data = await response.json();
    return data.agents || [];
  } catch (error) {
    console.error('❌ Failed to get agents:', error.message);
    return [];
  }
}

async function deleteAgent(agentId) {
  try {
    const response = await fetch(`${BASE_URL}/api/multi-agent/agents/${agentId}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error(`❌ Failed to delete agent ${agentId}:`, error.message);
    return false;
  }
}

async function cleanupAgents(dryRun = true) {
  console.log('🧹 Simple Agent Cleanup');
  console.log('======================');
  console.log(`🔒 Preserving Kleo: ${KLEO_ID}`);
  console.log(`🗑️  Will delete: ALL other agents`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE\n');
  } else {
    console.log('⚠️  DELETE MODE - Will actually delete agents!\n');
  }
  
  console.log('🔍 Getting all agents...');
  const agents = await getAgents();
  
  if (agents.length === 0) {
    console.log('❌ No agents found or API not responding');
    console.log('💡 Make sure the Next.js server is running with "npm run dev"');
    return;
  }
  
  console.log(`📊 Found ${agents.length} total agents`);
  
  // Find Kleo
  const kleo = agents.find(agent => agent.id === KLEO_ID);
  if (kleo) {
    console.log(`✅ Found Kleo: ${kleo.name} (${KLEO_ID})`);
  } else {
    console.log(`⚠️  Kleo not found with ID: ${KLEO_ID}`);
    console.log('Available agents:');
    agents.forEach(agent => {
      console.log(`   - ${agent.name} (${agent.id})`);
    });
  }
  
  // Get all agents except Kleo
  const agentsToDelete = agents.filter(agent => agent.id !== KLEO_ID);
  
  console.log(`\n🗑️  Agents to delete: ${agentsToDelete.length}`);
  agentsToDelete.forEach(agent => {
    console.log(`   - ${agent.name} (${agent.id})`);
  });
  
  if (agentsToDelete.length === 0) {
    console.log('✨ No agents to delete!');
    return;
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No agents will be deleted');
    console.log(`Would delete ${agentsToDelete.length} agents`);
    console.log('\n💡 To actually delete, run: node scripts/cleanup-simple.js --delete');
  } else {
    console.log(`\n🗑️  Deleting ${agentsToDelete.length} agents...`);
    
    let deleted = 0;
    for (const agent of agentsToDelete) {
      const success = await deleteAgent(agent.id);
      if (success) {
        console.log(`✅ Deleted: ${agent.name}`);
        deleted++;
      } else {
        console.log(`❌ Failed to delete: ${agent.name}`);
      }
    }
    
    console.log(`\n🎉 Deleted ${deleted}/${agentsToDelete.length} agents`);
    console.log(`🔒 Preserved Kleo (${KLEO_ID})`);
  }
}

// CLI
const args = process.argv.slice(2);
const dryRun = !args.includes('--delete');

cleanupAgents(dryRun).catch(console.error); 