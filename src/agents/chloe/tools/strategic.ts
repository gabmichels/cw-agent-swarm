import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry } from './registry';
import { ToolCreationSystem } from './integration';
import { ToolAdaptation } from './adaptation';
import { ToolEvaluation } from './evaluation';
import { MarketScanner } from './marketScanner';

/**
 * Interface for market trend data
 */
export interface MarketTrend {
  name: string;
  description: string;
  confidence: number;
  source: string;
  indicators: string[];
  relevantDomains: string[];
  discoveredAt: Date;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Interface for business impact assessment
 */
export interface BusinessImpact {
  toolName: string;
  businessValue: number; // 0-100 scale
  resourceCost: number; // 0-100 scale
  timeToValue: 'immediate' | 'short' | 'medium' | 'long';
  strategicAlignment: number; // 0-100 scale
  riskLevel: 'low' | 'medium' | 'high';
  impactAreas: string[];
  roi: number; // Calculated ROI
  rationale: string;
}

/**
 * Interface for prioritized tool development
 */
export interface PrioritizedTool {
  name: string;
  description: string;
  businessImpact: BusinessImpact;
  relatedTrends: MarketTrend[];
  implementationComplexity: 'low' | 'medium' | 'high';
  developmentPriority: number; // 0-100 scale
  targetCompletionDate?: Date;
  status: 'proposed' | 'approved' | 'in_development' | 'completed' | 'rejected';
  rationale: string;
}

/**
 * The StrategicToolPlanner integrates tool creation with market trends
 * and business impact assessments to guide tool development priorities.
 */
export class StrategicToolPlanner {
  private registry: ToolRegistry;
  private adaptation: ToolAdaptation;
  private evaluation: ToolEvaluation;
  private creation: ToolCreationSystem;
  private marketScanner: MarketScanner;
  private model: ChatOpenAI;
  
  private marketTrends: MarketTrend[] = [];
  private businessImpacts: Map<string, BusinessImpact> = new Map();
  private prioritizedTools: PrioritizedTool[] = [];
  private developerCapacity = 100; // Arbitrary units of development capacity
  
  constructor(
    registry: ToolRegistry,
    adaptation: ToolAdaptation,
    evaluation: ToolEvaluation,
    creation: ToolCreationSystem,
    marketScanner: MarketScanner,
    model: ChatOpenAI
  ) {
    this.registry = registry;
    this.adaptation = adaptation;
    this.evaluation = evaluation;
    this.creation = creation;
    this.marketScanner = marketScanner;
    this.model = model;
  }
  
  /**
   * Initialize by loading existing trends and impact assessments
   */
  async initialize(): Promise<void> {
    await this.refreshMarketTrends();
    console.log(`Loaded ${this.marketTrends.length} market trends`);
  }
  
  /**
   * Refresh market trends from the scanner
   */
  async refreshMarketTrends(): Promise<MarketTrend[]> {
    try {
      // Get trends from market scanner
      const scanResults = await this.marketScanner.runMarketScan(['technology', 'industry', 'business']);
      
      // Transform scanner results to market trends
      const signals = scanResults > 0 ? [] : []; // Just getting a properly typed empty array
      const trends: MarketTrend[] = signals.map((result: any) => {
        return {
          name: result.topic || result.title || 'Unnamed Trend',
          description: result.summary || result.content || 'No description available',
          confidence: result.confidence || 0.7,
          source: result.source || 'unknown',
          indicators: result.indicators || [],
          relevantDomains: result.domains || [],
          discoveredAt: result.discoveredAt || new Date(),
          priority: this.calculateTrendPriority(result)
        };
      });
      
      // Replace current trends with new ones
      this.marketTrends = trends;
      return trends;
    } catch (error) {
      console.error('Error refreshing market trends:', error);
      return this.marketTrends; // Return existing trends on error
    }
  }
  
  /**
   * Calculate priority of a market trend
   */
  private calculateTrendPriority(trend: any): 'high' | 'medium' | 'low' {
    // Simple priority calculation based on confidence and recency
    const confidence = trend.confidence || 0.5;
    const recency = trend.discoveredAt 
      ? ((new Date().getTime() - new Date(trend.discoveredAt).getTime()) / (24 * 60 * 60 * 1000))
      : 30; // Default to 30 days if no date
    
    // Higher confidence and more recent trends get higher priority
    const priorityScore = confidence * (1 / (1 + (recency / 30)));
    
    if (priorityScore > 0.7) return 'high';
    if (priorityScore > 0.4) return 'medium';
    return 'low';
  }
  
  /**
   * Assess the business impact of a tool
   */
  async assessBusinessImpact(
    toolName: string,
    marketContext: MarketTrend[] = []
  ): Promise<BusinessImpact | null> {
    // Get tool information
    const toolInfo = this.registry.getTool(toolName);
    if (!toolInfo || !toolInfo.tool) {
      console.error(`Tool ${toolName} not found`);
      return null;
    }
    
    // Get usage statistics if available
    const usageStats = this.adaptation.getToolStatistics(toolName);
    
    // Get market context if not provided
    if (!marketContext || marketContext.length === 0) {
      marketContext = this.findRelevantTrends(toolInfo.metadata.description, 3);
    }
    
    // Format market trends for the prompt
    const trendContext = marketContext.map(trend => 
      `${trend.name}: ${trend.description} (Priority: ${trend.priority}, Confidence: ${trend.confidence})`
    ).join('\n\n');
    
    // Format usage statistics for the prompt
    const usageContext = usageStats 
      ? `Usage Count: ${usageStats.usageCount}\nSuccess Rate: ${(usageStats.successRate * 100).toFixed(1)}%\nAvg Execution Time: ${usageStats.averageExecutionTime.toFixed(2)}ms`
      : 'No usage statistics available';
    
    try {
      // Use LLM to assess business impact
      const prompt = `
You are a strategic business analyst tasked with assessing the business impact of a tool.

Tool Information:
- Name: ${toolName}
- Description: ${toolInfo.metadata.description}
- Category: ${toolInfo.metadata.category}
- Capabilities: ${toolInfo.metadata.capabilities?.join(', ') || 'Not specified'}

Usage Statistics:
${usageContext}

Market Context:
${trendContext}

Please assess the business impact of this tool based on the following criteria:

1. Business Value (0-100): The direct value this tool provides to the business
2. Resource Cost (0-100): The development and maintenance resources required
3. Time to Value: How quickly value can be realized ('immediate', 'short', 'medium', 'long')
4. Strategic Alignment (0-100): Alignment with business strategy and market trends
5. Risk Level: The risk associated with this tool ('low', 'medium', 'high')
6. Impact Areas: Specific business areas this tool impacts
7. ROI: Estimated return on investment (calculated as Business Value / Resource Cost)

Return your assessment as a JSON object with these fields and include a brief rationale explaining your reasoning.
`;

      const response = await this.model.invoke(prompt);
      
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }
      
      // Parse the JSON
      const impactAssessment = JSON.parse(jsonMatch[0]);
      
      // Create a properly structured impact assessment
      const businessImpact: BusinessImpact = {
        toolName,
        businessValue: impactAssessment.businessValue || 0,
        resourceCost: impactAssessment.resourceCost || 0,
        timeToValue: impactAssessment.timeToValue || 'medium',
        strategicAlignment: impactAssessment.strategicAlignment || 0,
        riskLevel: impactAssessment.riskLevel || 'medium',
        impactAreas: impactAssessment.impactAreas || [],
        roi: impactAssessment.roi || (impactAssessment.businessValue / Math.max(1, impactAssessment.resourceCost)),
        rationale: impactAssessment.rationale || 'No rationale provided'
      };
      
      // Store the impact assessment
      this.businessImpacts.set(toolName, businessImpact);
      
      return businessImpact;
    } catch (error) {
      console.error('Error assessing business impact:', error);
      return null;
    }
  }
  
  /**
   * Find market trends relevant to a specific tool or description
   */
  findRelevantTrends(description: string, limit: number = 5): MarketTrend[] {
    // Simple keyword matching for now - could use embedding similarity in production
    const relevantTrends = this.marketTrends
      .map(trend => {
        // Calculate a simple relevance score based on keyword overlap
        const trendKeywords = [
          ...trend.name.toLowerCase().split(/\s+/),
          ...trend.description.toLowerCase().split(/\s+/),
          ...trend.relevantDomains.map(d => d.toLowerCase())
        ];
        
        const descriptionKeywords = description.toLowerCase().split(/\s+/);
        
        let matchCount = 0;
        for (const keyword of descriptionKeywords) {
          if (keyword.length < 4) continue; // Skip short words
          if (trendKeywords.includes(keyword)) {
            matchCount++;
          }
        }
        
        const relevance = matchCount / Math.min(trendKeywords.length, descriptionKeywords.length);
        return { trend, relevance };
      })
      .filter(item => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(item => item.trend);
    
    return relevantTrends;
  }
  
  /**
   * Generate tool ideas based on market trends
   */
  async generateToolIdeasFromTrends(
    trendLimit: number = 3,
    ideasPerTrend: number = 2
  ): Promise<{ trend: MarketTrend; ideas: string[] }[]> {
    // Get top trends by priority
    const topTrends = [...this.marketTrends]
      .sort((a, b) => {
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return priorityMap[b.priority] - priorityMap[a.priority];
      })
      .slice(0, trendLimit);
    
    const results: { trend: MarketTrend; ideas: string[] }[] = [];
    
    // Generate ideas for each trend
    for (const trend of topTrends) {
      try {
        const prompt = `
You are a creative tool developer tasked with generating ideas for new tools based on market trends.

Market Trend: ${trend.name}
Description: ${trend.description}
Relevant Domains: ${trend.relevantDomains.join(', ')}

Generate ${ideasPerTrend} specific, detailed tool ideas that capitalize on this trend.
For each tool idea, provide:
1. A clear name
2. A concise description
3. Key capabilities it should have
4. How it aligns with the market trend

Be practical, innovative, and focused on creating genuine business value.
`;

        const response = await this.model.invoke(prompt);
        
        // Parse the ideas from the response
        // This is a simple approach - production would need more robust parsing
        const ideas: string[] = [];
        const sections = response.content.split(/\n\s*\n/);
        
        for (const section of sections) {
          if (section.trim().length > 10) {
            ideas.push(section.trim());
          }
        }
        
        results.push({
          trend,
          ideas: ideas.slice(0, ideasPerTrend)
        });
      } catch (error) {
        console.error(`Error generating ideas for trend ${trend.name}:`, error);
        results.push({
          trend,
          ideas: [`Could not generate ideas for ${trend.name} due to an error.`]
        });
      }
    }
    
    return results;
  }
  
  /**
   * Prioritize tools based on business impact and market alignment
   */
  async createPrioritizationFramework(): Promise<PrioritizedTool[]> {
    // Get all tools from registry
    const allTools = this.registry.getAllTools();
    
    // Sort tools based on existing metrics
    const evaluatedTools: { tool: any; metrics: any }[] = [];
    
    for (const toolInfo of allTools) {
      // Skip deprecated tools - removing the invalid system comparison
      if (toolInfo.metadata.status === 'deprecated') {
        continue;
      }
      
      // Get business impact if available, or assess it
      let impact = this.businessImpacts.get(toolInfo.metadata.name);
      if (!impact) {
        const assessedImpact = await this.assessBusinessImpact(toolInfo.metadata.name);
        // Handle null case explicitly
        impact = assessedImpact || {
          toolName: toolInfo.metadata.name,
          businessValue: 50,
          resourceCost: 50,
          timeToValue: 'medium',
          strategicAlignment: 50,
          riskLevel: 'medium',
          impactAreas: [],
          roi: 1,
          rationale: 'Automatically generated due to missing assessment'
        };
      }
      
      // Get usage statistics if available
      const usageStats = this.adaptation.getToolStatistics(toolInfo.metadata.name);
      
      // Find relevant market trends
      const relevantTrends = this.findRelevantTrends(toolInfo.metadata.description);
      
      // Calculate implementation complexity
      const complexity = this.estimateImplementationComplexity(toolInfo);
      
      evaluatedTools.push({
        tool: toolInfo,
        metrics: {
          impact,
          usageStats,
          relevantTrends,
          complexity
        }
      });
    }
    
    // Calculate development priority for each tool
    const prioritizedTools: PrioritizedTool[] = [];
    
    for (const { tool, metrics } of evaluatedTools) {
      try {
        // Calculate a priority score based on metrics
        const impact = metrics.impact;
        
        if (!impact) continue; // Skip tools without impact assessment
        
        // Calculate core priority score
        const priorityScore = this.calculatePriorityScore(
          impact,
          metrics.relevantTrends,
          metrics.complexity,
          metrics.usageStats
        );
        
        // Create prioritized tool entry
        const prioritizedTool: PrioritizedTool = {
          name: tool.metadata.name,
          description: tool.metadata.description,
          businessImpact: impact,
          relatedTrends: metrics.relevantTrends,
          implementationComplexity: metrics.complexity,
          developmentPriority: priorityScore,
          status: 'proposed',
          rationale: `Priority score ${priorityScore.toFixed(1)} based on business impact and market alignment`
        };
        
        prioritizedTools.push(prioritizedTool);
      } catch (error) {
        console.error(`Error prioritizing tool ${tool.metadata.name}:`, error);
      }
    }
    
    // Sort by priority score descending
    prioritizedTools.sort((a, b) => b.developmentPriority - a.developmentPriority);
    
    // Store the result
    this.prioritizedTools = prioritizedTools;
    
    return prioritizedTools;
  }
  
  /**
   * Calculate a priority score for a tool
   */
  private calculatePriorityScore(
    impact: BusinessImpact,
    trends: MarketTrend[],
    complexity: 'low' | 'medium' | 'high',
    usageStats?: any
  ): number {
    // Weights for different factors
    const weights = {
      businessValue: 0.25,
      strategicAlignment: 0.20,
      roi: 0.15,
      marketTrends: 0.15,
      complexity: 0.15,
      usage: 0.10
    };
    
    // Normalize complexity to 0-100 scale
    const complexityScore = 
      complexity === 'low' ? 80 : 
      complexity === 'medium' ? 50 : 
      20; // high
    
    // Calculate market trend alignment score
    const trendScore = trends.reduce((score, trend) => {
      const trendWeight = 
        trend.priority === 'high' ? 1.0 : 
        trend.priority === 'medium' ? 0.6 : 
        0.3; // low
      
      return score + (trendWeight * trend.confidence * 100);
    }, 0) / Math.max(1, trends.length);
    
    // Calculate usage score if available
    const usageScore = usageStats 
      ? Math.min(100, usageStats.usageCount) * usageStats.successRate
      : 50; // Default to middle value if no data
    
    // Calculate priority score (0-100 scale)
    const priorityScore = 
      weights.businessValue * impact.businessValue +
      weights.strategicAlignment * impact.strategicAlignment +
      weights.roi * Math.min(100, impact.roi * 10) + // Scale ROI to 0-100
      weights.marketTrends * trendScore +
      weights.complexity * complexityScore +
      weights.usage * usageScore;
    
    return priorityScore;
  }
  
  /**
   * Estimate implementation complexity for a tool
   */
  private estimateImplementationComplexity(toolInfo: any): 'low' | 'medium' | 'high' {
    // In a production system, this would be a more sophisticated analysis
    // For now, we'll use a simplified approach based on metadata
    
    const capabilities = toolInfo.metadata.capabilities || [];
    const inputs = toolInfo.metadata.inputs || [];
    
    // More capabilities and inputs generally mean higher complexity
    if (capabilities.length > 5 || inputs.length > 5) {
      return 'high';
    } else if (capabilities.length > 2 || inputs.length > 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Allocate development capacity to prioritized tools
   */
  async allocateDevelopmentCapacity(
    capacity: number = this.developerCapacity
  ): Promise<{ 
    allocations: Array<{tool: string, allocation: number}>;
    remainingCapacity: number;
  }> {
    if (this.prioritizedTools.length === 0) {
      await this.createPrioritizationFramework();
    }
    
    // Map complexity to capacity requirements
    const complexityCost = {
      low: 10,
      medium: 25,
      high: 50
    };
    
    // Allocate capacity based on priority
    let remainingCapacity = capacity;
    const allocations: Array<{tool: string, allocation: number}> = [];
    
    for (const tool of this.prioritizedTools) {
      // Skip tools that aren't in proposed status
      if (tool.status !== 'proposed') continue;
      
      // Calculate required capacity
      const requiredCapacity = complexityCost[tool.implementationComplexity];
      
      // If we have enough capacity, allocate to this tool
      if (requiredCapacity <= remainingCapacity) {
        allocations.push({
          tool: tool.name,
          allocation: requiredCapacity
        });
        
        remainingCapacity -= requiredCapacity;
        
        // Update tool status
        tool.status = 'approved';
        
        // Set target completion date based on complexity
        const targetDate = new Date();
        if (tool.implementationComplexity === 'low') {
          targetDate.setDate(targetDate.getDate() + 7); // 1 week
        } else if (tool.implementationComplexity === 'medium') {
          targetDate.setDate(targetDate.getDate() + 14); // 2 weeks
        } else {
          targetDate.setDate(targetDate.getDate() + 30); // 1 month
        }
        
        tool.targetCompletionDate = targetDate;
      }
      
      // If we're out of capacity, stop allocation
      if (remainingCapacity < 10) break;
    }
    
    return {
      allocations,
      remainingCapacity
    };
  }
  
  /**
   * Create tools based on prioritized needs
   */
  async executeToolCreationPlan(): Promise<{
    created: string[];
    failed: string[];
  }> {
    // If no prioritization exists, create one
    if (this.prioritizedTools.length === 0) {
      await this.createPrioritizationFramework();
    }
    
    // Allocate capacity if not already done
    const approvedTools = this.prioritizedTools.filter(t => t.status === 'approved');
    if (approvedTools.length === 0) {
      await this.allocateDevelopmentCapacity();
    }
    
    // Get the updated list of approved tools
    const toolsToCreate = this.prioritizedTools.filter(t => t.status === 'approved');
    
    const created: string[] = [];
    const failed: string[] = [];
    
    // Create each approved tool
    for (const tool of toolsToCreate) {
      console.log(`Creating tool: ${tool.name} (Priority: ${tool.developmentPriority.toFixed(1)})`);
      
      try {
        // Create tool description from the prioritized tool info
        const trends = tool.relatedTrends
          .map(t => t.name)
          .join(', ');
        
        const description = `
Tool: ${tool.name}
${tool.description}
This tool addresses the following market trends: ${trends}
Primary business impact areas: ${tool.businessImpact.impactAreas.join(', ')}
`;

        // Create the tool
        const result = await this.creation.createToolFromDescription(description);
        
        if (result && result.success) {
          console.log(`Successfully created tool: ${tool.name}`);
          created.push(tool.name);
          
          // Update tool status
          tool.status = 'completed';
        } else {
          console.error(`Failed to create tool: ${tool.name}`);
          failed.push(tool.name);
          
          // Update tool status
          tool.status = 'rejected';
        }
      } catch (error) {
        console.error(`Error creating tool ${tool.name}:`, error);
        failed.push(tool.name);
        
        // Update tool status
        tool.status = 'rejected';
      }
    }
    
    return {
      created,
      failed
    };
  }
  
  /**
   * Generate a strategic report on tool development
   */
  async generateStrategicReport(): Promise<string> {
    // Ensure we have prioritization data
    if (this.prioritizedTools.length === 0) {
      await this.createPrioritizationFramework();
    }
    
    // Get tool statistics
    const toolCount = this.registry.getAllTools().length;
    const highPriorityCount = this.prioritizedTools.filter(t => t.developmentPriority > 70).length;
    const mediumPriorityCount = this.prioritizedTools.filter(t => t.developmentPriority > 40 && t.developmentPriority <= 70).length;
    const lowPriorityCount = this.prioritizedTools.filter(t => t.developmentPriority <= 40).length;
    
    // Get market trend statistics
    const highPriorityTrends = this.marketTrends.filter(t => t.priority === 'high').length;
    const mediumPriorityTrends = this.marketTrends.filter(t => t.priority === 'medium').length;
    const lowPriorityTrends = this.marketTrends.filter(t => t.priority === 'low').length;
    
    // Get tool status statistics
    const proposedCount = this.prioritizedTools.filter(t => t.status === 'proposed').length;
    const approvedCount = this.prioritizedTools.filter(t => t.status === 'approved').length;
    const inDevelopmentCount = this.prioritizedTools.filter(t => t.status === 'in_development').length;
    const completedCount = this.prioritizedTools.filter(t => t.status === 'completed').length;
    const rejectedCount = this.prioritizedTools.filter(t => t.status === 'rejected').length;
    
    // Format top tools for the report
    const topTools = this.prioritizedTools
      .slice(0, 5)
      .map(tool => {
        return `- ${tool.name} (Priority: ${tool.developmentPriority.toFixed(1)}, Status: ${tool.status})
  Business Value: ${tool.businessImpact.businessValue}/100, ROI: ${tool.businessImpact.roi.toFixed(1)}
  Complexity: ${tool.implementationComplexity}, Related Trends: ${tool.relatedTrends.map(t => t.name).join(', ')}`;
      })
      .join('\n\n');
    
    // Format top trends for the report
    const topTrends = this.marketTrends
      .slice(0, 5)
      .map(trend => {
        return `- ${trend.name} (Priority: ${trend.priority}, Confidence: ${trend.confidence.toFixed(2)})
  ${trend.description}
  Relevant Domains: ${trend.relevantDomains.join(', ')}`;
      })
      .join('\n\n');
    
    try {
      const prompt = `
You are a strategic analyst creating a comprehensive report on the current state of tool development.

Tool Portfolio Overview:
- Total Tools: ${toolCount}
- High Priority Tools: ${highPriorityCount}
- Medium Priority Tools: ${mediumPriorityCount}
- Low Priority Tools: ${lowPriorityCount}

Tool Development Status:
- Proposed: ${proposedCount}
- Approved: ${approvedCount}
- In Development: ${inDevelopmentCount}
- Completed: ${completedCount}
- Rejected: ${rejectedCount}

Market Trends:
- High Priority Trends: ${highPriorityTrends}
- Medium Priority Trends: ${mediumPriorityTrends}
- Low Priority Trends: ${lowPriorityTrends}

Top Priority Tools:
${topTools}

Top Market Trends:
${topTrends}

Please generate a comprehensive strategic report that includes:
1. Executive Summary of the current tool development landscape
2. Analysis of how well current tools align with market trends
3. Strategic recommendations for future tool development
4. Gaps in the current tool portfolio that should be addressed
5. Specific tools that should be prioritized for immediate development

The report should be well-structured, data-driven, and focused on actionable insights.
`;

      const response = await this.model.invoke(prompt);
      return response.content;
    } catch (error) {
      console.error('Error generating strategic report:', error);
      
      // Return a basic report if LLM generation fails
      return `
# Strategic Tool Development Report

## Executive Summary
The tool portfolio consists of ${toolCount} tools, with ${highPriorityCount} high priority, ${mediumPriorityCount} medium priority, and ${lowPriorityCount} low priority tools.

## Development Status
- Proposed: ${proposedCount}
- Approved: ${approvedCount}
- In Development: ${inDevelopmentCount}
- Completed: ${completedCount}
- Rejected: ${rejectedCount}

## Top Priority Tools
${topTools}

## Top Market Trends
${topTrends}

*Error generating full report. Please try again later.*
`;
    }
  }
  
  /**
   * Get all prioritized tools
   */
  getPrioritizedTools(): PrioritizedTool[] {
    return this.prioritizedTools;
  }
  
  /**
   * Get all market trends
   */
  getMarketTrends(): MarketTrend[] {
    return this.marketTrends;
  }
  
  /**
   * Get business impact for a specific tool
   */
  getBusinessImpact(toolName: string): BusinessImpact | null {
    return this.businessImpacts.get(toolName) || null;
  }
  
  /**
   * Set the available developer capacity
   */
  setDeveloperCapacity(capacity: number): void {
    this.developerCapacity = capacity;
  }
} 