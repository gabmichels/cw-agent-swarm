/**
 * Centralized Workspace OAuth Scopes Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all workspace provider scopes.
 * All other files should import from here to avoid duplication and inconsistencies.
 */

import { WorkspaceProvider } from '../../database/types';

// Google Workspace Scopes
export const GOOGLE_WORKSPACE_SCOPES = {
  // Gmail scopes
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_MODIFY: 'https://www.googleapis.com/auth/gmail.modify',
  
  // Calendar scopes
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  
  // Drive scopes
  DRIVE: 'https://www.googleapis.com/auth/drive',
  
  // Sheets scopes
  SPREADSHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  
  // Docs scopes - Document editing capabilities
  DOCUMENTS: 'https://www.googleapis.com/auth/documents',
  DOCUMENTS_READONLY: 'https://www.googleapis.com/auth/documents.readonly',
  
  // User info scopes
  USERINFO_EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  USERINFO_PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
  
  // OpenID
  OPENID: 'openid'
} as const;

// Microsoft 365 Scopes
export const MICROSOFT_365_SCOPES = {
  // Mail scopes
  MAIL_READ_WRITE: 'https://graph.microsoft.com/Mail.ReadWrite',
  MAIL_SEND: 'https://graph.microsoft.com/Mail.Send',
  
  // Calendar scopes
  CALENDARS_READ_WRITE: 'https://graph.microsoft.com/Calendars.ReadWrite',
  
  // Files scopes
  FILES_READ_WRITE: 'https://graph.microsoft.com/Files.ReadWrite',
  
  // User scopes
  USER_READ: 'https://graph.microsoft.com/User.Read'
} as const;

// Zoho Workspace Scopes
export const ZOHO_SCOPES = {
  // Basic user info
  EMAIL: 'email',
  
  // Mail API scopes
  MAIL_ACCOUNTS_READ: 'ZohoMail.accounts.READ',
  MAIL_READ: 'ZohoMail.messages.READ',
  MAIL_SEND: 'ZohoMail.messages.CREATE',
  MAIL_MODIFY: 'ZohoMail.messages.UPDATE',
  
  // Calendar API scopes (COMPREHENSIVE: Using ALL scopes - confirmed they exist)
  CALENDAR_ALL: 'ZohoCalendar.calendar.ALL',
  EVENT_ALL: 'ZohoCalendar.event.ALL',
  SEARCH_ALL: 'ZohoCalendar.search.ALL',
  FREEBUSY_ALL: 'ZohoCalendar.freebusy.ALL',
  
  // Sheet API scopes (ONLY dataAPI scopes are valid)
  SHEET_DATA_READ: 'ZohoSheet.dataAPI.READ',
  SHEET_DATA_CREATE: 'ZohoSheet.dataAPI.CREATE',
  SHEET_DATA_UPDATE: 'ZohoSheet.dataAPI.UPDATE',
  SHEET_DATA_DELETE: 'ZohoSheet.dataAPI.DELETE',
  
  // Writer API scopes - Document editing capabilities
  WRITER_DOCUMENT_EDITOR_ALL: 'ZohoWriter.documentEditor.ALL',
  ZOHO_PC_FILES_ALL: 'ZohoPC.files.ALL',
  
  // WorkDrive API scopes (for file operations and search functionality)
  WORKDRIVE_FILES_ALL: 'WorkDrive.files.ALL',
  WORKDRIVE_ORGANIZATION_ALL: 'WorkDrive.organization.ALL',
  WORKDRIVE_WORKSPACE_ALL: 'WorkDrive.workspace.ALL',
  WORKDRIVE_TEAM_READ: 'WorkDrive.team.READ',
  ZOHO_SEARCH_READ: 'ZohoSearch.securesearch.READ'
} as const;

/**
 * Get required scopes for each workspace provider
 * This is the authoritative function that all other code should use
 */
export function getRequiredScopes(provider: WorkspaceProvider): string[] {
  switch (provider) {
    case WorkspaceProvider.GOOGLE_WORKSPACE:
      return [
        GOOGLE_WORKSPACE_SCOPES.OPENID,
        GOOGLE_WORKSPACE_SCOPES.GMAIL_SEND,
        GOOGLE_WORKSPACE_SCOPES.GMAIL_MODIFY,
        GOOGLE_WORKSPACE_SCOPES.CALENDAR,
        GOOGLE_WORKSPACE_SCOPES.DRIVE,
        GOOGLE_WORKSPACE_SCOPES.SPREADSHEETS,
        GOOGLE_WORKSPACE_SCOPES.DOCUMENTS,
        GOOGLE_WORKSPACE_SCOPES.USERINFO_EMAIL,
        GOOGLE_WORKSPACE_SCOPES.USERINFO_PROFILE
      ];
      
    case WorkspaceProvider.MICROSOFT_365:
      return [
        MICROSOFT_365_SCOPES.MAIL_READ_WRITE,
        MICROSOFT_365_SCOPES.MAIL_SEND,
        MICROSOFT_365_SCOPES.CALENDARS_READ_WRITE,
        MICROSOFT_365_SCOPES.FILES_READ_WRITE,
        MICROSOFT_365_SCOPES.USER_READ
      ];
      
    case WorkspaceProvider.ZOHO:
      return [
        ZOHO_SCOPES.EMAIL,
        ZOHO_SCOPES.MAIL_ACCOUNTS_READ,
        ZOHO_SCOPES.MAIL_READ,
        ZOHO_SCOPES.MAIL_SEND,
        ZOHO_SCOPES.CALENDAR_ALL,
        ZOHO_SCOPES.EVENT_ALL,
        ZOHO_SCOPES.SEARCH_ALL,
        ZOHO_SCOPES.FREEBUSY_ALL,
        ZOHO_SCOPES.SHEET_DATA_READ,
        ZOHO_SCOPES.SHEET_DATA_CREATE,
        ZOHO_SCOPES.SHEET_DATA_UPDATE,
        ZOHO_SCOPES.SHEET_DATA_DELETE,
        ZOHO_SCOPES.WRITER_DOCUMENT_EDITOR_ALL,
        ZOHO_SCOPES.ZOHO_PC_FILES_ALL,
        ZOHO_SCOPES.WORKDRIVE_FILES_ALL,
        ZOHO_SCOPES.WORKDRIVE_ORGANIZATION_ALL,
        ZOHO_SCOPES.WORKDRIVE_WORKSPACE_ALL,
        ZOHO_SCOPES.WORKDRIVE_TEAM_READ,
        ZOHO_SCOPES.ZOHO_SEARCH_READ
      ];
      
    default:
      return [];
  }
}

/**
 * Get extended scopes for advanced functionality (optional)
 */
export function getExtendedScopes(provider: WorkspaceProvider): string[] {
  switch (provider) {
    case WorkspaceProvider.GOOGLE_WORKSPACE:
      // For Google, add readonly docs scope for enhanced document viewing
      return [
        ...getRequiredScopes(provider),
        GOOGLE_WORKSPACE_SCOPES.DOCUMENTS_READONLY
      ];
      
    case WorkspaceProvider.ZOHO:
      // For Zoho, extended scopes are the same as required since we use ALL scopes
      return getRequiredScopes(provider);
      
    default:
      return getRequiredScopes(provider);
  }
}

/**
 * Validate that a connection has the required scopes
 */
export function validateScopes(provider: WorkspaceProvider, connectionScopes: string): boolean {
  const requiredScopes = getRequiredScopes(provider);
  const connectionScopeList = connectionScopes.split(' ').filter(s => s.trim());
  
  return requiredScopes.every(scope => connectionScopeList.includes(scope));
}

/**
 * Get missing scopes for a connection
 */
export function getMissingScopes(provider: WorkspaceProvider, connectionScopes: string): string[] {
  const requiredScopes = getRequiredScopes(provider);
  const connectionScopeList = connectionScopes.split(' ').filter(s => s.trim());
  
  return requiredScopes.filter(scope => !connectionScopeList.includes(scope));
} 