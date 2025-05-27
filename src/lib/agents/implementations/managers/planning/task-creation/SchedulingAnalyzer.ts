/**
 * SchedulingAnalyzer.ts - Task scheduling analysis component
 * 
 * This component analyzes user input to extract scheduling information
 * and parse natural language time expressions.
 */

import { 
  SchedulingAnalyzer as ISchedulingAnalyzer,
  SchedulingAnalysisOptions,
  SchedulingAnalysisResult 
} from '../interfaces/TaskCreationInterfaces';

/**
 * Time expression patterns and their parsing logic
 */
const TIME_PATTERNS = {
  // Relative time expressions
  relative: [
    { pattern: /\btomorrow\b/i, offset: { days: 1 } },
    { pattern: /\btoday\b/i, offset: { days: 0 } },
    { pattern: /\btonigh?t\b/i, offset: { days: 0, hours: 20 } },
    { pattern: /\bin\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\b/i, dynamic: true },
    { pattern: /\b(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\s+from\s+now\b/i, dynamic: true },
    { pattern: /\bnext\s+(week|month|year)\b/i, dynamic: true },
    { pattern: /\bthis\s+(morning|afternoon|evening|night)\b/i, dynamic: true },
    { pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, dynamic: true }
  ],
  
  // Absolute time expressions
  absolute: [
    { pattern: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\b/i, dynamic: true },
    { pattern: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, dynamic: true },
    { pattern: /\b(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?\b/, dynamic: true },
    { pattern: /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, dynamic: true },
    { pattern: /\bby\s+(\d{1,2})\/(\d{1,2})\b/, dynamic: true }
  ],
  
  // Recurring patterns
  recurring: [
    { pattern: /\bevery\s+(day|week|month|year)\b/i, recurrence: true },
    { pattern: /\bdaily\b/i, recurrence: true },
    { pattern: /\bweekly\b/i, recurrence: true },
    { pattern: /\bmonthly\b/i, recurrence: true },
    { pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, recurrence: true }
  ]
};

/**
 * Day name to number mapping
 */
const DAY_NAMES: Record<string, number> = {
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
  'thursday': 4, 'friday': 5, 'saturday': 6
};

/**
 * Implementation of SchedulingAnalyzer interface
 */
export class SchedulingAnalyzer implements ISchedulingAnalyzer {
  
  /**
   * Analyze user input for scheduling information
   */
  async analyzeScheduling(
    userInput: string,
    options?: SchedulingAnalysisOptions
  ): Promise<SchedulingAnalysisResult> {
    const currentTime = options?.currentTime || new Date();
    const timezone = options?.timezone || 'UTC';
    
    // Try to find time expressions in order of specificity
    let result = this.parseAbsoluteTime(userInput, currentTime);
    if (result.scheduledTime) {
      return {
        scheduledTime: result.scheduledTime,
        confidence: result.confidence || 0,
        timeReferenceType: 'absolute',
        originalExpression: result.originalExpression,
        isRecurring: result.isRecurring || false,
        recurrencePattern: result.recurrencePattern
      };
    }
    
    result = this.parseRelativeTime(userInput, currentTime);
    if (result.scheduledTime) {
      return {
        scheduledTime: result.scheduledTime,
        confidence: result.confidence || 0,
        timeReferenceType: 'relative',
        originalExpression: result.originalExpression,
        isRecurring: result.isRecurring || false,
        recurrencePattern: result.recurrencePattern
      };
    }
    
    result = this.parseRecurringTime(userInput);
    if (result.isRecurring) {
      return {
        scheduledTime: result.scheduledTime,
        confidence: result.confidence || 0,
        timeReferenceType: 'recurring',
        originalExpression: result.originalExpression,
        isRecurring: result.isRecurring || false,
        recurrencePattern: result.recurrencePattern
      };
    }
    
    // No time expression found
    return {
      confidence: 0,
      isRecurring: false
    };
  }

  /**
   * Parse natural language time expressions
   */
  async parseTimeExpression(
    timeExpression: string,
    currentTime?: Date
  ): Promise<Date | null> {
    const baseTime = currentTime || new Date();
    
    // Try different parsing strategies
    const absolute = this.parseAbsoluteTime(timeExpression, baseTime);
    if (absolute.scheduledTime) {
      return absolute.scheduledTime;
    }
    
    const relative = this.parseRelativeTime(timeExpression, baseTime);
    if (relative.scheduledTime) {
      return relative.scheduledTime;
    }
    
    return null;
  }

  /**
   * Parse absolute time expressions (specific dates/times)
   */
  private parseAbsoluteTime(userInput: string, currentTime: Date): Partial<SchedulingAnalysisResult> {
    // Check for time patterns like "at 3 PM"
    const timeMatch = userInput.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
      
      const scheduledTime = new Date(currentTime);
      let finalHour = hour;
      
      if (isPM && hour !== 12) {
        finalHour = hour + 12;
      } else if (!isPM && hour === 12) {
        finalHour = 0;
      }
      
      scheduledTime.setHours(finalHour, minute, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (scheduledTime <= currentTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      return {
        scheduledTime,
        confidence: 0.9,
        originalExpression: timeMatch[0],
        isRecurring: false
      };
    }
    
    // Check for date patterns like "12/25" or "12-25"
    const dateMatch = userInput.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1; // JavaScript months are 0-indexed
      const day = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : currentTime.getFullYear();
      
      const scheduledTime = new Date(year, month, day, 9, 0, 0, 0); // Default to 9 AM
      
      return {
        scheduledTime,
        confidence: 0.8,
        originalExpression: dateMatch[0],
        isRecurring: false
      };
    }
    
    // Check for "by [day]" patterns
    const byDayMatch = userInput.match(/\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (byDayMatch) {
      const targetDay = DAY_NAMES[byDayMatch[1].toLowerCase()];
      const scheduledTime = this.getNextWeekday(currentTime, targetDay);
      
      return {
        scheduledTime,
        confidence: 0.7,
        originalExpression: byDayMatch[0],
        isRecurring: false
      };
    }
    
    return { confidence: 0, isRecurring: false };
  }

  /**
   * Parse relative time expressions (tomorrow, in 2 hours, etc.)
   */
  private parseRelativeTime(userInput: string, currentTime: Date): Partial<SchedulingAnalysisResult> {
    // Check for "tomorrow"
    if (/\btomorrow\b/i.test(userInput)) {
      const scheduledTime = new Date(currentTime);
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(9, 0, 0, 0); // Default to 9 AM
      
      return {
        scheduledTime,
        confidence: 0.9,
        originalExpression: 'tomorrow',
        isRecurring: false
      };
    }
    
    // Check for "today"
    if (/\btoday\b/i.test(userInput)) {
      const scheduledTime = new Date(currentTime);
      scheduledTime.setHours(currentTime.getHours() + 1, 0, 0, 0); // Default to next hour
      
      return {
        scheduledTime,
        confidence: 0.8,
        originalExpression: 'today',
        isRecurring: false
      };
    }
    
    // Check for "tonight"
    if (/\btonigh?t\b/i.test(userInput)) {
      const scheduledTime = new Date(currentTime);
      scheduledTime.setHours(20, 0, 0, 0); // Default to 8 PM
      
      return {
        scheduledTime,
        confidence: 0.8,
        originalExpression: 'tonight',
        isRecurring: false
      };
    }
    
    // Check for "in X [time unit]" patterns
    const inTimeMatch = userInput.match(/\bin\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\b/i);
    if (inTimeMatch) {
      const amount = parseInt(inTimeMatch[1]);
      const unit = inTimeMatch[2].toLowerCase();
      
      const scheduledTime = new Date(currentTime);
      
      switch (unit) {
        case 'minute':
        case 'minutes':
          scheduledTime.setMinutes(scheduledTime.getMinutes() + amount);
          break;
        case 'hour':
        case 'hours':
          scheduledTime.setHours(scheduledTime.getHours() + amount);
          break;
        case 'day':
        case 'days':
          scheduledTime.setDate(scheduledTime.getDate() + amount);
          break;
        case 'week':
        case 'weeks':
          scheduledTime.setDate(scheduledTime.getDate() + (amount * 7));
          break;
        case 'month':
        case 'months':
          scheduledTime.setMonth(scheduledTime.getMonth() + amount);
          break;
      }
      
      return {
        scheduledTime,
        confidence: 0.9,
        originalExpression: inTimeMatch[0],
        isRecurring: false
      };
    }
    
    // Check for "next [day]" patterns
    const nextDayMatch = userInput.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (nextDayMatch) {
      const targetDay = DAY_NAMES[nextDayMatch[1].toLowerCase()];
      const scheduledTime = this.getNextWeekday(currentTime, targetDay);
      
      return {
        scheduledTime,
        confidence: 0.8,
        originalExpression: nextDayMatch[0],
        isRecurring: false
      };
    }
    
    // Check for "next week/month" patterns
    const nextPeriodMatch = userInput.match(/\bnext\s+(week|month)\b/i);
    if (nextPeriodMatch) {
      const period = nextPeriodMatch[1].toLowerCase();
      const scheduledTime = new Date(currentTime);
      
      if (period === 'week') {
        scheduledTime.setDate(scheduledTime.getDate() + 7);
      } else if (period === 'month') {
        scheduledTime.setMonth(scheduledTime.getMonth() + 1);
      }
      
      return {
        scheduledTime,
        confidence: 0.7,
        originalExpression: nextPeriodMatch[0],
        isRecurring: false
      };
    }
    
    // Check for "this [time of day]" patterns
    const thisTimeMatch = userInput.match(/\bthis\s+(morning|afternoon|evening|night)\b/i);
    if (thisTimeMatch) {
      const timeOfDay = thisTimeMatch[1].toLowerCase();
      const scheduledTime = new Date(currentTime);
      
      switch (timeOfDay) {
        case 'morning':
          scheduledTime.setHours(9, 0, 0, 0);
          break;
        case 'afternoon':
          scheduledTime.setHours(14, 0, 0, 0);
          break;
        case 'evening':
          scheduledTime.setHours(18, 0, 0, 0);
          break;
        case 'night':
          scheduledTime.setHours(20, 0, 0, 0);
          break;
      }
      
      // If the time has passed, schedule for tomorrow
      if (scheduledTime <= currentTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      return {
        scheduledTime,
        confidence: 0.7,
        originalExpression: thisTimeMatch[0],
        isRecurring: false
      };
    }
    
    return { confidence: 0, isRecurring: false };
  }

  /**
   * Parse recurring time expressions
   */
  private parseRecurringTime(userInput: string): Partial<SchedulingAnalysisResult> {
    // Check for "every [period]" patterns
    const everyMatch = userInput.match(/\bevery\s+(day|week|month|year)\b/i);
    if (everyMatch) {
      const period = everyMatch[1].toLowerCase();
      
      return {
        confidence: 0.9,
        isRecurring: true,
        recurrencePattern: `every ${period}`,
        originalExpression: everyMatch[0]
      };
    }
    
    // Check for frequency words
    if (/\bdaily\b/i.test(userInput)) {
      return {
        confidence: 0.9,
        isRecurring: true,
        recurrencePattern: 'daily',
        originalExpression: 'daily'
      };
    }
    
    if (/\bweekly\b/i.test(userInput)) {
      return {
        confidence: 0.9,
        isRecurring: true,
        recurrencePattern: 'weekly',
        originalExpression: 'weekly'
      };
    }
    
    if (/\bmonthly\b/i.test(userInput)) {
      return {
        confidence: 0.9,
        isRecurring: true,
        recurrencePattern: 'monthly',
        originalExpression: 'monthly'
      };
    }
    
    // Check for "every [day]" patterns
    const everyDayMatch = userInput.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (everyDayMatch) {
      const day = everyDayMatch[1].toLowerCase();
      
      return {
        confidence: 0.8,
        isRecurring: true,
        recurrencePattern: `every ${day}`,
        originalExpression: everyDayMatch[0]
      };
    }
    
    return { confidence: 0, isRecurring: false };
  }

  /**
   * Get the next occurrence of a specific weekday
   */
  private getNextWeekday(currentTime: Date, targetDay: number): Date {
    const result = new Date(currentTime);
    const currentDay = result.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Next week
    }
    
    result.setDate(result.getDate() + daysToAdd);
    result.setHours(9, 0, 0, 0); // Default to 9 AM
    
    return result;
  }
} 