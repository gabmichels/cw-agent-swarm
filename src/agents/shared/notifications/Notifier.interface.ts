/**
 * Interface for sending notifications
 */
export interface Notifier {
  /**
   * Send a notification message
   */
  notify(message: string, type: string): Promise<void>;

  /**
   * Get the notifier ID
   */
  getId(): string;

  /**
   * Get the notifier type
   */
  getType(): string;

  /**
   * Check if the notifier is enabled
   */
  isEnabled(): boolean;

  /**
   * Enable/disable the notifier
   */
  setEnabled(enabled: boolean): void;
} 