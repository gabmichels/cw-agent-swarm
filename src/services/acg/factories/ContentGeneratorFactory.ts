/**
 * ContentGeneratorFactory.ts - Factory for creating and managing ACG content generators
 * 
 * This factory manages the lifecycle of content generators, handles registration,
 * and provides generator selection logic based on content types and capabilities.
 */

import { ulid } from 'ulid';
import {
  IContentGenerator,
  ILLMContentGenerator,
  GeneratorDependencies,
  HealthStatus
} from '../interfaces/IContentGenerator';
import { IContentGenerationService } from '../interfaces/IContentGenerationService';
import {
  ContentType,
  GenerationContext
} from '../types/ContentGenerationTypes';
import {
  GenerationCapability
} from '../types/GenerationCapabilities';
import { EmailContentGenerator } from '../generators/email/EmailContentGenerator';
import { DocumentContentGenerator } from '../generators/document/DocumentContentGenerator';
import { LLMServiceAdapter } from '../adapters/LLMServiceAdapter';
import { AgentLLMService } from '../../messaging/message-generator';
import { createLogger } from '../../../lib/logging/winston-logger';

export interface GeneratorRegistration {
  id: string;
  generator: IContentGenerator;
  registeredAt: Date;
  enabled: boolean;
  priority: number;
}

export interface GeneratorSelectionCriteria {
  contentType: ContentType;
  context: GenerationContext;
  preferredMethod?: 'llm' | 'template' | 'hybrid';
  maxGenerationTime?: number;
  qualityThreshold?: number;
}

export interface GeneratorSelectionResult {
  generator: IContentGenerator | null;
  reason: string;
  alternatives: IContentGenerator[];
  confidence: number;
}

/**
 * Factory for creating and managing content generators
 */
export class ContentGeneratorFactory {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly generators = new Map<string, GeneratorRegistration>();
  private dependencies?: GeneratorDependencies;
  private initialized = false;

  constructor() {
    this.logger = createLogger({
      moduleId: 'content-generator-factory'
    });
  }

  /**
   * Initialize the factory with dependencies and register default generators
   */
  async initialize(
    dependencies: GeneratorDependencies,
    llmService: AgentLLMService
  ): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Factory already initialized');
      return;
    }

    this.dependencies = dependencies;

    try {
      // Create LLM adapter
      const llmAdapter = new LLMServiceAdapter(llmService);

      // Register default generators
      await this.registerDefaultGenerators(llmAdapter);

      // Initialize all registered generators
      await this.initializeGenerators();

      this.initialized = true;

      this.logger.info('Content generator factory initialized', {
        generatorCount: this.generators.size,
        registeredGenerators: Array.from(this.generators.keys())
      });

    } catch (error) {
      this.logger.error('Failed to initialize content generator factory', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Shutdown the factory and all registered generators
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down content generator factory');

    // Shutdown all generators
    const shutdownPromises = Array.from(this.generators.values()).map(async (registration) => {
      try {
        await registration.generator.shutdown();
      } catch (error) {
        this.logger.error('Error shutting down generator', {
          generatorId: registration.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(shutdownPromises);

    this.generators.clear();
    this.initialized = false;

    this.logger.info('Content generator factory shutdown complete');
  }

  /**
   * Register a new content generator
   */
  async registerGenerator(generator: IContentGenerator): Promise<void> {
    if (this.generators.has(generator.id)) {
      throw new Error(`Generator with ID ${generator.id} is already registered`);
    }

    const registration: GeneratorRegistration = {
      id: generator.id,
      generator,
      registeredAt: new Date(),
      enabled: generator.enabled,
      priority: generator.priority
    };

    // Initialize the generator if factory is already initialized
    if (this.initialized && this.dependencies) {
      try {
        await generator.initialize(this.dependencies);
      } catch (error) {
        this.logger.error('Failed to initialize generator during registration', {
          generatorId: generator.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }

    this.generators.set(generator.id, registration);

    this.logger.info('Generator registered', {
      generatorId: generator.id,
      generatorName: generator.name,
      supportedTypes: generator.supportedTypes,
      priority: generator.priority
    });
  }

  /**
   * Unregister a content generator
   */
  async unregisterGenerator(generatorId: string): Promise<void> {
    const registration = this.generators.get(generatorId);
    if (!registration) {
      this.logger.warn('Attempted to unregister non-existent generator', { generatorId });
      return;
    }

    try {
      await registration.generator.shutdown();
    } catch (error) {
      this.logger.error('Error shutting down generator during unregistration', {
        generatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    this.generators.delete(generatorId);

    this.logger.info('Generator unregistered', { generatorId });
  }

  /**
   * Select the best generator for a given content type and context
   */
  async selectGenerator(criteria: GeneratorSelectionCriteria): Promise<GeneratorSelectionResult> {
    const { contentType, context, preferredMethod, maxGenerationTime, qualityThreshold } = criteria;

    // Get all generators that can handle this content type
    const candidates: Array<{ generator: IContentGenerator; registration: GeneratorRegistration }> = [];

    for (const registration of this.generators.values()) {
      if (!registration.enabled) continue;

      try {
        const canGenerate = await registration.generator.canGenerate(contentType, context);
        if (canGenerate) {
          candidates.push({ generator: registration.generator, registration });
        }
      } catch (error) {
        this.logger.warn('Error checking generator capability', {
          generatorId: registration.id,
          contentType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (candidates.length === 0) {
      return {
        generator: null,
        reason: `No generators available for content type: ${contentType}`,
        alternatives: [],
        confidence: 0
      };
    }

    // Sort candidates by priority and capability match
    candidates.sort((a, b) => {
      // First, prefer by method if specified
      if (preferredMethod) {
        const aMatches = this.matchesPreferredMethod(a.generator, preferredMethod);
        const bMatches = this.matchesPreferredMethod(b.generator, preferredMethod);
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }

      // Then by priority (higher is better)
      if (a.registration.priority !== b.registration.priority) {
        return b.registration.priority - a.registration.priority;
      }

      // Then by capability score
      const aScore = this.calculateCapabilityScore(a.generator, contentType, context);
      const bScore = this.calculateCapabilityScore(b.generator, contentType, context);
      return bScore - aScore;
    });

    const selectedCandidate = candidates[0];
    const alternatives = candidates.slice(1).map(c => c.generator);

    // Check time constraints
    if (maxGenerationTime) {
      try {
        const estimatedTime = await selectedCandidate.generator.estimateGenerationTime(context);
        if (estimatedTime > maxGenerationTime) {
          return {
            generator: null,
            reason: `Estimated generation time (${estimatedTime}ms) exceeds maximum (${maxGenerationTime}ms)`,
            alternatives,
            confidence: 0.3
          };
        }
      } catch (error) {
        this.logger.warn('Error estimating generation time', {
          generatorId: selectedCandidate.generator.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const confidence = this.calculateSelectionConfidence(selectedCandidate.generator, contentType, context);

    return {
      generator: selectedCandidate.generator,
      reason: `Selected based on priority (${selectedCandidate.registration.priority}) and capability match`,
      alternatives,
      confidence
    };
  }

  /**
   * Get all registered generators
   */
  getRegisteredGenerators(): GeneratorRegistration[] {
    return Array.from(this.generators.values());
  }

  /**
   * Get a specific generator by ID
   */
  getGenerator(generatorId: string): IContentGenerator | null {
    const registration = this.generators.get(generatorId);
    return registration ? registration.generator : null;
  }

  /**
   * Get generators that support a specific content type
   */
  getGeneratorsForContentType(contentType: ContentType): IContentGenerator[] {
    return Array.from(this.generators.values())
      .filter(registration =>
        registration.enabled &&
        registration.generator.supportedTypes.includes(contentType)
      )
      .map(registration => registration.generator);
  }

  /**
   * Get health status of all generators
   */
  async getHealthStatus(): Promise<Record<string, HealthStatus>> {
    const healthStatuses: Record<string, HealthStatus> = {};

    const healthPromises = Array.from(this.generators.entries()).map(async ([id, registration]) => {
      try {
        const health = await registration.generator.getHealthStatus();
        healthStatuses[id] = health;
      } catch (error) {
        healthStatuses[id] = {
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          dependencies: {},
          performance: {
            averageLatencyMs: 0,
            successRate: 0,
            requestsPerMinute: 0,
            memoryUsageMB: 0
          }
        };
      }
    });

    await Promise.allSettled(healthPromises);

    return healthStatuses;
  }

  /**
   * Enable or disable a generator
   */
  setGeneratorEnabled(generatorId: string, enabled: boolean): void {
    const registration = this.generators.get(generatorId);
    if (registration) {
      registration.enabled = enabled;
      this.logger.info('Generator enabled status changed', {
        generatorId,
        enabled
      });
    }
  }

  // ===== Private Methods =====

  /**
   * Register default generators
   */
  private async registerDefaultGenerators(llmAdapter: LLMServiceAdapter): Promise<void> {
    // Register email content generator
    const emailGenerator = new EmailContentGenerator();
    await this.registerGenerator(emailGenerator);

    // Register document content generator
    const documentGenerator = new DocumentContentGenerator(llmAdapter);
    await this.registerGenerator(documentGenerator);

    this.logger.info('Default generators registered', {
      count: 2,
      generators: ['email-content-generator', 'document-content-generator']
    });
  }

  /**
   * Initialize all registered generators
   */
  private async initializeGenerators(): Promise<void> {
    if (!this.dependencies) {
      throw new Error('Dependencies not set');
    }

    const initPromises = Array.from(this.generators.values()).map(async (registration) => {
      try {
        await registration.generator.initialize(this.dependencies!);
      } catch (error) {
        this.logger.error('Failed to initialize generator', {
          generatorId: registration.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    });

    await Promise.all(initPromises);
  }

  /**
   * Check if generator matches preferred method
   */
  private matchesPreferredMethod(generator: IContentGenerator, preferredMethod: string): boolean {
    // This is a simple implementation - in practice, you might want more sophisticated matching
    switch (preferredMethod) {
      case 'llm':
        return generator.id.includes('llm') || generator.id.includes('email') || generator.id.includes('document');
      case 'template':
        return generator.id.includes('template');
      case 'hybrid':
        return generator.id.includes('hybrid');
      default:
        return true;
    }
  }

  /**
   * Calculate capability score for a generator
   */
  private calculateCapabilityScore(
    generator: IContentGenerator,
    contentType: ContentType,
    context: GenerationContext
  ): number {
    let score = 0;

    // Base score for supporting the content type
    if (generator.supportedTypes.includes(contentType)) {
      score += 10;
    }

    // Bonus for exact content type match (primary support)
    if (generator.supportedTypes[0] === contentType) {
      score += 5;
    }

    // Bonus for capabilities match
    if (generator.capabilities) {
      const relevantCapabilities = generator.capabilities.filter(cap =>
        cap === GenerationCapability.LLM_POWERED ||
        cap === GenerationCapability.TEMPLATE_BASED ||
        cap === GenerationCapability.CONTEXT_AWARE
      );
      score += relevantCapabilities.length * 2;
    }

    return score;
  }

  /**
   * Calculate confidence in the generator selection
   */
  private calculateSelectionConfidence(
    generator: IContentGenerator,
    contentType: ContentType,
    context: GenerationContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for exact content type support
    if (generator.supportedTypes.includes(contentType)) {
      confidence += 0.3;
    }

    // Increase confidence for high priority generators
    if (generator.priority >= 8) {
      confidence += 0.1;
    }

    // Increase confidence for enabled generators
    if (generator.enabled) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }
} 