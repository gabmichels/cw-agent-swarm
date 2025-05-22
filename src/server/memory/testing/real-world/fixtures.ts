/**
 * Test fixtures management for memory services
 */

import { MemoryService } from '../../services/memory/memory-service';
import { MemoryType } from '../../config';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Fixture data structure
 */
export interface FixtureData {
  name: string;
  description: string;
  entries: Array<{
    content: string;
    type: string;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Loads a fixture from file or predefined set
 * 
 * @param fixtureName Name of the fixture to load
 * @returns Fixture data
 */
export async function loadFixture(fixtureName: string): Promise<FixtureData> {
  // Check if it's a file path
  if (existsSync(fixtureName)) {
    try {
      const data = readFileSync(fixtureName, 'utf8');
      return JSON.parse(data) as FixtureData;
    } catch (error) {
      throw new Error(`Failed to load fixture from file ${fixtureName}: ${error}`);
    }
  }
  
  // Check predefined fixtures
  const predefinedFixtures: Record<string, FixtureData> = {
    'basic': {
      name: 'basic',
      description: 'Basic fixture with minimal test data',
      entries: [
        {
          content: 'This is a test message',
          type: MemoryType.MESSAGE,
          metadata: {
            source: 'user',
            timestamp: new Date().toISOString()
          }
        },
        {
          content: 'This is a test document',
          type: MemoryType.DOCUMENT,
          metadata: {
            source: 'file',
            filename: 'test.txt',
            timestamp: new Date().toISOString()
          }
        }
      ]
    },
    'conversations': {
      name: 'conversations',
      description: 'Sample conversation data',
      entries: [
        {
          content: 'Hello, how can I help you today?',
          type: MemoryType.MESSAGE,
          metadata: {
            source: 'assistant',
            timestamp: new Date(Date.now() - 86400000).toISOString()
          }
        },
        {
          content: 'I need help with my project',
          type: MemoryType.MESSAGE,
          metadata: {
            source: 'user',
            timestamp: new Date(Date.now() - 86300000).toISOString()
          }
        },
        {
          content: 'What kind of project are you working on?',
          type: MemoryType.MESSAGE,
          metadata: {
            source: 'assistant',
            timestamp: new Date(Date.now() - 86200000).toISOString()
          }
        }
      ]
    }
  };
  
  // Return predefined fixture or error
  if (predefinedFixtures[fixtureName]) {
    return predefinedFixtures[fixtureName];
  }
  
  throw new Error(`Fixture "${fixtureName}" not found`);
}

/**
 * Maps string type to MemoryType enum
 * 
 * @param typeStr String representation of memory type
 * @returns MemoryType enum value
 */
function mapStringToMemoryType(typeStr: string): MemoryType {
  // Check if it's already a valid MemoryType
  if (Object.values(MemoryType).includes(typeStr as MemoryType)) {
    return typeStr as MemoryType;
  }
  
  // Fallback mapping for common types
  const typeMap: Record<string, MemoryType> = {
    'message': MemoryType.MESSAGE,
    'document': MemoryType.DOCUMENT,
    'thought': MemoryType.THOUGHT,
    'task': MemoryType.TASK,
    'chat': MemoryType.CHAT
  };
  
  return typeMap[typeStr.toLowerCase()] || MemoryType.OTHER;
}

/**
 * Imports fixture data into memory service
 * 
 * @param fixture Fixture data to import
 * @param memoryService Memory service instance
 * @returns Array of created memory entry IDs
 */
export async function importFixtureData(
  fixture: FixtureData,
  memoryService: MemoryService
): Promise<string[]> {
  const results: string[] = [];
  
  for (const entry of fixture.entries) {
    try {
      // Convert string type to MemoryType enum
      const memoryType = mapStringToMemoryType(entry.type);
      
      const result = await memoryService.addMemory({
        content: entry.content,
        type: memoryType,
        metadata: entry.metadata || {}
      });
      
      if (result && result.success && result.id) {
        results.push(result.id);
      } else {
        console.warn('Memory added but no ID returned');
      }
    } catch (error) {
      console.error(`Failed to import fixture entry: ${error}`);
    }
  }
  
  return results;
} 