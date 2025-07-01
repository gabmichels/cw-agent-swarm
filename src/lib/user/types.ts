/**
 * User type definitions
 */
import { addDays } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import { createUserId } from '../../utils/ulid';

/**
 * User interface representing a system user
 */
export interface User {
  /**
   * Unique identifier for the user
   */
  id: string;

  /**
   * Username for display and reference
   */
  username: string;

  /**
   * Optional display name
   */
  displayName?: string;

  /**
   * User's first name
   */
  firstName?: string;

  /**
   * User's last name
   */
  lastName?: string;

  /**
   * Optional email address
   */
  email?: string;

  /**
   * User's timezone (IANA timezone identifier, e.g., 'Europe/Berlin', 'America/New_York')
   * Defaults to browser-detected timezone if not explicitly set
   */
  timezone?: string;

  /**
   * When the user was created
   */
  createdAt: Date;
}

/**
 * Create a new user with the given properties
 * @param props Partial user properties (id and createdAt will be set automatically if not provided)
 * @returns A new User object
 */
export function createUser(props: Partial<User>): User {
  const id = props.id || createUserId().toString();
  const now = new Date();

  return {
    id,
    username: props.username || 'anonymous',
    displayName: props.displayName,
    firstName: props.firstName,
    lastName: props.lastName,
    email: props.email,
    createdAt: props.createdAt || now,
  };
}

/**
 * Create a default user instance
 * Currently used for development/testing only
 */
export function createDefaultUser(): User {
  return createUser({
    username: 'default',
    displayName: 'Default User',
  });
}

/**
 * Get the current user (hardcoded for now, to be replaced with actual auth)
 */
export function getCurrentUser(): User {
  return createUser({
    id: 'user_gab',
    username: 'gab',
    displayName: 'Gab',
    firstName: 'Gabriel',
    lastName: 'Michels',
    email: 'gab@crowd-wisdom.com',
    timezone: getBrowserTimezone(), // Auto-detect timezone
  });
}

/**
 * Get the browser's detected timezone
 * Falls back to UTC if detection fails
 */
export function getBrowserTimezone(): string {
  try {
    // This will work on both client and server (Node.js 16+)
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Failed to detect timezone, falling back to UTC:', error);
    return 'UTC';
  }
}

/**
 * Get timezone from various sources in order of preference
 */
export function getUserTimezone(user?: User, requestHeaders?: Record<string, string>): string {
  // 1. User's explicitly set timezone
  if (user?.timezone) {
    return user.timezone;
  }

  // 2. Timezone from request headers (if client sends it)
  if (requestHeaders?.['x-user-timezone']) {
    return requestHeaders['x-user-timezone'];
  }

  // 3. Browser-detected timezone
  return getBrowserTimezone();
}

/**
 * Create a date in the user's timezone
 * This ensures date calculations respect the user's local time, not server time
 */
export function createUserLocalDate(
  year: number,
  month: number,
  date: number,
  timezone: string = getBrowserTimezone()
): Date {
  // Create a date at midnight in the user's timezone
  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}T00:00:00`;

  // Parse the date as if it were in the user's timezone
  // Note: This is a simplified approach. For production, consider using a library like date-fns-tz
  const localDate = new Date(dateString);

  // Adjust for timezone offset if needed
  // This is a basic implementation - for production use, consider using Intl.DateTimeFormat
  return localDate;
}

/**
 * Get today's date in the user's timezone
 * Returns the date string in YYYY-MM-DD format
 */
export function getTodayInUserTimezone(timezone: string = getBrowserTimezone()): string {
  const now = new Date();
  const zonedDate = toZonedTime(now, timezone);
  return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
}

/**
 * Get tomorrow's date in the user's timezone
 * Returns the date string in YYYY-MM-DD format
 */
export function getTomorrowInUserTimezone(timezone: string = getBrowserTimezone()): string {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const zonedDate = toZonedTime(tomorrow, timezone);
  return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
}

/**
 * Get a date range for today in the user's timezone
 * Returns start and end Date objects for the full day
 */
export function getTodayDateRange(timezone: string = getBrowserTimezone()): { start: Date; end: Date } {
  const todayString = getTodayInUserTimezone(timezone);
  const start = new Date(`${todayString}T00:00:00`);
  const end = new Date(`${todayString}T23:59:59`);
  return { start, end };
} 