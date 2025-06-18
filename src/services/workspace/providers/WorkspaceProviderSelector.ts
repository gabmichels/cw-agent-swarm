import { WorkspaceProvider, WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';

export interface ProviderSelectionCriteria {
  agentId: string;
  capability: WorkspaceCapabilityType;
  recipientEmails?: string[];
  senderEmail?: string;
  domain?: string;
  userPreference?: WorkspaceProvider;
}

export interface ProviderSelectionResult {
  connectionId: string;
  connection: WorkspaceConnection;
  reason: string;
  confidence: number; // 0-1 score indicating confidence in selection
}

/**
 * Intelligent workspace provider selection service
 * Chooses the best provider when multiple options are available
 */
export class WorkspaceProviderSelector {
  private db: IDatabaseProvider;
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Select the best workspace connection for a given request
   */
  async selectBestProvider(criteria: ProviderSelectionCriteria): Promise<ProviderSelectionResult | null> {
    // Get all available connections for this agent and capability
    const availableConnections = await this.getAvailableConnections(
      criteria.agentId, 
      criteria.capability
    );

    if (availableConnections.length === 0) {
      return null;
    }

    if (availableConnections.length === 1) {
      return {
        connectionId: availableConnections[0].id,
        connection: availableConnections[0],
        reason: 'Only available connection',
        confidence: 1.0
      };
    }

    // Apply selection algorithm
    const scoredConnections = await Promise.all(
      availableConnections.map(conn => this.scoreConnection(conn, criteria))
    );

    // Sort by score (highest first)
    scoredConnections.sort((a, b) => b.score - a.score);
    
    const best = scoredConnections[0];
    
    return {
      connectionId: best.connection.id,
      connection: best.connection,
      reason: best.reason,
      confidence: best.score
    };
  }

  /**
   * Score a connection based on selection criteria
   */
  private async scoreConnection(
    connection: WorkspaceConnection, 
    criteria: ProviderSelectionCriteria
  ): Promise<{ connection: WorkspaceConnection; score: number; reason: string }> {
    let score = 0;
    let reasons: string[] = [];

    // 1. User explicit preference (highest priority)
    if (criteria.userPreference && connection.provider === criteria.userPreference) {
      score += 0.4;
      reasons.push('matches user preference');
    }

    // 2. Email domain matching
    if (criteria.recipientEmails && criteria.recipientEmails.length > 0) {
      const domainMatch = this.checkDomainMatch(connection, criteria.recipientEmails);
      if (domainMatch.matches) {
        score += 0.3;
        reasons.push(`recipient domain matches (${domainMatch.domain})`);
      }
    }

    // 3. Sender email matching
    if (criteria.senderEmail) {
      if (connection.email === criteria.senderEmail) {
        score += 0.25;
        reasons.push('exact sender email match');
      } else if (connection.domain && criteria.senderEmail.endsWith(connection.domain)) {
        score += 0.15;
        reasons.push('sender domain match');
      }
    }

    // 4. Provider reliability and health
    const healthScore = await this.getProviderHealthScore(connection);
    score += healthScore * 0.2;
    if (healthScore > 0.8) {
      reasons.push('excellent provider health');
    } else if (healthScore > 0.6) {
      reasons.push('good provider health');
    }

    // 5. Recent usage (recency preference)
    const recencyScore = this.getRecencyScore(connection);
    score += recencyScore * 0.1;
    if (recencyScore > 0.7) {
      reasons.push('recently used');
    }

    // 6. Provider-specific capability quality
    const capabilityScore = this.getCapabilityScore(connection, criteria.capability);
    score += capabilityScore * 0.15;
    if (capabilityScore > 0.8) {
      reasons.push('excellent capability support');
    }

    return {
      connection,
      score: Math.min(score, 1.0), // Cap at 1.0
      reason: reasons.join(', ') || 'general scoring'
    };
  }

  /**
   * Check if recipient domains match the connection
   */
  private checkDomainMatch(connection: WorkspaceConnection, recipientEmails: string[]): 
    { matches: boolean; domain?: string } {
    
    if (!connection.domain) {
      return { matches: false };
    }

    for (const email of recipientEmails) {
      const domain = email.split('@')[1];
      if (domain === connection.domain) {
        return { matches: true, domain };
      }
    }

    return { matches: false };
  }

  /**
   * Get provider health score based on recent performance
   */
  private async getProviderHealthScore(connection: WorkspaceConnection): Promise<number> {
    try {
      // Check connection status
      if (connection.status !== 'ACTIVE') {
        return 0.1;
      }

      // Check token expiry
      if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
        return 0.3; // Needs refresh but might work
      }

      // Check recent sync
      if (connection.lastSyncAt) {
        const daysSinceSync = (Date.now() - connection.lastSyncAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSync < 1) return 1.0;
        if (daysSinceSync < 7) return 0.8;
        if (daysSinceSync < 30) return 0.6;
        return 0.4;
      }

      return 0.7; // Default for active connections
    } catch (error) {
      return 0.2;
    }
  }

  /**
   * Get recency score based on recent usage
   */
  private getRecencyScore(connection: WorkspaceConnection): number {
    if (!connection.lastSyncAt) {
      return 0.0;
    }

    const hoursAgo = (Date.now() - connection.lastSyncAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 1) return 1.0;
    if (hoursAgo < 24) return 0.8;
    if (hoursAgo < 168) return 0.5; // 1 week
    return 0.2;
  }

  /**
   * Get capability-specific score for provider
   */
  private getCapabilityScore(connection: WorkspaceConnection, capability: WorkspaceCapabilityType): number {
    // Provider-specific capability ratings
    const capabilityRatings: Record<string, Record<WorkspaceCapabilityType, number>> = {
      'GOOGLE_WORKSPACE': {
        'EMAIL_SEND': 0.95,
        'EMAIL_READ': 0.95,
        'CALENDAR_CREATE': 0.9,
        'CALENDAR_READ': 0.9,
        'SPREADSHEET_CREATE': 0.95,
        'SPREADSHEET_READ': 0.95,
        'DRIVE_READ': 0.9,
        'DRIVE_UPLOAD': 0.9
      } as any,
      'ZOHO': {
        'EMAIL_SEND': 0.85,
        'EMAIL_READ': 0.85,
        'CALENDAR_CREATE': 0.8,
        'CALENDAR_READ': 0.8,
        'SPREADSHEET_CREATE': 0.75,
        'SPREADSHEET_READ': 0.75,
        'DRIVE_READ': 0.7,
        'DRIVE_UPLOAD': 0.7
      } as any,
      'MICROSOFT_365': {
        'EMAIL_SEND': 0.9,
        'EMAIL_READ': 0.9,
        'CALENDAR_CREATE': 0.85,
        'CALENDAR_READ': 0.85,
        'SPREADSHEET_CREATE': 0.8,
        'SPREADSHEET_READ': 0.8,
        'DRIVE_READ': 0.8,
        'DRIVE_UPLOAD': 0.8
      } as any
    };

    const providerRatings = capabilityRatings[connection.provider];
    return providerRatings?.[capability] || 0.5;
  }

  /**
   * Get all available connections for an agent and capability
   */
  private async getAvailableConnections(
    agentId: string, 
    capability: WorkspaceCapabilityType
  ): Promise<WorkspaceConnection[]> {
    const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
    
    const relevantCapabilities = capabilities.filter(cap => 
      cap.capability === capability
    );

    const connections: WorkspaceConnection[] = [];
    
    for (const cap of relevantCapabilities) {
      const connection = await this.db.getWorkspaceConnection(cap.connectionId);
      if (connection && connection.status === 'ACTIVE') {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get user preferences for provider selection
   */
  async getUserProviderPreferences(userId: string): Promise<{
    preferredProvider?: WorkspaceProvider;
    domainMappings?: Record<string, WorkspaceProvider>;
  }> {
    // This could be implemented to read from user preferences
    // For now, return empty preferences
    return {};
  }

  /**
   * Set user preference for a specific provider
   */
  async setUserProviderPreference(
    userId: string, 
    provider: WorkspaceProvider, 
    domain?: string
  ): Promise<void> {
    // Implementation for storing user preferences
    // Could be stored in database or user settings
  }
} 