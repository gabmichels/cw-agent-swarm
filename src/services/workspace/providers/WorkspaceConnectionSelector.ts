/**
 * WorkspaceConnectionSelector - Intelligent email account selection with user clarification
 * 
 * This service handles the logic for selecting which email account to use when sending emails,
 * based on NLP-extracted sender preferences and intelligent matching with available connections.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all entities
 * - Strict TypeScript interfaces
 * - Dependency injection pattern
 * - Comprehensive error handling
 */

import { WorkspaceProvider, WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { logger } from '../../../lib/logging';

export interface SenderPreference {
  type?: 'provider' | 'category' | 'specific_email' | 'domain';
  value?: string;
  confidence?: number;
}

export interface ConnectionSelectionRequest {
  agentId: string;
  capability: WorkspaceCapabilityType;
  recipientEmails?: string[];
  senderPreference?: SenderPreference;
  requireUserChoice?: boolean;
}

export interface ConnectionSelectionResult {
  success: boolean;
  connectionId?: string;
  connection?: WorkspaceConnection;
  reason?: string;
  confidence?: number;
  requiresUserChoice?: boolean;
  availableConnections?: WorkspaceConnection[];
  suggestedMessage?: string;
  error?: string;
}

/**
 * Service for intelligently selecting workspace connections based on user preferences
 */
export class WorkspaceConnectionSelector {
  private permissionService: AgentWorkspacePermissionService;
  private db: IDatabaseProvider;

  constructor() {
    this.permissionService = new AgentWorkspacePermissionService();
    this.db = DatabaseService.getInstance();
  }

  /**
   * Select the best workspace connection for a given request
   */
  async selectConnection(request: ConnectionSelectionRequest): Promise<ConnectionSelectionResult> {
    try {
      // Get all available connections for the agent with the required capability
      const availableConnections = await this.getAvailableConnections(request.agentId, request.capability);

      if (availableConnections.length === 0) {
        return {
          success: false,
          error: `No ${request.capability} connections available. Please connect a workspace provider first.`,
          availableConnections: []
        };
      }

      // If only one connection is available, check if it matches the preference
      if (availableConnections.length === 1) {
        const connection = availableConnections[0];

        // If there's a sender preference, validate it against the single connection
        if (request.senderPreference) {
          const intelligentResult = await this.selectByPreference(
            availableConnections,
            request.senderPreference,
            request.recipientEmails
          );

          if (intelligentResult.success) {
            // Single connection matches preference - use it
            return {
              success: true,
              connectionId: connection.id,
              connection,
              reason: intelligentResult.reason || `Using your ${request.capability} connection: ${connection.displayName} (${connection.email})`,
              confidence: intelligentResult.confidence || 1.0,
              requiresUserChoice: false,
              availableConnections
            };
          } else {
            // Single connection doesn't match preference - ask for confirmation
            return {
              success: false,
              requiresUserChoice: true,
              availableConnections,
              suggestedMessage: `You requested ${request.senderPreference.value} email, but your only available connection is ${connection.email} (${connection.displayName}). Would you like to use this account instead?`,
              error: intelligentResult.error
            };
          }
        }

        // No preference specified - use the single connection
        return {
          success: true,
          connectionId: connection.id,
          connection,
          reason: `Using your only available ${request.capability} connection: ${connection.displayName} (${connection.email})`,
          confidence: 1.0,
          requiresUserChoice: false,
          availableConnections
        };
      }

      // Multiple connections available - apply intelligent selection
      if (request.senderPreference) {
        const intelligentResult = await this.selectByPreference(
          availableConnections,
          request.senderPreference,
          request.recipientEmails
        );

        if (intelligentResult.success && intelligentResult.confidence! >= 0.7) {
          // High confidence match - use directly
          return {
            ...intelligentResult,
            availableConnections,
            requiresUserChoice: false
          };
        }

        if (intelligentResult.success && intelligentResult.confidence! >= 0.5) {
          // Medium confidence - suggest but ask for confirmation
          return {
            ...intelligentResult,
            availableConnections,
            requiresUserChoice: true,
            suggestedMessage: this.generateConfirmationMessage(intelligentResult, availableConnections)
          };
        }

        // Check if it's a category mismatch (e.g., asking for personal but only have business)
        if (!intelligentResult.success && intelligentResult.requiresUserChoice && intelligentResult.suggestedMessage) {
          return {
            success: false,
            requiresUserChoice: true,
            availableConnections,
            suggestedMessage: intelligentResult.suggestedMessage,
            error: intelligentResult.error
          };
        }
      }

      // No preference or low confidence - ask user to choose
      return {
        success: false,
        requiresUserChoice: true,
        availableConnections,
        suggestedMessage: this.generateChoiceMessage(availableConnections, request.recipientEmails),
        error: 'Multiple email accounts available - please specify which one to use'
      };

    } catch (error) {
      logger.error('Error selecting workspace connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during connection selection',
        availableConnections: []
      };
    }
  }

  /**
   * Get available connections for an agent with a specific capability
   */
  private async getAvailableConnections(
    agentId: string,
    capability: WorkspaceCapabilityType
  ): Promise<WorkspaceConnection[]> {
    try {
      const permissions = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
      const capabilityPermissions = permissions.filter(p =>
        p.capability === capability && p.accessLevel === 'WRITE'
      );

      const connections: WorkspaceConnection[] = [];
      for (const permission of capabilityPermissions) {
        const connection = await this.db.getWorkspaceConnection(permission.connectionId);
        if (connection && connection.status === 'ACTIVE') {
          connections.push(connection);
        }
      }

      return connections;
    } catch (error) {
      logger.error('Error getting available connections:', error);
      return [];
    }
  }

  /**
   * Select connection based on user preference
   */
  private async selectByPreference(
    connections: WorkspaceConnection[],
    preference: SenderPreference,
    recipientEmails?: string[]
  ): Promise<ConnectionSelectionResult> {

    switch (preference.type) {
      case 'specific_email':
        return this.selectBySpecificEmail(connections, preference.value!, preference.confidence!);

      case 'provider':
        return this.selectByProvider(connections, preference.value!, preference.confidence!);

      case 'category':
        return this.selectByCategory(connections, preference.value!, preference.confidence!, recipientEmails);

      case 'domain':
        return this.selectByDomain(connections, preference.value!, preference.confidence!);

      default:
        return {
          success: false,
          error: 'Unknown preference type',
          confidence: 0
        };
    }
  }

  /**
   * Select by specific email address
   */
  private selectBySpecificEmail(
    connections: WorkspaceConnection[],
    email: string,
    confidence: number
  ): ConnectionSelectionResult {
    const connection = connections.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (connection) {
      return {
        success: true,
        connectionId: connection.id,
        connection,
        reason: `Using specified email address: ${connection.email}`,
        confidence
      };
    }

    return {
      success: false,
      error: `Email address ${email} not found in available connections`,
      confidence: 0
    };
  }

  /**
   * Select by provider type
   */
  private selectByProvider(
    connections: WorkspaceConnection[],
    provider: string,
    confidence: number
  ): ConnectionSelectionResult {
    const matchingConnections = connections.filter(c => c.provider === provider);

    if (matchingConnections.length === 1) {
      const connection = matchingConnections[0];
      return {
        success: true,
        connectionId: connection.id,
        connection,
        reason: `Using your ${this.getProviderDisplayName(provider)} account: ${connection.email}`,
        confidence
      };
    }

    if (matchingConnections.length > 1) {
      // Multiple accounts for the same provider - prefer primary/main account
      const primaryConnection = this.selectPrimaryConnection(matchingConnections);
      return {
        success: true,
        connectionId: primaryConnection.id,
        connection: primaryConnection,
        reason: `Using your primary ${this.getProviderDisplayName(provider)} account: ${primaryConnection.email}`,
        confidence: confidence * 0.9 // Slightly lower confidence due to multiple options
      };
    }

    return {
      success: false,
      error: `No ${this.getProviderDisplayName(provider)} connections available`,
      confidence: 0
    };
  }

  /**
   * Select by category (work, personal, etc.)
   */
  private selectByCategory(
    connections: WorkspaceConnection[],
    category: string,
    confidence: number,
    recipientEmails?: string[]
  ): ConnectionSelectionResult {
    const categoryConnections = this.filterByCategory(connections, category);

    if (categoryConnections.length === 1) {
      const connection = categoryConnections[0];
      return {
        success: true,
        connectionId: connection.id,
        connection,
        reason: `Using your ${category} email account: ${connection.email}`,
        confidence
      };
    }

    if (categoryConnections.length > 1) {
      // Multiple accounts in category - use domain matching if available
      if (recipientEmails && recipientEmails.length > 0) {
        const domainMatch = this.findDomainMatch(categoryConnections, recipientEmails);
        if (domainMatch) {
          return {
            success: true,
            connectionId: domainMatch.id,
            connection: domainMatch,
            reason: `Using your ${category} email account with matching domain: ${domainMatch.email}`,
            confidence: confidence * 1.1 // Boost confidence for domain match
          };
        }
      }

      // Fall back to primary connection
      const primaryConnection = this.selectPrimaryConnection(categoryConnections);
      return {
        success: true,
        connectionId: primaryConnection.id,
        connection: primaryConnection,
        reason: `Using your primary ${category} email account: ${primaryConnection.email}`,
        confidence: confidence * 0.8
      };
    }

    // No connections found for the requested category
    // Provide helpful fallback message suggesting available alternatives
    const workConnections = this.filterByCategory(connections, 'work');
    const personalConnections = this.filterByCategory(connections, 'personal');

    let fallbackMessage = `No ${category} email connections found.`;

    if (category === 'personal' && workConnections.length > 0) {
      fallbackMessage += ` You have ${workConnections.length} business email account(s) available: ${workConnections.map(c => c.email).join(', ')}. Would you like to use one of these instead?`;
    } else if (category === 'work' && personalConnections.length > 0) {
      fallbackMessage += ` You have ${personalConnections.length} personal email account(s) available: ${personalConnections.map(c => c.email).join(', ')}. Would you like to use one of these instead?`;
    } else if (connections.length > 0) {
      fallbackMessage += ` Available accounts: ${connections.map(c => c.email).join(', ')}.`;
    }

    return {
      success: false,
      error: fallbackMessage,
      confidence: 0,
      requiresUserChoice: true,
      availableConnections: connections,
      suggestedMessage: fallbackMessage
    };
  }

  /**
   * Select by domain hint
   */
  private selectByDomain(
    connections: WorkspaceConnection[],
    domain: string,
    confidence: number
  ): ConnectionSelectionResult {
    const domainConnections = connections.filter(c =>
      c.email.includes(domain) ||
      c.displayName?.toLowerCase().includes(domain.toLowerCase())
    );

    if (domainConnections.length > 0) {
      const connection = this.selectPrimaryConnection(domainConnections);
      return {
        success: true,
        connectionId: connection.id,
        connection,
        reason: `Using connection matching "${domain}": ${connection.email}`,
        confidence
      };
    }

    return {
      success: false,
      error: `No connections found matching "${domain}"`,
      confidence: 0
    };
  }

  /**
   * Filter connections by category based on email patterns and account types
   */
  private filterByCategory(connections: WorkspaceConnection[], category: string): WorkspaceConnection[] {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    const workIndicators = ['company', 'corp', 'inc', 'ltd', 'org', 'enterprise', 'business'];
    const educationIndicators = ['.edu', 'university', 'school', 'college', 'academic'];

    switch (category.toLowerCase()) {
      case 'personal':
      case 'private':
      case 'home':
      case 'individual':
        return connections.filter(c => {
          const email = c.email.toLowerCase();
          const domain = email.split('@')[1];
          const displayName = c.displayName?.toLowerCase() || '';
          return personalDomains.includes(domain) ||
            c.accountType === 'PERSONAL' ||
            ['personal', 'private', 'home'].some(keyword => displayName.includes(keyword));
        });

      case 'work':
      case 'business':
      case 'office':
      case 'company':
      case 'corporate':
      case 'professional':
      case 'job':
      case 'employer':
      case 'organization':
      case 'enterprise':
      case 'workplace':
        return connections.filter(c => {
          const email = c.email.toLowerCase();
          const domain = email.split('@')[1];
          const displayName = c.displayName?.toLowerCase() || '';
          return !personalDomains.includes(domain) ||
            c.accountType === 'ORGANIZATIONAL' ||
            workIndicators.some(indicator => domain.includes(indicator)) ||
            ['work', 'business', 'company', 'corporate', 'office'].some(keyword => displayName.includes(keyword));
        });

      case 'education':
      case 'school':
      case 'university':
      case 'college':
      case 'academic':
      case 'student':
        return connections.filter(c => {
          const email = c.email.toLowerCase();
          const displayName = c.displayName?.toLowerCase() || '';
          return educationIndicators.some(indicator =>
            email.includes(indicator) || displayName.includes(indicator)
          );
        });

      case 'client':
      case 'customer':
        return connections.filter(c => {
          const displayName = c.displayName?.toLowerCase() || '';
          return ['client', 'customer'].some(keyword => displayName.includes(keyword));
        });

      case 'primary':
      case 'main':
      case 'default':
      case 'usual':
      case 'regular':
      case 'normal':
        // Prefer organizational accounts, then first account
        const orgConnections = connections.filter(c => c.accountType === 'ORGANIZATIONAL');
        if (orgConnections.length > 0) return orgConnections;
        return connections.slice(0, 1); // Return first connection as default

      default:
        return connections;
    }
  }

  /**
   * Find connection with matching domain to recipients
   */
  private findDomainMatch(connections: WorkspaceConnection[], recipientEmails: string[]): WorkspaceConnection | null {
    for (const recipient of recipientEmails) {
      const recipientDomain = recipient.split('@')[1];
      const match = connections.find(c => {
        const connectionDomain = c.email.split('@')[1];
        return connectionDomain === recipientDomain;
      });
      if (match) return match;
    }
    return null;
  }

  /**
   * Select primary connection from a list (prefer organizational over personal)
   */
  private selectPrimaryConnection(connections: WorkspaceConnection[]): WorkspaceConnection {
    // Prefer organizational accounts
    const orgAccount = connections.find(c => c.accountType === 'ORGANIZATIONAL');
    if (orgAccount) return orgAccount;

    // Fall back to first available
    return connections[0];
  }

  /**
   * Get display name for provider
   */
  private getProviderDisplayName(provider: string): string {
    switch (provider) {
      case 'GOOGLE_WORKSPACE': return 'Google Workspace';
      case 'MICROSOFT_365': return 'Microsoft 365';
      case 'ZOHO': return 'Zoho';
      default: return provider;
    }
  }

  /**
   * Generate confirmation message for medium-confidence suggestions
   */
  private generateConfirmationMessage(
    result: ConnectionSelectionResult,
    availableConnections: WorkspaceConnection[]
  ): string {
    const other = availableConnections.filter(c => c.id !== result.connectionId);
    const otherList = other.map((c, i) => `${i + 2}. **${c.displayName} (${c.email})**`).join('\n');

    return `I found multiple email accounts. Based on your request, I'd recommend:\n\n` +
      `1. **${result.connection!.displayName} (${result.connection!.email})** - ${result.reason}\n\n` +
      `Other available accounts:\n${otherList}\n\n` +
      `Should I proceed with option 1, or would you prefer a different account?`;
  }

  /**
   * Generate choice message when user needs to select
   */
  private generateChoiceMessage(
    availableConnections: WorkspaceConnection[],
    recipientEmails?: string[]
  ): string {
    const connectionList = availableConnections.map((c, i) =>
      `${i + 1}. **${c.displayName} (${c.email})** - ${this.getProviderDisplayName(c.provider)}`
    ).join('\n');

    let message = `I found multiple email accounts connected:\n\n${connectionList}\n\n`;

    // Add domain-based recommendation if possible
    if (recipientEmails && recipientEmails.length > 0) {
      const recipientDomain = recipientEmails[0].split('@')[1];
      const domainMatch = availableConnections.find(c => {
        const connectionDomain = c.email.split('@')[1];
        return connectionDomain === recipientDomain;
      });

      if (domainMatch) {
        const index = availableConnections.indexOf(domainMatch) + 1;
        message += `Since you're emailing ${recipientDomain}, I'd recommend option ${index} as it matches the recipient's domain.\n\n`;
      }
    }

    message += `Which email account would you like to use? You can say "use option 1" or "use my Gmail account", etc.`;

    return message;
  }
} 