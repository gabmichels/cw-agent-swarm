/**
 * Organization Service Implementation
 * 
 * Provides comprehensive organization management capabilities including
 * department CRUD operations, agent-department assignments, and hierarchy
 * calculations with platform mode awareness.
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
  OrganizationChart, 
  OrgHierarchyNode,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
  AgentDepartmentAssignment
} from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';
import {
  OrganizationError,
  DepartmentError,
  DepartmentNotFoundError,
  DepartmentAlreadyExistsError,
  HierarchyError,
  CircularDependencyError,
  InvalidPlatformModeError
} from '../../lib/errors/OrganizationErrors';
import { Result, successResult, failureResult } from '../../lib/errors/base';

/**
 * Interface for organization operations
 */
export interface IOrganizationService {
  // Department CRUD operations
  createDepartment(request: DepartmentCreateRequest): Promise<Result<Department>>;
  getDepartment(departmentId: string): Promise<Result<Department>>;
  updateDepartment(departmentId: string, request: DepartmentUpdateRequest): Promise<Result<Department>>;
  deleteDepartment(departmentId: string): Promise<Result<void>>;
  listDepartments(): Promise<Result<Department[]>>;
  
  // Agent-department assignment
  assignAgentToDepartment(assignment: AgentDepartmentAssignment): Promise<Result<void>>;
  removeAgentFromDepartment(agentId: string): Promise<Result<void>>;
  getAgentsByDepartment(departmentId: string): Promise<Result<AgentMetadata[]>>;
  
  // Hierarchy operations
  calculateHierarchy(): Promise<Result<OrgHierarchyNode[]>>;
  validateHierarchy(departments: Department[]): Promise<Result<boolean>>;
  getOrganizationChart(): Promise<Result<OrganizationChart>>;
  
  // Utility operations
  searchDepartments(query: string): Promise<Result<Department[]>>;
  getDepartmentStatistics(departmentId: string): Promise<Result<DepartmentStatistics>>;
}

/**
 * Department statistics interface
 */
export interface DepartmentStatistics {
  totalAgents: number;
  activeAgents: number;
  subDepartments: number;
  teams: number;
  budgetUtilization: number;
  averageAgentLevel: number;
}

/**
 * Organization Service implementation with dependency injection
 */
export class OrganizationService implements IOrganizationService {
  private readonly collectionName = 'departments';
  private readonly agentsCollectionName = 'agents';
  
  constructor(
    private readonly qdrantClient: QdrantClient,
    private readonly platformConfig: PlatformConfigService
  ) {}

  /**
   * Creates a new department with validation and hierarchy checks
   */
  async createDepartment(request: DepartmentCreateRequest): Promise<Result<Department>> {
    try {
      // Validate platform mode
      if (!this.platformConfig.isOrganizationalMode()) {
        return failureResult(new InvalidPlatformModeError(
          'createDepartment',
          this.platformConfig.getPlatformMode(),
          'organizational'
        ));
      }

      // Validate request
      const validationResult = await this.validateDepartmentRequest(request);
      if (!validationResult.success) {
        return failureResult(validationResult.error!);
      }

      // Check for duplicate department name
      const existingDepartments = await this.listDepartments();
      if (!existingDepartments.success) {
        return failureResult(existingDepartments.error!);
      }

      const duplicateExists = existingDepartments.data!.some(
        dept => dept.name.toLowerCase() === request.name.toLowerCase()
      );

      if (duplicateExists) {
        return failureResult(new DepartmentAlreadyExistsError(request.name));
      }

      // Create department with ULID
      const departmentId = ulid();
      const now = new Date();
      
      const department: Department = {
        id: departmentId,
        name: request.name,
        description: request.description,
        code: request.code || this.generateDepartmentCode(request.name),
        budgetLimit: request.budgetLimit || 0,
        currentSpent: 0,
        currency: request.currency || 'USD',
        managerId: request.managerId,
        parentDepartmentId: request.parentDepartmentId || null,
        agents: [],
        subDepartments: [],
        teams: [],
        createdAt: now,
        updatedAt: now
      };

      // Validate hierarchy if parent department specified
      if (request.parentDepartmentId) {
        const hierarchyValidation = await this.validateParentDepartment(
          departmentId,
          request.parentDepartmentId
        );
        if (!hierarchyValidation.success) {
          return failureResult(hierarchyValidation.error!);
        }
      }

      // Store in Qdrant
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: departmentId,
          payload: department as Record<string, unknown>,
          vector: await this.generateDepartmentVector(department)
        }]
      });

      return successResult(department);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to create department',
        'CREATE_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Retrieves a department by ID
   */
  async getDepartment(departmentId: string): Promise<Result<Department>> {
    try {
      const response = await this.qdrantClient.retrieve(this.collectionName, {
        ids: [departmentId],
        with_payload: true
      });

      if (response.length === 0) {
        return failureResult(new DepartmentNotFoundError(departmentId));
      }

      const department = response[0].payload as unknown as Department;
      return successResult(department);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to retrieve department',
        'RETRIEVE_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Updates an existing department
   */
  async updateDepartment(
    departmentId: string, 
    request: DepartmentUpdateRequest
  ): Promise<Result<Department>> {
    try {
      // Get existing department
      const existingResult = await this.getDepartment(departmentId);
      if (!existingResult.success) {
        return failureResult(existingResult.error!);
      }

      const existing = existingResult.data!;
      
      // Validate hierarchy changes
      if (request.parentDepartmentId !== undefined && 
          request.parentDepartmentId !== existing.parentDepartmentId) {
        const hierarchyValidation = await this.validateParentDepartment(
          departmentId,
          request.parentDepartmentId
        );
        if (!hierarchyValidation.success) {
          return failureResult(hierarchyValidation.error!);
        }
      }

      // Update department
      const updatedDepartment: Department = {
        ...existing,
        ...request,
        updatedAt: new Date()
      };

      // Store updated department
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: departmentId,
          payload: updatedDepartment,
          vector: await this.generateDepartmentVector(updatedDepartment)
        }]
      });

      return successResult(updatedDepartment);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to update department',
        'UPDATE_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Deletes a department with safety checks
   */
  async deleteDepartment(departmentId: string): Promise<Result<void>> {
    try {
      // Check if department exists
      const existingResult = await this.getDepartment(departmentId);
      if (!existingResult.success) {
        return failureResult(existingResult.error!);
      }

      const department = existingResult.data!;

      // Check if department has agents
      if (department.agents.length > 0) {
        return failureResult(new DepartmentError(
          'Cannot delete department with assigned agents',
          'HAS_AGENTS',
          { departmentId, agentCount: department.agents.length }
        ));
      }

      // Check if department has sub-departments
      if (department.subDepartments.length > 0) {
        return failureResult(new DepartmentError(
          'Cannot delete department with sub-departments',
          'HAS_SUBDEPARTMENTS',
          { departmentId, subDepartmentCount: department.subDepartments.length }
        ));
      }

      // Delete from Qdrant
      await this.qdrantClient.delete(this.collectionName, {
        wait: true,
        points: [departmentId]
      });

      return successResult(undefined);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to delete department',
        'DELETE_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Lists all departments
   */
  async listDepartments(): Promise<Result<Department[]>> {
    try {
      const response = await this.qdrantClient.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true
      });

      const departments = response.points.map(point => point.payload as unknown as Department);
      return successResult(departments);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to list departments',
        'LIST_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Assigns an agent to a department
   */
  async assignAgentToDepartment(assignment: AgentDepartmentAssignment): Promise<Result<void>> {
    try {
      // Get department
      const departmentResult = await this.getDepartment(assignment.departmentId);
      if (!departmentResult.success) {
        return failureResult(departmentResult.error!);
      }

      const department = departmentResult.data!;

      // Update agent metadata in Qdrant agents collection
      const agentResponse = await this.qdrantClient.retrieve(this.agentsCollectionName, {
        ids: [assignment.agentId],
        with_payload: true
      });

      if (agentResponse.length === 0) {
        return failureResult(new OrganizationError(
          `Agent not found: ${assignment.agentId}`,
          'AGENT_NOT_FOUND',
          { agentId: assignment.agentId }
        ));
      }

      const agent = agentResponse[0].payload as unknown as AgentMetadata;
      
      // Update agent's department information
      const updatedAgent: AgentMetadata = {
        ...agent,
        department: {
          id: department.id,
          name: department.name,
          code: department.code
        },
        subDepartment: assignment.subDepartment,
        team: assignment.team,
        position: assignment.position,
        organizationLevel: assignment.organizationLevel
      };

      // Get vector safely - handle different Qdrant vector types
      const existingVector = agentResponse[0].vector;
      let vector: number[] = [];
      
      if (Array.isArray(existingVector)) {
        // Handle number[] case
        vector = existingVector as number[];
      } else if (existingVector && typeof existingVector === 'object') {
        // Handle other vector types - generate new vector
        vector = await this.generateAgentVector(updatedAgent);
      } else {
        // Generate new vector if none exists
        vector = await this.generateAgentVector(updatedAgent);
      }

      // Update agent in Qdrant
      await this.qdrantClient.upsert(this.agentsCollectionName, {
        wait: true,
        points: [{
          id: assignment.agentId,
          payload: updatedAgent as unknown as Record<string, unknown>,
          vector: vector
        }]
      });

      // Update department's agent list
      if (!department.agents.includes(assignment.agentId)) {
        department.agents.push(assignment.agentId);
        
        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points: [{
            id: assignment.departmentId,
            payload: department,
            vector: await this.generateDepartmentVector(department)
          }]
        });
      }

      return successResult(undefined);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to assign agent to department',
        'ASSIGNMENT_FAILED',
        { assignment, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Removes an agent from their current department
   */
  async removeAgentFromDepartment(agentId: string): Promise<Result<void>> {
    try {
      // Get agent
      const agentResponse = await this.qdrantClient.retrieve(this.agentsCollectionName, {
        ids: [agentId],
        with_payload: true
      });

      if (agentResponse.length === 0) {
        return failureResult(new OrganizationError(
          `Agent not found: ${agentId}`,
          'AGENT_NOT_FOUND',
          { agentId }
        ));
      }

      const agent = agentResponse[0].payload as unknown as AgentMetadata;
      
      if (!agent.department) {
        return successResult(undefined); // Agent not assigned to any department
      }

      // Remove department information from agent
      const updatedAgent: AgentMetadata = {
        ...agent,
        department: undefined,
        subDepartment: undefined,
        team: undefined,
        position: undefined,
        organizationLevel: undefined
      };

      // Get vector safely
      const existingVector = agentResponse[0].vector;
      let vector: number[] = [];
      
      if (Array.isArray(existingVector)) {
        vector = existingVector as number[];
      } else {
        vector = await this.generateAgentVector(updatedAgent);
      }

      // Update agent in Qdrant
      await this.qdrantClient.upsert(this.agentsCollectionName, {
        wait: true,
        points: [{
          id: agentId,
          payload: updatedAgent as unknown as Record<string, unknown>,
          vector: vector
        }]
      });

      // Remove agent from department's agent list
      const departmentResult = await this.getDepartment(agent.department.id);
      if (departmentResult.success) {
        const department = departmentResult.data!;
        department.agents = department.agents.filter(id => id !== agentId);
        
        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points: [{
            id: agent.department.id,
            payload: department,
            vector: await this.generateDepartmentVector(department)
          }]
        });
      }

      return successResult(undefined);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to remove agent from department',
        'REMOVAL_FAILED',
        { agentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets all agents in a specific department
   */
  async getAgentsByDepartment(departmentId: string): Promise<Result<AgentMetadata[]>> {
    try {
      const departmentResult = await this.getDepartment(departmentId);
      if (!departmentResult.success) {
        return failureResult(departmentResult.error!);
      }

      const department = departmentResult.data!;
      
      if (department.agents.length === 0) {
        return successResult([]);
      }

      // Retrieve all agents in the department
      const agentsResponse = await this.qdrantClient.retrieve(this.agentsCollectionName, {
        ids: department.agents,
        with_payload: true
      });

      const agents = agentsResponse.map(point => point.payload as unknown as AgentMetadata);
      return successResult(agents);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get agents by department',
        'GET_AGENTS_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Calculates the complete organizational hierarchy
   */
  async calculateHierarchy(): Promise<Result<OrgHierarchyNode[]>> {
    try {
      const departmentsResult = await this.listDepartments();
      if (!departmentsResult.success) {
        return failureResult(departmentsResult.error!);
      }

      const departments = departmentsResult.data!;
      
      // Validate hierarchy for circular dependencies
      const validationResult = await this.validateHierarchy(departments);
      if (!validationResult.success) {
        return failureResult(validationResult.error!);
      }

      // Build hierarchy tree
      const hierarchy = this.buildHierarchyTree(departments);
      return successResult(hierarchy);

    } catch (error) {
      return failureResult(new HierarchyError(
        'Failed to calculate hierarchy',
        'CALCULATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Validates organizational hierarchy for circular dependencies
   */
  async validateHierarchy(departments: Department[]): Promise<Result<boolean>> {
    try {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      for (const department of departments) {
        if (!visited.has(department.id)) {
          const path: string[] = [];
          const hasCycle = this.detectCircularDependency(
            department,
            departments,
            visited,
            recursionStack,
            path
          );

          if (hasCycle) {
            return failureResult(new CircularDependencyError(path));
          }
        }
      }

      return successResult(true);

    } catch (error) {
      return failureResult(new HierarchyError(
        'Failed to validate hierarchy',
        'VALIDATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets the complete organization chart
   */
  async getOrganizationChart(): Promise<Result<OrganizationChart>> {
    try {
      const departmentsResult = await this.listDepartments();
      if (!departmentsResult.success) {
        return failureResult(departmentsResult.error!);
      }

      const hierarchyResult = await this.calculateHierarchy();
      if (!hierarchyResult.success) {
        return failureResult(hierarchyResult.error!);
      }

      const organizationChart: OrganizationChart = {
        id: ulid(),
        name: this.platformConfig.getOrganizationName() || 'Organization',
        departments: departmentsResult.data!.map(d => d.id),
        rootDepartments: departmentsResult.data!.filter(d => !d.parentDepartmentId).map(d => d.id),
        hierarchy: hierarchyResult.data!,
        lastUpdated: new Date(),
        createdAt: new Date(),
        createdBy: 'system', // TODO: Get from context
        totalAgents: departmentsResult.data!.reduce((sum, dept) => sum + dept.agents.length, 0),
        totalDepartments: departmentsResult.data!.length,
        maxDepth: this.calculateMaxDepth(hierarchyResult.data!),
        version: 1
      };

      return successResult(organizationChart);

    } catch (error) {
      return failureResult(new OrganizationError(
        'Failed to get organization chart',
        'CHART_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Searches departments by name or description
   */
  async searchDepartments(query: string): Promise<Result<Department[]>> {
    try {
      const departmentsResult = await this.listDepartments();
      if (!departmentsResult.success) {
        return failureResult(departmentsResult.error!);
      }

      const searchTerm = query.toLowerCase();
      const filteredDepartments = departmentsResult.data!.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm) ||
        (dept.description && dept.description.toLowerCase().includes(searchTerm)) ||
        dept.code.toLowerCase().includes(searchTerm)
      );

      return successResult(filteredDepartments);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to search departments',
        'SEARCH_FAILED',
        { query, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * Gets comprehensive statistics for a department
   */
  async getDepartmentStatistics(departmentId: string): Promise<Result<DepartmentStatistics>> {
    try {
      const departmentResult = await this.getDepartment(departmentId);
      if (!departmentResult.success) {
        return failureResult(departmentResult.error!);
      }

      const agentsResult = await this.getAgentsByDepartment(departmentId);
      if (!agentsResult.success) {
        return failureResult(agentsResult.error!);
      }

      const department = departmentResult.data!;
      const agents = agentsResult.data!;

      const activeAgents = agents.filter(agent => 
        agent.status === 'available' || agent.status === 'busy'
      ).length;

      const averageAgentLevel = agents.length > 0 
        ? agents.reduce((sum, agent) => sum + (agent.organizationLevel || 0), 0) / agents.length
        : 0;

      const budgetUtilization = department.budgetLimit > 0 
        ? (department.currentSpent / department.budgetLimit) * 100
        : 0;

      const statistics: DepartmentStatistics = {
        totalAgents: agents.length,
        activeAgents,
        subDepartments: department.subDepartments.length,
        teams: department.teams.length,
        budgetUtilization,
        averageAgentLevel
      };

      return successResult(statistics);

    } catch (error) {
      return failureResult(new DepartmentError(
        'Failed to get department statistics',
        'STATISTICS_FAILED',
        { departmentId, error: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  // Private helper methods

  /**
   * Validates department creation/update request
   */
  private async validateDepartmentRequest(request: DepartmentCreateRequest): Promise<Result<void>> {
    const errors: string[] = [];

    if (!request.name || request.name.trim().length === 0) {
      errors.push('Department name is required');
    }

    if (request.name && request.name.length > 100) {
      errors.push('Department name must be 100 characters or less');
    }

    if (request.description && request.description.length > 500) {
      errors.push('Department description must be 500 characters or less');
    }

    if (request.budgetLimit && request.budgetLimit < 0) {
      errors.push('Budget limit cannot be negative');
    }

    if (errors.length > 0) {
      return failureResult(new DepartmentError(
        'Department validation failed',
        'VALIDATION_FAILED',
        { validationErrors: errors }
      ));
    }

    return successResult(undefined);
  }

  /**
   * Validates parent department relationship
   */
  private async validateParentDepartment(
    departmentId: string,
    parentDepartmentId: string | null
  ): Promise<Result<void>> {
    if (!parentDepartmentId) {
      return successResult(undefined);
    }

    // Check if parent department exists
    const parentResult = await this.getDepartment(parentDepartmentId);
    if (!parentResult.success) {
      return failureResult(new DepartmentError(
        'Parent department not found',
        'PARENT_NOT_FOUND',
        { parentDepartmentId }
      ));
    }

    // Check for circular dependency
    if (await this.wouldCreateCircularDependency(departmentId, parentDepartmentId)) {
      return failureResult(new CircularDependencyError([departmentId, parentDepartmentId]));
    }

    return successResult(undefined);
  }

  /**
   * Checks if setting a parent would create a circular dependency
   */
  private async wouldCreateCircularDependency(
    departmentId: string,
    parentDepartmentId: string
  ): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = parentDepartmentId;

    while (currentId && !visited.has(currentId)) {
      if (currentId === departmentId) {
        return true; // Circular dependency detected
      }

      visited.add(currentId);
      
      const departmentResult = await this.getDepartment(currentId);
      if (!departmentResult.success) {
        break;
      }

      currentId = departmentResult.data!.parentDepartmentId || null;
    }

    return false;
  }

  /**
   * Detects circular dependencies in department hierarchy
   */
  private detectCircularDependency(
    department: Department,
    allDepartments: Department[],
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): boolean {
    visited.add(department.id);
    recursionStack.add(department.id);
    path.push(department.name);

    if (department.parentDepartmentId) {
      const parent = allDepartments.find(d => d.id === department.parentDepartmentId);
      if (parent) {
        if (!visited.has(parent.id)) {
          if (this.detectCircularDependency(parent, allDepartments, visited, recursionStack, path)) {
            return true;
          }
        } else if (recursionStack.has(parent.id)) {
          path.push(parent.name);
          return true;
        }
      }
    }

    recursionStack.delete(department.id);
    path.pop();
    return false;
  }

  /**
   * Builds hierarchical tree structure from flat department list
   */
  private buildHierarchyTree(departments: Department[]): OrgHierarchyNode[] {
    const rootNodes: OrgHierarchyNode[] = [];
    const nodeMap = new Map<string, OrgHierarchyNode>();

    // Create all nodes first
    departments.forEach(dept => {
      const node: OrgHierarchyNode = {
        id: ulid(),
        nodeType: 'department',
        entityId: dept.id,
        name: dept.name,
        level: 0, // Will be calculated later
        parentNodeId: undefined,
        children: [],
        departmentId: dept.id,
        nodeData: {
          description: dept.description,
          agentCount: dept.agents.length,
          budgetUtilization: dept.budgetLimit > 0 ? (dept.currentSpent / dept.budgetLimit) * 100 : 0
        }
      };

      nodeMap.set(dept.id, node);
      
      if (!dept.parentDepartmentId) {
        rootNodes.push(node);
      }
    });

    // Establish parent-child relationships and calculate levels
    departments.forEach(dept => {
      const node = nodeMap.get(dept.id)!;
      
      if (dept.parentDepartmentId) {
        const parentNode = nodeMap.get(dept.parentDepartmentId);
        if (parentNode) {
          node.parentNodeId = parentNode.id;
          node.level = parentNode.level + 1;
          parentNode.children.push(node.id);
        }
      }
    });

    return rootNodes;
  }

  /**
   * Calculates maximum depth of hierarchy
   */
  private calculateMaxDepth(hierarchy: OrgHierarchyNode[]): number {
    let maxDepth = 0;
    
    const calculateDepth = (nodes: OrgHierarchyNode[], currentDepth: number) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      nodes.forEach(node => {
        maxDepth = Math.max(maxDepth, node.level);
      });
    };

    calculateDepth(hierarchy, 0);
    return maxDepth;
  }

  /**
   * Generates department code from name
   */
  private generateDepartmentCode(name: string): string {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);
  }

  /**
   * Generates vector representation for department (for semantic search)
   */
  private async generateDepartmentVector(department: Department): Promise<number[]> {
    // Simple vector generation based on department characteristics
    // In a real implementation, this would use an embedding model
    const text = `${department.name} ${department.description || ''} ${department.code}`;
    
    // Create a simple hash-based vector
    const vector = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % 128] += charCode;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Generates vector representation for agent (for semantic search)
   */
  private async generateAgentVector(agent: AgentMetadata): Promise<number[]> {
    const text = `${agent.name} ${agent.description} ${agent.category || ''} ${agent.department?.name || ''}`;
    
    // Create a simple hash-based vector
    const vector = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % 128] += charCode;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }
} 