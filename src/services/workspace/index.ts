// Main workspace service
export { WorkspaceService } from './WorkspaceService';

// Provider interfaces and implementations
export { IWorkspaceProvider, ConnectionConfig, ConnectionResult, ValidationResult } from './providers/IWorkspaceProvider';
export { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';

// Database types and services
export { DatabaseService } from '../database/DatabaseService';
export { IDatabaseProvider } from '../database/IDatabaseProvider';
export { PrismaDatabaseProvider } from '../database/PrismaDatabaseProvider';

// Types
export * from '../database/types'; 