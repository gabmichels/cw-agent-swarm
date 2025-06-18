/**
 * datetime.ts - Server-side date/time utility functions
 * 
 * This file provides utility functions for server-side date/time handling,
 * leveraging the centralized DateTimeService.
 */

import { dateTime } from '../../services/datetime/DateTimeService';

/**
 * Parse a date from various formats with server-specific handling
 * 
 * @param value - Date string, number, or Date object to parse
 * @returns Parsed Date (defaults to current time if parsing fails)
 */
export async function parseDate(value: string | Date | number): Promise<Date> {
  const result = await dateTime.parse(value);
  return result || new Date(); // Default to current time if parsing fails
}

/**
 * Format a date for server responses
 * 
 * @param date - Date to format
 * @param format - Optional format specification (defaults to ISO)
 * @returns Formatted date string
 */
export function formatDate(date: Date, format: string = 'ISO'): string {
  return dateTime.format(date, format);
}

/**
 * Check if a date is within a time window
 * 
 * @param date - Date to check
 * @param targetDate - Target date to compare against
 * @param windowMs - Time window in milliseconds
 * @returns True if date is within the specified window of targetDate
 */
export function isDateWithinWindow(date: Date, targetDate: Date, windowMs: number): boolean {
  return Math.abs(date.getTime() - targetDate.getTime()) < windowMs;
}

/**
 * Parse a natural language date expression
 * 
 * @param expression - Natural language expression (e.g., "tomorrow", "next week")
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Parsed Date or null if parsing fails
 */
export async function parseNaturalDate(expression: string, referenceDate?: Date): Promise<Date | null> {
  return await dateTime.getProcessor().parseNaturalLanguage(expression, referenceDate);
}

/**
 * Get the time difference between two dates in milliseconds
 * 
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Time difference in milliseconds
 */
export function getTimeDifference(date1: Date, date2: Date = new Date()): number {
  return Math.abs(date1.getTime() - date2.getTime());
}

/**
 * Check if a date is in the past
 * 
 * @param date - Date to check
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns True if date is in the past
 */
export function isInPast(date: Date, referenceDate?: Date): boolean {
  return dateTime.hasPassed(date, referenceDate);
}

/**
 * Check if a date is in the future
 * 
 * @param date - Date to check
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns True if date is in the future
 */
export function isInFuture(date: Date, referenceDate: Date = new Date()): boolean {
  return date.getTime() > referenceDate.getTime();
}

/**
 * Get a human-readable description of a date
 * 
 * @param date - Date to describe
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Human-readable description
 */
export function getHumanReadableDate(date: Date, referenceDate?: Date): string {
  return dateTime.getRelativeTime(date, referenceDate);
} 