#!/usr/bin/env ts-node

/**
 * Script to update all existing memories with the new importance scoring system.
 * This script will:
 * 1. Connect to all memory collections
 * 2. Retrieve all memories
 * 3. Calculate importance scores for memories without them
 * 4. Update the memories with proper importance_score and ImportanceLevel values
 * 
 * Usage: npm run ts-node scripts/update-memory-importance.ts
 */

import { getMemoryServices } from '../src/server/memory/services';
import { ImportanceCalculatorService, ImportanceCalculationMode } from '../src/services/importance/ImportanceCalculatorService';
import { ImportanceLevel } from '../src/constants/memory';
import { ImportanceConverter } from '../src/services/importance/ImportanceConverter';
import { MemoryType } from '../src/server/memory/config';
import { ImportanceCalculationRequest } from '../src/services/importance/types';

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
  generateText: async (model: string, prompt: string): Promise<string> => {
    return "Default mock response";
  },
  generateStructuredOutput: async <T>(
    model: string, 
    prompt: string, 
    outputSchema: Record<string, unknown>
  ): Promise<T> => {
    return {
      importance_score: 0.5,
      importance_level: ImportanceLevel.MEDIUM,
      reasoning: "Default importance calculation",
      is_critical: false,
      keywords: []
    } as unknown as T;
  },
  streamText: async function* (model: string, prompt: string): AsyncGenerator<string> {
    yield "Default mock response";
  },
  streamStructuredOutput: async function* <T>(
    model: string,
    prompt: string,
    outputSchema: Record<string, unknown>
  ): AsyncGenerator<Partial<T>> {
    yield {
      importance_score: 0.5,
      importance_level: ImportanceLevel.MEDIUM
    } as unknown as Partial<T>;
  }
};

// Process memories in batches to avoid memory issues
const BATCH_SIZE = 100;
// Maximum number of memories to process per collection to prevent endless loops
// Set lower since we only have around 200+ memories total
const MAX_MEMORIES_PER_COLLECTION = 500;

// Track script metrics
const metrics = {
  totalMemories: 0,
  updatedMemories: 0,
  skippedMemories: 0,
  failedMemories: 0,
  notFoundMemories: 0,
  collections: 0,
  startTime: Date.now(),
  endTime: 0
};

async function main() {
  console.log('Starting memory importance update with LLM-based scoring...');
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
      while (hasMore && total < MAX_MEMORIES_PER_COLLECTION) {
        // Query batch of memories
        console.log(`Retrieving batch starting at offset ${offset}...`);
        try {
          // Search for memories without importance metadata using a simpler filter approach
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
              // @ts-ignore - Using dynamic payload structure
              const payload = point.payload;
              // @ts-ignore - Using dynamic metadata structure  
              const metadata = payload.metadata || {};
              
              // Add the required schemaVersion field
              // @ts-ignore - Setting schemaVersion metadata property
              if (!metadata.schemaVersion) {
                // @ts-ignore - Setting schemaVersion metadata property
                metadata.schemaVersion = "1.0";
              }
              
              // Skip if both importance values already exist
              // @ts-ignore - Using dynamic metadata properties
              if (metadata.importance !== undefined && metadata.importance_score !== undefined) {
                console.log(`Skipping memory ${point.id} - importance already set.`);
                metrics.skippedMemories++;
                continue;
              }
              
              // Determine content to use for importance calculation
              let content = '';
              if (payload.text) {
                content = payload.text;
              // @ts-ignore - Checking dynamic payload properties
              } else if (typeof payload.content === 'string') {
                // @ts-ignore - Using dynamic payload properties
                content = payload.content;
              // @ts-ignore - Checking dynamic payload properties
              } else if (typeof payload.summary === 'string') {
                // @ts-ignore - Using dynamic payload properties
                content = payload.summary;
              // @ts-ignore - Checking dynamic payload properties
              } else if (typeof payload.title === 'string') {
                // @ts-ignore - Using dynamic payload properties
                content = payload.title;
              } else {
                // If no usable content, assign medium importance
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance = ImportanceLevel.MEDIUM;
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance_score = 0.5;
                
                // Update the memory - payload with metadata
                // @ts-ignore - Using dynamic payload structure
                try {
                  await client.updatePoint(collectionName, point.id, { 
                    // @ts-ignore - Using dynamic payload structure
                    payload: { metadata }
                  });
                  
                  updated++;
                  metrics.updatedMemories++;
                } catch (updateError: any) {
                  // Handle 404 errors (points that don't exist anymore) differently than other errors
                  if (updateError?.status === 404) {
                    console.log(`Skipping memory ${point.id} - point no longer exists.`);
                    metrics.skippedMemories++;
                    metrics.notFoundMemories++;
                  } else {
                    console.error(`Error updating point ${point.id} in ${collectionName}:`, updateError);
                    metrics.failedMemories++;
                  }
                }
                
                continue;
              }
              
              // Determine memory type
              let contentType = 'unknown';
              if (payload.type) {
                contentType = payload.type as string;
              // @ts-ignore - Using dynamic metadata properties
              } else if (metadata.type) {
                // @ts-ignore - Using dynamic metadata type
                contentType = metadata.type as string;
              }
              
              // Calculate importance
              let importanceResult;
              try {
                // Use LLM-based scoring for better quality results
                const request: ImportanceCalculationRequest = {
                  content,
                  contentType
                };
                
                // Removed RULE_BASED parameter to use default LLM-based scoring
                importanceResult = await importanceCalculator.calculateImportance(request);
                
                // Update metadata with calculated importance
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance = importanceResult.importance_level;
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance_score = importanceResult.importance_score;
                
                console.log(`Calculated importance for ${point.id}: ${importanceResult.importance_level} (${importanceResult.importance_score.toFixed(2)})`);
              } catch (calcError) {
                console.error(`Error calculating importance for memory ${point.id}:`, calcError);
                
                // Fallback to medium importance
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance = ImportanceLevel.MEDIUM;
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance_score = 0.5;
              }
              
              // Ensure both importance fields are present
              // @ts-ignore - Using dynamic metadata properties
              if (metadata.importance && metadata.importance_score === undefined) {
                // @ts-ignore - Using and setting dynamic metadata properties
                metadata.importance_score = ImportanceConverter.levelToScore(metadata.importance);
              // @ts-ignore - Using dynamic metadata properties
              } else if (metadata.importance_score && metadata.importance === undefined) {
                // @ts-ignore - Using and setting dynamic metadata properties
                metadata.importance = ImportanceConverter.scoreToLevel(metadata.importance_score);
              }
              
              // Special case for critical memory types
              // @ts-ignore - Using dynamic metadata properties
              if (contentType === MemoryType.TASK && metadata.priority === 'high') {
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance = ImportanceLevel.HIGH;
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance_score = ImportanceConverter.levelToScore(ImportanceLevel.HIGH);
              // @ts-ignore - Using dynamic metadata properties
              } else if (contentType === MemoryType.TASK && metadata.priority === 'critical') {
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance = ImportanceLevel.CRITICAL;
                // @ts-ignore - Setting dynamic metadata properties
                metadata.importance_score = ImportanceConverter.levelToScore(ImportanceLevel.CRITICAL);
              }
              
              // Update the memory - payload with metadata
              // @ts-ignore - Using dynamic payload structure
              try {
                await client.updatePoint(collectionName, point.id, { 
                  // @ts-ignore - Using dynamic payload structure
                  payload: { metadata }
                });
                
                updated++;
                metrics.updatedMemories++;
              } catch (updateError: any) {
                // Handle 404 errors (points that don't exist anymore) differently than other errors
                if (updateError?.status === 404) {
                  console.log(`Skipping memory ${point.id} - point no longer exists.`);
                  metrics.skippedMemories++;
                  metrics.notFoundMemories++;
                } else {
                  console.error(`Error updating point ${point.id} in ${collectionName}:`, updateError);
                  metrics.failedMemories++;
                }
              }
              
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
    console.log(`Memories not found (404 errors): ${metrics.notFoundMemories}`);
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