/**
 * Registry adapter for Chloe agent
 * 
 * This module provides backward compatibility for existing code that uses
 * the singleton pattern while integrating with the new AgentRegistry.
 */

import { ChloeAgent } from '../core/agent';
import { ChloeAgentV2 } from '../next-gen/ChloeAgentV2';
import { AgentRegistry } from '../../shared/registry/AgentRegistry';

/**
 * Type for global Chloe instance
 */
declare global {
  var chloeAgent: ChloeAgent | null;
}

/**
 * Get a singleton instance of the ChloeAgent using the registry
 * This maintains backward compatibility with existing code
 */
export async function getChloeInstance(): Promise<ChloeAgent> {
  // Check for existing global instance first (highest priority)
  if (global.chloeAgent) {
    console.log('Using existing global Chloe instance');
    return global.chloeAgent;
  }
  
  // Check if Chloe exists in registry
  const agent = await AgentRegistry.getAgent('chloe');
  
  if (agent) {
    console.log('Using Chloe instance from registry');
    // Store in global for quicker access next time
    global.chloeAgent = agent as ChloeAgent;
    return agent as ChloeAgent;
  }
  
  // Create a new instance only if no instance exists at all
  console.log('Creating new Chloe instance via registry');
  const chloeAgent = new ChloeAgent();
  
  // Store as global immediately to prevent duplicate initialization
  global.chloeAgent = chloeAgent;
  
  // Initialize on creation
  try {
    console.log('Initializing new Chloe instance');
    await chloeAgent.initialize();
    console.log('Chloe instance initialized successfully');
    
    // Register with the agent registry
    AgentRegistry.registerAgent('chloe', chloeAgent);
    
  } catch (error) {
    console.error('Error initializing Chloe instance:', error);
  }
  
  return chloeAgent;
}

/**
 * Get a new Chloe instance based on the refactored implementation
 * This uses the updated ChloeAgentV2 class that extends AgentBase
 */
export async function getModernChloeInstance(): Promise<ChloeAgentV2> {
  // Check if modern Chloe exists in registry
  const agent = await AgentRegistry.getAgent('chloe-v2');
  
  if (agent) {
    console.log('Using ChloeV2 instance from registry');
    return agent as ChloeAgentV2;
  }
  
  // Create a new instance
  console.log('Creating new ChloeV2 instance via registry');
  const chloeAgent = new ChloeAgentV2({
    config: {
      agentId: 'chloe-v2',
      name: 'Chloe V2',
      description: 'Next generation Chloe agent based on AgentBase architecture'
    }
  });
  
  // Initialize on creation
  try {
    console.log('Initializing new ChloeV2 instance');
    await chloeAgent.initialize();
    console.log('ChloeV2 instance initialized successfully');
    
    // Register with the agent registry
    AgentRegistry.registerAgent('chloe-v2', chloeAgent);
    
  } catch (error) {
    console.error('Error initializing ChloeV2 instance:', error);
  }
  
  return chloeAgent;
}

/**
 * Create a migration to transition from old Chloe to modern implementation
 * This would copy over all relevant data and settings
 */
export async function migrateToChloeV2(): Promise<boolean> {
  try {
    // Get the original Chloe agent
    const originalChloe = await getChloeInstance();
    
    // Create a new ChloeV2 agent with the same ID to replace the original
    const newChloe = new ChloeAgentV2({
      config: {
        agentId: 'chloe', // Keep the same ID
        name: 'Chloe',
        description: 'CMO of Crowd Wisdom focused on marketing strategy',
        // We would ideally copy over any custom settings here
      }
    });
    
    // Initialize the new agent
    await newChloe.initialize();
    
    // Replace the old agent in the registry
    AgentRegistry.registerAgent('chloe', newChloe);
    
    // Update the global reference
    global.chloeAgent = newChloe as unknown as ChloeAgent;
    
    console.log('Successfully migrated to ChloeV2');
    return true;
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
} 