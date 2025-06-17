/**
 * Organizational Chart Data Models
 * 
 * Comprehensive type definitions for organizational structure according to IMPLEMENTATION_GUIDELINES.md
 * All identifiers use StructuredId (ULID) and strict TypeScript typing (no 'any' types).
 */

import { StructuredId } from './structured-id';
import { AgentCapability } from '../agents/shared/base/types';

/**
 * Organizational entity types for structured IDs
 */
export enum OrgEntityType {
  DEPARTMENT = 'department',
  SUB_DEPARTMENT = 'sub_department',
  TEAM = 'team',
  ORGANIZATION_CHART = 'org_chart',
  HIERARCHY_NODE = 'hierarchy_node',
  AGENT_TEMPLATE = 'agent_template',
  PLANNING_CHANGE = 'planning_change'
}

/**
 * Department interface with ULID identification
 */
export interface Department {
  id: StructuredId;
  name: string;
  description?: string;
  parentDepartment?: StructuredId; // Reference to parent department for nested structures
  headOfDepartment?: StructuredId; // Agent ID who manages this department
  agents: StructuredId[]; // Array of agent IDs in this department
  subDepartments?: StructuredId[]; // Child departments
  createdAt: Date;
  updatedAt: Date;
  createdBy: StructuredId; // User or agent who created this department
  
  // Department-specific metadata
  budget?: number; // Optional budget allocation
  maxAgents?: number; // Optional maximum agent capacity
  isActive: boolean; // Whether department is currently active
}

/**
 * SubDepartment interface for verticals/domains within departments
 */
export interface SubDepartment {
  id: StructuredId;
  name: string;
  description?: string;
  parentDepartment: StructuredId; // Reference to parent department
  headOfSubDepartment?: StructuredId; // Agent ID who manages this subdepartment
  agents: StructuredId[]; // Array of agent IDs in this subdepartment
  teams?: StructuredId[]; // Child teams within this subdepartment
  createdAt: Date;
  updatedAt: Date;
  createdBy: StructuredId;
  
  // SubDepartment-specific metadata
  specialization?: string[]; // Areas of focus for this subdepartment
  maxAgents?: number;
  isActive: boolean;
}

/**
 * Team interface for small units/pods within subdepartments
 */
export interface Team {
  id: StructuredId;
  name: string;
  description?: string;
  parentSubDepartment: StructuredId; // Reference to parent subdepartment
  parentDepartment: StructuredId; // Reference to parent department (for easier queries)
  teamLead?: StructuredId; // Agent ID who leads this team
  agents: StructuredId[]; // Array of agent IDs in this team
  createdAt: Date;
  updatedAt: Date;
  createdBy: StructuredId;
  
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
  id: StructuredId;
  name: string;
  description?: string;
  departments: StructuredId[]; // References to Department entities
  rootDepartments: StructuredId[]; // Top-level departments (no parent)
  hierarchy: OrgHierarchyNode[]; // Computed hierarchy structure
  lastUpdated: Date;
  createdAt: Date;
  createdBy: StructuredId;
  
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
  id: StructuredId;
  nodeType: 'department' | 'subdepartment' | 'team' | 'agent';
  entityId: StructuredId; // Reference to actual department, subdepartment, team, or agent
  name: string;
  level: number; // Depth in hierarchy (0 = root department, 1 = subdepartment, 2 = team, 3 = agent)
  parentNodeId?: StructuredId; // Parent node in hierarchy
  children: StructuredId[]; // Child nodes
  
  // Organizational context for easier navigation
  departmentId?: StructuredId; // Reference to top-level department
  subDepartmentId?: StructuredId; // Reference to subdepartment (if applicable)
  teamId?: StructuredId; // Reference to team (if applicable)
  
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
  id: StructuredId;
  name: string;
  description: string;
  sourceAgentId?: StructuredId; // Original agent this template was created from
  
  // Core agent configuration
  capabilities: AgentCapability[];
  defaultCategory?: string; // For personal mode
  defaultDepartment?: {
    id: string;
    name: string;
    code: string;
  }; // For organizational mode - department object with relational data
  defaultPosition?: string; // Default job title
  
  // Configuration parameters
  configParams: AgentTemplateConfig;
  
  // Template metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: StructuredId;
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
  id: StructuredId;
  changeType: PlanningChangeType;
  entityId: StructuredId; // ID of entity being changed (agent, department)
  
  // Change details
  fromValue?: string | StructuredId;
  toValue?: string | StructuredId;
  metadata?: Record<string, unknown>;
  
  // Change tracking
  createdAt: Date;
  createdBy: StructuredId;
  appliedAt?: Date;
  status: PlanningChangeStatus;
  
  // Impact analysis
  affectedEntities?: StructuredId[]; // Other entities affected by this change
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
  departments?: string[]; // Filter by department IDs (not names for better relational integrity)
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
  departmentId: StructuredId;
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
  entityId?: StructuredId;
  entityType?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Organizational validation warning
 */
export interface OrgValidationWarning {
  code: string;
  message: string;
  entityId?: StructuredId;
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