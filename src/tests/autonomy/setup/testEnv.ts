/**
 * Test Environment Setup
 * 
 * This file sets up the test environment with necessary configurations and
 * mock external services to enable testing the DefaultAgent with real functionality.
 */

import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Fallback mock values for required environment variables
const DEFAULT_TEST_ENV = {
  // API Keys (mock values)
  OPENAI_API_KEY: 'sk-test-mockOpenAIKey1234567890',
  ANTHROPIC_API_KEY: 'sk-ant-api-mockAnthropicKey1234567890',
  
  // Data storage
  MEMORY_STORAGE_TYPE: 'memory', // Use in-memory storage for tests
  
  // Test control flags
  TEST_MODE: 'true',
  DISABLE_EXTERNAL_APIS: 'true',
  LOG_LEVEL: 'info',
  
  // Test-specific settings
  TEST_OUTPUT_DIR: path.join(process.cwd(), 'test-output'),
};

/**
 * Sets up the test environment with required environment variables
 * and creates necessary test directories
 */
export function setupTestEnvironment() {
  // Backup current environment
  const originalEnv = { ...process.env };
  
  // Set environment variables for testing
  Object.entries(DEFAULT_TEST_ENV).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
  
  // Create test output directory if it doesn't exist
  if (!fs.existsSync(DEFAULT_TEST_ENV.TEST_OUTPUT_DIR)) {
    fs.mkdirSync(DEFAULT_TEST_ENV.TEST_OUTPUT_DIR, { recursive: true });
  }
  
  // Return a cleanup function
  return () => {
    // Restore original environment
    process.env = originalEnv;
  };
}

/**
 * Creates a test file with specified content in the test output directory
 */
export function createTestFile(fileName: string, content: string) {
  const filePath = path.join(DEFAULT_TEST_ENV.TEST_OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Gets a unique test identifier for test runs
 */
export function getTestId() {
  return `test-${randomUUID().substring(0, 8)}`;
}

/**
 * Mock implementation that simulates an actual LLM response based on input
 */
export function getMockLLMResponse(input: string) {
  // Implement deterministic "smart" responses based on input patterns
  if (input.includes('markdown') && input.includes('AI research')) {
    return {
      content: "I've created a markdown file with 5 AI research topics:\n\n1. Explainable AI (XAI)\n2. Federated Learning\n3. AI Ethics and Bias Mitigation\n4. Neural Architecture Search\n5. Multi-modal Learning",
      role: "assistant"
    };
  }
  
  if (input.includes('reminder') || input.includes('schedule')) {
    return {
      content: "I've set a reminder for you as requested. It's scheduled and you'll be notified at the specified time.",
      role: "assistant"
    };
  }
  
  if (input.includes('news') || input.includes('article')) {
    return {
      content: "According to recent news from AI Magazine, researchers have developed a new approach to transformer efficiency that reduces computation by 30% while maintaining accuracy. The technique involves sparse attention mechanisms that dynamically adjust based on input complexity.",
      role: "assistant"
    };
  }
  
  if (input.includes('capital') && input.includes('France')) {
    return {
      content: "The capital of France is Paris.",
      role: "assistant"
    };
  }
  
  // Generic response for other inputs
  return {
    content: "I'll help you with that request. Please let me know if you need anything specific.",
    role: "assistant"
  };
}

/**
 * Setup OpenAI and related LLM service mocks
 */
export function setupLLMMocks() {
  // Mock OpenAI
  vi.mock('openai', () => {
    return {
      default: class MockOpenAI {
        constructor() {}
        chat = {
          completions: {
            create: vi.fn(({ messages }) => {
              const lastMessage = messages[messages.length - 1].content;
              const response = getMockLLMResponse(lastMessage);
              
              return Promise.resolve({
                choices: [
                  {
                    message: response,
                    finish_reason: 'stop'
                  }
                ]
              });
            })
          }
        }
      },
      OpenAI: class MockOpenAI {
        constructor() {}
        chat = {
          completions: {
            create: vi.fn(({ messages }) => {
              const lastMessage = messages[messages.length - 1].content;
              const response = getMockLLMResponse(lastMessage);
              
              return Promise.resolve({
                choices: [
                  {
                    message: response,
                    finish_reason: 'stop'
                  }
                ]
              });
            })
          }
        }
      }
    };
  });
  
  // Mock ChatOpenAI from langchain
  vi.mock('@langchain/openai', () => {
    return {
      ChatOpenAI: class MockChatOpenAI {
        constructor() {}
        invoke(messages: any) {
          const lastMessage = Array.isArray(messages) 
            ? messages[messages.length - 1].content
            : messages.content || '';
            
          const response = getMockLLMResponse(lastMessage);
          return Promise.resolve(response);
        }
      }
    };
  });
  
  // Mock createChatOpenAI from local llm module
  vi.mock('../../../lib/core/llm', () => {
    return {
      createChatOpenAI: () => ({
        invoke(messages: any) {
          const lastMessage = Array.isArray(messages) 
            ? messages[messages.length - 1].content
            : messages.content || '';
            
          const response = getMockLLMResponse(lastMessage);
          return Promise.resolve(response);
        }
      })
    };
  });
  
  // Mock the tag extractor
  vi.mock('../../../utils/tagExtractor', () => {
    return {
      tagExtractor: {
        extractTags: vi.fn((text) => {
          // Simple mock tag extraction based on text content
          const tags = [];
          
          if (text.includes('AI')) tags.push({ text: 'AI', type: 'topic' });
          if (text.includes('research')) tags.push({ text: 'research', type: 'activity' });
          if (text.includes('reminder')) tags.push({ text: 'reminder', type: 'task' });
          if (text.includes('schedule')) tags.push({ text: 'schedule', type: 'task' });
          if (text.includes('France')) tags.push({ text: 'France', type: 'location' });
          if (text.includes('Paris')) tags.push({ text: 'Paris', type: 'location' });
          
          return Promise.resolve({
            tags,
            success: true
          });
        })
      }
    };
  });
}

/**
 * Setup mocks for file system operations to avoid actual file creation
 */
export function setupFilesystemMocks() {
  // Create a virtual file system for tests
  const virtualFileSystem = new Map<string, string>();
  
  // Mock fs module for file operations
  vi.mock('fs', async () => {
    const actual = await vi.importActual('fs') as typeof fs;
    
    return {
      ...actual,
      writeFileSync: vi.fn((filePath: string, content: string) => {
        virtualFileSystem.set(filePath.toString(), content.toString());
        return true;
      }),
      readFileSync: vi.fn((filePath: string) => {
        if (virtualFileSystem.has(filePath.toString())) {
          return virtualFileSystem.get(filePath.toString());
        }
        // Fall back to actual filesystem for files that should exist
        return actual.readFileSync(filePath);
      }),
      existsSync: vi.fn((filePath: string) => {
        if (virtualFileSystem.has(filePath.toString())) {
          return true;
        }
        // Fall back to actual filesystem for files that should exist
        return actual.existsSync(filePath);
      })
    };
  });
  
  // Return functions to interact with the virtual filesystem
  return {
    getVirtualFilesystem: () => virtualFileSystem,
    addVirtualFile: (filePath: string, content: string) => {
      virtualFileSystem.set(filePath, content);
    },
    getVirtualFile: (filePath: string) => virtualFileSystem.get(filePath),
    clearVirtualFilesystem: () => virtualFileSystem.clear()
  };
}

/**
 * Initialize the entire test environment
 */
export function initTestEnvironment() {
  // Set up environment variables
  const cleanupEnv = setupTestEnvironment();
  
  // Set up LLM mocks
  setupLLMMocks();
  
  // Set up filesystem mocks
  const filesystemUtils = setupFilesystemMocks();
  
  // Return cleanup function and utilities
  return {
    cleanup: () => {
      cleanupEnv();
      vi.restoreAllMocks();
    },
    ...filesystemUtils,
    testId: getTestId()
  };
} 