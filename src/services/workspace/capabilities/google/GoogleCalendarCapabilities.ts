import { ICalendarCapabilities } from '../interfaces/ICalendarCapabilities';
import { CalendarCapabilities } from '../CalendarCapabilities';

/**
 * Google Workspace Calendar Capabilities Implementation
 * Extends the existing CalendarCapabilities to implement the provider interface
 */
export class GoogleCalendarCapabilities extends CalendarCapabilities implements ICalendarCapabilities {
  // All methods are inherited from CalendarCapabilities
  // This class serves as the Google-specific implementation
} 