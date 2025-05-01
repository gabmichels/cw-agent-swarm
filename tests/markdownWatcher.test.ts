import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';
import { MarkdownWatcher } from '../src/agents/chloe/knowledge/markdownWatcher';
import * as memory from '../src/server/qdrant';
import { syncMarkdownWithGraph } from '../src/agents/chloe/knowledge/markdownGraphIntegration';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('chokidar');
vi.mock('../src/server/qdrant');
vi.mock('../src/agents/chloe/knowledge/markdownGraphIntegration');
vi.mock('../src/agents/chloe/memory', () => ({
  ChloeMemory: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Markdown Watcher', () => {
  let mockMemory: any;
  let mockWatcher: any;
  let markdownWatcher: MarkdownWatcher;
  let logMessages: Array<{ message: string, data?: any }> = [];
  
  const testContent = `---
title: "Test Document"
type: "STRATEGY"
importance: "high"
tags: ["test", "markdown"]
---

# Overview

This is a test markdown file.

# Section One

Content for section one.
`;
  
  beforeEach(() => {
    // Reset mocks and log messages
    vi.resetAllMocks();
    logMessages = [];
    
    // Create mock memory
    mockMemory = {
      initialize: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock chokidar watcher
    mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(watch).mockReturnValue(mockWatcher);
    
    // Mock fs functions
    vi.mocked(fs.stat).mockResolvedValue({
      mtimeMs: Date.now(),
      isFile: () => true
    } as any);
    vi.mocked(fs.readFile).mockResolvedValue(testContent);
    
    // Mock memory functions
    vi.mocked(memory.addMemory).mockResolvedValue('mock-memory-id');
    vi.mocked(memory.initMemory).mockResolvedValue();
    vi.mocked(memory.updateMemoryMetadata).mockResolvedValue(true);
    
    // Mock graph integration
    vi.mocked(syncMarkdownWithGraph).mockResolvedValue({
      nodesAdded: 3,
      edgesAdded: 2,
      nodeTypes: { document: 1, section: 2 },
      concepts: ['test', 'markdown']
    });
    
    // Create the watcher with a mock logger
    markdownWatcher = new MarkdownWatcher({
      memory: mockMemory,
      logFunction: (message, data) => {
        logMessages.push({ message, data });
      }
    });
  });
  
  afterEach(async () => {
    try {
      await markdownWatcher.stopWatching();
    } catch (e) {
      // Ignore errors when stopping an already stopped watcher
    }
    vi.clearAllMocks();
  });
  
  it('should initialize with default paths', () => {
    expect(markdownWatcher).toBeDefined();
    expect(logMessages.length).toBe(0);
  });
  
  it('should start watching markdown files', async () => {
    await markdownWatcher.startWatching();
    
    expect(watch).toHaveBeenCalled();
    expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
    expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
    expect(logMessages.some(log => log.message.includes('Starting markdown file watcher'))).toBe(true);
  });
  
  it('should stop watching markdown files', async () => {
    // Start watching first
    await markdownWatcher.startWatching();
    
    // Then stop watching
    await markdownWatcher.stopWatching();
    
    expect(mockWatcher.close).toHaveBeenCalled();
    expect(logMessages.some(log => log.message.includes('Stopped markdown file watcher'))).toBe(true);
  });
  
  it('should process a markdown file when added', async () => {
    // Start watching
    await markdownWatcher.startWatching();
    
    // Manually trigger the 'add' handler
    const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')[1];
    await addHandler('test/path/document.md');
    
    // Check if file was processed
    expect(fs.readFile).toHaveBeenCalledWith('test/path/document.md', 'utf-8');
    expect(memory.addMemory).toHaveBeenCalled();
    expect(syncMarkdownWithGraph).toHaveBeenCalled();
    expect(logMessages.some(log => log.message.includes('Successfully processed markdown file'))).toBe(true);
  });
  
  it('should reload all markdown files', async () => {
    // Mock loadAllMarkdownAsMemory
    const mockResults = {
      filesProcessed: 5,
      entriesAdded: 10,
      typeStats: { STRATEGY: 3, KNOWLEDGE: 7 }
    };
    
    vi.mock('../src/agents/chloe/knowledge/markdownMemoryLoader', () => ({
      loadAllMarkdownAsMemory: vi.fn().mockResolvedValue(mockResults),
      markdownToMemoryEntries: vi.fn().mockResolvedValue([])
    }));
    
    // Import the mocked function
    const { loadAllMarkdownAsMemory } = await import('../src/agents/chloe/knowledge/markdownMemoryLoader');
    
    // Call reloadAllFiles
    const results = await markdownWatcher.reloadAllFiles();
    
    // Check results
    expect(loadAllMarkdownAsMemory).toHaveBeenCalled();
    expect(results).toEqual(mockResults);
    expect(logMessages.some(log => log.message.includes('Reloading all markdown files'))).toBe(true);
  });
}); 