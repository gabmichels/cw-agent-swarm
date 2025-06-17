/**
 * Agent Template Service Implementation
 * 
 * Provides comprehensive agent template management including template creation,
 * agent spawning from templates, template versioning, and template analytics.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID strings for all identifiers
 * - NO 'any' types - strict TypeScript typing
 * - Proper error handling with custom error types
 * - Clean break from legacy patterns
 */

import { ulid } from 'ulid';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PlatformConfigService } from '../PlatformConfigService';
import { 
  AgentConfigTemplate,
  AgentTemplateConfig,
  TemplateCategory,
  AgentDepartmentAssignment
} from '../../types/organization';
import { AgentCapability } from '../../agents/shared/base/types';
import { AgentMetadata, AgentStatus } from '../../types/metadata';
import {
  AgentTemplateError,
  TemplateNotFoundError,
  TemplateValidationError,
  AgentSpawningError,
  InvalidPlatformModeError
} from '../../lib/errors/OrganizationErrors';
import { Result, successResult, failureResult } from '../../lib/errors/base';

/**
 * Agent spawning request interface
 */
export interface AgentSpawnRequest {
  templateId: string; // ULID
  agentName: string;
  agentDescription?: string;
  targetDepartment?: string; // ULID
  targetSubDepartment?: string;
  targetTeam?: string;
  targetPosition?: string;
  customConfig?: Record<string, unknown>;
  organizationLevel?: number;
}

/**
 * Template analytics interface
 */
export interface TemplateAnalytics {
  templateId: string; // ULID
  templateName: string;
  usageCount: number;
  successRate: number; // 0-1
  averagePerformance: number; // 0-1
  spawnedAgents: TemplateSpawnedAgent[];
  popularityRank: number;
  lastUsed?: Date;
  recommendations: TemplateRecommendation[];
}

/**
 * Spawned agent summary for analytics
 */
export interface TemplateSpawnedAgent {
  agentId: string; // ULID
  agentName: string;
  spawnedAt: Date;
  departmentId?: string; // ULID
  departmentName?: string;
  currentStatus: string;
  performanceScore: number; // 0-1
}

/**
 * Template improvement recommendations
 */
export interface TemplateRecommendation {
  type: 'configuration' | 'capabilities' | 'positioning' | 'optimization';
  priority: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  implementationEffort: 'simple' | 'moderate' | 'complex';
}

/**
 * Template search filters
 */
export interface TemplateSearchFilter {
  categories?: TemplateCategory[];
  capabilities?: string[];
  minUsageCount?: number;
  maxUsageCount?: number;
  minSuccessRate?: number;
  isPublic?: boolean;
  createdBy?: string; // ULID
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Agent template service interface
 */
export interface IAgentTemplateService {
  // Template CRUD operations
  createTemplate(template: Omit<AgentConfigTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>): Promise<Result<AgentConfigTemplate>>;
  getTemplate(templateId: string): Promise<Result<AgentConfigTemplate>>;
  updateTemplate(templateId: string, updates: Partial<AgentConfigTemplate>): Promise<Result<AgentConfigTemplate>>;
  deleteTemplate(templateId: string): Promise<Result<void>>;
  listTemplates(filter?: TemplateSearchFilter): Promise<Result<AgentConfigTemplate[]>>;
  
  // Template operations
  extractTemplateFromAgent(agentId: string, templateName: string, templateDescription: string): Promise<Result<AgentConfigTemplate>>;
  spawnAgentFromTemplate(request: AgentSpawnRequest): Promise<Result<AgentMetadata>>;
  validateTemplate(template: AgentConfigTemplate): Promise<Result<boolean>>;
  
  // Analytics and insights
  getTemplateAnalytics(templateId: string): Promise<Result<TemplateAnalytics>>;
  getPopularTemplates(limit?: number): Promise<Result<AgentConfigTemplate[]>>;
  searchTemplates(query: string, filter?: TemplateSearchFilter): Promise<Result<AgentConfigTemplate[]>>;
}

/**
 * Agent Template Service implementation
 */
export class AgentTemplateService implements IAgentTemplateService {
  private readonly templatesCollectionName = 'agent_templates';
  private readonly agentsCollectionName = 'agents';

  constructor(
    private readonly qdrantClient: QdrantClient,
    private readonly platformConfig: PlatformConfigService
  ) {}

  /**
   * Creates a new agent template
   */
  async createTemplate(
    template: Omit<AgentConfigTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>
  ): Promise<Result<AgentConfigTemplate>> {
    try {
      // Validate template
      const validationResult = await this.validateTemplateData(template);
      if (!validationResult.success) {
        return failureResult(validationResult.error!);
      }

      // Create template with ULID
      const templateId = ulid();
      const now = new Date();
      
      const newTemplate: AgentConfigTemplate = {
        ...template,
        id: templateId,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        lastUsed: undefined
      };

      // Store in Qdrant
      await this.qdrantClient.upsert(this.templatesCollectionName, {
        wait: true,
        points: [{
          id: templateId,
          payload: newTemplate as unknown as Record<string, unknown>,
          vector: await this.generateTemplateVector(newTemplate)
        }]
      });

      return successResult(newTemplate);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to create template',
        'CREATE_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Retrieves a template by ID
   */
  async getTemplate(templateId: string): Promise<Result<AgentConfigTemplate>> {
    try {
      const response = await this.qdrantClient.retrieve(this.templatesCollectionName, {
        ids: [templateId],
        with_payload: true
      });

      if (response.length === 0) {
        return failureResult(new TemplateNotFoundError(templateId));
      }

      const template = response[0].payload as unknown as AgentConfigTemplate;
      return successResult(template);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to retrieve template',
        'RETRIEVE_FAILED',
        { templateId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Updates an existing template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<AgentConfigTemplate>
  ): Promise<Result<AgentConfigTemplate>> {
    try {
      // Get existing template
      const existingResult = await this.getTemplate(templateId);
      if (!existingResult.success) {
        return failureResult(existingResult.error!);
      }

      const existing = existingResult.data!;
      
      // Update template
      const updatedTemplate: AgentConfigTemplate = {
        ...existing,
        ...updates,
        id: templateId, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      // Validate updated template
      const validationResult = await this.validateTemplateData(updatedTemplate);
      if (!validationResult.success) {
        return failureResult(validationResult.error!);
      }

      // Store updated template
      await this.qdrantClient.upsert(this.templatesCollectionName, {
        wait: true,
        points: [{
          id: templateId,
          payload: updatedTemplate as unknown as Record<string, unknown>,
          vector: await this.generateTemplateVector(updatedTemplate)
        }]
      });

      return successResult(updatedTemplate);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to update template',
        'UPDATE_FAILED',
        { templateId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Deletes a template
   */
  async deleteTemplate(templateId: string): Promise<Result<void>> {
    try {
      // Check if template exists
      const existingResult = await this.getTemplate(templateId);
      if (!existingResult.success) {
        return failureResult(existingResult.error!);
      }

      // Check if template is in use
      const usageResult = await this.checkTemplateUsage(templateId);
      if (!usageResult.success) {
        return failureResult(usageResult.error!);
      }

      if (usageResult.data! > 0) {
        return failureResult(new AgentTemplateError(
          'Cannot delete template that is currently in use',
          'TEMPLATE_IN_USE',
          { templateId, usageCount: usageResult.data }
        ));
      }

      // Delete from Qdrant
      await this.qdrantClient.delete(this.templatesCollectionName, {
        wait: true,
        points: [templateId]
      });

      return successResult(undefined);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to delete template',
        'DELETE_FAILED',
        { templateId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Lists templates with optional filtering
   */
  async listTemplates(filter?: TemplateSearchFilter): Promise<Result<AgentConfigTemplate[]>> {
    try {
      const response = await this.qdrantClient.scroll(this.templatesCollectionName, {
        limit: 1000,
        with_payload: true
      });

      let templates = response.points.map(point => point.payload as unknown as AgentConfigTemplate);

      // Apply filters
      if (filter) {
        templates = this.applyTemplateFilters(templates, filter);
      }

      return successResult(templates);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to list templates',
        'LIST_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Extracts a template from an existing agent
   */
  async extractTemplateFromAgent(
    agentId: string, 
    templateName: string, 
    templateDescription: string
  ): Promise<Result<AgentConfigTemplate>> {
    try {
      // Get agent data
      const agentResponse = await this.qdrantClient.retrieve(this.agentsCollectionName, {
        ids: [agentId],
        with_payload: true
      });

      if (agentResponse.length === 0) {
        return failureResult(new AgentTemplateError(
          `Source agent not found: ${agentId}`,
          'AGENT_NOT_FOUND',
          { agentId }
        ));
      }

      const agent = agentResponse[0].payload as unknown as AgentMetadata;

      // Extract configuration
      const templateConfig: AgentTemplateConfig = {
        version: agent.version || '1.0.0',
        isPublic: agent.isPublic || false,
        communicationStyle: 'formal', // Default value
        responseLength: 'moderate', // Default value
        expertise: agent.specialization || [],
        maxConcurrentTasks: 5, // Default value
        responseTimeTarget: 5000, // Default 5 seconds
        allowedTools: [], // Would need to be extracted from actual agent config
        restrictedDomains: [], // Would need to be extracted from actual agent config
        customParams: {} // Would need to be extracted from actual agent config
      };

      // Create template
      const template: Omit<AgentConfigTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'> = {
        name: templateName,
        description: templateDescription,
        sourceAgentId: agentId,
        capabilities: (agent.capabilities || []) as AgentCapability[],
        defaultCategory: agent.category,
        defaultDepartment: agent.department ? {
          id: agent.department.id,
          name: agent.department.name,
          code: agent.department.code
        } : undefined,
        defaultPosition: agent.position,
        configParams: templateConfig,
        templateCategory: this.inferTemplateCategory(agent),
        tags: this.generateTemplateTags(agent),
        isPublic: false,
        createdBy: 'system' // TODO: Get from context
      };

      return await this.createTemplate(template);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to extract template from agent',
        'EXTRACTION_FAILED',
        { agentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Spawns a new agent from a template
   */
  async spawnAgentFromTemplate(request: AgentSpawnRequest): Promise<Result<AgentMetadata>> {
    try {
      // Get template
      const templateResult = await this.getTemplate(request.templateId);
      if (!templateResult.success) {
        return failureResult(templateResult.error!);
      }

      const template = templateResult.data!;

      // Validate spawn request
      const validationResult = await this.validateSpawnRequest(request, template);
      if (!validationResult.success) {
        return failureResult(validationResult.error!);
      }

      // Create agent ID
      const agentId = ulid();
      const now = new Date();

      // Determine department and category based on platform mode
      let category: string | undefined;
      let department: AgentMetadata['department'];

      if (this.platformConfig.isPersonalMode()) {
        category = template.defaultCategory || 'General';
      } else if (this.platformConfig.isOrganizationalMode()) {
        if (request.targetDepartment) {
          // Get department details
          const deptResponse = await this.qdrantClient.retrieve('departments', {
            ids: [request.targetDepartment],
            with_payload: true
          });

          if (deptResponse.length > 0) {
            const dept = deptResponse[0].payload as unknown as { id: string; name: string; code: string };
            department = {
              id: dept.id,
              name: dept.name,
              code: dept.code
            };
          }
        } else if (template.defaultDepartment) {
          department = template.defaultDepartment;
        }
      }

      // Merge configurations
      const finalConfig: AgentTemplateConfig = {
        ...template.configParams,
        ...request.customConfig
      };

      // Create new agent
      const newAgent: AgentMetadata = {
        schemaVersion: '1.0.0',
        agentId: agentId,
        name: request.agentName,
        description: request.agentDescription || template.description,
        status: AgentStatus.AVAILABLE,
        createdAt: now,
        updatedAt: now,
        version: finalConfig.version,
        isPublic: finalConfig.isPublic,
        domain: [],
        specialization: finalConfig.expertise,
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        category,
        department,
        position: request.targetPosition || template.defaultPosition,
        organizationLevel: request.organizationLevel || 1,
        capabilities: template.capabilities,
        metadata: {
          templateId: template.id,
          spawnedAt: now,
          configVersion: finalConfig.version
        }
      };

      // Store agent in Qdrant
      await this.qdrantClient.upsert(this.agentsCollectionName, {
        wait: true,
        points: [{
          id: agentId,
          payload: newAgent as unknown as Record<string, unknown>,
          vector: await this.generateAgentVector(newAgent)
        }]
      });

      // Update template usage count
      await this.incrementTemplateUsage(template.id);

      return successResult(newAgent);

    } catch (error) {
      return failureResult(new AgentSpawningError(
        'Failed to spawn agent from template',
        'SPAWN_FAILED',
        { request, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Validates a template configuration
   */
  async validateTemplate(template: AgentConfigTemplate): Promise<Result<boolean>> {
    return await this.validateTemplateData(template);
  }

  /**
   * Gets comprehensive analytics for a template
   */
  async getTemplateAnalytics(templateId: string): Promise<Result<TemplateAnalytics>> {
    try {
      // Get template
      const templateResult = await this.getTemplate(templateId);
      if (!templateResult.success) {
        return failureResult(templateResult.error!);
      }

      const template = templateResult.data!;

      // Get all agents spawned from this template
      const agentsResponse = await this.qdrantClient.scroll(this.agentsCollectionName, {
        filter: {
          must: [{
            key: 'metadata.templateId',
            match: { value: templateId }
          }]
        },
        limit: 1000,
        with_payload: true
      });

      const spawnedAgents = agentsResponse.points.map(point => point.payload as unknown as AgentMetadata);

      // Calculate analytics
      const spawnedAgentSummaries: TemplateSpawnedAgent[] = spawnedAgents.map(agent => ({
        agentId: agent.agentId,
        agentName: agent.name,
        spawnedAt: agent.metadata?.spawnedAt || agent.createdAt || new Date(),
        departmentId: agent.department?.id,
        departmentName: agent.department?.name,
        currentStatus: agent.status,
        performanceScore: agent.performanceMetrics?.successRate || 0
      }));

      const averagePerformance = spawnedAgents.length > 0
        ? spawnedAgents.reduce((sum, agent) => sum + (agent.performanceMetrics?.successRate || 0), 0) / spawnedAgents.length
        : 0;

      const successRate = spawnedAgents.length > 0
        ? spawnedAgents.filter(agent => (agent.performanceMetrics?.successRate || 0) > 0.7).length / spawnedAgents.length
        : 0;

      const analytics: TemplateAnalytics = {
        templateId: template.id,
        templateName: template.name,
        usageCount: template.usageCount,
        successRate,
        averagePerformance,
        spawnedAgents: spawnedAgentSummaries,
        popularityRank: await this.calculatePopularityRank(templateId),
        lastUsed: template.lastUsed,
        recommendations: await this.generateTemplateRecommendations(template, spawnedAgents)
      };

      return successResult(analytics);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to get template analytics',
        'ANALYTICS_FAILED',
        { templateId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets popular templates by usage
   */
  async getPopularTemplates(limit: number = 10): Promise<Result<AgentConfigTemplate[]>> {
    try {
      const templatesResult = await this.listTemplates();
      if (!templatesResult.success) {
        return failureResult(templatesResult.error!);
      }

      const templates = templatesResult.data!
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);

      return successResult(templates);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to get popular templates',
        'POPULAR_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Searches templates by query and filters
   */
  async searchTemplates(
    query: string, 
    filter?: TemplateSearchFilter
  ): Promise<Result<AgentConfigTemplate[]>> {
    try {
      const templatesResult = await this.listTemplates(filter);
      if (!templatesResult.success) {
        return failureResult(templatesResult.error!);
      }

      const searchTerm = query.toLowerCase();
      const filteredTemplates = templatesResult.data!.filter(template =>
        template.name.toLowerCase().includes(searchTerm) ||
        template.description.toLowerCase().includes(searchTerm) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        template.configParams.expertise.some(skill => skill.toLowerCase().includes(searchTerm))
      );

      return successResult(filteredTemplates);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to search templates',
        'SEARCH_FAILED',
        { query, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  // Private helper methods

  /**
   * Validates template data
   */
  private async validateTemplateData(
    template: Partial<AgentConfigTemplate>
  ): Promise<Result<boolean>> {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.description || template.description.trim().length === 0) {
      errors.push('Template description is required');
    }

    if (template.name && template.name.length > 100) {
      errors.push('Template name must be 100 characters or less');
    }

    if (template.description && template.description.length > 500) {
      errors.push('Template description must be 500 characters or less');
    }

    if (!template.capabilities || template.capabilities.length === 0) {
      errors.push('Template must have at least one capability');
    }

    if (!template.configParams?.expertise || template.configParams.expertise.length === 0) {
      errors.push('Template must specify areas of expertise');
    }

    if (errors.length > 0) {
      return failureResult(new TemplateValidationError(errors, template.id));
    }

    return successResult(true);
  }

  /**
   * Validates spawn request
   */
  private async validateSpawnRequest(
    request: AgentSpawnRequest,
    template: AgentConfigTemplate
  ): Promise<Result<boolean>> {
    const errors: string[] = [];

    if (!request.agentName || request.agentName.trim().length === 0) {
      errors.push('Agent name is required');
    }

    if (request.agentName && request.agentName.length > 100) {
      errors.push('Agent name must be 100 characters or less');
    }

    // Validate platform mode requirements
    if (this.platformConfig.isOrganizationalMode() && !request.targetDepartment && !template.defaultDepartment) {
      errors.push('Department assignment is required in organizational mode');
    }

    if (errors.length > 0) {
      return failureResult(new AgentSpawningError(
        'Spawn request validation failed',
        'VALIDATION_FAILED',
        { validationErrors: errors }
      ));
    }

    return successResult(true);
  }

  /**
   * Checks how many agents are using this template
   */
  private async checkTemplateUsage(templateId: string): Promise<Result<number>> {
    try {
      const response = await this.qdrantClient.scroll(this.agentsCollectionName, {
        filter: {
          must: [{
            key: 'metadata.templateId',
            match: { value: templateId }
          }]
        },
        limit: 10000,
        with_payload: false
      });

      return successResult(response.points.length);

    } catch (error) {
      return failureResult(new AgentTemplateError(
        'Failed to check template usage',
        'USAGE_CHECK_FAILED',
        { templateId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Applies filters to template list
   */
  private applyTemplateFilters(
    templates: AgentConfigTemplate[],
    filter: TemplateSearchFilter
  ): AgentConfigTemplate[] {
    return templates.filter(template => {
      if (filter.categories && !filter.categories.includes(template.templateCategory)) {
        return false;
      }

      if (filter.capabilities && !filter.capabilities.some(cap => 
        template.configParams.expertise.includes(cap)
      )) {
        return false;
      }

      if (filter.minUsageCount && template.usageCount < filter.minUsageCount) {
        return false;
      }

      if (filter.maxUsageCount && template.usageCount > filter.maxUsageCount) {
        return false;
      }

      if (filter.isPublic !== undefined && template.isPublic !== filter.isPublic) {
        return false;
      }

      if (filter.createdBy && template.createdBy !== filter.createdBy) {
        return false;
      }

      if (filter.dateRange) {
        const createdAt = template.createdAt;
        if (createdAt < filter.dateRange.from || createdAt > filter.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Infers template category from agent data
   */
  private inferTemplateCategory(agent: AgentMetadata): TemplateCategory {
    if (agent.category) {
      switch (agent.category.toLowerCase()) {
        case 'finance': return TemplateCategory.FINANCE;
        case 'health': case 'fitness': return TemplateCategory.HEALTH_FITNESS;
        case 'education': return TemplateCategory.EDUCATION;
        case 'productivity': return TemplateCategory.PERSONAL_PRODUCTIVITY;
        default: return TemplateCategory.GENERAL;
      }
    }

    if (agent.position) {
      const position = agent.position.toLowerCase();
      if (position.includes('manager') || position.includes('director') || position.includes('lead')) {
        return TemplateCategory.MANAGEMENT;
      }
      if (position.includes('engineer') || position.includes('developer') || position.includes('technical')) {
        return TemplateCategory.TECHNICAL;
      }
      if (position.includes('support') || position.includes('service')) {
        return TemplateCategory.CUSTOMER_SERVICE;
      }
      if (position.includes('analyst') || position.includes('data')) {
        return TemplateCategory.ANALYTICS;
      }
    }

    return TemplateCategory.GENERAL;
  }

  /**
   * Generates relevant tags for template
   */
  private generateTemplateTags(agent: AgentMetadata): string[] {
    const tags: string[] = [];

    if (agent.specialization) {
      tags.push(...agent.specialization);
    }

    if (agent.category) {
      tags.push(agent.category);
    }

    if (agent.department) {
      tags.push(agent.department.name, agent.department.code);
    }

    if (agent.position) {
      tags.push(agent.position);
    }

    // Remove duplicates and convert to lowercase
    return [...new Set(tags.map(tag => tag.toLowerCase()))];
  }

  /**
   * Increments template usage count
   */
  private async incrementTemplateUsage(templateId: string): Promise<void> {
    const templateResult = await this.getTemplate(templateId);
    if (templateResult.success) {
      const template = templateResult.data!;
      template.usageCount++;
      template.lastUsed = new Date();

      await this.qdrantClient.upsert(this.templatesCollectionName, {
        wait: true,
        points: [{
          id: templateId,
          payload: template as unknown as Record<string, unknown>,
          vector: await this.generateTemplateVector(template)
        }]
      });
    }
  }

  /**
   * Calculates popularity rank for template
   */
  private async calculatePopularityRank(templateId: string): Promise<number> {
    const templatesResult = await this.listTemplates();
    if (!templatesResult.success) {
      return 0;
    }

    const templates = templatesResult.data!.sort((a, b) => b.usageCount - a.usageCount);
    const rank = templates.findIndex(t => t.id === templateId) + 1;
    return rank;
  }

  /**
   * Generates improvement recommendations for template
   */
  private async generateTemplateRecommendations(
    template: AgentConfigTemplate,
    spawnedAgents: AgentMetadata[]
  ): Promise<TemplateRecommendation[]> {
    const recommendations: TemplateRecommendation[] = [];

    // Low usage recommendation
    if (template.usageCount < 5) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        description: 'Consider improving template visibility or usefulness - low usage detected',
        impact: 'Increased template adoption',
        implementationEffort: 'simple'
      });
    }

    // Performance recommendation
    const avgPerformance = spawnedAgents.length > 0
      ? spawnedAgents.reduce((sum, agent) => sum + (agent.performanceMetrics?.successRate || 0), 0) / spawnedAgents.length
      : 0;

    if (avgPerformance < 0.7 && spawnedAgents.length > 3) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        description: 'Spawned agents show below-average performance - review template configuration',
        impact: 'Improved agent effectiveness',
        implementationEffort: 'moderate'
      });
    }

    return recommendations;
  }

  /**
   * Generates vector representation for template (for semantic search)
   */
  private async generateTemplateVector(template: AgentConfigTemplate): Promise<number[]> {
    const text = `${template.name} ${template.description} ${template.tags.join(' ')} ${template.configParams.expertise.join(' ')}`;
    
    // Create a simple hash-based vector
    const vector = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % 128] += charCode;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Generates vector representation for agent (for semantic search)
   */
  private async generateAgentVector(agent: AgentMetadata): Promise<number[]> {
    const text = `${agent.name} ${agent.description} ${agent.category || ''} ${agent.specialization.join(' ')}`;
    
    // Create a simple hash-based vector
    const vector = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % 128] += charCode;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }
} 