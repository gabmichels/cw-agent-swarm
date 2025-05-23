/**
 * OpportunityRegistry.interface.ts
 * 
 * Defines the interface for storing and retrieving opportunities.
 */

import { 
  Opportunity, 
  OpportunityCreationOptions,
  OpportunityFilter,
  OpportunityOrderOptions,
  OpportunityStatus
} from '../models/opportunity.model';

/**
 * Registry for storing and retrieving opportunities
 */
export interface OpportunityRegistry {
  /**
   * Initialize the registry
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;
  
  /**
   * Store a new opportunity
   * @param opportunityData The opportunity creation options
   * @returns The created opportunity
   */
  createOpportunity(opportunityData: OpportunityCreationOptions): Promise<Opportunity>;
  
  /**
   * Get an opportunity by ID
   * @param id The opportunity ID
   * @returns The opportunity or null if not found
   */
  getOpportunityById(id: string): Promise<Opportunity | null>;
  
  /**
   * Update an existing opportunity
   * @param id The opportunity ID
   * @param updates Partial opportunity data to update
   * @returns The updated opportunity or null if not found
   */
  updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null>;
  
  /**
   * Update the status of an opportunity
   * @param id The opportunity ID
   * @param status The new status
   * @param result Optional result data if the opportunity was completed
   * @returns The updated opportunity or null if not found
   */
  updateOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    result?: Record<string, unknown>
  ): Promise<Opportunity | null>;
  
  /**
   * Delete an opportunity
   * @param id The opportunity ID
   * @returns True if deleted, false if not found
   */
  deleteOpportunity(id: string): Promise<boolean>;
  
  /**
   * Find opportunities matching a filter
   * @param filter Filter criteria
   * @param orderBy Optional ordering
   * @param limit Optional result limit
   * @param offset Optional result offset for pagination
   * @returns Matching opportunities
   */
  findOpportunities(
    filter?: OpportunityFilter,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]>;
  
  /**
   * Find opportunities for a specific agent
   * @param agentId The agent ID
   * @param filter Additional filter criteria
   * @param orderBy Optional ordering
   * @param limit Optional result limit
   * @param offset Optional result offset for pagination
   * @returns Matching opportunities for the agent
   */
  findOpportunitiesForAgent(
    agentId: string,
    filter?: Omit<OpportunityFilter, 'agentIds'>,
    orderBy?: OpportunityOrderOptions,
    limit?: number,
    offset?: number
  ): Promise<Opportunity[]>;
  
  /**
   * Count opportunities matching a filter
   * @param filter Filter criteria
   * @returns The count of matching opportunities
   */
  countOpportunities(filter?: OpportunityFilter): Promise<number>;
  
  /**
   * Delete expired opportunities
   * @param before Optional date - delete opportunities that expired before this date
   * @returns Number of deleted opportunities
   */
  clearExpiredOpportunities(before?: Date): Promise<number>;
  
  /**
   * Check if registry is healthy
   * @returns Health status with lastCheck timestamp
   */
  getHealth(): Promise<{
    isHealthy: boolean;
    lastCheck: Date;
    details?: Record<string, unknown>;
  }>;
} 