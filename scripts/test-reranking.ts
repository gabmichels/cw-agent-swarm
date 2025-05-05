#!/usr/bin/env node

/**
 * Script to test the enhanced memory retrieval with reranking
 * 
 * Usage:
 *   npm run test-reranking
 */

import { ChloeMemory } from '../src/agents/chloe/memory';
import * as qdrant from '../src/server/qdrant';
import { MemoryType as StandardMemoryType } from '../src/server/memory/config';

async function main() {
  try {
    console.log('🔍 Testing enhanced memory retrieval with reranking...');
    
    // Initialize memory systems
    console.log('Initializing memory...');
    await qdrant.initMemory();
    
    // Create a ChloeMemory instance
    const memory = new ChloeMemory();
    await memory.initialize();
    
    // Define test queries
    const testQueries = [
      "What is our company mission?",
      "What is Claro's mission statement?",
      "What do we aim to achieve as a company?",
      "What's our company's purpose?",
      "Tell me about our mission"
    ];
    
    // Test both regular and enhanced retrieval
    for (const query of testQueries) {
      console.log(`\n\n=== Testing query: "${query}" ===`);
      
      // Test regular retrieval
      console.log('\n🔹 Regular retrieval:');
      const regularResults = await memory.getRelevantMemories(query, 5);
      console.log(`Found ${regularResults.length} results`);
      
      if (regularResults.length > 0) {
        regularResults.forEach((result, i) => {
          console.log(`\n${i+1}. ${result.type || result.category || 'unknown'}:`);
          console.log(`   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
          
          if (result.metadata?.filePath) {
            console.log(`   Source: ${result.metadata.filePath}`);
          }
        });
      }
      
      // Test with specific types
      console.log('\n🔹 Regular retrieval with DOCUMENT type:');
      const typedResults = await memory.getRelevantMemories(
        query, 
        5, 
        [StandardMemoryType.DOCUMENT]
      );
      console.log(`Found ${typedResults.length} results with DOCUMENT type`);
      
      if (typedResults.length > 0) {
        typedResults.forEach((result, i) => {
          console.log(`\n${i+1}. ${result.type || result.category || 'unknown'}:`);
          console.log(`   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
          
          if (result.metadata?.filePath) {
            console.log(`   Source: ${result.metadata.filePath}`);
          }
        });
      }
      
      // Test enhanced retrieval
      console.log('\n🔹 Enhanced retrieval with reranking:');
      const enhancedResults = await memory.getEnhancedRelevantMemories(
        query,
        15,  // More candidates
        5,   // Final results
        {
          returnScores: true
        }
      );
      console.log(`Found ${enhancedResults.entries.length} results after reranking`);
      
      if (enhancedResults.entries.length > 0) {
        enhancedResults.entries.forEach((result, i) => {
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

      // Also display confidence information if available
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
    }
    
    console.log('\n\n✅ Memory retrieval test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing memory retrieval:', error);
    process.exit(1);
  }
}

// Run the script
main(); 