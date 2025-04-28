/**
 * Notifier Manager
 * 
 * Standardized implementation of a manager for handling notifications in the Chloe agent system.
 * Follows the manager standardization guidelines.
 */
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { TaskLogger } from '../task-logger';
import { logger } from '../../../lib/logging';
import { Notifier } from '../notifiers/index';

/**
 * Options for initializing the notifier manager
 */
export interface NotifierManagerOptions extends BaseManagerOptions {
  // Common options
  logger?: TaskLogger;
  
  // Manager-specific options
  notifiers?: Notifier[];
}

/**
 * Standardized notifier manager implementation
 * Handles sending notifications to various channels
 */
export class NotifierManager implements IManager {
  // Required core properties
  private agentId: string;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
  // Manager-specific properties
  private notifiers: Notifier[] = [];
  
  /**
   * Constructor
   */
  constructor(options: NotifierManagerOptions) {
    this.agentId = options.agentId;
    this.taskLogger = options.logger || null;
    
    // Initialize notifiers if provided
    if (options.notifiers && Array.isArray(options.notifiers)) {
      this.notifiers = options.notifiers;
    }
  }
  
  /**
   * Get the agent ID this manager belongs to
   * Required by IManager interface
   */
  getAgentId(): string {
    return this.agentId;
  }
  
  /**
   * Log an action performed by this manager
   * Required by IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`NotifierManager: ${action}`, metadata);
    } else {
      logger.info(`NotifierManager: ${action}`, metadata);
    }
  }
  
  /**
   * Initialize the notifier manager
   * Required by IManager interface
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing notifier manager');
      
      // Initialize all notifiers
      const initPromises = this.notifiers.map(async (notifier) => {
        try {
          const success = await notifier.initialize();
          if (success) {
            this.logAction(`Initialized notifier: ${notifier.name}`);
          } else {
            this.logAction(`Failed to initialize notifier: ${notifier.name}`, { reason: 'Initialization returned false' });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logAction(`Failed to initialize notifier: ${notifier.name}`, { error: errorMessage });
          throw error;
        }
      });
      
      await Promise.all(initPromises);
      
      this.initialized = true;
      this.logAction('Notifier manager initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error initializing notifier manager', { error: errorMessage });
      throw error;
    }
  }
  
  /**
   * Shutdown and cleanup resources
   * Optional but recommended method in IManager interface
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down notifier manager');
      
      // Shutdown all notifiers that support shutdown
      const shutdownPromises = this.notifiers.map(async (notifier) => {
        if (notifier.shutdown) {
          try {
            await notifier.shutdown();
            this.logAction(`Shut down notifier: ${notifier.name}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logAction(`Failed to shut down notifier: ${notifier.name}`, { error: errorMessage });
            // Don't throw, try to shut down other notifiers
          }
        }
      });
      
      await Promise.all(shutdownPromises);
      
      this.logAction('Notifier manager shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during notifier manager shutdown', { error: errorMessage });
      throw error;
    }
  }
  
  /**
   * Check if the manager is initialized
   * Required by IManager interface
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Add a notifier to the manager
   * @param notifier The notifier to add
   */
  addNotifier(notifier: Notifier): void {
    this.logAction('Adding notifier', { type: notifier.name });
    this.notifiers.push(notifier);
    
    // Initialize the notifier if the manager is already initialized
    if (this.initialized) {
      notifier.initialize().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logAction('Failed to initialize new notifier', { error: errorMessage });
      });
    }
  }
  
  /**
   * Remove a notifier from the manager
   * @param index The index of the notifier to remove
   * @returns True if notifier was removed, false otherwise
   */
  removeNotifier(index: number): boolean {
    if (index < 0 || index >= this.notifiers.length) {
      this.logAction('Failed to remove notifier', { reason: 'Invalid index', index });
      return false;
    }
    
    const notifier = this.notifiers[index];
    
    // Shutdown the notifier if possible
    if (notifier.shutdown) {
      notifier.shutdown().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logAction('Error shutting down notifier during removal', { error: errorMessage });
      });
    }
    
    // Remove the notifier
    this.notifiers.splice(index, 1);
    this.logAction('Removed notifier', { index, name: notifier.name });
    
    return true;
  }
  
  /**
   * Get all registered notifiers
   * @returns Array of notifiers
   */
  getNotifiers(): Notifier[] {
    return [...this.notifiers];
  }
  
  /**
   * Send a notification message to all registered notifiers
   * @param message The message to send
   * @param options Optional settings for the notification
   * @returns Promise that resolves when all notifications have been sent
   */
  async notify(message: string, options?: { 
    level?: 'info' | 'warning' | 'error',
    tags?: string[]
  }): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (this.notifiers.length === 0) {
        this.logAction('No notifiers available to send message');
        return;
      }
      
      // Log the notification
      this.logAction('Sending notification', { 
        message: message.length > 100 ? `${message.substring(0, 100)}...` : message,
        level: options?.level || 'info',
        tags: options?.tags,
        notifierCount: this.notifiers.length
      });
      
      // Format the message based on options
      let formattedMessage = message;
      if (options?.level === 'warning') {
        formattedMessage = `⚠️ WARNING: ${message}`;
      } else if (options?.level === 'error') {
        formattedMessage = `🚨 ERROR: ${message}`;
      }
      
      // Add tags if provided
      if (options?.tags && options.tags.length > 0) {
        formattedMessage += `\n\nTags: ${options.tags.join(', ')}`;
      }
      
      // Send to all notifiers
      const sendPromises = this.notifiers.map(async (notifier) => {
        try {
          const result = await notifier.send(formattedMessage);
          if (result === false) {
            this.logAction('Notifier returned false when sending message', {
              notifier: notifier.name
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logAction('Failed to send notification', { 
            notifier: notifier.name,
            error: errorMessage
          });
          // Don't throw to allow other notifiers to try
        }
      });
      
      await Promise.all(sendPromises);
      
      this.logAction('Notification sent to all available notifiers');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error sending notification', { error: errorMessage });
      throw new Error(`Failed to send notification: ${errorMessage}`);
    }
  }
} 