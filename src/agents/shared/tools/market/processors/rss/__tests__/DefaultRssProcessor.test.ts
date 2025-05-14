/**
 * DefaultRssProcessor.test.ts - Tests for the DefaultRssProcessor
 * 
 * This file contains tests for the DefaultRssProcessor class which processes
 * RSS feeds to extract market signals.
 */

import { DefaultRssProcessor, RssProcessorError } from '../DefaultRssProcessor';
import { MarketSignal } from '../../../MarketScanner.interface';
import { RssSource } from '../../../interfaces/MarketSource.interface';

// Mock the external dependencies
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn(),
  }));
});

jest.mock('../../../../../../../lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the global fetch function
global.fetch = jest.fn();

describe('DefaultRssProcessor', () => {
  let processor: DefaultRssProcessor;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    processor = new DefaultRssProcessor();
  });
  
  describe('testFeed', () => {
    it('should return true for valid RSS feed', async () => {
      // Mock the fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/xml'),
        },
      });
      
      const result = await processor.testFeed('https://example.com/feed.xml');
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/feed.xml', expect.any(Object));
    });
    
    it('should return false for invalid response', async () => {
      // Mock a failed fetch response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      
      const result = await processor.testFeed('https://example.com/nonexistent.xml');
      
      expect(result).toBe(false);
    });
    
    it('should return false on network error', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await processor.testFeed('https://example.com/error.xml');
      
      expect(result).toBe(false);
    });
  });
  
  describe('processSource', () => {
    it('should process a valid RSS source', async () => {
      // Mock the testFeed method
      jest.spyOn(processor, 'testFeed').mockResolvedValueOnce(true);
      
      // Mock the parser.parseURL method - using the imported mock
      const mockFeed = {
        title: 'Test Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'Test Item 1',
            description: 'Test Description 1',
            link: 'https://example.com/item1',
            pubDate: '2023-01-01T12:00:00Z',
          },
          {
            title: 'Test Item 2',
            description: 'Test Description 2',
            link: 'https://example.com/item2',
            pubDate: '2023-01-02T12:00:00Z',
          },
        ],
      };
      
      // Setup the mock parser within the RssParser mock
      const mockRssParser = require('rss-parser');
      const mockParseURL = jest.fn().mockResolvedValueOnce(mockFeed);
      mockRssParser.mockImplementation(() => ({
        parseURL: mockParseURL,
      }));
      
      // Mock the processFeedContent method
      const mockSignals: MarketSignal[] = [
        {
          title: 'Test Item 1',
          content: 'Test Description 1',
          source: 'Test Feed',
          sourceType: 'rss',
          category: 'test',
          theme: 'technology',
          url: 'https://example.com/item1',
          published: new Date('2023-01-01T12:00:00Z'),
          retrieved: expect.any(Date),
        },
      ];
      
      jest.spyOn(processor, 'processFeedContent').mockResolvedValueOnce(mockSignals);
      
      const source: RssSource = {
        id: 'test-source',
        type: 'rss',
        url: 'https://example.com/feed.xml',
        category: 'test',
        theme: 'technology',
        refresh_interval: 24,
      };
      
      const result = await processor.processSource(source);
      
      expect(result).toEqual(mockSignals);
      expect(processor.testFeed).toHaveBeenCalledWith('https://example.com/feed.xml');
      expect(mockParseURL).toHaveBeenCalledWith('https://example.com/feed.xml');
      expect(processor.processFeedContent).toHaveBeenCalledWith(mockFeed, source);
    });
    
    it('should throw error for invalid RSS feed', async () => {
      // Mock the testFeed method to return false
      jest.spyOn(processor, 'testFeed').mockResolvedValueOnce(false);
      
      const source: RssSource = {
        id: 'invalid-source',
        type: 'rss',
        url: 'https://example.com/invalid.xml',
        category: 'test',
        theme: 'technology',
        refresh_interval: 24,
      };
      
      await expect(processor.processSource(source)).rejects.toThrow(RssProcessorError);
    });
    
    it('should handle parser errors gracefully', async () => {
      // Mock the testFeed method to return true
      jest.spyOn(processor, 'testFeed').mockResolvedValueOnce(true);
      
      // Setup the mock parser to throw an error
      const mockRssParser = require('rss-parser');
      mockRssParser.mockImplementation(() => ({
        parseURL: jest.fn().mockRejectedValueOnce(new Error('Parse error')),
      }));
      
      const source: RssSource = {
        id: 'error-source',
        type: 'rss',
        url: 'https://example.com/error.xml',
        category: 'test',
        theme: 'technology',
        refresh_interval: 24,
      };
      
      await expect(processor.processSource(source)).rejects.toThrow(RssProcessorError);
    });
  });
  
  // Test the cleanContent method by inspecting the processed content
  describe('cleanContent behavior', () => {
    it('should clean HTML content', async () => {
      // Create test feed with HTML content
      const mockFeed = {
        title: 'Test Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'HTML Test',
            description: '<p>This is <strong>HTML</strong> content with <a href="#">links</a>.</p>',
            link: 'https://example.com/html',
            pubDate: '2023-01-01T12:00:00Z',
          }
        ],
      };
      
      // Set up the RSS parser mock
      const mockRssParser = require('rss-parser');
      mockRssParser.mockImplementation(() => ({
        parseURL: jest.fn().mockResolvedValueOnce(mockFeed),
      }));
      
      // Make sure testFeed returns true
      jest.spyOn(processor, 'testFeed').mockResolvedValueOnce(true);
      
      // Don't mock processFeedContent to test actual implementation
      const processFeedContentSpy = jest.spyOn(processor, 'processFeedContent');
      
      const source: RssSource = {
        id: 'html-test',
        type: 'rss',
        url: 'https://example.com/feed.xml',
        category: 'test',
        theme: 'technology',
        refresh_interval: 24,
      };
      
      const result = await processor.processSource(source);
      
      // Verify the HTML was cleaned properly
      expect(result[0].content).toBe('This is HTML content with links .');
      expect(processFeedContentSpy).toHaveBeenCalled();
    });
    
    it('should truncate long content', async () => {
      // Create test feed with long content
      const longContent = 'A'.repeat(3000);
      const mockFeed = {
        title: 'Test Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'Long Content Test',
            description: longContent,
            link: 'https://example.com/long',
            pubDate: '2023-01-01T12:00:00Z',
          }
        ],
      };
      
      // Set up the RSS parser mock
      const mockRssParser = require('rss-parser');
      mockRssParser.mockImplementation(() => ({
        parseURL: jest.fn().mockResolvedValueOnce(mockFeed),
      }));
      
      // Make sure testFeed returns true
      jest.spyOn(processor, 'testFeed').mockResolvedValueOnce(true);
      
      const source: RssSource = {
        id: 'long-test',
        type: 'rss',
        url: 'https://example.com/feed.xml',
        category: 'test',
        theme: 'technology',
        refresh_interval: 24,
      };
      
      const result = await processor.processSource(source);
      
      // Verify the content was truncated
      expect(result[0].content.length).toBeLessThan(2100);
      expect(result[0].content.endsWith('...')).toBe(true);
    });
  });
}); 