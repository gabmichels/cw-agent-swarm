/**
 * Markdown Memory Tester
 * 
 * This script tests the retrieval of markdown documents from the memory system,
 * particularly focusing on those ingested by the markdownLoader.
 * 
 * Usage: 
 * - Run `npx ts-node src/scripts/markdown-memory-test.ts` from the project root
 * - For cleanup: `npx ts-node src/scripts/markdown-memory-test.ts cleanup`
 */

import { getMemoryServices } from '../server/memory/services';
import { MemoryType } from '../server/memory/config';
import { BaseMemorySchema } from '../server/memory/models';

// Define types for the memory point structure
interface MemoryPoint {
  id: string;
  text?: string;
  payload?: {
    text?: string;
    metadata?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  [key: string]: any;
}

// Define types for the search result
interface SearchResult {
  point: MemoryPoint;
  score?: number;
}

// Define constants for document source identification
const MARKDOWN_SOURCES = ['markdown', 'file', 'docs'];
const MARKDOWN_CONTENT_TYPES = ['markdown', 'md'];
const MARKDOWN_PATH_PATTERNS = ['.md', '/markdown/', '/docs/', '/knowledge/'];
const MARKDOWN_INDICATORS = ['# ', '## ', '```', '**'];

// Mapping of markdown memory types to base memory types
const MARKDOWN_TYPE_MAP = {
  'strategy': MemoryType.DOCUMENT,
  'persona': MemoryType.DOCUMENT,
  'vision': MemoryType.DOCUMENT,
  'process': MemoryType.DOCUMENT,
  'knowledge': MemoryType.DOCUMENT
};

// Define path patterns for expected markdown directories
const EXPECTED_DIRECTORIES = [
  'data/knowledge/company',
  'data/knowledge/agents',
  'data/knowledge/domains',
  'docs'
];

/**
 * Main function to run the markdown memory test
 */
async function main() {
  console.log('=== MARKDOWN MEMORY TEST ===');
  console.log('Initializing memory services...');

  const { memoryService, searchService, client } = await getMemoryServices();
  
  // Check if we need to perform cleanup
  if (process.argv.includes('cleanup')) {
    await performCleanup(memoryService);
    return;
  }

  // Check if the client is initialized
  const status = await client.getStatus();
  console.log(`Memory client initialized: ${status.initialized}`);

  // Search for all document memories
  console.log('\nFetching all document memories...');
  const allDocuments = await searchService.search('', {
    types: [MemoryType.DOCUMENT],
    limit: 1000
  });
  console.log(`Retrieved ${allDocuments.length} document memories`);

  // Identify markdown documents using multiple criteria
  console.log('\nIdentifying markdown documents...');
  const markdownDocs = allDocuments.filter((memory: SearchResult) => {
    const metadata = memory.point.metadata || {};
    const payload = memory.point.payload || {};
    const payloadMetadata = payload.metadata || {};
    
    // Check for markdown source
    const source = metadata.source || payloadMetadata.source;
    const isMarkdownSource = source && MARKDOWN_SOURCES.includes(String(source));
    
    // Check for markdown content type
    const contentType = metadata.contentType || metadata.fileType || 
                       payloadMetadata.contentType || payloadMetadata.fileType;
    const isMarkdownContentType = contentType && 
                                MARKDOWN_CONTENT_TYPES.includes(String(contentType));
    
    // Check file path for markdown patterns
    const filePath = String(metadata.filePath || metadata.extractedFrom || 
                           payloadMetadata.filePath || payloadMetadata.extractedFrom || '');
    const isMarkdownPath = MARKDOWN_PATH_PATTERNS.some(pattern => filePath.includes(pattern));
    
    // Check for critical importance (markdown files are typically marked as critical)
    const isCritical = metadata.critical === true || 
                       payloadMetadata.critical === true || 
                       metadata.importance === 'critical' ||
                       payloadMetadata.importance === 'critical';
    
    // Check content for markdown indicators
    const content = String(memory.point.text || payload.text || '');
    const hasMarkdownIndicators = MARKDOWN_INDICATORS.some(indicator => 
                                                         content.includes(indicator));
    
    // Return true if any strong indicators are present
    return isMarkdownSource || isMarkdownContentType || isMarkdownPath || 
          (hasMarkdownIndicators && (isCritical || filePath.length > 0));
  });

  console.log(`Found ${markdownDocs.length} potential markdown documents`);

  // Analyze the markdown documents
  analyzeMarkdownDocuments(markdownDocs);
  
  // Test adding a markdown document
  await testAddMarkdownDocument(memoryService);
}

/**
 * Analyze markdown documents and print stats
 */
function analyzeMarkdownDocuments(docs: SearchResult[]) {
  console.log('\n=== MARKDOWN DOCUMENT ANALYSIS ===');
  
  // Count by source
  const sourceCount: Record<string, number> = {};
  // Count by type
  const typeCount: Record<string, number> = {};
  // Count by directory pattern
  const directoryCount: Record<string, number> = {};
  // Count documents with tags
  let documentsWithTags = 0;
  
  // Analyze each document
  docs.forEach(doc => {
    const metadata = doc.point.metadata || {};
    const payload = doc.point.payload || {};
    const payloadMetadata = payload.metadata || {};
    
    // Count source
    const source = String(metadata.source || payloadMetadata.source || 'unknown');
    sourceCount[source] = (sourceCount[source] || 0) + 1;
    
    // Count type
    const type = String(metadata.type || payloadMetadata.type || 'document');
    typeCount[type] = (typeCount[type] || 0) + 1;
    
    // Count directory pattern
    const filePath = String(metadata.filePath || metadata.extractedFrom || 
                           payloadMetadata.filePath || payloadMetadata.extractedFrom || '');
    
    // Check for expected directory patterns
    EXPECTED_DIRECTORIES.forEach(dir => {
      if (filePath.includes(dir)) {
        directoryCount[dir] = (directoryCount[dir] || 0) + 1;
      }
    });
    
    // Check for tags
    const tags = metadata.tags || payloadMetadata.tags;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      documentsWithTags++;
    }
    
    // Print detailed info for first 5 documents
    if (docs.indexOf(doc) < 5) {
      console.log(`\nDocument ${docs.indexOf(doc) + 1}:`);
      console.log(`  ID: ${doc.point.id}`);
      console.log(`  Type: ${type}`);
      console.log(`  Source: ${source}`);
      console.log(`  Path: ${filePath}`);
      
      // Print title or first line of content
      const content = String(doc.point.text || payload.text || '');
      const title = metadata.title || payloadMetadata.title || content.split('\n')[0] || 'No title';
      console.log(`  Title: ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);
      
      // Print tags if any
      if (tags && Array.isArray(tags) && tags.length > 0) {
        console.log(`  Tags: ${tags.join(', ')}`);
      }
    }
  });
  
  // Print summary statistics
  console.log('\n=== SUMMARY STATISTICS ===');
  console.log('Documents by source:');
  Object.entries(sourceCount).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  console.log('\nDocuments by type:');
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nDocuments by directory:');
  Object.entries(directoryCount).forEach(([dir, count]) => {
    console.log(`  ${dir}: ${count}`);
  });
  
  console.log(`\nDocuments with tags: ${documentsWithTags} (${Math.round(documentsWithTags / docs.length * 100)}%)`);
}

/**
 * Test adding a markdown document to memory
 */
async function testAddMarkdownDocument(memoryService: any) {
  console.log('\n=== TESTING MARKDOWN DOCUMENT ADDITION ===');
  
  try {
    // Create a test markdown document
    const testMarkdown = `# Test Markdown Document
    
## Introduction
This is a test markdown document created by the markdown-memory-test script.

## Features
- Tests memory integration
- Verifies markdown detection
- Demonstrates document creation

## Code Example
\`\`\`typescript
function testMarkdown() {
  console.log('This is a test');
}
\`\`\`
`;

    // Add to memory with critical importance
    const result = await memoryService.addMemory({
      type: MemoryType.DOCUMENT,
      content: testMarkdown,
      metadata: {
        source: "markdown",
        critical: true,
        importance: "critical",
        title: "Test Markdown Document",
        contentType: "markdown",
        extractedFrom: "markdown-memory-test.ts",
        lastModified: new Date().toISOString(),
        tags: ["test", "markdown", "memory"],
        type: "knowledge"
      }
    });
    
    if (result.success) {
      console.log(`Successfully added test markdown document with ID: ${result.id}`);
      console.log('To clean up this test document, run with "cleanup" argument');
      
      // Store the ID in a global variable for cleanup
      (global as any).testMarkdownId = result.id;
    } else {
      console.error('Failed to add test markdown document');
    }
  } catch (error) {
    console.error('Error adding test markdown document:', error);
  }
}

/**
 * Clean up test documents
 */
async function performCleanup(memoryService: any) {
  console.log('=== CLEANUP ===');
  
  try {
    // Find and delete test documents
    const testDocuments = await memoryService.searchMemories({
      query: "test markdown document",
      types: [MemoryType.DOCUMENT],
      limit: 10
    });
    
    console.log(`Found ${testDocuments.length} test documents to clean up`);
    
    // Delete each test document
    for (const doc of testDocuments) {
      if (doc.text?.includes('created by the markdown-memory-test script')) {
        console.log(`Deleting test document: ${doc.id}`);
        await memoryService.deleteMemory({
          id: doc.id,
          type: MemoryType.DOCUMENT
        });
      }
    }
    
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the main function and handle errors
main().catch(error => {
  console.error('Error in markdown memory test:', error);
  process.exit(1);
}); 