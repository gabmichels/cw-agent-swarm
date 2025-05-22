/**
 * Reset Agent Bootstrap Locks
 * 
 * This script resets any stuck agent bootstrap locks.
 */

// Simpler implementation that directly manipulates the registry data
const fs = require('fs');
const path = require('path');

// Registry file path - adjust if needed
const registryPath = path.join(__dirname, '..', '.agent-registry.json');

function resetLocks() {
  console.log('Agent Bootstrap Lock Reset Tool');
  console.log('==============================\n');
  
  try {
    let registryData;
    
    // Check if registry file exists
    if (fs.existsSync(registryPath)) {
      // Read registry file
      registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      console.log('Found existing registry file');
      
      // Ensure agents object exists
      if (!registryData.agents) {
        registryData.agents = {};
      }
      
      // Add missing known agents
      const knownAgents = {
        "7a4f9d63-005b-4ebf-3881-8a5f9ce8715e": {
          agentId: "7a4f9d63-005b-4ebf-3881-8a5f9ce8715e",
          agentName: "General Assistant",
          state: "not_started",
          status: "offline",
          locked: false,
          retries: 0,
          metadata: {}
        },
        "34d75975-4a1f-167a-743d-92190d910ae0": {
          agentId: "34d75975-4a1f-167a-743d-92190d910ae0",
          agentName: "Kleo",
          state: "not_started",
          status: "offline", 
          locked: false,
          retries: 0,
          metadata: {}
        }
      };
      
      let addedAgents = 0;
      
      // Add any missing known agents
      Object.entries(knownAgents).forEach(([id, agent]) => {
        if (!registryData.agents[id]) {
          registryData.agents[id] = agent;
          addedAgents++;
        }
      });
      
      if (addedAgents > 0) {
        console.log(`Added ${addedAgents} missing known agents to registry`);
        registryData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
      }
    } else {
      // Create empty registry
      console.log('Registry file not found. Creating a new empty registry.');
      registryData = {
        agents: {
          // Pre-register known agents with empty data
          "7a4f9d63-005b-4ebf-3881-8a5f9ce8715e": {
            agentId: "7a4f9d63-005b-4ebf-3881-8a5f9ce8715e",
            agentName: "General Assistant",
            state: "not_started",
            status: "offline",
            locked: false,
            retries: 0,
            metadata: {}
          },
          "34d75975-4a1f-167a-743d-92190d910ae0": {
            agentId: "34d75975-4a1f-167a-743d-92190d910ae0",
            agentName: "Kleo",
            state: "not_started",
            status: "offline", 
            locked: false,
            retries: 0,
            metadata: {}
          }
        },
        lastUpdated: new Date().toISOString()
      };
      
      // Save the empty registry
      fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
      console.log('Created empty registry file');
      return;
    }
    
    // Check if we have a registry with agents
    if (registryData && registryData.agents) {
      const agents = registryData.agents;
      const agentIds = Object.keys(agents);
      
      console.log(`Found ${agentIds.length} agents in registry\n`);
      
      // Count locked agents
      const lockedAgents = agentIds.filter(id => agents[id].locked);
      
      console.log(`Found ${lockedAgents.length} locked agents`);
      
      // Print locked agents
      if (lockedAgents.length > 0) {
        console.log('\nLocked agents:');
        lockedAgents.forEach(id => {
          const agent = agents[id];
          console.log(`  - ${id} (${agent.agentName})`);
          if (agent.lockTimestamp) {
            const lockTime = new Date(agent.lockTimestamp);
            const lockDuration = new Date() - lockTime;
            console.log(`    Locked since: ${lockTime.toISOString()} (${Math.round(lockDuration / 1000)}s ago)`);
          }
        });
        
        // Reset locks
        console.log('\nResetting locks...');
        lockedAgents.forEach(id => {
          agents[id].locked = false;
          agents[id].lockTimestamp = null;
        });
        
        // Save registry
        fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2));
        console.log(`✅ Successfully reset ${lockedAgents.length} agent locks`);
      }
    } else {
      console.log('No agents found in registry');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
resetLocks(); 