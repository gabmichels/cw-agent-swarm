#!/usr/bin/env node

/**
 * Script to update all existing memories with the new importance scoring system.
 * This script will:
 * 1. Connect to all memory collections
 * 2. Retrieve all memories
 * 3. Calculate importance scores for memories without them
 * 4. Update the memories with proper importance_score and ImportanceLevel values
 * 
 * Usage: node scripts/update-memory-importance.js
 */

const { getMemoryServices } = require('../dist/server/memory/services');
const { ImportanceCalculatorService } = require('../dist/services/importance/ImportanceCalculatorService');
const { ImportanceLevel } = require('../dist/constants/memory');
const { ImportanceConverter } = require('../dist/services/importance/ImportanceConverter');
const { MemoryType } = require('../dist/server/memory/config');

// List of collections to process
const COLLECTIONS_TO_PROCESS = [
  'messages',
  'documents',
  'tasks',
  'cognitive_artifacts',
  'knowledge',
  'user_preferences'
];

// Create a mock LLM service for importance calculation
const mockLLMService = {
  generateText: async (model, prompt) => {
    return "Default mock response";
  },
  generateStructuredOutput: async (model, prompt, outputSchema) => {
    return {
      importance_score: 0.5,
      importance_level: ImportanceLevel.MEDIUM,
      reasoning: "Default importance calculation",
      is_critical: false,
      keywords: []
    };
  },
  streamText: async function* (model, prompt) {
    yield "Default mock response";
  },
  streamStructuredOutput: async function* (model, prompt, outputSchema) {
    yield {
      importance_score: 0.5,
      importance_level: ImportanceLevel.MEDIUM
    };
  }
};

// Process memories in batches to avoid memory issues
const BATCH_SIZE = 100;

// Track script metrics
const metrics = {
  totalMemories: 0,
  updatedMemories: 0,
  skippedMemories: 0,
  failedMemories: 0,
  collections: 0,
  startTime: Date.now(),
  endTime: 0
};

async function main() {
  console.log('Starting memory importance update...');
  console.log('Initializing services...');
  
  try {
    // Initialize memory services
    const { client, memoryService, searchService } = await getMemoryServices();
    
    console.log('Checking memory client status...');
    const status = await client.getStatus();
    if (!status.initialized) {
      console.log('Initializing memory client...');
      await client.initialize();
    }
    
    // Create importance calculator service
    const importanceCalculator = new ImportanceCalculatorService(mockLLMService);
    
    // Process each collection in the predefined list
    metrics.collections = COLLECTIONS_TO_PROCESS.length;
    console.log(`Will process ${COLLECTIONS_TO_PROCESS.length} collections.`);
    
    for (const collectionName of COLLECTIONS_TO_PROCESS) {
      console.log(`\nProcessing collection: ${collectionName}`);
      
      // Check if collection exists before trying to process it
      try {
        const exists = await client.collectionExists(collectionName);
        if (!exists) {
          console.log(`Collection ${collectionName} does not exist, skipping.`);
          continue;
        }
      } catch (error) {
        console.error(`Error checking if collection ${collectionName} exists:`, error);
        continue;
      }
      
      let offset = 0;
      let total = 0;
      let updated = 0;
      let hasMore = true;
      
      // Process in batches
      while (hasMore) {
        // Query batch of memories
        console.log(`Retrieving batch starting at offset ${offset}...`);
        try {
          const searchResults = await searchService.search('', {
            filter: {
              must: []
            },
            limit: BATCH_SIZE,
            offset
          });
          
          if (searchResults.length === 0) {
            hasMore = false;
            console.log('No more memories to process.');
            break;
          }
          
          console.log(`Processing batch of ${searchResults.length} memories...`);
          
          // Process each memory in the batch
          for (const result of searchResults) {
            try {
              total++;
              metrics.totalMemories++;
              
              const point = result.point;
              const payload = point.payload || {};
              const metadata = payload.metadata || {};
              
              // Skip if both importance values already exist
              if (metadata.importance !== undefined && metadata.importance_score !== undefined) {
                console.log(`Skipping memory ${point.id} - importance already set.`);
                metrics.skippedMemories++;
                continue;
              }
              
              // Determine content to use for importance calculation
              let content = '';
              if (payload.text) {
                content = payload.text;
              } else if (typeof payload.content === 'string') {
                content = payload.content;
              } else if (typeof payload.summary === 'string') {
                content = payload.summary;
              } else if (typeof payload.title === 'string') {
                content = payload.title;
              } else {
                // If no usable content, assign medium importance
                metadata.importance = ImportanceLevel.MEDIUM;
                metadata.importance_score = 0.5;
                
                // Update the memory
                await client.updatePoint(collectionName, point.id, { 
                  payload: { 
                    metadata: metadata 
                  }
                });
                
                updated++;
                metrics.updatedMemories++;
                continue;
              }
              
              // Determine memory type
              let contentType = 'unknown';
              if (payload.type) {
                contentType = payload.type;
              } else if (metadata.type) {
                contentType = metadata.type;
              }
              
              // Calculate importance
              let importanceResult;
              try {
                // Use rule-based for speed
                const request = {
                  content,
                  contentType
                };
                
                importanceResult = await importanceCalculator.calculateImportance(request);
                
                // Update metadata with calculated importance
                metadata.importance = importanceResult.importance_level;
                metadata.importance_score = importanceResult.importance_score;
              } catch (calcError) {
                console.error(`Error calculating importance for memory ${point.id}:`, calcError);
                
                // Fallback to medium importance
                metadata.importance = ImportanceLevel.MEDIUM;
                metadata.importance_score = 0.5;
              }
              
              // Ensure both importance fields are present
              if (metadata.importance && metadata.importance_score === undefined) {
                metadata.importance_score = ImportanceConverter.levelToScore(metadata.importance);
              } else if (metadata.importance_score && metadata.importance === undefined) {
                metadata.importance = ImportanceConverter.scoreToLevel(metadata.importance_score);
              }
              
              // Special case for critical memory types
              if (contentType === MemoryType.TASK && metadata.priority === 'high') {
                metadata.importance = ImportanceLevel.HIGH;
                metadata.importance_score = ImportanceConverter.levelToScore(ImportanceLevel.HIGH);
              } else if (contentType === MemoryType.TASK && metadata.priority === 'critical') {
                metadata.importance = ImportanceLevel.CRITICAL;
                metadata.importance_score = ImportanceConverter.levelToScore(ImportanceLevel.CRITICAL);
              }
              
              // Update the memory
              await client.updatePoint(collectionName, point.id, { 
                payload: { 
                  metadata: metadata 
                }
              });
              
              updated++;
              metrics.updatedMemories++;
              
              // Log progress occasionally
              if (total % 20 === 0) {
                console.log(`Processed ${total} memories in ${collectionName}, updated ${updated}`);
              }
            } catch (memoryError) {
              console.error(`Error processing memory:`, memoryError);
              metrics.failedMemories++;
            }
          }
          
          // Move to next batch
          offset += searchResults.length;
          
          // Check if we have more to process
          if (searchResults.length < BATCH_SIZE) {
            hasMore = false;
          }
        } catch (searchError) {
          console.error(`Error searching in collection ${collectionName}:`, searchError);
          break;
        }
      }
      
      console.log(`Completed processing ${collectionName}: ${total} memories processed, ${updated} updated.`);
    }
    
    // Set end time and show summary
    metrics.endTime = Date.now();
    const durationSeconds = (metrics.endTime - metrics.startTime) / 1000;
    
    console.log('\n========== SUMMARY ==========');
    console.log(`Total collections processed: ${metrics.collections}`);
    console.log(`Total memories processed: ${metrics.totalMemories}`);
    console.log(`Memories updated: ${metrics.updatedMemories}`);
    console.log(`Memories skipped (already had importance): ${metrics.skippedMemories}`);
    console.log(`Memories failed: ${metrics.failedMemories}`);
    console.log(`Duration: ${durationSeconds.toFixed(2)} seconds`);
    console.log('============================');
    
    console.log('Importance update completed successfully!');
    
  } catch (error) {
    console.error('Error during memory importance update:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  }); 