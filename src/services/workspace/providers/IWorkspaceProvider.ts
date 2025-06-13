import { 
  WorkspaceProvider, 
  WorkspaceCapabilityType, 
  WorkspaceConnection,
  ConnectionStatus 
} from '../../database/types';

/**
 * Configuration for initiating a workspace connection
 */
export interface ConnectionConfig {
  userId?: string;
  organizationId?: string;
  scopes: string[];
  redirectUri: string;
  state?: string;
}

/**
 * Result of connection initiation
 */
export interface ConnectionResult {
  success: boolean;
  authUrl?: string;
  connectionId?: string;
  error?: string;
}

/**
 * Result of connection validation
 */
export interface ValidationResult {
  isValid: boolean;
  status: ConnectionStatus;
  expiresAt?: Date;
  error?: string;
}

/**
 * Base workspace provider interface
 */
export interface IWorkspaceProvider {
  readonly providerId: WorkspaceProvider;
  readonly supportedCapabilities: WorkspaceCapabilityType[];
  
  // Connection management
  initiateConnection(config: ConnectionConfig): Promise<ConnectionResult>;
  completeConnection(authCode: string, state: string): Promise<WorkspaceConnection>;
  refreshConnection(connectionId: string): Promise<ConnectionResult>;
  validateConnection(connectionId: string): Promise<ValidationResult>;
  revokeConnection(connectionId: string): Promise<void>;
  
  // Health check
  isHealthy(): Promise<boolean>;
} 