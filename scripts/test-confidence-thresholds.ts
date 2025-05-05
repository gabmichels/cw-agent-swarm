#!/usr/bin/env node

/**
 * Script to test the confidence threshold implementation
 * 
 * Usage:
 *   npm run memory:test-confidence
 */

import { ChloeMemory } from '../src/agents/chloe/memory';
import * as qdrant from '../src/server/qdrant';
import { MemoryType as StandardMemoryType } from '../src/server/memory/config';

async function main() {
  try {
    console.log('🔍 Testing confidence threshold implementation...');
    
    // Initialize memory systems
    console.log('Initializing memory...');
    await qdrant.initMemory();
    
    // Create a ChloeMemory instance
    const memory = new ChloeMemory();
    await memory.initialize();
    
    // Test queries that should trigger confidence thresholds
    const testQueries = [
      {
        query: "What is Claro's mission?",
        type: "MISSION",
        confidenceThreshold: 70
      },
      {
        query: "What is Claro's brand identity?",
        type: "BRAND",
        confidenceThreshold: 70
      },
      {
        query: "What are our company values?",
        type: "VALUES",
        confidenceThreshold: 70
      },
      {
        query: "Tell me about our product features",
        type: "PRODUCT",
        confidenceThreshold: 70
      },
      {
        query: "What is a completely random topic that shouldn't match anything?",
        type: "RANDOM",
        confidenceThreshold: 70
      }
    ];
    
    // Run tests for each query
    for (const test of testQueries) {
      console.log(`\n\n🔹 Testing query: "${test.query}" (${test.type}):`);
      
      // Get results with confidence checking
      console.log(`\n[WITH confidence threshold = ${test.confidenceThreshold}]`);
      const resultsWithConfidence = await memory.getEnhancedRelevantMemories(
        test.query,
        15,
        3,
        {
          types: [StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT], // Document type for all strategy, persona, vision content
          debug: true,
          confidenceThreshold: test.confidenceThreshold,
          validateContent: true
        }
      );
      
      console.log(`Found ${resultsWithConfidence.entries.length} results`);
      console.log(`Confidence threshold met: ${resultsWithConfidence.hasConfidence}`);
      console.log(`Confidence score: ${resultsWithConfidence.confidenceScore || 'N/A'}`);
      console.log(`Content valid: ${resultsWithConfidence.contentValid !== undefined ? resultsWithConfidence.contentValid : 'Not validated'}`);
      
      if (resultsWithConfidence.invalidReason) {
        console.log(`Invalid reason: ${resultsWithConfidence.invalidReason}`);
      }
      
      // Show top result
      if (resultsWithConfidence.entries.length > 0) {
        const topResult = resultsWithConfidence.entries[0];
        console.log(`\nTop result [${topResult.type || topResult.category || 'unknown'}]:`);
        console.log(`Source: ${topResult.metadata?.filePath || topResult.metadata?.source || 'unknown'}`);
        console.log(`Score: ${topResult.metadata?.rerankScore || 'N/A'}`);
        console.log(`Content: ${topResult.content.substring(0, 200)}${topResult.content.length > 200 ? '...' : ''}`);
      }
      
      // Get results without confidence checking
      console.log(`\n[WITHOUT confidence threshold]`);
      const resultsWithoutConfidence = await memory.getRelevantMemories(
        test.query,
        3,
        [StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT] // Document type for all strategy, persona, vision content
      );
      
      console.log(`Found ${resultsWithoutConfidence.length} results`);
      
      // Show top result without confidence checking
      if (resultsWithoutConfidence.length > 0) {
        const topResult = resultsWithoutConfidence[0];
        console.log(`\nTop result [${topResult.type || topResult.category || 'unknown'}]:`);
        console.log(`Source: ${topResult.metadata?.filePath || topResult.metadata?.source || 'unknown'}`);
        console.log(`Content: ${topResult.content.substring(0, 200)}${topResult.content.length > 200 ? '...' : ''}`);
      }
    }
    
    // Test a query with different confidence thresholds
    const brandQuery = "Tell me about Claro's brand identity and values";
    
    console.log(`\n\n🔹 Testing query with different confidence thresholds: "${brandQuery}":`);
    
    for (const threshold of [50, 70, 90]) {
      console.log(`\n[WITH confidence threshold = ${threshold}]`);
      const results = await memory.getEnhancedRelevantMemories(
        brandQuery,
        15,
        3,
        {
          types: [StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT, StandardMemoryType.DOCUMENT], // Document type for all strategy, persona, vision content
          debug: true,
          confidenceThreshold: threshold,
          validateContent: true
        }
      );
      
      console.log(`Found ${results.entries.length} results`);
      console.log(`Confidence threshold met: ${results.hasConfidence}`);
      console.log(`Confidence score: ${results.confidenceScore || 'N/A'}`);
      console.log(`Content valid: ${results.contentValid !== undefined ? results.contentValid : 'Not validated'}`);
      
      if (results.invalidReason) {
        console.log(`Invalid reason: ${results.invalidReason}`);
      }
    }
    
    console.log('\n\n✅ Confidence threshold test completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error testing confidence thresholds:', error);
    process.exit(1);
  }
}

// Run the script
main(); 