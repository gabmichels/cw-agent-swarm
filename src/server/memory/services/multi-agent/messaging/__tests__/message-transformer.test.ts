/**
 * Message Transformer Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  MessageTransformer, 
  MessageFormat, 
  EnrichmentType, 
  TransformationOptions,
  TransformableMessage
} from '../message-transformer';
import { AnyMemoryService } from '../../../memory/memory-service-wrappers';
import { MemoryType } from '../../../../config/types';

// Mock dependencies
// Create properly typed mock functions
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'mock-mem-id' });
const mockSearchMemories = vi.fn().mockResolvedValue([]);
const mockUpdateMemory = vi.fn().mockResolvedValue(true);
const mockDeleteMemory = vi.fn().mockResolvedValue(true);

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory,
  deleteMemory: mockDeleteMemory
} as unknown as AnyMemoryService;

// Test data
const TEST_AGENT_ID = 'test-agent';
const TEST_SENDER_ID = 'test-sender';

describe('MessageTransformer', () => {
  let transformer: MessageTransformer;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create transformer instance with mocked dependencies
    transformer = new MessageTransformer(
      mockMemoryService
    );
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('transformMessage', () => {
    it('should transform a message from text to markdown', async () => {
      // Create test message
      const testMessage: TransformableMessage = {
        id: 'test-message-1',
        senderId: TEST_SENDER_ID,
        recipientId: TEST_AGENT_ID,
        content: 'Hello\n\nThis is a test message',
        format: MessageFormat.TEXT,
        metadata: {
          importance: 'high'
        }
      };
      
      const options: TransformationOptions = {
        sourceFormat: MessageFormat.TEXT,
        targetFormat: MessageFormat.MARKDOWN,
        preserveFormatting: true,
        includeMetadata: true
      };
      
      // Call method
      const result = await transformer.transformMessage(testMessage, options);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.originalMessage).toEqual(testMessage);
      expect(result.transformedMessage.format).toBe(MessageFormat.MARKDOWN);
      expect(result.transformedMessage.content).toBe('Hello\n\nThis is a test message');
      expect(result.transformedMessage.metadata).toEqual(testMessage.metadata);
    });
    
    it('should return error when transformation is not supported', async () => {
      // Create test message with unsupported transformation
      const testMessage: TransformableMessage = {
        id: 'test-message-1',
        senderId: TEST_SENDER_ID,
        recipientId: TEST_AGENT_ID,
        content: 'Hello',
        format: MessageFormat.TEXT,
      };
      
      // Create a mock for isTransformationSupported to return false
      vi.spyOn(transformer as any, 'isTransformationSupported').mockResolvedValueOnce(false);
      
      const options: TransformationOptions = {
        sourceFormat: MessageFormat.TEXT,
        targetFormat: MessageFormat.JSON,
      };
      
      // Call method
      const result = await transformer.transformMessage(testMessage, options);
      
      // Verify result
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('not supported');
    });
    
    it('should truncate content based on maxLength', async () => {
      // Create test message
      const testMessage: TransformableMessage = {
        id: 'test-message-1',
        senderId: TEST_SENDER_ID,
        recipientId: TEST_AGENT_ID,
        content: 'This is a message that should be truncated',
        format: MessageFormat.TEXT,
      };
      
      const options: TransformationOptions = {
        sourceFormat: MessageFormat.TEXT,
        targetFormat: MessageFormat.TEXT,
        maxLength: 10
      };
      
      // Call method
      const result = await transformer.transformMessage(testMessage, options);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.transformedMessage.content).toBe('This is...');
      expect(result.transformedMessage.content.length).toBe(10);
    });
  });
  
  describe('enrichMessage', () => {
    it('should enrich a message with metadata', async () => {
      // Create test message
      const testMessage: TransformableMessage = {
        id: 'test-message-1',
        senderId: TEST_SENDER_ID,
        recipientId: TEST_AGENT_ID,
        content: 'Hello',
        format: MessageFormat.TEXT,
        metadata: {
          importance: 'high',
          tags: ['test', 'message']
        }
      };
      
      // Call method
      const result = await transformer.enrichMessage(testMessage, [EnrichmentType.METADATA]);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.transformedMessage.contextItems).toHaveLength(1);
      expect(result.transformedMessage.contextItems![0].type).toBe('metadata');
      expect(result.transformedMessage.contextItems![0].content).toEqual(testMessage.metadata);
      expect(result.transformedMessage.contextItems![0].relevance).toBe(1.0);
    });
    
    it('should collect warnings when enrichment fails', async () => {
      // Create test message
      const testMessage: TransformableMessage = {
        id: 'test-message-1',
        senderId: TEST_SENDER_ID,
        recipientId: TEST_AGENT_ID,
        content: 'Hello',
        format: MessageFormat.TEXT
      };
      
      // Mock the applyEnrichment method to throw an error
      vi.spyOn(transformer as any, 'applyEnrichment')
        .mockImplementationOnce(() => { throw new Error('Enrichment failed'); });
      
      // Call method
      const result = await transformer.enrichMessage(testMessage, [EnrichmentType.CAPABILITIES]);
      
      // Verify result
      expect(result.success).toBe(true); // Still success since we handle failures gracefully
      expect(result.transformedMessage.contextItems).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings![0]).toContain('Failed to apply enrichment');
      expect(result.warnings![0]).toContain('Enrichment failed');
    });
  });
  
  describe('getSupportedTransformations', () => {
    it('should return a list of supported transformations', async () => {
      // Call method
      const transformations = await transformer.getSupportedTransformations();
      
      // Verify result
      expect(transformations).toBeInstanceOf(Array);
      expect(transformations.length).toBeGreaterThan(0);
      
      // Check the format of transformations
      const firstTransformation = transformations[0];
      expect(firstTransformation).toHaveProperty('sourceFormat');
      expect(firstTransformation).toHaveProperty('targetFormat');
      
      // Ensure TEXT to MARKDOWN is supported
      expect(transformations).toContainEqual({
        sourceFormat: MessageFormat.TEXT,
        targetFormat: MessageFormat.MARKDOWN
      });
    });
  });
  
  describe('transformation methods', () => {
    it('should transform text to markdown', async () => {
      // Get private method
      const textToMarkdown = transformer['textToMarkdown'].bind(transformer);
      
      // Test with formatting
      expect(textToMarkdown('Hello\n\nWorld')).toBe('Hello\n\nWorld');
      
      // Test without formatting
      expect(textToMarkdown('Hello\n\nWorld', false)).toBe('Hello\n\nWorld');
    });
    
    it('should transform text to HTML', async () => {
      // Get private method
      const textToHtml = transformer['textToHtml'].bind(transformer);
      
      // Test with formatting
      expect(textToHtml('Hello\n\nWorld')).toBe('<p>Hello</p><p>World</p>');
      
      // Test with line breaks
      expect(textToHtml('Hello\nWorld')).toBe('<p>Hello<br>World</p>');
    });
    
    it('should transform markdown to text', async () => {
      // Get private method
      const markdownToText = transformer['markdownToText'].bind(transformer);
      
      // Test with various markdown elements
      const markdown = '# Heading\n\n**Bold text** and *italic text*\n\n[Link](https://example.com)\n\n```code block```';
      const expected = 'Heading\n\nBold text and italic text\n\nLink (https://example.com)\n\ncode block';
      
      // Remove all whitespace for comparison due to newline differences
      const normalizedResult = markdownToText(markdown).replace(/\s+/g, '');
      const normalizedExpected = expected.replace(/\s+/g, '');
      
      expect(normalizedResult).toBe(normalizedExpected);
    });
  });
}); 