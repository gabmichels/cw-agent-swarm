/**
 * BasicDateTimeProcessor.ts - Basic Date/Time Processor Implementation
 * 
 * This file provides a basic implementation of the DateTimeProcessor interface
 * for parsing and manipulating dates and times, including natural language processing.
 */

import { DateTimeProcessor } from '../../interfaces/DateTimeProcessor.interface';

/**
 * Helper function to add time to a date
 */
function addTime(date: Date, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'): Date {
  const result = new Date(date);
  
  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'hours':
      result.setHours(result.getHours() + amount);
      break;
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'weeks':
      result.setDate(result.getDate() + (amount * 7));
      break;
    case 'months':
      result.setMonth(result.getMonth() + amount);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + amount);
      break;
  }
  
  return result;
}

/**
 * Set a date to the end of day (23:59:59.999)
 */
function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Set a date to the end of week (Sunday 23:59:59.999)
 */
function endOfWeek(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilSunday);
  return endOfDay(result);
}

/**
 * Set a date to the end of month (last day 23:59:59.999)
 */
function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0); // Set to last day of current month
  return endOfDay(result);
}

/**
 * Basic implementation of the DateTimeProcessor interface
 * 
 * Note: This is a simplified implementation. For a production-ready solution,
 * it's recommended to use a specialized NLP library for date/time parsing.
 */
export class BasicDateTimeProcessor implements DateTimeProcessor {
  /**
   * Map vague temporal expressions to concrete time values and priorities
   * 
   * @param expression - The vague expression (e.g., "urgent", "soon")
   * @param referenceDate - The reference date (defaults to current time)
   * @returns Object with date and priority, or null if not a recognized vague term
   */
  translateVagueTerm(expression: string, referenceDate?: Date): { date: Date | null; priority: number } | null {
    const now = referenceDate || new Date();
    const lowerExpression = expression.toLowerCase().trim();
    
    // Map of vague terms to concrete times and priorities
    const vagueTermMap: Record<string, { date: Date; priority: number }> = {
      'urgent': { date: new Date(now), priority: 10 },
      'immediate': { date: new Date(now), priority: 10 },
      'immediately': { date: new Date(now), priority: 10 },
      'right away': { date: new Date(now), priority: 10 },
      'asap': { date: addTime(new Date(now), 1, 'hours'), priority: 9 },
      'very soon': { date: addTime(new Date(now), 2, 'hours'), priority: 9 },
      'soon': { date: addTime(new Date(now), 4, 'hours'), priority: 8 },
      'shortly': { date: addTime(new Date(now), 4, 'hours'), priority: 8 },
      'today': { date: endOfDay(new Date(now)), priority: 7 },
      'by today': { date: endOfDay(new Date(now)), priority: 7 },
      'end of day': { date: endOfDay(new Date(now)), priority: 7 },
      'by tomorrow': { date: addTime(endOfDay(new Date(now)), 1, 'days'), priority: 6 },
      'a couple of days': { date: addTime(new Date(now), 2, 'days'), priority: 5 },
      'a couple days': { date: addTime(new Date(now), 2, 'days'), priority: 5 },
      'a few days': { date: addTime(new Date(now), 3, 'days'), priority: 5 },
      'this week': { date: endOfWeek(new Date(now)), priority: 4 },
      'by the end of the week': { date: endOfWeek(new Date(now)), priority: 4 },
      'end of week': { date: endOfWeek(new Date(now)), priority: 4 },
      'this month': { date: endOfMonth(new Date(now)), priority: 3 },
      'by the end of the month': { date: endOfMonth(new Date(now)), priority: 3 },
      'end of month': { date: endOfMonth(new Date(now)), priority: 3 },
      'whenever': { date: addTime(new Date(now), 30, 'days'), priority: 1 },
      'low priority': { date: addTime(new Date(now), 7, 'days'), priority: 2 }
    };
    
    // Check if the expression is a known vague term
    if (vagueTermMap[lowerExpression]) {
      return vagueTermMap[lowerExpression];
    }
    
    // Check if expression contains any of the vague terms
    for (const [term, value] of Object.entries(vagueTermMap)) {
      if (lowerExpression.includes(term)) {
        return value;
      }
    }
    
    return null;
  }

  /**
   * Parse a natural language date/time expression into a standardized Date object
   * 
   * @param expression - The natural language expression to parse (e.g., "tomorrow", "next Tuesday", "in 3 days")
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns The parsed Date object or null if parsing fails
   */
  parseNaturalLanguage(expression: string, referenceDate?: Date): Date | null {
    try {
      const now = referenceDate || new Date();
      const lowerExpression = expression.toLowerCase().trim();
      
      // Check for vague terms first
      const vagueResult = this.translateVagueTerm(lowerExpression, now);
      if (vagueResult) {
        return vagueResult.date;
      }
      
      // Handle special cases
      if (lowerExpression === 'now') {
        return new Date(now);
      }
      
      if (lowerExpression === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return today;
      }
      
      if (lowerExpression === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      }
      
      if (lowerExpression === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return yesterday;
      }

      // Handle complex expressions
      if (lowerExpression === 'day after tomorrow') {
        const dayAfterTomorrow = new Date(now);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        dayAfterTomorrow.setHours(0, 0, 0, 0);
        return dayAfterTomorrow;
      }

      if (lowerExpression === 'day before yesterday') {
        const dayBeforeYesterday = new Date(now);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
        dayBeforeYesterday.setHours(0, 0, 0, 0);
        return dayBeforeYesterday;
      }
      
      // Handle "next week X" expressions
      const nextWeekDayMatch = lowerExpression.match(/^next week (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
      if (nextWeekDayMatch) {
        const dayName = nextWeekDayMatch[1];
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = daysOfWeek.indexOf(dayName);
        
        if (dayIndex !== -1) {
          const targetDate = new Date(now);
          const currentDayOfWeek = targetDate.getDay();
          
          // Calculate days to add: 7 (for next week) + days until target day
          let daysToAdd = 7 + (dayIndex - currentDayOfWeek);
          if (daysToAdd > 13) {
            daysToAdd -= 7; // Adjust if we're adding too many days
          }
          
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          targetDate.setHours(0, 0, 0, 0);
          return targetDate;
        }
      }
      
      // Handle "X weeks from now"
      const weeksFromNowMatch = lowerExpression.match(/^(\d+) weeks? from now$/);
      if (weeksFromNowMatch) {
        const weeks = parseInt(weeksFromNowMatch[1], 10);
        return addTime(now, weeks, 'weeks');
      }
      
      // Handle "X months from now"
      const monthsFromNowMatch = lowerExpression.match(/^(\d+) months? from now$/);
      if (monthsFromNowMatch) {
        const months = parseInt(monthsFromNowMatch[1], 10);
        return addTime(now, months, 'months');
      }
      
      // Handle "next X" expressions
      const nextMatch = lowerExpression.match(/^next\s+(\w+)$/);
      if (nextMatch) {
        const dayOrPeriod = nextMatch[1];
        
        // Handle "next week", "next month", "next year"
        if (dayOrPeriod === 'week') {
          return addTime(now, 1, 'weeks');
        }
        
        if (dayOrPeriod === 'month') {
          return addTime(now, 1, 'months');
        }
        
        if (dayOrPeriod === 'year') {
          return addTime(now, 1, 'years');
        }
        
        // Handle days of the week
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = daysOfWeek.indexOf(dayOrPeriod);
        
        if (dayIndex !== -1) {
          const targetDate = new Date(now);
          const currentDayOfWeek = targetDate.getDay();
          
          // Calculate days to add
          let daysToAdd = dayIndex - currentDayOfWeek;
          if (daysToAdd <= 0) {
            daysToAdd += 7; // Go to next week
          }
          
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          targetDate.setHours(0, 0, 0, 0);
          return targetDate;
        }
      }
      
      // Handle "in X" expressions
      const inMatch = lowerExpression.match(/^in\s+(\d+)\s+(\w+)$/);
      if (inMatch) {
        const amount = parseInt(inMatch[1], 10);
        const unit = inMatch[2].toLowerCase();
        
        // Map unit to the addTime function
        const unitMap: Record<string, 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'> = {
          'second': 'seconds',
          'seconds': 'seconds',
          'minute': 'minutes',
          'minutes': 'minutes',
          'hour': 'hours',
          'hours': 'hours',
          'day': 'days',
          'days': 'days',
          'week': 'weeks',
          'weeks': 'weeks',
          'month': 'months',
          'months': 'months',
          'year': 'years',
          'years': 'years'
        };
        
        if (unitMap[unit]) {
          return addTime(now, amount, unitMap[unit]);
        }
      }
      
      // Handle "by the end of" expressions
      if (lowerExpression.startsWith('by the end of')) {
        const periodMatch = lowerExpression.match(/by the end of (day|week|month|year)/);
        if (periodMatch) {
          const period = periodMatch[1];
          if (period === 'day') {
            return endOfDay(now);
          } else if (period === 'week') {
            return endOfWeek(now);
          } else if (period === 'month') {
            return endOfMonth(now);
          } else if (period === 'year') {
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            return endOfDay(endOfYear);
          }
        }
      }
      
      // Try parsing as a Date object
      const date = new Date(expression);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // If all else fails, return null
      return null;
    } catch (error) {
      console.error('Error parsing natural language date/time:', error);
      return null;
    }
  }
  
  /**
   * Format a Date object into a standardized string representation
   * 
   * @param date - The date to format
   * @param format - Optional format specification
   * @returns Formatted date string
   */
  formatDate(date: Date, format?: string): string {
    if (!format) {
      return date.toISOString();
    }
    
    // Very basic formatting
    switch (format.toLowerCase()) {
      case 'iso':
        return date.toISOString();
      case 'short':
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      case 'long':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      case 'time':
        return date.toLocaleTimeString();
      case 'datetime':
        return date.toLocaleString();
      default:
        return date.toISOString();
    }
  }
  
  /**
   * Calculate a new date based on an interval description
   * 
   * @param baseDate - The starting date
   * @param interval - The interval description (e.g., "2 days", "1 week", "3 months")
   * @returns The calculated Date object
   */
  calculateInterval(baseDate: Date, interval: string): Date {
    const intervalMatch = interval.match(/^(\d+)\s*([a-zA-Z]+)$/);
    
    if (!intervalMatch) {
      throw new Error(`Invalid interval format: ${interval}`);
    }
    
    const amount = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2].toLowerCase();
    
    // Map unit to the addTime function
    const unitMap: Record<string, 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'> = {
      's': 'seconds',
      'sec': 'seconds',
      'second': 'seconds',
      'seconds': 'seconds',
      'm': 'minutes',
      'min': 'minutes',
      'minute': 'minutes',
      'minutes': 'minutes',
      'h': 'hours',
      'hr': 'hours',
      'hour': 'hours',
      'hours': 'hours',
      'd': 'days',
      'day': 'days',
      'days': 'days',
      'w': 'weeks',
      'wk': 'weeks',
      'week': 'weeks',
      'weeks': 'weeks',
      'mo': 'months',
      'month': 'months',
      'months': 'months',
      'y': 'years',
      'yr': 'years',
      'year': 'years',
      'years': 'years'
    };
    
    if (!unitMap[unit]) {
      throw new Error(`Unknown time unit: ${unit}`);
    }
    
    return addTime(baseDate, amount, unitMap[unit]);
  }
  
  /**
   * Check if a date has passed relative to the current time or a reference time
   * 
   * @param date - The date to check
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns True if the date has passed
   */
  hasPassed(date: Date, referenceDate?: Date): boolean {
    const reference = referenceDate || new Date();
    return date < reference;
  }
  
  /**
   * Generate a cron expression from a natural language description
   * 
   * @param expression - Natural language expression for recurring schedule
   * @returns Valid cron expression
   */
  generateCronExpression(expression: string): string {
    // This is a very simplified implementation
    // A real implementation would need a more sophisticated parser
    
    const lowerExpression = expression.toLowerCase().trim();
    
    // Basic cron patterns
    switch (lowerExpression) {
      case 'every minute':
        return '* * * * *';
      case 'every hour':
        return '0 * * * *';
      case 'every day':
      case 'daily':
        return '0 0 * * *';
      case 'every week':
      case 'weekly':
        return '0 0 * * 0';
      case 'every month':
      case 'monthly':
        return '0 0 1 * *';
      case 'every year':
      case 'yearly':
      case 'annually':
        return '0 0 1 1 *';
      // Adding more complex expressions
      case 'weekdays':
      case 'every weekday':
        return '0 0 * * 1-5';  // Monday to Friday
      case 'weekends':
      case 'every weekend':
        return '0 0 * * 0,6';  // Saturday and Sunday
      case 'every morning':
        return '0 9 * * *';    // 9 AM every day
      case 'every evening':
        return '0 18 * * *';   // 6 PM every day
      case 'twice daily':
        return '0 9,18 * * *'; // 9 AM and 6 PM
      case 'every hour during work hours':
        return '0 9-17 * * 1-5'; // Every hour 9-5, Monday-Friday
      default:
        // Default to daily at midnight if we can't parse
        return '0 0 * * *';
    }
  }
  
  /**
   * Parse a cron expression and return the next execution date
   * 
   * @param cronExpression - The cron expression to parse
   * @param referenceDate - Optional reference date (defaults to current time)
   * @returns The next execution date or null if the expression is invalid
   */
  getNextExecutionFromCron(cronExpression: string, referenceDate?: Date): Date | null {
    // This is a placeholder implementation
    // A real implementation would use a cron parser library
    // For now, we'll just return a date based on simple rules
    
    try {
      const now = referenceDate || new Date();
      const cronParts = cronExpression.split(' ');
      
      if (cronParts.length !== 5) {
        return null;
      }
      
      // Handle some common patterns
      if (cronExpression === '* * * * *') {
        // Every minute
        const next = new Date(now);
        next.setSeconds(0);
        next.setMilliseconds(0);
        if (next <= now) {
          next.setMinutes(next.getMinutes() + 1);
        }
        return next;
      }
      
      if (cronExpression === '0 * * * *') {
        // Every hour
        const next = new Date(now);
        next.setMinutes(0);
        next.setSeconds(0);
        next.setMilliseconds(0);
        if (next <= now) {
          next.setHours(next.getHours() + 1);
        }
        return next;
      }
      
      if (cronExpression === '0 0 * * *') {
        // Every day at midnight
        const next = new Date(now);
        next.setHours(0, 0, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      }
      
      if (cronExpression === '0 0 * * 1-5') {
        // Every weekday at midnight
        const next = new Date(now);
        next.setHours(0, 0, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        
        // Skip to Monday if it's Friday after midnight or weekend
        const dayOfWeek = next.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0) { // Sunday
          next.setDate(next.getDate() + 1); // Move to Monday
        } else if (dayOfWeek === 6) { // Saturday
          next.setDate(next.getDate() + 2); // Move to Monday
        }
        
        return next;
      }
      
      // Default to tomorrow for simplicity
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    } catch (error) {
      console.error('Error parsing cron expression:', error);
      return null;
    }
  }
  
  /**
   * Check if two dates are on the same day
   * 
   * @param date1 - First date to compare
   * @param date2 - Second date to compare
   * @returns True if both dates fall on the same calendar day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
  
  /**
   * Get a human-readable description of a time interval
   * 
   * @param startDate - The start date of the interval
   * @param endDate - The end date of the interval
   * @returns Human-readable description (e.g., "2 days", "1 hour and 30 minutes")
   */
  getHumanReadableInterval(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    
    if (diffMs < 0) {
      return this.getHumanReadableInterval(endDate, startDate) + ' ago';
    }
    
    if (diffMs === 0) {
      return 'now';
    }
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      if (days === 1) {
        return '1 day';
      }
      return `${days} days`;
    }
    
    if (hours > 0) {
      if (minutes % 60 === 0) {
        if (hours === 1) {
          return '1 hour';
        }
        return `${hours} hours`;
      }
      
      const remainingMinutes = minutes % 60;
      if (hours === 1) {
        if (remainingMinutes === 1) {
          return '1 hour and 1 minute';
        }
        return `1 hour and ${remainingMinutes} minutes`;
      }
      
      if (remainingMinutes === 1) {
        return `${hours} hours and 1 minute`;
      }
      return `${hours} hours and ${remainingMinutes} minutes`;
    }
    
    if (minutes > 0) {
      if (minutes === 1) {
        return '1 minute';
      }
      return `${minutes} minutes`;
    }
    
    if (seconds === 1) {
      return '1 second';
    }
    return `${seconds} seconds`;
  }
} 