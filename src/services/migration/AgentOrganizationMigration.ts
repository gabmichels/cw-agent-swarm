/**
 * Agent Organization Migration Service
 * 
 * Handles migration of existing agents to support organizational properties
 * according to IMPLEMENTATION_GUIDELINES.md with strict typing and error handling.
 */

import { AgentMetadata } from '../../types/metadata';
import { StructuredId } from '../../types/structured-id';
import { PlatformConfigService, PlatformMode } from '../PlatformConfigService';
import { AgentSchemaValidator, ValidationResult } from '../validation/AgentSchemaValidator';

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: MigrationError[];
  warnings: MigrationWarning[];
  duration: number; // milliseconds
}

/**
 * Migration error interface
 */
export interface MigrationError {
  agentId: StructuredId;
  error: string;
  code: string;
  timestamp: Date;
}

/**
 * Migration warning interface
 */
export interface MigrationWarning {
  agentId: StructuredId;
  warning: string;
  code: string;
  suggestion?: string;
}

/**
 * Migration configuration interface
 */
export interface MigrationConfig {
  batchSize: number;
  validateBeforeMigration: boolean;
  validateAfterMigration: boolean;
  dryRun: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

/**
 * Default migration configuration
 */
const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  batchSize: 100,
  validateBeforeMigration: true,
  validateAfterMigration: true,
  dryRun: false,
  maxRetries: 3,
  retryDelay: 1000
};

/**
 * Migration strategy based on platform mode
 */
interface MigrationStrategy {
  assignCategory(agent: AgentMetadata): string | undefined;
  assignDepartment(agent: AgentMetadata): { id: string; name: string; code: string; } | undefined;
  shouldMigrate(agent: AgentMetadata): boolean;
}

/**
 * Personal mode migration strategy
 */
class PersonalModeMigrationStrategy implements MigrationStrategy {
  assignCategory(agent: AgentMetadata): string | undefined {
    // Auto-assign category based on agent capabilities or domain
    if (agent.domain) {
      if (agent.domain.some(d => d.toLowerCase().includes('finance'))) {
        return 'Finance';
      }
      if (agent.domain.some(d => d.toLowerCase().includes('health'))) {
        return 'Health';
      }
      if (agent.domain.some(d => d.toLowerCase().includes('productivity'))) {
        return 'Productivity';
      }
      if (agent.domain.some(d => d.toLowerCase().includes('education'))) {
        return 'Education';
      }
    }
    
    // Default based on specialization
    if (agent.specialization) {
      if (agent.specialization.some(s => s.toLowerCase().includes('analysis'))) {
        return 'Analysis';
      }
      if (agent.specialization.some(s => s.toLowerCase().includes('communication'))) {
        return 'Communication';
      }
    }
    
    // Default fallback
    return 'General';
  }
  
  assignDepartment(agent: AgentMetadata): { id: string; name: string; code: string; } | undefined {
    // Department field not used in personal mode
    return undefined;
  }
  
  shouldMigrate(agent: AgentMetadata): boolean {
    // Migrate if agent doesn't have category field
    return !agent.category;
  }
}

/**
 * Organizational mode migration strategy
 */
class OrganizationalModeMigrationStrategy implements MigrationStrategy {
  assignCategory(agent: AgentMetadata): string | undefined {
    // Category field not primary in organizational mode
    return undefined;
  }
  
  assignDepartment(agent: AgentMetadata): { id: string; name: string; code: string; } | undefined {
    // Auto-assign department based on agent domain or specialization
    // Note: In a real implementation, these would be fetched from Prisma
    // For now, using hardcoded department objects that match seeded departments
    if (agent.domain) {
      if (agent.domain.some(d => d.toLowerCase().includes('marketing'))) {
        return { id: '48e34449-0d5e-48a1-80ca-26389feb3b36', name: 'Marketing', code: 'MKT' };
      }
      if (agent.domain.some(d => d.toLowerCase().includes('hr') || d.toLowerCase().includes('human'))) {
        return { id: 'ac89dc79-724b-4023-9698-306feff1f817', name: 'Human Resources', code: 'HR' };
      }
      if (agent.domain.some(d => d.toLowerCase().includes('finance'))) {
        return { id: '36bfd6cf-68f1-4d72-a605-66d90e8fce04', name: 'Finance', code: 'FIN' };
      }
      if (agent.domain.some(d => d.toLowerCase().includes('tech') || d.toLowerCase().includes('engineering'))) {
        return { id: '19579ee3-292b-46cf-b947-3c4c1e5637cf', name: 'Engineering', code: 'ENG' };
      }
      if (agent.domain.some(d => d.toLowerCase().includes('sales'))) {
        return { id: '6c78b112-40e6-46f8-ae50-878399b2fe57', name: 'Sales', code: 'SALES' };
      }
    }
    
    // Default fallback to Operations
    return { id: '3ead78b1-890b-4381-a265-2c1b36138a3c', name: 'Operations', code: 'OPS' };
  }
  
  shouldMigrate(agent: AgentMetadata): boolean {
    // Migrate if agent doesn't have department field
    return !agent.department;
  }
}

/**
 * Agent Organization Migration Service
 * 
 * Handles migration of existing agents to support organizational properties
 * with comprehensive error handling and validation.
 */
export class AgentOrganizationMigration {
  private readonly platformConfig: PlatformConfigService;
  private readonly validator: AgentSchemaValidator;
  private readonly strategy: MigrationStrategy;
  
  constructor(
    platformConfig?: PlatformConfigService,
    validator?: AgentSchemaValidator
  ) {
    this.platformConfig = platformConfig || PlatformConfigService.getInstance();
    this.validator = validator || AgentSchemaValidator.create(this.platformConfig);
    
    // Select migration strategy based on platform mode
    if (this.platformConfig.isPersonalMode()) {
      this.strategy = new PersonalModeMigrationStrategy();
    } else {
      this.strategy = new OrganizationalModeMigrationStrategy();
    }
  }
  
  /**
   * Migrate a collection of agents
   * 
   * @param agents - Array of agent metadata to migrate
   * @param config - Migration configuration
   * @returns Migration result
   */
  public async migrateAgents(
    agents: AgentMetadata[],
    config: Partial<MigrationConfig> = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const finalConfig = { ...DEFAULT_MIGRATION_CONFIG, ...config };
    
    const result: MigrationResult = {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      warnings: [],
      duration: 0
    };
    
    try {
      // Process agents in batches
      const batches = this.createBatches(agents, finalConfig.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch, finalConfig);
        this.mergeBatchResult(result, batchResult);
      }
      
      result.success = result.errorCount === 0;
      result.duration = Date.now() - startTime;
      
    } catch (error) {
      result.errors.push({
        agentId: { namespace: 'system', type: 'migration', id: 'batch_error' } as StructuredId,
        error: error instanceof Error ? error.message : 'Unknown batch processing error',
        code: 'BATCH_PROCESSING_ERROR',
        timestamp: new Date()
      });
      result.errorCount++;
    }
    
    return result;
  }
  
  /**
   * Migrate a single agent
   * 
   * @param agent - Agent metadata to migrate
   * @param config - Migration configuration
   * @returns Migrated agent metadata or null if migration failed
   */
  public async migrateSingleAgent(
    agent: AgentMetadata,
    config: Partial<MigrationConfig> = {}
  ): Promise<AgentMetadata | null> {
    const finalConfig = { ...DEFAULT_MIGRATION_CONFIG, ...config };
    
    try {
      // Check if migration is needed
      if (!this.strategy.shouldMigrate(agent)) {
        return agent; // No migration needed
      }
      
      // Validate before migration if required
      if (finalConfig.validateBeforeMigration) {
        const validation = this.validator.validate(agent);
        if (!validation.isValid) {
          throw new Error(`Pre-migration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
      
      // Create migrated agent
      const migratedAgent = this.createMigratedAgent(agent);
      
      // Validate after migration if required
      if (finalConfig.validateAfterMigration) {
        const validation = this.validator.validate(migratedAgent);
        if (!validation.isValid) {
          throw new Error(`Post-migration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
      
      return migratedAgent;
      
    } catch (error) {
      console.error(`Migration failed for agent ${agent.agentId}:`, error);
      return null;
    }
  }
  
  /**
   * Create migrated agent with organizational properties
   */
  private createMigratedAgent(agent: AgentMetadata): AgentMetadata {
    const migratedAgent: AgentMetadata = {
      ...agent,
      // Add organizational properties based on platform mode
      category: this.strategy.assignCategory(agent),
      department: this.strategy.assignDepartment(agent),
      
      // Initialize organizational hierarchy fields as undefined
      // These will be set later by organizational management tools
      subDepartment: undefined,
      team: undefined,
      position: undefined,
      reportingTo: undefined,
      managedAgents: undefined,
      organizationLevel: undefined
    };
    
    return migratedAgent;
  }
  
  /**
   * Process a batch of agents
   */
  private async processBatch(
    agents: AgentMetadata[],
    config: MigrationConfig
  ): Promise<Partial<MigrationResult>> {
    const batchResult: Partial<MigrationResult> = {
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      warnings: []
    };
    
    for (const agent of agents) {
      try {
        if (!this.strategy.shouldMigrate(agent)) {
          batchResult.skippedCount!++;
          continue;
        }
        
        const migratedAgent = await this.migrateSingleAgent(agent, config);
        
        if (migratedAgent) {
          batchResult.migratedCount!++;
          
          // Add warning if agent was auto-categorized
          if (this.platformConfig.isPersonalMode() && migratedAgent.category) {
            batchResult.warnings!.push({
              agentId: agent.agentId,
              warning: `Agent automatically categorized as '${migratedAgent.category}'`,
              code: 'AUTO_CATEGORIZED',
              suggestion: 'Review and adjust category if needed'
            });
          }
          
          if (this.platformConfig.isOrganizationalMode() && migratedAgent.department) {
            batchResult.warnings!.push({
              agentId: agent.agentId,
              warning: `Agent automatically assigned to '${migratedAgent.department}' department`,
              code: 'AUTO_ASSIGNED_DEPARTMENT',
              suggestion: 'Review and adjust department assignment if needed'
            });
          }
        } else {
          batchResult.errorCount!++;
          batchResult.errors!.push({
            agentId: agent.agentId,
            error: 'Migration failed for unknown reason',
            code: 'MIGRATION_FAILED',
            timestamp: new Date()
          });
        }
        
      } catch (error) {
        batchResult.errorCount!++;
        batchResult.errors!.push({
          agentId: agent.agentId,
          error: error instanceof Error ? error.message : 'Unknown migration error',
          code: 'MIGRATION_ERROR',
          timestamp: new Date()
        });
      }
    }
    
    return batchResult;
  }
  
  /**
   * Create batches of agents for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
  
  /**
   * Merge batch result into main result
   */
  private mergeBatchResult(mainResult: MigrationResult, batchResult: Partial<MigrationResult>): void {
    mainResult.migratedCount += batchResult.migratedCount || 0;
    mainResult.skippedCount += batchResult.skippedCount || 0;
    mainResult.errorCount += batchResult.errorCount || 0;
    mainResult.errors.push(...(batchResult.errors || []));
    mainResult.warnings.push(...(batchResult.warnings || []));
  }
  
  /**
   * Generate migration report
   */
  public generateReport(result: MigrationResult): string {
    const report: string[] = [];
    
    report.push('=== Agent Organization Migration Report ===');
    report.push(`Platform Mode: ${this.platformConfig.getPlatformMode()}`);
    report.push(`Duration: ${result.duration}ms`);
    report.push(`Success: ${result.success ? 'Yes' : 'No'}`);
    report.push('');
    
    report.push('Summary:');
    report.push(`  Migrated: ${result.migratedCount}`);
    report.push(`  Skipped: ${result.skippedCount}`);
    report.push(`  Errors: ${result.errorCount}`);
    report.push(`  Warnings: ${result.warnings.length}`);
    report.push('');
    
    if (result.errors.length > 0) {
      report.push('Errors:');
      result.errors.forEach(error => {
        report.push(`  - ${error.agentId}: ${error.error} (${error.code})`);
      });
      report.push('');
    }
    
    if (result.warnings.length > 0) {
      report.push('Warnings:');
      result.warnings.forEach(warning => {
        report.push(`  - ${warning.agentId}: ${warning.warning} (${warning.code})`);
        if (warning.suggestion) {
          report.push(`    Suggestion: ${warning.suggestion}`);
        }
      });
    }
    
    return report.join('\n');
  }
  
  /**
   * Static factory method for creating migration service
   */
  public static create(
    platformConfig?: PlatformConfigService,
    validator?: AgentSchemaValidator
  ): AgentOrganizationMigration {
    return new AgentOrganizationMigration(platformConfig, validator);
  }
} 