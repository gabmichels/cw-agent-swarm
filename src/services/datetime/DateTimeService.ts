/**
 * DateTimeService.ts - Centralized date/time processing service
 * 
 * This service provides a singleton wrapper around the DateTimeProcessor to ensure
 * consistent date/time handling throughout the application.
 */

import { BasicDateTimeProcessor } from '../../lib/scheduler/implementations/datetime/BasicDateTimeProcessor';
import { DateTimeProcessor } from '../../lib/scheduler/interfaces/DateTimeProcessor.interface';

/**
 * Singleton service for date/time processing across the application
 */
export class DateTimeService {
  private static instance: DateTimeService;
  private processor: DateTimeProcessor;

  private constructor() {
    this.processor = new BasicDateTimeProcessor();
  }

  static getInstance(): DateTimeService {
    if (!DateTimeService.instance) {
      DateTimeService.instance = new DateTimeService();
    }
    return DateTimeService.instance;
  }

  /**
   * Parse a date string or natural language expression
   * 
   * @param value - Date string, number, or Date object to parse
   * @param referenceDate - Optional reference date for relative expressions
   * @returns Parsed Date object or null if parsing fails
   */
  async parse(value: string | Date | number, referenceDate?: Date): Promise<Date | null> {
    if (value instanceof Date) return value;
    
    if (typeof value === 'number') {
      return new Date(value);
    }
    
    // Try natural language parsing first
    const nlpResult = await this.processor.parseNaturalLanguage(value, referenceDate);
    if (nlpResult) return nlpResult;
    
    // Fall back to standard date parsing
    try {
      return new Date(value);
    } catch (e) {
      return null;
    }
  }

  /**
   * Format a date to a standardized string
   * 
   * @param date - Date to format
   * @param format - Optional format specification
   * @returns Formatted date string
   */
  format(date: Date, format?: string): string {
    return this.processor.formatDate(date, format);
  }

  /**
   * Get a relative time description (e.g., "2 days ago")
   * 
   * @param date - The date to describe
   * @param referenceDate - Optional reference date (defaults to now)
   * @returns Human-readable interval description
   */
  getRelativeTime(date: Date, referenceDate?: Date): string {
    const reference = referenceDate || new Date();
    return this.processor.getHumanReadableInterval(reference, date);
  }

  /**
   * Check if a date has passed
   * 
   * @param date - The date to check
   * @param referenceDate - Optional reference date (defaults to now)
   * @returns True if the date has passed
   */
  hasPassed(date: Date, referenceDate?: Date): boolean {
    return this.processor.hasPassed(date, referenceDate);
  }

  /**
   * Translate vague temporal expressions
   * 
   * @param expression - Vague expression like "urgent", "soon"
   * @param referenceDate - Optional reference date (defaults to now)
   * @returns Object with date and priority
   */
  translateVagueTerm(expression: string, referenceDate?: Date): { date: Date | null; priority: number } | null {
    return this.processor.translateVagueTerm(expression, referenceDate);
  }

  /**
   * Calculate a date based on an interval description
   * 
   * @param baseDate - Starting date
   * @param interval - Interval description (e.g., "2 days", "1 week")
   * @returns The calculated date
   */
  calculateInterval(baseDate: Date, interval: string): Date {
    return this.processor.calculateInterval(baseDate, interval);
  }

  /**
   * Check if two dates are on the same day
   * 
   * @param date1 - First date
   * @param date2 - Second date
   * @returns True if dates are on the same day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return this.processor.isSameDay(date1, date2);
  }

  /**
   * Get the underlying processor
   * 
   * @returns The DateTimeProcessor instance
   */
  getProcessor(): DateTimeProcessor {
    return this.processor;
  }
}

// Export a convenient singleton instance
export const dateTime = DateTimeService.getInstance(); 