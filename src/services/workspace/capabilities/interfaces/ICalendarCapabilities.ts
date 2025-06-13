import {
  CalendarEvent,
  CreateEventParams,
  EditEventParams,
  EventSearchCriteria,
  DateRange,
  AvailabilityParams,
  AvailabilitySlot,
  ConflictResult,
  DaySummary
} from '../CalendarCapabilities';

/**
 * Abstract interface for calendar capabilities across all workspace providers
 * This ensures consistent functionality regardless of the underlying provider (Google, Microsoft, Zoho)
 */
export interface ICalendarCapabilities {
  /**
   * Read calendar events for a specific date range
   */
  readCalendar(dateRange: DateRange, connectionId: string, agentId: string): Promise<CalendarEvent[]>;

  /**
   * Find events based on search criteria
   */
  findEvents(searchCriteria: EventSearchCriteria, connectionId: string, agentId: string): Promise<CalendarEvent[]>;

  /**
   * Get detailed information about a specific event
   */
  getEventDetails(eventId: string, connectionId: string, agentId: string): Promise<CalendarEvent>;

  /**
   * Find available time slots for scheduling
   */
  findAvailability(params: AvailabilityParams, connectionId: string, agentId: string): Promise<AvailabilitySlot[]>;

  /**
   * Check for conflicts with a proposed event
   */
  checkConflicts(proposedEvent: CreateEventParams, connectionId: string, agentId: string): Promise<ConflictResult>;

  /**
   * Schedule a new calendar event
   */
  scheduleEvent(params: CreateEventParams, connectionId: string, agentId: string): Promise<CalendarEvent>;

  /**
   * Edit an existing calendar event
   */
  editCalendarEntry(eventId: string, changes: EditEventParams, connectionId: string, agentId: string): Promise<CalendarEvent>;

  /**
   * Delete a calendar event
   */
  deleteCalendarEntry(eventId: string, connectionId: string, agentId: string): Promise<void>;

  /**
   * Get a summary of events for a specific day
   */
  summarizeDay(date: string, connectionId: string, agentId: string): Promise<DaySummary>;
} 