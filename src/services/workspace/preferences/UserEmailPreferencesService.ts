import { logger } from '../../../lib/logging';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { UserEmailImportanceCriteria } from '../capabilities/EmailCapabilities';

export interface UserEmailPreference {
  id: string;
  userId: string;
  criteria: UserEmailImportanceCriteria;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserEmailPreferencesService {
  private db: IDatabaseProvider;

  // Hardcoded user preferences - can be easily modified here
  private readonly hardcodedPreferences: { [userId: string]: UserEmailImportanceCriteria } = {
    'test-user': {
      urgentKeywords: ['urgent', 'asap', 'emergency', 'critical', 'immediate', 'deadline', 'proposal', 'contract', 'invoice', 'declined'],
      importantSenders: ['boss@company.com', 'billing@services.com', 'accounting@company.com'],
      importantDomains: ['client-company.com', 'bank.com', 'government.gov', 'irs.gov'],
      subjectPatterns: ['action required', 'response needed', 'approval needed', 'meeting declined', 'invoice', 'payment'],
      priorityLabels: ['IMPORTANT', 'CATEGORY_PERSONAL', 'CATEGORY_PROMOTIONS'],
      customRules: [
        { rule: 'declined', weight: 0.8, description: 'Meeting declines need attention' },
        { rule: 'invoice', weight: 0.9, description: 'Financial documents are high priority' },
        { rule: 'payment', weight: 0.9, description: 'Payment-related emails' },
        { rule: 'contract', weight: 0.9, description: 'Legal documents need review' }
      ]
    },
    // Default preferences for any other user
    'default': {
      urgentKeywords: ['urgent', 'asap', 'emergency', 'critical', 'immediate', 'deadline'],
      importantSenders: [],
      importantDomains: [],
      subjectPatterns: ['action required', 'response needed', 'approval needed'],
      priorityLabels: ['IMPORTANT'],
      customRules: []
    }
  };

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get user's email importance criteria
   */
  async getUserImportanceCriteria(userId: string): Promise<UserEmailImportanceCriteria | null> {
    try {
      // Check if user has specific preferences
      if (this.hardcodedPreferences[userId]) {
        logger.debug('Using hardcoded preferences for user', { userId });
        return this.hardcodedPreferences[userId];
      }

      // Fall back to default preferences
      if (this.hardcodedPreferences['default']) {
        logger.debug('Using default preferences for user', { userId });
        return this.hardcodedPreferences['default'];
      }

      // No preferences found
      logger.debug('No preferences found for user', { userId });
      return null;
    } catch (error) {
      logger.error('Failed to get user importance criteria', { userId, error });
      return null;
    }
  }

  /**
   * Set user's email importance criteria (in-memory only for now)
   */
  async setUserImportanceCriteria(userId: string, criteria: UserEmailImportanceCriteria): Promise<void> {
    try {
      // For now, just log that this would update preferences
      // In the future, this could update a database or persistent storage
      logger.info('Would update user email importance criteria', {
        userId,
        criteriaKeys: Object.keys(criteria),
        urgentKeywordsCount: criteria.urgentKeywords?.length || 0,
        importantSendersCount: criteria.importantSenders?.length || 0,
        customRulesCount: criteria.customRules?.length || 0
      });

      // For development, we could temporarily store in memory
      // this.hardcodedPreferences[userId] = criteria;

    } catch (error) {
      logger.error('Failed to set user importance criteria', { userId, error });
      throw error;
    }
  }

  /**
   * Add a new user preference programmatically
   */
  addUserPreference(userId: string, criteria: UserEmailImportanceCriteria): void {
    this.hardcodedPreferences[userId] = criteria;
    logger.info('Added hardcoded user preference', { userId });
  }

  /**
   * Get all configured users (for debugging)
   */
  getConfiguredUsers(): string[] {
    return Object.keys(this.hardcodedPreferences);
  }

  /**
   * Get default importance criteria for new users
   */
  getDefaultCriteria(): UserEmailImportanceCriteria {
    return this.hardcodedPreferences['default'] || {
      urgentKeywords: ['urgent', 'asap', 'emergency', 'critical', 'immediate', 'deadline'],
      importantSenders: [],
      importantDomains: [],
      subjectPatterns: ['action required', 'response needed'],
      priorityLabels: ['IMPORTANT'],
      customRules: []
    };
  }
} 