/**
 * Test script for hybrid memory search functionality
 * 
 * This script demonstrates the hybrid search functionality that combines
 * vector similarity (70%) with tag overlap (30%) for better search results.
 */

import { initMemory, storeMemory, searchMemory, resetAllCollections } from './index';
import { TagExtractor, TagAlgorithm } from '../../lib/memory/TagExtractor';

async function main() {
  console.log("Starting hybrid search test...");
  
  // Initialize memory system
  await initMemory();
  
  // Reset collections to start fresh
  await resetAllCollections();
  
  // Create test documents with different tags
  const testDocs = [
    {
      content: "JavaScript is a programming language commonly used for web development. It allows you to create interactive elements on websites.",
      type: "document",
      source: "test",
      tags: ["javascript", "programming", "web development"]
    },
    {
      content: "Python is a versatile programming language used for AI, data science, and backend development. It's known for its readability.",
      type: "document",
      source: "test",
      tags: ["python", "programming", "data science", "AI"]
    },
    {
      content: "TypeScript is a statically typed superset of JavaScript that compiles to plain JavaScript. It adds optional static typing to the language.",
      type: "document",
      source: "test",
      tags: ["typescript", "javascript", "programming", "static typing"]
    },
    {
      content: "React is a JavaScript library for building user interfaces. It is maintained by Facebook and a community of developers.",
      type: "document",
      source: "test",
      tags: ["react", "javascript", "frontend", "UI"]
    },
    {
      content: "Neural networks are a set of algorithms, modeled loosely after the human brain, that are designed to recognize patterns.",
      type: "document",
      source: "test",
      tags: ["neural networks", "AI", "machine learning", "deep learning"]
    }
  ];
  
  // Store test documents
  console.log("Storing test documents...");
  for (const doc of testDocs) {
    await storeMemory(
      doc.content,
      doc.type,
      doc.source,
      {},
      { tags: doc.tags }
    );
  }
  
  // Wait for documents to be indexed
  console.log("Waiting for documents to be indexed...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test cases
  const queries = [
    {
      query: "What is JavaScript?",
      explanation: "This should match documents about JavaScript (documents 1, 3, 4)"
    },
    {
      query: "Tell me about AI and machine learning",
      explanation: "This should match documents about AI and machine learning (documents 2, 5)"
    },
    {
      query: "programming languages for web development",
      explanation: "This should match documents about programming languages used in web dev (documents 1, 2, 3)"
    },
    {
      query: "JavaScript libraries",
      explanation: "This should match documents about JavaScript libraries (document 4)"
    }
  ];
  
  // Run test queries
  console.log("\n--------- Running test queries ---------\n");
  
  for (const test of queries) {
    console.log(`\n=== Query: "${test.query}" ===`);
    console.log(`Expected: ${test.explanation}`);
    
    // Extract query tags for reference
    const queryTags = TagExtractor.extractTags(test.query, {
      algorithm: TagAlgorithm.RAKE,
      maxTags: 8,
      minConfidence: 0.15
    }).map(tag => tag.text);
    
    console.log(`Extracted tags: ${queryTags.join(', ')}`);
    
    // Search with hybrid approach
    const results = await searchMemory('document', test.query, { limit: 5 });
    
    console.log(`\nResults (${results.length}):`);
    for (const result of results) {
      const details = result.metadata._scoringDetails;
      
      // Display first 50 characters of content
      const contentPreview = result.text.length > 50 
        ? result.text.substring(0, 47) + '...' 
        : result.text;
      
      console.log(
        `• Content: "${contentPreview}"\n` +
        `  Vector score: ${details.vectorScore.toFixed(3)} × 0.7 = ${(details.vectorScore * 0.7).toFixed(3)}\n` +
        `  Tag score: ${details.tagScore.toFixed(3)} × 0.3 = ${(details.tagScore * 0.3).toFixed(3)}\n` +
        `  Final score: ${details.hybridScore.toFixed(3)}\n` +
        `  Tags: ${result.metadata.tags.join(', ')}\n` +
        `  Matched tags: ${details.matchedTags.join(', ') || 'none'}`
      );
    }
  }
  
  console.log("\nHybrid search test completed!");
}

// Run the test
main().catch(error => {
  console.error("Error running hybrid search test:", error);
}); 