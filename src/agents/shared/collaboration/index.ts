/**
 * Human Collaboration System Index
 * 
 * This file exports all components of the human collaboration system.
 */

// Export interfaces
export * from './interfaces/HumanCollaboration.interface';

// Export default implementation
export { DefaultHumanCollaborationManager, humanCollaboration } from './DefaultHumanCollaborationManager';

// Export individual components
export { StakeholderManager } from './stakeholder/StakeholderManager';
export { approvalConfig } from './approval/ApprovalConfigurationManager';
export { CorrectionHandler } from './correction/CorrectionHandler'; 