import { ulid } from 'ulid';
import {
  createErrorContext,
  ErrorSeverity,
  handleAsync
} from '../../lib/errors/standardized-handler';
import { logger } from '../../lib/logging';
import { DatabaseService } from '../database/DatabaseService';
import { WorkspaceProvider } from '../database/types';

export interface WorkflowImportRequest {
  connectionId: string;
  workflowId: string; // From the library
  customName?: string;
  customDescription?: string;
  parameters?: Record<string, any>;
  activate?: boolean;
}

export interface WorkflowImportResult {
  success: boolean;
  importedWorkflowId?: string;
  error?: string;
  conflictResolution?: 'renamed' | 'replaced' | 'skipped';
}

export interface WorkflowDiscoveryResult {
  workflows: UserWorkflow[];
  totalCount: number;
  lastSyncAt: Date;
}

export interface UserWorkflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  tags: string[];
  nodeCount: number;
  lastModified: Date;
  executionCount: number;
  source: 'user' | 'imported';
  originalLibraryId?: string;
}

/**
 * Service for importing workflows from library to user N8N accounts
 * and discovering existing workflows in user accounts
 * 
 * Follows IMPLEMENTATION_GUIDELINES.md patterns: ULID, DI, strict typing, pure functions
 */
export class WorkflowImportService {
  private db = DatabaseService.getInstance();

  constructor() {
    logger.info('WorkflowImportService initialized');
  }

  /**
   * Import a workflow from the library to user's N8N account
   */
  async importWorkflow(request: WorkflowImportRequest): Promise<WorkflowImportResult> {
    const context = createErrorContext('WorkflowImportService', 'importWorkflow', {
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      logger.info('Starting workflow import', {
        connectionId: request.connectionId,
        workflowId: request.workflowId,
        customName: request.customName
      });

      // Get the connection to determine provider type
      const connection = await this.db.getWorkspaceConnection(request.connectionId);
      if (!connection) {
        throw new Error('Workspace connection not found');
      }

      // Get the workflow from the library via FastAPI
      const libraryWorkflow = await this.fetchWorkflowFromLibrary(request.workflowId);
      if (!libraryWorkflow) {
        throw new Error('Workflow not found in library');
      }

      // Prepare workflow data for import
      const workflowData = this.prepareWorkflowForImport(libraryWorkflow, request);

      // Get the appropriate provider
      const provider = this.getProvider(connection.provider);

      // Check for naming conflicts
      const existingWorkflows = await provider.getWorkflows(request.connectionId);
      const conflictResolution = this.resolveNamingConflict(workflowData.name, existingWorkflows);

      if (conflictResolution.action === 'rename') {
        workflowData.name = conflictResolution.newName!;
      }

      // Import the workflow
      const importedWorkflow = await provider.createWorkflow(request.connectionId, workflowData);

      // Activate if requested
      if (request.activate && importedWorkflow.id) {
        await provider.activateWorkflow(request.connectionId, importedWorkflow.id);
      }

      logger.info('Workflow imported successfully', {
        connectionId: request.connectionId,
        originalWorkflowId: request.workflowId,
        importedWorkflowId: importedWorkflow.id,
        finalName: workflowData.name,
        conflictResolution: conflictResolution.action
      });

      return {
        success: true,
        importedWorkflowId: importedWorkflow.id || importedWorkflow.data?.id || request.workflowId,
        conflictResolution: conflictResolution.action === 'rename' ? 'renamed' as 'renamed' : undefined
      };
    }, context);

    if (!result.success) {
      logger.error('Workflow import failed', {
        connectionId: request.connectionId,
        workflowId: request.workflowId,
        error: result.error?.message
      });

      return {
        success: false,
        error: result.error?.message || 'Unknown error during import'
      };
    }

    return result.data!;
  }

  /**
   * Discover workflows in user's N8N account
   */
  async discoverUserWorkflows(connectionId: string): Promise<WorkflowDiscoveryResult> {
    const context = createErrorContext('WorkflowImportService', 'discoverUserWorkflows', {
      severity: ErrorSeverity.LOW,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      logger.info('Starting workflow discovery', { connectionId });

      // Get the connection to determine provider type
      const connection = await this.db.getWorkspaceConnection(connectionId);
      if (!connection) {
        throw new Error('Workspace connection not found');
      }

      // Get the appropriate provider
      const provider = this.getProvider(connection.provider);

      // Fetch workflows from user's account
      const rawWorkflows = await provider.getWorkflows(connectionId);

      // Transform to our standard format
      const workflows: UserWorkflow[] = rawWorkflows.map((workflow: any) => this.transformToUserWorkflow(workflow));

      logger.info('Workflow discovery completed', {
        connectionId,
        workflowCount: workflows.length
      });

      return {
        workflows,
        totalCount: workflows.length,
        lastSyncAt: new Date()
      };
    }, context);

    if (!result.success) {
      logger.error('Workflow discovery failed', {
        connectionId,
        error: result.error?.message
      });

      return {
        workflows: [],
        totalCount: 0,
        lastSyncAt: new Date()
      };
    }

    return result.data!;
  }

  /**
   * Sync workflows between user's N8N account and our platform
   */
  async syncUserWorkflows(connectionId: string): Promise<WorkflowDiscoveryResult> {
    // For now, this is the same as discovery
    // In the future, we could add caching and incremental sync
    return this.discoverUserWorkflows(connectionId);
  }

  /**
   * Check if a workflow can be imported (no conflicts, valid format)
   */
  async validateWorkflowForImport(connectionId: string, workflowId: string): Promise<{
    canImport: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const context = createErrorContext('WorkflowImportService', 'validateWorkflowForImport', {
      severity: ErrorSeverity.LOW,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      // Get the workflow from library
      const libraryWorkflow = await this.fetchWorkflowFromLibrary(workflowId);
      if (!libraryWorkflow) {
        issues.push('Workflow not found in library');
        return { canImport: false, issues, suggestions };
      }

      // Get connection and existing workflows
      const connection = await this.db.getWorkspaceConnection(connectionId);
      if (!connection) {
        issues.push('Workspace connection not found');
        return { canImport: false, issues, suggestions };
      }

      const provider = this.getProvider(connection.provider);
      const existingWorkflows = await provider.getWorkflows(connectionId);

      // Check for naming conflicts
      const nameConflict = existingWorkflows.find((w: any) => w.name === libraryWorkflow.name);
      if (nameConflict) {
        issues.push(`Workflow name "${libraryWorkflow.name}" already exists`);
        suggestions.push('Consider using a custom name during import');
      }

      // Check for required nodes/integrations
      if (libraryWorkflow.nodes) {
        const requiredIntegrations = this.extractRequiredIntegrations(libraryWorkflow.nodes);
        if (requiredIntegrations.length > 0) {
          suggestions.push(`This workflow requires: ${requiredIntegrations.join(', ')}`);
        }
      }

      return {
        canImport: issues.length === 0,
        issues,
        suggestions
      };
    }, context);

    if (!result.success) {
      // If it's a specific error we can handle, return it
      if (result.error?.message?.includes('Failed to fetch workflow from library')) {
        return { canImport: false, issues: ['Workflow not found in library'], suggestions: [] };
      }
      return { canImport: false, issues: ['Validation failed'], suggestions: [] };
    }
    return result.data!;
  }

  // Private helper methods

  private async fetchWorkflowFromLibrary(workflowId: string): Promise<any> {
    // Fetch from the FastAPI server
    const response = await fetch(`http://127.0.0.1:8080/api/workflows/${workflowId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow from library: ${response.statusText}`);
    }
    return response.json();
  }

  // Note: This service needs to be refactored to use third-party tools system
  // N8N providers should not be part of the workspace system
  private getProvider(providerType: WorkspaceProvider): any {
    throw new Error(`N8N workflow import functionality is being migrated to third-party tools system. Provider ${providerType} is not supported in workspace context.`);
  }

  private prepareWorkflowForImport(libraryWorkflow: any, request: WorkflowImportRequest): any {
    return {
      name: request.customName || libraryWorkflow.name,
      description: request.customDescription || libraryWorkflow.description,
      nodes: libraryWorkflow.nodes || [],
      connections: libraryWorkflow.connections || {},
      settings: libraryWorkflow.settings || {},
      staticData: libraryWorkflow.staticData || {},
      tags: libraryWorkflow.tags || [],
      // Apply custom parameters if provided
      ...(request.parameters && { customParameters: request.parameters })
    };
  }

  private resolveNamingConflict(proposedName: string, existingWorkflows: any[]): {
    action: 'none' | 'rename';
    newName?: string;
  } {
    const conflictExists = existingWorkflows.some(w => w.name === proposedName);

    if (!conflictExists) {
      return { action: 'none' };
    }

    // Generate a unique name by appending a number
    let counter = 1;
    let newName = `${proposedName} (${counter})`;

    while (existingWorkflows.some(w => w.name === newName)) {
      counter++;
      newName = `${proposedName} (${counter})`;
    }

    return { action: 'rename', newName };
  }

  private transformToUserWorkflow(rawWorkflow: any): UserWorkflow {
    return {
      id: rawWorkflow.id || ulid(),
      name: rawWorkflow.name || 'Unnamed Workflow',
      description: rawWorkflow.description,
      active: rawWorkflow.active || false,
      tags: rawWorkflow.tags || [],
      nodeCount: rawWorkflow.nodes?.length || 0,
      lastModified: rawWorkflow.updatedAt ? new Date(rawWorkflow.updatedAt) : new Date(),
      executionCount: rawWorkflow.executionCount || 0,
      source: rawWorkflow.customParameters ? 'imported' : 'user',
      originalLibraryId: rawWorkflow.customParameters?.originalLibraryId
    };
  }

  private extractRequiredIntegrations(nodes: any[]): string[] {
    const integrations = new Set<string>();
    const builtInNodes = ['Start', 'End', 'NoOp', 'Set', 'If', 'Merge', 'Switch'];

    nodes.forEach(node => {
      if (node.type && node.type.startsWith('n8n-nodes-base.')) {
        // Extract integration name from node type
        const integration = node.type.replace('n8n-nodes-base.', '');

        // Skip built-in workflow nodes
        if (!builtInNodes.includes(integration)) {
          // Convert camelCase to readable format
          const readableName = integration
            .replace(/([A-Z][a-z])/g, ' $1')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
          integrations.add(readableName);
        }
      }
    });

    return Array.from(integrations);
  }
} 