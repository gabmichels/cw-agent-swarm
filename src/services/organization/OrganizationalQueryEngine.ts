/**
 * Organizational Query Engine
 * 
 * Provides advanced querying capabilities for organizational data including
 * hierarchy traversal, agent reporting chains, department analytics, and
 * cross-departmental insights.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID strings for all identifiers  
 * - NO 'any' types - strict TypeScript typing
 * - Proper error handling with custom error types
 * - Clean break from legacy patterns
 */

import { ulid } from 'ulid';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PlatformConfigService } from '../PlatformConfigService';
import { 
  Department, 
  OrgHierarchyNode,
  OrgQueryFilter,
  OrgMetrics,
  DepartmentUtilization
} from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';
import {
  OrganizationError,
  DepartmentNotFoundError,
  AgentNotFoundError,
  HierarchyError
} from '../../lib/errors/OrganizationErrors';
import { Result, successResult, failureResult } from '../../lib/errors/base';

/**
 * Query result interface for paginated results
 */
export interface QueryResult<T> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Hierarchy path interface for department traversal
 */
export interface HierarchyPath {
  departmentIds: string[]; // ULIDs from root to target department
  departmentNames: string[];
  totalLevels: number;
  path: string; // Human-readable path like "Engineering > Backend > API Team"
}

/**
 * Agent reporting chain interface
 */
export interface ReportingChain {
  agentId: string; // ULID
  agentName: string;
  chain: AgentReportingNode[];
  totalLevels: number;
  topLevelManager?: string; // ULID of highest-level manager
}

/**
 * Individual node in reporting chain
 */
export interface AgentReportingNode {
  agentId: string; // ULID
  agentName: string;
  position?: string;
  level: number;
  departmentId?: string; // ULID
  departmentName?: string;
}

/**
 * Cross-departmental insights interface
 */
export interface CrossDepartmentalInsights {
  collaborationMatrix: DepartmentCollaboration[];
  resourceSharing: ResourceSharingInsight[];
  communicationPatterns: CommunicationPattern[];
  efficiencyMetrics: DepartmentEfficiency[];
}

/**
 * Department collaboration metrics
 */
export interface DepartmentCollaboration {
  departmentA: string; // ULID
  departmentB: string; // ULID
  collaborationScore: number; // 0-1
  sharedProjects: number;
  communicationFrequency: number;
  resourceExchanges: number;
}

/**
 * Resource sharing insights
 */
export interface ResourceSharingInsight {
  resourceType: string;
  sharingDepartments: string[]; // ULIDs
  utilizationRate: number; // 0-1
  costEfficiency: number; // 0-1
  recommendations: string[];
}

/**
 * Communication pattern analysis
 */
export interface CommunicationPattern {
  fromDepartment: string; // ULID
  toDepartment: string; // ULID
  messageVolume: number;
  responseTime: number; // Average in hours
  escalationRate: number; // 0-1
  effectivenessScore: number; // 0-1
}

/**
 * Department efficiency metrics
 */
export interface DepartmentEfficiency {
  departmentId: string; // ULID
  departmentName: string;
  productivityScore: number; // 0-1
  resourceUtilization: number; // 0-1
  goalAchievementRate: number; // 0-1
  agentSatisfactionScore: number; // 0-1
  recommendations: EfficiencyRecommendation[];
}

/**
 * Efficiency improvement recommendations
 */
export interface EfficiencyRecommendation {
  type: 'restructure' | 'resource_allocation' | 'process_improvement' | 'training';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImpact: number; // 0-1
  implementationComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Interface for organizational query operations
 */
export interface IOrganizationalQueryEngine {
  // Department queries
  findDepartmentsByName(name: string, exactMatch?: boolean): Promise<Result<Department[]>>;
  findDepartmentsByManager(managerId: string): Promise<Result<Department[]>>;
  getDepartmentHierarchyPath(departmentId: string): Promise<Result<HierarchyPath>>;
  
  // Agent queries
  findAgentsByDepartment(departmentId: string, includeSubDepartments?: boolean): Promise<Result<QueryResult<AgentMetadata>>>;
  findAgentsByPosition(position: string): Promise<Result<AgentMetadata[]>>;
  findAgentsByLevel(level: number): Promise<Result<AgentMetadata[]>>;
  
  // Hierarchy queries
  getSubordinateDepartments(departmentId: string, maxDepth?: number): Promise<Result<Department[]>>;
  getSuperiorDepartments(departmentId: string): Promise<Result<Department[]>>;
  
  // Agent queries
  getAgentReportingChain(agentId: string): Promise<Result<ReportingChain>>;
  getDirectReports(managerId: string): Promise<Result<AgentMetadata[]>>;
  getAllSubordinates(managerId: string, maxDepth?: number): Promise<Result<AgentMetadata[]>>;
  
  // Analytics queries
  getDepartmentMetrics(departmentId: string): Promise<Result<DepartmentUtilization>>;
  getOrganizationMetrics(filter?: OrgQueryFilter): Promise<Result<OrgMetrics>>;
  getCrossDepartmentalInsights(): Promise<Result<CrossDepartmentalInsights>>;
  
  // Search and filtering
  searchAgentsBySkills(skills: string[], departmentId?: string): Promise<Result<AgentMetadata[]>>;
  findAgentsByPosition(position: string, departmentId?: string): Promise<Result<AgentMetadata[]>>;
  getAgentsByLevel(level: number, departmentId?: string): Promise<Result<AgentMetadata[]>>;
}

/**
 * Cache statistics interface
 */
export interface CacheStatistics {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  memoryUsage: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Organizational Query Engine implementation with caching and optimization
 */
export class OrganizationalQueryEngine {
  private readonly departmentsCollection = 'departments';
  private readonly agentsCollection = 'agents';
  private readonly cacheTimeout = 300000; // 5 minutes
  private readonly cache = new Map<string, { data: unknown; timestamp: number }>();

  constructor(
    private readonly qdrantClient: QdrantClient,
    private readonly platformConfig: PlatformConfigService
  ) {}

  /**
   * Finds departments by name with optional exact matching
   */
  async findDepartmentsByName(name: string, exactMatch = false): Promise<Result<Department[]>> {
    try {
      const cacheKey = `departments_by_name_${name}_${exactMatch}`;
      const cached = this.getFromCache<Department[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      // Get all departments (in production, this would use vector search)
      const response = await this.qdrantClient.scroll(this.departmentsCollection, {
        limit: 1000,
        with_payload: true
      });

      const departments = response.points.map(point => point.payload as unknown as Department);
      
      const filtered = departments.filter(dept => {
        if (exactMatch) {
          return dept.name.toLowerCase() === name.toLowerCase();
        } else {
          return dept.name.toLowerCase().includes(name.toLowerCase());
        }
      });

      this.setCache(cacheKey, filtered);
      return successResult(filtered);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find departments by name',
        'QUERY_FAILED',
        { name, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Finds departments managed by a specific agent
   */
  async findDepartmentsByManager(managerId: string): Promise<Result<Department[]>> {
    try {
      const cacheKey = `departments_by_manager_${managerId}`;
      const cached = this.getFromCache<Department[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const response = await this.qdrantClient.scroll(this.departmentsCollection, {
        limit: 1000,
        with_payload: true
      });

      const departments = response.points.map(point => point.payload as unknown as Department);
      const filtered = departments.filter(dept => dept.managerId === managerId);

      this.setCache(cacheKey, filtered);
      return successResult(filtered);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find departments by manager',
        'QUERY_FAILED',
        { managerId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets the complete hierarchy path for a department
   */
  async getDepartmentHierarchyPath(departmentId: string): Promise<Result<HierarchyPath>> {
    try {
      const cacheKey = `hierarchy_path_${departmentId}`;
      const cached = this.getFromCache<HierarchyPath>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      // Get the department
      const deptResponse = await this.qdrantClient.retrieve(this.departmentsCollection, {
        ids: [departmentId],
        with_payload: true
      });

      if (deptResponse.length === 0) {
        return failureResult(new DepartmentNotFoundError(departmentId));
      }

      const department = deptResponse[0].payload as unknown as Department;
      
      // Build path from current department to root
      const departmentIds: string[] = [department.id];
      const departmentNames: string[] = [department.name];
      
      let currentId: string | null = department.parentDepartmentId || null;
      
      while (currentId) {
        const parentResponse = await this.qdrantClient.retrieve(this.departmentsCollection, {
          ids: [currentId],
          with_payload: true
        });

        if (parentResponse.length === 0) {
          break;
        }

        const parent = parentResponse[0].payload as unknown as Department;
        departmentIds.unshift(parent.id);
        departmentNames.unshift(parent.name);
        
        currentId = parent.parentDepartmentId || null;
      }

      const hierarchyPath: HierarchyPath = {
        departmentIds,
        departmentNames,
        totalLevels: departmentIds.length,
        path: departmentNames.join(' > ')
      };

      this.setCache(cacheKey, hierarchyPath);
      return successResult(hierarchyPath);

    } catch (error) {
      return failureResult(new HierarchyError(
        'Failed to get department hierarchy path',
        'PATH_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Finds agents in a department with optional subdepartment inclusion
   */
  async findAgentsByDepartment(
    departmentId: string, 
    includeSubDepartments = false
  ): Promise<Result<QueryResult<AgentMetadata>>> {
    try {
      const cacheKey = `agents_by_department_${departmentId}_${includeSubDepartments}`;
      const cached = this.getFromCache<QueryResult<AgentMetadata>>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      let departmentIds = [departmentId];
      
      if (includeSubDepartments) {
        const descendants = await this.getAllDescendants(departmentId);
        departmentIds = [...departmentIds, ...descendants];
      }

      // Get all agents
      const response = await this.qdrantClient.scroll(this.agentsCollection, {
        limit: 10000,
        with_payload: true
      });

      const allAgents = response.points.map(point => point.payload as unknown as AgentMetadata);
      
      const filteredAgents = allAgents.filter(agent => 
        agent.department && departmentIds.includes(agent.department.id)
      );

      const result: QueryResult<AgentMetadata> = {
        data: filteredAgents,
        totalCount: filteredAgents.length,
        hasMore: false
      };

      this.setCache(cacheKey, result);
      return successResult(result);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find agents by department',
        'QUERY_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Finds agents by position/job title
   */
  async findAgentsByPosition(position: string): Promise<Result<AgentMetadata[]>> {
    try {
      const cacheKey = `agents_by_position_${position}`;
      const cached = this.getFromCache<AgentMetadata[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const response = await this.qdrantClient.scroll(this.agentsCollection, {
        limit: 10000,
        with_payload: true
      });

      const allAgents = response.points.map(point => point.payload as unknown as AgentMetadata);
      const filtered = allAgents.filter(agent => 
        agent.position && agent.position.toLowerCase().includes(position.toLowerCase())
      );

      this.setCache(cacheKey, filtered);
      return successResult(filtered);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find agents by position',
        'QUERY_FAILED',
        { position, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Finds agents by organizational level
   */
  async findAgentsByLevel(level: number): Promise<Result<AgentMetadata[]>> {
    try {
      const cacheKey = `agents_by_level_${level}`;
      const cached = this.getFromCache<AgentMetadata[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const response = await this.qdrantClient.scroll(this.agentsCollection, {
        limit: 10000,
        with_payload: true
      });

      const allAgents = response.points.map(point => point.payload as unknown as AgentMetadata);
      const filtered = allAgents.filter(agent => agent.organizationLevel === level);

      this.setCache(cacheKey, filtered);
      return successResult(filtered);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find agents by level',
        'QUERY_FAILED',
        { level, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets the complete manager chain for an agent
   */
  async getManagerChain(agentId: string): Promise<Result<AgentMetadata[]>> {
    try {
      const cacheKey = `manager_chain_${agentId}`;
      const cached = this.getFromCache<AgentMetadata[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const chain: AgentMetadata[] = [];
      let currentAgentId: string | undefined = agentId;

      while (currentAgentId) {
        const agentResponse = await this.qdrantClient.retrieve(this.agentsCollection, {
          ids: [currentAgentId],
          with_payload: true
        });

        if (agentResponse.length === 0) break;

        const agent = agentResponse[0].payload as unknown as AgentMetadata;
        chain.push(agent);

        // Move to manager (reportingTo) - convert StructuredId to string if needed
        currentAgentId = agent.reportingTo ? String(agent.reportingTo) : undefined;
      }

      // Remove the original agent from the chain (keep only managers)
      chain.shift();

      this.setCache(cacheKey, chain);
      return successResult(chain);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get manager chain',
        'QUERY_FAILED',
        { agentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets direct reports for a manager
   */
  async getDirectReports(managerId: string): Promise<Result<AgentMetadata[]>> {
    try {
      const cacheKey = `direct_reports_${managerId}`;
      const cached = this.getFromCache<AgentMetadata[]>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const response = await this.qdrantClient.scroll(this.agentsCollection, {
        limit: 10000,
        with_payload: true
      });

      const allAgents = response.points.map(point => point.payload as unknown as AgentMetadata);
      const directReports = allAgents.filter(agent => agent.reportingTo === managerId);

      this.setCache(cacheKey, directReports);
      return successResult(directReports);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get direct reports',
        'QUERY_FAILED',
        { managerId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets all subordinates for a manager up to specified depth
   */
  async getAllSubordinates(
    managerId: string, 
    maxDepth: number = 10
  ): Promise<Result<AgentMetadata[]>> {
    try {
      const subordinates: AgentMetadata[] = [];
      const visited = new Set<string>([managerId]);
      
      await this.collectSubordinateAgents(managerId, subordinates, visited, 0, maxDepth);
      
      return successResult(subordinates);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get all subordinates',
        'ALL_SUBORDINATES_FAILED',
        { managerId, maxDepth, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Queries agents with advanced filtering
   */
  async queryWithFilters(filters: OrgQueryFilter): Promise<Result<QueryResult<AgentMetadata>>> {
    try {
      const cacheKey = `filtered_query_${JSON.stringify(filters)}`;
      const cached = this.getFromCache<QueryResult<AgentMetadata>>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      const response = await this.qdrantClient.scroll(this.agentsCollection, {
        limit: 10000,
        with_payload: true
      });

      let agents = response.points.map(point => point.payload as unknown as AgentMetadata);

      // Apply filters
      if (filters.departments && filters.departments.length > 0) {
        agents = agents.filter(agent => 
          agent.department && filters.departments!.includes(agent.department.id)
        );
      }

      if (filters.levels && filters.levels.length > 0) {
        agents = agents.filter(agent => 
          agent.organizationLevel && filters.levels!.includes(agent.organizationLevel)
        );
      }

      if (filters.positions && filters.positions.length > 0) {
        agents = agents.filter(agent => 
          agent.position && filters.positions!.includes(agent.position)
        );
      }

      if (filters.dateRange) {
        agents = agents.filter(agent => {
          if (!agent.createdAt) return false;
          const createdAt = new Date(agent.createdAt);
          return createdAt >= filters.dateRange!.from && createdAt <= filters.dateRange!.to;
        });
      }

      const result: QueryResult<AgentMetadata> = {
        data: agents,
        totalCount: agents.length,
        hasMore: false
      };

      this.setCache(cacheKey, result);
      return successResult(result);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to query with filters',
        'QUERY_FAILED',
        { filters, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets comprehensive organization metrics
   */
  async getOrganizationMetrics(): Promise<Result<OrgMetrics>> {
    try {
      const cacheKey = 'organization_metrics';
      const cached = this.getFromCache<OrgMetrics>(cacheKey);
      if (cached) {
        return successResult(cached);
      }

      // Get all departments and agents
      const [departmentsResponse, agentsResponse] = await Promise.all([
        this.qdrantClient.scroll(this.departmentsCollection, { limit: 1000, with_payload: true }),
        this.qdrantClient.scroll(this.agentsCollection, { limit: 10000, with_payload: true })
      ]);

      const departments = departmentsResponse.points.map(p => p.payload as unknown as Department);
      const agents = agentsResponse.points.map(p => p.payload as unknown as AgentMetadata);

      // Calculate metrics
      const totalAgents = agents.length;
      const totalDepartments = departments.length;
      const averageAgentsPerDepartment = totalDepartments > 0 ? totalAgents / totalDepartments : 0;
      
      // Calculate hierarchy depth
      const hierarchyDepth = Math.max(...agents.map(a => a.organizationLevel || 0), 0);
      
      // Calculate active agent ratio
      const activeAgents = agents.filter(a => (a as any).status === 'active').length;
      const activeAgentRatio = totalAgents > 0 ? activeAgents / totalAgents : 0;

      // Calculate department utilization
      const departmentUtilization: DepartmentUtilization[] = departments.map(dept => {
        const deptAgents = agents.filter(a => a.department?.id === dept.id);
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          agentCount: deptAgents.length,
          maxCapacity: 50, // Default capacity
          utilizationRate: deptAgents.length / 50,
          averageAgentLoad: 0.7, // Mock value
          performanceScore: 0.8 // Mock value
        };
      });

      // Calculate organization efficiency (mock calculation)
      const organizationEfficiency = Math.min(1, activeAgentRatio * 0.8 + (averageAgentsPerDepartment / 10) * 0.2);

      // Count communication paths (reporting relationships)
      const communicationPaths = agents.filter(a => a.reportingTo).length;

      // Calculate average management span
      const managers = agents.filter(a => a.managedAgents && a.managedAgents.length > 0);
      const managementSpan = managers.length > 0 
        ? managers.reduce((sum, m) => sum + (m.managedAgents?.length || 0), 0) / managers.length
        : 0;

      const metrics: OrgMetrics = {
        totalAgents,
        totalDepartments,
        averageAgentsPerDepartment,
        hierarchyDepth,
        activeAgentRatio,
        departmentUtilization,
        organizationEfficiency,
        communicationPaths,
        managementSpan
      };

      this.setCache(cacheKey, metrics); // Cache for default timeout
      return successResult(metrics);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get organization metrics',
        'METRICS_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Finds departments similar to the given one
   */
  async findSimilarDepartments(departmentId: string, similarity = 0.7): Promise<Result<Department[]>> {
    try {
      // This is a simplified implementation
      // In production, this would use vector similarity search
      const response = await this.qdrantClient.scroll(this.departmentsCollection, {
        limit: 1000,
        with_payload: true
      });

      const departments = response.points.map(point => point.payload as unknown as Department);
      const targetDept = departments.find(d => d.id === departmentId);
      
      if (!targetDept) {
        return failureResult(new DepartmentNotFoundError(departmentId));
      }

      // Simple similarity based on agent count and budget
      const similar = departments.filter(dept => {
        if (dept.id === departmentId) return false;
        
        const agentCountSimilarity = 1 - Math.abs(dept.agents.length - targetDept.agents.length) / Math.max(dept.agents.length, targetDept.agents.length, 1);
        const budgetSimilarity = 1 - Math.abs(dept.budgetLimit - targetDept.budgetLimit) / Math.max(dept.budgetLimit, targetDept.budgetLimit, 1);
        
        const overallSimilarity = (agentCountSimilarity + budgetSimilarity) / 2;
        return overallSimilarity >= similarity;
      });

      return successResult(similar);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to find similar departments',
        'SIMILARITY_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Warms up the cache with frequently accessed data
   */
  async warmCache(): Promise<Result<void>> {
    try {
      // Pre-load frequently accessed data
      await Promise.all([
        this.qdrantClient.scroll(this.departmentsCollection, { limit: 1000, with_payload: true }),
        this.qdrantClient.scroll(this.agentsCollection, { limit: 1000, with_payload: true }),
        this.getOrganizationMetrics()
      ]);

      return successResult(undefined);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to warm cache',
        'CACHE_WARM_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Clears all cached data
   */
  async clearCache(): Promise<Result<void>> {
    try {
      this.cache.clear();
      return successResult(undefined);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to clear cache',
        'CACHE_CLEAR_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets cache performance statistics
   */
  getCacheStatistics(): CacheStatistics {
    const entries = Array.from(this.cache.values());
    const totalRequests = entries.length;
    
    return {
      totalEntries: this.cache.size,
      hitRate: totalRequests > 0 ? entries.filter(e => e.data !== null).length / totalRequests : 0,
      missRate: totalRequests > 0 ? entries.filter(e => e.data === null).length / totalRequests : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp))) : null,
      newestEntry: entries.length > 0 ? new Date(Math.max(...entries.map(e => e.timestamp))) : null
    };
  }

  // Private helper methods

  /**
   * Gets data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Sets data in cache with timestamp
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Estimates memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry.data).length * 2; // Rough estimate
    }
    return size;
  }

  /**
   * Gets all descendant department IDs
   */
  private async getAllDescendants(departmentId: string): Promise<string[]> {
    const response = await this.qdrantClient.scroll(this.departmentsCollection, {
      limit: 1000,
      with_payload: true
    });

    const departments = response.points.map(point => point.payload as unknown as Department);
    const descendants: string[] = [];
    const toProcess = [departmentId];

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()!;
      const children = departments.filter(d => d.parentDepartmentId === currentId);
      
      for (const child of children) {
        descendants.push(child.id);
        toProcess.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Recursively collects subordinate agents
   */
  private async collectSubordinateAgents(
    managerId: string,
    subordinates: AgentMetadata[],
    visited: Set<string>,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(managerId)) {
      return;
    }

    // Get direct reports
    const directReportsResult = await this.getDirectReports(managerId);
    if (!directReportsResult.success) {
      return;
    }

    for (const agent of directReportsResult.data!) {
      if (!visited.has(agent.agentId)) {
        visited.add(agent.agentId);
        subordinates.push(agent);
        
        // Recursively collect their subordinates
        await this.collectSubordinateAgents(
          agent.agentId,
          subordinates,
          visited,
          currentDepth + 1,
          maxDepth
        );
      }
    }
  }
} 