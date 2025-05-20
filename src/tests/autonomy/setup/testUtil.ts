/**
 * Test Utilities for Autonomy Testing
 * 
 * Simple mocks and utilities for autonomy testing with Vitest
 */

import { vi } from 'vitest';

/**
 * Mocks OpenAI dependency for testing
 */
export function mockOpenAI() {
  return vi.mock('openai', () => {
    const MockOpenAI = vi.fn(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: "This is a mock response from OpenAI. Paris is the capital of France.",
                  role: 'assistant'
                },
                finish_reason: 'stop'
              }
            ]
          })
        }
      }
    }));
    
    return {
      OpenAI: MockOpenAI
    };
  });
}

/**
 * Mocks basic tag extractor functionality
 */
export function mockTagExtractor() {
  return vi.mock('../../utils/tagExtractor', () => ({
    tagExtractor: {
      extractTags: vi.fn().mockResolvedValue({
        tags: [
          { text: 'AI', type: 'topic' },
          { text: 'Paris', type: 'location' }
        ],
        success: true
      })
    }
  }));
}

/**
 * Set environment variables for testing
 */
export function setTestEnv() {
  process.env.OPENAI_API_KEY = 'sk-test-12345';
  process.env.TEST_MODE = 'true';
  
  return () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.TEST_MODE;
  };
}

/**
 * Setup basic test mocks
 */
export function setupBasicMocks() {
  const cleanupEnv = setTestEnv();
  mockOpenAI();
  mockTagExtractor();
  
  return () => {
    cleanupEnv();
    vi.restoreAllMocks();
  };
} 