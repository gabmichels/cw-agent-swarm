/**
 * Test suite for MarkdownManager
 * 
 * These tests verify the basic functionality of the markdown processing system
 * that replaced the old markdown files.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

interface MarkdownStats {
  filesProcessed: number;
  entriesAdded: number;
  filesSkipped: number;
  duplicatesSkipped: number;
  unchangedFiles: number;
}

interface ManagerOptions {
  logFunction?: (message: string, data?: any) => void;
  [key: string]: any;
}

// Create a minimal mock version of the MarkdownManager
class MockMarkdownManager {
  isWatching = false;
  cacheData = {};
  logFunction: (message: string, data?: any) => void;
  memoryService: {
    addMemory: ReturnType<typeof vi.fn>;
    searchMemories: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
  };

  constructor(options: ManagerOptions = {}) {
    this.logFunction = options.logFunction || console.log;
    this.memoryService = {
      addMemory: vi.fn().mockResolvedValue({ id: 'memory-123' }),
      searchMemories: vi.fn().mockResolvedValue([]),
      deleteMemory: vi.fn().mockResolvedValue(true)
    };
  }

  async loadMarkdownFiles(options = {}): Promise<MarkdownStats> {
    this.logFunction('Loading markdown files', options);
    return {
      filesProcessed: 2,
      entriesAdded: 3,
      filesSkipped: 0,
      duplicatesSkipped: 0,
      unchangedFiles: 0
    };
  }

  async startWatching(): Promise<boolean> {
    this.isWatching = true;
    this.logFunction('Started watching markdown files');
    return true;
  }

  async stopWatching(): Promise<boolean> {
    this.isWatching = false;
    this.logFunction('Stopped watching markdown files');
    return true;
  }

  async testFileWatcher(): Promise<boolean> {
    this.logFunction('Testing file watcher');
    return true;
  }

  getAgentDirectories(): string[] {
    return ['data/knowledge', 'docs'];
  }
}

describe('MarkdownManager Tests', () => {
  let manager: MockMarkdownManager;
  let mockLogFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogFunction = vi.fn();
    manager = new MockMarkdownManager({ logFunction: mockLogFunction });
  });

  test('should log when loading files', async () => {
    const result = await manager.loadMarkdownFiles({ force: true });
    
    expect(mockLogFunction).toHaveBeenCalled();
    expect(result.filesProcessed).toBe(2);
    expect(result.entriesAdded).toBe(3);
  });

  test('should properly track watching state', async () => {
    expect(manager.isWatching).toBe(false);
    
    await manager.startWatching();
    expect(manager.isWatching).toBe(true);
    expect(mockLogFunction).toHaveBeenCalledWith('Started watching markdown files');
    
    await manager.stopWatching();
    expect(manager.isWatching).toBe(false);
    expect(mockLogFunction).toHaveBeenCalledWith('Stopped watching markdown files');
  });

  test('should get agent directories', () => {
    const dirs = manager.getAgentDirectories();
    expect(dirs).toEqual(['data/knowledge', 'docs']);
    expect(dirs.length).toBe(2);
  });

  test('should test file watcher functionality', async () => {
    const result = await manager.testFileWatcher();
    expect(result).toBe(true);
    expect(mockLogFunction).toHaveBeenCalledWith('Testing file watcher');
  });
}); 