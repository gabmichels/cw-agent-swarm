import { IEmailCapabilities } from '../interfaces/IEmailCapabilities';
import { EmailCapabilities } from '../EmailCapabilities';

/**
 * Google Workspace Email Capabilities Implementation
 * Extends the existing EmailCapabilities to implement the provider interface
 */
export class GoogleEmailCapabilities extends EmailCapabilities implements IEmailCapabilities {
  // All methods are inherited from EmailCapabilities
  // This class serves as the Google-specific implementation
} 