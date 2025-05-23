/**
 * PersistentOpportunityRegistry.ts
 * 
 * File-based implementation of the OpportunityRegistry interface.
 * This provides a persistent storage solution for opportunities using a JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

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

// Promisify filesystem operations
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

/**
 * Configuration for persistent registry
 */
export interface PersistentRegistryConfig {
  /** Directory to store opportunities */
  storageDir: string;
  
  /** Filename for opportunities storage */
  filename?: string;
  
  /** Automatic persistence options */
  persistence?: {
    /** Save after every mutation (default: true) */
    saveOnMutation?: boolean;
    
    /** Save on a regular interval regardless of mutations */
    saveIntervalMs?: number;
  };
  
  /** Cache options */
  cache?: {
    /** Enable in-memory caching (default: true) */
    enabled?: boolean;
    
    /** Maximum number of opportunities to keep in memory */
    maxItems?: number;
  };
}

/**
 * File-based implementation of OpportunityRegistry
 */
export class PersistentOpportunityRegistry implements OpportunityRegistry {
  private opportunities: Map<string, Opportunity> = new Map();
  private initialized: boolean = false;
  private lastHealthCheck: Date = new Date();
  private lastSaveTime: Date = new Date();
  private dirty: boolean = false;
  private saveInterval: NodeJS.Timeout | null = null;
  private config: Required<PersistentRegistryConfig>;
  private storageFilePath: string;

  // Default configuration
  private defaultConfig: Required<PersistentRegistryConfig> = {
    storageDir: path.join(process.cwd(), 'data', 'opportunities'),
    filename: 'opportunities.json',
    persistence: {
      saveOnMutation: true,
      saveIntervalMs: 60 * 1000 // 1 minute
    },
    cache: {
      enabled: true,
      maxItems: 1000
    }
  };

  /**
   * Create a new persistent opportunity registry
   * @param config Configuration for the registry
   */
  constructor(config?: Partial<PersistentRegistryConfig>) {
    this.config = {
      ...this.defaultConfig,
      ...config,
      persistence: {
        ...this.defaultConfig.persistence,
        ...config?.persistence
      },
      cache: {
        ...this.defaultConfig.cache,
        ...config?.cache
      }
    };

    this.storageFilePath = path.join(
      this.config.storageDir,
      this.config.filename
    );
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<boolean> {
    try {
      // Create storage directory if it doesn't exist
      await this.ensureStorageDirectory();
      
      // Load existing opportunities from storage
      await this.loadFromStorage();
      
      // Set up automatic saving interval if configured
      if (this.config.persistence?.saveIntervalMs && this.config.persistence.saveIntervalMs > 0) {
        this.saveInterval = setInterval(
          () => this.saveToStorageIfDirty(),
          this.config.persistence.saveIntervalMs
        );
      }
      
      this.initialized = true;
      this.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      throw new OpportunityRegistryError(
        `Failed to initialize persistent registry: ${error instanceof Error ? error.message : String(error)}`,
        'INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await stat(this.config.storageDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await mkdir(this.config.storageDir, { recursive: true });
    }
  }

  /**
   * Load opportunities from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // Check if the file exists
      try {
        await stat(this.storageFilePath);
      } catch (error) {
        // File doesn't exist, create it with empty data
        await writeFile(this.storageFilePath, JSON.stringify({ opportunities: [] }), 'utf8');
        this.opportunities = new Map();
        return;
      }
      
      // Read and parse the file
      const fileContent = await readFile(this.storageFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      // Load opportunities into memory
      this.opportunities = new Map();
      if (data.opportunities && Array.isArray(data.opportunities)) {
        for (const opp of data.opportunities) {
          // Convert string dates back to Date objects
          const opportunity: Opportunity = {
            ...opp,
            detectedAt: new Date(opp.detectedAt),
            updatedAt: new Date(opp.updatedAt),
            evaluatedAt: opp.evaluatedAt ? new Date(opp.evaluatedAt) : undefined,
            validUntil: opp.validUntil ? new Date(opp.validUntil) : undefined,
            expiresAt: opp.expiresAt ? new Date(opp.expiresAt) : undefined,
            trigger: {
              ...opp.trigger,
              timestamp: new Date(opp.trigger.timestamp)
            }
          };
          this.opportunities.set(opportunity.id, opportunity);
        }
      }
      
      this.dirty = false;
      this.lastSaveTime = new Date();
    } catch (error) {
      throw new OpportunityRegistryError(
        `Failed to load opportunities from storage: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_LOAD_FAILED'
      );
    }
  }

  /**
   * Save opportunities to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      // Convert Map to array for storage
      const opportunities = Array.from(this.opportunities.values());
      
      // Serialize and write to file
      await writeFile(
        this.storageFilePath,
        JSON.stringify({ opportunities }, null, 2),
        'utf8'
      );
      
      this.dirty = false;
      this.lastSaveTime = new Date();
    } catch (error) {
      throw new OpportunityRegistryError(
        `Failed to save opportunities to storage: ${error instanceof Error ? error.message : String(error)}`,
        'STORAGE_SAVE_FAILED'
      );
    }
  }

  /**
   * Save to storage if there are unsaved changes
   */
  private async saveToStorageIfDirty(): Promise<void> {
    if (this.dirty) {
      await this.saveToStorage();
    }
  }

  /**
   * Mark data as dirty and save if configured
   */
  private async markDirtyAndSave(): Promise<void> {
    this.dirty = true;
    
    if (this.config.persistence.saveOnMutation) {
      await this.saveToStorage();
    }
  }

  /**
   * Ensure the registry is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new OpportunityRegistryError(
        'Registry not initialized',
        'REGISTRY_NOT_INITIALIZED'
      );
    }
  }

  /**
   * Store a new opportunity
   */
  async createOpportunity(opportunityData: OpportunityCreationOptions): Promise<Opportunity> {
    this.ensureInitialized();
    
    // Create the opportunity
    const opportunity = createOpportunity(opportunityData);
    
    // Store in memory
    this.opportunities.set(opportunity.id, opportunity);
    
    // Mark as dirty and save if configured
    await this.markDirtyAndSave();
    
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
    
    // Mark as dirty and save if configured
    await this.markDirtyAndSave();
    
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
        ...existing.result || {},
        ...result,
      } as any : existing.result,
    };

    this.opportunities.set(id, updated);
    
    // Mark as dirty and save if configured
    await this.markDirtyAndSave();
    
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
    
    const deleted = this.opportunities.delete(id);
    
    // Mark as dirty and save if configured
    if (deleted) {
      await this.markDirtyAndSave();
    }
    
    return deleted;
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
      // Default sort by detection time (newest first)
      return opportunities.sort((a, b) => 
        b.detectedAt.getTime() - a.detectedAt.getTime()
      );
    }

    return opportunities.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      // Extract sort values based on field
      switch (orderBy.field) {
        case 'detectedAt':
          valueA = a.detectedAt.getTime();
          valueB = b.detectedAt.getTime();
          break;
        case 'updatedAt':
          valueA = a.updatedAt.getTime();
          valueB = b.updatedAt.getTime();
          break;
        case 'priority':
          // Convert priority enum to numeric value for sorting
          const priorityValues: Record<string, number> = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1
          };
          valueA = priorityValues[a.priority] || 0;
          valueB = priorityValues[b.priority] || 0;
          break;
        case 'score':
          // Since evaluation doesn't exist on Opportunity type, 
          // we'll just use confidence from the trigger as a fallback score
          valueA = a.trigger.confidence || 0;
          valueB = b.trigger.confidence || 0;
          break;
        case 'validUntil':
          // Sort by validUntil, if present, otherwise use detectedAt
          valueA = a.validUntil ? a.validUntil.getTime() : a.detectedAt.getTime();
          valueB = b.validUntil ? b.validUntil.getTime() : b.detectedAt.getTime();
          break;
        default:
          // Default to detected time
          valueA = a.detectedAt.getTime();
          valueB = b.detectedAt.getTime();
      }

      // Apply sort direction
      const direction = orderBy.direction === 'asc' ? 1 : -1;
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });
  }

  /**
   * Find opportunities matching a filter
   */
  async findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset: number = 0
  ): Promise<Opportunity[]> {
    this.ensureInitialized();
    
    // Filter opportunities
    let filtered = Array.from(this.opportunities.values())
      .filter(opp => this.matchesFilter(opp, filter));
    
    // Sort results
    const sorted = this.sortOpportunities(filtered, orderBy);
    
    // Apply pagination
    const paginated = sorted.slice(offset, limit ? offset + limit : undefined);
    
    return paginated;
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
    // Extend filter with agent ID
    const extendedFilter: OpportunityFilter = {
      ...filter,
      agentIds: [agentId]
    };
    
    return this.findOpportunities(extendedFilter, orderBy, limit, offset);
  }

  /**
   * Count opportunities matching a filter
   */
  async countOpportunities(filter?: OpportunityFilter): Promise<number> {
    this.ensureInitialized();
    
    // Filter opportunities
    const filtered = Array.from(this.opportunities.values())
      .filter(opp => this.matchesFilter(opp, filter));
    
    return filtered.length;
  }

  /**
   * Delete expired opportunities
   */
  async clearExpiredOpportunities(before?: Date): Promise<number> {
    this.ensureInitialized();
    
    const now = before || new Date();
    let count = 0;
    
    // Find expired opportunities
    const expired = Array.from(this.opportunities.values()).filter(opportunity => {
      if (!opportunity.validUntil) {
        return false;
      }
      
      return opportunity.validUntil < now;
    });
    
    // Update status to EXPIRED for expired opportunities or delete them
    for (const opportunity of expired) {
      await this.updateOpportunityStatus(
        opportunity.id,
        OpportunityStatus.EXPIRED
      );
      count++;
    }
    
    // Save changes if anything was marked expired
    if (count > 0) {
      await this.saveToStorageIfDirty();
    }
    
    return count;
  }

  /**
   * Get health status of the registry
   */
  async getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }> {
    this.lastHealthCheck = new Date();
    
    // Basic health checks
    let isStorageAccessible = true;
    
    try {
      await stat(this.storageFilePath);
    } catch (error) {
      isStorageAccessible = false;
    }
    
    return {
      isHealthy: this.initialized && isStorageAccessible,
      lastCheck: this.lastHealthCheck,
      details: {
        opportunityCount: this.opportunities.size,
        storageAccessible: isStorageAccessible,
        storageFilePath: this.storageFilePath,
        lastSaveTime: this.lastSaveTime,
        dirty: this.dirty
      }
    };
  }

  /**
   * Performs cleanup and saves any unsaved changes
   * Call this method before application exit
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    
    if (this.dirty) {
      await this.saveToStorage();
    }
    
    this.initialized = false;
  }
} 