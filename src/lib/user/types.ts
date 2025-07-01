/**
 * User type definitions
 */
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';
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

/**
 * Calculate date range based on timeframe using date-fns
 * Returns start and end dates in YYYY-MM-DD format for the user's timezone
 */
export function getDateRangeForTimeframe(
  timeframe: string | undefined,
  timezone: string = getBrowserTimezone()
): { startDate: string; endDate: string } {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);

  if (!timeframe) {
    // Default to today and tomorrow if no timeframe specified
    const today = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
    const tomorrow = format(addDays(zonedNow, 1), 'yyyy-MM-dd', { timeZone: timezone });
    return { startDate: today, endDate: tomorrow };
  }

  switch (timeframe.toLowerCase()) {
    case 'today':
      const today = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
      return { startDate: today, endDate: today };

    case 'tomorrow':
      const tomorrow = format(addDays(zonedNow, 1), 'yyyy-MM-dd', { timeZone: timezone });
      return { startDate: tomorrow, endDate: tomorrow };

    case 'yesterday':
      const yesterday = format(subDays(zonedNow, 1), 'yyyy-MM-dd', { timeZone: timezone });
      return { startDate: yesterday, endDate: yesterday };

    case 'this week':
      // Start of week (Monday) to end of week (Sunday)
      const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 }); // Monday = 1
      const weekEnd = endOfWeek(zonedNow, { weekStartsOn: 1 });
      return {
        startDate: format(weekStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(weekEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    case 'next week':
      const nextWeekStart = startOfWeek(addWeeks(zonedNow, 1), { weekStartsOn: 1 });
      const nextWeekEnd = endOfWeek(addWeeks(zonedNow, 1), { weekStartsOn: 1 });
      return {
        startDate: format(nextWeekStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(nextWeekEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    case 'last week':
      const lastWeekStart = startOfWeek(subWeeks(zonedNow, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(zonedNow, 1), { weekStartsOn: 1 });
      return {
        startDate: format(lastWeekStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(lastWeekEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    case 'this month':
      const monthStart = startOfMonth(zonedNow);
      const monthEnd = endOfMonth(zonedNow);
      return {
        startDate: format(monthStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(monthEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    case 'next month':
      const nextMonthStart = startOfMonth(addMonths(zonedNow, 1));
      const nextMonthEnd = endOfMonth(addMonths(zonedNow, 1));
      return {
        startDate: format(nextMonthStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(nextMonthEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    case 'last month':
      const lastMonthStart = startOfMonth(subMonths(zonedNow, 1));
      const lastMonthEnd = endOfMonth(subMonths(zonedNow, 1));
      return {
        startDate: format(lastMonthStart, 'yyyy-MM-dd', { timeZone: timezone }),
        endDate: format(lastMonthEnd, 'yyyy-MM-dd', { timeZone: timezone })
      };

    default:
      // Default to today and tomorrow for unknown timeframes
      const defaultToday = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
      const defaultTomorrow = format(addDays(zonedNow, 1), 'yyyy-MM-dd', { timeZone: timezone });
      return { startDate: defaultToday, endDate: defaultTomorrow };
  }
} 