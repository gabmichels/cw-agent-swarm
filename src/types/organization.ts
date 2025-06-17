/**
 * Organizational Chart Data Models
 * 
 * Comprehensive type definitions for organizational structure following IMPLEMENTATION_GUIDELINES.md
 * All identifiers use ULID strings for consistency and simplicity.
 * NO 'any' types - strict TypeScript typing throughout.
 */

import { AgentCapability } from '../agents/shared/base/types';

/**
 * Department interface with ULID identification
 */
export interface Department extends Record<string, unknown> {
  id: string; // ULID
  name: string;
  description?: string;
  code: string;
  budgetLimit: number;
  currentSpent: number;
  currency: string;
  managerId?: string; // ULID of manager agent
  parentDepartmentId?: string | null; // ULID of parent department
  agents: string[]; // Array of agent ULIDs
  subDepartments: string[]; // Array of subdepartment ULIDs
  teams: string[]; // Array of team ULIDs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SubDepartment interface for verticals/domains within departments
 */
export interface SubDepartment {
  id: string; // ULID
  name: string;
  description?: string;
  parentDepartment: string; // ULID reference to parent department
  headOfSubDepartment?: string; // ULID of agent who manages this subdepartment
  agents: string[]; // Array of agent ULIDs in this subdepartment
  teams?: string[]; // Child team ULIDs within this subdepartment
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // ULID
  
  // SubDepartment-specific metadata
  specialization?: string[]; // Areas of focus for this subdepartment
  maxAgents?: number;
  isActive: boolean;
}

/**
 * Team interface for small units/pods within subdepartments
 */
export interface Team {
  id: string; // ULID
  name: string;
  description?: string;
  parentSubDepartment: string; // ULID reference to parent subdepartment
  parentDepartment: string; // ULID reference to parent department (for easier queries)
  teamLead?: string; // ULID of agent who leads this team
  agents: string[]; // Array of agent ULIDs in this team
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // ULID
  
  // Team-specific metadata
  teamType?: 'development' | 'operations' | 'support' | 'research' | 'management' | 'other';
  maxMembers?: number; // Recommended max team size
  technologies?: string[]; // Technologies/tools this team works with
  responsibilities?: string[]; // Key responsibilities
  isActive: boolean;
}

/**
 * Organization chart root structure
 */
export interface OrganizationChart {
  id: string; // ULID
  name: string;
  description?: string;
  departments: string[]; // ULIDs of Department entities
  rootDepartments: string[]; // ULIDs of top-level departments (no parent)
  hierarchy: OrgHierarchyNode[]; // Computed hierarchy structure
  lastUpdated: Date;
  createdAt: Date;
  createdBy: string; // ULID
  
  // Chart metadata
  totalAgents: number; // Computed count of all agents
  totalDepartments: number; // Computed count of all departments
  maxDepth: number; // Maximum hierarchy depth
  version: number; // Version for change tracking
}

/**
 * Hierarchy node for tree structure representation
 */
export interface OrgHierarchyNode {
  id: string; // ULID
  nodeType: 'department' | 'subdepartment' | 'team' | 'agent';
  entityId: string; // ULID reference to actual department, subdepartment, team, or agent
  name: string;
  level: number; // Depth in hierarchy (0 = root department, 1 = subdepartment, 2 = team, 3 = agent)
  parentNodeId?: string; // ULID of parent node in hierarchy
  children: string[]; // ULIDs of child nodes
  
  // Organizational context for easier navigation
  departmentId?: string; // ULID reference to top-level department
  subDepartmentId?: string; // ULID reference to subdepartment (if applicable)
  teamId?: string; // ULID reference to team (if applicable)
  
  // Position and layout info for visualization
  position?: {
    x: number;
    y: number;
    layer: number;
  };
  
  // Node metadata
  isExpanded?: boolean; // UI state for collapsible nodes
  nodeData?: Record<string, unknown>; // Additional node-specific data
}

/**
 * Agent configuration template for spawning agents
 */
export interface AgentConfigTemplate {
  id: string; // ULID
  name: string;
  description: string;
  sourceAgentId?: string; // ULID of original agent this template was created from
  
  // Core agent configuration
  capabilities: AgentCapability[];
  defaultCategory?: string; // For personal mode
  defaultDepartment?: {
    id: string; // ULID
    name: string;
    code: string;
  }; // For organizational mode - department object with relational data
  defaultPosition?: string; // Default job title
  
  // Configuration parameters
  configParams: AgentTemplateConfig;
  
  // Template metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // ULID
  usageCount: number; // How many times this template has been used
  lastUsed?: Date;
  
  // Template categorization
  templateCategory: TemplateCategory;
  tags: string[];
  isPublic: boolean; // Whether template can be shared across organization
}

/**
 * Template category enum
 */
export enum TemplateCategory {
  GENERAL = 'general',
  SPECIALIZED = 'specialized',
  MANAGEMENT = 'management',
  TECHNICAL = 'technical',
  CUSTOMER_SERVICE = 'customer_service',
  ANALYTICS = 'analytics',
  PERSONAL_PRODUCTIVITY = 'personal_productivity',
  HEALTH_FITNESS = 'health_fitness',
  FINANCE = 'finance',
  EDUCATION = 'education'
}

/**
 * Agent template configuration parameters
 */
export interface AgentTemplateConfig {
  // Core agent settings
  version: string;
  isPublic: boolean;
  
  // Behavioral configuration
  communicationStyle?: 'formal' | 'casual' | 'technical' | 'friendly';
  responseLength?: 'brief' | 'moderate' | 'detailed';
  expertise: string[]; // Areas of expertise
  
  // Performance settings
  maxConcurrentTasks?: number;
  responseTimeTarget?: number; // Milliseconds
  
  // Integration settings
  allowedTools?: string[]; // Tool names this agent can use
  restrictedDomains?: string[]; // Domains this agent cannot access
  
  // Custom parameters (strictly typed as unknown to avoid 'any')
  customParams: Record<string, unknown>;
}

/**
 * Planning change for drag-and-drop reorganization
 */
export interface OrgPlanningChange {
  id: string; // ULID
  changeType: PlanningChangeType;
  entityId: string; // ULID of entity being changed (agent, department)
  
  // Change details
  fromValue?: string;
  toValue?: string;
  metadata?: Record<string, unknown>;
  
  // Change tracking
  createdAt: Date;
  createdBy: string; // ULID
  appliedAt?: Date;
  status: PlanningChangeStatus;
  
  // Impact analysis
  affectedEntities?: string[]; // ULIDs of other entities affected by this change
  estimatedImpact: ChangeImpact;
}

/**
 * Planning change type enum
 */
export enum PlanningChangeType {
  MOVE_AGENT = 'move_agent',
  CREATE_DEPARTMENT = 'create_department',
  DELETE_DEPARTMENT = 'delete_department',
  ASSIGN_MANAGER = 'assign_manager',
  REMOVE_MANAGER = 'remove_manager',
  CHANGE_POSITION = 'change_position',
  BATCH_MOVE = 'batch_move' // Multiple agents moved at once
}

/**
 * Planning change status enum
 */
export enum PlanningChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  APPLIED = 'applied',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Impact assessment for organizational changes
 */
export interface ChangeImpact {
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgentCount: number;
  affectedDepartmentCount: number;
  requiresApproval: boolean;
  estimatedDowntime?: number; // Minutes
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Organizational query filters
 */
export interface OrgQueryFilter {
  departments?: string[]; // Filter by department ULIDs
  levels?: number[]; // Filter by hierarchy levels
  agentStatuses?: string[]; // Filter by agent statuses
  positions?: string[]; // Filter by job positions
  dateRange?: {
    from: Date;
    to: Date;
  };
  includeInactive?: boolean; // Include inactive departments/agents
}

/**
 * Organizational metrics for analytics
 */
export interface OrgMetrics {
  totalAgents: number;
  totalDepartments: number;
  averageAgentsPerDepartment: number;
  hierarchyDepth: number;
  activeAgentRatio: number; // Percentage of active agents
  departmentUtilization: DepartmentUtilization[];
  
  // Performance metrics
  organizationEfficiency: number; // 0-1 score
  communicationPaths: number; // Number of reporting relationships
  managementSpan: number; // Average number of direct reports
}

/**
 * Department utilization metrics
 */
export interface DepartmentUtilization {
  departmentId: string; // ULID
  departmentName: string;
  agentCount: number;
  maxCapacity?: number;
  utilizationRate: number; // 0-1
  averageAgentLoad: number; // 0-1
  performanceScore: number; // 0-1
}

/**
 * Organizational validation result
 */
export interface OrgValidationResult {
  isValid: boolean;
  errors: OrgValidationError[];
  warnings: OrgValidationWarning[];
  suggestions: OrgValidationSuggestion[];
}

/**
 * Organizational validation error
 */
export interface OrgValidationError {
  code: string;
  message: string;
  entityId?: string; // ULID
  entityType?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Organizational validation warning
 */
export interface OrgValidationWarning {
  code: string;
  message: string;
  entityId?: string; // ULID
  recommendation?: string;
}

/**
 * Organizational validation suggestion
 */
export interface OrgValidationSuggestion {
  type: 'optimization' | 'restructure' | 'efficiency';
  message: string;
  impact: ChangeImpact;
  implementationSteps?: string[];
}

/**
 * Department creation request interface
 */
export interface DepartmentCreateRequest {
  name: string;
  description?: string;
  code?: string;
  budgetLimit?: number;
  currency?: string;
  managerId?: string; // ULID
  parentDepartmentId?: string; // ULID
}

/**
 * Department update request interface
 */
export interface DepartmentUpdateRequest {
  name?: string;
  description?: string;
  code?: string;
  budgetLimit?: number;
  currency?: string;
  managerId?: string; // ULID
  parentDepartmentId?: string; // ULID
}

/**
 * Agent department assignment interface
 */
export interface AgentDepartmentAssignment {
  agentId: string; // ULID
  departmentId: string; // ULID
  subDepartment?: string;
  team?: string;
  position?: string;
  organizationLevel?: number;
} 