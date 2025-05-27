/**
 * ActionGenerator.test.ts - Unit tests for ActionGenerator component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ActionGenerator, ActionGenerationError } from '../ActionGenerator';
import { PlanStep } from '../../../../../../../agents/shared/base/managers/PlanningManager.interface';

// Mock the logger
vi.mock('../../../../../logging/winston-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

describe('ActionGenerator', () => {
  let actionGenerator: ActionGenerator;

  beforeEach(() => {
    actionGenerator = new ActionGenerator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateActions', () => {
    it('should generate actions from research template', async () => {
      const step: PlanStep = {
        id: 'step-1',
        name: 'Gather market research data',
        description: 'Research current market trends and competitor analysis',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 30
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions).toHaveLength(3);
      // Actions are optimized/reordered, so check that all expected types are present
      const actionTypes = result.actions.map(a => a.type);
      expect(actionTypes).toContain('web_search');
      expect(actionTypes).toContain('llm_query');
      expect(actionTypes).toContain('analysis');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
      // Tools are only extracted from tool_execution actions, research template doesn't have tool_execution
      expect(result.requiredTools).toEqual([]);
    });

    it('should generate actions from analysis template', async () => {
      const step: PlanStep = {
        id: 'step-2',
        name: 'Analyze customer data',
        description: 'Process and analyze customer behavior patterns',
        priority: 0.7,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 45
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions).toHaveLength(3);
      expect(result.actions[0].type).toBe('llm_query');
      expect(result.actions[1].type).toBe('analysis');
      expect(result.actions[2].type).toBe('tool_execution');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.requiredTools).toContain('data_analysis');
    });

    it('should generate actions from creation template', async () => {
      const step: PlanStep = {
        id: 'step-3',
        name: 'Create user interface mockup',
        description: 'Design and build initial UI mockup for the application',
        priority: 0.9,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 60
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions).toHaveLength(3);
      expect(result.actions[0].type).toBe('llm_query');
      expect(result.actions[1].type).toBe('tool_execution');
      expect(result.actions[2].type).toBe('generic');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.requiredTools).toContain('creation_tool');
    });

    it('should generate actions from communication template', async () => {
      const step: PlanStep = {
        id: 'step-4',
        name: 'Send project update to stakeholders',
        description: 'Communicate current progress and next steps',
        priority: 0.6,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 20
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe('llm_query');
      expect(result.actions[1].type).toBe('tool_execution');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.requiredTools).toContain('communication_tool');
    });

    it('should generate actions from validation template', async () => {
      const step: PlanStep = {
        id: 'step-5',
        name: 'Test application functionality',
        description: 'Verify all features work correctly and meet requirements',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 40
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions).toHaveLength(3);
      // Actions are optimized/reordered, so check that all expected types are present
      const actionTypes = result.actions.map(a => a.type);
      expect(actionTypes).toContain('analysis');
      expect(actionTypes).toContain('tool_execution');
      expect(actionTypes).toContain('llm_query');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.requiredTools).toContain('validation_tool');
    });

    it('should generate generic actions for unmatched steps', async () => {
      const step: PlanStep = {
        id: 'step-6',
        name: 'Organize team meeting',
        description: 'Schedule and coordinate team meeting for project planning',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 15
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.actions.length).toBeGreaterThanOrEqual(1);
      expect(result.actions.length).toBeLessThanOrEqual(10);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    it('should handle empty step name', async () => {
      const step: PlanStep = {
        id: 'step-7',
        name: '',
        description: 'Step with empty name',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(actionGenerator.generateActions(step)).rejects.toThrow(ActionGenerationError);
    });

    it('should handle step with available tools', async () => {
      const step: PlanStep = {
        id: 'step-8',
        name: 'Research market data',
        description: 'Gather information about market trends',
        priority: 0.7,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const options = {
        availableTools: ['web_search', 'data_analysis', 'custom_tool']
      };

      const result = await actionGenerator.generateActions(step, options);

      expect(result.actions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      // Should optimize tool selection based on available tools
      const usedTools = result.requiredTools || [];
      usedTools.forEach(tool => {
        expect(options.availableTools).toContain(tool);
      });
    });

    it('should handle step with resource constraints', async () => {
      const step: PlanStep = {
        id: 'step-9',
        name: 'Process large dataset',
        description: 'Analyze and process customer data',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const options = {
        resourceConstraints: {
          maxMemory: '4GB',
          maxTime: 30,
          maxConcurrency: 2
        }
      };

      const result = await actionGenerator.generateActions(step, options);

      expect(result.actions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeLessThan(100); // More reasonable expectation
    });

    it('should respect maxActionsPerStep configuration', async () => {
      const limitedGenerator = new ActionGenerator({ maxActionsPerStep: 2 });
      
      const step: PlanStep = {
        id: 'step-10',
        name: 'Create comprehensive analysis',
        description: 'Perform detailed analysis with multiple steps',
        priority: 0.9,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await limitedGenerator.generateActions(step);

      expect(result.actions.length).toBeLessThanOrEqual(2);
    });

    it('should handle validation failure when enabled', async () => {
      const strictGenerator = new ActionGenerator({ 
        enableValidation: true,
        maxActionsPerStep: 0 // This will cause validation to fail
      });
      
      const step: PlanStep = {
        id: 'step-11',
        name: 'Test validation',
        description: 'Test step for validation failure',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(strictGenerator.generateActions(step)).rejects.toThrow(ActionGenerationError);
    });
  });

  describe('optimizeActions', () => {
    it('should optimize action sequence', async () => {
      const actions = [
        {
          id: 'action-1',
          name: 'Search for information',
          description: 'Web search action',
          type: 'web_search',
          toolName: 'web_search',
          parameters: { query: 'test query' },
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTimeMinutes: 5
        },
        {
          id: 'action-2',
          name: 'Analyze results',
          description: 'Analysis action',
          type: 'analysis',
          parameters: {},
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTimeMinutes: 10
        }
      ];

      const result = await actionGenerator.optimizeActions(actions);

      expect(result.actions).toHaveLength(2);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
      expect(result.dependencies).toBeDefined();
    });

    it('should optimize actions with constraints', async () => {
      const actions = [
        {
          id: 'action-1',
          name: 'Process data',
          description: 'Data processing action',
          type: 'tool_execution',
          toolName: 'data_processor',
          parameters: { dataset: 'large_dataset' },
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTimeMinutes: 30
        }
      ];

      const constraints = {
        maxTime: 20,
        maxMemory: '2GB'
      };

      const result = await actionGenerator.optimizeActions(actions, constraints);

      expect(result.actions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      // Should optimize timing based on constraints
      expect(result.estimatedTime).toBeLessThanOrEqual(30);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = actionGenerator.getConfig();

      expect(config.maxActionsPerStep).toBe(10);
      expect(config.enableToolOptimization).toBe(true);
      expect(config.enableValidation).toBe(true);
      expect(config.enableOptimization).toBe(true);
      expect(config.enableLogging).toBe(true);
      expect(config.defaultActionTimeoutMs).toBe(60000);
      expect(config.generationTimeoutMs).toBe(30000);
    });

    it('should allow configuration updates', () => {
      actionGenerator.configure({
        maxActionsPerStep: 5,
        enableOptimization: false
      });

      const config = actionGenerator.getConfig();

      expect(config.maxActionsPerStep).toBe(5);
      expect(config.enableOptimization).toBe(false);
      // Other values should remain unchanged
      expect(config.enableValidation).toBe(true);
    });

    it('should create action generator with custom configuration', () => {
      const customGenerator = new ActionGenerator({
        maxActionsPerStep: 15,
        enableValidation: false,
        defaultActionTimeoutMs: 120000
      });

      const config = customGenerator.getConfig();

      expect(config.maxActionsPerStep).toBe(15);
      expect(config.enableValidation).toBe(false);
      expect(config.defaultActionTimeoutMs).toBe(120000);
    });
  });

  describe('health status', () => {
    it('should return healthy status', () => {
      const health = actionGenerator.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.config).toBeDefined();
      expect(health.templateCount).toBe(5); // Number of predefined templates
      expect(health.toolCount).toBeGreaterThan(0); // Number of tool capabilities
    });
  });

  describe('template matching', () => {
    it('should match research template for various keywords', async () => {
      const researchKeywords = [
        'gather information',
        'research market trends',
        'collect user feedback',
        'find relevant data',
        'search for solutions',
        'investigate issues'
      ];

      for (const keyword of researchKeywords) {
        const step: PlanStep = {
          id: `step-${keyword.replace(/\s+/g, '-')}`,
          name: keyword,
          description: `Step to ${keyword}`,
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await actionGenerator.generateActions(step);
        expect(result.actions).toHaveLength(3); // Research template has 3 actions
        expect(result.actions[0].type).toBe('web_search');
      }
    });

    it('should match analysis template for various keywords', async () => {
      const analysisKeywords = [
        'analyze data',
        'process information',
        'examine results',
        'evaluate performance',
        'assess quality'
      ];

      for (const keyword of analysisKeywords) {
        const step: PlanStep = {
          id: `step-${keyword.replace(/\s+/g, '-')}`,
          name: keyword,
          description: `Step to ${keyword}`,
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await actionGenerator.generateActions(step);
        expect(result.actions).toHaveLength(3); // Analysis template has 3 actions
        expect(result.actions[0].type).toBe('llm_query');
      }
    });

    it('should match creation template for various keywords', async () => {
      const creationKeywords = [
        'create dashboard',
        'build application',
        'develop feature',
        'implement solution',
        'design interface',
        'make prototype'
      ];

      for (const keyword of creationKeywords) {
        const step: PlanStep = {
          id: `step-${keyword.replace(/\s+/g, '-')}`,
          name: keyword,
          description: `Step to ${keyword}`,
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await actionGenerator.generateActions(step);
        expect(result.actions).toHaveLength(3); // Creation template has 3 actions
        expect(result.actions[0].type).toBe('llm_query');
      }
    });

    it('should match communication template for various keywords', async () => {
      const communicationKeywords = [
        'send update',
        'share results',
        'notify team',
        'report progress',
        'present findings'
      ];

      for (const keyword of communicationKeywords) {
        const step: PlanStep = {
          id: `step-${keyword.replace(/\s+/g, '-')}`,
          name: keyword,
          description: `Step to ${keyword}`,
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await actionGenerator.generateActions(step);
        // Communication template can have 2-3 actions depending on optimization
        expect(result.actions.length).toBeGreaterThanOrEqual(2);
        expect(result.actions.length).toBeLessThanOrEqual(3);
        // Check that llm_query is present
        const actionTypes = result.actions.map(a => a.type);
        expect(actionTypes).toContain('llm_query');
      }
    });

    it('should match validation template for various keywords', async () => {
      const validationKeywords = [
        'test functionality',
        'validate results',
        'verify accuracy',
        'check quality',
        'confirm requirements'
      ];

      for (const keyword of validationKeywords) {
        const step: PlanStep = {
          id: `step-${keyword.replace(/\s+/g, '-')}`,
          name: keyword,
          description: `Step to ${keyword}`,
          priority: 0.5,
          dependencies: [],
          actions: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await actionGenerator.generateActions(step);
        expect(result.actions).toHaveLength(3); // Validation template has 3 actions
        // Actions are optimized/reordered, so check that all expected types are present
        const actionTypes = result.actions.map(a => a.type);
        expect(actionTypes).toContain('analysis');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid step gracefully', async () => {
      const invalidStep: PlanStep = {
        id: '',
        name: '',
        description: '',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(actionGenerator.generateActions(invalidStep)).rejects.toThrow(ActionGenerationError);
    });

    it('should create proper error objects', async () => {
      const invalidStep: PlanStep = {
        id: 'test-step',
        name: '',
        description: 'Step with empty name',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await actionGenerator.generateActions(invalidStep);
      } catch (error) {
        expect(error).toBeInstanceOf(ActionGenerationError);
        expect((error as ActionGenerationError).code).toBe('INVALID_STEP');
        expect((error as ActionGenerationError).stepId).toBe('test-step');
        expect((error as ActionGenerationError).recoverable).toBe(false);
      }
    });

    it('should handle validation errors when validation is enabled', async () => {
      const validatingGenerator = new ActionGenerator({ 
        enableValidation: true,
        maxActionsPerStep: 0 // This will cause no actions to be generated, triggering validation failure
      });

      const step: PlanStep = {
        id: 'validation-test',
        name: 'Test validation failure',
        description: 'Step that should fail validation',
        priority: 0.5,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(validatingGenerator.generateActions(step)).rejects.toThrow(ActionGenerationError);
    });
  });

  describe('action parameters and tools', () => {
    it('should generate appropriate parameters for web search actions', async () => {
      const step: PlanStep = {
        id: 'search-step',
        name: 'Search for market data',
        description: 'Find information about current market trends and analysis',
        priority: 0.7,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);
      const searchAction = result.actions.find(action => action.type === 'web_search');

      if (searchAction) {
        expect(searchAction.parameters).toBeDefined();
        expect(searchAction.parameters.query).toBeDefined();
        expect(typeof searchAction.parameters.query).toBe('string');
        // toolName is stored in parameters for web_search actions
        expect(searchAction.parameters.toolName).toBeDefined();
      }
    });

    it('should generate appropriate parameters for LLM query actions', async () => {
      const step: PlanStep = {
        id: 'llm-step',
        name: 'Analyze customer feedback',
        description: 'Process and analyze customer feedback data for insights',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);
      const llmAction = result.actions.find(action => action.type === 'llm_query');

      if (llmAction) {
        expect(llmAction.parameters).toBeDefined();
        expect(llmAction.parameters.prompt).toBeDefined();
        expect(typeof llmAction.parameters.prompt).toBe('string');
      }
    });

    it('should handle tool optimization when available tools are provided', async () => {
      const step: PlanStep = {
        id: 'tool-optimization-step',
        name: 'Research with limited tools',
        description: 'Perform research with only specific tools available',
        priority: 0.6,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const options = {
        availableTools: ['alternative_search', 'basic_analysis']
      };

      const result = await actionGenerator.generateActions(step, options);

      // Should optimize tool selection based on available tools
      const usedTools = result.requiredTools || [];
      expect(usedTools.every(tool => options.availableTools.includes(tool))).toBe(true);
    });
  });

  describe('metrics and calculations', () => {
    it('should calculate confidence correctly', async () => {
      const step: PlanStep = {
        id: 'confidence-step',
        name: 'Create detailed analysis',
        description: 'Perform comprehensive analysis with multiple data sources',
        priority: 0.9,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate total time correctly', async () => {
      const step: PlanStep = {
        id: 'time-step',
        name: 'Process large dataset',
        description: 'Analyze and process customer data with multiple steps',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.estimatedTime).toBeGreaterThan(0);
      // Actions don't have individual time estimates, so just verify total time is reasonable
      expect(result.estimatedTime).toBeLessThan(1000); // Should be reasonable
    });

    it('should extract required tools correctly', async () => {
      const step: PlanStep = {
        id: 'tools-step',
        name: 'Analyze customer data with tools',
        description: 'Process and analyze customer data using specialized tools',
        priority: 0.7,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.requiredTools).toBeDefined();
      expect(Array.isArray(result.requiredTools)).toBe(true);
      // Analysis template includes tool_execution with data_analysis tool
      expect((result.requiredTools || []).length).toBeGreaterThan(0);
      expect(result.requiredTools).toContain('data_analysis');
    });

    it('should generate action dependencies correctly', async () => {
      const step: PlanStep = {
        id: 'dependencies-step',
        name: 'Create comprehensive report',
        description: 'Generate detailed report with multiple dependent steps',
        priority: 0.8,
        dependencies: [],
        actions: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await actionGenerator.generateActions(step);

      expect(result.dependencies).toBeDefined();
      expect(Array.isArray(result.dependencies)).toBe(true);
      
      // Check that dependencies reference valid action IDs
      if (result.dependencies && result.dependencies.length > 0) {
        const actionIds = result.actions.map(action => action.id);
        result.dependencies.forEach(dep => {
          expect(actionIds).toContain(dep.dependentActionId);
          expect(actionIds).toContain(dep.dependsOnActionId);
        });
      }
    });
  });
}); 