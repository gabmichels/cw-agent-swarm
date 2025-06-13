import { WorkspaceProvider } from '../../database/types';
import { IEmailCapabilities } from './interfaces/IEmailCapabilities';
import { ICalendarCapabilities } from './interfaces/ICalendarCapabilities';
import { ISheetsCapabilities } from './interfaces/ISheetsCapabilities';
import { IDriveCapabilities } from './interfaces/IDriveCapabilities';

// Google implementations
import { GoogleEmailCapabilities } from './google/GoogleEmailCapabilities';
import { GoogleCalendarCapabilities } from './google/GoogleCalendarCapabilities';
import { GoogleSheetsCapabilities } from './google/GoogleSheetsCapabilities';
import { GoogleDriveCapabilities } from './google/GoogleDriveCapabilities';

/**
 * Factory for creating provider-specific capability implementations
 * This ensures the correct API implementation is used based on the workspace provider
 */
export class CapabilityFactory {
  /**
   * Create email capabilities for the specified provider
   */
  static createEmailCapabilities(provider: WorkspaceProvider): IEmailCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleEmailCapabilities();
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 email capabilities not yet implemented');
      case WorkspaceProvider.ZOHO:
        throw new Error('Zoho email capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create calendar capabilities for the specified provider
   */
  static createCalendarCapabilities(provider: WorkspaceProvider): ICalendarCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleCalendarCapabilities();
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 calendar capabilities not yet implemented');
      case WorkspaceProvider.ZOHO:
        throw new Error('Zoho calendar capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create spreadsheet capabilities for the specified provider
   */
  static createSheetsCapabilities(provider: WorkspaceProvider): ISheetsCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleSheetsCapabilities();
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 spreadsheet capabilities not yet implemented');
      case WorkspaceProvider.ZOHO:
        throw new Error('Zoho spreadsheet capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create drive capabilities for the specified provider
   */
  static createDriveCapabilities(provider: WorkspaceProvider): IDriveCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleDriveCapabilities();
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 drive capabilities not yet implemented');
      case WorkspaceProvider.ZOHO:
        throw new Error('Zoho drive capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Get all supported providers
   */
  static getSupportedProviders(): WorkspaceProvider[] {
    return [
      WorkspaceProvider.GOOGLE_WORKSPACE
      // WorkspaceProvider.MICROSOFT_365, // Coming soon
      // WorkspaceProvider.ZOHO // Coming soon
    ];
  }

  /**
   * Check if a provider is supported
   */
  static isProviderSupported(provider: WorkspaceProvider): boolean {
    return this.getSupportedProviders().includes(provider);
  }

  /**
   * Get provider-specific capability information
   */
  static getProviderCapabilities(provider: WorkspaceProvider): {
    email: boolean;
    calendar: boolean;
    sheets: boolean;
    drive: boolean;
  } {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return {
          email: true,
          calendar: true,
          sheets: true,
          drive: true
        };
      case WorkspaceProvider.MICROSOFT_365:
      case WorkspaceProvider.ZOHO:
        return {
          email: false,
          calendar: false,
          sheets: false,
          drive: false
        };
      default:
        return {
          email: false,
          calendar: false,
          sheets: false,
          drive: false
        };
    }
  }
} 