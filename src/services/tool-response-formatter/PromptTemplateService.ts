/**
 * Prompt Template Service
 * 
 * Main service implementing the strategy pattern for prompt template management.
 * Integrates persona adaptation, response style variations, and template selection.
 */

import { ulid, ULID } from 'ulid';
import { logger } from '../../lib/logging';
import { PersonaIntegration, PersonaIntegrationConfig } from './PersonaIntegration';
import {
  ALL_PROMPT_TEMPLATES,
  DEFAULT_RESPONSE_STYLES,
  getPromptTemplate,
  getPromptTemplateWithFallback,
  validateTemplateConfiguration
} from './prompt-templates';
import { ResponsePattern, ResponseStyleVariations } from './ResponseStyleVariations';
import {
  IPromptTemplateService,
  PromptTemplateError,
  ResponseStyleType,
  ToolCategory,
  ToolResponseContext,
  ToolResponsePromptTemplate
} from './types';

/**
 * Prompt template generation result
 */
export interface PromptTemplateResult {
  readonly id: ULID;
  readonly systemPrompt: string;
  readonly template: ToolResponsePromptTemplate;
  readonly responsePattern: ResponsePattern;
  readonly personaAdapted: boolean;
  readonly fallbackUsed: boolean;
  readonly generationMetrics: PromptGenerationMetrics;
}

/**
 * Prompt generation performance metrics
 */
export interface PromptGenerationMetrics {
  readonly templateSelectionTime: number;
  readonly personaAdaptationTime: number;
  readonly promptGenerationTime: number;
  readonly totalGenerationTime: number;
  readonly cacheHit: boolean;
}

/**
 * Template cache entry
 */
interface TemplateCacheEntry {
  readonly template: ToolResponsePromptTemplate;
  readonly systemPrompt: string;
  readonly responsePattern: ResponsePattern;
  readonly timestamp: Date;
  readonly hits: number;
}

/**
 * Prompt Template Service Implementation
 */
export class PromptTemplateService implements IPromptTemplateService {
  private readonly templateCache = new Map<string, TemplateCacheEntry>();
  private readonly cacheMaxSize = 100;
  private readonly cacheTTLMs = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly defaultPersonaConfig: PersonaIntegrationConfig = {
      enablePersonaAdaptation: true,
      enableToneAdjustment: true,
      enableCapabilityContext: true,
      enableCommunicationStyleOverride: true,
      preferenceWeight: 0.7
    }
  ) {
    this.validateTemplateSystem();
  }

  /**
   * Get prompt template for tool category and style
   */
  async getTemplate(
    category: ToolCategory,
    style: ResponseStyleType
  ): Promise<ToolResponsePromptTemplate> {
    const startTime = Date.now();

    try {
      // Try exact match first
      let template = getPromptTemplate(category, style);

      if (!template) {
        // Use fallback logic
        template = getPromptTemplateWithFallback(category, style);

        if (!template) {
          throw new PromptTemplateError(
            `No template found for category ${category} and style ${style}`,
            { category, style }
          );
        }

        logger.warn('Using fallback template', {
          category,
          requestedStyle: style,
          fallbackTemplate: template.id
        });
      }

      logger.debug('Template retrieved successfully', {
        category,
        style,
        templateId: template.id,
        retrievalTime: Date.now() - startTime
      });

      return template;

    } catch (error) {
      logger.error('Template retrieval failed', {
        category,
        style,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all available templates
   */
  async getAllTemplates(): Promise<readonly ToolResponsePromptTemplate[]> {
    return ALL_PROMPT_TEMPLATES;
  }

  /**
   * Add or update a template
   */
  async upsertTemplate(template: ToolResponsePromptTemplate): Promise<void> {
    // For now, this is a read-only implementation
    // In a full implementation, this would persist to storage
    logger.info('Template upsert requested (not implemented)', {
      templateId: template.id,
      category: template.category,
      style: template.style
    });
    throw new Error('Template persistence not implemented in this version');
  }

  /**
   * Generate complete prompt template result for context
   */
  async generatePromptForContext(
    context: ToolResponseContext,
    personaConfig?: PersonaIntegrationConfig
  ): Promise<PromptTemplateResult> {
    const startTime = Date.now();
    const config = personaConfig || this.defaultPersonaConfig;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(context, config);
      const cached = this.getCachedTemplate(cacheKey);

      if (cached) {
        this.updateCacheHit(cacheKey);
        return this.buildResultFromCache(cached, startTime);
      }

      // Template selection phase
      const templateSelectionStart = Date.now();
      const template = await this.getTemplate(
        context.toolCategory,
        context.responseConfig.responseStyle
      );
      const templateSelectionTime = Date.now() - templateSelectionStart;

      // Response pattern adaptation phase
      const responsePattern = ResponseStyleVariations.getResponsePattern(
        context.toolResult,
        context.responseConfig.responseStyle
      );

      const adaptedPattern = ResponseStyleVariations.adaptForPersona(
        responsePattern,
        context.agentPersona
      );

      // Persona integration phase
      const personaAdaptationStart = Date.now();
      const systemPrompt = PersonaIntegration.buildPersonaIntegratedPrompt(
        template.systemPrompt,
        context,
        config
      );
      const personaAdaptationTime = Date.now() - personaAdaptationStart;

      // Generate final result
      const result: PromptTemplateResult = {
        id: ulid(),
        systemPrompt,
        template,
        responsePattern: adaptedPattern,
        personaAdapted: config.enablePersonaAdaptation,
        fallbackUsed: template.id.includes('generic') || !template.id.includes(context.toolCategory),
        generationMetrics: {
          templateSelectionTime,
          personaAdaptationTime,
          promptGenerationTime: Date.now() - personaAdaptationStart,
          totalGenerationTime: Date.now() - startTime,
          cacheHit: false
        }
      };

      // Cache the result
      this.cacheTemplate(cacheKey, {
        template,
        systemPrompt,
        responsePattern: adaptedPattern,
        timestamp: new Date(),
        hits: 1
      });

      logger.debug('Prompt generated successfully', {
        contextId: context.id,
        templateId: template.id,
        category: context.toolCategory,
        style: context.responseConfig.responseStyle,
        personaAdapted: result.personaAdapted,
        fallbackUsed: result.fallbackUsed,
        generationTime: result.generationMetrics.totalGenerationTime
      });

      return result;

    } catch (error) {
      logger.error('Prompt generation failed', {
        contextId: context.id,
        category: context.toolCategory,
        style: context.responseConfig.responseStyle,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get available response styles for a category
   */
  async getAvailableStyles(category: ToolCategory): Promise<ResponseStyleType[]> {
    try {
      const styles: ResponseStyleType[] = ['conversational', 'business', 'technical', 'casual'];
      const availableStyles: ResponseStyleType[] = [];

      for (const style of styles) {
        const template = getPromptTemplate(category, style);
        if (template) {
          availableStyles.push(style);
        }
      }

      // Ensure default style is always available (with fallback)
      const defaultStyle = DEFAULT_RESPONSE_STYLES[category];
      if (!availableStyles.includes(defaultStyle)) {
        availableStyles.push(defaultStyle);
      }

      return availableStyles;

    } catch (error) {
      logger.error('Failed to get available styles', {
        category,
        error: error instanceof Error ? error.message : String(error)
      });
      return ['conversational']; // Safe fallback
    }
  }

  /**
   * Validate template system on service initialization
   */
  private validateTemplateSystem(): void {
    try {
      const validation = validateTemplateConfiguration();

      if (!validation.isValid) {
        logger.warn('Template system validation warnings', {
          missingTemplates: validation.missingTemplates,
          totalTemplates: validation.totalTemplates
        });
      } else {
        logger.info('Template system validated successfully', {
          totalTemplates: validation.totalTemplates
        });
      }

    } catch (error) {
      logger.error('Template system validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate cache key for template caching
   */
  private generateCacheKey(
    context: ToolResponseContext,
    config: PersonaIntegrationConfig
  ): string {
    const keyComponents = [
      context.toolCategory,
      context.responseConfig.responseStyle,
      context.agentPersona.personality || 'default',
      context.agentPersona.communicationStyle || 'default',
      context.toolResult.success ? 'success' : 'error',
      config.enablePersonaAdaptation ? '1' : '0',
      config.enableToneAdjustment ? '1' : '0'
    ];

    return keyComponents.join('|');
  }

  /**
   * Get cached template if available and valid
   */
  private getCachedTemplate(cacheKey: string): TemplateCacheEntry | null {
    const cached = this.templateCache.get(cacheKey);

    if (!cached) return null;

    // Check TTL
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.cacheTTLMs) {
      this.templateCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache template result
   */
  private cacheTemplate(cacheKey: string, entry: TemplateCacheEntry): void {
    // Implement LRU eviction if cache is full
    if (this.templateCache.size >= this.cacheMaxSize) {
      this.evictLRUTemplates();
    }

    this.templateCache.set(cacheKey, entry);
  }

  /**
   * Update cache hit count
   */
  private updateCacheHit(cacheKey: string): void {
    const cached = this.templateCache.get(cacheKey);
    if (cached) {
      this.templateCache.set(cacheKey, {
        ...cached,
        hits: cached.hits + 1
      });
    }
  }

  /**
   * Evict least recently used templates
   */
  private evictLRUTemplates(): void {
    // Remove oldest 20% of cache entries
    const entriesToRemove = Math.floor(this.cacheMaxSize * 0.2);
    const sortedEntries = Array.from(this.templateCache.entries())
      .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < entriesToRemove && sortedEntries.length > 0; i++) {
      const [key] = sortedEntries[i];
      this.templateCache.delete(key);
    }
  }

  /**
   * Build result from cached template
   */
  private buildResultFromCache(
    cached: TemplateCacheEntry,
    startTime: number
  ): PromptTemplateResult {
    return {
      id: ulid(),
      systemPrompt: cached.systemPrompt,
      template: cached.template,
      responsePattern: cached.responsePattern,
      personaAdapted: true, // Cached results were persona-adapted
      fallbackUsed: cached.template.id.includes('generic'),
      generationMetrics: {
        templateSelectionTime: 0,
        personaAdaptationTime: 0,
        promptGenerationTime: 0,
        totalGenerationTime: Date.now() - startTime,
        cacheHit: true
      }
    };
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    oldestEntry: Date | null;
  } {
    const entries = Array.from(this.templateCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalRequests = entries.reduce((sum, entry) => sum + Math.max(1, entry.hits), 0);
    const oldestEntry = entries.length > 0
      ? new Date(Math.min(...entries.map(e => e.timestamp.getTime())))
      : null;

    return {
      size: this.templateCache.size,
      maxSize: this.cacheMaxSize,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits,
      oldestEntry
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    logger.info('Template cache cleared');
  }
} 