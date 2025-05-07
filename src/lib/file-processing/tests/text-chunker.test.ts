/**
 * Tests for the TextChunker service
 */

import { describe, it, expect } from 'vitest';
import { TextChunker, SmartTextChunker, TextChunkerErrorCode } from '../services/text-chunker';
import { AppError } from '../../../lib/errors/base';

describe('TextChunker', () => {
  const chunker = new TextChunker();
  
  it('should return an empty array for empty text', () => {
    const result = chunker.chunkText('', 100, 20);
    expect(result).toEqual([]);
  });
  
  it('should throw error for invalid chunk size', () => {
    expect(() => chunker.chunkText('Sample text', 0, 20))
      .toThrow(AppError);
    
    expect(() => chunker.chunkText('Sample text', -10, 20))
      .toThrow(AppError);
    
    try {
      chunker.chunkText('Sample text', -10, 20);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(TextChunkerErrorCode.INVALID_INPUT);
    }
  });
  
  it('should throw error for invalid overlap size', () => {
    expect(() => chunker.chunkText('Sample text', 100, -10))
      .toThrow(AppError);
    
    try {
      chunker.chunkText('Sample text', 100, -10);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(TextChunkerErrorCode.INVALID_INPUT);
    }
  });
  
  it('should return a single chunk if text is smaller than chunk size', () => {
    const text = 'This is a small text';
    const result = chunker.chunkText(text, 100, 20);
    expect(result).toEqual([text]);
  });
  
  it('should split text into chunks with proper overlap', () => {
    const text = 'This is a longer text that should be split into multiple chunks with overlap between them.';
    const chunkSize = 20;
    const overlapSize = 5;
    
    const result = chunker.chunkText(text, chunkSize, overlapSize);
    
    expect(result.length).toBeGreaterThan(1);
    
    // Verify first chunk
    expect(result[0].length).toBeLessThanOrEqual(chunkSize);
    expect(result[0]).toBe('This is a longer te');
    
    // Verify second chunk starts with overlap from first chunk
    expect(result[1].startsWith(result[0].substring(result[0].length - overlapSize))).toBe(true);
    
    // Verify all chunks have proper sizes
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(chunkSize);
    }
    
    // Verify the concatenated content has all the text
    let reconstructed = result[0];
    for (let i = 1; i < result.length; i++) {
      reconstructed += result[i].substring(overlapSize);
    }
    expect(reconstructed.length).toBeGreaterThanOrEqual(text.length);
  });
  
  it('should handle extreme overlap values', () => {
    const text = 'This is a sample text to test extreme overlap values';
    
    // Overlap larger than chunk size
    const result = chunker.chunkText(text, 10, 15);
    expect(result.length).toBeGreaterThan(1);
    
    // Verify all text is included
    let content = '';
    result.forEach(chunk => {
      content += chunk;
    });
    expect(content.includes(text)).toBe(true);
  });
});

describe('SmartTextChunker', () => {
  const chunker = new SmartTextChunker();
  
  it('should split text at paragraph boundaries when possible', () => {
    const text = 'This is the first paragraph.\n\nThis is the second paragraph.\n\nThis is the third paragraph.';
    const result = chunker.chunkText(text, 50, 10);
    
    expect(result.length).toBe(3);
    expect(result[0]).toBe('This is the first paragraph.\n\n');
    expect(result[1]).toBe('This is the second paragraph.\n\n');
    expect(result[2]).toBe('This is the third paragraph.');
  });
  
  it('should split text at sentence boundaries when no paragraph breaks are available', () => {
    const text = 'This is the first sentence. This is the second sentence. This is the third sentence.';
    const result = chunker.chunkText(text, 40, 5);
    
    expect(result.length).toBeGreaterThan(1);
    
    // Check if splits occur at sentence boundaries
    expect(result[0].endsWith('.')).toBe(true);
    
    // Reconstruct text to ensure all content is preserved
    const reconstructed = result.join('');
    expect(reconstructed).toContain(text);
  });
  
  it('should inherit behavior from base TextChunker for edge cases', () => {
    // Empty text
    expect(chunker.chunkText('', 100, 20)).toEqual([]);
    
    // Text smaller than chunk size
    const text = 'Small text';
    expect(chunker.chunkText(text, 100, 20)).toEqual([text]);
    
    // Invalid inputs
    expect(() => chunker.chunkText('Sample text', 0, 20)).toThrow(AppError);
    expect(() => chunker.chunkText('Sample text', 100, -10)).toThrow(AppError);
  });
}); 