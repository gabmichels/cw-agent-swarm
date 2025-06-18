/**
 * Agent Schema Validator
 * 
 * Mode-aware validation service for agent metadata according to IMPLEMENTATION_GUIDELINES.md
 * Provides strict validation with comprehensive error handling and no 'any' types.
 */

import { AgentMetadata } from '../../types/metadata';
import { StructuredId } from '../../types/entity-identifier';
import { PlatformConfigService, PlatformMode } from '../PlatformConfigService';

/**
 * Validation error class
 */
export class AgentValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  context?: Record<string, unknown>;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

/**
 * Agent Schema Validator Service
 * 
 * Provides mode-aware validation for agent metadata with comprehensive error reporting.
 * Follows dependency injection pattern and uses PlatformConfigService for mode detection.
 */
export class AgentSchemaValidator {
  private readonly platformConfig: PlatformConfigService;
  
  constructor(platformConfig?: PlatformConfigService) {
    this.platformConfig = platformConfig || PlatformConfigService.getInstance();
  }
  
  /**
   * Validate agent metadata according to current platform mode
   * 
   * @param metadata - Agent metadata to validate
   * @returns Validation result with errors and warnings
   */
  public validate(metadata: Partial<AgentMetadata>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      // Core field validation (required for both modes)
      this.validateCoreFields(metadata, errors);
      
      // Mode-specific validation
      if (this.platformConfig.isPersonalMode()) {
        this.validatePersonalModeFields(metadata, errors, warnings);
      } else {
        this.validateOrganizationalModeFields(metadata, errors, warnings);
      }
      
      // Cross-field validation
      this.validateFieldConsistency(metadata, errors, warnings);
      
      // Performance and optimization validation
      this.validatePerformanceConstraints(metadata, warnings);
      
    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_FAILED',
        severity: 'error',
        context: { error: error instanceof Error ? error.message : error }
      });
    }
    
    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate core required fields for all modes
   */
  private validateCoreFields(metadata: Partial<AgentMetadata>, errors: ValidationError[]): void {
    // Required fields
    if (!metadata.agentId) {
      errors.push({
        field: 'agentId',
        message: 'Agent ID is required',
        code: 'MISSING_AGENT_ID',
        severity: 'error'
      });
    }
    
    if (!metadata.name || metadata.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Agent name is required and cannot be empty',
        code: 'MISSING_AGENT_NAME',
        severity: 'error'
      });
    } else if (metadata.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Agent name cannot exceed 100 characters',
        code: 'AGENT_NAME_TOO_LONG',
        severity: 'error'
      });
    }
    
    if (!metadata.description || metadata.description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Agent description is required',
        code: 'MISSING_DESCRIPTION',
        severity: 'error'
      });
    } else if (metadata.description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Agent description cannot exceed 500 characters',
        code: 'DESCRIPTION_TOO_LONG',
        severity: 'error'
      });
    }
    
    if (!metadata.status) {
      errors.push({
        field: 'status',
        message: 'Agent status is required',
        code: 'MISSING_STATUS',
        severity: 'error'
      });
    }
    
    if (!metadata.version) {
      errors.push({
        field: 'version',
        message: 'Agent version is required',
        code: 'MISSING_VERSION',
        severity: 'error'
      });
    }
    
    // Validate ULID string format
    if (metadata.agentId && !this.isValidUlidString(metadata.agentId)) {
      errors.push({
        field: 'agentId',
        message: 'Agent ID must be a valid ULID string',
        code: 'INVALID_ULID_STRING',
        severity: 'error'
      });
    }
  }
  
  /**
   * Validate personal mode specific fields
   */
  private validatePersonalModeFields(
    metadata: Partial<AgentMetadata>, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // In personal mode, organizational fields should not be set
    if (metadata.department) {
      warnings.push({
        field: 'department',
        message: 'Department field is not used in personal mode',
        code: 'UNUSED_DEPARTMENT_FIELD',
        suggestion: 'Use category field instead for personal mode organization'
      });
    }
    
    if (metadata.subDepartment) {
      warnings.push({
        field: 'subDepartment',
        message: 'SubDepartment field is not used in personal mode',
        code: 'UNUSED_SUBDEPARTMENT_FIELD'
      });
    }
    
    if (metadata.team) {
      warnings.push({
        field: 'team',
        message: 'Team field is not used in personal mode',
        code: 'UNUSED_TEAM_FIELD'
      });
    }
    
    if (metadata.position) {
      warnings.push({
        field: 'position',
        message: 'Position field is not used in personal mode',
        code: 'UNUSED_POSITION_FIELD'
      });
    }
    
    if (metadata.reportingTo) {
      warnings.push({
        field: 'reportingTo',
        message: 'Reporting relationships are not used in personal mode',
        code: 'UNUSED_REPORTING_FIELD'
      });
    }
    
    if (metadata.managedAgents && metadata.managedAgents.length > 0) {
      warnings.push({
        field: 'managedAgents',
        message: 'Management relationships are not used in personal mode',
        code: 'UNUSED_MANAGEMENT_FIELD'
      });
    }
    
    if (metadata.organizationLevel !== undefined) {
      warnings.push({
        field: 'organizationLevel',
        message: 'Organization level is not used in personal mode',
        code: 'UNUSED_ORG_LEVEL_FIELD'
      });
    }
    
    // Validate category field for personal mode
    if (metadata.category) {
      const validCategories = [
        'Finance', 'Health', 'Productivity', 'Education', 'Entertainment',
        'Communication', 'Research', 'Planning', 'Automation', 'Analysis'
      ];
      
      if (!validCategories.includes(metadata.category)) {
        warnings.push({
          field: 'category',
          message: `Category '${metadata.category}' is not a standard personal category`,
          code: 'NON_STANDARD_CATEGORY',
          suggestion: `Consider using one of: ${validCategories.join(', ')}`
        });
      }
    }
  }
  
  /**
   * Validate organizational mode specific fields
   */
  private validateOrganizationalModeFields(
    metadata: Partial<AgentMetadata>, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Department validation (department is an object with id, name, code)
    if (metadata.department) {
      if (!metadata.department.id || !metadata.department.name || !metadata.department.code) {
        errors.push({
          field: 'department',
          message: 'Department must have id, name, and code properties',
          code: 'INCOMPLETE_DEPARTMENT',
          severity: 'error'
        });
      } else {
        if (metadata.department.name.trim().length === 0) {
          errors.push({
            field: 'department',
            message: 'Department name cannot be empty',
            code: 'EMPTY_DEPARTMENT',
            severity: 'error'
          });
        }
        if (metadata.department.name.length > 50) {
          errors.push({
            field: 'department',
            message: 'Department name cannot exceed 50 characters',
            code: 'DEPARTMENT_NAME_TOO_LONG',
            severity: 'error'
          });
        }
      }
    }
    
    // SubDepartment validation
    if (metadata.subDepartment) {
      if (metadata.subDepartment.trim().length === 0) {
        errors.push({
          field: 'subDepartment',
          message: 'SubDepartment name cannot be empty if specified',
          code: 'EMPTY_SUBDEPARTMENT',
          severity: 'error'
        });
      }
      
      if (metadata.subDepartment.length > 50) {
        errors.push({
          field: 'subDepartment',
          message: 'SubDepartment name cannot exceed 50 characters',
          code: 'SUBDEPARTMENT_NAME_TOO_LONG',
          severity: 'error'
        });
      }
      
      // SubDepartment should have a department
      if (!metadata.department) {
        warnings.push({
          field: 'subDepartment',
          message: 'SubDepartment specified without a parent department',
          code: 'SUBDEPARTMENT_WITHOUT_DEPARTMENT',
          suggestion: 'Consider specifying the parent department for better organization'
        });
      }
    }
    
    // Team validation
    if (metadata.team) {
      if (metadata.team.trim().length === 0) {
        errors.push({
          field: 'team',
          message: 'Team name cannot be empty if specified',
          code: 'EMPTY_TEAM',
          severity: 'error'
        });
      }
      
      if (metadata.team.length > 50) {
        errors.push({
          field: 'team',
          message: 'Team name cannot exceed 50 characters',
          code: 'TEAM_NAME_TOO_LONG',
          severity: 'error'
        });
      }
      
      // Team should have a subdepartment or at least a department
      if (!metadata.subDepartment && !metadata.department) {
        warnings.push({
          field: 'team',
          message: 'Team specified without a parent subdepartment or department',
          code: 'TEAM_WITHOUT_PARENT',
          suggestion: 'Consider specifying the parent subdepartment and department for better organization'
        });
      }
    }
    
    // Position validation
    if (metadata.position && metadata.position.length > 100) {
      errors.push({
        field: 'position',
        message: 'Position title cannot exceed 100 characters',
        code: 'POSITION_TOO_LONG',
        severity: 'error'
      });
    }
    
    // Reporting relationship validation
    if (metadata.reportingTo && !this.isValidUlidString(metadata.reportingTo)) {
      errors.push({
        field: 'reportingTo',
        message: 'ReportingTo must be a valid agent ULID string',
        code: 'INVALID_REPORTING_ID',
        severity: 'error'
      });
    }
    
    // Managed agents validation
    if (metadata.managedAgents) {
      if (metadata.managedAgents.length > 50) {
        warnings.push({
          field: 'managedAgents',
          message: 'Managing more than 50 agents may impact performance',
          code: 'HIGH_MANAGEMENT_LOAD',
          suggestion: 'Consider creating sub-departments for better organization'
        });
      }
      
      // Validate each managed agent ID
      metadata.managedAgents.forEach((agentId, index) => {
        if (!this.isValidUlidString(agentId)) {
          errors.push({
            field: `managedAgents[${index}]`,
            message: `Managed agent ID at index ${index} is not a valid StructuredId`,
            code: 'INVALID_MANAGED_AGENT_ID',
            severity: 'error'
          });
        }
      });
    }
    
    // Organization level validation
    if (metadata.organizationLevel !== undefined) {
      if (metadata.organizationLevel < 0 || metadata.organizationLevel > 10) {
        errors.push({
          field: 'organizationLevel',
          message: 'Organization level must be between 0 and 10',
          code: 'INVALID_ORG_LEVEL',
          severity: 'error'
        });
      }
    }
    
    // Category field in organizational mode
    if (metadata.category) {
      warnings.push({
        field: 'category',
        message: 'Category field is primarily for personal mode',
        code: 'CATEGORY_IN_ORG_MODE',
        suggestion: 'Use department field for organizational categorization'
      });
    }
  }
  
  /**
   * Validate field consistency and logical relationships
   */
  private validateFieldConsistency(
    metadata: Partial<AgentMetadata>, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Self-reference check
    if (metadata.reportingTo && metadata.agentId && 
        this.ulidStringsEqual(metadata.reportingTo, metadata.agentId)) {
      errors.push({
        field: 'reportingTo',
        message: 'Agent cannot report to themselves',
        code: 'SELF_REPORTING',
        severity: 'error'
      });
    }
    
    // Check if agent appears in their own managed agents list
    if (metadata.managedAgents && metadata.agentId) {
      const selfManaged = metadata.managedAgents.some(id => 
        this.ulidStringsEqual(id, metadata.agentId!)
      );
      
      if (selfManaged) {
        errors.push({
          field: 'managedAgents',
          message: 'Agent cannot manage themselves',
          code: 'SELF_MANAGEMENT',
          severity: 'error'
        });
      }
    }
    
    // Performance metrics validation
    if (metadata.performanceMetrics) {
      const metrics = metadata.performanceMetrics;
      
      if (metrics.successRate < 0 || metrics.successRate > 1) {
        errors.push({
          field: 'performanceMetrics.successRate',
          message: 'Success rate must be between 0 and 1',
          code: 'INVALID_SUCCESS_RATE',
          severity: 'error'
        });
      }
      
      if (metrics.taskCompletionRate < 0 || metrics.taskCompletionRate > 1) {
        errors.push({
          field: 'performanceMetrics.taskCompletionRate',
          message: 'Task completion rate must be between 0 and 1',
          code: 'INVALID_COMPLETION_RATE',
          severity: 'error'
        });
      }
      
      if (metrics.averageResponseTime < 0) {
        errors.push({
          field: 'performanceMetrics.averageResponseTime',
          message: 'Average response time cannot be negative',
          code: 'NEGATIVE_RESPONSE_TIME',
          severity: 'error'
        });
      }
    }
  }
  
  /**
   * Validate performance constraints and provide optimization suggestions
   */
  private validatePerformanceConstraints(
    metadata: Partial<AgentMetadata>, 
    warnings: ValidationWarning[]
  ): void {
    // Check for potentially expensive operations
    if (metadata.domain && metadata.domain.length > 20) {
      warnings.push({
        field: 'domain',
        message: 'Large number of domains may impact query performance',
        code: 'HIGH_DOMAIN_COUNT',
        suggestion: 'Consider consolidating related domains'
      });
    }
    
    if (metadata.specialization && metadata.specialization.length > 15) {
      warnings.push({
        field: 'specialization',
        message: 'Large number of specializations may impact matching performance',
        code: 'HIGH_SPECIALIZATION_COUNT',
        suggestion: 'Focus on core specializations for better performance'
      });
    }
    
    if (metadata.contentSummary && metadata.contentSummary.length > 1000) {
      warnings.push({
        field: 'contentSummary',
        message: 'Very long content summary may impact retrieval performance',
        code: 'LONG_CONTENT_SUMMARY',
        suggestion: 'Keep content summary under 500 characters for optimal performance'
      });
    }
  }
  
  /**
   * Validate ULID string format
   */
  private isValidUlidString(id: string): boolean {
    // ULID format: namespace:type:ulid_string
    const parts = id.split(':');
    return parts.length >= 3 && Boolean(parts[0]) && Boolean(parts[1]) && Boolean(parts[2]);
  }
  
  /**
   * Compare two ULID strings for equality
   */
  private ulidStringsEqual(id1: string, id2: string): boolean {
    return id1 === id2;
  }
  
  /**
   * Static method to create validator with dependencies
   */
  public static create(platformConfig?: PlatformConfigService): AgentSchemaValidator {
    return new AgentSchemaValidator(platformConfig);
  }
} 