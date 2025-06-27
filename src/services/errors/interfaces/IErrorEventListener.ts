/**
 * Error Event Listener Interface
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Interface-first design with dependency injection
 * - Strict TypeScript typing
 * - Pure functions where possible
 */

import { BaseError } from '../../../lib/errors/types/BaseError';
import { ErrorResolutionInput } from './IErrorManagementService';

/**
 * Event listener interface for error management events
 */
export interface IErrorEventListener {
  /**
   * Called when a new error is logged
   */
  onErrorLogged(error: BaseError): Promise<void>;

  /**
   * Called when an error is resolved
   */
  onErrorResolved(errorId: string, resolution: ErrorResolutionInput): Promise<void>;

  /**
   * Called when an error is escalated
   */
  onErrorEscalated(errorId: string, reason: string): Promise<void>;

  /**
   * Called when retry is attempted
   */
  onRetryAttempted(errorId: string, attempt: number, success: boolean): Promise<void>;
} 