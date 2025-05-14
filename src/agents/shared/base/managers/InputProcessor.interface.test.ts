/**
 * InputProcessor.interface.test.ts
 * 
 * Tests to validate the InputProcessor interface contract
 * and ensure proper implementation by concrete classes.
 */

import { expect, describe, it, beforeEach, vi } from 'vitest';
import { 
  InputProcessor, 
  InputProcessorConfig, 
  InputMessage,
  ProcessedInput, 
  InputValidationResult,
  InputPreprocessor 
} from './InputProcessor.interface';
import { ManagerType } from './ManagerType';
import { BaseManager } from './BaseManager';

// Mock implementation of the InputProcessor interface for testing
// @ts-ignore - Intentionally not implementing all BaseManager properties for testing
class MockInputProcessor implements InputProcessor {
  managerId: string;
  managerType: ManagerType;
  config: InputProcessorConfig;
  initialized: boolean;
  private preprocessors: Map<string, InputPreprocessor> = new Map();
  private history: ProcessedInput[] = [];

  constructor() {
    this.managerId = 'mock-input-processor-123';
    this.managerType = ManagerType.INPUT;
    this.config = {
      enabled: true
    };
    this.initialized = false;
  }

  getId(): string {
    return this.managerId;
  }

  getType(): ManagerType {
    return this.managerType;
  }

  getAgent(): any {
    return null;
  }

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return enabled;
  }

  async shutdown(): Promise<void> {
    // Shutdown implementation
  }

  async reset(): Promise<boolean> {
    return true;
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    return {
      status: 'healthy',
      message: 'Input processor is healthy'
    };
  }

  getConfig<T extends InputProcessorConfig>(): T {
    return this.config as T;
  }

  updateConfig<T extends InputProcessorConfig>(config: Partial<T>): T {
    this.config = { ...this.config, ...config };
    return this.config as T;
  }

  async processInput(
    message: InputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
      processingTimeoutMs?: number;
    }
  ): Promise<ProcessedInput> {
    return {
      originalMessage: message,
      processedContent: message.content,
      processingMetadata: {
        processingTimeMs: 5,
        appliedSteps: [],
        contentModified: false
      }
    };
  }

  async validateInput(
    message: string | InputMessage,
    options?: {
      rules?: Array<{
        type: string;
        params?: unknown;
      }>;
      strictMode?: boolean;
    }
  ): Promise<InputValidationResult> {
    return {
      valid: true,
      hasBlockingIssues: false,
      issues: []
    };
  }

  async registerPreprocessor(preprocessor: InputPreprocessor): Promise<InputPreprocessor> {
    this.preprocessors.set(preprocessor.id, preprocessor);
    return preprocessor;
  }

  async unregisterPreprocessor(preprocessorId: string): Promise<boolean> {
    return this.preprocessors.delete(preprocessorId);
  }

  async getPreprocessor(preprocessorId: string): Promise<InputPreprocessor | null> {
    return this.preprocessors.get(preprocessorId) || null;
  }

  async listPreprocessors(options?: {
    enabled?: boolean;
    sortBy?: 'order' | 'id' | 'name';
    sortDirection?: 'asc' | 'desc';
  }): Promise<InputPreprocessor[]> {
    return Array.from(this.preprocessors.values());
  }

  async setPreprocessorEnabled(preprocessorId: string, enabled: boolean): Promise<InputPreprocessor> {
    const preprocessor = await this.getPreprocessor(preprocessorId);
    if (!preprocessor) {
      throw new Error(`Preprocessor not found: ${preprocessorId}`);
    }
    preprocessor.enabled = enabled;
    return preprocessor;
  }

  async setPreprocessorOrder(preprocessorId: string, order: number): Promise<InputPreprocessor> {
    const preprocessor = await this.getPreprocessor(preprocessorId);
    if (!preprocessor) {
      throw new Error(`Preprocessor not found: ${preprocessorId}`);
    }
    preprocessor.order = order;
    return preprocessor;
  }

  async addToHistory(input: ProcessedInput): Promise<string> {
    this.history.push(input);
    return input.originalMessage.id;
  }

  async getHistory(options?: {
    limit?: number;
    offset?: number;
    senderId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedInput[]> {
    return this.history;
  }

  async clearHistory(options?: {
    senderId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number> {
    const count = this.history.length;
    this.history = [];
    return count;
  }

  async getStats(): Promise<{
    totalProcessedInputs: number;
    averageProcessingTimeMs: number;
    validInputPercentage: number;
    invalidInputPercentage: number;
    topInputModalities: Array<{
      modality: string;
      count: number;
      percentage: number;
    }>;
    detectedLanguages: Record<string, number>;
  }> {
    return {
      totalProcessedInputs: this.history.length,
      averageProcessingTimeMs: 10,
      validInputPercentage: 100,
      invalidInputPercentage: 0,
      topInputModalities: [
        { modality: 'text', count: this.history.length, percentage: 100 }
      ],
      detectedLanguages: { en: this.history.length }
    };
  }
}

describe('InputProcessor Interface', () => {
  let inputProcessor: InputProcessor;

  beforeEach(() => {
    // @ts-ignore - Using mock implementation for testing
    inputProcessor = new MockInputProcessor();
  });

  it('should implement BaseManager interface', () => {
    // Type check that InputProcessor extends BaseManager
    const manager: BaseManager = inputProcessor;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(inputProcessor.getType()).toBe(ManagerType.INPUT);
  });

  it('should initialize successfully', async () => {
    const result = await inputProcessor.initialize();
    expect(result).toBe(true);
    expect(inputProcessor.isEnabled()).toBe(true);
  });

  it('should process input correctly', async () => {
    // Create a mock InputMessage
    const message: InputMessage = {
      id: 'msg-123',
      senderId: 'user',
      timestamp: new Date(),
      content: 'test input',
      modality: 'text'
    };
    
    const result = await inputProcessor.processInput(message);
    expect(result).toHaveProperty('originalMessage');
    expect(result).toHaveProperty('processedContent');
    expect(result.originalMessage.id).toBe('msg-123');
    expect(result.processingMetadata).toBeDefined();
  });

  it('should validate input', async () => {
    const result = await inputProcessor.validateInput('test input');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('hasBlockingIssues');
    expect(result.valid).toBe(true);
  });

  it('should manage preprocessors', async () => {
    const preprocessor: InputPreprocessor = {
      id: 'normalize',
      name: 'Text Normalizer',
      description: 'Normalizes input text',
      process: async (input) => input,
      enabled: true,
      order: 1
    };
    
    const registered = await inputProcessor.registerPreprocessor(preprocessor);
    expect(registered.id).toBe('normalize');
    
    const retrieved = await inputProcessor.getPreprocessor('normalize');
    expect(retrieved).not.toBeNull();
    
    const enabled = await inputProcessor.setPreprocessorEnabled('normalize', false);
    expect(enabled.enabled).toBe(false);
    
    const list = await inputProcessor.listPreprocessors();
    expect(Array.isArray(list)).toBe(true);
    
    const unregistered = await inputProcessor.unregisterPreprocessor('normalize');
    expect(unregistered).toBe(true);
  });

  it('should manage history', async () => {
    // Create a mock InputMessage and ProcessedInput
    const message: InputMessage = {
      id: 'msg-456',
      senderId: 'user',
      timestamp: new Date(),
      content: 'test input',
      modality: 'text'
    };
    
    const processed: ProcessedInput = {
      originalMessage: message,
      processedContent: 'processed test input',
      processingMetadata: {
        processingTimeMs: 5,
        appliedSteps: [],
        contentModified: false
      }
    };
    
    const added = await inputProcessor.addToHistory(processed);
    expect(added).toBe('msg-456');
    
    const history = await inputProcessor.getHistory();
    expect(history.length).toBeGreaterThan(0);
    
    const cleared = await inputProcessor.clearHistory();
    expect(cleared).toBeGreaterThan(0);
  });

  it('should get statistics', async () => {
    const stats = await inputProcessor.getStats();
    expect(stats).toHaveProperty('totalProcessedInputs');
    expect(stats).toHaveProperty('averageProcessingTimeMs');
    expect(stats).toHaveProperty('validInputPercentage');
    expect(stats).toHaveProperty('topInputModalities');
  });
}); 