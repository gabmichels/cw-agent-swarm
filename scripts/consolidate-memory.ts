#!/usr/bin/env ts-node
/**
 * Memory Consolidation Script
 * 
 * This script runs the memory consolidation process, which:
 * 1. Identifies important memories to strengthen
 * 2. Removes less relevant memories
 * 3. Updates memory decay factors
 * 4. Infers new knowledge graph connections
 * 
 * Run with: npm run memory:consolidate
 */

import dotenv from 'dotenv';
import { CognitiveMemory } from '../src/lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../src/lib/memory/src/knowledge-graph';

// Load environment variables
dotenv.config();

// Time how long the process takes
const startTime = Date.now();

// Flag to control output verbosity
const VERBOSE = process.argv.includes('--verbose');

async function runMemoryConsolidation() {
  console.log('📚 Starting memory consolidation process...');
  
  try {
    // Initialize cognitive memory
    const cognitiveMemory = new CognitiveMemory({
      namespace: 'chloe',
      workingMemoryCapacity: 9,
      consolidationInterval: 12
    });
    
    // Initialize knowledge graph
    const knowledgeGraph = new KnowledgeGraph('chloe');
    
    // Initialize memory systems
    await cognitiveMemory.initialize();
    await knowledgeGraph.initialize();
    
    // Run memory consolidation
    console.log('🧠 Running memory decay and consolidation...');
    const consolidatedCount = await cognitiveMemory.consolidateMemories();
    console.log(`✅ Processed ${consolidatedCount} memories for consolidation`);
    
    // Find concept nodes in knowledge graph
    console.log('🔍 Finding important concepts in knowledge graph...');
    const conceptNodes = await knowledgeGraph.findNodes('', ['concept'], 20);
    console.log(`📊 Found ${conceptNodes.length} concept nodes`);
    
    // Infer new connections for top concept nodes
    console.log('🔄 Inferring new connections in knowledge graph...');
    let totalInferences = 0;
    
    for (const node of conceptNodes) {
      if (VERBOSE) {
        console.log(`📝 Processing concept: ${node.label}`);
      }
      
      const inferences = await knowledgeGraph.inferNewEdges(node.id, 0.7);
      
      if (inferences.length > 0) {
        console.log(`🔗 Found ${inferences.length} potential new connections for "${node.label}"`);
        
        // Add high confidence inferences automatically
        for (const inference of inferences) {
          if (inference.confidence > 0.8) {
            if (VERBOSE) {
              console.log(`  - Adding edge: ${inference.source} --[${inference.type}]--> ${inference.target} (${Math.round(inference.confidence * 100)}% confidence)`);
            }
            
            await knowledgeGraph.addEdge(
              inference.source,
              inference.target,
              inference.type,
              inference.confidence
            );
            
            totalInferences++;
          }
        }
      }
    }
    
    console.log(`✅ Added ${totalInferences} new inferred connections to knowledge graph`);
    
    // Calculate completion time
    const duration = (Date.now() - startTime) / 1000;
    console.log(`🎉 Memory consolidation complete in ${duration.toFixed(2)} seconds`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error during memory consolidation:', error);
    return { success: false, error };
  }
}

// Run the consolidation process
runMemoryConsolidation()
  .then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 