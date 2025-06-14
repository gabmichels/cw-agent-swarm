import { ICalendarCapabilities } from '../interfaces/ICalendarCapabilities';
import { CalendarCapabilities, CalendarEvent, CreateEventParams } from '../CalendarCapabilities';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance, AxiosError } from 'axios';

export interface CalendarQuery {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  q?: string;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
}

// Define the Zoho event data structure
interface ZohoEventData {
  title: string;
  dateandtime: {
    timezone: string;
    start: string;
    end: string;
  };
  richtext_description?: string;
  attendees?: Array<{
    email: string;
    status: string;
  }>;
  location?: string;
}

/**
 * Zoho Calendar Capabilities Implementation
 * Extends the existing CalendarCapabilities to implement the provider interface
 */
export class ZohoCalendarCapabilities extends CalendarCapabilities implements ICalendarCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;
  private connectionId: string;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    super();
    this.connectionId = connectionId;
    this.zohoProvider = zohoProvider;
  }

  /**
   * Get primary calendar UID using the correct Zoho Calendar API
   * Based on official Zoho Calendar API documentation
   */
  private async getPrimaryCalendarUid(client: AxiosInstance): Promise<string> {
    try {
      // Use the correct calendars endpoint (plural) to get calendar list
      const response = await client.get('/calendars', {
        params: {
          category: 'own'
        }
      });
      
      console.log('Zoho calendars response:', {
        hasCalendars: !!response.data.calendars,
        calendarCount: response.data.calendars?.length
      });
      
      if (response.data.calendars && response.data.calendars.length > 0) {
        // Find the default calendar or use the first one
        const defaultCalendar = response.data.calendars.find((cal: any) => cal.isdefault === true);
        const calendar = defaultCalendar || response.data.calendars[0];
        
        console.log('Using calendar:', {
          name: calendar.name,
          uid: calendar.uid,
          isDefault: calendar.isdefault
        });
        
        return calendar.uid;
      } else {
        throw new Error('No calendars found');
      }
    } catch (error) {
      console.error('Error getting primary calendar UID:', error);
      throw new Error('Unable to retrieve calendar from Zoho Calendar');
    }
  }

  /**
   * Get events from Zoho Calendar using the correct Events API
   * Based on official Zoho Calendar Events API documentation
   */
  async getEvents(query: CalendarQuery): Promise<CalendarEvent[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'calendar');
      const calendarUid = await this.getPrimaryCalendarUid(client);
      
      // Build date range for the query (default to next 30 days)
      const now = new Date();
      const startDate = query.timeMin ? new Date(query.timeMin) : now;
      const endDate = query.timeMax ? new Date(query.timeMax) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Format dates for Zoho API (yyyyMMddTHHmmssZ)
      const formatZohoDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };
      
      const range = {
        start: formatZohoDate(startDate),
        end: formatZohoDate(endDate)
      };
      
      console.log('Fetching Zoho events with range:', range);
      
      // Use the correct Events API endpoint: /calendars/{calendar_uid}/events
      const response = await client.get(`/calendars/${calendarUid}/events`, {
        params: {
          range: JSON.stringify(range)
        }
      });

      if (!response.data.events) {
        return [];
      }

      return response.data.events.map((event: any) => this.convertZohoEventToCalendarEvent(event));
    } catch (error) {
      console.error('Zoho get events error:', error);
      throw new Error(`Failed to get events from Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create event in Zoho Calendar using Events API
   * Based on official Zoho Calendar Events API documentation
   */
  async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'calendar');
      const calendarUid = await this.getPrimaryCalendarUid(client);
      
      console.log('Creating Zoho calendar event with correct API format');
      
      // FIXED: Use exact format from user's example - eventdata as query parameter
      const eventData: ZohoEventData = {
        title: event.summary,
        dateandtime: {
          timezone: event.start.timeZone || 'UTC',
          start: this.convertToZohoDateTime(event.start.dateTime),
          end: this.convertToZohoDateTime(event.end.dateTime)
        }
      };

      if (event.description) {
        eventData.richtext_description = event.description;
      }

      if (event.attendees && event.attendees.length > 0) {
        eventData.attendees = event.attendees.map(attendee => ({
          email: attendee.email,
          status: 'NEEDS-ACTION'
        }));
      }

      if (event.location) {
        eventData.location = event.location;
      }

      // FIXED: Pass eventdata as query parameter with JSON string - USE POST METHOD
      // Use exact URL format from user's example
      const eventDataString = JSON.stringify(eventData);
      const response = await client.post(`/calendars/${calendarUid}/events?eventdata=${encodeURIComponent(eventDataString)}`, null);

      if (response.data && response.data.events && response.data.events.length > 0) {
        return this.convertZohoEventToCalendarEvent(response.data.events[0]);
      } else {
        throw new Error('No event returned from Zoho Calendar API');
      }
    } catch (error) {
      console.error('Zoho create event error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError;
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
        console.error('Error response headers:', axiosError.response?.headers);
      }
      throw new Error(`Failed to create event in Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete event from Zoho Calendar using Events API
   * Based on: https://www.zoho.com/calendar/help/api/events-api.html
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'calendar');
      const calendarUid = await this.getPrimaryCalendarUid(client);
      
      console.log('Deleting Zoho event:', { eventId, calendarUid });
      
      // FIXED: Get event details first to obtain ETAG, then delete
      // Step 1: Get event details to get ETAG
      const eventResponse = await client.get(`/calendars/${calendarUid}/events/${eventId}`);
      console.log('Event response for ETAG:', eventResponse.data);
      
      // Extract ETAG from the event data (not headers)
      const event = eventResponse.data.events?.[0];
      const etag = event?.etag;
      
      if (!etag) {
        console.error('No ETAG found in event response:', eventResponse.data);
        throw new Error('ETAG is required for event deletion but was not found in event data');
      }
      
      console.log('Got event ETAG for deletion:', etag);
      
      // Step 2: Delete with ETAG header (use 'etag' header as per Zoho API docs)
      await client.delete(`/calendars/${calendarUid}/events/${eventId}`, {
        headers: {
          'etag': etag
        }
      });
      
      console.log('✅ Event deleted successfully from Zoho Calendar');
    } catch (error) {
      console.error('Zoho delete event error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError;
        console.error('Delete error response status:', axiosError.response?.status);
        console.error('Delete error response data:', axiosError.response?.data);
      }
      throw new Error(`Failed to delete event from Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Zoho event to CalendarEvent format
   */
  private convertZohoEventToCalendarEvent(zohoEvent: any): CalendarEvent {
    console.log('Converting Zoho event to CalendarEvent:', JSON.stringify(zohoEvent, null, 2));
    
    // Extract start and end times with better fallback handling
    let startTime: Date;
    let endTime: Date;
    
    // Handle different date formats from Smart Add API vs regular API
    if (zohoEvent.dateandtime) {
      startTime = new Date(this.convertFromZohoDateTime(zohoEvent.dateandtime.start));
      endTime = new Date(this.convertFromZohoDateTime(zohoEvent.dateandtime.end));
    } else if (zohoEvent.start && zohoEvent.end) {
      startTime = new Date(this.convertFromZohoDateTime(zohoEvent.start));
      endTime = new Date(this.convertFromZohoDateTime(zohoEvent.end));
    } else {
      // Fallback: create a 1-hour event starting now
      console.warn('No valid date/time found in Zoho event, using fallback');
      startTime = new Date();
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
    }
    
    const calendarEvent: CalendarEvent = {
      id: zohoEvent.uid || zohoEvent.id || 'unknown',
      title: zohoEvent.title || 'Untitled Event',
      description: zohoEvent.description || '',
      startTime: startTime,
      endTime: endTime,
      location: zohoEvent.location || '',
      attendees: zohoEvent.attendees?.map((attendee: any) => ({
        email: attendee.email || 'unknown@example.com',
        displayName: attendee.dName || attendee.displayName || attendee.email || 'Unknown',
        responseStatus: this.convertZohoAttendeeStatus(attendee.status || 'NEEDS-ACTION')
      })) || [],
      organizer: {
        email: zohoEvent.organizer || zohoEvent.createdby || 'unknown@example.com',
        displayName: zohoEvent.orgDName || zohoEvent.organizer || 'Unknown',
        responseStatus: 'accepted' as const
      },
      isAllDay: zohoEvent.isallday || false,
      status: this.convertZohoEventStatus(zohoEvent.estatus || 'confirmed'),
      htmlLink: zohoEvent.viewEventURL || '',
      visibility: 'default',
      calendarId: 'primary'
    };
    
    return calendarEvent;
  }

  /**
   * Convert ISO date string to Zoho Calendar API format
   * Based on official Zoho Calendar API documentation: yyyyMMddTHHmmssZ
   */
  private convertToZohoDateTime(isoString: string): string {
    // Zoho Calendar API expects format: "yyyyMMddTHHmmssZ" (GMT format)
    const date = new Date(isoString);
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Convert Zoho date/time format back to ISO string
   */
  private convertFromZohoDateTime(zohoDateTime: string | undefined | null): string {
    // Handle undefined/null values
    if (!zohoDateTime) {
      console.warn('convertFromZohoDateTime received undefined/null value, using current time');
      return new Date().toISOString();
    }

    // Convert from yyyyMMddTHHmmssZ to ISO format
    if (typeof zohoDateTime === 'string' && zohoDateTime.length === 16 && zohoDateTime.endsWith('Z')) {
      const year = zohoDateTime.substring(0, 4);
      const month = zohoDateTime.substring(4, 6);
      const day = zohoDateTime.substring(6, 8);
      const hour = zohoDateTime.substring(9, 11);
      const minute = zohoDateTime.substring(11, 13);
      const second = zohoDateTime.substring(13, 15);
      
      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }
    
    // Handle Zoho format with timezone offset (e.g., "20250615T131435+0200")
    if (typeof zohoDateTime === 'string' && zohoDateTime.match(/^\d{8}T\d{6}[+-]\d{4}$/)) {
      const year = zohoDateTime.substring(0, 4);
      const month = zohoDateTime.substring(4, 6);
      const day = zohoDateTime.substring(6, 8);
      const hour = zohoDateTime.substring(9, 11);
      const minute = zohoDateTime.substring(11, 13);
      const second = zohoDateTime.substring(13, 15);
      const timezone = zohoDateTime.substring(15);
      
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`;
      try {
        const date = new Date(isoString);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (error) {
        console.warn('Failed to parse Zoho date with timezone:', zohoDateTime, error);
      }
    }
    
    // Handle other Zoho date formats
    if (typeof zohoDateTime === 'string') {
      try {
        // Try to parse as-is first
        const date = new Date(zohoDateTime);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch (error) {
        console.warn('Failed to parse Zoho date:', zohoDateTime, error);
      }
    }
    
    // Fallback: return current time
    console.warn('Unable to parse Zoho date, using current time:', zohoDateTime);
    return new Date().toISOString();
  }

  /**
   * Convert Zoho status to standard format for event status
   */
  private convertZohoEventStatus(zohoStatus: string): 'confirmed' | 'tentative' | 'cancelled' {
    switch (zohoStatus?.toUpperCase()) {
      case 'CONFIRMED': return 'confirmed';
      case 'TENTATIVE': return 'tentative';
      case 'CANCELLED': return 'cancelled';
      default: return 'confirmed';
    }
  }

  /**
   * Convert Zoho attendee status to standard format
   */
  private convertZohoAttendeeStatus(zohoStatus: string): 'needsAction' | 'declined' | 'tentative' | 'accepted' {
    switch (zohoStatus?.toUpperCase()) {
      case 'ACCEPTED': return 'accepted';
      case 'DECLINED': return 'declined';
      case 'NEEDS-ACTION': return 'needsAction';
      case 'TENTATIVE': return 'tentative';
      default: return 'needsAction';
    }
  }

  /**
   * Search events - For now, we'll implement this as a filtered getEvents call
   * since the search endpoint might not be available
   */
  async searchEvents(searchQuery: string, options?: {
    startDate?: string;
    endDate?: string;
    maxResults?: number;
  }): Promise<CalendarEvent[]> {
    try {
      // For now, get all events and filter them locally
      // This is a fallback until we find the correct search endpoint
      const events = await this.getEvents({
        timeMin: options?.startDate || new Date().toISOString(),
        timeMax: options?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: options?.maxResults || 100
      });

      // Filter events that match the search query
      const filteredEvents = events.filter(event => 
        event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      console.log(`Found ${filteredEvents.length} events matching '${searchQuery}'`);
      return filteredEvents;
    } catch (error) {
      console.error('Zoho search events error:', error);
      throw new Error(`Failed to search events in Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get free/busy information - Simplified implementation
   * This might need to be implemented differently based on available Zoho Calendar APIs
   */
  async getFreeBusyInfo(userEmails: string[], options: {
    startTime: string;
    endTime: string;
  }): Promise<{
    email: string;
    freeBusySlots: Array<{
      start: string;
      end: string;
      status: 'free' | 'busy';
    }>;
  }[]> {
    try {
      // For now, we'll get events for the time period and derive busy slots
      // This is a fallback implementation until we find the correct free/busy endpoint
      const events = await this.getEvents({
        timeMin: options.startTime,
        timeMax: options.endTime,
        maxResults: 1000
      });

      // Convert events to busy slots for the current user
      const busySlots = events.map(event => ({
        start: event.startTime.toISOString(),
        end: event.endTime.toISOString(),
        status: 'busy' as const
      }));

      // Return busy slots for each requested email (simplified)
      return userEmails.map(email => ({
        email,
        freeBusySlots: busySlots
      }));
    } catch (error) {
      console.error('Zoho free/busy error:', error);
      throw new Error(`Failed to get free/busy info from Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create event using natural language with Smart Add API
   * Based on official Zoho Calendar Smart Add API documentation
   */
  async createEventFromText(naturalLanguageText: string, calendarId?: string): Promise<CalendarEvent> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'calendar');
      
      console.log('Creating event from text using Smart Add API:', naturalLanguageText);
      
      // FIXED: Use correct Smart Add API format from official docs
      // POST to /smartadd with saddtext parameter (not title)
      const response = await client.post('/smartadd', null, {
        params: {
          saddtext: naturalLanguageText
        }
      });

      console.log('Smart Add API response:', response.data);

      if (response.data && response.data.events && response.data.events.length > 0) {
        return this.convertZohoEventToCalendarEvent(response.data.events[0]);
      } else if (response.data && response.data.event) {
        return this.convertZohoEventToCalendarEvent(response.data.event);
      } else {
        throw new Error('No event returned from Smart Add API');
      }
    } catch (error) {
      console.error('Smart Add API error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError;
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
      }
      throw new Error(`Failed to create event from text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find available time slots for scheduling meetings
   * Combines Free/Busy API with intelligent scheduling logic
   */
  async findAvailableSlots(options: {
    attendeeEmails: string[];
    durationMinutes: number;
    startDate: string;
    endDate: string;
    workingHours?: {
      start: string; // e.g., "09:00"
      end: string;   // e.g., "17:00"
    };
    timeZone?: string;
  }): Promise<Array<{
    start: string;
    end: string;
    attendees: string[];
  }>> {
    try {
      // Get free/busy information for all attendees
      const freeBusyInfo = await this.getFreeBusyInfo(options.attendeeEmails, {
        startTime: options.startDate,
        endTime: options.endDate
      });
      
      // Default working hours
      const workingHours = options.workingHours || { start: "09:00", end: "17:00" };
      
      // Find common available slots
      const availableSlots: Array<{ start: string; end: string; attendees: string[] }> = [];
      
      // Simple algorithm to find slots where all attendees are free
      const startDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);
      const durationMs = options.durationMinutes * 60 * 1000;
      
      // Check each day in the range
      for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        // Check working hours for this day
        const dayStart = new Date(currentDate);
        const [startHour, startMin] = workingHours.start.split(':').map(Number);
        dayStart.setHours(startHour, startMin, 0, 0);
        
        const dayEnd = new Date(currentDate);
        const [endHour, endMin] = workingHours.end.split(':').map(Number);
        dayEnd.setHours(endHour, endMin, 0, 0);
        
        // Check for available slots in 30-minute increments
        for (let slotStart = new Date(dayStart); slotStart.getTime() + durationMs <= dayEnd.getTime(); slotStart.setMinutes(slotStart.getMinutes() + 30)) {
          const slotEnd = new Date(slotStart.getTime() + durationMs);
          
          // Check if all attendees are free during this slot
          const allFree = freeBusyInfo.every(userInfo => {
            return !userInfo.freeBusySlots.some(slot => {
              const busyStart = new Date(slot.start);
              const busyEnd = new Date(slot.end);
              return slot.status === 'busy' && 
                     ((slotStart >= busyStart && slotStart < busyEnd) ||
                      (slotEnd > busyStart && slotEnd <= busyEnd) ||
                      (slotStart <= busyStart && slotEnd >= busyEnd));
            });
          });
          
          if (allFree) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              attendees: options.attendeeEmails
            });
          }
        }
      }
      
      console.log(`Found ${availableSlots.length} available slots for ${options.durationMinutes} minute meeting`);
      
      return availableSlots.slice(0, 10); // Return top 10 slots
    } catch (error) {
      console.error('Zoho find available slots error:', error);
      throw new Error(`Failed to find available slots in Zoho Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 