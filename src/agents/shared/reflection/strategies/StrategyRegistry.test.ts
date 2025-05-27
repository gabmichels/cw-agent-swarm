/**
 * Unit tests for StrategyRegistry
 */

import { StrategyRegistry, StrategyRegistryError } from './StrategyRegistry';
import { ReflectionStrategy, StrategyTemplate, StrategyCategory, ReflectionTrigger } from '../interfaces/ReflectionInterfaces';

describe('StrategyRegistry', () => {
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new StrategyRegistry();
  });

  afterEach(async () => {
    await registry.clear();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const stats = registry.getStats();
      const config = stats.config;
      
      expect(config.maxStrategies).toBe(100);
      expect(config.enableCaching).toBe(true);
      expect(config.cacheSize).toBe(50);
      expect(config.enableVersioning).toBe(true);
      expect(config.enableMetrics).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customRegistry = new StrategyRegistry({
        maxStrategies: 50,
        enableCaching: false
      });
      
      const stats = customRegistry.getStats();
      const config = stats.config;
      
      expect(config.maxStrategies).toBe(50);
      expect(config.enableCaching).toBe(false);
    });

    it('should initialize default categories', () => {
      const stats = registry.getStats();
      expect(stats.totalCategories).toBe(4); // error-handling, performance, learning, task-completion
    });
  });

  describe('registerStrategy', () => {
    it('should register a valid strategy successfully', async () => {
      const strategy: ReflectionStrategy = {
        id: 'test-strategy-1',
        name: 'Test Strategy',
        description: 'A test strategy',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await registry.registerStrategy(strategy);
      const retrieved = await registry.getStrategy('test-strategy-1');
      
      expect(retrieved).toEqual(strategy);
    });

    it('should register strategy with tags', async () => {
      const strategy: ReflectionStrategy = {
        id: 'test-strategy-2',
        name: 'Tagged Strategy',
        description: 'A strategy with tags',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await registry.registerStrategy(strategy, ['error', 'debugging']);
      const tags = await registry.getStrategyTags('test-strategy-2');
      
      expect(tags).toEqual(['error', 'debugging']);
    });

    it('should throw error for duplicate strategy ID', async () => {
      const strategy: ReflectionStrategy = {
        id: 'duplicate-id',
        name: 'First Strategy',
        description: 'First strategy',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await registry.registerStrategy(strategy);
      await expect(registry.registerStrategy(strategy)).rejects.toThrow(StrategyRegistryError);
    });

    it('should throw error when capacity is exceeded', async () => {
      const limitedRegistry = new StrategyRegistry({ maxStrategies: 1 });
      
      const strategy1: ReflectionStrategy = {
        id: 'strategy-1',
        name: 'First Strategy',
        description: 'First strategy',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      const strategy2: ReflectionStrategy = {
        id: 'strategy-2',
        name: 'Second Strategy',
        description: 'Second strategy',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await limitedRegistry.registerStrategy(strategy1);
      await expect(limitedRegistry.registerStrategy(strategy2)).rejects.toThrow(StrategyRegistryError);
    });

    it('should validate strategy data', async () => {
      const invalidStrategy = {
        id: '',
        name: 'Invalid Strategy',
        description: 'Invalid strategy',
        trigger: 'error' as ReflectionTrigger,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      } as ReflectionStrategy;

      await expect(registry.registerStrategy(invalidStrategy)).rejects.toThrow(StrategyRegistryError);
    });
  });

  describe('unregisterStrategy', () => {
    it('should unregister existing strategy', async () => {
      const strategy: ReflectionStrategy = {
        id: 'test-strategy-3',
        name: 'Test Strategy',
        description: 'A test strategy',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await registry.registerStrategy(strategy, ['test']);
      const result = await registry.unregisterStrategy('test-strategy-3');
      
      expect(result).toBe(true);
      expect(await registry.getStrategy('test-strategy-3')).toBeNull();
      expect(await registry.getStrategyTags('test-strategy-3')).toEqual([]);
    });

    it('should return false for non-existent strategy', async () => {
      const result = await registry.unregisterStrategy('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('searchStrategies', () => {
    beforeEach(async () => {
      const strategies: ReflectionStrategy[] = [
        {
          id: 'error-strategy',
          name: 'Error Handler',
          description: 'Handles errors',
          trigger: 'error' as ReflectionTrigger,
          priority: 8,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
        },
        {
          id: 'task-strategy',
          name: 'Task Completer',
          description: 'Handles task completion',
          trigger: 'task_completion' as ReflectionTrigger,
          priority: 6,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
        },
        {
          id: 'disabled-strategy',
          name: 'Disabled Strategy',
          description: 'A disabled strategy',
          trigger: 'learning_opportunity' as ReflectionTrigger,
          priority: 4,
          enabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
        }
      ];

      for (const strategy of strategies) {
        await registry.registerStrategy(strategy);
      }

      // Add tags
      await registry.setStrategyTags('error-strategy', ['error', 'debugging']);
      await registry.setStrategyTags('task-strategy', ['task', 'completion']);
    });

    it('should return all strategies by default', async () => {
      const strategies = await registry.searchStrategies();
      expect(strategies.length).toBe(3);
    });

    it('should filter by trigger', async () => {
      const strategies = await registry.searchStrategies({ trigger: 'error' });
      expect(strategies.length).toBe(1);
      expect(strategies[0].id).toBe('error-strategy');
    });

    it('should filter by enabled status', async () => {
      const enabledStrategies = await registry.searchStrategies({ enabled: true });
      const disabledStrategies = await registry.searchStrategies({ enabled: false });
      
      expect(enabledStrategies.length).toBe(2);
      expect(disabledStrategies.length).toBe(1);
      expect(disabledStrategies[0].id).toBe('disabled-strategy');
    });

    it('should filter by tags', async () => {
      const strategies = await registry.searchStrategies({ tags: ['error'] });
      expect(strategies.length).toBe(1);
      expect(strategies[0].id).toBe('error-strategy');
    });

    it('should filter by priority range', async () => {
      const strategies = await registry.searchStrategies({ minPriority: 6 });
      expect(strategies.length).toBe(2); // error-strategy (8) and task-strategy (6)
    });

    it('should search by text', async () => {
      const strategies = await registry.searchStrategies({ searchText: 'error' });
      expect(strategies.length).toBe(1);
      expect(strategies[0].id).toBe('error-strategy');
    });

    it('should sort by priority descending by default', async () => {
      const strategies = await registry.searchStrategies();
      expect(strategies[0].priority!).toBeGreaterThanOrEqual(strategies[1].priority!);
    });

    it('should sort by name ascending when specified', async () => {
      const strategies = await registry.searchStrategies({ 
        sortBy: 'name', 
        sortDirection: 'asc' 
      });
      expect(strategies[0].name.localeCompare(strategies[1].name)).toBeLessThanOrEqual(0);
    });

    it('should apply limit', async () => {
      const strategies = await registry.searchStrategies({ limit: 2 });
      expect(strategies.length).toBe(2);
    });
  });

  describe('templates', () => {
    it('should register and retrieve templates', async () => {
      const template: StrategyTemplate = {
        id: 'error-template',
        name: 'Error Analysis Template',
        description: 'Template for error analysis strategies',
        trigger: 'error' as ReflectionTrigger,
        priority: 7,
        implementation: async () => ({
          success: true,
          insights: [],
          metrics: {},
          errors: [],
          executionTime: 100
        })
      };

      await registry.registerTemplate(template);
      const retrieved = await registry.getTemplate('error-template');
      
      expect(retrieved).toEqual(template);
    });

    it('should list all templates', async () => {
      const template: StrategyTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerTemplate(template);
      const templates = await registry.listTemplates();
      
      expect(templates.length).toBe(1);
      expect(templates[0]).toEqual(template);
    });

    it('should create strategy from template', async () => {
      const template: StrategyTemplate = {
        id: 'creation-template',
        name: 'Creation Template',
        description: 'Template for creating strategies',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerTemplate(template);
      const strategy = await registry.createFromTemplate('creation-template', {
        name: 'Custom Strategy Name'
      });
      
      expect(strategy.name).toBe('Custom Strategy Name');
      expect(strategy.description).toBe(template.description);
      expect(strategy.trigger).toBe(template.trigger);
      expect(strategy.priority).toBe(template.priority);
      expect(strategy.id).toBeDefined();
      expect(strategy.createdAt).toBeDefined();
      expect(strategy.updatedAt).toBeDefined();
    });

    it('should throw error for duplicate template ID', async () => {
      const template: StrategyTemplate = {
        id: 'duplicate-template',
        name: 'Template',
        description: 'A template',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerTemplate(template);
      await expect(registry.registerTemplate(template)).rejects.toThrow(StrategyRegistryError);
    });

    it('should throw error when creating from non-existent template', async () => {
      await expect(registry.createFromTemplate('non-existent')).rejects.toThrow(StrategyRegistryError);
    });
  });

  describe('categories', () => {
    it('should register and retrieve categories', async () => {
      const category: StrategyCategory = {
        id: 'custom-category',
        name: 'Custom Category',
        description: 'A custom category',
        tags: ['custom', 'test']
      };

      await registry.registerCategory(category);
      const retrieved = await registry.getCategory('custom-category');
      
      expect(retrieved).toEqual(category);
    });

    it('should list all categories', async () => {
      const categories = await registry.listCategories();
      expect(categories.length).toBe(4); // Default categories
    });

    it('should throw error for duplicate category ID', async () => {
      const category: StrategyCategory = {
        id: 'duplicate-category',
        name: 'Category',
        description: 'A category',
        tags: ['test']
      };

      await registry.registerCategory(category);
      await expect(registry.registerCategory(category)).rejects.toThrow(StrategyRegistryError);
    });
  });

  describe('tags', () => {
    beforeEach(async () => {
      const strategy: ReflectionStrategy = {
        id: 'tagged-strategy',
        name: 'Tagged Strategy',
        description: 'A strategy with tags',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerStrategy(strategy);
    });

    it('should set and get strategy tags', async () => {
      await registry.setStrategyTags('tagged-strategy', ['error', 'debugging', 'analysis']);
      const tags = await registry.getStrategyTags('tagged-strategy');
      
      expect(tags).toEqual(['error', 'debugging', 'analysis']);
    });

    it('should get all available tags', async () => {
      await registry.setStrategyTags('tagged-strategy', ['error', 'debugging']);
      const allTags = await registry.getAllTags();
      
      expect(allTags).toContain('error');
      expect(allTags).toContain('debugging');
    });

    it('should get strategies by tag', async () => {
      await registry.setStrategyTags('tagged-strategy', ['error']);
      const strategies = await registry.getStrategiesByTag('error');
      
      expect(strategies.length).toBe(1);
      expect(strategies[0].id).toBe('tagged-strategy');
    });

    it('should throw error when setting tags for non-existent strategy', async () => {
      await expect(registry.setStrategyTags('non-existent', ['tag'])).rejects.toThrow(StrategyRegistryError);
    });

    it('should return empty array for non-existent tag', async () => {
      const strategies = await registry.getStrategiesByTag('non-existent-tag');
      expect(strategies).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      const strategy: ReflectionStrategy = {
        id: 'stats-strategy',
        name: 'Stats Strategy',
        description: 'Strategy for stats testing',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      const template: StrategyTemplate = {
        id: 'stats-template',
        name: 'Stats Template',
        description: 'Template for stats testing',
        trigger: 'error' as ReflectionTrigger,
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerStrategy(strategy, ['error', 'testing']);
      await registry.registerTemplate(template);

      const stats = registry.getStats();
      
      expect(stats.totalStrategies).toBe(1);
      expect(stats.totalTemplates).toBe(1);
      expect(stats.totalCategories).toBe(4);
      expect(stats.totalTags).toBe(2);
      expect(stats.enabledStrategies).toBe(1);
      expect(stats.tagDistribution.error).toBe(1);
      expect(stats.tagDistribution.testing).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data and reinitialize categories', async () => {
      const strategy: ReflectionStrategy = {
        id: 'clear-strategy',
        name: 'Clear Strategy',
        description: 'Strategy for clear testing',
        trigger: 'error' as ReflectionTrigger,
        priority: 5,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        implementation: async () => ({ success: true, insights: [], metrics: {}, errors: [], executionTime: 100 })
      };

      await registry.registerStrategy(strategy);
      await registry.clear();

      const stats = registry.getStats();
      expect(stats.totalStrategies).toBe(0);
      expect(stats.totalCategories).toBe(4); // Default categories should be re-initialized
    });
  });
}); 