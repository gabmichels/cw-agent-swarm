import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import * as memory from '../src/server/qdrant';
import { markdownToMemoryEntries, loadAllMarkdownAsMemory } from '../src/agents/chloe/knowledge/markdownMemoryLoader';
import { ImportanceLevel, MemorySource } from '../src/constants/memory';

// Mock the fs and qdrant modules
vi.mock('fs/promises');
vi.mock('../src/server/qdrant');
vi.mock('glob', () => ({
  glob: vi.fn().mockImplementation(async (pattern, options) => {
    if (pattern.includes('company')) {
      return ['company/strategy/vision.md', 'company/general/about.md'];
    } else if (pattern.includes('domains')) {
      return ['domains/marketing/seo.md'];
    } else if (pattern.includes('chloe')) {
      return ['../agents/chloe/personality.md'];
    } else {
      return ['agents/researcher/profile.md'];
    }
  })
}));

describe('Markdown Memory Loader', () => {
  // Setup test data
  const testContent = `---
title: Testing Markdown
type: strategy
importance: high
tags: [test, markdown, memory]
---

# Introduction

This is a test markdown file for memory loading.

## Strategy Section

This is a strategic section with some content. #important #strategy

## Process Section

This is a process section with some information.

## Knowledge Section

This is a knowledge section with information.`;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Mock fs.readFile to return our test content
    vi.mocked(fs.readFile).mockResolvedValue(testContent);
    
    // Mock memory.addMemory to return a mock memory ID
    vi.mocked(memory.addMemory).mockResolvedValue('mock-memory-id');
    
    // Mock memory.initMemory to resolve without a return value
    vi.mocked(memory.initMemory).mockResolvedValue();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('markdownToMemoryEntries', () => {
    it('should parse markdown with frontmatter into memory entries', async () => {
      const filePath = 'test/file.md';
      const result = await markdownToMemoryEntries(filePath, testContent);
      
      // Check that we get multiple memory entries from section splitting
      expect(result.length).toBeGreaterThan(1);
      
      // Check that frontmatter is properly extracted
      expect(result[0].title).toBe('Testing Markdown');
      expect(result[0].importance).toBe(ImportanceLevel.HIGH);
      expect(result[0].tags).toContain('test');
      expect(result[0].tags).toContain('markdown');
      expect(result[0].tags).toContain('memory');
      
      // Check that type is properly set
      expect(result[0].type).toBe('strategy');
      
      // Check that source is properly set
      expect(result[0].source).toBe(MemorySource.FILE);
    });
    
    it('should handle markdown without frontmatter', async () => {
      const filePath = 'test/simple.md';
      const simpleContent = '# Simple Test\n\nThis is a simple test without frontmatter.';
      
      const result = await markdownToMemoryEntries(filePath, simpleContent);
      
      // Check that we still get a memory entry
      expect(result.length).toBe(1);
      
      // Check that the title is derived from the filename
      expect(result[0].title).toBe('simple');
      
      // Check that default importance is medium
      expect(result[0].importance).toBe(ImportanceLevel.MEDIUM);
      
      // Check that source is properly set
      expect(result[0].source).toBe(MemorySource.FILE);
    });
    
    it('should extract hashtags as tags', async () => {
      const filePath = 'test/tags.md';
      const tagContent = '# Tags Test\n\nThis has #tags and #hashtags in the content.';
      
      const result = await markdownToMemoryEntries(filePath, tagContent);
      
      // Check that tags were extracted
      expect(result[0].tags).toContain('tags');
      expect(result[0].tags).toContain('hashtags');
    });
    
    it('should detect importance from content keywords', async () => {
      const filePath = 'test/importance.md';
      const criticalContent = '# Critical Test\n\nThis is a critical and urgent matter.';
      
      const result = await markdownToMemoryEntries(filePath, criticalContent);
      
      // Check that importance was detected
      expect(result[0].importance).toBe(ImportanceLevel.CRITICAL);
    });
  });
  
  describe('loadAllMarkdownAsMemory', () => {
    it('should load and process multiple markdown files', async () => {
      const stats = await loadAllMarkdownAsMemory('data/knowledge');
      
      // Check that we processed the expected number of files
      expect(stats.filesProcessed).toBe(5); // Based on our mock
      
      // Check that memory.addMemory was called
      expect(memory.addMemory).toHaveBeenCalled();
    });
    
    it('should handle errors for individual files', async () => {
      // Mock one file to fail
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('Test error'));
      
      const stats = await loadAllMarkdownAsMemory('data/knowledge');
      
      // Check that we still processed the other files
      expect(stats.filesProcessed).toBe(5);
      expect(stats.entriesAdded).toBeGreaterThan(0);
    });
  });
}); 