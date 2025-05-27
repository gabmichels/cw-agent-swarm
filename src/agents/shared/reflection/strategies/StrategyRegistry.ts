/**
 * Strategy Registry
 * 
 * Manages a registry of available reflection strategies with categorization,
 * tagging, and discovery capabilities. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  StrategyRegistry as IStrategyRegistry,
  ReflectionStrategy,
  StrategyTemplate,
  StrategyCategory,
  StrategySearchOptions,
  StrategyRegistryStats,
  StrategyRegistryConfig
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for strategy registry errors
 */
export class StrategyRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'StrategyRegistryError';
  }
}

/**
 * Default configuration for strategy registry
 */
const DEFAULT_CONFIG: StrategyRegistryConfig = {
  maxStrategies: 100,
  enableCaching: true,
  cacheSize: 50,
  enableVersioning: true,
  enableMetrics: true
};

/**
 * Implementation of strategy registry for reflection strategies
 */
export class StrategyRegistry implements IStrategyRegistry {
  private strategies = new Map<string, ReflectionStrategy>();
  private templates = new Map<string, StrategyTemplate>();
  private categories = new Map<string, StrategyCategory>();
  private strategyTags = new Map<string, Set<string>>();
  private tagStrategies = new Map<string, Set<string>>();
  private searchCache = new Map<string, ReflectionStrategy[]>();
  private config: StrategyRegistryConfig;

  constructor(config: Partial<StrategyRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultCategories();
  }

  /**
   * Register a strategy in the registry
   */
  async registerStrategy(strategy: ReflectionStrategy, tags: string[] = []): Promise<void> {
    this.validateStrategy(strategy);

    if (this.strategies.has(strategy.id)) {
      throw new StrategyRegistryError(
        `Strategy with ID ${strategy.id} already exists`,
        'STRATEGY_EXISTS',
        { strategyId: strategy.id }
      );
    }

    if (this.strategies.size >= this.config.maxStrategies) {
      throw new StrategyRegistryError(
        `Registry capacity exceeded (max: ${this.config.maxStrategies})`,
        'CAPACITY_EXCEEDED',
        { maxStrategies: this.config.maxStrategies, currentCount: this.strategies.size }
      );
    }

    this.strategies.set(strategy.id, strategy);
    
    // Register tags
    if (tags.length > 0) {
      this.setStrategyTags(strategy.id, tags);
    }

    // Clear search cache
    if (this.config.enableCaching) {
      this.searchCache.clear();
    }
  }

  /**
   * Unregister a strategy from the registry
   */
  async unregisterStrategy(strategyId: string): Promise<boolean> {
    if (!this.strategies.has(strategyId)) {
      return false;
    }

    this.strategies.delete(strategyId);
    
    // Remove tags
    this.removeStrategyTags(strategyId);

    // Clear search cache
    if (this.config.enableCaching) {
      this.searchCache.clear();
    }

    return true;
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(strategyId: string): Promise<ReflectionStrategy | null> {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Search for strategies based on criteria
   */
  async searchStrategies(options: StrategySearchOptions = {}): Promise<ReflectionStrategy[]> {
    const cacheKey = this.config.enableCaching ? this.getCacheKey(options) : '';
    
    if (this.config.enableCaching && this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    let results = Array.from(this.strategies.values());

    // Filter by trigger
    if (options.trigger) {
      results = results.filter(s => s.trigger === options.trigger);
    }

    // Filter by enabled status
    if (options.enabled !== undefined) {
      results = results.filter(s => s.enabled === options.enabled);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(s => {
        const strategyTags = this.strategyTags.get(s.id) || new Set();
        return options.tags!.some(tag => strategyTags.has(tag));
      });
    }

    // Filter by category
    if (options.category) {
      results = results.filter(s => {
        const strategyTags = this.strategyTags.get(s.id) || new Set();
        const category = this.categories.get(options.category!);
        return category && category.tags.some(tag => strategyTags.has(tag));
      });
    }

    // Filter by priority range
    if (options.minPriority !== undefined) {
      results = results.filter(s => (s.priority || 5) >= options.minPriority!);
    }
    if (options.maxPriority !== undefined) {
      results = results.filter(s => (s.priority || 5) <= options.maxPriority!);
    }

    // Text search in name and description
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort results
    results.sort((a, b) => {
      const sortBy = options.sortBy || 'priority';
      const direction = options.sortDirection === 'asc' ? 1 : -1;

      switch (sortBy) {
        case 'priority':
          return ((a.priority || 5) - (b.priority || 5)) * direction;
        case 'name':
          return a.name.localeCompare(b.name) * direction;
        case 'createdAt':
          return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
        default:
          return 0;
      }
    });

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Cache results
    if (this.config.enableCaching && this.searchCache.size < this.config.cacheSize) {
      this.searchCache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Register a strategy template
   */
  async registerTemplate(template: StrategyTemplate): Promise<void> {
    this.validateTemplate(template);

    if (this.templates.has(template.id)) {
      throw new StrategyRegistryError(
        `Template with ID ${template.id} already exists`,
        'TEMPLATE_EXISTS',
        { templateId: template.id }
      );
    }

    this.templates.set(template.id, template);
  }

  /**
   * Get a strategy template by ID
   */
  async getTemplate(templateId: string): Promise<StrategyTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<StrategyTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Create a strategy from a template
   */
  async createFromTemplate(templateId: string, overrides: Partial<ReflectionStrategy> = {}): Promise<ReflectionStrategy> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new StrategyRegistryError(
        `Template with ID ${templateId} not found`,
        'TEMPLATE_NOT_FOUND',
        { templateId }
      );
    }

    const strategy: ReflectionStrategy = {
      id: ulid(),
      name: overrides.name || template.name,
      description: overrides.description || template.description,
      trigger: overrides.trigger || template.trigger,
      priority: overrides.priority || template.priority || 5,
      enabled: overrides.enabled !== undefined ? overrides.enabled : true,
      createdAt: new Date(),
      updatedAt: new Date(),
      implementation: overrides.implementation || template.implementation
    };

    return strategy;
  }

  /**
   * Register a strategy category
   */
  async registerCategory(category: StrategyCategory): Promise<void> {
    this.validateCategory(category);

    if (this.categories.has(category.id)) {
      throw new StrategyRegistryError(
        `Category with ID ${category.id} already exists`,
        'CATEGORY_EXISTS',
        { categoryId: category.id }
      );
    }

    this.categories.set(category.id, category);
  }

  /**
   * Get a category by ID
   */
  async getCategory(categoryId: string): Promise<StrategyCategory | null> {
    return this.categories.get(categoryId) || null;
  }

  /**
   * List all categories
   */
  async listCategories(): Promise<StrategyCategory[]> {
    return Array.from(this.categories.values());
  }

  /**
   * Set tags for a strategy
   */
  async setStrategyTags(strategyId: string, tags: string[]): Promise<void> {
    if (!this.strategies.has(strategyId)) {
      throw new StrategyRegistryError(
        `Strategy with ID ${strategyId} not found`,
        'STRATEGY_NOT_FOUND',
        { strategyId }
      );
    }

    // Remove existing tags
    this.removeStrategyTags(strategyId);

    // Add new tags
    const tagSet = new Set(tags);
    this.strategyTags.set(strategyId, tagSet);

    for (const tag of tags) {
      if (!this.tagStrategies.has(tag)) {
        this.tagStrategies.set(tag, new Set());
      }
      this.tagStrategies.get(tag)!.add(strategyId);
    }

    // Clear search cache
    if (this.config.enableCaching) {
      this.searchCache.clear();
    }
  }

  /**
   * Get tags for a strategy
   */
  async getStrategyTags(strategyId: string): Promise<string[]> {
    const tags = this.strategyTags.get(strategyId);
    return tags ? Array.from(tags) : [];
  }

  /**
   * Get all available tags
   */
  async getAllTags(): Promise<string[]> {
    return Array.from(this.tagStrategies.keys());
  }

  /**
   * Get strategies by tag
   */
  async getStrategiesByTag(tag: string): Promise<ReflectionStrategy[]> {
    const strategyIds = this.tagStrategies.get(tag);
    if (!strategyIds) {
      return [];
    }

    const strategies: ReflectionStrategy[] = [];
    for (const id of strategyIds) {
      const strategy = this.strategies.get(id);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  /**
   * Get registry statistics
   */
  getStats(): StrategyRegistryStats {
    const tagDistribution: Record<string, number> = {};
    for (const [tag, strategies] of this.tagStrategies) {
      tagDistribution[tag] = strategies.size;
    }

    const categoryDistribution: Record<string, number> = {};
    for (const category of this.categories.values()) {
      let count = 0;
      for (const tag of category.tags) {
        count += this.tagStrategies.get(tag)?.size || 0;
      }
      categoryDistribution[category.name] = count;
    }

    return {
      totalStrategies: this.strategies.size,
      totalTemplates: this.templates.size,
      totalCategories: this.categories.size,
      totalTags: this.tagStrategies.size,
      enabledStrategies: Array.from(this.strategies.values()).filter(s => s.enabled).length,
      tagDistribution,
      categoryDistribution,
      cacheSize: this.config.enableCaching ? this.searchCache.size : 0,
      config: this.config
    };
  }

  /**
   * Clear the registry
   */
  async clear(): Promise<void> {
    this.strategies.clear();
    this.templates.clear();
    this.strategyTags.clear();
    this.tagStrategies.clear();
    this.searchCache.clear();
    
    // Re-initialize default categories
    this.initializeDefaultCategories();
  }

  /**
   * Initialize default categories
   */
  private initializeDefaultCategories(): void {
    const defaultCategories: StrategyCategory[] = [
      {
        id: 'error-handling',
        name: 'Error Handling',
        description: 'Strategies for handling and analyzing errors',
        tags: ['error', 'debugging', 'troubleshooting']
      },
      {
        id: 'performance',
        name: 'Performance',
        description: 'Strategies for performance analysis and optimization',
        tags: ['performance', 'optimization', 'efficiency']
      },
      {
        id: 'learning',
        name: 'Learning',
        description: 'Strategies for learning and knowledge acquisition',
        tags: ['learning', 'knowledge', 'improvement']
      },
      {
        id: 'task-completion',
        name: 'Task Completion',
        description: 'Strategies for task completion analysis',
        tags: ['task', 'completion', 'success']
      }
    ];

    for (const category of defaultCategories) {
      this.categories.set(category.id, category);
    }
  }

  /**
   * Validate strategy data
   */
  private validateStrategy(strategy: ReflectionStrategy): void {
    if (!strategy.id || typeof strategy.id !== 'string' || strategy.id.trim() === '') {
      throw new StrategyRegistryError('Strategy ID is required and must be a non-empty string', 'INVALID_STRATEGY_ID');
    }

    if (!strategy.name || typeof strategy.name !== 'string' || strategy.name.trim() === '') {
      throw new StrategyRegistryError('Strategy name is required and must be a non-empty string', 'INVALID_STRATEGY_NAME');
    }

    if (!strategy.description || typeof strategy.description !== 'string' || strategy.description.trim() === '') {
      throw new StrategyRegistryError('Strategy description is required and must be a non-empty string', 'INVALID_STRATEGY_DESCRIPTION');
    }

    if (!strategy.trigger || typeof strategy.trigger !== 'string') {
      throw new StrategyRegistryError('Strategy trigger is required and must be a string', 'INVALID_STRATEGY_TRIGGER');
    }

    if (strategy.priority !== undefined && (typeof strategy.priority !== 'number' || strategy.priority < 1 || strategy.priority > 10)) {
      throw new StrategyRegistryError('Strategy priority must be a number between 1 and 10', 'INVALID_STRATEGY_PRIORITY');
    }

    if (typeof strategy.implementation !== 'function') {
      throw new StrategyRegistryError('Strategy implementation must be a function', 'INVALID_STRATEGY_IMPLEMENTATION');
    }
  }

  /**
   * Validate template data
   */
  private validateTemplate(template: StrategyTemplate): void {
    if (!template.id || typeof template.id !== 'string' || template.id.trim() === '') {
      throw new StrategyRegistryError('Template ID is required and must be a non-empty string', 'INVALID_TEMPLATE_ID');
    }

    if (!template.name || typeof template.name !== 'string' || template.name.trim() === '') {
      throw new StrategyRegistryError('Template name is required and must be a non-empty string', 'INVALID_TEMPLATE_NAME');
    }

    if (!template.description || typeof template.description !== 'string' || template.description.trim() === '') {
      throw new StrategyRegistryError('Template description is required and must be a non-empty string', 'INVALID_TEMPLATE_DESCRIPTION');
    }

    if (!template.trigger || typeof template.trigger !== 'string') {
      throw new StrategyRegistryError('Template trigger is required and must be a string', 'INVALID_TEMPLATE_TRIGGER');
    }

    if (typeof template.implementation !== 'function') {
      throw new StrategyRegistryError('Template implementation must be a function', 'INVALID_TEMPLATE_IMPLEMENTATION');
    }
  }

  /**
   * Validate category data
   */
  private validateCategory(category: StrategyCategory): void {
    if (!category.id || typeof category.id !== 'string' || category.id.trim() === '') {
      throw new StrategyRegistryError('Category ID is required and must be a non-empty string', 'INVALID_CATEGORY_ID');
    }

    if (!category.name || typeof category.name !== 'string' || category.name.trim() === '') {
      throw new StrategyRegistryError('Category name is required and must be a non-empty string', 'INVALID_CATEGORY_NAME');
    }

    if (!category.description || typeof category.description !== 'string' || category.description.trim() === '') {
      throw new StrategyRegistryError('Category description is required and must be a non-empty string', 'INVALID_CATEGORY_DESCRIPTION');
    }

    if (!Array.isArray(category.tags) || category.tags.length === 0) {
      throw new StrategyRegistryError('Category tags must be a non-empty array', 'INVALID_CATEGORY_TAGS');
    }
  }

  /**
   * Remove tags for a strategy
   */
  private removeStrategyTags(strategyId: string): void {
    const existingTags = this.strategyTags.get(strategyId);
    if (existingTags) {
      for (const tag of existingTags) {
        const tagStrategies = this.tagStrategies.get(tag);
        if (tagStrategies) {
          tagStrategies.delete(strategyId);
          if (tagStrategies.size === 0) {
            this.tagStrategies.delete(tag);
          }
        }
      }
      this.strategyTags.delete(strategyId);
    }
  }

  /**
   * Generate cache key for search options
   */
  private getCacheKey(options: StrategySearchOptions): string {
    return JSON.stringify({
      trigger: options.trigger,
      enabled: options.enabled,
      tags: options.tags?.sort(),
      category: options.category,
      minPriority: options.minPriority,
      maxPriority: options.maxPriority,
      searchText: options.searchText,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      limit: options.limit
    });
  }
} 