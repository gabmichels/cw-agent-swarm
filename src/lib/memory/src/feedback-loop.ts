import { MemoryType as StandardMemoryType } from '../../../server/memory/config';
import * as serverQdrant from '../../../server/qdrant';
import { EnhancedMemory } from './enhanced-memory';

/**
 * Feedback Loop System
 * 
 * Tracks successful and failed intent matches
 * Updates intent patterns based on user corrections
 * Learns from past interactions to improve future ones
 */

interface IntentPattern {
  pattern: string;
  successCount: number;
  failureCount: number;
  lastUsed: Date;
  examples: string[];
  confidence: number;
}

interface IntentCorrection {
  originalInput: string;
  incorrectIntent: string;
  correctIntent: string;
  timestamp: Date;
  applied: boolean;
}

export class FeedbackLoopSystem {
  private enhancedMemory: EnhancedMemory;
  private patterns: Map<string, Map<string, IntentPattern>> = new Map();
  private corrections: IntentCorrection[] = [];
  private patternUpdateThreshold: number = 5; // Number of examples needed to adjust patterns
  private learningEnabled: boolean = true;
  private initialized: boolean = false;
  
  constructor(enhancedMemory: EnhancedMemory) {
    this.enhancedMemory = enhancedMemory;
  }
  
  /**
   * Initialize the feedback loop system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing feedback loop system');
      
      // Load existing patterns from memory
      await this.loadPatterns();
      
      // Load corrections history
      await this.loadCorrections();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize feedback loop system:', error);
      return false;
    }
  }
  
  /**
   * Record a successful intent match
   */
  async recordSuccess(intent: string, inputText: string, confidence: number): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.learningEnabled) return;
    
    try {
      // Get patterns for this intent
      if (!this.patterns.has(intent)) {
        this.patterns.set(intent, new Map());
      }
      
      const intentPatterns = this.patterns.get(intent)!;
      
      // Find closest pattern or create new one
      const closestPattern = this.findClosestPattern(intentPatterns, inputText);
      
      if (closestPattern) {
        // Update existing pattern
        const pattern = intentPatterns.get(closestPattern)!;
        pattern.successCount += 1;
        pattern.lastUsed = new Date();
        
        // Add to examples if not too similar to existing ones
        if (!this.hasVerySimilarExample(pattern.examples, inputText)) {
          pattern.examples.push(inputText);
          // Keep only the last 10 examples
          if (pattern.examples.length > 10) {
            pattern.examples.shift();
          }
        }
        
        // Update confidence based on success/failure ratio
        const totalUses = pattern.successCount + pattern.failureCount;
        pattern.confidence = pattern.successCount / totalUses;
        
        // Update the pattern in the map
        intentPatterns.set(closestPattern, pattern);
      } else {
        // Create new pattern
        const newPattern: IntentPattern = {
          pattern: this.generalizePattern(inputText),
          successCount: 1,
          failureCount: 0,
          lastUsed: new Date(),
          examples: [inputText],
          confidence: 1.0
        };
        
        intentPatterns.set(newPattern.pattern, newPattern);
      }
      
      // Save patterns to memory
      await this.savePatterns();
    } catch (error) {
      console.error('Error recording success:', error);
    }
  }
  
  /**
   * Record a failed intent match or user correction
   */
  async recordCorrection(
    originalInput: string, 
    incorrectIntent: string | null, 
    correctIntent: string
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.learningEnabled) return;
    
    try {
      // Store the correction
      const correction: IntentCorrection = {
        originalInput,
        incorrectIntent: incorrectIntent || 'unknown',
        correctIntent,
        timestamp: new Date(),
        applied: false
      };
      
      this.corrections.push(correction);
      
      // If we have incorrect intent, update its patterns
      if (incorrectIntent) {
        // Find if the incorrect intent has a matching pattern
        const incorrectPatterns = this.patterns.get(incorrectIntent);
        
        if (incorrectPatterns) {
          const closestPattern = this.findClosestPattern(incorrectPatterns, originalInput);
          
          if (closestPattern) {
            // Increase failure count for the pattern
            const pattern = incorrectPatterns.get(closestPattern)!;
            pattern.failureCount += 1;
            
            // Update confidence
            const totalUses = pattern.successCount + pattern.failureCount;
            pattern.confidence = pattern.successCount / totalUses;
            
            // Update pattern in map
            incorrectPatterns.set(closestPattern, pattern);
          }
        }
      }
      
      // Update correct intent patterns
      if (!this.patterns.has(correctIntent)) {
        this.patterns.set(correctIntent, new Map());
      }
      
      const correctPatterns = this.patterns.get(correctIntent)!;
      
      // Create a new pattern based on the input
      const newPattern: IntentPattern = {
        pattern: this.generalizePattern(originalInput),
        successCount: 1,
        failureCount: 0,
        lastUsed: new Date(),
        examples: [originalInput],
        confidence: 1.0
      };
      
      correctPatterns.set(newPattern.pattern, newPattern);
      
      // Mark correction as applied
      correction.applied = true;
      
      // Save patterns and corrections
      await this.savePatterns();
      await this.saveCorrections();
      
      // Check if we should apply pattern optimization
      if (this.corrections.length >= this.patternUpdateThreshold) {
        await this.optimizePatterns();
      }
    } catch (error) {
      console.error('Error recording correction:', error);
    }
  }
  
  /**
   * Get pattern suggestions for an intent
   */
  getPatternSuggestions(intent: string, limit: number = 5): string[] {
    const intentPatterns = this.patterns.get(intent);
    if (!intentPatterns) return [];
    
    // Convert to array and sort by confidence
    const patterns = Array.from(intentPatterns.values());
    patterns.sort((a, b) => b.confidence - a.confidence);
    
    // Return the top patterns
    return patterns.slice(0, limit).map(p => p.pattern);
  }
  
  /**
   * Get example inputs for a specific intent
   */
  getExamples(intent: string, limit: number = 5): string[] {
    const intentPatterns = this.patterns.get(intent);
    if (!intentPatterns) return [];
    
    // Collect all examples
    const allExamples: string[] = [];
    
    // Use Array.from to avoid linter errors with Map iteration
    Array.from(intentPatterns.values()).forEach(pattern => {
      allExamples.push(...pattern.examples);
    });
    
    // Return random selection of examples
    return this.getRandomSample(allExamples, limit);
  }
  
  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    console.log(`Feedback loop learning ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if learning is enabled
   */
  isLearningEnabled(): boolean {
    return this.learningEnabled;
  }
  
  /**
   * Get pattern statistics for analysis
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalIntents: this.patterns.size,
      totalPatterns: 0,
      totalExamples: 0,
      totalCorrections: this.corrections.length,
      appliedCorrections: this.corrections.filter(c => c.applied).length,
      intentStats: {}
    };
    
    // Collect stats for each intent
    // Use Array.from to avoid linter errors with Map iteration
    Array.from(this.patterns.entries()).forEach(([intent, patterns]) => {
      const intentStats = {
        patternCount: patterns.size,
        exampleCount: 0,
        successCount: 0,
        failureCount: 0,
        averageConfidence: 0
      };
      
      let totalConfidence = 0;
      
      Array.from(patterns.values()).forEach(pattern => {
        intentStats.exampleCount += pattern.examples.length;
        intentStats.successCount += pattern.successCount;
        intentStats.failureCount += pattern.failureCount;
        totalConfidence += pattern.confidence;
      });
      
      intentStats.averageConfidence = patterns.size > 0 ? 
        totalConfidence / patterns.size : 0;
      
      stats.intentStats[intent] = intentStats;
      stats.totalPatterns += patterns.size;
      stats.totalExamples += intentStats.exampleCount;
    });
    
    return stats;
  }
  
  /**
   * Load patterns from memory
   */
  private async loadPatterns(): Promise<void> {
    try {
      const results = await serverQdrant.searchMemory(
        'document',
        'intent_patterns_database',
        {
          limit: 1,
          filter: {
            type: 'intent_patterns'
          }
        }
      );
      
      if (results && results.length > 0) {
        try {
          const patternData = JSON.parse(results[0].text);
          
          // Convert to our Map structure
          for (const [intent, intentPatterns] of Object.entries(patternData)) {
            const patternsMap = new Map<string, IntentPattern>();
            
            for (const [patternKey, patternValue] of Object.entries(intentPatterns as any)) {
              const pattern = patternValue as any;
              
              // Ensure dates are properly parsed
              pattern.lastUsed = new Date(pattern.lastUsed);
              
              patternsMap.set(patternKey, pattern as IntentPattern);
            }
            
            this.patterns.set(intent, patternsMap);
          }
          
          console.log(`Loaded patterns for ${this.patterns.size} intents`);
        } catch (error) {
          console.error('Error parsing intent patterns:', error);
          this.patterns = new Map();
        }
      } else {
        console.log('No existing intent patterns found');
        this.patterns = new Map();
      }
    } catch (error) {
      console.error('Error loading patterns:', error);
      this.patterns = new Map();
    }
  }
  
  /**
   * Save patterns to memory
   */
  private async savePatterns(): Promise<void> {
    try {
      // Convert Map to object for storage
      const patternsObject: Record<string, Record<string, IntentPattern>> = {};
      
      // Use Array.from to avoid linter errors with Map iteration
      Array.from(this.patterns.entries()).forEach(([intent, intentPatterns]) => {
        patternsObject[intent] = {};
        
        Array.from(intentPatterns.entries()).forEach(([patternKey, pattern]) => {
          patternsObject[intent][patternKey] = pattern;
        });
      });
      
      // Store in memory
      await this.enhancedMemory.addMemory(
        JSON.stringify(patternsObject),
        {
          type: 'intent_patterns',
          importance: 'high',
          category: 'system',
          created: new Date().toISOString()
        },
        StandardMemoryType.DOCUMENT
      );
    } catch (error) {
      console.error('Error saving patterns:', error);
    }
  }
  
  /**
   * Load corrections from memory
   */
  private async loadCorrections(): Promise<void> {
    try {
      const results = await serverQdrant.searchMemory(
        'document',
        'intent_corrections_database',
        {
          limit: 1,
          filter: {
            type: 'intent_corrections'
          }
        }
      );
      
      if (results && results.length > 0) {
        try {
          const correctionsData = JSON.parse(results[0].text);
          
          // Ensure dates are properly parsed
          this.corrections = correctionsData.map((correction: any) => ({
            ...correction,
            timestamp: new Date(correction.timestamp)
          }));
          
          console.log(`Loaded ${this.corrections.length} intent corrections`);
        } catch (error) {
          console.error('Error parsing intent corrections:', error);
          this.corrections = [];
        }
      } else {
        console.log('No existing intent corrections found');
        this.corrections = [];
      }
    } catch (error) {
      console.error('Error loading corrections:', error);
      this.corrections = [];
    }
  }
  
  /**
   * Save corrections to memory
   */
  private async saveCorrections(): Promise<void> {
    try {
      // Store in memory
      await this.enhancedMemory.addMemory(
        JSON.stringify(this.corrections),
        {
          type: 'intent_corrections',
          importance: 'high',
          category: 'system',
          created: new Date().toISOString()
        },
        StandardMemoryType.DOCUMENT
      );
    } catch (error) {
      console.error('Error saving corrections:', error);
    }
  }
  
  /**
   * Find closest matching pattern for an input
   */
  private findClosestPattern(
    patterns: Map<string, IntentPattern>, 
    input: string
  ): string | null {
    // Simple implementation - this could be enhanced with better NLP techniques
    // like semantic similarity or fuzzy matching
    
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    // Use Array.from to avoid linter errors with Map iteration
    Array.from(patterns.entries()).forEach(([patternKey, pattern]) => {
      // Check for direct examples match
      if (pattern.examples.includes(input)) {
        bestMatch = patternKey;
        bestScore = 1;
        return;
      }
      
      // Check for similarity to examples
      for (const example of pattern.examples) {
        const similarity = this.calculateSimilarity(input, example);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = patternKey;
        }
      }
    });
    
    // Only return a match if similarity is above threshold
    return bestScore > 0.7 ? bestMatch : null;
  }
  
  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const norm1 = text1.toLowerCase().trim();
    const norm2 = text2.toLowerCase().trim();
    
    // Calculate word overlap
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));
    
    // Use Array.from to avoid linter errors with Set iteration
    const commonWords = new Set(Array.from(words1).filter(x => words2.has(x)));
    
    // Calculate Jaccard similarity
    return commonWords.size / (words1.size + words2.size - commonWords.size);
  }
  
  /**
   * Check if an example is very similar to existing ones
   */
  private hasVerySimilarExample(examples: string[], input: string): boolean {
    for (const example of examples) {
      if (this.calculateSimilarity(example, input) > 0.9) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Create a generalized pattern from input text
   */
  private generalizePattern(input: string): string {
    // This could be enhanced with more sophisticated NLP techniques
    // For now, we just remove specific details and keep general structure
    
    return input
      .toLowerCase()
      .replace(/\d+/g, '{number}')
      .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi, '{month}')
      .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '{day}');
  }
  
  /**
   * Get a random sample of items from an array
   */
  private getRandomSample<T>(array: T[], count: number): T[] {
    if (array.length <= count) return [...array];
    
    const result: T[] = [];
    const copy = [...array];
    
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * copy.length);
      result.push(copy[index]);
      copy.splice(index, 1);
    }
    
    return result;
  }
  
  /**
   * Optimize patterns based on corrections history
   */
  private async optimizePatterns(): Promise<void> {
    if (this.corrections.length < this.patternUpdateThreshold) return;
    
    try {
      console.log('Optimizing intent patterns based on correction history');
      
      // Group corrections by correct intent
      const correctionsByIntent: Record<string, string[]> = {};
      
      for (const correction of this.corrections) {
        if (!correctionsByIntent[correction.correctIntent]) {
          correctionsByIntent[correction.correctIntent] = [];
        }
        
        correctionsByIntent[correction.correctIntent].push(correction.originalInput);
      }
      
      // For each intent, create new patterns based on corrections
      for (const [intent, inputs] of Object.entries(correctionsByIntent)) {
        if (inputs.length < 3) continue; // Skip if not enough examples
        
        if (!this.patterns.has(intent)) {
          this.patterns.set(intent, new Map());
        }
        
        const intentPatterns = this.patterns.get(intent)!;
        
        // Group similar inputs
        const clusters = this.clusterSimilarInputs(inputs);
        
        // Create a new pattern for each cluster
        for (const cluster of clusters) {
          if (cluster.length < 2) continue; // Skip single-item clusters
          
          // Find common elements
          const generalizedPattern = this.createGeneralizedPattern(cluster);
          
          // Check if we already have a very similar pattern
          let patternExists = false;
          
          // Use Array.from to avoid linter errors with Map iteration
          Array.from(intentPatterns.keys()).forEach(existingPattern => {
            if (this.calculateSimilarity(generalizedPattern, existingPattern) > 0.8) {
              patternExists = true;
            }
          });
          
          if (!patternExists) {
            // Create new pattern
            const newPattern: IntentPattern = {
              pattern: generalizedPattern,
              successCount: cluster.length,
              failureCount: 0,
              lastUsed: new Date(),
              examples: cluster.slice(0, 5), // Keep up to 5 examples
              confidence: 0.9 // Start with high confidence since it's based on corrections
            };
            
            intentPatterns.set(generalizedPattern, newPattern);
          }
        }
      }
      
      // Reset corrections after optimization
      this.corrections = [];
      
      await this.savePatterns();
      await this.saveCorrections();
      
      console.log('Pattern optimization complete');
    } catch (error) {
      console.error('Error optimizing patterns:', error);
    }
  }
  
  /**
   * Cluster similar inputs together
   */
  private clusterSimilarInputs(inputs: string[]): string[][] {
    const clusters: string[][] = [];
    const assigned = new Set<number>();
    
    for (let i = 0; i < inputs.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster: string[] = [inputs[i]];
      assigned.add(i);
      
      for (let j = i + 1; j < inputs.length; j++) {
        if (assigned.has(j)) continue;
        
        if (this.calculateSimilarity(inputs[i], inputs[j]) > 0.7) {
          cluster.push(inputs[j]);
          assigned.add(j);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }
  
  /**
   * Create a generalized pattern from a cluster of similar inputs
   */
  private createGeneralizedPattern(inputs: string[]): string {
    // For simplicity, we just use the first input as a base
    // In a more sophisticated implementation, this would involve
    // finding common words/structures across all inputs
    return this.generalizePattern(inputs[0]);
  }
}

// Export factory function
export const createFeedbackLoopSystem = (
  enhancedMemory: EnhancedMemory
): FeedbackLoopSystem => {
  return new FeedbackLoopSystem(enhancedMemory);
}; 