/**
 * WorkflowPromptBuilder Service
 * 
 * Constructs comprehensive LLM prompts for intelligent workflow analysis and recommendations.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { IPromptBuilder } from '../WorkflowIntentAnalyzer';
import { WorkflowContext } from '../WorkflowContextBuilder';

// Error Classes
export class PromptBuildError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PromptBuildError';
  }
}

// Interface for prompt templates
export interface IPromptTemplateProvider {
  getSystemPrompt(): string;
  getIntentAnalysisTemplate(): string;
  getContextSectionTemplate(sectionName: string): string;
  getExampleTemplate(exampleType: string): string;
}

// Implementation
export class WorkflowPromptBuilder implements IPromptBuilder {
  constructor(
    private readonly templateProvider: IPromptTemplateProvider,
    private readonly logger: {
      info: (message: string, context?: Record<string, unknown>) => void;
      error: (message: string, context?: Record<string, unknown>) => void;
      warn: (message: string, context?: Record<string, unknown>) => void;
      debug: (message: string, context?: Record<string, unknown>) => void;
    }
  ) {}

  /**
   * Builds comprehensive intent analysis prompt with full context
   * 
   * @param userQuery - User's natural language query
   * @param context - Complete workflow context
   * @returns Structured prompt optimized for LLM analysis
   */
  buildIntentAnalysisPrompt(userQuery: string, context: WorkflowContext): string {
    try {
      this.logger.debug('Building intent analysis prompt', {
        queryLength: userQuery.length,
        contextId: context.id,
        toolCount: context.domainKnowledge.toolIntegrations.length
      });

      const promptSections = [
        this.buildContextSection(context),
        this.buildQuerySection(userQuery),
        this.buildInstructionsSection(),
        this.buildExamplesSection(context),
        this.buildOutputFormatSection()
      ];

      const fullPrompt = promptSections.join('\n\n');

      this.logger.debug('Intent analysis prompt built', {
        promptLength: fullPrompt.length,
        sectionCount: promptSections.length
      });

      return fullPrompt;

    } catch (error) {
      this.logger.error('Failed to build intent analysis prompt', {
        userQuery: userQuery.substring(0, 100),
        contextId: context.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new PromptBuildError(
        'Failed to build intent analysis prompt',
        'PROMPT_BUILD_FAILED',
        { userQuery, contextId: context.id, originalError: error }
      );
    }
  }

  /**
   * Gets the system prompt for LLM configuration
   * 
   * @returns System prompt defining the AI's role and capabilities
   */
  getSystemPrompt(): string {
    return this.templateProvider.getSystemPrompt();
  }

  // Private Methods

  private buildContextSection(context: WorkflowContext): string {
    const contextSection = `# WORKFLOW CONTEXT

## Available Tool Integrations (${context.domainKnowledge.toolIntegrations.length} tools)
${this.formatToolIntegrations(context.domainKnowledge.toolIntegrations)}

## Workflow Patterns (${context.domainKnowledge.workflowPatterns.length} patterns)
${this.formatWorkflowPatterns(context.domainKnowledge.workflowPatterns)}

## Category Taxonomy
${this.formatCategoryTaxonomy(context.domainKnowledge.categoryTaxonomy)}

## User Context
- **Session ID**: ${context.userContext.sessionId}
- **Skill Level**: ${context.userContext.skillLevel}
- **Domain Focus**: ${context.userContext.domainFocus.join(', ') || 'General'}
- **Preferred Tools**: ${context.userContext.preferredTools.join(', ') || 'None specified'}
- **Recent Queries**: ${context.userContext.previousQueries.slice(-3).join(' | ') || 'None'}

## Workflow Library Statistics
- **Total Workflows**: ${context.workflowLibrary.totalWorkflows}
- **Popular Categories**: ${context.workflowLibrary.categories.map(c => `${c.name} (${c.count})`).join(', ')}
- **Recently Added**: ${context.workflowLibrary.recentlyAdded.slice(0, 3).join(', ')}
- **Most Popular**: ${context.workflowLibrary.mostPopular.slice(0, 3).join(', ')}`;

    return contextSection;
  }

  private buildQuerySection(userQuery: string): string {
    return `# USER QUERY

The user is asking: "${userQuery}"

Analyze this query to understand their workflow automation intent.`;
  }

  private buildInstructionsSection(): string {
    return `# ANALYSIS INSTRUCTIONS

You are an expert workflow automation consultant with deep knowledge of n8n workflows and business process automation. Your task is to analyze the user's query and provide structured intent analysis.

## Key Analysis Areas:

1. **Primary Intent Extraction**:
   - What specific action does the user want to automate?
   - Which domain/category does this fall into?
   - What tools or integrations are mentioned or implied?
   - What's the complexity level (low/medium/high)?
   - What's the urgency/priority?

2. **Entity Recognition**:
   - Tools and platforms mentioned
   - Technologies referenced
   - Data types involved
   - Integration requirements
   - Trigger conditions
   - Frequency or timing requirements
   - Constraints or limitations

3. **Contextual Analysis**:
   - User's skill level consideration
   - Scope of automation (personal/team/organization)
   - Budget implications (free/paid tools)
   - Timeframe expectations

4. **Recommendation Hints**:
   - Suggest relevant workflow categories
   - Identify compatible tools from available integrations
   - Recommend appropriate complexity level
   - Provide reasoning for suggestions

## Analysis Guidelines:

- **Be Precise**: Extract specific, actionable intent
- **Consider Context**: Use user's history and preferences
- **Match Available Tools**: Only suggest tools we have integrations for
- **Assess Complexity**: Consider user's skill level
- **Provide Confidence**: Rate your analysis confidence (0.0-1.0)
- **Include Alternatives**: Identify secondary intents or interpretations
- **Think Workflows**: Focus on automation and process improvement`;
  }

  private buildExamplesSection(context: WorkflowContext): string {
    const examples = this.selectRelevantExamples(context);
    
    return `# ANALYSIS EXAMPLES

Here are examples of high-quality intent analysis:

${examples.map(example => this.formatExample(example)).join('\n\n')}`;
  }

  private buildOutputFormatSection(): string {
    return `# OUTPUT FORMAT

Respond with a valid JSON object matching this exact structure:

\`\`\`json
{
  "normalizedQuery": "cleaned and standardized version of the user query",
  "confidence": 0.85,
  "primaryIntent": {
    "action": "specific action to automate (e.g., 'send notifications', 'sync data')",
    "domain": "business domain (e.g., 'communication', 'marketing', 'sales')",
    "tools": ["Tool1", "Tool2"],
    "complexity": "low|medium|high",
    "priority": "low|medium|high|urgent"
  },
  "secondaryIntents": [
    {
      "action": "alternative interpretation",
      "domain": "alternative domain",
      "confidence": 0.6
    }
  ],
  "extractedEntities": {
    "tools": ["explicitly mentioned tools"],
    "technologies": ["mentioned technologies or platforms"],
    "dataTypes": ["email", "notifications", "reports", etc.],
    "integrations": ["required integrations"],
    "triggers": ["what initiates the workflow"],
    "frequency": "how often it should run (optional)",
    "constraints": ["limitations or requirements"]
  },
  "contextualFactors": {
    "userSkillLevel": "beginner|intermediate|advanced",
    "urgency": "low|medium|high",
    "scope": "personal|team|organization",
    "budget": "free|paid|enterprise",
    "timeframe": "when they need it implemented (optional)"
  },
  "recommendationHints": [
    {
      "category": "tool_compatibility",
      "suggestion": "specific recommendation",
      "reasoning": "why this recommendation makes sense",
      "confidence": 0.8
    }
  ]
}
\`\`\`

**Critical Requirements**:
- All JSON must be valid and parseable
- Use only tools that exist in the available integrations
- Confidence scores must be between 0.0 and 1.0
- Match enum values exactly (e.g., "low", not "Low")
- Include at least one recommendation hint
- Provide clear, actionable reasoning`;
  }

  private formatToolIntegrations(integrations: WorkflowContext['domainKnowledge']['toolIntegrations']): string {
    const grouped = this.groupBy(integrations, 'category');
    
    return Object.entries(grouped)
      .map(([category, tools]) => {
        const toolList = tools.map(tool => 
          `- **${tool.toolName}** (${tool.aliases.join(', ')}): ${tool.capabilities.slice(0, 3).join(', ')}`
        ).join('\n  ');
        
        return `### ${category}\n  ${toolList}`;
      })
      .join('\n\n');
  }

  private formatWorkflowPatterns(patterns: WorkflowContext['domainKnowledge']['workflowPatterns']): string {
    const grouped = this.groupBy(patterns, 'complexity');
    
    return Object.entries(grouped)
      .map(([complexity, patternList]) => {
        const patterns = patternList.map(pattern =>
          `- **${pattern.pattern}** (${pattern.requiredTools.join(', ')}): ${pattern.description}`
        ).join('\n  ');
        
        return `### ${complexity.toUpperCase()} Complexity\n  ${patterns}`;
      })
      .join('\n\n');
  }

  private formatCategoryTaxonomy(taxonomy: WorkflowContext['domainKnowledge']['categoryTaxonomy']): string {
    return taxonomy.map(category => {
      const subcategories = category.subcategories.join(', ');
      const relatedTerms = category.relatedTerms.slice(0, 5).join(', ');
      const commonRequests = category.commonRequests.slice(0, 3).join(', ');
      
      return `### ${category.category}
  - **Subcategories**: ${subcategories}
  - **Related Terms**: ${relatedTerms}
  - **Common Requests**: ${commonRequests}`;
    }).join('\n\n');
  }

  private selectRelevantExamples(context: WorkflowContext): Array<{
    query: string;
    analysis: any;
    reasoning: string;
  }> {
    // Select examples based on user's context and preferred tools
    const userTools = context.userContext.preferredTools;
    const userDomains = context.userContext.domainFocus;
    
    const allExamples = this.getAllExamples();
    
    // Filter and rank examples by relevance
    const relevantExamples = allExamples
      .map(example => ({
        ...example,
        relevanceScore: this.calculateExampleRelevance(example, userTools, userDomains)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3); // Top 3 most relevant examples

    return relevantExamples;
  }

  private calculateExampleRelevance(
    example: any, 
    userTools: string[], 
    userDomains: string[]
  ): number {
    let score = 0;
    
    // Check tool overlap
    const exampleTools = example.analysis.extractedEntities.tools || [];
    const toolOverlap = exampleTools.filter((tool: string) => 
      userTools.some(userTool => 
        tool.toLowerCase().includes(userTool.toLowerCase()) ||
        userTool.toLowerCase().includes(tool.toLowerCase())
      )
    ).length;
    score += toolOverlap * 0.4;
    
    // Check domain overlap
    const exampleDomain = example.analysis.primaryIntent.domain.toLowerCase();
    const domainMatch = userDomains.some(domain => 
      domain.toLowerCase().includes(exampleDomain) ||
      exampleDomain.includes(domain.toLowerCase())
    );
    if (domainMatch) score += 0.6;
    
    return score;
  }

  private getAllExamples(): Array<{
    query: string;
    analysis: any;
    reasoning: string;
  }> {
    return [
      {
        query: "I want to automatically send Slack notifications when someone fills out a form on my website",
        analysis: {
          normalizedQuery: "automate slack notifications for website form submissions",
          confidence: 0.92,
          primaryIntent: {
            action: "send notifications",
            domain: "communication",
            tools: ["Slack", "Website Forms"],
            complexity: "low",
            priority: "medium"
          },
          secondaryIntents: [],
          extractedEntities: {
            tools: ["Slack"],
            technologies: ["website", "forms"],
            dataTypes: ["form submissions", "notifications"],
            integrations: ["Slack API", "webhook"],
            triggers: ["form submission"],
            frequency: "real-time",
            constraints: []
          },
          contextualFactors: {
            userSkillLevel: "intermediate",
            urgency: "medium",
            scope: "team",
            budget: "free"
          },
          recommendationHints: [
            {
              category: "workflow_pattern",
              suggestion: "Use Notification Broadcasting pattern",
              reasoning: "Perfect match for real-time form-to-Slack notifications",
              confidence: 0.9
            }
          ]
        },
        reasoning: "Clear trigger (form submission), specific tool (Slack), simple automation pattern"
      },
      {
        query: "Set up email marketing campaigns that automatically follow up with leads based on their behavior",
        analysis: {
          normalizedQuery: "automate email marketing follow-up campaigns based on lead behavior",
          confidence: 0.88,
          primaryIntent: {
            action: "automate email campaigns",
            domain: "marketing",
            tools: ["Email Marketing Platform", "CRM"],
            complexity: "medium",
            priority: "high"
          },
          secondaryIntents: [
            {
              action: "track lead behavior",
              domain: "analytics",
              confidence: 0.7
            }
          ],
          extractedEntities: {
            tools: ["Email Marketing", "CRM"],
            technologies: ["behavior tracking", "automation"],
            dataTypes: ["emails", "lead data", "behavior data"],
            integrations: ["email marketing API", "CRM integration"],
            triggers: ["lead behavior", "time-based"],
            frequency: "behavioral triggers",
            constraints: ["behavior-based conditions"]
          },
          contextualFactors: {
            userSkillLevel: "intermediate",
            urgency: "high",
            scope: "organization",
            budget: "paid"
          },
          recommendationHints: [
            {
              category: "tool_compatibility",
              suggestion: "Consider Mailchimp + HubSpot integration",
              reasoning: "Both platforms support behavioral triggers and have robust APIs",
              confidence: 0.85
            }
          ]
        },
        reasoning: "Complex marketing automation with behavioral triggers requiring multiple tool integration"
      },
      {
        query: "I need to sync customer data between Salesforce and our support system whenever a deal closes",
        analysis: {
          normalizedQuery: "sync customer data from salesforce to support system when deals close",
          confidence: 0.95,
          primaryIntent: {
            action: "sync data",
            domain: "sales",
            tools: ["Salesforce", "Support System"],
            complexity: "medium",
            priority: "high"
          },
          secondaryIntents: [
            {
              action: "automate customer onboarding",
              domain: "customer success",
              confidence: 0.6
            }
          ],
          extractedEntities: {
            tools: ["Salesforce"],
            technologies: ["CRM", "support system"],
            dataTypes: ["customer data", "deal data"],
            integrations: ["Salesforce API", "support system API"],
            triggers: ["deal closure"],
            frequency: "event-based",
            constraints: ["data mapping", "field synchronization"]
          },
          contextualFactors: {
            userSkillLevel: "advanced",
            urgency: "high",
            scope: "organization",
            budget: "enterprise"
          },
          recommendationHints: [
            {
              category: "integration_pattern",
              suggestion: "Use API Data Synchronization pattern",
              reasoning: "Perfect for real-time data sync between enterprise systems",
              confidence: 0.9
            }
          ]
        },
        reasoning: "Clear B2B integration with specific trigger and well-defined data flow"
      },
      {
        query: "Help me create a simple workflow for backing up my Google Drive files",
        analysis: {
          normalizedQuery: "create workflow to backup google drive files",
          confidence: 0.85,
          primaryIntent: {
            action: "backup files",
            domain: "data management",
            tools: ["Google Drive"],
            complexity: "low",
            priority: "medium"
          },
          secondaryIntents: [
            {
              action: "organize files",
              domain: "file management",
              confidence: 0.4
            }
          ],
          extractedEntities: {
            tools: ["Google Drive"],
            technologies: ["cloud storage", "backup"],
            dataTypes: ["files", "documents"],
            integrations: ["Google Drive API"],
            triggers: ["scheduled", "manual"],
            frequency: "daily or weekly",
            constraints: ["storage limits"]
          },
          contextualFactors: {
            userSkillLevel: "beginner",
            urgency: "low",
            scope: "personal",
            budget: "free"
          },
          recommendationHints: [
            {
              category: "complexity_match",
              suggestion: "Start with simple scheduled backup to another cloud service",
              reasoning: "Beginner skill level requires simple, reliable automation",
              confidence: 0.8
            }
          ]
        },
        reasoning: "Simple personal automation request with clear scope and beginner-friendly requirements"
      }
    ];
  }

  private formatExample(example: { query: string; analysis: any; reasoning: string }): string {
    return `**Query**: "${example.query}"

**Analysis**:
\`\`\`json
${JSON.stringify(example.analysis, null, 2)}
\`\`\`

**Reasoning**: ${example.reasoning}`;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}

// Default Template Provider
export class DefaultPromptTemplateProvider implements IPromptTemplateProvider {
  getSystemPrompt(): string {
    return `You are an expert workflow automation consultant specializing in n8n workflows and business process automation. You have deep knowledge of:

- 2,053+ proven workflow templates across all business domains
- Integration capabilities of 200+ tools and platforms  
- Best practices for workflow design and automation
- Business process optimization and efficiency

Your role is to analyze user queries and provide structured intent analysis for intelligent workflow recommendations. You understand various skill levels from beginner to advanced and can adapt recommendations accordingly.

Key principles:
- Accuracy over assumptions - only recommend what you're confident about
- Match user skill level - don't overwhelm beginners or under-serve experts  
- Focus on practical, implementable solutions
- Consider available tools and integrations
- Provide clear confidence ratings for all analysis

Always respond with valid JSON following the specified schema exactly.`;
  }

  getIntentAnalysisTemplate(): string {
    return this.getSystemPrompt();
  }

  getContextSectionTemplate(sectionName: string): string {
    switch (sectionName) {
      case 'tools':
        return '## Available Tool Integrations\n{toolsList}';
      case 'patterns':
        return '## Workflow Patterns\n{patternsList}';
      case 'user':
        return '## User Context\n{userContext}';
      default:
        return '## {sectionName}\n{content}';
    }
  }

  getExampleTemplate(exampleType: string): string {
    return '**Example {exampleType}**:\nQuery: "{query}"\nAnalysis: {analysis}\nReasoning: {reasoning}';
  }
}

// Pure Utility Functions
export const PromptUtils = {
  /**
   * Truncates text to specified length with ellipsis
   */
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * Escapes JSON special characters in text
   */
  escapeJsonText: (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  },

  /**
   * Validates prompt length for LLM limits
   */
  validatePromptLength: (prompt: string, maxTokens = 8000): boolean => {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const estimatedTokens = prompt.length / 4;
    return estimatedTokens <= maxTokens;
  },

  /**
   * Extracts JSON from LLM response
   */
  extractJsonFromResponse: (response: string): string | null => {
    // Find JSON block in markdown code fences
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Find JSON object in response
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      return jsonObjectMatch[0];
    }

    return null;
  },

  /**
   * Counts estimated tokens in text
   */
  estimateTokenCount: (text: string): number => {
    // More accurate token estimation
    const words = text.split(/\s+/).length;
    const characters = text.length;
    
    // Rough formula: tokens ≈ words * 1.3 (accounting for subword tokenization)
    return Math.ceil(words * 1.3);
  }
}; 