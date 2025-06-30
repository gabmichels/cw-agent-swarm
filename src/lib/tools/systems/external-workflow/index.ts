/**
 * External Workflow System exports
 */
export { ExternalWorkflowSystem } from './ExternalWorkflowSystem';
export type { ExternalWorkflowSystemConfig } from './ExternalWorkflowSystem';
export { ExternalWorkflowIntegrationService } from './ExternalWorkflowIntegrationService';

// Re-export common types from external workflow interfaces
export type {
  WorkflowExecutionRequest,
  WorkflowExecutionResult,
  WorkflowExecutionHistory,
  WorkflowPlatformStatus,
  ValidationResult,
  ValidationError
} from '../../../../services/external-workflows/interfaces/ExternalWorkflowInterfaces'; 