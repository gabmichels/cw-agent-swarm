/**
 * Tool Validation Service Interface
 * 
 * Interface for comprehensive tool validation including parameters,
 * permissions, capabilities, and execution context validation.
 * Provides both pre-execution and post-execution validation capabilities.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Comprehensive validation coverage
 * - Performance-optimized validation
 * - Structured error reporting
 * - Security-first validation approach
 */

import {
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ValidationResult
} from '../types/FoundationTypes';
import { ToolCapability } from '../enums/ToolEnums';

/**
 * Interface for the tool validation service
 * 
 * Provides comprehensive validation capabilities for tools, parameters,
 * execution contexts, and dependencies with detailed error reporting.
 */
export interface IToolValidationService {
  // ==================== Tool Definition Validation ====================

  /**
   * Validate a tool definition for registration
   * @param definition Tool definition to validate
   * @returns Comprehensive validation result
   */
  validateToolDefinition(definition: UnifiedToolDefinition): Promise<ValidationResult>;

  /**
   * Validate tool metadata and configuration
   * @param tool Tool to validate metadata for
   * @returns Validation result for metadata
   */
  validateToolMetadata(tool: UnifiedToolDefinition): Promise<ValidationResult>;

  /**
   * Validate tool parameter schema
   * @param schema Parameter schema to validate
   * @returns Validation result for schema
   */
  validateParameterSchema(schema: ToolParameterSchema): Promise<ValidationResult>;

  /**
   * Validate tool executor function
   * @param executor Executor function to validate
   * @param toolName Tool name for error context
   * @returns Validation result for executor
   */
  validateToolExecutor(
    executor: Function,
    toolName: string
  ): Promise<ValidationResult>;

  // ==================== Parameter Validation ====================

  /**
   * Validate tool parameters against schema
   * @param parameters Parameters to validate
   * @param schema Parameter schema to validate against
   * @param toolName Tool name for error context
   * @returns Detailed parameter validation result
   */
  validateParameters(
    parameters: ToolParameters,
    schema: ToolParameterSchema,
    toolName: string
  ): Promise<{
    readonly valid: boolean;
    readonly errors: readonly {
      readonly parameter: string;
      readonly error: string;
      readonly expectedType: string;
      readonly actualType: string;
      readonly value?: unknown;
    }[];
    readonly warnings: readonly {
      readonly parameter: string;
      readonly warning: string;
      readonly suggestion?: string;
    }[];
  }>;

  /**
   * Validate individual parameter value
   * @param paramName Parameter name
   * @param value Parameter value
   * @param paramSchema Parameter schema definition
   * @returns Validation result for single parameter
   */
  validateParameter(
    paramName: string,
    value: unknown,
    paramSchema: {
      readonly type: string;
      readonly required: boolean;
      readonly validation?: Record<string, unknown>;
    }
  ): Promise<{
    readonly valid: boolean;
    readonly error?: string;
    readonly warning?: string;
    readonly suggestion?: string;
  }>;

  /**
   * Validate parameter types and constraints
   * @param parameters Parameters to validate
   * @param schema Parameter schema
   * @returns Type validation result
   */
  validateParameterTypes(
    parameters: ToolParameters,
    schema: ToolParameterSchema
  ): Promise<{
    readonly valid: boolean;
    readonly typeErrors: readonly {
      readonly parameter: string;
      readonly expected: string;
      readonly actual: string;
    }[];
    readonly constraintErrors: readonly {
      readonly parameter: string;
      readonly constraint: string;
      readonly value: unknown;
    }[];
  }>;

  // ==================== Context Validation ====================

  /**
   * Validate execution context for tool execution
   * @param context Execution context to validate
   * @param tool Tool that will be executed
   * @returns Context validation result
   */
  validateExecutionContext(
    context: ExecutionContext,
    tool: UnifiedToolDefinition
  ): Promise<{
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly missingPermissions: readonly string[];
    readonly missingCapabilities: readonly ToolCapability[];
  }>;

  /**
   * Validate user permissions for tool execution
   * @param context Execution context with user permissions
   * @param requiredPermissions Required permissions for tool
   * @returns Permission validation result
   */
  validatePermissions(
    context: ExecutionContext,
    requiredPermissions: readonly string[]
  ): Promise<{
    readonly valid: boolean;
    readonly missingPermissions: readonly string[];
    readonly availablePermissions: readonly string[];
  }>;

  /**
   * Validate agent capabilities for tool execution
   * @param context Execution context with agent capabilities
   * @param requiredCapabilities Required capabilities for tool
   * @returns Capability validation result
   */
  validateCapabilities(
    context: ExecutionContext,
    requiredCapabilities: readonly ToolCapability[]
  ): Promise<{
    readonly valid: boolean;
    readonly missingCapabilities: readonly ToolCapability[];
    readonly availableCapabilities: readonly ToolCapability[];
  }>;

  // ==================== Dependency Validation ====================

  /**
   * Validate tool dependencies are available
   * @param tool Tool to validate dependencies for
   * @param context Execution context
   * @returns Dependency validation result
   */
  validateDependencies(
    tool: UnifiedToolDefinition,
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly missingDependencies: readonly {
      readonly name: string;
      readonly type: 'service' | 'tool' | 'capability' | 'permission';
      readonly required: boolean;
    }[];
    readonly availableDependencies: readonly string[];
  }>;

  /**
   * Validate service dependencies
   * @param requiredServices Required service dependencies
   * @param context Execution context
   * @returns Service dependency validation result
   */
  validateServiceDependencies(
    requiredServices: readonly string[],
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly missingServices: readonly string[];
    readonly availableServices: readonly string[];
  }>;

  /**
   * Validate tool chain dependencies
   * @param toolChain Array of tools to execute in sequence
   * @param context Execution context
   * @returns Tool chain validation result
   */
  validateToolChain(
    toolChain: readonly ToolIdentifier[],
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly issues: readonly {
      readonly toolId: ToolIdentifier;
      readonly issue: string;
      readonly severity: 'error' | 'warning';
    }[];
    readonly suggestions: readonly string[];
  }>;

  // ==================== Security Validation ====================

  /**
   * Validate tool security requirements
   * @param tool Tool to validate security for
   * @param context Execution context
   * @returns Security validation result
   */
  validateSecurity(
    tool: UnifiedToolDefinition,
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly securityIssues: readonly {
      readonly issue: string;
      readonly severity: 'low' | 'medium' | 'high' | 'critical';
      readonly recommendation: string;
    }[];
    readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;

  /**
   * Validate parameter security (check for injection attacks, etc.)
   * @param parameters Parameters to validate for security
   * @param schema Parameter schema with security rules
   * @returns Security validation result for parameters
   */
  validateParameterSecurity(
    parameters: ToolParameters,
    schema: ToolParameterSchema
  ): Promise<{
    readonly valid: boolean;
    readonly securityIssues: readonly {
      readonly parameter: string;
      readonly issue: string;
      readonly severity: 'low' | 'medium' | 'high' | 'critical';
      readonly value?: string;
    }[];
  }>;

  // ==================== Performance Validation ====================

  /**
   * Validate tool performance requirements
   * @param tool Tool to validate performance for
   * @param context Execution context
   * @returns Performance validation result
   */
  validatePerformance(
    tool: UnifiedToolDefinition,
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly performanceIssues: readonly {
      readonly issue: string;
      readonly impact: 'low' | 'medium' | 'high';
      readonly recommendation: string;
    }[];
    readonly estimatedExecutionTime: number;
    readonly resourceRequirements: {
      readonly memory: number;
      readonly cpu: number;
      readonly network: boolean;
    };
  }>;

  /**
   * Validate execution timeout requirements
   * @param tool Tool to validate timeout for
   * @param requestedTimeout Requested timeout in milliseconds
   * @returns Timeout validation result
   */
  validateTimeout(
    tool: UnifiedToolDefinition,
    requestedTimeout: number
  ): Promise<{
    readonly valid: boolean;
    readonly recommendedTimeout: number;
    readonly reason?: string;
  }>;

  // ==================== Batch Validation ====================

  /**
   * Validate multiple tools for batch execution
   * @param tools Array of tools to validate
   * @param context Shared execution context
   * @returns Batch validation result
   */
  validateToolBatch(
    tools: readonly UnifiedToolDefinition[],
    context: ExecutionContext
  ): Promise<{
    readonly valid: boolean;
    readonly toolResults: readonly {
      readonly toolId: ToolIdentifier;
      readonly valid: boolean;
      readonly errors: readonly string[];
      readonly warnings: readonly string[];
    }[];
    readonly batchIssues: readonly string[];
  }>;

  // ==================== Validation Configuration ====================

  /**
   * Configure validation settings
   * @param settings Validation configuration settings
   */
  configureValidation(settings: {
    readonly strictMode?: boolean;
    readonly securityLevel?: 'low' | 'medium' | 'high' | 'strict';
    readonly performanceChecks?: boolean;
    readonly dependencyChecks?: boolean;
    readonly customValidators?: Record<string, Function>;
  }): void;

  /**
   * Get current validation configuration
   * @returns Current validation settings
   */
  getValidationConfig(): {
    readonly strictMode: boolean;
    readonly securityLevel: 'low' | 'medium' | 'high' | 'strict';
    readonly performanceChecks: boolean;
    readonly dependencyChecks: boolean;
    readonly customValidators: readonly string[];
  };

  // ==================== Service Management ====================

  /**
   * Initialize the validation service
   * @returns True if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the validation service gracefully
   * @returns True if shutdown was successful
   */
  shutdown(): Promise<boolean>;

  /**
   * Check if validation service is healthy
   * @returns True if service is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get validation service performance metrics
   * @returns Service performance metrics
   */
  getValidationMetrics(): Promise<{
    readonly totalValidations: number;
    readonly successfulValidations: number;
    readonly failedValidations: number;
    readonly averageValidationTime: number;
    readonly validationsByType: Record<string, number>;
  }>;
} 