/**
 * Agent Configuration Orchestrator
 * 
 * This module provides a configuration orchestrator that handles agent-level
 * configuration management and dependency resolution between managers.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseManager } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { AgentBase } from '../base/AgentBase.interface';
import { ConfigSchema, ValidationOptions, ValidationResult, ConfigPropertySchema } from '../../../lib/config/types';
import { createConfigFactory, ConfigDefaultsProvider } from '../../../lib/config/factory';
import { ConfigValidationError, ValidationError } from '../../../lib/config/errors';

/**
 * Configuration dependency metadata
 */
export interface ConfigDependency {
  /** Source manager type */
  sourceManager: string;
  
  /** Source property path */
  sourceProperty: string;
  
  /** Target manager type */
  targetManager: string;
  
  /** Target property path */
  targetProperty: string;
  
  /** Whether this dependency is required for the target manager to function */
  required: boolean;
  
  /** Transformation function to apply to the source value */
  transform?: (value: unknown) => unknown;
  
  /** Validation function to verify the transformed value is valid for the target */
  validate?: (value: unknown) => boolean;
}

/**
 * Configuration verification result
 */
export interface ConfigVerificationResult {
  /** Whether the verification was successful */
  success: boolean;
  
  /** Errors encountered during verification */
  errors?: ValidationError[];
  
  /** Managers with conflicting configurations */
  conflicts?: Array<{
    managerType: string;
    property: string;
    value: unknown;
    conflictsWith: {
      managerType: string;
      property: string;
      value: unknown;
    };
  }>;
  
  /** Configuration dependencies that couldn't be satisfied */
  unsatisfiedDependencies?: Array<{
    dependency: ConfigDependency;
    reason: string;
  }>;
}

/**
 * Agent-level configuration schema
 */
export interface AgentConfigSchema {
  general: ConfigSchema<Record<string, unknown>>;
  managers: Record<string, ConfigSchema<Record<string, unknown>>>;
}

/**
 * Agent configuration orchestrator
 * 
 * Handles agent-level configuration orchestration and dependency resolution
 */
export class AgentConfigOrchestrator {
  private readonly agent: AgentBase;
  private readonly managers: Record<ManagerType, BaseManager>;
  private readonly configSchema: AgentConfigSchema;
  private dependencies: ConfigDependency[] = [];
  private readonly configFactory: ReturnType<typeof createConfigFactory>;
  
  /**
   * Create a new configuration orchestrator
   * @param agent The agent to manage configuration for
   * @param managers The managers to manage configuration for
   * @param configSchema The agent configuration schema
   */
  constructor(
    agent: AgentBase,
    managers: BaseManager[],
    configSchema: AgentConfigSchema
  ) {
    this.agent = agent;
    this.managers = this.buildManagerMap(managers);
    this.configSchema = configSchema;
    this.configFactory = createConfigFactory(configSchema.general);
  }
  
  /**
   * Register a configuration dependency
   * @param dependency The dependency to register
   * @returns The orchestrator instance for chaining
   */
  registerDependency(dependency: ConfigDependency): AgentConfigOrchestrator {
    this.dependencies.push(dependency);
    return this;
  }
  
  /**
   * Register multiple configuration dependencies
   * @param dependencies The dependencies to register
   * @returns The orchestrator instance for chaining
   */
  registerDependencies(dependencies: ConfigDependency[]): AgentConfigOrchestrator {
    this.dependencies.push(...dependencies);
    return this;
  }
  
  /**
   * Get all registered dependencies
   * @returns The registered dependencies
   */
  getDependencies(): ConfigDependency[] {
    return [...this.dependencies];
  }
  
  /**
   * Get dependencies for a specific manager
   * @param managerType The manager type to get dependencies for
   * @returns Dependencies where the manager is the source or target
   */
  getDependenciesForManager(managerType: string): ConfigDependency[] {
    return this.dependencies.filter(
      dep => dep.sourceManager === managerType || dep.targetManager === managerType
    );
  }
  
  /**
   * Get incoming dependencies for a manager
   * @param managerType The manager type to get dependencies for
   * @returns Dependencies where the manager is the target
   */
  getIncomingDependencies(managerType: string): ConfigDependency[] {
    return this.dependencies.filter(dep => dep.targetManager === managerType);
  }
  
  /**
   * Get outgoing dependencies for a manager
   * @param managerType The manager type to get dependencies for
   * @returns Dependencies where the manager is the source
   */
  getOutgoingDependencies(managerType: string): ConfigDependency[] {
    return this.dependencies.filter(dep => dep.sourceManager === managerType);
  }
  
  /**
   * Apply registered dependencies to the agent's managers
   * @returns Object mapping manager types to their applied dependencies
   */
  applyDependencies(): Record<string, ConfigDependency[]> {
    const result: Record<string, ConfigDependency[]> = {};
    const managers = this.getManagersMap();
    
    // Process dependencies in order
    for (const dependency of this.dependencies) {
      const { sourceManager, sourceProperty, targetManager, targetProperty } = dependency;
      
      // Get the source and target managers
      const source = managers[sourceManager];
      const target = managers[targetManager];
      
      if (!source || !target) {
        console.warn(`Cannot apply dependency: ${sourceManager}.${sourceProperty} -> ${targetManager}.${targetProperty}`);
        continue;
      }
      
      try {
        // Get the source configuration
        const sourceConfig = source.getConfig();
        
        // Get the source value
        const sourceValue = this.getPropertyValue(sourceConfig, sourceProperty);
        
        if (sourceValue === undefined && dependency.required) {
          console.warn(`Required dependency source value not found: ${sourceManager}.${sourceProperty}`);
          continue;
        }
        
        // Transform the value if needed
        const transformedValue = dependency.transform 
          ? dependency.transform(sourceValue) 
          : sourceValue;
        
        // Validate if needed
        if (dependency.validate && !dependency.validate(transformedValue)) {
          console.warn(`Dependency validation failed: ${sourceManager}.${sourceProperty} -> ${targetManager}.${targetProperty}`);
          continue;
        }
        
        // Get the target configuration
        const targetConfig = target.getConfig();
        
        // Create updated config with the dependency value
        const updatedConfig = {
          ...targetConfig
        };
        
        // Set the property value
        this.setPropertyValue(updatedConfig, targetProperty, transformedValue);
        
        // Update the target manager configuration
        target.updateConfig(updatedConfig);
        
        // Track applied dependency
        if (!result[targetManager]) {
          result[targetManager] = [];
        }
        
        result[targetManager].push(dependency);
        
      } catch (error) {
        console.error(`Error applying dependency: ${sourceManager}.${sourceProperty} -> ${targetManager}.${targetProperty}`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Verify the agent's configuration for consistency and dependency satisfaction
   * @returns Verification result
   */
  verifyConfiguration(): ConfigVerificationResult {
    const result: ConfigVerificationResult = {
      success: true
    };
    
    const errors: ValidationError[] = [];
    const conflicts: ConfigVerificationResult['conflicts'] = [];
    const unsatisfiedDependencies: ConfigVerificationResult['unsatisfiedDependencies'] = [];
    
    const managers = this.getManagersMap();
    
    // Verify manager configurations against their schemas
    for (const [managerType, manager] of Object.entries(managers)) {
      // Skip if no schema for this manager
      if (!this.configSchema.managers[managerType]) {
        continue;
      }
      
      // Get the manager's configuration
      const config = manager.getConfig();
      
      // Verify against schema
      try {
        const schemaFactory = createConfigFactory(this.configSchema.managers[managerType]);
        schemaFactory.validate(config, { throwOnError: true });
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          errors.push(...error.errors);
          result.success = false;
        } else {
          errors.push(new ValidationError(
            `Validation error for ${managerType}: ${error instanceof Error ? error.message : String(error)}`,
            managerType
          ));
          result.success = false;
        }
      }
    }
    
    // Verify dependencies
    for (const dependency of this.dependencies) {
      const { sourceManager, sourceProperty, targetManager, targetProperty, required } = dependency;
      
      // Get the source and target managers
      const source = managers[sourceManager];
      const target = managers[targetManager];
      
      if (!source || !target) {
        if (required) {
          unsatisfiedDependencies!.push({
            dependency,
            reason: !source 
              ? `Source manager ${sourceManager} not found` 
              : `Target manager ${targetManager} not found`
          });
          result.success = false;
        }
        continue;
      }
      
      // Get the source configuration
      const sourceConfig = source.getConfig();
      
      // Get the source value
      const sourceValue = this.getPropertyValue(sourceConfig, sourceProperty);
      
      if (sourceValue === undefined && required) {
        unsatisfiedDependencies!.push({
          dependency,
          reason: `Required source property ${sourceProperty} not found in ${sourceManager}`
        });
        result.success = false;
        continue;
      }
      
      // Transform the value if needed
      try {
        const transformedValue = dependency.transform 
          ? dependency.transform(sourceValue) 
          : sourceValue;
        
        // Validate if needed
        if (dependency.validate && !dependency.validate(transformedValue)) {
          unsatisfiedDependencies!.push({
            dependency,
            reason: `Validation failed for transformed value`
          });
          result.success = false;
        }
      } catch (error) {
        unsatisfiedDependencies!.push({
          dependency,
          reason: `Error in transform function: ${error instanceof Error ? error.message : String(error)}`
        });
        result.success = false;
      }
    }
    
    // Check for conflicts between managers
    for (const depA of this.dependencies) {
      for (const depB of this.dependencies) {
        // Skip if same dependency or different target properties
        if (depA === depB || depA.targetManager !== depB.targetManager || depA.targetProperty !== depB.targetProperty) {
          continue;
        }
        
        // Get the source managers
        const sourceA = managers[depA.sourceManager];
        const sourceB = managers[depB.sourceManager];
        
        if (!sourceA || !sourceB) {
          continue;
        }
        
        // Get the source values
        const sourceConfigA = sourceA.getConfig();
        const sourceConfigB = sourceB.getConfig();
        
        const sourceValueA = this.getPropertyValue(sourceConfigA, depA.sourceProperty);
        const sourceValueB = this.getPropertyValue(sourceConfigB, depB.sourceProperty);
        
        // Transform the values if needed
        const transformedValueA = depA.transform ? depA.transform(sourceValueA) : sourceValueA;
        const transformedValueB = depB.transform ? depB.transform(sourceValueB) : sourceValueB;
        
        // Check for conflict (only if both values are defined)
        if (transformedValueA !== undefined && transformedValueB !== undefined && 
            JSON.stringify(transformedValueA) !== JSON.stringify(transformedValueB)) {
          
          conflicts!.push({
            managerType: depA.sourceManager,
            property: depA.sourceProperty,
            value: transformedValueA,
            conflictsWith: {
              managerType: depB.sourceManager,
              property: depB.sourceProperty,
              value: transformedValueB
            }
          });
          
          result.success = false;
        }
      }
    }
    
    // Add errors, conflicts, and unsatisfied dependencies to result
    if (errors.length > 0) {
      result.errors = errors;
    }
    
    if (conflicts!.length > 0) {
      result.conflicts = conflicts;
    }
    
    if (unsatisfiedDependencies!.length > 0) {
      result.unsatisfiedDependencies = unsatisfiedDependencies;
    }
    
    return result;
  }
  
  /**
   * Apply a configuration update across relevant managers
   * @param config The configuration update to apply
   * @returns Map of manager types to their validation results
   */
  applyConfigurationUpdate(
    config: Record<string, unknown>
  ): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const managers = this.getManagersMap();
    
    // First, verify the provided configuration is valid
    const validation = this.configFactory.validate(config);
    
    if (!validation.valid) {
      results.set('agent', validation);
      return results;
    }
    
    // Apply manager-specific configurations
    if (config.managers && typeof config.managers === 'object') {
      for (const [managerType, managerConfig] of Object.entries(config.managers)) {
        // Skip if manager doesn't exist
        if (!managers[managerType]) {
          continue;
        }
        
        // Get the manager
        const manager = managers[managerType];
        
        // Update the manager's configuration
        try {
          manager.updateConfig(managerConfig as Record<string, unknown>);
          results.set(managerType, { valid: true });
        } catch (error) {
          results.set(managerType, { 
            valid: false,
            errors: error instanceof ConfigValidationError ? error.errors : [
              new ValidationError(
                `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
                managerType
              )
            ]
          });
        }
      }
    }
    
    // Re-apply dependencies to ensure consistency
    this.applyDependencies();
    
    return results;
  }
  
  /**
   * Get a map of manager types to manager instances
   * @private
   */
  private getManagersMap(): Record<string, BaseManager> {
    const result: Record<string, BaseManager> = {};
    
    // Get all managers from the agent
    const managers = this.agent.getManagers();
    
    for (const manager of managers) {
      result[manager.managerType] = manager;
    }
    
    return result;
  }
  
  /**
   * Get a property value from an object using dot notation
   * @param obj The object to get the property from
   * @param path The property path (e.g., "foo.bar.baz")
   * @private
   */
  private getPropertyValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: any = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Set a property value in an object using dot notation
   * @param obj The object to set the property in
   * @param path The property path (e.g., "foo.bar.baz")
   * @param value The value to set
   * @private
   */
  private setPropertyValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    const lastPart = parts.pop();
    
    if (!lastPart) {
      return;
    }
    
    let current: any = obj;
    
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[lastPart] = value;
  }

  private buildManagerMap(managers: BaseManager[]): Record<ManagerType, BaseManager> {
    const result: Partial<Record<ManagerType, BaseManager>> = {};
    
    for (const manager of managers) {
      result[manager.managerType] = manager;
    }
    
    return result as Record<ManagerType, BaseManager>;
  }

  private getManagerConfig(managerType: ManagerType): Record<string, unknown> | null {
    const manager = this.managers[managerType];
    if (!manager) {
      return null;
    }
    return manager.getConfig();
  }

  private validateManagerConfig(
    managerType: ManagerType, 
    config: Record<string, unknown>
  ): void {
    const schema = this.configSchema.managers[managerType];
    if (!schema) {
      throw new ConfigValidationError(
        `No schema found for manager type ${managerType}`,
        [new ValidationError(`No schema found for manager type ${managerType}`, managerType)]
      );
    }

    const factory = createConfigFactory(schema);
    const result = factory.validate(config, { 
      throwOnError: true, 
      applyDefaults: true,
      removeAdditional: true 
    });

    if (!result.valid) {
      // Cast the errors to ValidationError[] since we know they come from the validation system
      const validationErrors = (result.errors || []) as ValidationError[];
      throw new ConfigValidationError(
        `Configuration validation failed for manager ${managerType}`,
        validationErrors.length > 0 ? validationErrors : [new ValidationError(`Unknown validation error`, managerType)]
      );
    }
  }
} 