/**
 * KnowledgeGapIdentification Interface Tests
 * 
 * Tests to verify the KnowledgeGapIdentification interface contract.
 */

import { 
  KnowledgeGapIdentification,
  KnowledgeGap,
  KnowledgeGapConfidenceLevel,
  KnowledgeGapImportanceLevel,
  KnowledgeGapStatus,
  KnowledgeGapCategory,
  KnowledgeGapSource,
  LearningPriority,
  KnowledgeGapDetectionOptions,
  KnowledgeGapDetectionResult,
  ContentAnalysisOptions
} from '../interfaces/KnowledgeGapIdentification.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of KnowledgeGapIdentification for testing
 */
class MockKnowledgeGapIdentification implements KnowledgeGapIdentification {
  private initialized = false;
  private knowledgeGaps: Map<string, KnowledgeGap> = new Map();
  private learningPriorities: Map<string, LearningPriority> = new Map();

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  async detectGapsInConversation(
    conversation: string | Array<{role: string; content: string}>,
    options?: KnowledgeGapDetectionOptions
  ): Promise<KnowledgeGapDetectionResult> {
    // Mock implementation
    const mockGap: KnowledgeGap = {
      id: uuidv4(),
      topic: 'Test Knowledge Gap',
      description: 'A mock knowledge gap for testing',
      confidence: 0.85,
      confidenceLevel: KnowledgeGapConfidenceLevel.HIGH,
      importance: 7,
      importanceLevel: KnowledgeGapImportanceLevel.HIGH,
      status: KnowledgeGapStatus.NEW,
      category: KnowledgeGapCategory.DOMAIN_KNOWLEDGE,
      source: KnowledgeGapSource.CONVERSATION,
      frequency: 1,
      suggestedActions: ['Research this topic'],
      relatedQueries: ['test query'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.knowledgeGaps.set(mockGap.id, mockGap);

    return {
      gaps: [mockGap],
      overallConfidence: 0.85,
      timestamp: new Date(),
      stats: {
        processingTimeMs: 100,
        detectedCount: 1,
        newCount: 1,
        avgConfidence: 0.85,
        avgImportance: 7
      }
    };
  }

  async detectGapsInContent(
    options: ContentAnalysisOptions
  ): Promise<KnowledgeGapDetectionResult> {
    // Similar to detectGapsInConversation but with content analysis
    return this.detectGapsInConversation(options.content);
  }

  async registerKnowledgeGap(
    gap: Omit<KnowledgeGap, 'id' | 'createdAt' | 'updatedAt' | 'frequency'>
  ): Promise<string> {
    const now = new Date();
    const id = uuidv4();
    
    const newGap: KnowledgeGap = {
      ...gap,
      id,
      frequency: 1,
      createdAt: now,
      updatedAt: now
    };

    this.knowledgeGaps.set(id, newGap);
    return id;
  }

  async getAllKnowledgeGaps(
    filter?: {
      status?: KnowledgeGapStatus[];
      category?: Array<KnowledgeGapCategory | string>;
      minImportance?: number;
      minConfidence?: number;
      source?: KnowledgeGapSource[];
    }
  ): Promise<KnowledgeGap[]> {
    let gaps = Array.from(this.knowledgeGaps.values());
    
    if (filter) {
      if (filter.status) {
        gaps = gaps.filter(gap => filter.status!.includes(gap.status));
      }
      
      if (filter.category) {
        gaps = gaps.filter(gap => filter.category!.includes(gap.category));
      }
      
      if (filter.minImportance !== undefined) {
        gaps = gaps.filter(gap => gap.importance >= filter.minImportance!);
      }
      
      if (filter.minConfidence !== undefined) {
        gaps = gaps.filter(gap => gap.confidence >= filter.minConfidence!);
      }
      
      if (filter.source) {
        gaps = gaps.filter(gap => filter.source!.includes(gap.source));
      }
    }
    
    return gaps;
  }

  async getKnowledgeGapById(id: string): Promise<KnowledgeGap | null> {
    return this.knowledgeGaps.get(id) || null;
  }

  async updateKnowledgeGap(
    id: string,
    updates: Partial<Omit<KnowledgeGap, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    const gap = this.knowledgeGaps.get(id);
    if (!gap) return false;
    
    this.knowledgeGaps.set(id, {
      ...gap,
      ...updates,
      updatedAt: new Date()
    });
    
    return true;
  }

  async updateKnowledgeGapStatus(
    id: string,
    status: KnowledgeGapStatus,
    resolution?: string
  ): Promise<boolean> {
    const gap = this.knowledgeGaps.get(id);
    if (!gap) return false;
    
    this.knowledgeGaps.set(id, {
      ...gap,
      status,
      updatedAt: new Date(),
      metadata: resolution ? { ...gap.metadata, resolution } : gap.metadata
    });
    
    return true;
  }

  async deleteKnowledgeGap(id: string): Promise<boolean> {
    return this.knowledgeGaps.delete(id);
  }

  async generateLearningPriorities(
    options?: {
      knowledgeGapIds?: string[];
      recalculateAll?: boolean;
      maxPriorities?: number;
    }
  ): Promise<LearningPriority[]> {
    const now = new Date();
    const priorities: LearningPriority[] = [];
    
    // Filter gaps if specific IDs are provided
    let gaps = Array.from(this.knowledgeGaps.values());
    if (options?.knowledgeGapIds) {
      gaps = gaps.filter(gap => options.knowledgeGapIds!.includes(gap.id));
    }
    
    // Generate a priority for each gap
    for (const gap of gaps) {
      // Check if we already have a priority for this gap
      const existingPriority = Array.from(this.learningPriorities.values())
        .find(p => p.knowledgeGapId === gap.id);
      
      if (existingPriority && !options?.recalculateAll) {
        priorities.push(existingPriority);
        continue;
      }
      
      // Calculate score based on gap attributes
      const score = Math.min(10, gap.importance * 0.7 + gap.confidence * 3);
      
      const priority: LearningPriority = {
        id: existingPriority?.id || uuidv4(),
        knowledgeGapId: gap.id,
        score,
        reasoning: `Priority based on importance (${gap.importance}) and confidence (${gap.confidence})`,
        suggestedSources: ['Research papers', 'Technical documentation'],
        status: 'pending',
        createdAt: existingPriority?.createdAt || now,
        updatedAt: now
      };
      
      this.learningPriorities.set(priority.id, priority);
      priorities.push(priority);
    }
    
    // Apply max limit if specified
    if (options?.maxPriorities && priorities.length > options.maxPriorities) {
      priorities.sort((a, b) => b.score - a.score);
      return priorities.slice(0, options.maxPriorities);
    }
    
    return priorities;
  }

  async getAllLearningPriorities(
    filter?: {
      status?: Array<'pending' | 'in_progress' | 'completed'>;
      minScore?: number;
      knowledgeGapIds?: string[];
    }
  ): Promise<LearningPriority[]> {
    let priorities = Array.from(this.learningPriorities.values());
    
    if (filter) {
      if (filter.status) {
        priorities = priorities.filter(p => filter.status!.includes(p.status));
      }
      
      if (filter.minScore !== undefined) {
        priorities = priorities.filter(p => p.score >= filter.minScore!);
      }
      
      if (filter.knowledgeGapIds) {
        priorities = priorities.filter(p => filter.knowledgeGapIds!.includes(p.knowledgeGapId));
      }
    }
    
    return priorities;
  }

  async getTopLearningPriorities(limit: number = 5): Promise<LearningPriority[]> {
    return Array.from(this.learningPriorities.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getLearningPrioritiesForGap(knowledgeGapId: string): Promise<LearningPriority[]> {
    return Array.from(this.learningPriorities.values())
      .filter(p => p.knowledgeGapId === knowledgeGapId);
  }

  async updateLearningPriority(
    id: string,
    updates: Partial<Omit<LearningPriority, 'id' | 'knowledgeGapId' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    const priority = this.learningPriorities.get(id);
    if (!priority) return false;
    
    this.learningPriorities.set(id, {
      ...priority,
      ...updates,
      updatedAt: new Date()
    });
    
    return true;
  }

  async updateLearningPriorityStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<boolean> {
    const priority = this.learningPriorities.get(id);
    if (!priority) return false;
    
    const updates: Partial<LearningPriority> = {
      status,
      updatedAt: new Date()
    };
    
    // If completed, add completion date
    if (status === 'completed') {
      updates.completionDate = new Date();
    }
    
    this.learningPriorities.set(id, {
      ...priority,
      ...updates
    });
    
    return true;
  }

  async getKnowledgeGapStats(): Promise<{
    totalGaps: number;
    activeGaps: number;
    addressedGaps: number;
    byCategory: Record<string, number>;
    byStatus: Record<KnowledgeGapStatus, number>;
    byImportance: Record<KnowledgeGapImportanceLevel, number>;
    bySource: Record<KnowledgeGapSource, number>;
    topPriorities: Array<{id: string; topic: string; score: number}>;
  }> {
    const gaps = Array.from(this.knowledgeGaps.values());
    
    // Initialize counters
    const byCategory: Record<string, number> = {};
    const byStatus: Record<KnowledgeGapStatus, number> = {
      [KnowledgeGapStatus.NEW]: 0,
      [KnowledgeGapStatus.INVESTIGATING]: 0,
      [KnowledgeGapStatus.IN_PROGRESS]: 0,
      [KnowledgeGapStatus.ADDRESSED]: 0,
      [KnowledgeGapStatus.DISMISSED]: 0,
      [KnowledgeGapStatus.DEFERRED]: 0
    };
    const byImportance: Record<KnowledgeGapImportanceLevel, number> = {
      [KnowledgeGapImportanceLevel.LOW]: 0,
      [KnowledgeGapImportanceLevel.MEDIUM]: 0,
      [KnowledgeGapImportanceLevel.HIGH]: 0,
      [KnowledgeGapImportanceLevel.CRITICAL]: 0
    };
    const bySource: Record<KnowledgeGapSource, number> = {
      [KnowledgeGapSource.CONVERSATION]: 0,
      [KnowledgeGapSource.TASK_EXECUTION]: 0,
      [KnowledgeGapSource.REFLECTION]: 0,
      [KnowledgeGapSource.EXPLICIT_FEEDBACK]: 0,
      [KnowledgeGapSource.ANALYSIS]: 0,
      [KnowledgeGapSource.MONITORING]: 0
    };
    
    // Count gaps by category, status, importance, and source
    for (const gap of gaps) {
      if (!byCategory[gap.category]) {
        byCategory[gap.category] = 0;
      }
      byCategory[gap.category]++;
      byStatus[gap.status]++;
      byImportance[gap.importanceLevel]++;
      bySource[gap.source]++;
    }
    
    // Get top priorities
    const topPriorities = await this.getTopLearningPriorities(5);
    const topPrioritiesSummary = topPriorities.map(p => {
      const gap = this.knowledgeGaps.get(p.knowledgeGapId);
      return {
        id: p.id,
        topic: gap?.topic || 'Unknown',
        score: p.score
      };
    });
    
    return {
      totalGaps: gaps.length,
      activeGaps: gaps.filter(g => 
        g.status !== KnowledgeGapStatus.ADDRESSED && 
        g.status !== KnowledgeGapStatus.DISMISSED
      ).length,
      addressedGaps: gaps.filter(g => g.status === KnowledgeGapStatus.ADDRESSED).length,
      byCategory,
      byStatus,
      byImportance,
      bySource,
      topPriorities: topPrioritiesSummary
    };
  }

  async runComprehensiveAnalysis(
    options?: {
      sources?: Array<'conversations' | 'documents' | 'tasks' | 'feedback' | 'reflections'>;
      timeframe?: {
        from: Date;
        to: Date;
      };
      maxResults?: number;
    }
  ): Promise<KnowledgeGapDetectionResult> {
    // Mock implementation
    return this.detectGapsInConversation('Mock comprehensive analysis');
  }

  async generateKnowledgeGapReport(format: 'text' | 'markdown' | 'json'): Promise<string> {
    const stats = await this.getKnowledgeGapStats();
    
    if (format === 'json') {
      return JSON.stringify({
        stats,
        gaps: Array.from(this.knowledgeGaps.values()),
        priorities: await this.getTopLearningPriorities(10)
      }, null, 2);
    }
    
    // Generate markdown report
    if (format === 'markdown') {
      return `# Knowledge Gap Report

## Summary
- Total Gaps: ${stats.totalGaps}
- Active Gaps: ${stats.activeGaps}
- Addressed Gaps: ${stats.addressedGaps}

## Top Priorities
${stats.topPriorities.map((p, i) => `${i + 1}. ${p.topic} (Score: ${p.score})`).join('\n')}

## Gaps by Category
${Object.entries(stats.byCategory).map(([category, count]) => `- ${category}: ${count}`).join('\n')}

## Gaps by Status
${Object.entries(stats.byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}
`;
    }
    
    // Text format (default)
    return `Knowledge Gap Report
===================

Summary:
- Total Gaps: ${stats.totalGaps}
- Active Gaps: ${stats.activeGaps}
- Addressed Gaps: ${stats.addressedGaps}

Top Priorities:
${stats.topPriorities.map((p, i) => `${i + 1}. ${p.topic} (Score: ${p.score})`).join('\n')}
`;
  }

  async clear(): Promise<boolean> {
    this.knowledgeGaps.clear();
    this.learningPriorities.clear();
    return true;
  }

  async shutdown(): Promise<boolean> {
    this.initialized = false;
    this.knowledgeGaps.clear();
    this.learningPriorities.clear();
    return true;
  }
}

describe('KnowledgeGapIdentification Interface', () => {
  let gapIdentification: KnowledgeGapIdentification;
  
  beforeEach(async () => {
    gapIdentification = new MockKnowledgeGapIdentification();
    await gapIdentification.initialize();
  });
  
  test('should detect gaps in conversation', async () => {
    const result = await gapIdentification.detectGapsInConversation('Test conversation');
    
    expect(result).toBeDefined();
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].topic).toBeDefined();
    expect(result.overallConfidence).toBeGreaterThan(0);
    expect(result.stats).toBeDefined();
  });
  
  test('should register knowledge gap manually', async () => {
    const gapData = {
      topic: 'Manual Gap',
      description: 'A manually registered gap',
      confidence: 0.9,
      confidenceLevel: KnowledgeGapConfidenceLevel.HIGH,
      importance: 8,
      importanceLevel: KnowledgeGapImportanceLevel.HIGH,
      status: KnowledgeGapStatus.NEW,
      category: KnowledgeGapCategory.TECHNICAL_SKILL,
      source: KnowledgeGapSource.EXPLICIT_FEEDBACK,
      suggestedActions: ['Research this topic'],
      relatedQueries: ['test query']
    };
    
    const id = await gapIdentification.registerKnowledgeGap(gapData);
    
    expect(id).toBeDefined();
    
    const gap = await gapIdentification.getKnowledgeGapById(id);
    
    expect(gap).toBeDefined();
    expect(gap?.topic).toBe('Manual Gap');
    expect(gap?.importance).toBe(8);
  });
  
  test('should update knowledge gap status', async () => {
    const result = await gapIdentification.detectGapsInConversation('Test conversation');
    const gapId = result.gaps[0].id;
    
    const updateSuccess = await gapIdentification.updateKnowledgeGapStatus(
      gapId,
      KnowledgeGapStatus.IN_PROGRESS,
      'Working on this gap'
    );
    
    expect(updateSuccess).toBe(true);
    
    const updatedGap = await gapIdentification.getKnowledgeGapById(gapId);
    
    expect(updatedGap?.status).toBe(KnowledgeGapStatus.IN_PROGRESS);
  });
  
  test('should generate learning priorities', async () => {
    // Register gap first
    const result = await gapIdentification.detectGapsInConversation('Test conversation');
    const gapId = result.gaps[0].id;
    
    const priorities = await gapIdentification.generateLearningPriorities({
      knowledgeGapIds: [gapId]
    });
    
    expect(priorities).toHaveLength(1);
    expect(priorities[0].knowledgeGapId).toBe(gapId);
    expect(priorities[0].score).toBeGreaterThan(0);
  });
  
  test('should get knowledge gap statistics', async () => {
    // Register gap first
    await gapIdentification.detectGapsInConversation('Test conversation');
    
    const stats = await gapIdentification.getKnowledgeGapStats();
    
    expect(stats.totalGaps).toBe(1);
    expect(stats.byCategory).toBeDefined();
    expect(stats.byStatus).toBeDefined();
    expect(stats.byImportance).toBeDefined();
    expect(stats.bySource).toBeDefined();
    expect(stats.topPriorities).toBeDefined();
  });
  
  test('should generate knowledge gap report', async () => {
    // Register gap first
    await gapIdentification.detectGapsInConversation('Test conversation');
    
    const markdownReport = await gapIdentification.generateKnowledgeGapReport('markdown');
    const jsonReport = await gapIdentification.generateKnowledgeGapReport('json');
    const textReport = await gapIdentification.generateKnowledgeGapReport('text');
    
    expect(markdownReport).toContain('# Knowledge Gap Report');
    expect(jsonReport).toContain('"totalGaps":');
    expect(textReport).toContain('Knowledge Gap Report');
  });
}); 