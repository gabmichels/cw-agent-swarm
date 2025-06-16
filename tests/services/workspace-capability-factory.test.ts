import { describe, it, expect } from 'vitest';
import { CapabilityFactory } from '../../src/services/workspace/capabilities/CapabilityFactory';
import { WorkspaceProvider } from '../../src/services/database/types';
import { GoogleEmailCapabilities } from '../../src/services/workspace/capabilities/google/GoogleEmailCapabilities';
import { GoogleCalendarCapabilities } from '../../src/services/workspace/capabilities/google/GoogleCalendarCapabilities';
import { GoogleSheetsCapabilities } from '../../src/services/workspace/capabilities/google/GoogleSheetsCapabilities';
import { GoogleDriveCapabilities } from '../../src/services/workspace/capabilities/google/GoogleDriveCapabilities';
import { GoogleDocumentCapabilities } from '../../src/services/workspace/capabilities/google/GoogleDocumentCapabilities';

describe('CapabilityFactory', () => {
  describe('createEmailCapabilities', () => {
    it('should create GoogleEmailCapabilities for Google Workspace', () => {
      const capabilities = CapabilityFactory.createEmailCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeInstanceOf(GoogleEmailCapabilities);
    });

    it('should throw error for Microsoft 365', () => {
      expect(() => {
        CapabilityFactory.createEmailCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 email capabilities not yet implemented');
    });

    it('should throw error for Zoho without provider instance', () => {
      expect(() => {
        CapabilityFactory.createEmailCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho provider instance required for email capabilities');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        CapabilityFactory.createEmailCapabilities('UNKNOWN' as WorkspaceProvider);
      }).toThrow('Unsupported workspace provider: UNKNOWN');
    });
  });

  describe('createCalendarCapabilities', () => {
    it('should create GoogleCalendarCapabilities for Google Workspace', () => {
      const capabilities = CapabilityFactory.createCalendarCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeInstanceOf(GoogleCalendarCapabilities);
    });

    it('should throw error for Microsoft 365', () => {
      expect(() => {
        CapabilityFactory.createCalendarCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 calendar capabilities not yet implemented');
    });

    it('should throw error for Zoho without provider instance', () => {
      expect(() => {
        CapabilityFactory.createCalendarCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho provider instance required for calendar capabilities');
    });
  });

  describe('createSheetsCapabilities', () => {
    it('should create GoogleSheetsCapabilities for Google Workspace', () => {
      const capabilities = CapabilityFactory.createSheetsCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeInstanceOf(GoogleSheetsCapabilities);
    });

    it('should throw error for Microsoft 365', () => {
      expect(() => {
        CapabilityFactory.createSheetsCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 sheets capabilities not yet implemented');
    });

    it('should throw error for Zoho without provider instance', () => {
      expect(() => {
        CapabilityFactory.createSheetsCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho provider instance required for sheets capabilities');
    });
  });

  describe('createDriveCapabilities', () => {
    it('should create GoogleDriveCapabilities for Google Workspace', () => {
      const capabilities = CapabilityFactory.createDriveCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeInstanceOf(GoogleDriveCapabilities);
    });

    it('should throw error for Microsoft 365', () => {
      expect(() => {
        CapabilityFactory.createDriveCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 drive capabilities not yet implemented');
    });

    it('should throw error for Zoho without provider instance', () => {
      expect(() => {
        CapabilityFactory.createDriveCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho provider instance required for drive capabilities');
    });
  });

  describe('createDocumentCapabilities', () => {
    it('should create GoogleDocumentCapabilities for Google Workspace', () => {
      const capabilities = CapabilityFactory.createDocumentCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeInstanceOf(GoogleDocumentCapabilities);
    });

    it('should throw error for Microsoft 365', () => {
      expect(() => {
        CapabilityFactory.createDocumentCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 document capabilities not yet implemented');
    });

    it('should throw error for Zoho without provider instance', () => {
      expect(() => {
        CapabilityFactory.createDocumentCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho provider instance required for document capabilities');
    });
  });

  describe('getSupportedProviders', () => {
    it('should return Google Workspace and Zoho as supported', () => {
      const supported = CapabilityFactory.getSupportedProviders();
      expect(supported).toEqual([WorkspaceProvider.GOOGLE_WORKSPACE, WorkspaceProvider.ZOHO]);
      expect(supported).toHaveLength(2);
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for Google Workspace', () => {
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.GOOGLE_WORKSPACE)).toBe(true);
    });

    it('should return false for Microsoft 365', () => {
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.MICROSOFT_365)).toBe(false);
    });

    it('should return true for Zoho', () => {
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.ZOHO)).toBe(true);
    });
  });

  describe('getProviderCapabilities', () => {
    it('should return all capabilities as true for Google Workspace', () => {
      const capabilities = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toEqual({
        email: true,
        calendar: true,
        sheets: true,
        drive: true,
        documents: true
      });
    });

    it('should return all capabilities as false for Microsoft 365', () => {
      const capabilities = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.MICROSOFT_365);
      expect(capabilities).toEqual({
        email: false,
        calendar: false,
        sheets: false,
        drive: false,
        documents: false
      });
    });

    it('should return all capabilities as true for Zoho', () => {
      const capabilities = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.ZOHO);
      expect(capabilities).toEqual({
        email: true,
        calendar: true,
        sheets: true,
        drive: true,
        documents: true
      });
    });

    it('should return all capabilities as false for unknown provider', () => {
      const capabilities = CapabilityFactory.getProviderCapabilities('UNKNOWN' as WorkspaceProvider);
      expect(capabilities).toEqual({
        email: false,
        calendar: false,
        sheets: false,
        drive: false,
        documents: false
      });
    });
  });
}); 