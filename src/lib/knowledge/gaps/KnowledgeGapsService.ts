import { OpenAI } from 'openai';
import { KnowledgeGraphManager } from '../../agents/implementations/memory/KnowledgeGraphManager';
import { SemanticSearchService } from '../SemanticSearchService';
import { logger } from '../../logging';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Represents a knowledge gap identified in conversations
 */
export interface KnowledgeGap {
  id: string;
  topic: string;
  description: string;
  confidence: number; // 0-1 scale
  frequency: number; // How many times this gap was detected
  importance: number; // 1-10 scale
  suggestedActions: string[];
  relatedQueries: string[];
  category: string;
  status: 'new' | 'investigating' | 'addressed' | 'dismissed';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Knowledge learning priority object
 */
export interface LearningPriority {
  id: string;
  knowledgeGapId: string;
  score: number; // Calculated priority score
  reasoning: string;
  suggestedSources: string[];
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

/**
 * Options for analyzing conversations
 */
export interface GapAnalysisOptions {
  threshold?: number; // Confidence threshold
  maxGaps?: number; // Maximum number of gaps to return
  recentOnly?: boolean; // Only analyze recent conversations
  category?: string; // Filter by category
}

/**
 * Service to identify knowledge gaps and create learning priorities
 * Implements Milestone 5.2: Knowledge Gaps Identification
 */
export class KnowledgeGapsService {
  private graphManager: KnowledgeGraphManager;
  private searchService: SemanticSearchService;
  private knowledgeGaps: Map<string, KnowledgeGap> = new Map();
  private learningPriorities: Map<string, LearningPriority> = new Map();
  private dataDir: string;

  constructor(graphManager: KnowledgeGraphManager, searchService: SemanticSearchService, dataDir?: string) {
    this.graphManager = graphManager;
    this.searchService = searchService;
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'knowledge-gaps');
    this.ensureDirectoryExists();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info(`Created knowledge gaps directory: ${this.dataDir}`);
    }
  }

  /**
   * Load knowledge gaps and priorities from disk
   */
  public async load(): Promise<void> {
    try {
      const gapsPath = path.join(this.dataDir, 'knowledge-gaps.json');
      const prioritiesPath = path.join(this.dataDir, 'learning-priorities.json');

      if (fs.existsSync(gapsPath)) {
        const gapsData = fs.readFileSync(gapsPath, 'utf-8');
        const gaps = JSON.parse(gapsData) as KnowledgeGap[];
        this.knowledgeGaps = new Map(gaps.map(gap => [gap.id, gap]));
        logger.info(`Loaded ${this.knowledgeGaps.size} knowledge gaps`);
      }

      if (fs.existsSync(prioritiesPath)) {
        const prioritiesData = fs.readFileSync(prioritiesPath, 'utf-8');
        const priorities = JSON.parse(prioritiesData) as LearningPriority[];
        this.learningPriorities = new Map(priorities.map(priority => [priority.id, priority]));
        logger.info(`Loaded ${this.learningPriorities.size} learning priorities`);
      }
    } catch (error) {
      logger.error(`Error loading knowledge gaps and priorities: ${error}`);
    }
  }

  /**
   * Save knowledge gaps and priorities to disk
   */
  public async save(): Promise<void> {
    try {
      const gapsPath = path.join(this.dataDir, 'knowledge-gaps.json');
      const prioritiesPath = path.join(this.dataDir, 'learning-priorities.json');

      fs.writeFileSync(
        gapsPath,
        JSON.stringify(Array.from(this.knowledgeGaps.values()), null, 2)
      );

      fs.writeFileSync(
        prioritiesPath,
        JSON.stringify(Array.from(this.learningPriorities.values()), null, 2)
      );

      logger.info(`Saved ${this.knowledgeGaps.size} knowledge gaps and ${this.learningPriorities.size} learning priorities`);
    } catch (error) {
      logger.error(`Error saving knowledge gaps and priorities: ${error}`);
    }
  }

  /**
   * Analyze a conversation for knowledge gaps
   * @param conversation Full conversation text
   * @param options Analysis options
   * @returns Identified knowledge gaps
   */
  public async analyzeConversation(
    conversation: string,
    options: GapAnalysisOptions = {}
  ): Promise<KnowledgeGap[]> {
    try {
      logger.info('Analyzing conversation for knowledge gaps');

      const threshold = options.threshold || 0.6;
      const maxGaps = options.maxGaps || 3;

      // Use OpenAI to identify potential knowledge gaps
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a knowledge gap analyzer for a knowledge graph. 
Your task is to identify potential gaps in knowledge based on the conversation.
Look for:
1. Questions the AI couldn't answer well or expressed uncertainty about
2. Topics where the AI provided generic or shallow responses
3. Areas where the user seemed unsatisfied with the AI's knowledge
4. Technical concepts that appear important but weren't explained in depth
5. Emerging or niche topics that may not be in the knowledge base yet

Analyze the conversation and return a JSON array of knowledge gaps, with each gap containing:
- topic: Brief name of the topic (e.g., "Quantum Computing Algorithms")
- description: Detailed description of the knowledge gap
- confidence: Number between 0.1-1.0 indicating how confident you are this is a real gap
- importance: Number between 1-10 indicating how important this topic is to the domain
- suggestedActions: Array of actions to take to fill this gap (e.g., "Research recent papers on X")
- relatedQueries: Array of search queries that could help research this topic
- category: The general category this knowledge gap belongs to`
          },
          {
            role: "user",
            content: conversation
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      if (!response.choices[0]?.message?.content) {
        logger.error('No content in OpenAI response for knowledge gap analysis');
        return [];
      }

      const content = response.choices[0].message.content;
      const parsedResponse = JSON.parse(content);
      
      // Ensure we have a gaps array
      const gaps = parsedResponse.gaps || [];

      // Filter by threshold and limit
      const filteredGaps = gaps
        .filter((gap: any) => gap.confidence >= threshold)
        .slice(0, maxGaps);

      // Check if these gaps are actually covered in our knowledge graph
      const validatedGaps = await this.validateKnowledgeGaps(filteredGaps);

      // Create knowledge gap objects
      const newGaps: KnowledgeGap[] = [];

      for (const gap of validatedGaps) {
        // Check for similar existing gaps
        const similarGap = this.findSimilarGap(gap.topic);

        if (similarGap) {
          // Update existing gap
          similarGap.frequency += 1;
          similarGap.updatedAt = new Date().toISOString();
          if (gap.confidence > similarGap.confidence) {
            similarGap.confidence = gap.confidence;
            similarGap.description = gap.description;
            similarGap.suggestedActions = gap.suggestedActions;
            similarGap.relatedQueries = gap.relatedQueries;
          }
          newGaps.push(similarGap);
        } else {
          // Create new gap
          const newGap: KnowledgeGap = {
            id: uuidv4(),
            topic: gap.topic,
            description: gap.description,
            confidence: gap.confidence,
            frequency: 1,
            importance: gap.importance,
            suggestedActions: gap.suggestedActions,
            relatedQueries: gap.relatedQueries,
            category: gap.category || options.category || 'general',
            status: 'new',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.knowledgeGaps.set(newGap.id, newGap);
          newGaps.push(newGap);
        }
      }

      // Save changes
      await this.save();

      return newGaps;
    } catch (error) {
      logger.error(`Error analyzing conversation for knowledge gaps: ${error}`);
      return [];
    }
  }

  /**
   * Validate potential knowledge gaps against the knowledge graph
   */
  private async validateKnowledgeGaps(potentialGaps: any[]): Promise<any[]> {
    const validatedGaps = [];

    for (const gap of potentialGaps) {
      // Search for related nodes in the knowledge graph
      const searchResults = await this.searchService.searchKnowledge(gap.topic, {
        threshold: 0.7,
        limit: 5
      });

      // If we find highly relevant content, this might not be a real gap
      const hasRelevantContent = searchResults.some(result => result.score > 0.8);

      if (!hasRelevantContent) {
        validatedGaps.push(gap);
      } else {
        logger.info(`Filtered out potential gap "${gap.topic}" as relevant content exists`);
      }
    }

    return validatedGaps;
  }

  /**
   * Find a similar existing knowledge gap by topic
   */
  private findSimilarGap(topic: string): KnowledgeGap | null {
    const gapsArray = Array.from(this.knowledgeGaps.values());
    for (const gap of gapsArray) {
      // Simple text similarity check for now
      // Could replace with embedding similarity in the future
      if (this.calculateTextSimilarity(gap.topic, topic) > 0.8) {
        return gap;
      }
    }
    return null;
  }

  /**
   * Calculate simple text similarity between two strings
   * Returns a number between 0 and 1
   */
  private calculateTextSimilarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const bWords = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    if (aWords.size === 0 || bWords.size === 0) return 0;
    
    // Calculate Jaccard similarity
    const aWordsArray = Array.from(aWords);
    const bWordsArray = Array.from(bWords);
    const intersection = aWordsArray.filter(x => bWords.has(x));
    const union = Array.from(new Set([...aWordsArray, ...bWordsArray]));
    
    return intersection.length / union.length;
  }

  /**
   * Generate or update learning priorities for knowledge gaps
   */
  public async generateLearningPriorities(): Promise<LearningPriority[]> {
    try {
      const newPriorities: LearningPriority[] = [];
      
      // Process each knowledge gap that's not dismissed
      const gapsArray = Array.from(this.knowledgeGaps.values());
      for (const gap of gapsArray) {
        if (gap.status === 'dismissed') continue;
        
        // Check if a priority already exists for this gap
        const existingPriority = Array.from(this.learningPriorities.values())
          .find(p => p.knowledgeGapId === gap.id && p.status !== 'completed');
        
        if (existingPriority) {
          // Update existing priority
          const updatedScore = this.calculatePriorityScore(gap);
          existingPriority.score = updatedScore;
          existingPriority.updatedAt = new Date().toISOString();
          
          // If the status changed
          if (gap.status === 'addressed' && existingPriority.status === 'in_progress') {
            existingPriority.status = 'completed';
          }
          
          continue;
        }
        
        // Generate learning sources
        const suggestedSources = await this.suggestLearningSources(gap);
        
        // Create new priority
        const priority: LearningPriority = {
          id: uuidv4(),
          knowledgeGapId: gap.id,
          score: this.calculatePriorityScore(gap),
          reasoning: `Priority based on frequency (${gap.frequency}), importance (${gap.importance}), and confidence (${gap.confidence.toFixed(2)})`,
          suggestedSources,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        this.learningPriorities.set(priority.id, priority);
        newPriorities.push(priority);
      }
      
      // Save updates
      await this.save();
      
      // Return new priorities
      return newPriorities;
    } catch (error) {
      logger.error(`Error generating learning priorities: ${error}`);
      return [];
    }
  }

  /**
   * Calculate priority score for a knowledge gap
   * Score range: 0-10
   */
  private calculatePriorityScore(gap: KnowledgeGap): number {
    // Base score from importance
    let score = gap.importance;
    
    // Adjust by frequency 
    // Each occurrence adds up to 2 points, with diminishing returns
    const frequencyBoost = Math.min(2, gap.frequency * 0.5);
    score += frequencyBoost;
    
    // Adjust by confidence
    // Highly confident gaps get a boost of up to 1 point
    const confidenceBoost = gap.confidence;
    score += confidenceBoost;
    
    // Cap at 10
    return Math.min(10, score);
  }

  /**
   * Suggest learning sources for a knowledge gap
   */
  private async suggestLearningSources(gap: KnowledgeGap): Promise<string[]> {
    try {
      // Use OpenAI to suggest learning sources
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system",
            content: `You are a research assistant helping to identify the best learning resources for a knowledge gap.
For the given knowledge gap, suggest 3-5 specific, high-quality resources that would help fill this gap.
Include a mix of:
- Books or textbooks (with authors if possible)
- Academic papers or journals (with titles and authors)
- Online courses (with platform and course name)
- Expert blogs or websites (with specific URLs if possible)
- Communities or forums for domain experts

Be specific and actionable in your suggestions. Do not include generic advice like "search Google".`
          },
          {
            role: "user",
            content: `Knowledge Gap:
Topic: ${gap.topic}
Description: ${gap.description}
Category: ${gap.category}

Please suggest 3-5 specific learning resources to fill this knowledge gap.`
          }
        ],
        temperature: 0.4
      });

      if (!response.choices[0]?.message?.content) {
        logger.error('No content in OpenAI response for learning sources');
        return [
          "No specific sources could be generated. Try researching recent publications on this topic.",
          `Search for "${gap.topic}" in academic databases.`
        ];
      }

      // Parse response and extract sources
      const content = response.choices[0].message.content;
      const sources = content
        .split(/\n+/)
        .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
        .map(line => line.replace(/^[- \d.]+/, '').trim());

      return sources.length > 0 ? sources : [
        "Research recent publications on this topic",
        `Search for "${gap.topic}" in academic databases`
      ];
    } catch (error) {
      logger.error(`Error suggesting learning sources: ${error}`);
      return [
        "Error generating specific sources. Try general research on this topic.",
        `Search for "${gap.topic}" in academic databases.`
      ];
    }
  }

  /**
   * Get all knowledge gaps
   */
  public getAllKnowledgeGaps(): KnowledgeGap[] {
    return Array.from(this.knowledgeGaps.values());
  }

  /**
   * Get all learning priorities
   */
  public getAllLearningPriorities(): LearningPriority[] {
    return Array.from(this.learningPriorities.values());
  }

  /**
   * Get a knowledge gap by ID
   */
  public getKnowledgeGapById(id: string): KnowledgeGap | undefined {
    return this.knowledgeGaps.get(id);
  }

  /**
   * Get a learning priority by ID
   */
  public getLearningPriorityById(id: string): LearningPriority | undefined {
    return this.learningPriorities.get(id);
  }

  /**
   * Get learning priorities for a knowledge gap
   */
  public getLearningPrioritiesForGap(gapId: string): LearningPriority[] {
    return Array.from(this.learningPriorities.values())
      .filter(priority => priority.knowledgeGapId === gapId);
  }

  /**
   * Update a knowledge gap
   */
  public async updateKnowledgeGapStatus(
    id: string, 
    status: 'new' | 'investigating' | 'addressed' | 'dismissed'
  ): Promise<KnowledgeGap | null> {
    const gap = this.knowledgeGaps.get(id);
    
    if (!gap) {
      logger.error(`Knowledge gap with ID ${id} not found`);
      return null;
    }
    
    gap.status = status;
    gap.updatedAt = new Date().toISOString();
    
    // If gap is addressed or dismissed, update related priorities
    if (status === 'addressed' || status === 'dismissed') {
      const priorities = this.getLearningPrioritiesForGap(id);
      
      for (const priority of priorities) {
        if (priority.status !== 'completed') {
          priority.status = status === 'addressed' ? 'completed' : 'pending';
          priority.updatedAt = new Date().toISOString();
        }
      }
    }
    
    await this.save();
    return gap;
  }

  /**
   * Update a learning priority
   */
  public async updateLearningPriorityStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<LearningPriority | null> {
    const priority = this.learningPriorities.get(id);
    
    if (!priority) {
      logger.error(`Learning priority with ID ${id} not found`);
      return null;
    }
    
    priority.status = status;
    priority.updatedAt = new Date().toISOString();
    
    // If completing a priority, check if we should update the gap status
    if (status === 'completed') {
      const gap = this.knowledgeGaps.get(priority.knowledgeGapId);
      
      if (gap && gap.status !== 'addressed') {
        gap.status = 'addressed';
        gap.updatedAt = new Date().toISOString();
      }
    }
    
    await this.save();
    return priority;
  }

  /**
   * Get top learning priorities
   */
  public getTopLearningPriorities(limit: number = 5): LearningPriority[] {
    return Array.from(this.learningPriorities.values())
      .filter(p => p.status !== 'completed')
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get knowledge gaps by category
   */
  public getKnowledgeGapsByCategory(category: string): KnowledgeGap[] {
    return Array.from(this.knowledgeGaps.values())
      .filter(gap => gap.category.toLowerCase() === category.toLowerCase());
  }

  /**
   * Get knowledge gaps statistics
   */
  public getKnowledgeGapsStats(): {
    totalGaps: number;
    activeGaps: number;
    addressedGaps: number;
    byCategory: Record<string, number>;
    topPriorities: Array<{id: string, topic: string, score: number}>;
  } {
    const gaps = Array.from(this.knowledgeGaps.values());
    const categories = new Map<string, number>();
    
    // Count by category
    gaps.forEach(gap => {
      const category = gap.category || 'uncategorized';
      categories.set(category, (categories.get(category) || 0) + 1);
    });
    
    // Get top priorities
    const priorities = this.getTopLearningPriorities(5);
    const topPriorities = priorities.map(p => {
      const gap = this.knowledgeGaps.get(p.knowledgeGapId);
      return {
        id: p.id,
        topic: gap?.topic || 'Unknown',
        score: p.score
      };
    });
    
    return {
      totalGaps: gaps.length,
      activeGaps: gaps.filter(g => g.status !== 'addressed' && g.status !== 'dismissed').length,
      addressedGaps: gaps.filter(g => g.status === 'addressed').length,
      byCategory: Object.fromEntries(categories.entries()),
      topPriorities
    };
  }
} 