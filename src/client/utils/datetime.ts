/**
 * datetime.ts - Client-side date/time utility functions
 * 
 * This file provides utility functions for client-side date/time handling,
 * leveraging the centralized DateTimeService.
 */

import { dateTime } from '../../services/datetime/DateTimeService';

/**
 * Format a date for display in the UI
 * 
 * @param date - Date to format (can be Date, string, or timestamp)
 * @param format - Optional format specification
 * @returns Formatted date string
 */
export async function formatDisplayDate(date: Date | string | number, format?: string): Promise<string> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return 'Invalid date';
  
  if (format) {
    return dateTime.format(parsedDate, format);
  }
  
  return parsedDate.toLocaleString();
}

/**
 * Format a date as a relative time string (e.g., "2 days ago")
 * 
 * @param date - Date to format (can be Date, string, or timestamp)
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Relative time string
 */
export async function getRelativeTime(date: Date | string | number, referenceDate?: Date): Promise<string> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return 'Unknown time';
  
  return dateTime.getRelativeTime(parsedDate, referenceDate);
}

/**
 * Compare two dates for sorting
 * 
 * @param a - First date (can be Date, string, or timestamp)
 * @param b - Second date (can be Date, string, or timestamp)
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export async function compareDates(a: Date | string | number, b: Date | string | number): Promise<number> {
  const dateA = await dateTime.parse(a);
  const dateB = await dateTime.parse(b);
  
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  return dateA.getTime() - dateB.getTime();
}

/**
 * Check if a date is today
 * 
 * @param date - Date to check (can be Date, string, or timestamp)
 * @returns True if the date is today
 */
export async function isToday(date: Date | string | number): Promise<boolean> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return false;
  
  const today = new Date();
  return dateTime.isSameDay(parsedDate, today);
}

/**
 * Format a date as a time string (e.g., "2:30 PM")
 * 
 * @param date - Date to format (can be Date, string, or timestamp)
 * @returns Formatted time string
 */
export async function formatTime(date: Date | string | number): Promise<string> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return 'Invalid time';
  
  return parsedDate.toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Format a date as a date string (e.g., "Jan 1, 2023")
 * 
 * @param date - Date to format (can be Date, string, or timestamp)
 * @returns Formatted date string
 */
export async function formatDate(date: Date | string | number): Promise<string> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return 'Invalid date';
  
  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get a smart date string that uses relative time for recent dates
 * and full dates for older ones
 * 
 * @param date - Date to format (can be Date, string, or timestamp)
 * @returns Smart date string
 */
export async function getSmartDateString(date: Date | string | number): Promise<string> {
  const parsedDate = await dateTime.parse(date);
  if (!parsedDate) return 'Invalid date';
  
  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // For dates less than 7 days old, use relative time
  if (diffDays < 7) {
    return getRelativeTime(parsedDate);
  }
  
  // Otherwise use formatted date
  return formatDate(parsedDate);
} 