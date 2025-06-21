/**
 * NotionInterfaces.ts
 * Comprehensive TypeScript interfaces for Notion integration
 * Following IMPLEMENTATION_GUIDELINES.md principles
 */

import { ulid } from 'ulid';

// Base types
export type NotionObjectType = 'page' | 'database' | 'block' | 'user' | 'workspace';
export type NotionPropertyType = 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'relation' | 'rollup' | 'formula' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by';
export type NotionBlockType = 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'toggle' | 'code' | 'quote' | 'divider' | 'image' | 'video' | 'file' | 'bookmark' | 'table' | 'table_row' | 'embed';

// Core Notion entities
export interface NotionObject {
  readonly id: string;
  readonly object: NotionObjectType;
  readonly created_time: string;
  readonly last_edited_time: string;
  readonly archived: boolean;
}

export interface NotionPage extends NotionObject {
  readonly object: 'page';
  readonly parent: NotionParent;
  readonly properties: Record<string, NotionProperty>;
  readonly icon?: NotionIcon;
  readonly cover?: NotionFile;
  readonly url: string;
}

export interface NotionDatabase extends NotionObject {
  readonly object: 'database';
  readonly title: readonly NotionRichText[];
  readonly description: readonly NotionRichText[];
  readonly properties: Record<string, NotionPropertyDefinition>;
  readonly parent: NotionParent;
  readonly icon?: NotionIcon;
  readonly cover?: NotionFile;
  readonly url: string;
  readonly is_inline: boolean;
}

export interface NotionBlock extends NotionObject {
  readonly object: 'block';
  readonly type: NotionBlockType;
  readonly has_children: boolean;
  readonly parent: NotionParent;
  readonly [key: string]: any; // Block-specific properties
}

// Parent types
export interface NotionParent {
  readonly type: 'database_id' | 'page_id' | 'workspace';
  readonly database_id?: string;
  readonly page_id?: string;
  readonly workspace?: boolean;
}

// Property types
export interface NotionProperty {
  readonly id: string;
  readonly type: NotionPropertyType;
  readonly [key: string]: any; // Property-specific data
}

export interface NotionPropertyDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: NotionPropertyType;
  readonly [key: string]: any; // Property-specific configuration
}

// Rich text and formatting
export interface NotionRichText {
  readonly type: 'text' | 'mention' | 'equation';
  readonly text?: {
    readonly content: string;
    readonly link?: { readonly url: string };
  };
  readonly mention?: NotionMention;
  readonly equation?: { readonly expression: string };
  readonly annotations: NotionAnnotations;
  readonly plain_text: string;
  readonly href?: string;
}

export interface NotionAnnotations {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly strikethrough: boolean;
  readonly underline: boolean;
  readonly code: boolean;
  readonly color: string;
}

export interface NotionMention {
  readonly type: 'user' | 'page' | 'database' | 'date';
  readonly user?: NotionUser;
  readonly page?: { readonly id: string };
  readonly database?: { readonly id: string };
  readonly date?: NotionDate;
}

// User and file types
export interface NotionUser {
  readonly object: 'user';
  readonly id: string;
  readonly name?: string;
  readonly avatar_url?: string;
  readonly type: 'person' | 'bot';
  readonly person?: { readonly email: string };
  readonly bot?: Record<string, unknown>;
}

export interface NotionFile {
  readonly type: 'external' | 'file';
  readonly external?: { readonly url: string };
  readonly file?: { readonly url: string; readonly expiry_time: string };
}

export interface NotionIcon {
  readonly type: 'emoji' | 'external' | 'file';
  readonly emoji?: string;
  readonly external?: { readonly url: string };
  readonly file?: { readonly url: string; readonly expiry_time: string };
}

// Date types
export interface NotionDate {
  readonly start: string;
  readonly end?: string;
  readonly time_zone?: string;
}

// Filter and sort types
export interface NotionFilter {
  readonly property?: string;
  readonly timestamp?: 'created_time' | 'last_edited_time';
  readonly and?: readonly NotionFilter[];
  readonly or?: readonly NotionFilter[];
  readonly [key: string]: any; // Property-specific filters
}

export interface NotionSort {
  readonly property?: string;
  readonly timestamp?: 'created_time' | 'last_edited_time';
  readonly direction: 'ascending' | 'descending';
}

// Query parameters
export interface NotionQueryParams {
  readonly filter?: NotionFilter;
  readonly sorts?: readonly NotionSort[];
  readonly start_cursor?: string;
  readonly page_size?: number;
}

// Database schema definition
export interface DatabaseSchema {
  readonly title: string;
  readonly description?: string;
  readonly properties: Record<string, NotionPropertyDefinition>;
  readonly icon?: NotionIcon;
  readonly cover?: NotionFile;
  readonly parent: NotionParent;
}

// Page creation parameters
export interface PageCreationParams {
  readonly parent: NotionParent;
  readonly properties: Record<string, NotionProperty>;
  readonly children?: readonly NotionBlock[];
  readonly icon?: NotionIcon;
  readonly cover?: NotionFile;
}

// Service response types
export interface NotionServiceResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: NotionServiceError;
  readonly requestId: string; // ULID
}

export interface NotionQueryResponse<T> {
  readonly object: 'list';
  readonly results: readonly T[];
  readonly next_cursor?: string;
  readonly has_more: boolean;
  readonly type?: string;
  readonly page?: Record<string, unknown>;
  readonly request_id: string;
}

// Error types
export interface NotionServiceError {
  readonly id: string; // ULID
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
}

// Health status
export interface NotionHealthStatus {
  readonly isHealthy: boolean;
  readonly lastChecked: Date;
  readonly responseTime?: number;
  readonly errorCount: number;
  readonly rateLimitStatus: {
    readonly remaining: number;
    readonly resetTime: Date;
  };
}

// Configuration
export interface NotionServiceConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly rateLimitBuffer?: number;
}

// Factory functions for type safety
export const createNotionServiceResponse = <T>(
  success: boolean,
  data?: T,
  error?: NotionServiceError
): NotionServiceResponse<T> => ({
  success,
  data,
  error,
  requestId: ulid()
});

export const createNotionServiceError = (
  code: string,
  message: string,
  details?: Record<string, unknown>
): NotionServiceError => ({
  id: ulid(),
  code,
  message,
  details,
  timestamp: new Date()
});

export const createPageCreationParams = (
  parent: NotionParent,
  properties: Record<string, NotionProperty>,
  options?: {
    children?: readonly NotionBlock[];
    icon?: NotionIcon;
    cover?: NotionFile;
  }
): PageCreationParams => ({
  parent,
  properties,
  ...options
});

export const createDatabaseSchema = (
  title: string,
  properties: Record<string, NotionPropertyDefinition>,
  parent: NotionParent,
  options?: {
    description?: string;
    icon?: NotionIcon;
    cover?: NotionFile;
  }
): DatabaseSchema => ({
  title,
  properties,
  parent,
  ...options
}); 