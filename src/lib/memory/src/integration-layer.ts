import { MemoryType as StandardMemoryType } from '../../../server/memory/config';
import * as serverQdrant from '../../../server/qdrant';
import { EnhancedMemory } from './enhanced-memory';
import { FeedbackLoopSystem } from './feedback-loop';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Integration Layer
 * 
 * Connects memory, feedback loop, task management, and user preferences
 * Provides enhanced decision-making with user preference weighting
 * Creates a cohesive experience across multiple agent systems
 */

// User preference model
interface UserPreference {
  id: string;
  category: string;
  name: string;
  value: any;
  importance: number; // 0-1 representing how important this preference is
  lastUpdated: Date;
  source: 'explicit' | 'inferred' | 'default'; // How this preference was determined
}

// Context for decision making
interface DecisionContext {
  intentName: string;
  query: string;
  memories?: any[];
  taskContext?: any;
  userContext?: any;
}

// Decision options interface
interface DecisionOption {
  id: string;
  action: string;
  description: string;
  benefits: string[];
  drawbacks: string[];
  alignmentScore?: number; // How well this aligns with user preferences
}

export class IntegrationLayer {
  private enhancedMemory: EnhancedMemory;
  private feedbackLoop: FeedbackLoopSystem;
  private userPreferences: Map<string, UserPreference> = new Map();
  private decisionLog: any[] = [];
  private initialized: boolean = false;
  private preferencesFilePath: string;
  
  constructor(
    enhancedMemory: EnhancedMemory,
    feedbackLoop: FeedbackLoopSystem
  ) {
    this.enhancedMemory = enhancedMemory;
    this.feedbackLoop = feedbackLoop;
    
    // Set path for persistent storage
    this.preferencesFilePath = path.join(process.cwd(), 'data', 'user_preferences.json');
  }
  
  /**
   * Initialize the integration layer
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing integration layer');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.preferencesFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // First try to load from file system (more reliable)
      await this.loadUserPreferencesFromFile();
      
      // If no preferences loaded from file, try memory store
      if (this.userPreferences.size === 0) {
        await this.loadUserPreferencesFromMemory();
      }
      
      // Initialize with default preferences if none exist
      if (this.userPreferences.size === 0) {
        this.initializeDefaultPreferences();
        // Save the defaults
        await this.saveUserPreferences();
      }
      
      this.initialized = true;
      console.log(`Integration layer initialized with ${this.userPreferences.size} user preferences`);
      return true;
    } catch (error) {
      console.error('Failed to initialize integration layer:', error);
      return false;
    }
  }
  
  /**
   * Get user preference by ID
   */
  getUserPreference(id: string): UserPreference | undefined {
    return this.userPreferences.get(id);
  }
  
  /**
   * Get all user preferences, optionally filtered by category
   */
  getAllUserPreferences(category?: string): UserPreference[] {
    const allPreferences = Array.from(this.userPreferences.values());
    
    if (category) {
      return allPreferences.filter(pref => pref.category === category);
    }
    
    return allPreferences;
  }
  
  /**
   * Update a user preference
   */
  async updateUserPreference(preference: UserPreference): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Update the timestamp
      preference.lastUpdated = new Date();
      
      // Update in memory
      this.userPreferences.set(preference.id, preference);
      
      // Persist to storage
      await this.saveUserPreferences();
      
      console.log(`Updated user preference: ${preference.name}`);
      return true;
    } catch (error) {
      console.error('Error updating user preference:', error);
      return false;
    }
  }
  
  /**
   * Infer preferences from user interactions
   */
  async inferPreferences(interaction: any): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Analyze interaction for preference signals
      if (interaction.query && interaction.topic) {
        const topicPreferenceId = `topic_preference_${interaction.topic}`;
        
        let preference = this.userPreferences.get(topicPreferenceId);
        
        if (preference) {
          // Update existing preference
          preference.value += 0.1;
          if (preference.value > 1) preference.value = 1;
          preference.lastUpdated = new Date();
        } else {
          // Create new preference
          preference = {
            id: topicPreferenceId,
            category: 'topics',
            name: `Interest in ${interaction.topic}`,
            value: 0.5,
            importance: 0.5,
            lastUpdated: new Date(),
            source: 'inferred'
          };
        }
        
        this.userPreferences.set(topicPreferenceId, preference);
      }
      
      // Analyze sentiment and engagement
      if (interaction.sentiment) {
        const sentimentPreferenceId = `sentiment_preference_${interaction.category || 'general'}`;
        let sentiment = interaction.sentiment; // -1 to 1 scale
        
        // Transform to 0-1 scale
        const normalizedSentiment = (sentiment + 1) / 2;
        
        let preference = this.userPreferences.get(sentimentPreferenceId);
        
        if (preference) {
          // Weighted average with new sentiment (30% weight to new value)
          preference.value = (preference.value * 0.7) + (normalizedSentiment * 0.3);
          preference.lastUpdated = new Date();
        } else {
          preference = {
            id: sentimentPreferenceId,
            category: 'sentiment',
            name: `Sentiment for ${interaction.category || 'general'} content`,
            value: normalizedSentiment,
            importance: 0.6,
            lastUpdated: new Date(),
            source: 'inferred'
          };
        }
        
        this.userPreferences.set(sentimentPreferenceId, preference);
      }
      
      // Analyze engagement time
      if (interaction.engagementTime && interaction.engagementTime > 0) {
        const engagementId = `engagement_${interaction.category || 'general'}`;
        const normalizedEngagement = Math.min(interaction.engagementTime / 120, 1); // Cap at 2 minutes
        
        let preference = this.userPreferences.get(engagementId);
        
        if (preference) {
          // Weighted average with new engagement (20% weight to new value)
          preference.value = (preference.value * 0.8) + (normalizedEngagement * 0.2);
          preference.lastUpdated = new Date();
        } else {
          preference = {
            id: engagementId,
            category: 'engagement',
            name: `Engagement with ${interaction.category || 'general'} content`,
            value: normalizedEngagement,
            importance: 0.7,
            lastUpdated: new Date(),
            source: 'inferred'
          };
        }
        
        this.userPreferences.set(engagementId, preference);
      }
      
      // Save updated preferences
      await this.saveUserPreferences();
    } catch (error) {
      console.error('Error inferring preferences:', error);
    }
  }
  
  /**
   * Enhance decision making by weighing options against user preferences
   */
  async enhanceDecision(
    context: DecisionContext,
    options: DecisionOption[]
  ): Promise<DecisionOption[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Get relevant memories to enhance context
      const relevantMemories = await this.enhancedMemory.getRelevantMemories(context.query);
      context.memories = relevantMemories;
      
      // Calculate alignment scores for each option based on user preferences
      for (const option of options) {
        option.alignmentScore = await this.calculateAlignmentScore(option, context);
      }
      
      // Sort by alignment score
      options.sort((a, b) => 
        (b.alignmentScore ?? 0) - (a.alignmentScore ?? 0)
      );
      
      // Track decision in feedback loop system
      if (options.length > 0 && options[0].alignmentScore && options[0].alignmentScore > 0.7) {
        await this.feedbackLoop.recordSuccess(
          context.intentName,
          context.query,
          options[0].alignmentScore
        );
      }
      
      // Log decision for future learning
      this.logDecision(context, options);
      
      return options;
    } catch (error) {
      console.error('Error enhancing decision:', error);
      return options; // Return original options if enhancement fails
    }
  }
  
  /**
   * Connect memory to task context
   */
  async enrichTaskContext(taskContext: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Extract relevant keywords from task
      const keywords = this.extractKeywords(taskContext.description || '');
      
      // Fetch relevant memories
      const relevantMemories = await this.enhancedMemory.getRelevantMemories(
        keywords.join(' OR '),
        5
      );
      
      // Enhance task context with memories
      return {
        ...taskContext,
        relevantMemories,
        userPreferences: this.getRelevantPreferences(keywords)
      };
    } catch (error) {
      console.error('Error enriching task context:', error);
      return taskContext; // Return original context if enrichment fails
    }
  }
  
  /**
   * Get an intent suggestion based on current context and user preferences
   */
  async suggestNextIntent(context: any): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Extract context keywords
      const keywords = this.extractKeywords(
        context.lastQuery || context.taskDescription || ''
      );
      
      // Get relevant memories
      const memories = await this.enhancedMemory.getRelevantMemories(
        keywords.join(' OR '),
        3
      );
      
      // Get relevant user preferences
      const preferences = this.getRelevantPreferences(keywords);
      
      // Get pattern suggestions from feedback loop
      const patternSuggestions = this.feedbackLoop.getPatternSuggestions('intent_suggestion', 3);
      
      // Calculate the most relevant intent based on context, memories, and preferences
      if (memories.length > 0 && preferences.length > 0) {
        // Simple heuristic - get the most important preference
        const topPreference = preferences.sort((a, b) => b.importance - a.importance)[0];
        
        // Suggest an intent based on the top preference category
        switch (topPreference.category) {
          case 'topics':
            return 'market_scan';
          case 'content':
            return 'propose_content_ideas';
          case 'tasks':
            return 'create_task';
          default:
            return null;
        }
      }
      
      // No clear suggestion
      return null;
    } catch (error) {
      console.error('Error suggesting next intent:', error);
      return null;
    }
  }
  
  /**
   * Load user preferences from memory
   */
  private async loadUserPreferencesFromMemory(): Promise<void> {
    try {
      const results = await serverQdrant.searchMemory(
        'document',
        'user_preferences_database',
        {
          limit: 1,
          filter: {
            type: 'user_preferences'
          }
        }
      );
      
      if (results && results.length > 0) {
        try {
          const preferencesData = JSON.parse(results[0].text);
          
          this.userPreferences = new Map();
          
          // Convert to our Map structure
          for (const [id, prefData] of Object.entries(preferencesData)) {
            const preference = prefData as any;
            
            // Ensure dates are properly parsed
            preference.lastUpdated = new Date(preference.lastUpdated);
            
            this.userPreferences.set(id, preference as UserPreference);
          }
          
          console.log(`Loaded ${this.userPreferences.size} user preferences from memory store`);
        } catch (error) {
          console.error('Error parsing user preferences from memory:', error);
          this.userPreferences = new Map();
        }
      } else {
        console.log('No existing user preferences found in memory store');
        this.userPreferences = new Map();
      }
    } catch (error) {
      console.error('Error loading user preferences from memory:', error);
      this.userPreferences = new Map();
    }
  }
  
  /**
   * Load user preferences from filesystem for persistence across restarts
   */
  private async loadUserPreferencesFromFile(): Promise<void> {
    try {
      if (fs.existsSync(this.preferencesFilePath)) {
        const data = fs.readFileSync(this.preferencesFilePath, 'utf8');
        const preferencesData = JSON.parse(data);
        
        this.userPreferences = new Map();
        
        // Convert to our Map structure
        for (const [id, prefData] of Object.entries(preferencesData)) {
          const preference = prefData as any;
          
          // Ensure dates are properly parsed
          preference.lastUpdated = new Date(preference.lastUpdated);
          
          this.userPreferences.set(id, preference as UserPreference);
        }
        
        console.log(`Loaded ${this.userPreferences.size} user preferences from file`);
      } else {
        console.log('No preferences file found, will create one');
        this.userPreferences = new Map();
      }
    } catch (error) {
      console.error('Error loading user preferences from file:', error);
      this.userPreferences = new Map();
    }
  }
  
  /**
   * Save user preferences to memory and file
   */
  private async saveUserPreferences(): Promise<void> {
    try {
      // Convert Map to object for storage
      const preferencesObject: Record<string, UserPreference> = {};
      
      // Use Array.from to avoid iteration issues with Map
      Array.from(this.userPreferences.entries()).forEach(([id, preference]) => {
        preferencesObject[id] = preference;
      });
      
      // Store in memory
      await this.enhancedMemory.addMemory(
        JSON.stringify(preferencesObject),
        {
          type: 'user_preferences',
          importance: 'high',
          category: 'system',
          created: new Date().toISOString()
        },
        StandardMemoryType.DOCUMENT
      );
      
      // Store in file system for persistence
      fs.writeFileSync(
        this.preferencesFilePath,
        JSON.stringify(preferencesObject, null, 2),
        'utf8'
      );
      
      console.log(`Saved ${this.userPreferences.size} user preferences`);
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }
  
  /**
   * Initialize default user preferences
   */
  private initializeDefaultPreferences(): void {
    const defaults: UserPreference[] = [
      {
        id: 'pref_content_detail',
        category: 'content',
        name: 'Content Detail Level',
        value: 0.5, // Middle value (0 = minimal, 1 = detailed)
        importance: 0.7,
        lastUpdated: new Date(),
        source: 'default'
      },
      {
        id: 'pref_proactivity',
        category: 'behavior',
        name: 'Proactive Suggestions',
        value: 0.3, // Slightly less proactive by default
        importance: 0.8,
        lastUpdated: new Date(),
        source: 'default'
      },
      {
        id: 'pref_task_automation',
        category: 'tasks',
        name: 'Task Automation Level',
        value: 0.4, // Moderate automation
        importance: 0.6,
        lastUpdated: new Date(),
        source: 'default'
      },
      {
        id: 'pref_communication_style',
        category: 'communication',
        name: 'Communication Style',
        value: 0.5, // Middle value (0 = concise, 1 = conversational)
        importance: 0.7,
        lastUpdated: new Date(),
        source: 'default'
      },
      {
        id: 'pref_notification_frequency',
        category: 'notifications',
        name: 'Notification Frequency',
        value: 0.4, // Less frequent notifications by default
        importance: 0.8,
        lastUpdated: new Date(),
        source: 'default'
      },
      {
        id: 'pref_data_privacy',
        category: 'privacy',
        name: 'Data Privacy Level',
        value: 0.8, // High privacy by default
        importance: 0.9,
        lastUpdated: new Date(),
        source: 'default'
      }
    ];
    
    for (const pref of defaults) {
      this.userPreferences.set(pref.id, pref);
    }
    
    console.log(`Initialized ${defaults.length} default user preferences`);
  }
  
  /**
   * Calculate how well an option aligns with user preferences
   */
  private async calculateAlignmentScore(
    option: DecisionOption,
    context: DecisionContext
  ): Promise<number> {
    // Get relevant preferences for this decision
    const relevantPreferences = this.getRelevantPreferences(
      this.extractKeywords(option.description)
    );
    
    if (relevantPreferences.length === 0) {
      return 0.5; // Default neutral score
    }
    
    // Calculate weighted average based on preference importance
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const pref of relevantPreferences) {
      const weight = pref.importance;
      totalWeight += weight;
      
      // Simple calculation - actual implementation would be more sophisticated
      weightedSum += weight * pref.value;
    }
    
    let alignmentScore = 0.5; // Default score
    if (totalWeight > 0) {
      alignmentScore = weightedSum / totalWeight;
    }
    
    // Factor in benefits and drawbacks
    // Each benefit adds a small bonus, each drawback a small penalty
    const benefitBonus = 0.05 * option.benefits.length;
    const drawbackPenalty = 0.05 * option.drawbacks.length;
    
    // Adjust score with benefits and drawbacks
    alignmentScore = Math.max(0, Math.min(1, alignmentScore + benefitBonus - drawbackPenalty));
    
    return alignmentScore;
  }
  
  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // This is a simple implementation
    // In a real system, this would use more sophisticated NLP techniques
    
    if (!text) return [];
    
    // Remove punctuation and convert to lowercase
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Split into words
    const words = normalized.split(/\s+/);
    
    // Remove common stopwords
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'in', 'on', 'at', 'to', 'for', 'with',
      'by', 'from', 'of', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or',
      'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'any',
      'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
    ]);
    
    const keywords = words.filter(word => 
      word.length > 2 && !stopwords.has(word)
    );
    
    // Return unique keywords using Array.from to avoid Set iteration issues
    return Array.from(new Set(keywords));
  }
  
  /**
   * Get preferences relevant to a set of keywords
   */
  private getRelevantPreferences(keywords: string[]): UserPreference[] {
    if (keywords.length === 0) {
      return Array.from(this.userPreferences.values());
    }
    
    // Simple keyword matching - actual implementation would be more sophisticated
    return Array.from(this.userPreferences.values()).filter(pref => {
      const prefKeywords = this.extractKeywords(pref.name);
      return keywords.some(k => prefKeywords.includes(k));
    });
  }
  
  /**
   * Log decision for future learning
   */
  private logDecision(context: DecisionContext, options: DecisionOption[]): void {
    const decision = {
      timestamp: new Date(),
      context,
      options,
      selectedOption: options.length > 0 ? options[0].id : null
    };
    
    this.decisionLog.push(decision);
    
    // Keep log to a reasonable size
    if (this.decisionLog.length > 100) {
      this.decisionLog.shift();
    }
  }
}

// Export factory function
export const createIntegrationLayer = (
  enhancedMemory: EnhancedMemory,
  feedbackLoop: FeedbackLoopSystem
): IntegrationLayer => {
  return new IntegrationLayer(enhancedMemory, feedbackLoop);
}; 