/**
 * Reflection Analyzer
 * 
 * Handles reflection quality assessment, insight extraction, pattern recognition,
 * and effectiveness measurement for the reflection system. Extracted from DefaultReflectionManager.
 */

import { ulid } from 'ulid';
import { 
  ReflectionAnalyzer as IReflectionAnalyzer,
  TimeRange,
  QualityAssessment,
  PatternRecognition,
  EffectivenessMetrics,
  ReflectionInsight,
  ApplicationAnalysis
} from '../interfaces/ReflectionInterfaces';
import { Reflection } from '../../base/managers/ReflectionManager.interface';

/**
 * Error class for reflection analysis errors
 */
export class ReflectionAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly recoverable: boolean = true,
    public readonly suggestions: string[] = []
  ) {
    super(message);
    this.name = 'ReflectionAnalysisError';
  }
}

/**
 * Implementation of reflection analyzer for reflection system
 */
export class ReflectionAnalyzer implements IReflectionAnalyzer {
  private reflections = new Map<string, Reflection>();
  private qualityAssessments = new Map<string, QualityAssessment>();
  private insightExtractions = new Map<string, ReflectionInsight[]>();
  private effectivenessMetrics = new Map<string, EffectivenessMetrics>();

  /**
   * Assess the quality of a reflection
   */
  async assessQuality(reflection: Reflection): Promise<QualityAssessment> {
    try {
      // Add reflection to internal storage if not present
      if (!this.reflections.has(reflection.id)) {
        this.reflections.set(reflection.id, reflection);
      }

      // Check cache first
      const cached = this.qualityAssessments.get(reflection.id);
      if (cached) {
        return cached;
      }

      // Perform quality assessment
      const assessment = await this.performQualityAssessment(reflection);
      
      // Cache the assessment
      this.qualityAssessments.set(reflection.id, assessment);
      
      return assessment;

    } catch (error) {
      throw new ReflectionAnalysisError(
        `Quality assessment failed for reflection ${reflection.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QUALITY_ASSESSMENT_FAILED',
        { reflectionId: reflection.id, error },
        true,
        ['Verify reflection exists', 'Check assessment configuration', 'Review quality criteria']
      );
    }
  }

  /**
   * Extract insights from a reflection
   */
  async extractInsights(reflection: Reflection): Promise<ReflectionInsight[]> {
    try {
      // Add reflection to internal storage if not present
      if (!this.reflections.has(reflection.id)) {
        this.reflections.set(reflection.id, reflection);
      }

      // Check cache first
      const cached = this.insightExtractions.get(reflection.id);
      if (cached) {
        return cached;
      }

      // Extract insights
      const insights = await this.performInsightExtraction(reflection);
      
      // Cache the insights
      this.insightExtractions.set(reflection.id, insights);
      
      return insights;

    } catch (error) {
      throw new ReflectionAnalysisError(
        `Insight extraction failed for reflection ${reflection.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INSIGHT_EXTRACTION_FAILED',
        { reflectionId: reflection.id, error },
        true,
        ['Verify reflection exists', 'Check extraction configuration', 'Review insight criteria']
      );
    }
  }

  /**
   * Recognize patterns across multiple reflections
   */
  async recognizePatterns(reflections: Reflection[]): Promise<PatternRecognition> {
    try {
      // Store reflections
      reflections.forEach(reflection => {
        this.reflections.set(reflection.id, reflection);
      });

      if (reflections.length === 0) {
        return this.createEmptyPatternRecognition();
      }

      // Perform pattern recognition
      const patterns = await this.identifyReflectionPatterns(reflections);
      
      // Generate insights and recommendations
      const insights = this.generatePatternInsights(patterns);
      const recommendations = this.generatePatternRecommendations(patterns);

      return {
        patterns,
        confidence: this.calculatePatternConfidence(reflections.length),
        insights,
        recommendations
      };

    } catch (error) {
      throw new ReflectionAnalysisError(
        `Pattern recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PATTERN_RECOGNITION_FAILED',
        { reflectionCount: reflections.length, error },
        true,
        ['Check reflection data', 'Review pattern configuration']
      );
    }
  }

  /**
   * Measure reflection effectiveness
   */
  async measureEffectiveness(reflectionId: string): Promise<EffectivenessMetrics> {
    try {
      // Check cache first
      const cached = this.effectivenessMetrics.get(reflectionId);
      if (cached) {
        return cached;
      }

      const reflection = this.reflections.get(reflectionId);
      if (!reflection) {
        throw new ReflectionAnalysisError(
          `Reflection not found: ${reflectionId}`,
          'REFLECTION_NOT_FOUND',
          { reflectionId }
        );
      }

      // Measure effectiveness
      const metrics = await this.calculateEffectivenessMetrics(reflection);
      
      // Cache the metrics
      this.effectivenessMetrics.set(reflectionId, metrics);
      
      return metrics;

    } catch (error) {
      // Re-throw ReflectionAnalysisError as-is
      if (error instanceof ReflectionAnalysisError) {
        throw error;
      }
      
      throw new ReflectionAnalysisError(
        `Effectiveness measurement failed for reflection ${reflectionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EFFECTIVENESS_MEASUREMENT_FAILED',
        { reflectionId, error },
        true,
        ['Verify reflection exists', 'Check measurement configuration', 'Review effectiveness criteria']
      );
    }
  }

  /**
   * Analyze insight application
   */
  async analyzeInsightApplication(insightId: string): Promise<ApplicationAnalysis> {
    try {
      // Perform the actual analysis
      return await this.performApplicationAnalysis(insightId);

    } catch (error) {
      throw new ReflectionAnalysisError(
        `Application analysis failed for insight ${insightId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPLICATION_ANALYSIS_FAILED',
        { insightId, error },
        true,
        ['Verify insight exists', 'Check application tracking', 'Review analysis configuration']
      );
    }
  }

  /**
   * Add reflection for analysis
   */
  addReflection(reflection: Reflection): void {
    this.reflections.set(reflection.id, reflection);
  }

  /**
   * Remove reflection from analysis
   */
  removeReflection(reflectionId: string): void {
    this.reflections.delete(reflectionId);
    this.qualityAssessments.delete(reflectionId);
    this.insightExtractions.delete(reflectionId);
    this.effectivenessMetrics.delete(reflectionId);
  }

  /**
   * Get analysis statistics
   */
  getStats(): Record<string, unknown> {
    const reflections = Array.from(this.reflections.values());
    
    return {
      totalReflections: reflections.length,
      qualityAssessments: this.qualityAssessments.size,
      insightExtractions: this.insightExtractions.size,
      effectivenessMetrics: this.effectivenessMetrics.size,
      analysisCapabilities: {
        qualityAssessment: true,
        insightExtraction: true,
        patternRecognition: true,
        effectivenessMeasurement: true,
        applicationAnalysis: true
      }
    };
  }

  /**
   * Clear all data and reset state
   */
  async clear(): Promise<void> {
    this.reflections.clear();
    this.qualityAssessments.clear();
    this.insightExtractions.clear();
    this.effectivenessMetrics.clear();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async performQualityAssessment(reflection: Reflection): Promise<QualityAssessment> {
    // Simulate quality assessment
    const dimensions = [
      { name: 'depth', score: 6 + Math.random() * 3, weight: 0.2, description: 'Depth of reflection' },
      { name: 'clarity', score: 6 + Math.random() * 3, weight: 0.2, description: 'Clarity of expression' },
      { name: 'actionability', score: 6 + Math.random() * 3, weight: 0.2, description: 'Actionable insights' },
      { name: 'relevance', score: 6 + Math.random() * 3, weight: 0.2, description: 'Relevance to goals' },
      { name: 'completeness', score: 6 + Math.random() * 3, weight: 0.2, description: 'Completeness of analysis' }
    ];

    // Calculate overall score
    const score = dimensions.reduce((sum, dim) => sum + dim.score * dim.weight, 0);

    // Identify strengths and weaknesses
    const strengths = dimensions
      .filter(dim => dim.score >= 8)
      .map(dim => `Strong ${dim.name} demonstrated`);

    const weaknesses = dimensions
      .filter(dim => dim.score <= 5)
      .map(dim => `${dim.name} needs improvement`);

    // Generate improvement suggestions
    const suggestions = dimensions
      .filter(dim => dim.score < 8)
      .map(dim => `Enhance ${dim.name} in future reflections`);

    return {
      reflectionId: reflection.id,
      score: Math.round(score * 10) / 10,
      dimensions,
      strengths,
      weaknesses,
      suggestions
    };
  }

  private async performInsightExtraction(reflection: Reflection): Promise<ReflectionInsight[]> {
    // Simulate insight extraction
    const insights: ReflectionInsight[] = [];

    // Generate different types of insights
    const insightTypes: ReflectionInsight['type'][] = ['learning', 'pattern', 'improvement', 'warning'];
    
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const type = insightTypes[Math.floor(Math.random() * insightTypes.length)];
      
      insights.push({
        id: ulid(),
        type,
        content: `${type} insight extracted from reflection`,
        timestamp: new Date(),
        reflectionId: reflection.id,
        confidence: 0.6 + Math.random() * 0.3,
        metadata: {
          source: 'reflection_analyzer',
          applicationStatus: 'pending',
          category: 'general',
          relatedInsights: []
        }
      });
    }

    return insights;
  }

  private async identifyReflectionPatterns(reflections: Reflection[]): Promise<any[]> {
    const patterns: any[] = [];

    // Temporal patterns
    if (reflections.length >= 3) {
      const temporalPattern = this.identifyTemporalPatterns(reflections);
      if (temporalPattern) patterns.push(temporalPattern);
    }

    // Content patterns
    const contentPatterns = this.identifyContentPatterns(reflections);
    patterns.push(...contentPatterns);

    return patterns;
  }

  private identifyTemporalPatterns(reflections: Reflection[]): any | null {
    // Analyze reflection frequency
    const timestamps = reflections.map(r => r.timestamp.getTime()).sort();
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const frequency = Math.round(reflections.length / ((timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60 * 1000)));

    return {
      type: 'temporal',
      frequency,
      examples: [reflections[0].id],
      significance: 0.6,
      description: `Reflections occur approximately every ${Math.round(avgInterval / (24 * 60 * 60 * 1000))} days`
    };
  }

  private identifyContentPatterns(reflections: Reflection[]): any[] {
    // Simulate content pattern analysis
    return [{
      type: 'contextual',
      frequency: reflections.length,
      examples: reflections.slice(0, 2).map(r => r.id),
      significance: 0.5,
      description: 'Common themes in reflection content'
    }];
  }

  private generatePatternInsights(patterns: any[]): string[] {
    const insights: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.type === 'temporal') {
        insights.push('Regular reflection schedule established');
      } else if (pattern.type === 'contextual') {
        insights.push('Consistent reflection themes identified');
      }
    });

    return insights;
  }

  private generatePatternRecommendations(patterns: any[]): string[] {
    const recommendations: string[] = [];
    
    if (patterns.some(p => p.type === 'temporal')) {
      recommendations.push('Maintain regular reflection schedule');
    }
    
    if (patterns.some(p => p.type === 'contextual')) {
      recommendations.push('Explore diverse reflection topics');
    }

    return recommendations;
  }

  private calculatePatternConfidence(reflectionCount: number): number {
    // Confidence increases with more reflections
    return Math.min(1.0, reflectionCount / 10);
  }

  private async calculateEffectivenessMetrics(reflection: Reflection): Promise<EffectivenessMetrics> {
    // Simulate effectiveness calculation
    const insightsGenerated = 2 + Math.floor(Math.random() * 4);
    const actionsCreated = Math.floor(insightsGenerated * 0.7);
    const actionsCompleted = Math.floor(actionsCreated * 0.6);
    
    return {
      reflectionId: reflection.id,
      insightsGenerated,
      actionsCreated,
      actionsCompleted,
      impactScore: 5 + Math.random() * 4,
      timeToImpact: 3 + Math.floor(Math.random() * 10)
    };
  }

  private async performApplicationAnalysis(insightId: string): Promise<ApplicationAnalysis> {
    // Simulate application analysis
    return {
      insightId,
      applicationRate: 0.6 + Math.random() * 0.3,
      successRate: 0.7 + Math.random() * 0.2,
      timeToApplication: 2 + Math.floor(Math.random() * 8),
      barriers: ['Limited time for implementation'],
      facilitators: ['Clear understanding of requirements']
    };
  }

  private createEmptyPatternRecognition(): PatternRecognition {
    return {
      patterns: [],
      confidence: 0,
      insights: [],
      recommendations: []
    };
  }
} 