/**
 * Organization-specific error types following implementation guidelines
 * 
 * This module provides a hierarchy of custom error types for organization
 * operations with context information and structured error codes.
 */

import { AppError } from './base';

/**
 * Base error class for all organization-related errors
 */
export class OrganizationError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `ORGANIZATION_${code}`, context);
    this.name = 'OrganizationError';
    Object.setPrototypeOf(this, OrganizationError.prototype);
  }
}

/**
 * Error thrown when department operations fail
 */
export class DepartmentError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `DEPARTMENT_${code}`, context);
    this.name = 'DepartmentError';
    Object.setPrototypeOf(this, DepartmentError.prototype);
  }
}

/**
 * Error thrown when department is not found
 */
export class DepartmentNotFoundError extends DepartmentError {
  constructor(departmentId: string, context: Record<string, unknown> = {}) {
    super(
      `Department not found: ${departmentId}`,
      'NOT_FOUND',
      { departmentId, ...context }
    );
    this.name = 'DepartmentNotFoundError';
    Object.setPrototypeOf(this, DepartmentNotFoundError.prototype);
  }
}

/**
 * Error thrown when department already exists
 */
export class DepartmentAlreadyExistsError extends DepartmentError {
  constructor(departmentName: string, context: Record<string, unknown> = {}) {
    super(
      `Department already exists: ${departmentName}`,
      'ALREADY_EXISTS',
      { departmentName, ...context }
    );
    this.name = 'DepartmentAlreadyExistsError';
    Object.setPrototypeOf(this, DepartmentAlreadyExistsError.prototype);
  }
}

/**
 * Error thrown when hierarchy operations fail
 */
export class HierarchyError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `HIERARCHY_${code}`, context);
    this.name = 'HierarchyError';
    Object.setPrototypeOf(this, HierarchyError.prototype);
  }
}

/**
 * Error thrown when circular dependencies are detected in hierarchy
 */
export class CircularDependencyError extends HierarchyError {
  constructor(path: string[], context: Record<string, unknown> = {}) {
    super(
      `Circular dependency detected in hierarchy: ${path.join(' -> ')}`,
      'CIRCULAR_DEPENDENCY',
      { path, ...context }
    );
    this.name = 'CircularDependencyError';
    Object.setPrototypeOf(this, CircularDependencyError.prototype);
  }
}

/**
 * Error thrown when agent template operations fail
 */
export class AgentTemplateError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `TEMPLATE_${code}`, context);
    this.name = 'AgentTemplateError';
    Object.setPrototypeOf(this, AgentTemplateError.prototype);
  }
}

/**
 * Error thrown when template is not found
 */
export class TemplateNotFoundError extends AgentTemplateError {
  constructor(templateId: string, context: Record<string, unknown> = {}) {
    super(
      `Agent template not found: ${templateId}`,
      'NOT_FOUND',
      { templateId, ...context }
    );
    this.name = 'TemplateNotFoundError';
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}

/**
 * Error thrown when template validation fails
 */
export class TemplateValidationError extends AgentTemplateError {
  constructor(
    validationErrors: string[],
    templateId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Template validation failed: ${validationErrors.join(', ')}`,
      'VALIDATION_FAILED',
      { validationErrors, templateId, ...context }
    );
    this.name = 'TemplateValidationError';
    Object.setPrototypeOf(this, TemplateValidationError.prototype);
  }
}

/**
 * Error thrown when agent is not found
 */
export class AgentNotFoundError extends OrganizationError {
  constructor(agentId: string, context: Record<string, unknown> = {}) {
    super(
      `Agent not found: ${agentId}`,
      'AGENT_NOT_FOUND',
      { agentId, ...context }
    );
    this.name = 'AgentNotFoundError';
    Object.setPrototypeOf(this, AgentNotFoundError.prototype);
  }
}

/**
 * Error thrown when agent spawning operations fail
 */
export class AgentSpawningError extends OrganizationError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `SPAWNING_${code}`, context);
    this.name = 'AgentSpawningError';
    Object.setPrototypeOf(this, AgentSpawningError.prototype);
  }
}

/**
 * Error thrown when platform mode is invalid for operation
 */
export class InvalidPlatformModeError extends OrganizationError {
  constructor(
    operation: string,
    currentMode: string,
    requiredMode: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Operation '${operation}' requires platform mode '${requiredMode}' but current mode is '${currentMode}'`,
      'INVALID_PLATFORM_MODE',
      { operation, currentMode, requiredMode, ...context }
    );
    this.name = 'InvalidPlatformModeError';
    Object.setPrototypeOf(this, InvalidPlatformModeError.prototype);
  }
} 