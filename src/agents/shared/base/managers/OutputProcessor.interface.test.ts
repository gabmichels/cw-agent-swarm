/**
 * OutputProcessor.interface.test.ts
 * 
 * Tests to validate the OutputProcessor interface contract
 * and ensure proper implementation by concrete classes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { ManagerHealth } from './ManagerHealth';
import { AgentBase } from '../AgentBase.interface';

// Mock implementation of the OutputProcessor interface for testing
class MockOutputProcessor extends AbstractBaseManager implements OutputProcessor {
  private history: ProcessedOutput[] = [];
  private templates: Map<string, OutputTemplate> = new Map();
  private processorSteps: Map<string, OutputProcessorStep> = new Map();

  constructor() {
    super('mock-output-processor-123', ManagerType.OUTPUT, {} as AgentBase, { enabled: true });
  }

  async initialize(): Promise<boolean> {
    this._initialized = true;
    return true;
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
  }

  async getHealth(): Promise<ManagerHealth> {
    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {}
      }
    };
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
      processedContent: message.content as string,
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
      id: 'test-message',
      content,
      recipientId,
      timestamp: new Date(),
      modality: options?.modality || 'text',
      context: options?.context,
      attachments: options?.attachments?.map(att => ({
        id: `att-${Date.now()}`,
        type: att.type,
        data: att.data,
        metadata: {}
      })) || [],
      tags: options?.tags || []
    };
  }

  async setProcessorStepEnabled(stepId: string, enabled: boolean): Promise<OutputProcessorStep> {
    const step = await this.getProcessorStep(stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    step.enabled = enabled;
    return step;
  }

  async setProcessorStepOrder(stepId: string, order: number): Promise<OutputProcessorStep> {
    const step = await this.getProcessorStep(stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
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
    const count = this.history.length;
    this.history = [];
    return count;
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
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let content = template.content;
    content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });

    return {
      id: `msg-${Date.now()}`,
      recipientId: variables.recipientId as string || 'user',
      timestamp: new Date(),
      content,
      modality: options?.format || template.modality
    };
  }

  async registerTemplate(
    template: Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OutputTemplate> {
    const id = template.name.toLowerCase().replace(/\s+/g, '_');
    const newTemplate: OutputTemplate = {
      ...template,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<OutputTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OutputTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    const updatedTemplate: OutputTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date()
    };
    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
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
    const totalOutputs = this.history.length;
    
    // Count outputs by modality
    const outputsByModality = this.history.reduce((acc, item) => {
      const modality = item.originalMessage.modality;
      acc[modality] = (acc[modality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate average processing time
    const averageProcessingTimeMs = totalOutputs > 0 ?
      this.history.reduce((sum, item) => sum + item.processingMetadata.processingTimeMs, 0) / totalOutputs : 0;
    
    return {
      totalProcessedOutputs: totalOutputs,
      outputsByModality,
      averageProcessingTimeMs
    };
  }
}

describe('OutputProcessor Interface', () => {
  let outputProcessor: OutputProcessor;

  beforeEach(() => {
    outputProcessor = new MockOutputProcessor();
  });

  it('should implement BaseManager interface', () => {
    // Type check that OutputProcessor extends BaseManager
    const manager: BaseManager = outputProcessor;
    expect(manager).toBeDefined();
  });

  it('should have the correct manager type', () => {
    expect(outputProcessor.managerType).toBe(ManagerType.OUTPUT);
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

  it('should manage processor steps', async () => {
    const step: OutputProcessorStep = {
      id: 'test-step',
      name: 'Test Step',
      description: 'A test step',
      process: async (content: string) => content,
      enabled: true,
      order: 1,
      category: 'test'
    };

    await outputProcessor.registerProcessorStep(step);
    const retrievedStep = await outputProcessor.getProcessorStep(step.id);
    expect(retrievedStep).toBeDefined();
    expect(retrievedStep?.id).toBe(step.id);
  });

  it('should manage history', async () => {
    const message = await outputProcessor.createOutputMessage('test output', 'user');
    const processed = await outputProcessor.processOutput(message);
    await outputProcessor.addToHistory(processed);

    const history = await outputProcessor.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toBe(processed);

    const cleared = await outputProcessor.clearHistory();
    expect(cleared).toBe(1);

    const emptyHistory = await outputProcessor.getHistory();
    expect(emptyHistory).toHaveLength(0);
  });

  it('should manage templates', async () => {
    const template = await outputProcessor.registerTemplate({
      name: 'test-template',
      description: 'A test template',
      content: 'Hello {{name}}!',
      variables: [{ name: 'name' }],
      category: 'test',
      version: '1.0.0',
      modality: 'text',
      enabled: true
    });

    expect(template.id).toBe('test_template');

    const message = await outputProcessor.generateFromTemplate(template.id, {
      name: 'World',
      recipientId: 'user123'
    });

    expect(message.content).toBe('Hello World!');
  });

  it('should provide statistics', async () => {
    const message = await outputProcessor.createOutputMessage('test output', 'user');
    const processed = await outputProcessor.processOutput(message);
    await outputProcessor.addToHistory(processed);

    const stats = await outputProcessor.getStats();
    expect(stats.totalProcessedOutputs).toBe(1);
    expect(stats.outputsByModality).toHaveProperty('text');
    expect(stats.averageProcessingTimeMs).toBeGreaterThanOrEqual(0);
  });
}); 