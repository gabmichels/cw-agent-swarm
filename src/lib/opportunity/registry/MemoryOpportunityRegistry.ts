/**
 * MemoryOpportunityRegistry.ts
 * 
 * Memory-based implementation of the OpportunityRegistry interface.
 * This provides an in-memory storage solution for opportunities.
 */

import { 
  Opportunity, 
  OpportunityCreationOptions,
  OpportunityFilter,
  OpportunityOrderOptions,
  OpportunityStatus,
  createOpportunity
} from '../models/opportunity.model';
import { OpportunityRegistry } from '../interfaces/OpportunityRegistry.interface';
import { OpportunityRegistryError } from '../errors/OpportunityError';

/**
 * Memory-based implementation of OpportunityRegistry
 */
export class MemoryOpportunityRegistry implements OpportunityRegistry {
  private opportunities: Map<string, Opportunity> = new Map();
  private initialized: boolean = false;
  private lastHealthCheck: Date = new Date();

  /**
   * Initialize the registry
   */
  async initialize(): Promise<boolean> {
    this.opportunities = new Map();
    this.initialized = true;
    this.lastHealthCheck = new Date();
    return true;
  }

  /**
   * Ensure the registry is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityRegistryError(
        'Registry not initialized',
        'Call initialize() before performing operations'
      );
    }
  }

  /**
   * Store a new opportunity
   */
  async createOpportunity(opportunityData: OpportunityCreationOptions): Promise<Opportunity> {
    this.ensureInitialized();
    
    const opportunity = createOpportunity(opportunityData);
    this.opportunities.set(opportunity.id, opportunity);
    
    return opportunity;
  }

  /**
   * Get an opportunity by ID
   */
  async getOpportunityById(id: string): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    const opportunity = this.opportunities.get(id);
    return opportunity || null;
  }

  /**
   * Update an existing opportunity
   */
  async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    const existing = this.opportunities.get(id);
    if (!existing) {
      return null;
    }

    const updated: Opportunity = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.opportunities.set(id, updated);
    return updated;
  }

  /**
   * Update the status of an opportunity
   */
  async updateOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    result?: Record<string, unknown>
  ): Promise<Opportunity | null> {
    this.ensureInitialized();
    
    const existing = this.opportunities.get(id);
    if (!existing) {
      return null;
    }

    const updated: Opportunity = {
      ...existing,
      status,
      updatedAt: new Date(),
      result: result ? { 
        ...existing.result,
        ...result,
      } as any : existing.result,
    };

    this.opportunities.set(id, updated);
    return updated;
  }

  /**
   * Delete an opportunity
   */
  async deleteOpportunity(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    if (!this.opportunities.has(id)) {
      return false;
    }
    
    return this.opportunities.delete(id);
  }

  /**
   * Match an opportunity against a filter
   */
  private matchesFilter(opportunity: Opportunity, filter?: OpportunityFilter): boolean {
    if (!filter) {
      return true;
    }

    // Check IDs
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(opportunity.id)) {
      return false;
    }

    // Check types
    if (filter.types && filter.types.length > 0 && !filter.types.includes(opportunity.type)) {
      return false;
    }

    // Check priorities
    if (filter.priorities && filter.priorities.length > 0 && !filter.priorities.includes(opportunity.priority)) {
      return false;
    }

    // Check statuses
    if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(opportunity.status)) {
      return false;
    }

    // Check sources
    if (filter.sources && filter.sources.length > 0 && !filter.sources.includes(opportunity.source)) {
      return false;
    }

    // Check agent IDs
    if (filter.agentIds && filter.agentIds.length > 0 && !filter.agentIds.includes(opportunity.context.agentId)) {
      return false;
    }

    // Check date range
    if (filter.dateRange) {
      if (filter.dateRange.from && opportunity.detectedAt < filter.dateRange.from) {
        return false;
      }
      if (filter.dateRange.to && opportunity.detectedAt > filter.dateRange.to) {
        return false;
      }
    }

    // Check time sensitivities
    if (filter.timeSensitivities && filter.timeSensitivities.length > 0 && 
        !filter.timeSensitivities.includes(opportunity.timeSensitivity)) {
      return false;
    }

    // Check tags (any match)
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag => opportunity.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    // Check search text (in title or description)
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      const titleMatch = opportunity.title.toLowerCase().includes(searchLower);
      const descMatch = opportunity.description.toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch) {
        return false;
      }
    }

    // Check minimum confidence
    if (filter.minConfidence !== undefined && 
        opportunity.trigger.confidence < filter.minConfidence) {
      return false;
    }

    return true;
  }

  /**
   * Sort opportunities based on order options
   */
  private sortOpportunities(
    opportunities: Opportunity[],
    orderBy?: OpportunityOrderOptions
  ): Opportunity[] {
    if (!orderBy) {
      // Default sort by detectedAt descending
      return [...opportunities].sort((a, b) => 
        b.detectedAt.getTime() - a.detectedAt.getTime()
      );
    }

    return [...opportunities].sort((a, b) => {
      let valueA: any, valueB: any;
      
      // Determine sort values based on field
      switch (orderBy.field) {
        case 'priority':
          // Convert priority to numeric value for sorting
          const priorityValues = {
            'low': 0,
            'medium': 1,
            'high': 2,
            'critical': 3
          };
          valueA = priorityValues[a.priority as keyof typeof priorityValues];
          valueB = priorityValues[b.priority as keyof typeof priorityValues];
          break;
        
        case 'detectedAt':
          valueA = a.detectedAt.getTime();
          valueB = b.detectedAt.getTime();
          break;
          
        case 'validUntil':
          // Handle potentially undefined validUntil dates
          valueA = a.validUntil ? a.validUntil.getTime() : Number.MAX_SAFE_INTEGER;
          valueB = b.validUntil ? b.validUntil.getTime() : Number.MAX_SAFE_INTEGER;
          break;
          
        case 'score':
          // Handle potentially undefined scores
          valueA = a.score?.overall ?? 0;
          valueB = b.score?.overall ?? 0;
          break;
          
        case 'updatedAt':
          valueA = a.updatedAt.getTime();
          valueB = b.updatedAt.getTime();
          break;
          
        default:
          valueA = a.detectedAt.getTime();
          valueB = b.detectedAt.getTime();
      }
      
      // Apply sort direction
      const modifier = orderBy.direction === 'asc' ? 1 : -1;
      return (valueA - valueB) * modifier;
    });
  }

  /**
   * Find opportunities matching a filter
   */
  async findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    
    // Convert Map to Array for filtering
    const allOpportunities = Array.from(this.opportunities.values());
    
    // Apply filter
    const filtered = allOpportunities.filter(opp => this.matchesFilter(opp, filter));
    
    // Apply sorting
    const sorted = this.sortOpportunities(filtered, orderBy);
    
    // Apply pagination
    const normalizedOffset = offset ?? 0;
    const paged = limit 
      ? sorted.slice(normalizedOffset, normalizedOffset + limit)
      : sorted.slice(normalizedOffset);
    
    return paged;
  }

  /**
   * Find opportunities for a specific agent
   */
  async findOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]> {
    // Combine the agentId with the rest of the filter
    const combinedFilter: OpportunityFilter = {
      ...filter,
      agentIds: [agentId]
    };
    
    return this.findOpportunities(combinedFilter, orderBy, limit, offset);
  }

  /**
   * Count opportunities matching a filter
   */
  async countOpportunities(filter?: OpportunityFilter): Promise<number> {
    this.ensureInitialized();
    
    const allOpportunities = Array.from(this.opportunities.values());
    const filtered = allOpportunities.filter(opp => this.matchesFilter(opp, filter));
    
    return filtered.length;
  }

  /**
   * Delete expired opportunities
   */
  async clearExpiredOpportunities(before?: Date): Promise<number> {
    this.ensureInitialized();
    
    const cutoffDate = before || new Date();
    let deletedCount = 0;
    
    // Find and delete expired opportunities
    const opportunitiesArray = Array.from(this.opportunities.entries());
    
    for (const [id, opportunity] of opportunitiesArray) {
      if (
        opportunity.validUntil && 
        opportunity.validUntil < cutoffDate &&
        opportunity.status !== OpportunityStatus.COMPLETED &&
        opportunity.status !== OpportunityStatus.DECLINED
      ) {
        // Update to expired status if not already deleted
        if (opportunity.status !== OpportunityStatus.EXPIRED) {
          this.opportunities.set(id, {
            ...opportunity,
            status: OpportunityStatus.EXPIRED,
            updatedAt: new Date()
          });
        }
        
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Check if registry is healthy
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    this.lastHealthCheck = new Date();
    
    return {
      isHealthy: this.initialized,
      lastCheck: this.lastHealthCheck,
      details: {
        opportunityCount: this.opportunities.size,
        memoryUsage: process.memoryUsage().heapUsed
      }
    };
  }
} 