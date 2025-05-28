/**
 * Knowledge Gap Analyzer
 * 
 * Handles knowledge gap identification, analysis, impact assessment, and learning plan generation
 * for the reflection system. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  KnowledgeGapAnalyzer as IKnowledgeGapAnalyzer,
  TimeRange,
  LearningPlan,
  GapImpactAssessment,
  GapClosureProgress,
  GapPatternAnalysis
} from '../interfaces/ReflectionInterfaces';
import { KnowledgeGap } from '../../base/managers/ReflectionManager.interface';
import {
  KnowledgeGapAnalysisConfig,
  GapIdentificationOptions,
  AnalysisResult,
  AnalysisError
} from '../interfaces/AnalysisInterfaces';

/**
 * Error class for knowledge gap analysis errors
 */
export class KnowledgeGapAnalysisError extends Error implements AnalysisError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly recoverable: boolean = true,
    public readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'KnowledgeGapAnalysisError';
  }
}

/**
 * Default configuration for knowledge gap analysis
 */
const DEFAULT_CONFIG: Required<KnowledgeGapAnalysisConfig> = {
  enablePatternAnalysis: true,
  enableImpactAssessment: true,
  enableLearningPlanGeneration: true,
  enableGapPrioritization: true,
  maxGapsToAnalyze: 50,
  impactAssessmentDepth: 'standard',
  learningPlanComplexity: 'intermediate',
  prioritizationCriteria: ['impact', 'urgency', 'feasibility', 'resources']
};

/**
 * Implementation of knowledge gap analyzer for reflection system
 */
export class KnowledgeGapAnalyzer implements IKnowledgeGapAnalyzer {
  private config: Required<KnowledgeGapAnalysisConfig>;
  private identifiedGaps = new Map<string, KnowledgeGap>();
  private impactAssessments = new Map<string, GapImpactAssessment>();
  private learningPlans = new Map<string, LearningPlan>();
  private analysisCache = new Map<string, { result: AnalysisResult<unknown>; timestamp: Date }>();

  constructor(config: KnowledgeGapAnalysisConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Identify knowledge gaps from various sources
   */
  async identifyGaps(options: GapIdentificationOptions = {}): Promise<KnowledgeGap[]> {
    const startTime = Date.now();
    
    try {
      // Validate options
      this.validateIdentificationOptions(options);

      // Set defaults
      const sources = options.sources || ['conversations', 'documents', 'tasks', 'feedback', 'reflections'];
      const maxGaps = Math.min(options.maxGaps || 20, this.config.maxGapsToAnalyze);
      const minConfidence = options.minConfidence || 0.3;

      const identifiedGaps: KnowledgeGap[] = [];

      // Analyze each source type
      for (const source of sources) {
        const sourceGaps = await this.analyzeSource(source, options);
        
        for (const gap of sourceGaps) {
          if (gap.impactLevel >= minConfidence && identifiedGaps.length < maxGaps) {
            // Check for duplicates
            const existingGap = this.findSimilarGap(gap, identifiedGaps);
            if (!existingGap) {
              identifiedGaps.push(gap);
              this.identifiedGaps.set(gap.id, gap);
            } else {
              // Merge with existing gap
              this.mergeGaps(existingGap, gap);
            }
          }
        }
      }

      // Filter by categories if specified
      let filteredGaps = identifiedGaps;
      if (options.categories && options.categories.length > 0) {
        filteredGaps = identifiedGaps.filter(gap => 
          options.categories!.includes(gap.domain)
        );
      }

      // Exclude resolved gaps if requested
      if (options.excludeResolved) {
        filteredGaps = filteredGaps.filter(gap => gap.status !== 'resolved');
      }

      return filteredGaps.slice(0, maxGaps);

    } catch (error) {
      throw new KnowledgeGapAnalysisError(
        `Gap identification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GAP_IDENTIFICATION_FAILED',
        { options, error },
        true,
        ['Check source data availability', 'Verify options', 'Review configuration']
      );
    }
  }

  /**
   * Assess the impact of knowledge gaps (interface method)
   */
  async assessGapImpact(gapId: string): Promise<GapImpactAssessment> {
    return this.assessImpact(gapId);
  }

  /**
   * Assess the impact of knowledge gaps
   */
  async assessImpact(gapId: string): Promise<GapImpactAssessment> {
    try {
      // Check cache first
      const cached = this.impactAssessments.get(gapId);
      if (cached && Date.now() - cached.assessedAt.getTime() < 24 * 60 * 60 * 1000) {
        return cached;
      }

      const gap = this.identifiedGaps.get(gapId);
      if (!gap) {
        throw new KnowledgeGapAnalysisError(
          `Knowledge gap not found: ${gapId}`,
          'GAP_NOT_FOUND',
          { gapId }
        );
      }

      // Perform impact assessment based on configuration depth
      const assessment = await this.performImpactAssessment(gap);
      
      // Cache the assessment
      this.impactAssessments.set(gapId, assessment);
      
      return assessment;

    } catch (error) {
      throw new KnowledgeGapAnalysisError(
        `Impact assessment failed for gap ${gapId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMPACT_ASSESSMENT_FAILED',
        { gapId, error },
        true,
        ['Verify gap exists', 'Check assessment configuration', 'Review impact criteria']
      );
    }
  }

  /**
   * Generate learning plan for addressing knowledge gaps
   */
  async generateLearningPlan(gapId: string): Promise<LearningPlan> {
    try {
      // Check if plan already exists
      const existingPlan = this.learningPlans.get(gapId);
      if (existingPlan) {
        return existingPlan;
      }

      const gap = this.identifiedGaps.get(gapId);
      if (!gap) {
        throw new KnowledgeGapAnalysisError(
          `Knowledge gap not found: ${gapId}`,
          'GAP_NOT_FOUND',
          { gapId }
        );
      }

      // Generate learning plan based on gap characteristics
      const plan = await this.createLearningPlan(gap);
      
      // Cache the plan
      this.learningPlans.set(gapId, plan);
      
      return plan;

    } catch (error) {
      throw new KnowledgeGapAnalysisError(
        `Learning plan generation failed for gap ${gapId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LEARNING_PLAN_GENERATION_FAILED',
        { gapId, error },
        true,
        ['Verify gap exists', 'Check plan configuration', 'Review learning resources']
      );
    }
  }

  /**
   * Analyze patterns in knowledge gaps
   */
  async analyzePatterns(timeRange: TimeRange): Promise<GapPatternAnalysis> {
    try {
      if (!this.config.enablePatternAnalysis) {
        return this.createEmptyPatternAnalysis(timeRange);
      }

      // Filter gaps by time range
      const gapsInRange = Array.from(this.identifiedGaps.values()).filter(gap =>
        gap.identifiedAt >= timeRange.start && gap.identifiedAt <= timeRange.end
      );

      if (gapsInRange.length === 0) {
        return this.createEmptyPatternAnalysis(timeRange);
      }

      // Analyze common patterns
      const commonGaps = this.identifyCommonGapPatterns(gapsInRange);
      
      // Categorize gaps
      const gapCategories = this.categorizeGaps(gapsInRange);
      
      // Identify trends
      const trends = this.identifyGapTrends(gapsInRange, timeRange);
      
      // Find correlations
      const correlations = this.findGapCorrelations(gapsInRange);
      
      // Generate recommendations
      const recommendations = this.generatePatternRecommendations(commonGaps, trends, correlations);

      return {
        analysisDate: new Date(),
        timeRange,
        commonGaps,
        gapCategories,
        trends,
        correlations,
        recommendations,
        confidence: this.calculatePatternConfidence(gapsInRange.length)
      };

    } catch (error) {
      throw new KnowledgeGapAnalysisError(
        `Pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PATTERN_ANALYSIS_FAILED',
        { timeRange, error },
        true,
        ['Check data availability', 'Verify time range', 'Review pattern configuration']
      );
    }
  }

  /**
   * Prioritize knowledge gaps
   */
  async prioritizeGaps(gaps: KnowledgeGap[]): Promise<KnowledgeGap[]> {
    // Sort gaps by priority and impact level
    return gaps.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.impactLevel - a.impactLevel;
    });
  }

  /**
   * Track gap closure (interface method)
   */
  async trackGapClosure(gapId: string): Promise<GapClosureProgress> {
    return this.trackProgress(gapId);
  }

  /**
   * Analyze gap patterns (interface method)
   */
  async analyzeGapPatterns(): Promise<GapPatternAnalysis> {
    const timeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };
    return this.analyzePatterns(timeRange);
  }

  /**
   * Track progress on gap closure
   */
  async trackProgress(gapId: string): Promise<GapClosureProgress> {
    try {
      const gap = this.identifiedGaps.get(gapId);
      if (!gap) {
        throw new KnowledgeGapAnalysisError(
          `Knowledge gap not found: ${gapId}`,
          'GAP_NOT_FOUND',
          { gapId }
        );
      }

      // Calculate progress based on gap status and learning plan
      const progress = this.calculateGapProgress(gap);
      
      // Get learning plan milestones
      const learningPlan = this.learningPlans.get(gapId);
      const milestones = learningPlan ? this.convertToGapMilestones(learningPlan) : [];
      
      // Identify blockers
      const blockers = this.identifyProgressBlockers(gap);
      
      // Identify required resources
      const resources = this.identifyRequiredResources(gap);
      
      // Estimate completion
      const estimatedCompletion = this.estimateCompletionDate(gap, progress);

      return {
        gapId,
        progress,
        milestones,
        estimatedCompletion,
        blockers,
        resources,
        lastUpdated: new Date(),
        confidence: 0.7
      };

    } catch (error) {
      throw new KnowledgeGapAnalysisError(
        `Progress tracking failed for gap ${gapId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROGRESS_TRACKING_FAILED',
        { gapId, error },
        true,
        ['Verify gap exists', 'Check progress data', 'Review tracking configuration']
      );
    }
  }

  /**
   * Get analysis statistics
   */
  getStats(): Record<string, unknown> {
    const gaps = Array.from(this.identifiedGaps.values());
    const statusCounts = gaps.reduce((acc, gap) => {
      acc[gap.status] = (acc[gap.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityCounts = gaps.reduce((acc, gap) => {
      acc[gap.priority] = (acc[gap.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalGaps: gaps.length,
      statusDistribution: statusCounts,
      priorityDistribution: priorityCounts,
      impactAssessments: this.impactAssessments.size,
      learningPlans: this.learningPlans.size,
      cacheSize: this.analysisCache.size,
      config: this.config,
      analysisCapabilities: {
        patternAnalysis: this.config.enablePatternAnalysis,
        impactAssessment: this.config.enableImpactAssessment,
        learningPlanGeneration: this.config.enableLearningPlanGeneration,
        gapPrioritization: this.config.enableGapPrioritization
      }
    };
  }

  /**
   * Clear all data and reset state
   */
  async clear(): Promise<void> {
    this.identifiedGaps.clear();
    this.impactAssessments.clear();
    this.learningPlans.clear();
    this.analysisCache.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateIdentificationOptions(options: GapIdentificationOptions): void {
    if (options.timeRange) {
      if (options.timeRange.start >= options.timeRange.end) {
        throw new KnowledgeGapAnalysisError(
          'Invalid time range: start must be before end',
          'INVALID_TIME_RANGE',
          { timeRange: options.timeRange }
        );
      }
    }

    if (options.maxGaps && options.maxGaps <= 0) {
      throw new KnowledgeGapAnalysisError(
        'Invalid maxGaps: must be positive',
        'INVALID_MAX_GAPS',
        { maxGaps: options.maxGaps }
      );
    }

    if (options.minConfidence && (options.minConfidence < 0 || options.minConfidence > 1)) {
      throw new KnowledgeGapAnalysisError(
        'Invalid minConfidence: must be between 0 and 1',
        'INVALID_MIN_CONFIDENCE',
        { minConfidence: options.minConfidence }
      );
    }
  }

  private async analyzeSource(source: string, options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate source analysis - in real implementation, this would analyze actual data
    const gaps: KnowledgeGap[] = [];
    
    switch (source) {
      case 'conversations':
        gaps.push(...await this.analyzeConversations(options));
        break;
      case 'documents':
        gaps.push(...await this.analyzeDocuments(options));
        break;
      case 'tasks':
        gaps.push(...await this.analyzeTasks(options));
        break;
      case 'feedback':
        gaps.push(...await this.analyzeFeedback(options));
        break;
      case 'reflections':
        gaps.push(...await this.analyzeReflections(options));
        break;
    }
    
    return gaps;
  }

  private async analyzeConversations(options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate conversation analysis
    return [{
      id: ulid(),
      description: 'Communication patterns indicate gaps in technical terminology',
      identifiedAt: new Date(),
      priority: 'medium',
      impactLevel: 0.6,
      status: 'identified',
      domain: 'communication',
      relatedReflectionIds: []
    }];
  }

  private async analyzeDocuments(options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate document analysis
    return [{
      id: ulid(),
      description: 'Documentation review reveals knowledge gaps in advanced features',
      identifiedAt: new Date(),
      priority: 'high',
      impactLevel: 0.8,
      status: 'identified',
      domain: 'technical',
      relatedReflectionIds: []
    }];
  }

  private async analyzeTasks(options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate task analysis
    return [{
      id: ulid(),
      description: 'Task execution patterns show gaps in optimization strategies',
      identifiedAt: new Date(),
      priority: 'medium',
      impactLevel: 0.7,
      status: 'identified',
      domain: 'optimization',
      relatedReflectionIds: []
    }];
  }

  private async analyzeFeedback(options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate feedback analysis
    return [{
      id: ulid(),
      description: 'User feedback indicates gaps in user experience understanding',
      identifiedAt: new Date(),
      priority: 'high',
      impactLevel: 0.9,
      status: 'identified',
      domain: 'user_experience',
      relatedReflectionIds: []
    }];
  }

  private async analyzeReflections(options: GapIdentificationOptions): Promise<KnowledgeGap[]> {
    // Simulate reflection analysis
    return [{
      id: ulid(),
      description: 'Self-reflection reveals gaps in strategic thinking',
      identifiedAt: new Date(),
      priority: 'medium',
      impactLevel: 0.6,
      status: 'identified',
      domain: 'strategy',
      relatedReflectionIds: []
    }];
  }

  private findSimilarGap(gap: KnowledgeGap, gaps: KnowledgeGap[]): KnowledgeGap | undefined {
    return gaps.find(existing => 
      existing.domain === gap.domain && 
      this.calculateSimilarity(existing.description, gap.description) > 0.8
    );
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation - in real implementation, use more sophisticated NLP
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const allWords = words1.concat(words2);
    const uniqueWords = allWords.filter((word, index) => allWords.indexOf(word) === index);
    return intersection.length / uniqueWords.length;
  }

  private mergeGaps(existing: KnowledgeGap, newGap: KnowledgeGap): void {
    // Merge impact levels (take higher)
    existing.impactLevel = Math.max(existing.impactLevel, newGap.impactLevel);
    
    // Merge priorities (take higher)
    const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    if (priorityOrder[newGap.priority] > priorityOrder[existing.priority]) {
      existing.priority = newGap.priority;
    }
    
    // Merge related reflections
    if (newGap.relatedReflectionIds) {
      existing.relatedReflectionIds = [
        ...(existing.relatedReflectionIds || []),
        ...newGap.relatedReflectionIds
      ];
    }
  }

  private async performImpactAssessment(gap: KnowledgeGap): Promise<GapImpactAssessment> {
    // Calculate impact level based on various factors
    const impactLevel = this.calculateImpactLevel(gap);
    
    // Determine urgency
    const urgency = this.determineUrgency(gap);
    
    // Identify affected areas
    const affectedAreas = this.identifyAffectedAreas(gap);
    
    // Estimate cost
    const estimatedCost = this.estimateCost(gap);
    
    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(gap);
    
    // Find dependencies
    const dependencies = this.findDependencies(gap);

    return {
      gapId: gap.id,
      assessedAt: new Date(),
      impactLevel,
      affectedAreas,
      urgency,
      estimatedCost,
      riskFactors,
      dependencies,
      confidence: 0.8,
      methodology: this.config.impactAssessmentDepth
    };
  }

  private calculateImpactLevel(gap: KnowledgeGap): number {
    // Base impact on existing impact level and priority
    let impact = gap.impactLevel;
    
    // Adjust based on priority
    const priorityMultiplier = { low: 0.8, medium: 1.0, high: 1.3, critical: 1.5 };
    impact *= priorityMultiplier[gap.priority];
    
    // Adjust based on domain criticality
    const domainMultiplier = this.getDomainCriticalityMultiplier(gap.domain);
    impact *= domainMultiplier;
    
    return Math.min(10, Math.max(1, Math.round(impact * 10)));
  }

  private determineUrgency(gap: KnowledgeGap): 'low' | 'medium' | 'high' | 'critical' {
    // Map priority to urgency with some variation
    const urgencyMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical'
    };
    
    return urgencyMap[gap.priority] || 'medium';
  }

  private identifyAffectedAreas(gap: KnowledgeGap): string[] {
    // Identify areas affected by this knowledge gap
    const baseAreas = [gap.domain];
    
    // Add related areas based on domain
    const relatedAreas = this.getRelatedAreas(gap.domain);
    
    return [...baseAreas, ...relatedAreas];
  }

  private estimateCost(gap: KnowledgeGap): number {
    // Estimate cost based on impact and complexity
    const baseCost = gap.impactLevel * 100;
    const priorityMultiplier = { low: 0.5, medium: 1.0, high: 1.5, critical: 2.0 };
    
    return baseCost * priorityMultiplier[gap.priority];
  }

  private identifyRiskFactors(gap: KnowledgeGap): string[] {
    const riskFactors: string[] = [];
    
    if (gap.priority === 'critical') {
      riskFactors.push('High priority gap may block critical operations');
    }
    
    if (gap.impactLevel > 0.8) {
      riskFactors.push('High impact gap may affect multiple systems');
    }
    
    if (gap.status === 'identified') {
      riskFactors.push('Gap not yet being addressed');
    }
    
    return riskFactors;
  }

  private findDependencies(gap: KnowledgeGap): string[] {
    // Find other gaps or systems that depend on this gap being resolved
    const dependencies: string[] = [];
    
    // Check for gaps in related domains
    this.identifiedGaps.forEach((otherGap, id) => {
      if (id !== gap.id && this.areDomainsRelated(gap.domain, otherGap.domain)) {
        dependencies.push(id);
      }
    });
    
    return dependencies;
  }

  private async createLearningPlan(gap: KnowledgeGap): Promise<LearningPlan> {
    // Generate learning objectives as strings (matching ReflectionInterfaces.ts)
    const objectives = this.generateLearningObjectiveStrings(gap);
    
    // Identify resources
    const resources = this.identifyLearningResources(gap);
    
    // Create timeline
    const timeline = this.createLearningTimeline(gap);
    
    // Design assessments
    const assessments = this.designAssessments(gap);

    return {
      gapId: gap.id,
      objectives,
      resources,
      timeline,
      assessments
    };
  }

  private generateLearningObjectiveStrings(gap: KnowledgeGap): string[] {
    // Generate specific, measurable learning objectives as strings
    return [
      `Understand core concepts in ${gap.domain}`,
      `Demonstrate knowledge of ${gap.domain} fundamentals`,
      `Apply ${gap.domain} principles in practical scenarios`
    ];
  }

  private identifyLearningResources(gap: KnowledgeGap): any[] {
    // Identify appropriate learning resources
    return [{
      type: 'document' as const,
      title: `${gap.domain} Documentation`,
      estimatedTime: 5,
      difficulty: 'intermediate' as const,
      cost: 0,
      availability: 'immediate' as const,
      effectiveness: 8
    }];
  }

  private createLearningTimeline(gap: KnowledgeGap): any {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    return {
      startDate,
      endDate,
      phases: [{
        name: 'Foundation Phase',
        duration: 20,
        objectives: [`Understand core concepts in ${gap.domain}`],
        resources: ['Documentation', 'Tutorials']
      }]
    };
  }

  private designAssessments(gap: KnowledgeGap): any[] {
    return [{
      type: 'quiz' as const,
      description: `${gap.domain} knowledge assessment`,
      criteria: [`Demonstrate understanding of ${gap.domain} concepts`],
      passingScore: 80
    }];
  }

  private identifyPrerequisites(gap: KnowledgeGap): string[] {
    // Identify knowledge prerequisites
    const prerequisites: string[] = [];
    
    if (gap.domain === 'technical') {
      prerequisites.push('Basic programming concepts');
    }
    
    return prerequisites;
  }

  private estimateLearningDuration(objectives: any[], resources: any[]): number {
    const objectiveTime = objectives.reduce((sum, obj) => sum + obj.estimatedTime, 0);
    const resourceTime = resources.reduce((sum, res) => sum + res.estimatedTime, 0);
    
    return Math.max(objectiveTime, resourceTime);
  }

  private determineLearningDifficulty(gap: KnowledgeGap): 'beginner' | 'intermediate' | 'advanced' {
    if (gap.impactLevel > 0.8) return 'advanced';
    if (gap.impactLevel > 0.5) return 'intermediate';
    return 'beginner';
  }

  private identifyCommonGapPatterns(gaps: KnowledgeGap[]): any[] {
    // Analyze patterns in knowledge gaps
    const domainCounts = gaps.reduce((acc, gap) => {
      acc[gap.domain] = (acc[gap.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(domainCounts)
      .filter(([, count]) => count > 1)
      .map(([domain, frequency]) => ({
        pattern: `Recurring gaps in ${domain}`,
        frequency,
        examples: gaps.filter(g => g.domain === domain).map(g => g.description),
        significance: frequency / gaps.length,
        description: `Multiple knowledge gaps identified in ${domain} domain`,
        suggestedActions: [`Focus learning efforts on ${domain}`, `Seek mentoring in ${domain}`]
      }));
  }

  private categorizeGaps(gaps: KnowledgeGap[]): Record<string, number> {
    return gaps.reduce((acc, gap) => {
      acc[gap.domain] = (acc[gap.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private identifyGapTrends(gaps: KnowledgeGap[], timeRange: TimeRange): any[] {
    // Simple trend analysis - in real implementation, use more sophisticated analysis
    const monthlyGaps = gaps.reduce((acc, gap) => {
      const month = gap.identifiedAt.toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const months = Object.keys(monthlyGaps).sort();
    if (months.length < 2) return [];

    const trend = months.length > 1 && monthlyGaps[months[months.length - 1]] > monthlyGaps[months[0]] 
      ? 'increasing' : 'stable';

    return [{
      metric: 'gap_identification_rate',
      direction: trend,
      strength: 0.5,
      confidence: 0.6,
      timeRange
    }];
  }

  private findGapCorrelations(gaps: KnowledgeGap[]): any[] {
    // Find correlations between different types of gaps
    const correlations: any[] = [];
    
    const allDomains = gaps.map(g => g.domain);
    const domains = allDomains.filter((domain, index) => allDomains.indexOf(domain) === index);
    
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const domain1 = domains[i];
        const domain2 = domains[j];
        
        const gaps1 = gaps.filter(g => g.domain === domain1);
        const gaps2 = gaps.filter(g => g.domain === domain2);
        
        if (gaps1.length > 0 && gaps2.length > 0) {
          correlations.push({
            gap1: domain1,
            gap2: domain2,
            correlation: 0.5, // Simplified correlation
            significance: 0.6,
            description: `Gaps in ${domain1} often occur with gaps in ${domain2}`,
            implications: [`Consider integrated learning approach for ${domain1} and ${domain2}`]
          });
        }
      }
    }
    
    return correlations;
  }

  private generatePatternRecommendations(commonGaps: any[], trends: any[], correlations: any[]): string[] {
    const recommendations: string[] = [];
    
    if (commonGaps.length > 0) {
      recommendations.push(`Focus on addressing recurring gaps in ${commonGaps[0].pattern}`);
    }
    
    if (trends.some(t => t.direction === 'increasing')) {
      recommendations.push('Implement proactive knowledge gap prevention strategies');
    }
    
    if (correlations.length > 0) {
      recommendations.push('Consider integrated learning approaches for correlated knowledge areas');
    }
    
    return recommendations;
  }

  private calculatePatternConfidence(gapCount: number): number {
    // Confidence increases with more data points
    return Math.min(1.0, gapCount / 20);
  }

  private createEmptyPatternAnalysis(timeRange: TimeRange): GapPatternAnalysis {
    return {
      analysisDate: new Date(),
      timeRange,
      commonGaps: [],
      gapCategories: {},
      trends: [],
      correlations: [],
      recommendations: [],
      confidence: 0
    };
  }

  private calculateGapProgress(gap: KnowledgeGap): number {
    // Calculate progress based on status
    const statusProgress = {
      identified: 0,
      planned: 25,
      addressing: 50,
      resolved: 100,
      ignored: 0
    };
    
    return statusProgress[gap.status] || 0;
  }

  private convertToGapMilestones(learningPlan: LearningPlan): any[] {
    return learningPlan.timeline.phases.map((phase, index) => ({
      id: `milestone-${index}`,
      description: phase.name,
      completed: false,
      dueDate: learningPlan.timeline.endDate,
      weight: 1.0 / learningPlan.timeline.phases.length,
      dependencies: []
    }));
  }

  private identifyProgressBlockers(gap: KnowledgeGap): any[] {
    const blockers: any[] = [];
    
    if (gap.priority === 'low') {
      blockers.push({
        id: ulid(),
        description: 'Low priority may result in delayed attention',
        severity: 'low' as const,
        identifiedAt: new Date(),
        category: 'prioritization',
        suggestedResolution: 'Reassess priority based on current needs',
        estimatedResolutionTime: 1
      });
    }
    
    return blockers;
  }

  private identifyRequiredResources(gap: KnowledgeGap): any[] {
    return [{
      type: 'document' as const,
      title: `Learning resources for ${gap.domain}`,
      estimatedTime: 10,
      difficulty: 'intermediate' as const,
      cost: 0,
      availability: 'immediate' as const,
      effectiveness: 7
    }];
  }

  private estimateCompletionDate(gap: KnowledgeGap, progress: number): Date {
    const daysRemaining = Math.max(1, Math.round((100 - progress) / 10)); // Rough estimate
    return new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
  }

  private getDomainCriticalityMultiplier(domain: string): number {
    const criticalityMap: Record<string, number> = {
      technical: 1.2,
      communication: 1.0,
      strategy: 1.3,
      user_experience: 1.1,
      optimization: 1.0
    };
    
    return criticalityMap[domain] || 1.0;
  }

  private getRelatedAreas(domain: string): string[] {
    const relatedAreasMap: Record<string, string[]> = {
      technical: ['optimization', 'architecture'],
      communication: ['user_experience', 'documentation'],
      strategy: ['planning', 'decision_making'],
      user_experience: ['design', 'usability'],
      optimization: ['performance', 'efficiency']
    };
    
    return relatedAreasMap[domain] || [];
  }

  private areDomainsRelated(domain1: string, domain2: string): boolean {
    const relatedAreas = this.getRelatedAreas(domain1);
    return relatedAreas.includes(domain2) || this.getRelatedAreas(domain2).includes(domain1);
  }
} 