/**
 * DateTimeProcessor.interface.ts - Date/Time Processing Interface
 * 
 * This interface defines the contract for components that process and manipulate
 * date and time values, including natural language parsing capabilities.
 */

/**
 * Interface for the date/time processor component
 */
export interface DateTimeProcessor {
  /**
   * Map vague temporal expressions to concrete time values and priorities
   * 
   * @param expression - The vague expression (e.g., "urgent", "soon")
   * @param referenceDate - The reference date (defaults to current time)
   * @returns Object with date and priority, or null if not a recognized vague term
   */
  translateVagueTerm(expression: string, referenceDate?: Date): { date: Date | null; priority: number } | null;

  /**
   * Parse a natural language date/time expression into a standardized Date object
   * 
   * @param expression - The natural language expression to parse (e.g., "tomorrow", "next Tuesday", "in 3 days")
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns The parsed Date object or null if parsing fails
   */
  parseNaturalLanguage(expression: string, referenceDate?: Date): Date | null | Promise<Date | null>;
  
  /**
   * Format a Date object into a standardized string representation
   * 
   * @param date - The date to format
   * @param format - Optional format specification
   * @returns Formatted date string
   */
  formatDate(date: Date, format?: string): string;
  
  /**
   * Calculate a new date based on an interval description
   * 
   * @param baseDate - The starting date
   * @param interval - The interval description (e.g., "2 days", "1 week", "3 months")
   * @returns The calculated Date object
   */
  calculateInterval(baseDate: Date, interval: string): Date;
  
  /**
   * Check if a date has passed relative to the current time or a reference time
   * 
   * @param date - The date to check
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns True if the date has passed
   */
  hasPassed(date: Date, referenceDate?: Date): boolean;
  
  /**
   * Generate a cron expression from a natural language description
   * 
   * @param expression - Natural language expression for recurring schedule
   * @returns Valid cron expression
   */
  generateCronExpression(expression: string): string;
  
  /**
   * Parse a cron expression and return the next execution date
   * 
   * @param cronExpression - The cron expression to parse
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns The next execution date or null if the expression is invalid
   */
  getNextExecutionFromCron(cronExpression: string, referenceDate?: Date): Date | null;
  
  /**
   * Check if two dates are on the same day
   * 
   * @param date1 - First date to compare
   * @param date2 - Second date to compare
   * @returns True if both dates fall on the same calendar day
   */
  isSameDay(date1: Date, date2: Date): boolean;
  
  /**
   * Get a human-readable description of a time interval
   * 
   * @param startDate - The start date of the interval
   * @param endDate - The end date of the interval
   * @returns Human-readable description (e.g., "2 days", "1 hour and 30 minutes")
   */
  getHumanReadableInterval(startDate: Date, endDate: Date): string;
} 