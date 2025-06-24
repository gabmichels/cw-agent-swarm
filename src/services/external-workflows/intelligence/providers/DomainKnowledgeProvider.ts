/**
 * DomainKnowledgeProvider Service
 * 
 * Provides comprehensive domain knowledge for workflow context building and LLM analysis.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { z } from 'zod';
import { 
  IDomainKnowledgeProvider,
  WorkflowContext 
} from '../WorkflowContextBuilder';

// Domain Knowledge Schemas
export const ToolIntegrationSchema = z.object({
  toolName: z.string(),
  aliases: z.array(z.string()),
  category: z.string(),
  capabilities: z.array(z.string()),
  apiRequirements: z.array(z.string()),
  commonUses: z.array(z.string())
});

export const WorkflowPatternSchema = z.object({
  pattern: z.string(),
  description: z.string(),
  useCases: z.array(z.string()),
  requiredTools: z.array(z.string()),
  complexity: z.enum(['low', 'medium', 'high'])
});

export const CategoryTaxonomySchema = z.object({
  category: z.string(),
  subcategories: z.array(z.string()),
  relatedTerms: z.array(z.string()),
  commonRequests: z.array(z.string())
});

export type ToolIntegration = z.infer<typeof ToolIntegrationSchema>;
export type WorkflowPattern = z.infer<typeof WorkflowPatternSchema>;
export type CategoryTaxonomy = z.infer<typeof CategoryTaxonomySchema>;

// Error Classes
export class DomainKnowledgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'DomainKnowledgeError';
  }
}

// Implementation
export class DomainKnowledgeProvider implements IDomainKnowledgeProvider {
  private toolIntegrationsCache: ToolIntegration[] | null = null;
  private workflowPatternsCache: WorkflowPattern[] | null = null;
  private categoryTaxonomyCache: CategoryTaxonomy[] | null = null;
  private cacheExpiry: Date | null = null;
  private readonly cacheExpiryHours = 24; // Cache for 24 hours

  constructor(
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
      warn: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  /**
   * Gets comprehensive tool integration knowledge
   */
  async getToolIntegrations(): Promise<WorkflowContext['domainKnowledge']['toolIntegrations']> {
    if (this.isCacheValid() && this.toolIntegrationsCache) {
      this.logger.info('Returning cached tool integrations');
      return this.toolIntegrationsCache;
    }

    try {
      this.logger.info('Building tool integrations knowledge base');
      
      const integrations = this.buildToolIntegrations();
      
      // Validate data
      const validatedIntegrations = z.array(ToolIntegrationSchema).parse(integrations);
      
      // Cache results
      this.toolIntegrationsCache = validatedIntegrations;
      this.updateCacheExpiry();
      
      this.logger.info('Tool integrations knowledge built', { 
        count: validatedIntegrations.length 
      });
      
      return validatedIntegrations;

    } catch (error) {
      this.logger.error('Failed to build tool integrations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new DomainKnowledgeError(
        'Failed to get tool integrations',
        'TOOL_INTEGRATIONS_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Gets workflow pattern knowledge
   */
  async getWorkflowPatterns(): Promise<WorkflowContext['domainKnowledge']['workflowPatterns']> {
    if (this.isCacheValid() && this.workflowPatternsCache) {
      this.logger.info('Returning cached workflow patterns');
      return this.workflowPatternsCache;
    }

    try {
      this.logger.info('Building workflow patterns knowledge base');
      
      const patterns = this.buildWorkflowPatterns();
      
      // Validate data
      const validatedPatterns = z.array(WorkflowPatternSchema).parse(patterns);
      
      // Cache results
      this.workflowPatternsCache = validatedPatterns;
      this.updateCacheExpiry();
      
      this.logger.info('Workflow patterns knowledge built', { 
        count: validatedPatterns.length 
      });
      
      return validatedPatterns;

    } catch (error) {
      this.logger.error('Failed to build workflow patterns', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new DomainKnowledgeError(
        'Failed to get workflow patterns',
        'WORKFLOW_PATTERNS_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Gets category taxonomy knowledge
   */
  async getCategoryTaxonomy(): Promise<WorkflowContext['domainKnowledge']['categoryTaxonomy']> {
    if (this.isCacheValid() && this.categoryTaxonomyCache) {
      this.logger.info('Returning cached category taxonomy');
      return this.categoryTaxonomyCache;
    }

    try {
      this.logger.info('Building category taxonomy knowledge base');
      
      const taxonomy = this.buildCategoryTaxonomy();
      
      // Validate data
      const validatedTaxonomy = z.array(CategoryTaxonomySchema).parse(taxonomy);
      
      // Cache results
      this.categoryTaxonomyCache = validatedTaxonomy;
      this.updateCacheExpiry();
      
      this.logger.info('Category taxonomy knowledge built', { 
        count: validatedTaxonomy.length 
      });
      
      return validatedTaxonomy;

    } catch (error) {
      this.logger.error('Failed to build category taxonomy', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new DomainKnowledgeError(
        'Failed to get category taxonomy',
        'CATEGORY_TAXONOMY_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Clears all cached knowledge
   */
  clearCache(): void {
    this.toolIntegrationsCache = null;
    this.workflowPatternsCache = null;
    this.categoryTaxonomyCache = null;
    this.cacheExpiry = null;
    this.logger.info('Domain knowledge cache cleared');
  }

  // Private Methods

  private isCacheValid(): boolean {
    return this.cacheExpiry !== null && new Date() < this.cacheExpiry;
  }

  private updateCacheExpiry(): void {
    this.cacheExpiry = new Date(Date.now() + this.cacheExpiryHours * 60 * 60 * 1000);
  }

  private buildToolIntegrations(): ToolIntegration[] {
    return [
      // Communication & Collaboration
      {
        toolName: 'Slack',
        aliases: ['slack', 'slack workspace', 'team chat'],
        category: 'Communication',
        capabilities: ['messaging', 'file sharing', 'channel management', 'webhooks', 'bot integration'],
        apiRequirements: ['OAuth token', 'Bot token', 'webhook URLs'],
        commonUses: ['team notifications', 'automated alerts', 'status updates', 'file distribution']
      },
      {
        toolName: 'Discord',
        aliases: ['discord', 'discord server', 'discord bot'],
        category: 'Communication',
        capabilities: ['messaging', 'voice channels', 'role management', 'webhooks', 'embeds'],
        apiRequirements: ['Bot token', 'Server permissions', 'webhook URLs'],
        commonUses: ['community management', 'automated moderation', 'event notifications', 'role assignments']
      },
      {
        toolName: 'Microsoft Teams',
        aliases: ['teams', 'ms teams', 'microsoft teams'],
        category: 'Communication',
        capabilities: ['messaging', 'meetings', 'file collaboration', 'app integration'],
        apiRequirements: ['Azure AD app', 'Graph API permissions', 'webhook endpoints'],
        commonUses: ['meeting scheduling', 'document collaboration', 'team notifications', 'project updates']
      },

      // Email & Marketing
      {
        toolName: 'Gmail',
        aliases: ['gmail', 'google mail', 'email'],
        category: 'Email',
        capabilities: ['send emails', 'read emails', 'label management', 'search', 'attachments'],
        apiRequirements: ['OAuth credentials', 'Gmail API access', 'scope permissions'],
        commonUses: ['automated responses', 'email parsing', 'newsletter management', 'notification emails']
      },
      {
        toolName: 'Outlook',
        aliases: ['outlook', 'microsoft outlook', 'office 365 mail'],
        category: 'Email',
        capabilities: ['email management', 'calendar integration', 'contact sync', 'rules automation'],
        apiRequirements: ['Azure AD registration', 'Graph API permissions', 'OAuth flow'],
        commonUses: ['email automation', 'calendar scheduling', 'contact management', 'meeting coordination']
      },
      {
        toolName: 'Mailchimp',
        aliases: ['mailchimp', 'mail chimp', 'email marketing'],
        category: 'Marketing',
        capabilities: ['email campaigns', 'audience management', 'analytics', 'automation'],
        apiRequirements: ['API key', 'audience access', 'campaign permissions'],
        commonUses: ['newsletter automation', 'subscriber management', 'email sequences', 'marketing analytics']
      },

      // CRM & Sales
      {
        toolName: 'Salesforce',
        aliases: ['salesforce', 'sfdc', 'crm'],
        category: 'CRM',
        capabilities: ['lead management', 'opportunity tracking', 'custom objects', 'workflow automation'],
        apiRequirements: ['Connected app', 'OAuth flow', 'API limits'],
        commonUses: ['lead qualification', 'sales pipeline automation', 'data synchronization', 'reporting']
      },
      {
        toolName: 'HubSpot',
        aliases: ['hubspot', 'hub spot', 'inbound marketing'],
        category: 'CRM',
        capabilities: ['contact management', 'deal tracking', 'marketing automation', 'analytics'],
        apiRequirements: ['API key', 'OAuth tokens', 'webhook endpoints'],
        commonUses: ['lead nurturing', 'sales automation', 'marketing campaigns', 'customer analytics']
      },

      // Project Management
      {
        toolName: 'Asana',
        aliases: ['asana', 'project management'],
        category: 'Project Management',
        capabilities: ['task management', 'project tracking', 'team collaboration', 'time tracking'],
        apiRequirements: ['Personal access token', 'OAuth app', 'workspace access'],
        commonUses: ['task automation', 'project updates', 'team coordination', 'progress tracking']
      },
      {
        toolName: 'Trello',
        aliases: ['trello', 'kanban', 'board management'],
        category: 'Project Management',
        capabilities: ['board management', 'card automation', 'list operations', 'member management'],
        apiRequirements: ['API key', 'OAuth token', 'board permissions'],
        commonUses: ['workflow automation', 'task tracking', 'team updates', 'project organization']
      },
      {
        toolName: 'Jira',
        aliases: ['jira', 'atlassian jira', 'issue tracking'],
        category: 'Project Management',
        capabilities: ['issue tracking', 'project management', 'workflow automation', 'reporting'],
        apiRequirements: ['API token', 'Basic auth', 'project permissions'],
        commonUses: ['bug tracking', 'sprint automation', 'issue management', 'development workflows']
      },

      // Cloud Storage
      {
        toolName: 'Google Drive',
        aliases: ['google drive', 'gdrive', 'google docs', 'google sheets'],
        category: 'Cloud Storage',
        capabilities: ['file management', 'sharing', 'collaboration', 'document editing'],
        apiRequirements: ['OAuth credentials', 'Drive API access', 'file permissions'],
        commonUses: ['document automation', 'file synchronization', 'backup automation', 'collaborative editing']
      },
      {
        toolName: 'Dropbox',
        aliases: ['dropbox', 'file storage', 'cloud storage'],
        category: 'Cloud Storage',
        capabilities: ['file storage', 'sharing', 'version control', 'team folders'],
        apiRequirements: ['OAuth app', 'API tokens', 'folder permissions'],
        commonUses: ['file backup', 'team collaboration', 'document sharing', 'version management']
      },

      // E-commerce
      {
        toolName: 'Shopify',
        aliases: ['shopify', 'e-commerce', 'online store'],
        category: 'E-commerce',
        capabilities: ['order management', 'inventory tracking', 'customer management', 'product updates'],
        apiRequirements: ['Private app', 'API credentials', 'webhook endpoints'],
        commonUses: ['order automation', 'inventory sync', 'customer notifications', 'sales reporting']
      },

      // Social Media
      {
        toolName: 'Twitter',
        aliases: ['twitter', 'x', 'social media'],
        category: 'Social Media',
        capabilities: ['posting', 'engagement', 'monitoring', 'analytics'],
        apiRequirements: ['API keys', 'OAuth tokens', 'app permissions'],
        commonUses: ['social media automation', 'content scheduling', 'engagement tracking', 'brand monitoring']
      },
      {
        toolName: 'Facebook',
        aliases: ['facebook', 'fb', 'meta'],
        category: 'Social Media',
        capabilities: ['page management', 'posting', 'advertising', 'analytics'],
        apiRequirements: ['App ID', 'Access tokens', 'page permissions'],
        commonUses: ['content publishing', 'ad management', 'audience engagement', 'social analytics']
      },
      {
        toolName: 'LinkedIn',
        aliases: ['linkedin', 'professional network'],
        category: 'Social Media',
        capabilities: ['profile management', 'networking', 'content sharing', 'lead generation'],
        apiRequirements: ['API access', 'OAuth flow', 'company page access'],
        commonUses: ['professional networking', 'content marketing', 'lead generation', 'recruitment']
      },

      // Analytics & Monitoring
      {
        toolName: 'Google Analytics',
        aliases: ['google analytics', 'ga', 'web analytics'],
        category: 'Analytics',
        capabilities: ['web tracking', 'user analytics', 'conversion tracking', 'reporting'],
        apiRequirements: ['Service account', 'Analytics API', 'property access'],
        commonUses: ['website monitoring', 'user behavior analysis', 'conversion tracking', 'performance reports']
      },

      // Development & DevOps
      {
        toolName: 'GitHub',
        aliases: ['github', 'git', 'version control'],
        category: 'Development',
        capabilities: ['repository management', 'issue tracking', 'pull requests', 'actions'],
        apiRequirements: ['Personal access token', 'OAuth app', 'repository permissions'],
        commonUses: ['code automation', 'CI/CD pipelines', 'issue management', 'release automation']
      },
      {
        toolName: 'GitLab',
        aliases: ['gitlab', 'git lab', 'devops platform'],
        category: 'Development',
        capabilities: ['repository management', 'CI/CD', 'issue tracking', 'security scanning'],
        apiRequirements: ['Personal access token', 'OAuth application', 'project permissions'],
        commonUses: ['deployment automation', 'code quality checks', 'security monitoring', 'project management']
      }
    ];
  }

  private buildWorkflowPatterns(): WorkflowPattern[] {
    return [
      // Communication Patterns
      {
        pattern: 'Notification Broadcasting',
        description: 'Automatically send notifications to multiple channels when events occur',
        useCases: ['System alerts', 'Team updates', 'Status changes', 'Emergency notifications'],
        requiredTools: ['Slack', 'Email', 'SMS'],
        complexity: 'low'
      },
      {
        pattern: 'Cross-Platform Messaging',
        description: 'Synchronize messages across different communication platforms',
        useCases: ['Multi-channel support', 'Team coordination', 'Customer service'],
        requiredTools: ['Slack', 'Discord', 'Teams', 'Email'],
        complexity: 'medium'
      },

      // Data Processing Patterns
      {
        pattern: 'Data Collection and Analysis',
        description: 'Gather data from multiple sources and generate insights',
        useCases: ['Business intelligence', 'Performance monitoring', 'Market research'],
        requiredTools: ['Google Sheets', 'Analytics platforms', 'Database'],
        complexity: 'high'
      },
      {
        pattern: 'File Processing Pipeline',
        description: 'Automated processing of files through multiple stages',
        useCases: ['Document workflows', 'Media processing', 'Data transformation'],
        requiredTools: ['Google Drive', 'Dropbox', 'Processing services'],
        complexity: 'medium'
      },

      // Marketing Patterns
      {
        pattern: 'Lead Nurturing Sequence',
        description: 'Automated email sequences based on user behavior and triggers',
        useCases: ['Customer onboarding', 'Sales follow-up', 'Educational content'],
        requiredTools: ['Mailchimp', 'CRM', 'Analytics'],
        complexity: 'medium'
      },
      {
        pattern: 'Social Media Management',
        description: 'Coordinated posting and engagement across social platforms',
        useCases: ['Brand management', 'Content marketing', 'Customer engagement'],
        requiredTools: ['Twitter', 'Facebook', 'LinkedIn', 'Content scheduler'],
        complexity: 'medium'
      },

      // E-commerce Patterns
      {
        pattern: 'Order Fulfillment Automation',
        description: 'End-to-end automation of order processing and shipping',
        useCases: ['E-commerce operations', 'Inventory management', 'Customer notifications'],
        requiredTools: ['Shopify', 'Shipping APIs', 'Email', 'Inventory systems'],
        complexity: 'high'
      },
      {
        pattern: 'Inventory Management',
        description: 'Automated tracking and updating of inventory across platforms',
        useCases: ['Stock monitoring', 'Reorder automation', 'Multi-channel sync'],
        requiredTools: ['E-commerce platform', 'Database', 'Notification system'],
        complexity: 'medium'
      },

      // Project Management Patterns
      {
        pattern: 'Task Automation',
        description: 'Automatic creation and assignment of tasks based on triggers',
        useCases: ['Project workflows', 'Issue tracking', 'Team coordination'],
        requiredTools: ['Asana', 'Trello', 'Jira', 'Calendar'],
        complexity: 'low'
      },
      {
        pattern: 'Progress Reporting',
        description: 'Automated generation and distribution of progress reports',
        useCases: ['Project updates', 'Team dashboards', 'Stakeholder communication'],
        requiredTools: ['Project management tools', 'Analytics', 'Email', 'Slack'],
        complexity: 'medium'
      },

      // Integration Patterns
      {
        pattern: 'API Data Synchronization',
        description: 'Keep data synchronized between different systems and platforms',
        useCases: ['CRM integration', 'Data consistency', 'System integration'],
        requiredTools: ['Multiple APIs', 'Database', 'Scheduling system'],
        complexity: 'high'
      },
      {
        pattern: 'Webhook Processing',
        description: 'Process incoming webhooks and trigger appropriate actions',
        useCases: ['Real-time updates', 'Event-driven automation', 'System integration'],
        requiredTools: ['Webhook handlers', 'Processing logic', 'Action systems'],
        complexity: 'medium'
      }
    ];
  }

  private buildCategoryTaxonomy(): CategoryTaxonomy[] {
    return [
      {
        category: 'Communication',
        subcategories: ['Team Chat', 'Email', 'Video Conferencing', 'Voice Calls', 'Notifications'],
        relatedTerms: ['messaging', 'collaboration', 'team coordination', 'alerts', 'announcements'],
        commonRequests: ['send notifications', 'team updates', 'automated messaging', 'chat integration']
      },
      {
        category: 'Marketing',
        subcategories: ['Email Marketing', 'Social Media', 'Content Marketing', 'SEO', 'Analytics'],
        relatedTerms: ['campaigns', 'leads', 'conversion', 'engagement', 'branding', 'promotion'],
        commonRequests: ['email campaigns', 'social posting', 'lead generation', 'marketing automation']
      },
      {
        category: 'Sales',
        subcategories: ['CRM', 'Lead Management', 'Pipeline', 'Forecasting', 'Customer Success'],
        relatedTerms: ['prospects', 'deals', 'opportunities', 'customers', 'revenue', 'quotas'],
        commonRequests: ['lead tracking', 'sales automation', 'customer management', 'deal updates']
      },
      {
        category: 'Project Management',
        subcategories: ['Task Management', 'Resource Planning', 'Time Tracking', 'Reporting', 'Collaboration'],
        relatedTerms: ['tasks', 'deadlines', 'milestones', 'resources', 'planning', 'coordination'],
        commonRequests: ['task automation', 'project tracking', 'team coordination', 'progress reports']
      },
      {
        category: 'E-commerce',
        subcategories: ['Inventory', 'Orders', 'Payments', 'Shipping', 'Customer Service'],
        relatedTerms: ['products', 'sales', 'fulfillment', 'customers', 'revenue', 'operations'],
        commonRequests: ['order processing', 'inventory management', 'customer notifications', 'sales tracking']
      },
      {
        category: 'Data Management',
        subcategories: ['Storage', 'Backup', 'Analytics', 'Reporting', 'Integration'],
        relatedTerms: ['databases', 'files', 'sync', 'analysis', 'insights', 'dashboards'],
        commonRequests: ['data sync', 'backup automation', 'report generation', 'analytics tracking']
      },
      {
        category: 'Development',
        subcategories: ['Code Management', 'CI/CD', 'Testing', 'Deployment', 'Monitoring'],
        relatedTerms: ['repositories', 'builds', 'releases', 'bugs', 'performance', 'quality'],
        commonRequests: ['code automation', 'deployment pipelines', 'testing workflows', 'monitoring alerts']
      },
      {
        category: 'Finance',
        subcategories: ['Accounting', 'Invoicing', 'Payments', 'Budgeting', 'Reporting'],
        relatedTerms: ['transactions', 'expenses', 'revenue', 'budgets', 'taxes', 'compliance'],
        commonRequests: ['invoice automation', 'expense tracking', 'payment processing', 'financial reports']
      },
      {
        category: 'Human Resources',
        subcategories: ['Recruitment', 'Onboarding', 'Performance', 'Benefits', 'Compliance'],
        relatedTerms: ['employees', 'hiring', 'training', 'reviews', 'policies', 'benefits'],
        commonRequests: ['hiring workflows', 'employee onboarding', 'performance tracking', 'hr automation']
      },
      {
        category: 'Customer Support',
        subcategories: ['Ticketing', 'Knowledge Base', 'Chat Support', 'Escalation', 'Feedback'],
        relatedTerms: ['tickets', 'support', 'help desk', 'customers', 'issues', 'resolution'],
        commonRequests: ['ticket automation', 'customer support', 'help desk workflows', 'feedback collection']
      }
    ];
  }
}

// Pure Utility Functions
export const DomainKnowledgeUtils = {
  /**
   * Finds tools by category
   */
  findToolsByCategory: (integrations: ToolIntegration[], category: string): ToolIntegration[] => {
    return integrations.filter(tool => 
      tool.category.toLowerCase() === category.toLowerCase()
    );
  },

  /**
   * Searches tools by alias or name
   */
  searchTools: (integrations: ToolIntegration[], searchTerm: string): ToolIntegration[] => {
    const normalizedSearch = searchTerm.toLowerCase();
    return integrations.filter(tool => 
      tool.toolName.toLowerCase().includes(normalizedSearch) ||
      tool.aliases.some(alias => alias.toLowerCase().includes(normalizedSearch))
    );
  },

  /**
   * Gets all available capabilities
   */
  getAllCapabilities: (integrations: ToolIntegration[]): string[] => {
    const capabilities = new Set<string>();
    integrations.forEach(tool => {
      tool.capabilities.forEach(cap => capabilities.add(cap));
    });
    return Array.from(capabilities);
  },

  /**
   * Finds patterns by complexity
   */
  findPatternsByComplexity: (patterns: WorkflowPattern[], complexity: 'low' | 'medium' | 'high'): WorkflowPattern[] => {
    return patterns.filter(pattern => pattern.complexity === complexity);
  },

  /**
   * Searches patterns by use case
   */
  searchPatternsByUseCase: (patterns: WorkflowPattern[], useCase: string): WorkflowPattern[] => {
    const normalizedUseCase = useCase.toLowerCase();
    return patterns.filter(pattern => 
      pattern.useCases.some(uc => uc.toLowerCase().includes(normalizedUseCase)) ||
      pattern.description.toLowerCase().includes(normalizedUseCase)
    );
  },

  /**
   * Gets category by related terms
   */
  findCategoryByTerms: (taxonomy: CategoryTaxonomy[], searchTerms: string[]): CategoryTaxonomy[] => {
    const normalizedTerms = searchTerms.map(term => term.toLowerCase());
    return taxonomy.filter(category => 
      normalizedTerms.some(term => 
        category.relatedTerms.some(relatedTerm => 
          relatedTerm.toLowerCase().includes(term)
        ) ||
        category.subcategories.some(sub => 
          sub.toLowerCase().includes(term)
        )
      )
    );
  }
}; 