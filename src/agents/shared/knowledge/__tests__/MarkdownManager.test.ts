/**
 * Tests for the MarkdownManager implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownManager, MarkdownLoadingStats } from '../MarkdownManager';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn()
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../../../utils/tagExtractor', () => ({
  extractTags: vi.fn().mockResolvedValue({
    success: true,
    tags: [
      { text: 'ai', score: 0.9 },
      { text: 'markdown', score: 0.8 },
      { text: 'knowledge', score: 0.7 }
    ]
  })
}));

// Mock memory service
const mockMemory = {
  addKnowledge: vi.fn().mockResolvedValue({ id: 'memory-id-123' }),
  removeKnowledge: vi.fn().mockResolvedValue(true)
};

describe('MarkdownManager', () => {
  let manager: MarkdownManager;
  let mockLogFunction: ReturnType<typeof vi.fn>;
  const testCachePath = path.join('test', 'markdown-cache.json');
  const testFlagPath = path.join('test', 'markdown-initialized.flag');
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogFunction = vi.fn();
    
    // Setup default mocks
    (fs.stat as any).mockResolvedValue({ mtimeMs: Date.now() });
    (fs.readdir as any).mockResolvedValue([
      { name: 'test.md', isFile: () => true, isDirectory: () => false },
      { name: 'subdir', isFile: () => false, isDirectory: () => true }
    ]);
    (fs.readFile as any).mockResolvedValue('# Test Content\n\nThis is test markdown content.');
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    
    manager = new MarkdownManager({
      memory: mockMemory as any,
      agentId: 'test-agent',
      department: 'test-department',
      logFunction: mockLogFunction,
      cacheFilePath: testCachePath,
      initFlagPath: testFlagPath
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('initialization', () => {
    it('should attempt to load cache on construction', () => {
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalledWith(testCachePath, 'utf-8');
    });
    
    it('should handle missing cache file gracefully', () => {
      (fs.readFile as any).mockRejectedValueOnce(new Error('File not found'));
      
      const newManager = new MarkdownManager({
        memory: mockMemory as any,
        agentId: 'test-agent',
        cacheFilePath: testCachePath
      });
      
      // Should continue without error
      expect(newManager).toBeDefined();
    });
  });
  
  describe('getDirectories', () => {
    it('should return default directories when no custom paths provided', () => {
      const dirs = manager.getDirectories();
      
      expect(dirs).toContain('data/knowledge/company');
      expect(dirs).toContain('data/knowledge/agents/test-agent');
      expect(dirs).toContain('data/knowledge/domains/test-department');
      expect(dirs.length).toBe(5); // 5 default directories
    });
    
    it('should return custom paths when provided', () => {
      const customPaths = ['custom/path1', 'custom/path2'];
      const customManager = new MarkdownManager({
        memory: mockMemory as any,
        agentId: 'test-agent',
        knowledgePaths: customPaths
      });
      
      const dirs = customManager.getDirectories();
      expect(dirs).toEqual(customPaths);
    });
  });
  
  describe('loadMarkdownFiles', () => {
    it('should skip loading if initialization flag exists', async () => {
      // Mock flag exists
      (fs.access as any).mockResolvedValueOnce(true);
      
      const stats = await manager.loadMarkdownFiles();
      
      expect(stats.filesLoaded).toBe(0);
      expect(mockLogFunction).toHaveBeenCalledWith('Markdown already initialized this session. Skipping ingestion.');
    });
    
    it('should process markdown files', async () => {
      // Mock flag doesn't exist
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      // Setup nested file discovery
      (fs.readdir as any)
        .mockResolvedValueOnce([
          { name: 'file1.md', isFile: () => true, isDirectory: () => false },
          { name: 'subdir', isFile: () => false, isDirectory: () => true }
        ])
        .mockResolvedValueOnce([
          { name: 'file2.md', isFile: () => true, isDirectory: () => false }
        ]);
      
      const stats = await manager.loadMarkdownFiles();
      
      expect(fs.readFile).toHaveBeenCalled();
      expect(mockMemory.addKnowledge).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(testFlagPath, expect.any(String));
      expect(stats.filesLoaded).toBeGreaterThan(0);
    });
    
    it('should skip unchanged files', async () => {
      // Mock flag doesn't exist
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      // Set up cache hit
      const filePath = path.join(process.cwd(), 'data/knowledge/company/file1.md');
      const lastModified = Date.now();
      
      (fs.stat as any).mockResolvedValue({ mtimeMs: lastModified });
      
      // Manually set up cache entry
      (manager as any).fileCache.set(filePath, { 
        lastModified, 
        memoryIds: ['existing-id'] 
      });
      
      const stats = await manager.loadMarkdownFiles();
      
      expect(stats.unchangedFiles).toBeGreaterThan(0);
      expect(mockMemory.addKnowledge).not.toHaveBeenCalled();
    });
    
    it('should force processing when force option is true', async () => {
      // Set up cache hit that would normally skip
      const filePath = path.join(process.cwd(), 'data/knowledge/company/file1.md');
      const lastModified = Date.now();
      
      (fs.stat as any).mockResolvedValue({ mtimeMs: lastModified });
      
      // Manually set up cache entry
      (manager as any).fileCache.set(filePath, { 
        lastModified, 
        memoryIds: ['existing-id'] 
      });
      
      const stats = await manager.loadMarkdownFiles({ force: true });
      
      // Should process despite cache hit due to force flag
      expect(mockMemory.addKnowledge).toHaveBeenCalled();
    });
    
    it('should handle errors during file processing', async () => {
      // Mock flag doesn't exist
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      // Make one file cause an error
      (fs.readFile as any).mockRejectedValueOnce(new Error('Test error'));
      
      const stats = await manager.loadMarkdownFiles();
      
      expect(stats.errors).toBeGreaterThan(0);
      expect(mockLogFunction).toHaveBeenCalledWith(
        expect.stringContaining('Error processing markdown file'),
        expect.any(Object)
      );
    });
  });
  
  describe('markdown parsing', () => {
    it('should split content into sections when requested', async () => {
      // Mock file with multiple h1 headers
      const contentWithSections = `# Section 1
      
      Content for section 1
      
      # Section 2
      
      Content for section 2
      
      # Section 3
      
      Content for section 3`;
      
      (fs.readFile as any).mockResolvedValueOnce(contentWithSections);
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      await manager.loadMarkdownFiles({
        parsingOptions: {
          splitSections: true
        }
      });
      
      // Should create multiple memories (one per section)
      expect(mockMemory.addKnowledge).toHaveBeenCalledTimes(3);
    });
    
    it('should include additional tags when provided', async () => {
      const additionalTags = ['custom-tag1', 'custom-tag2'];
      
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      await manager.loadMarkdownFiles({
        parsingOptions: {
          additionalTags
        }
      });
      
      // Check that all calls to addKnowledge included the additional tags
      for (const call of mockMemory.addKnowledge.mock.calls) {
        const tags = call[0].tags;
        expect(tags).toContain(additionalTags[0]);
        expect(tags).toContain(additionalTags[1]);
      }
    });
    
    it('should respect maxSectionLength', async () => {
      // Create a long string
      const longContent = 'A'.repeat(10000);
      const contentWithSections = `# Long Section\n\n${longContent}`;
      
      (fs.readFile as any).mockResolvedValueOnce(contentWithSections);
      (fs.access as any).mockRejectedValueOnce(new Error('No file'));
      
      await manager.loadMarkdownFiles({
        parsingOptions: {
          maxSectionLength: 5000
        }
      });
      
      // Verify the content was truncated
      const addKnowledgeCall = mockMemory.addKnowledge.mock.calls[0][0];
      expect(addKnowledgeCall.content.length).toBeLessThanOrEqual(5000);
    });
  });
  
  describe('file watching', () => {
    it('should start watching and setup event handlers', async () => {
      await manager.startWatching();
      
      expect(manager['isWatching']).toBe(true);
      expect(mockLogFunction).toHaveBeenCalledWith(
        'Started watching markdown files',
        expect.any(Object)
      );
    });
    
    it('should stop watching when requested', async () => {
      // Setup watching state
      manager['isWatching'] = true;
      manager['watcher'] = { close: vi.fn().mockResolvedValue(true) };
      
      await manager.stopWatching();
      
      expect(manager['isWatching']).toBe(false);
      expect(manager['watcher']).toBeNull();
      expect(mockLogFunction).toHaveBeenCalledWith('Stopped markdown file watcher');
    });
    
    it('should not attempt to stop when not watching', async () => {
      manager['isWatching'] = false;
      manager['watcher'] = null;
      
      await manager.stopWatching();
      
      expect(mockLogFunction).toHaveBeenCalledWith('Watcher is not running');
    });
  });
  
  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      // Setup some cache entries
      manager['fileCache'].set('test1', { lastModified: 123, memoryIds: ['id1'] });
      manager['fileCache'].set('test2', { lastModified: 456, memoryIds: ['id2'] });
      
      await manager.clearCache();
      
      expect(manager['fileCache'].size).toBe(0);
      expect(fs.unlink).toHaveBeenCalledWith(testFlagPath);
      expect(mockLogFunction).toHaveBeenCalledWith('Cleared markdown cache');
    });
  });
}); 