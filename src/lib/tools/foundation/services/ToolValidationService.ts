/**
 * Tool Validation Service Implementation
 * 
 * Provides comprehensive validation capabilities for tool definitions,
 * parameters, execution contexts, and security requirements.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic identifiers
 * - Dependency injection throughout
 * - Interface-first design
 * - Structured error handling
 */

import { IToolValidationService } from '../interfaces/ToolValidationServiceInterface';
import { IStructuredLogger } from '@/lib/logging/interfaces/IStructuredLogger';
import {
  UnifiedToolDefinition,
  UnifiedTool,
  ToolParameters,
  ExecutionContext,
  ValidationResult,
  ToolParameterSchema,
  ParameterValidationError,
  ParameterValidationWarning,
  SecurityIssue,
  PerformanceIssue,
  ResourceRequirements
} from '../types/FoundationTypes';
import { ulid } from 'ulid';
import { ToolCapability } from '../enums/ToolEnums';
import { ToolValidationError } from '../errors/ToolFoundationErrors';

/**
 * Tool Validation Service Implementation
 */
export class ToolValidationService {
  constructor(
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Validate tool definition
   */
  async validateToolDefinition(definition: UnifiedToolDefinition): Promise<ValidationResult> {
    const operationId = ulid();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.info('Starting tool definition validation', {
        operationId,
        toolName: definition.name,
        timestamp: new Date().toISOString()
      });

      // Required field validation
      if (!definition.id || definition.id.trim() === '') {
        errors.push('Tool ID is required');
      }

      if (!definition.name || definition.name.trim() === '') {
        errors.push('Tool name is required');
      }

      if (!definition.displayName || definition.displayName.trim() === '') {
        errors.push('Tool display name is required');
      }

      if (!definition.description || definition.description.trim() === '') {
        errors.push('Tool description is required');
      }

      if (!definition.category) {
        errors.push('Tool category is required');
      }

      if (!definition.capabilities || definition.capabilities.length === 0) {
        warnings.push('Tool has no capabilities defined');
      }

      if (!definition.executor || typeof definition.executor !== 'function') {
        errors.push('Tool executor function is required');
      }

      // Parameter schema validation
      if (definition.parameters) {
        const paramValidation = await this.validateParameterSchema(definition.parameters);
        if (!paramValidation.isValid) {
          errors.push(...paramValidation.errors);
          warnings.push(...paramValidation.warnings);
        }
      }

      // Metadata validation
      if (definition.metadata) {
        if (!definition.metadata.provider) {
          warnings.push('Tool provider not specified in metadata');
        }

        if (!definition.metadata.version) {
          warnings.push('Tool version not specified in metadata');
        }
      }

      // Name format validation
      if (definition.name && !/^[a-z][a-z0-9_]*$/.test(definition.name)) {
        errors.push('Tool name must start with lowercase letter and contain only lowercase letters, numbers, and underscores');
      }

      const isValid = errors.length === 0;

      this.logger.info('Tool definition validation completed', {
        operationId,
        toolName: definition.name,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Tool definition validation failed', {
        operationId,
        toolName: definition.name,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      };
    }
  }

  /**
   * Validate tool parameters
   */
  async validateParameters(
    parameters: ToolParameters,
    schema: ToolParameterSchema,
    toolName: string
  ): Promise<{
    readonly valid: boolean;
    readonly errors: readonly ParameterValidationError[];
    readonly warnings: readonly ParameterValidationWarning[];
  }> {
    const errors: ParameterValidationError[] = [];
    const warnings: ParameterValidationWarning[] = [];

    try {
      // Validate required parameters
      if (schema.required) {
        for (const requiredParam of schema.required) {
          if (!(requiredParam in parameters)) {
            errors.push({
              parameter: requiredParam,
              error: 'Required parameter is missing',
              expectedType: schema.properties?.[requiredParam]?.type || 'unknown',
              actualType: 'undefined'
            });
          }
        }
      }

      // Validate parameter types and constraints
      if (schema.properties) {
        for (const [paramName, paramValue] of Object.entries(parameters)) {
          const paramSchema = schema.properties[paramName];
          if (!paramSchema) {
            warnings.push({
              parameter: paramName,
              warning: 'Parameter not defined in schema',
              suggestion: 'Remove unused parameter or update schema'
            });
            continue;
          }

          // Type validation
          const actualType = typeof paramValue;
          const expectedType = paramSchema.type;

          if (expectedType && actualType !== expectedType) {
            errors.push({
              parameter: paramName,
              error: `Type mismatch`,
              expectedType,
              actualType,
              value: paramValue
            });
          }

          // Additional validations (length, range, etc.)
          if (paramSchema.minLength && typeof paramValue === 'string' && paramValue.length < paramSchema.minLength) {
            errors.push({
              parameter: paramName,
              error: `String too short (minimum: ${paramSchema.minLength})`,
              expectedType: `string(min:${paramSchema.minLength})`,
              actualType: `string(${paramValue.length})`,
              value: paramValue
            });
          }

          if (paramSchema.maxLength && typeof paramValue === 'string' && paramValue.length > paramSchema.maxLength) {
            errors.push({
              parameter: paramName,
              error: `String too long (maximum: ${paramSchema.maxLength})`,
              expectedType: `string(max:${paramSchema.maxLength})`,
              actualType: `string(${paramValue.length})`,
              value: paramValue
            });
          }
        }
      }

      const result = {
        valid: errors.length === 0,
        errors: errors as readonly ParameterValidationError[],
        warnings: warnings as readonly ParameterValidationWarning[]
      };

      await this.logger.info('Parameter validation completed', {
        toolName,
        parameterCount: Object.keys(parameters).length,
        errorCount: errors.length,
        warningCount: warnings.length,
        valid: result.valid
      });

      return result;

    } catch (error) {
      const validationError = new ToolValidationError(
        `Parameter validation failed for tool '${toolName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          toolName,
          validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
          validationWarnings: [],
          invalidFields: Object.keys(parameters)
        }
      );

      await this.logger.error('Parameter validation error', validationError);
      throw validationError;
    }
  }

  /**
   * Validate execution context
   */
  async validateExecutionContext(
    context: ExecutionContext,
    tool: UnifiedToolDefinition
  ): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly missingPermissions: readonly string[];
    readonly missingCapabilities: readonly ToolCapability[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingPermissions: string[] = [];
    const missingCapabilities: ToolCapability[] = [];

    try {
      // Validate required permissions
      if (tool.permissions && tool.permissions.length > 0) {
        const userPermissions = context.permissions || [];
        for (const requiredPermission of tool.permissions) {
          if (!userPermissions.includes(requiredPermission)) {
            missingPermissions.push(requiredPermission);
          }
        }
      }

      // Validate required capabilities
      if (tool.capabilities && tool.capabilities.length > 0) {
        const contextCapabilities = context.capabilities || [];
        for (const requiredCapability of tool.capabilities) {
          if (!contextCapabilities.includes(requiredCapability)) {
            missingCapabilities.push(requiredCapability);
          }
        }
      }

      // Validate user context
      if (!context.userId) {
        errors.push('User ID is required in execution context');
      }

      // Validate workspace context if required
      if (tool.requiresWorkspace && !context.workspaceId) {
        errors.push('Workspace ID is required for this tool');
      }

      // Add errors for missing permissions/capabilities
      if (missingPermissions.length > 0) {
        errors.push(`Missing required permissions: ${missingPermissions.join(', ')}`);
      }

      if (missingCapabilities.length > 0) {
        errors.push(`Missing required capabilities: ${missingCapabilities.join(', ')}`);
      }

      const result = {
        valid: errors.length === 0,
        errors: errors as readonly string[],
        warnings: warnings as readonly string[],
        missingPermissions: missingPermissions as readonly string[],
        missingCapabilities: missingCapabilities as readonly ToolCapability[]
      };

      await this.logger.info('Execution context validation completed', {
        toolName: tool.name,
        valid: result.valid,
        errorCount: errors.length,
        missingPermissionsCount: missingPermissions.length,
        missingCapabilitiesCount: missingCapabilities.length
      });

      return result;

    } catch (error) {
      const validationError = new ToolValidationError(
        `Execution context validation failed for tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          toolName: tool.name,
          validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
          validationWarnings: [],
          invalidFields: ['context']
        }
      );

      await this.logger.error('Execution context validation error', validationError);
      throw validationError;
    }
  }

  /**
   * Validate parameter schema
   */
  async validateParameterSchema(schema: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic schema structure validation
      if (!schema.type && !schema.properties) {
        errors.push('Parameter schema must have either type or properties defined');
      }

      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (typeof propSchema !== 'object') {
            errors.push(`Property '${propName}' schema must be an object`);
            continue;
          }

          const propSchemaObj = propSchema as Record<string, any>;
          if (!propSchemaObj.type) {
            warnings.push(`Property '${propName}' has no type specified`);
          }

          // Validate type values
          const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
          if (propSchemaObj.type && !validTypes.includes(propSchemaObj.type)) {
            errors.push(`Property '${propName}' has invalid type: ${propSchemaObj.type}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      };
    }
  }

  /**
   * Validate tool security requirements
   */
  async validateSecurity(
    tool: UnifiedToolDefinition,
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly securityIssues: readonly SecurityIssue[];
    readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const securityIssues: SecurityIssue[] = [];

    try {
      // Check for sensitive operations
      if (tool.name.toLowerCase().includes('delete') || tool.name.toLowerCase().includes('remove')) {
        securityIssues.push({
          issue: 'Tool performs destructive operations',
          severity: 'high',
          recommendation: 'Ensure proper backup and confirmation mechanisms'
        });
      }

      // Check for external network access
      if (tool.capabilities?.includes(ToolCapability.INTEGRATE)) {
        securityIssues.push({
          issue: 'Tool requires external network access',
          severity: 'medium',
          recommendation: 'Validate all external connections and use secure protocols'
        });
      }

      // Check for file system access
      if (tool.capabilities?.includes(ToolCapability.FILE_MANAGEMENT)) {
        securityIssues.push({
          issue: 'Tool requires file system access',
          severity: 'medium',
          recommendation: 'Restrict access to necessary directories only'
        });
      }

      // Determine risk level
      const criticalIssues = securityIssues.filter(issue => issue.severity === 'critical').length;
      const highIssues = securityIssues.filter(issue => issue.severity === 'high').length;
      const mediumIssues = securityIssues.filter(issue => issue.severity === 'medium').length;

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (criticalIssues > 0) {
        riskLevel = 'critical';
      } else if (highIssues > 0) {
        riskLevel = 'high';
      } else if (mediumIssues > 0) {
        riskLevel = 'medium';
      }

      const result = {
        valid: criticalIssues === 0 && highIssues === 0,
        securityIssues: securityIssues as readonly SecurityIssue[],
        riskLevel
      };

      await this.logger.info('Security validation completed', {
        toolName: tool.name,
        riskLevel,
        issueCount: securityIssues.length,
        valid: result.valid
      });

      return result;

    } catch (error) {
      const validationError = new ToolValidationError(
        `Security validation failed for tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          toolName: tool.name,
          validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
          validationWarnings: [],
          invalidFields: ['security']
        }
      );

      await this.logger.error('Security validation error', validationError);
      throw validationError;
    }
  }

  /**
   * Validate tool performance requirements
   */
  async validatePerformance(
    tool: UnifiedToolDefinition,
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly performanceIssues: readonly PerformanceIssue[];
    readonly estimatedExecutionTime: number;
    readonly resourceRequirements: ResourceRequirements;
  }> {
    const performanceIssues: PerformanceIssue[] = [];

    try {
      // Estimate execution time based on tool complexity
      let estimatedExecutionTime = 1000; // Base 1 second

      if (tool.capabilities?.includes(ToolCapability.DATA_PROCESSING)) {
        estimatedExecutionTime += 2000;
      }

      if (tool.capabilities?.includes(ToolCapability.INTEGRATE)) {
        estimatedExecutionTime += 3000; // Network calls
      }

      if (tool.capabilities?.includes(ToolCapability.ANALYTICS)) {
        estimatedExecutionTime += 5000; // Complex calculations
      }

      // Check for performance concerns
      if (estimatedExecutionTime > 10000) {
        performanceIssues.push({
          issue: 'Tool has high estimated execution time',
          impact: 'high',
          recommendation: 'Consider implementing timeout and progress tracking'
        });
      }

      // Estimate resource requirements
      const resourceRequirements: ResourceRequirements = {
        memory: tool.capabilities?.length ? tool.capabilities.length * 10 : 10, // MB
        cpu: tool.capabilities?.includes(ToolCapability.ANALYTICS) ? 80 : 20, // Percentage
        network: tool.capabilities?.includes(ToolCapability.INTEGRATE) || false,
        storage: tool.capabilities?.includes(ToolCapability.FILE_MANAGEMENT) ? 100 : 1 // MB
      };

      // Check resource constraints
      if (resourceRequirements.memory > 100) {
        performanceIssues.push({
          issue: 'High memory requirements',
          impact: 'medium',
          recommendation: 'Monitor memory usage and implement cleanup'
        });
      }

      if (resourceRequirements.cpu > 50) {
        performanceIssues.push({
          issue: 'High CPU requirements',
          impact: 'medium',
          recommendation: 'Consider implementing execution throttling'
        });
      }

      const result = {
        valid: performanceIssues.filter(issue => issue.impact === 'high').length === 0,
        performanceIssues: performanceIssues as readonly PerformanceIssue[],
        estimatedExecutionTime,
        resourceRequirements
      };

      await this.logger.info('Performance validation completed', {
        toolName: tool.name,
        estimatedExecutionTime,
        issueCount: performanceIssues.length,
        valid: result.valid
      });

      return result;

    } catch (error) {
      const validationError = new ToolValidationError(
        `Performance validation failed for tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          toolName: tool.name,
          validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
          validationWarnings: [],
          invalidFields: ['performance']
        }
      );

      await this.logger.error('Performance validation error', validationError);
      throw validationError;
    }
  }
} 