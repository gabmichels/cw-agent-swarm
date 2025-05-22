/**
 * CLI command to reset agent bootstrap locks
 */

import { Command } from 'commander';
import { resetBootstrapLocks } from '../../server/agent/agent-bootstrap-utils';
import { logger } from '../../lib/logging';
import { agentBootstrapRegistry, AgentBootstrapState } from '../../server/agent/agent-bootstrap-registry';

/**
 * Create the reset-agent-locks command
 */
export function createResetAgentLocksCommand(): Command {
  const command = new Command('reset-agent-locks')
    .description('Reset bootstrap locks for agents')
    .option('-a, --agent-id <id>', 'Reset lock for a specific agent')
    .option('-f, --force', 'Force reset even for non-stale locks', false)
    .option('-s, --show-locks', 'Show current lock status', false)
    .option('-v, --verbose', 'Show verbose output', false)
    .action(async (options) => {
      const { agentId, force, showLocks, verbose } = options;
      
      try {
        console.log('Agent Bootstrap Lock Manager');
        console.log('===========================');
        
        if (showLocks) {
          // Display current lock status
          console.log('\nCurrent lock status:');
          
          const allAgentIds = agentBootstrapRegistry.getAllRegisteredAgentIds();
          
          if (allAgentIds.length === 0) {
            console.log('No agents registered');
          } else {
            console.log(`Found ${allAgentIds.length} registered agents\n`);
            
            allAgentIds.forEach(id => {
              const info = agentBootstrapRegistry.getAgentBootstrapInfo(id);
              if (info) {
                const isStale = agentBootstrapRegistry.isLockStale(id);
                console.log(`Agent ID: ${id}`);
                console.log(`  Name: ${info.agentName}`);
                console.log(`  State: ${info.state}`);
                console.log(`  Locked: ${info.locked ? 'YES' : 'NO'}${isStale ? ' (STALE)' : ''}`);
                
                if (info.locked && info.lockTimestamp) {
                  const duration = new Date().getTime() - info.lockTimestamp.getTime();
                  console.log(`  Lock Duration: ${Math.round(duration / 1000)}s`);
                }
                
                if (verbose) {
                  console.log(`  Status: ${info.status}`);
                  console.log(`  Retries: ${info.retries}`);
                  
                  if (info.startTime) {
                    console.log(`  Start Time: ${info.startTime.toISOString()}`);
                  }
                  
                  if (info.endTime) {
                    console.log(`  End Time: ${info.endTime.toISOString()}`);
                  }
                  
                  if (info.error) {
                    console.log(`  Error: ${info.error.message}`);
                  }
                }
                
                console.log('');
              }
            });
            
            // Print summary
            const lockedAgents = allAgentIds.filter(id => {
              const info = agentBootstrapRegistry.getAgentBootstrapInfo(id);
              return info && info.locked;
            });
            
            const staleLockedAgents = allAgentIds.filter(id => {
              return agentBootstrapRegistry.isLockStale(id);
            });
            
            console.log(`Summary: ${lockedAgents.length} locked agents, ${staleLockedAgents.length} with stale locks`);
          }
        }
        
        // If we're resetting locks
        if (force || agentId) {
          console.log('\nResetting locks...');
          
          // Reset locks
          const result = resetBootstrapLocks(agentId);
          
          // Log the action
          if (result.resetCount > 0) {
            console.log(`✅ Successfully reset ${result.resetCount} agent bootstrap locks`);
            if (verbose && result.agentIds.length > 0) {
              console.log('Reset the following agents:');
              result.agentIds.forEach(id => {
                const info = agentBootstrapRegistry.getAgentBootstrapInfo(id);
                console.log(`  - ${id}${info ? ` (${info.agentName})` : ''}`);
              });
            }
          } else {
            console.log('No locks were reset');
          }
        }
        
        // Show help message if no action was specified
        if (!showLocks && !force && !agentId) {
          console.log('\nNo action specified. Use --show-locks to view current lock status or --agent-id to reset a specific lock.');
          command.help();
        }
        
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
  
  return command;
} 