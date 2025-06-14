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

// Zoho implementations
import { ZohoEmailCapabilities } from './zoho/ZohoEmailCapabilities';
import { ZohoCalendarCapabilities } from './zoho/ZohoCalendarCapabilities';
import { ZohoSheetsCapabilities } from './zoho/ZohoSheetsCapabilities';
import { ZohoDriveCapabilities } from './zoho/ZohoDriveCapabilities';

/**
 * Factory for creating provider-specific capability implementations
 * This ensures the correct API implementation is used based on the workspace provider
 */
export class CapabilityFactory {
  /**
   * Create email capabilities for the specified provider
   */
  static createEmailCapabilities(provider: WorkspaceProvider, connectionId: string, providerInstance?: any): IEmailCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleEmailCapabilities(connectionId);
      case WorkspaceProvider.ZOHO:
        if (!providerInstance) {
          throw new Error('Zoho provider instance required for email capabilities');
        }
        return new ZohoEmailCapabilities(connectionId, providerInstance);
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 email capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create calendar capabilities for the specified provider
   */
  static createCalendarCapabilities(provider: WorkspaceProvider, connectionId: string, providerInstance?: any): ICalendarCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleCalendarCapabilities(connectionId);
      case WorkspaceProvider.ZOHO:
        if (!providerInstance) {
          throw new Error('Zoho provider instance required for calendar capabilities');
        }
        return new ZohoCalendarCapabilities(connectionId, providerInstance);
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 calendar capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create sheets capabilities for the specified provider
   */
  static createSheetsCapabilities(provider: WorkspaceProvider, connectionId: string, providerInstance?: any): ISheetsCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleSheetsCapabilities(connectionId);
      case WorkspaceProvider.ZOHO:
        if (!providerInstance) {
          throw new Error('Zoho provider instance required for sheets capabilities');
        }
        return new ZohoSheetsCapabilities(connectionId, providerInstance);
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 sheets capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Create drive capabilities for the specified provider
   */
  static createDriveCapabilities(provider: WorkspaceProvider, connectionId: string, providerInstance?: any): IDriveCapabilities {
    switch (provider) {
      case WorkspaceProvider.GOOGLE_WORKSPACE:
        return new GoogleDriveCapabilities(connectionId);
      case WorkspaceProvider.ZOHO:
        if (!providerInstance) {
          throw new Error('Zoho provider instance required for drive capabilities');
        }
        return new ZohoDriveCapabilities(connectionId, providerInstance);
      case WorkspaceProvider.MICROSOFT_365:
        throw new Error('Microsoft 365 drive capabilities not yet implemented');
      default:
        throw new Error(`Unsupported workspace provider: ${provider}`);
    }
  }

  /**
   * Get all supported providers
   */
  static getSupportedProviders(): WorkspaceProvider[] {
    return [
      WorkspaceProvider.GOOGLE_WORKSPACE,
      WorkspaceProvider.ZOHO
      // WorkspaceProvider.MICROSOFT_365 // Coming soon
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
      case WorkspaceProvider.ZOHO:
        return {
          email: true,
          calendar: true,
          sheets: true,
          drive: true
        };
      case WorkspaceProvider.MICROSOFT_365:
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