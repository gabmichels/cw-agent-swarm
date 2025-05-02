#!/usr/bin/env node

/**
 * Script to test the shared memory enhancements for all agents
 * 
 * Usage:
 *   npm run test-shared-memory-enhancements
 */

import { MemoryRouter, EnhancedMemoryRetrievalOptions } from '../src/agents/shared/memory/MemoryRouter';
import * as qdrant from '../src/server/qdrant';
import { ChloeMemory } from '../src/agents/chloe/memory';

// Test agent IDs
const TEST_AGENTS = ['agent1', 'agent2', 'chloe'];

async function main() {
  try {
    console.log('🔍 Testing shared memory enhancements across agents...');
    
    // Initialize qdrant
    console.log('Initializing Qdrant...');
    await qdrant.initMemory();
    
    // Create a memory router
    console.log('Setting up memory router...');
    const memoryRouter = new MemoryRouter({
      enableReranking: true,
      confidenceThreshold: 70
    });
    await memoryRouter.initialize();
    
    // Register test agents
    TEST_AGENTS.forEach(agentId => {
      memoryRouter.registerAgent(agentId, ['shared']);
      console.log(`Registered agent: ${agentId}`);
    });
    
    // Also test with Chloe's memory implementation for comparison
    console.log('Initializing Chloe memory for comparison...');
    const chloeMemory = new ChloeMemory();
    await chloeMemory.initialize();
    
    // Define test queries
    const testQueries = [
      "What is our company mission?",
      "How do we handle customer support requests?",
      "What's the procedure for onboarding new team members?",
      "What are our core values?",
      "Tell me about our product roadmap"
    ];
    
    // Run tests for all queries
    for (const query of testQueries) {
      console.log(`\n\n=== Testing query: "${query}" ===`);
      
      // Test for each agent
      for (const agentId of TEST_AGENTS) {
        console.log(`\n----- Agent: ${agentId} -----`);
        
        // Get memories with regular retrieval
        console.log('\n🔹 Regular retrieval:');
        const regularResults = await memoryRouter.getRelevantMemories(
          agentId,
          'shared',
          query,
          { limit: 5 }
        );
        
        console.log(`Found ${regularResults.length} results with regular retrieval`);
        showResults(regularResults);
        
        // Get memories with enhanced retrieval
        console.log('\n🔹 Enhanced retrieval with reranking:');
        const enhancedOptions: EnhancedMemoryRetrievalOptions = {
          returnScores: true,
          validateContent: true
        };
        
        const enhancedResults = await memoryRouter.getEnhancedRelevantMemories(
          agentId,
          'shared',
          query,
          15,  // More candidates
          5,   // Final results
          enhancedOptions
        );
        
        console.log(`Found ${enhancedResults.entries.length} results with enhanced retrieval`);
        showResults(enhancedResults.entries);
        
        // Show confidence information
        if (enhancedResults.confidenceScore !== undefined) {
          console.log(`\nConfidence score: ${enhancedResults.confidenceScore}`);
          console.log(`Confidence threshold met: ${enhancedResults.hasConfidence}`);
          
          if (enhancedResults.contentValid !== undefined) {
            console.log(`Content valid: ${enhancedResults.contentValid}`);
          }
          
          if (enhancedResults.invalidReason) {
            console.log(`Invalid reason: ${enhancedResults.invalidReason}`);
          }
        }
        
        // If agent is chloe, also test with Chloe's implementation
        if (agentId === 'chloe') {
          console.log('\n🔹 Using Chloe-specific memory implementation:');
          
          const chloeEnhancedResults = await chloeMemory.getEnhancedRelevantMemories(
            query,
            15,  // More candidates
            5,   // Final results 
            enhancedOptions
          );
          
          console.log(`Found ${chloeEnhancedResults.entries.length} results with Chloe implementation`);
          showResults(chloeEnhancedResults.entries);
          
          // Show confidence information
          if (chloeEnhancedResults.confidenceScore !== undefined) {
            console.log(`\nConfidence score: ${chloeEnhancedResults.confidenceScore}`);
            console.log(`Confidence threshold met: ${chloeEnhancedResults.hasConfidence}`);
            
            if (chloeEnhancedResults.contentValid !== undefined) {
              console.log(`Content valid: ${chloeEnhancedResults.contentValid}`);
            }
            
            if (chloeEnhancedResults.invalidReason) {
              console.log(`Invalid reason: ${chloeEnhancedResults.invalidReason}`);
            }
          }
        }
      }
    }
    
    console.log('\n\n✅ Shared memory enhancements test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing shared memory enhancements:', error);
    process.exit(1);
  }
}

/**
 * Helper function to display results
 */
function showResults(results: any[]) {
  if (results.length === 0) {
    console.log('No results found');
    return;
  }
  
  results.forEach((result, i) => {
    const score = result.metadata?.rerankScore ? `[Score: ${result.metadata.rerankScore}]` : '';
    console.log(`\n${i+1}. ${result.type || result.category || 'unknown'} ${score}:`);
    console.log(`   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
    
    if (result.metadata?.filePath) {
      console.log(`   Source: ${result.metadata.filePath}`);
    }
    
    if (result.metadata?.rerankReasoning) {
      console.log(`   Reasoning: ${result.metadata.rerankReasoning}`);
    }
  });
}

// Run the script
main(); 