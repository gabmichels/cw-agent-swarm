/**
 * Opportunity Detection Engine for Chloe
 * 
 * A background process that continuously monitors data sources to identify potential tasks
 * without human triggering. Detects opportunities from calendar, news feeds, memory changes,
 * and market data.
 */

import { ChloeAgent } from '../core/agent';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { ChloeMemory } from '../memory';
import { StrategicToolPlanner } from '../strategy/strategicPlanner';

// Types for the opportunity detection system
export enum OpportunitySource {
  CALENDAR = 'calendar',
  MARKET_DATA = 'market_data',
  NEWS = 'news',
  MEMORY_PATTERN = 'memory_pattern',
  RECURRING_CYCLE = 'recurring_cycle'
}

export enum TimeSensitivity {
  IMMEDIATE = 'immediate',     // Needs action within hours
  URGENT = 'urgent',           // Needs action within a day
  IMPORTANT = 'important',     // Needs action within days
  STANDARD = 'standard',       // Needs action within a week
  LONG_TERM = 'long_term'      // Can be handled within weeks/months
}

export interface OpportunityMetadata {
  source: OpportunitySource;
  confidence: number;          // 0-1 score representing confidence
  timeSensitivity: TimeSensitivity;
  strategicScore?: number;     // 0-100 score from strategic planner
  resourceNeeded?: {
    estimatedMinutes: number;  // Estimated time required
    priorityLevel: string;     // Priority level (high, medium, low)
  };
  relatedMemories?: string[];  // IDs of related memories
  patterns?: {
    type: string;
    description: string;
  }[];
}

export interface DetectedOpportunity {
  id: string;
  title: string;
  description: string;
  created: Date;
  metadata: OpportunityMetadata;
  actionTaken: boolean;
  tags: string[];
}

// Interfaces for event listeners
interface EventListener {
  source: OpportunitySource;
  enabled: boolean;
  lastChecked?: Date;
  checkInterval: number; // In milliseconds
  detect(): Promise<DetectedOpportunity[]>;
}

/**
 * Main class for detecting opportunities from various data sources
 */
export class OpportunityDetector {
  private agent: ChloeAgent;
  private memory: ChloeMemory | null = null;
  private strategicPlanner: StrategicToolPlanner | null = null;
  private opportunities: Map<string, DetectedOpportunity> = new Map();
  private listeners: EventListener[] = [];
  private isActive: boolean = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 5 * 60 * 1000; // Default 5 minutes

  constructor(agent: ChloeAgent) {
    this.agent = agent;
    this.memory = agent.getMemory ? agent.getMemory() : null;
    
    // Setup event listeners
    this.initializeEventListeners();
    
    console.log('OpportunityDetector initialized');
  }

  /**
   * Initialize all event listeners for various data sources
   */
  private initializeEventListeners(): void {
    // Calendar event listener
    this.listeners.push({
      source: OpportunitySource.CALENDAR,
      enabled: true,
      checkInterval: 15 * 60 * 1000, // Check every 15 minutes
      detect: this.detectCalendarOpportunities.bind(this)
    });

    // Market data listener
    this.listeners.push({
      source: OpportunitySource.MARKET_DATA,
      enabled: true,
      checkInterval: 30 * 60 * 1000, // Check every 30 minutes
      detect: this.detectMarketOpportunities.bind(this)
    });

    // News feed listener
    this.listeners.push({
      source: OpportunitySource.NEWS,
      enabled: true,
      checkInterval: 60 * 60 * 1000, // Check every hour
      detect: this.detectNewsOpportunities.bind(this)
    });

    // Memory pattern listener
    this.listeners.push({
      source: OpportunitySource.MEMORY_PATTERN,
      enabled: true,
      checkInterval: 6 * 60 * 60 * 1000, // Check every 6 hours
      detect: this.detectMemoryPatterns.bind(this)
    });

    // Recurring cycle listener
    this.listeners.push({
      source: OpportunitySource.RECURRING_CYCLE,
      enabled: true,
      checkInterval: 24 * 60 * 60 * 1000, // Check every 24 hours
      detect: this.detectRecurringCycles.bind(this)
    });
  }

  /**
   * Start the background detection process
   */
  public start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Start the detection interval
    this.detectionInterval = setInterval(() => {
      this.checkOpportunities();
    }, this.checkIntervalMs);
    
    console.log('OpportunityDetector started');
  }

  /**
   * Stop the background detection process
   */
  public stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear the detection interval
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    console.log('OpportunityDetector stopped');
  }

  /**
   * Main method to check for opportunities from all sources
   */
  public async checkOpportunities(): Promise<DetectedOpportunity[]> {
    if (!this.isActive) return [];
    
    const newOpportunities: DetectedOpportunity[] = [];
    const now = new Date();
    
    // Check each listener if it's time for it to run
    for (const listener of this.listeners) {
      if (!listener.enabled) continue;
      
      // Skip if it's not time to check yet
      if (listener.lastChecked && 
          (now.getTime() - listener.lastChecked.getTime() < listener.checkInterval)) {
        continue;
      }
      
      // Update last checked timestamp
      listener.lastChecked = now;
      
      // Detect opportunities from this source
      try {
        const detected = await listener.detect();
        
        if (detected.length > 0) {
          console.log(`Detected ${detected.length} opportunities from ${listener.source}`);
          
          // Process each detected opportunity
          for (const opportunity of detected) {
            if (!this.opportunities.has(opportunity.id)) {
              // Score the opportunity using strategic planner if available
              if (this.strategicPlanner) {
                try {
                  const assessment = await this.strategicPlanner.assessTaskPriority({
                    goal: opportunity.title,
                    description: opportunity.description
                  });
                  
                  opportunity.metadata.strategicScore = assessment.priorityScore;
                  opportunity.tags.push(...assessment.priorityTags);
                } catch (error) {
                  console.error('Error scoring opportunity with strategic planner:', error);
                }
              }
              
              // Add to our opportunities map
              this.opportunities.set(opportunity.id, opportunity);
              newOpportunities.push(opportunity);
              
              // Record in memory
              await this.recordOpportunityInMemory(opportunity);
            }
          }
        }
      } catch (error) {
        console.error(`Error detecting opportunities from ${listener.source}:`, error);
      }
    }
    
    return newOpportunities;
  }

  /**
   * Record a detected opportunity in Chloe's memory
   */
  private async recordOpportunityInMemory(opportunity: DetectedOpportunity): Promise<void> {
    if (!this.memory) return;
    
    const memoryContent = `
Detected Opportunity:
Title: ${opportunity.title}
Description: ${opportunity.description}
Source: ${opportunity.metadata.source}
Confidence: ${opportunity.metadata.confidence}
Time Sensitivity: ${opportunity.metadata.timeSensitivity}
${opportunity.metadata.strategicScore ? `Strategic Score: ${opportunity.metadata.strategicScore}` : ''}
`;

    await this.memory.addMemory(
      memoryContent,
      'detected_opportunity',
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Auto-detected opportunity: ${opportunity.title}`,
      ['opportunity', 'self-initiated', ...opportunity.tags]
    );
  }

  /**
   * Get all detected opportunities
   */
  public getOpportunities(
    filter?: {
      source?: OpportunitySource;
      minConfidence?: number;
      timeSensitivity?: TimeSensitivity;
      tags?: string[];
      actionTaken?: boolean;
    }
  ): DetectedOpportunity[] {
    let opportunities = Array.from(this.opportunities.values());
    
    // Apply filters if provided
    if (filter) {
      if (filter.source) {
        opportunities = opportunities.filter(o => o.metadata.source === filter.source);
      }
      
      if (filter.minConfidence !== undefined) {
        const minConfidence = filter.minConfidence; // Create a const to avoid undefined warning
        opportunities = opportunities.filter(o => o.metadata.confidence >= minConfidence);
      }
      
      if (filter.timeSensitivity) {
        opportunities = opportunities.filter(o => o.metadata.timeSensitivity === filter.timeSensitivity);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        opportunities = opportunities.filter(o => 
          filter.tags!.some(tag => o.tags.includes(tag))
        );
      }
      
      if (filter.actionTaken !== undefined) {
        opportunities = opportunities.filter(o => o.actionTaken === filter.actionTaken);
      }
    }
    
    return opportunities;
  }

  /**
   * Mark an opportunity as actioned
   */
  public markOpportunityActioned(id: string, actioned: boolean = true): boolean {
    const opportunity = this.opportunities.get(id);
    
    if (!opportunity) return false;
    
    opportunity.actionTaken = actioned;
    this.opportunities.set(id, opportunity);
    
    return true;
  }

  /**
   * Detect opportunities from calendar events
   */
  private async detectCalendarOpportunities(): Promise<DetectedOpportunity[]> {
    const opportunities: DetectedOpportunity[] = [];
    
    try {
      // Skip if memory is not available
      if (!this.memory) return opportunities;
      
      // Get upcoming events from memory system
      const calendarMemories = await this.memory.getRelevantMemories("calendar", 10);
      
      // Process calendar data
      for (const memory of calendarMemories) {
        const content = memory.content;
        
        // Detect if this is a meeting preparation opportunity
        if (content.includes('meeting') || content.includes('call') || content.includes('conference')) {
          // Check if it's upcoming (within 48 hours)
          const isSoon = content.includes('tomorrow') || content.includes('upcoming') || 
                        content.includes('soon') || content.includes('next day');
          
          if (isSoon) {
            const opportunity: DetectedOpportunity = {
              id: `cal-prep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              title: `Prepare for upcoming meeting: ${content.split('\n')[0].substring(0, 50)}...`,
              description: `Detected upcoming meeting that requires preparation: ${content}`,
              created: new Date(),
              metadata: {
                source: OpportunitySource.CALENDAR,
                confidence: 0.85,
                timeSensitivity: TimeSensitivity.URGENT,
                resourceNeeded: {
                  estimatedMinutes: 30,
                  priorityLevel: 'high'
                }
              },
              actionTaken: false,
              tags: ['meeting', 'preparation', 'calendar']
            };
            
            opportunities.push(opportunity);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting calendar opportunities:', error);
    }
    
    return opportunities;
  }

  /**
   * Detect opportunities from market data
   */
  private async detectMarketOpportunities(): Promise<DetectedOpportunity[]> {
    const opportunities: DetectedOpportunity[] = [];
    
    try {
      // Skip if memory is not available
      if (!this.memory) return opportunities;
      
      // Get recent market data from memory system
      const marketMemories = await this.memory.getRelevantMemories("market_data", 10);
      
      // Process market data for unusual patterns
      for (const memory of marketMemories) {
        const content = memory.content.toLowerCase();
        
        // Detect market anomalies
        if (
          content.includes('significant increase') || 
          content.includes('dramatic drop') || 
          content.includes('unusual activity') ||
          content.includes('unexpected change') ||
          content.includes('emerging trend')
        ) {
          const opportunity: DetectedOpportunity = {
            id: `market-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: `Analyze market anomaly: ${content.split('\n')[0].substring(0, 50)}...`,
            description: `Detected unusual market activity that may represent an opportunity: ${content}`,
            created: new Date(),
            metadata: {
              source: OpportunitySource.MARKET_DATA,
              confidence: 0.75,
              timeSensitivity: TimeSensitivity.IMPORTANT,
              resourceNeeded: {
                estimatedMinutes: 60,
                priorityLevel: 'high'
              },
              patterns: [{
                type: 'market_anomaly',
                description: 'Unusual market movement detected'
              }]
            },
            actionTaken: false,
            tags: ['market', 'analysis', 'trend', 'anomaly']
          };
          
          opportunities.push(opportunity);
        }
      }
    } catch (error) {
      console.error('Error detecting market opportunities:', error);
    }
    
    return opportunities;
  }

  /**
   * Detect opportunities from news feeds
   */
  private async detectNewsOpportunities(): Promise<DetectedOpportunity[]> {
    const opportunities: DetectedOpportunity[] = [];
    
    try {
      // Skip if memory is not available
      if (!this.memory) return opportunities;
      
      // Get recent news from memory system
      const newsMemories = await this.memory.getRelevantMemories("news", 10);
      
      // Track competitors or industry terms mentioned in news
      const competitorTerms = ['competitor', 'industry leader', 'market share', 'launched', 'released'];
      
      // Process news items
      for (const memory of newsMemories) {
        const content = memory.content.toLowerCase();
        
        // Check for competitor activity
        const hasCompetitorMention = competitorTerms.some(term => content.includes(term));
        
        if (hasCompetitorMention) {
          const opportunity: DetectedOpportunity = {
            id: `news-comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: `Analyze competitor activity in news`,
            description: `Detected news about potential competitor activity: ${content}`,
            created: new Date(),
            metadata: {
              source: OpportunitySource.NEWS,
              confidence: 0.7,
              timeSensitivity: TimeSensitivity.IMPORTANT,
              resourceNeeded: {
                estimatedMinutes: 45,
                priorityLevel: 'medium'
              }
            },
            actionTaken: false,
            tags: ['news', 'competitor', 'analysis']
          };
          
          opportunities.push(opportunity);
        }
      }
    } catch (error) {
      console.error('Error detecting news opportunities:', error);
    }
    
    return opportunities;
  }

  /**
   * Detect patterns in memory that could represent opportunities
   */
  private async detectMemoryPatterns(): Promise<DetectedOpportunity[]> {
    const opportunities: DetectedOpportunity[] = [];
    
    try {
      // Skip if memory is not available
      if (!this.memory) return opportunities;
      
      // Get high importance memories from the past week
      const recentHighImportanceMemories = await this.memory.getHighImportanceMemories(20);
      
      // Find recurring topics or themes
      const topics = new Map<string, number>();
      
      // Extract and count topics from memory tags
      for (const memory of recentHighImportanceMemories) {
        if (memory.tags && memory.tags.length > 0) {
          for (const tag of memory.tags) {
            const current = topics.get(tag) || 0;
            topics.set(tag, current + 1);
          }
        }
      }
      
      // Find topics that appear frequently (3+ times)
      const frequentTopics = Array.from(topics.entries())
        .filter(([_, count]) => count >= 3)
        .map(([topic, _]) => topic);
      
      // Create opportunities for frequent topics
      if (frequentTopics.length > 0) {
        const topicList = frequentTopics.join(', ');
        
        const opportunity: DetectedOpportunity = {
          id: `pattern-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: `Analyze recurring topics in recent data`,
          description: `Detected recurring topics that may represent strategic opportunities: ${topicList}`,
          created: new Date(),
          metadata: {
            source: OpportunitySource.MEMORY_PATTERN,
            confidence: 0.8,
            timeSensitivity: TimeSensitivity.STANDARD,
            resourceNeeded: {
              estimatedMinutes: 90,
              priorityLevel: 'medium'
            },
            patterns: [{
              type: 'recurring_topics',
              description: `Topics appearing frequently: ${topicList}`
            }]
          },
          actionTaken: false,
          tags: ['pattern', 'analysis', 'strategic', ...frequentTopics]
        };
        
        opportunities.push(opportunity);
      }
    } catch (error) {
      console.error('Error detecting memory patterns:', error);
    }
    
    return opportunities;
  }

  /**
   * Detect recurring cycles (weekly/monthly patterns)
   */
  private async detectRecurringCycles(): Promise<DetectedOpportunity[]> {
    const opportunities: DetectedOpportunity[] = [];
    
    try {
      // Check what day of week and month it is
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
      const dayOfMonth = now.getDate(); // 1-31
      const isMonthEnd = dayOfMonth >= 28; // Approximate month end detection
      
      // Weekly report opportunity (Every Friday)
      if (dayOfWeek === 5) { // Friday
        const opportunity: DetectedOpportunity = {
          id: `cycle-weekly-${Date.now()}`,
          title: `Prepare weekly strategic summary`,
          description: `It's Friday - time to prepare the weekly strategic summary and progress report.`,
          created: new Date(),
          metadata: {
            source: OpportunitySource.RECURRING_CYCLE,
            confidence: 0.95,
            timeSensitivity: TimeSensitivity.STANDARD,
            resourceNeeded: {
              estimatedMinutes: 60,
              priorityLevel: 'medium'
            }
          },
          actionTaken: false,
          tags: ['weekly', 'report', 'recurring', 'strategic']
        };
        
        opportunities.push(opportunity);
      }
      
      // Month-end report opportunity
      if (isMonthEnd) {
        const opportunity: DetectedOpportunity = {
          id: `cycle-monthly-${Date.now()}`,
          title: `Prepare monthly performance analysis`,
          description: `It's near the end of the month - time to prepare the monthly performance analysis.`,
          created: new Date(),
          metadata: {
            source: OpportunitySource.RECURRING_CYCLE,
            confidence: 0.9,
            timeSensitivity: TimeSensitivity.IMPORTANT,
            resourceNeeded: {
              estimatedMinutes: 120,
              priorityLevel: 'high'
            }
          },
          actionTaken: false,
          tags: ['monthly', 'report', 'recurring', 'performance']
        };
        
        opportunities.push(opportunity);
      }
    } catch (error) {
      console.error('Error detecting recurring cycles:', error);
    }
    
    return opportunities;
  }

  /**
   * Set the strategic planner for opportunity scoring
   */
  public setStrategicPlanner(planner: StrategicToolPlanner): void {
    this.strategicPlanner = planner;
  }
} 