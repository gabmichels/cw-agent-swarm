/**
 * OutputProcessor.interface.test.ts
 * 
 * Tests to validate the OutputProcessor interface contract
 * and ensure proper implementation by concrete classes.
 */

import { describe, it, expect } from 'vitest';
import { 
  OutputProcessor, 
  OutputProcessorConfig, 
  OutputMessage, 
  ProcessedOutput,
  OutputProcessorStep,
  OutputTemplate,
  OutputValidationResult
} from './OutputProcessor.interface';
import { ManagerType } from './ManagerType';
import { BaseManager } from './BaseManager';

// Mock implementation of the OutputProcessor interface for testing
// @ts-ignore - Intentionally not implementing all BaseManager properties for testing
class MockOutputProcessor implements OutputProcessor {
  managerId: string;
  managerType: ManagerType;
  config: OutputProcessorConfig;
  initialized: boolean;
  private history: ProcessedOutput[] = [];
  private templates: Map<string, OutputTemplate> = new Map();
  private processorSteps: Map<string, OutputProcessorStep> = new Map();

  constructor() {
    this.managerId = 'mock-output-processor-123';
    this.managerType = ManagerType.OUTPUT;
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
    return true;
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
      message: 'Output processor is healthy'
    };
  }

  getConfig<T extends OutputProcessorConfig>(): T {
    return this.config as T;
  }

  updateConfig<T extends OutputProcessorConfig>(config: Partial<T>): T {
    this.config = { ...this.config, ...config };
    return this.config as T;
  }

  async processOutput(
    message: OutputMessage,
    options?: {
      skipSteps?: string[];
      additionalContext?: unknown;
      targetFormat?: string;
    }
  ): Promise<ProcessedOutput> {
    return {
      originalMessage: message,
      processedContent: message.content,
      wasModified: false,
      appliedProcessingSteps: [],
      processingMetadata: {
        processingTimeMs: 0
      }
    };
  }

  async registerProcessorStep(step: OutputProcessorStep): Promise<OutputProcessorStep> {
    this.processorSteps.set(step.id, step);
    return step;
  }

  async unregisterProcessorStep(stepId: string): Promise<boolean> {
    return this.processorSteps.delete(stepId);
  }

  async getProcessorStep(stepId: string): Promise<OutputProcessorStep | null> {
    return this.processorSteps.get(stepId) || null;
  }

  async listProcessorSteps(options?: {
    enabled?: boolean;
    category?: string;
    sortBy?: 'order' | 'id' | 'name' | 'category';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputProcessorStep[]> {
    return Array.from(this.processorSteps.values());
  }

  async createOutputMessage(
    content: string,
    recipientId: string,
    options?: {
      modality?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
      context?: Record<string, unknown>;
      attachments?: Array<{
        type: string;
        data: unknown;
      }>;
      tags?: string[];
    }
  ): Promise<OutputMessage> {
    return {
      id: 'msg-123',
      recipientId,
      timestamp: new Date(),
      content,
      modality: options?.modality || 'text'
    };
  }

  async setProcessorStepEnabled(stepId: string, enabled: boolean): Promise<OutputProcessorStep> {
    const step = this.processorSteps.get(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }
    step.enabled = enabled;
    return step;
  }

  async setProcessorStepOrder(stepId: string, order: number): Promise<OutputProcessorStep> {
    const step = this.processorSteps.get(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }
    step.order = order;
    return step;
  }

  async validateOutput(
    content: string,
    format: OutputMessage['modality'],
    options?: {
      strictMode?: boolean;
      customRules?: Array<{
        type: string;
        params?: unknown;
      }>;
    }
  ): Promise<OutputValidationResult> {
    return {
      valid: true,
      hasBlockingIssues: false,
      issues: []
    };
  }

  async addToHistory(output: ProcessedOutput): Promise<string> {
    this.history.push(output);
    return output.originalMessage.id;
  }

  async getHistory(options?: {
    limit?: number;
    offset?: number;
    recipientId?: string;
    fromDate?: Date;
    toDate?: Date;
    conversationId?: string;
  }): Promise<ProcessedOutput[]> {
    return this.history;
  }

  async clearHistory(options?: {
    recipientId?: string;
    olderThan?: Date;
    conversationId?: string;
  }): Promise<number> {
    const oldLength = this.history.length;
    this.history = [];
    return oldLength;
  }

  async formatContent(
    content: string,
    format: "text" | "markdown" | "html" | "json" | "image" | "audio" | "structured",
    options?: Record<string, unknown>
  ): Promise<string> {
    return content;
  }

  async generateFromTemplate(
    templateId: string,
    variables: Record<string, unknown>,
    options?: {
      fallbackTemplateId?: string;
      format?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    }
  ): Promise<OutputMessage> {
    return {
      id: 'msg-from-template-123',
      recipientId: variables.recipientId as string || 'user',
      timestamp: new Date(),
      content: 'Content from template',
      modality: options?.format || 'text'
    };
  }

  async registerTemplate(
    template: Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OutputTemplate> {
    const newTemplate: OutputTemplate = {
      ...template,
      id: 'template-123',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(
    templateId: string, 
    updates: Partial<Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OutputTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    const updated: OutputTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date()
    };
    this.templates.set(templateId, updated);
    return updated;
  }

  async getTemplate(templateId: string): Promise<OutputTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async listTemplates(options?: {
    category?: string;
    modality?: 'text' | 'markdown' | 'html' | 'json' | 'image' | 'audio' | 'structured';
    enabled?: boolean;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<OutputTemplate[]> {
    return Array.from(this.templates.values());
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  async getStats(): Promise<{
    totalProcessedOutputs: number;
    outputsByModality: Record<string, number>;
    averageProcessingTimeMs: number;
    moderationStats?: {
      flaggedCount: number;
      flaggedPercentage: number;
      categoryCounts: Record<string, number>;
    };
    streamingStats?: {
      streamedCount: number;
      streamedPercentage: number;
      averageChunkCount: number;
    };
  }> {
    return {
      totalProcessedOutputs: this.history.length,
      outputsByModality: { text: this.history.length },
      averageProcessingTimeMs: 10
    };
  }
}

describe('OutputProcessor Interface', () => {
  let outputProcessor: OutputProcessor;

  beforeEach(() => {
    // @ts-ignore - Using mock implementation for testing
    outputProcessor = new MockOutputProcessor();
  });

  it('should implement BaseManager interface', () => {
    // Type check that OutputProcessor extends BaseManager
    const manager: BaseManager = outputProcessor;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(outputProcessor.getType()).toBe(ManagerType.OUTPUT);
  });

  it('should initialize successfully', async () => {
    const result = await outputProcessor.initialize();
    expect(result).toBe(true);
    expect(outputProcessor.isEnabled()).toBe(true);
  });

  it('should process output correctly', async () => {
    const message = await outputProcessor.createOutputMessage('test output', 'user');
    const result = await outputProcessor.processOutput(message);
    
    expect(result).toHaveProperty('originalMessage');
    expect(result).toHaveProperty('processedContent');
    expect(result).toHaveProperty('wasModified');
    expect(result).toHaveProperty('appliedProcessingSteps');
  });

  it('should validate output', async () => {
    const result = await outputProcessor.validateOutput('test output', 'text');
    
    expect(result).toHaveProperty('valid');
    expect(result.valid).toBe(true);
  });

  it('should format content', async () => {
    const result = await outputProcessor.formatContent('test output', 'markdown');
    
    expect(typeof result).toBe('string');
  });

  it('should create output message', async () => {
    const message = await outputProcessor.createOutputMessage('test content', 'user123');
    
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('content');
    expect(message).toHaveProperty('recipientId');
    expect(message.recipientId).toBe('user123');
  });

  it('should generate from template', async () => {
    const message = await outputProcessor.generateFromTemplate('template1', { 
      name: 'User',
      recipientId: 'user123'
    });
    
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('content');
    expect(message.recipientId).toBe('user123');
  });

  it('should register and retrieve templates', async () => {
    const template = await outputProcessor.registerTemplate({
      name: 'Greeting',
      description: 'Simple greeting template',
      content: 'Hello {{name}}!',
      variables: [{ name: 'name' }],
      category: 'greetings',
      version: '1.0',
      modality: 'text',
      enabled: true
    });
    
    expect(template).toHaveProperty('id');
    
    const retrieved = await outputProcessor.getTemplate(template.id);
    expect(retrieved).not.toBeNull();
  });

  it('should manage processor steps', async () => {
    const step = await outputProcessor.registerProcessorStep({
      id: 'format',
      name: 'Formatter',
      description: 'Formats the output',
      process: async (content) => content,
      enabled: true,
      order: 1,
      category: 'formatting'
    });
    
    expect(step).toHaveProperty('id');
    
    const steps = await outputProcessor.listProcessorSteps();
    expect(steps.length).toBeGreaterThan(0);
  });

  it('should manage history', async () => {
    const message = await outputProcessor.createOutputMessage('test', 'user');
    const processed = await outputProcessor.processOutput(message);
    await outputProcessor.addToHistory(processed);
    
    const history = await outputProcessor.getHistory();
    expect(history.length).toBeGreaterThan(0);
    
    const cleared = await outputProcessor.clearHistory();
    expect(cleared).toBeGreaterThan(0);
  });

  it('should get statistics', async () => {
    const stats = await outputProcessor.getStats();
    
    expect(stats).toHaveProperty('totalProcessedOutputs');
    expect(stats).toHaveProperty('outputsByModality');
    expect(stats).toHaveProperty('averageProcessingTimeMs');
  });
}); 