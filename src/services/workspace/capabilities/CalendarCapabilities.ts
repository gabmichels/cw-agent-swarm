import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';

// Calendar data types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: EventAttendee[];
  organizer?: EventAttendee;
  isAllDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'default' | 'public' | 'private';
  recurrence?: string[];
  reminders?: EventReminder[];
  calendarId: string;
  htmlLink?: string;
}

export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface CreateEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  reminders?: EventReminder[];
  calendarId?: string;
}

export interface EditEventParams {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  reminders?: EventReminder[];
}

export interface EventSearchCriteria {
  query?: string;
  timeMin?: Date;
  timeMax?: Date;
  attendee?: string;
  location?: string;
  maxResults?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AvailabilityParams {
  date: string; // YYYY-MM-DD format
  duration: number; // minutes
  workingHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  excludeWeekends?: boolean;
  bufferTime?: number; // minutes between meetings
}

export interface AvailabilitySlot {
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: CalendarEvent[];
  suggestions?: AvailabilitySlot[];
}

export interface DaySummary {
  date: string;
  totalEvents: number;
  totalDuration: number; // minutes
  eventsByType: Record<string, number>;
  busyHours: TimeSlot[];
  freeHours: TimeSlot[];
  upcomingDeadlines: CalendarEvent[];
  summary: string; // AI-generated summary
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface MeetingAgenda {
  eventId: string;
  title: string;
  agenda: string;
  suggestedTopics: string[];
  preparationItems: string[];
}

export interface SchedulingPreferences {
  preferredTimes?: TimeSlot[];
  avoidTimes?: TimeSlot[];
  maxMeetingDuration?: number;
  bufferTime?: number;
  workingDays?: number[]; // 0-6, Sunday-Saturday
}

export class CalendarCapabilities {
  private db: IDatabaseProvider;
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Read calendar events for a specific date range
   */
  async readCalendar(dateRange: DateRange, connectionId: string, agentId: string): Promise<CalendarEvent[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: dateRange.start.toISOString(),
        timeMax: dateRange.end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });

      const events = response.data.items || [];
      return events.map(event => this.convertToCalendarEvent(event));
    } catch (error) {
      throw new Error(`Failed to read calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find events based on search criteria
   */
  async findEvents(searchCriteria: EventSearchCriteria, connectionId: string, agentId: string): Promise<CalendarEvent[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        q: searchCriteria.query,
        timeMin: searchCriteria.timeMin?.toISOString(),
        timeMax: searchCriteria.timeMax?.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: searchCriteria.maxResults || 50
      });

      const events = response.data.items || [];
      let filteredEvents = events.map(event => this.convertToCalendarEvent(event));

      // Additional filtering
      if (searchCriteria.attendee) {
        filteredEvents = filteredEvents.filter(event => 
          event.attendees?.some(attendee => 
            attendee.email.toLowerCase().includes(searchCriteria.attendee!.toLowerCase())
          )
        );
      }

      if (searchCriteria.location) {
        filteredEvents = filteredEvents.filter(event => 
          event.location?.toLowerCase().includes(searchCriteria.location!.toLowerCase())
        );
      }

      return filteredEvents;
    } catch (error) {
      throw new Error(`Failed to find events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a specific event
   */
  async getEventDetails(eventId: string, connectionId: string, agentId: string): Promise<CalendarEvent> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      return this.convertToCalendarEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to get event details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find available time slots for scheduling
   */
  async findAvailability(params: AvailabilityParams, connectionId: string, agentId: string): Promise<AvailabilitySlot[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const date = new Date(params.date);
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get existing events for the day
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      const busySlots = events.map(event => ({
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || '')
      }));

      // Define working hours
      const workingStart = params.workingHours?.start || '09:00';
      const workingEnd = params.workingHours?.end || '17:00';
      
      const [startHour, startMinute] = workingStart.split(':').map(Number);
      const [endHour, endMinute] = workingEnd.split(':').map(Number);
      
      const workingStartTime = new Date(date);
      workingStartTime.setHours(startHour, startMinute, 0, 0);
      
      const workingEndTime = new Date(date);
      workingEndTime.setHours(endHour, endMinute, 0, 0);

      // Find available slots
      const availableSlots: AvailabilitySlot[] = [];
      const bufferTime = params.bufferTime || 0;
      let currentTime = new Date(workingStartTime);

      while (currentTime < workingEndTime) {
        const slotEnd = new Date(currentTime.getTime() + params.duration * 60000);
        
        if (slotEnd > workingEndTime) break;

        // Check if this slot conflicts with any busy time
        const hasConflict = busySlots.some(busy => 
          (currentTime < busy.end && slotEnd > busy.start)
        );

        if (!hasConflict) {
          availableSlots.push({
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd),
            duration: params.duration
          });
        }

        // Move to next potential slot (with buffer time)
        currentTime = new Date(currentTime.getTime() + (params.duration + bufferTime) * 60000);
      }

      return availableSlots;
    } catch (error) {
      throw new Error(`Failed to find availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for conflicts with a proposed event
   */
  async checkConflicts(proposedEvent: CreateEventParams, connectionId: string, agentId: string): Promise<ConflictResult> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: proposedEvent.startTime.toISOString(),
        timeMax: proposedEvent.endTime.toISOString(),
        singleEvents: true
      });

      const events = response.data.items || [];
      const conflicts = events
        .map(event => this.convertToCalendarEvent(event))
        .filter(event => 
          event.startTime < proposedEvent.endTime && 
          event.endTime > proposedEvent.startTime
        );

      const hasConflicts = conflicts.length > 0;
      let suggestions: AvailabilitySlot[] = [];

      if (hasConflicts) {
        // Find alternative time slots
        const duration = (proposedEvent.endTime.getTime() - proposedEvent.startTime.getTime()) / 60000;
        const date = proposedEvent.startTime.toISOString().split('T')[0];
        
        suggestions = await this.findAvailability({
          date,
          duration,
          workingHours: { start: '09:00', end: '17:00' }
        }, connectionId, agentId);
      }

      return {
        hasConflicts,
        conflicts,
        suggestions: hasConflicts ? suggestions.slice(0, 3) : undefined
      };
    } catch (error) {
      throw new Error(`Failed to check conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule a new calendar event
   */
  async scheduleEvent(params: CreateEventParams, connectionId: string, agentId: string): Promise<CalendarEvent> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_CREATE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      const event = {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: params.isAllDay 
          ? { date: params.startTime.toISOString().split('T')[0] }
          : { dateTime: params.startTime.toISOString() },
        end: params.isAllDay 
          ? { date: params.endTime.toISOString().split('T')[0] }
          : { dateTime: params.endTime.toISOString() },
        attendees: params.attendees?.map(email => ({ email })),
        reminders: params.reminders ? {
          useDefault: false,
          overrides: params.reminders
        } : undefined
      };

      const response = await calendar.events.insert({
        calendarId: params.calendarId || 'primary',
        requestBody: event,
        sendUpdates: 'all'
      });

      return this.convertToCalendarEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to schedule event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Edit an existing calendar event
   */
  async editCalendarEntry(eventId: string, changes: EditEventParams, connectionId: string, agentId: string): Promise<CalendarEvent> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      // Get existing event
      const existingResponse = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      const existingEvent = existingResponse.data;
      
      // Apply changes
      const updatedEvent = {
        ...existingEvent,
        summary: changes.title || existingEvent.summary,
        description: changes.description !== undefined ? changes.description : existingEvent.description,
        location: changes.location !== undefined ? changes.location : existingEvent.location,
        start: changes.startTime ? (changes.isAllDay 
          ? { date: changes.startTime.toISOString().split('T')[0] }
          : { dateTime: changes.startTime.toISOString() }) : existingEvent.start,
        end: changes.endTime ? (changes.isAllDay 
          ? { date: changes.endTime.toISOString().split('T')[0] }
          : { dateTime: changes.endTime.toISOString() }) : existingEvent.end,
        attendees: changes.attendees ? changes.attendees.map(email => ({ email })) : existingEvent.attendees,
        reminders: changes.reminders ? {
          useDefault: false,
          overrides: changes.reminders
        } : existingEvent.reminders
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updatedEvent,
        sendUpdates: 'all'
      });

      return this.convertToCalendarEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to edit calendar entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEntry(eventId: string, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.CALENDAR_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const calendar = await this.getCalendarClient(connection);
    
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      });
    } catch (error) {
      throw new Error(`Failed to delete calendar entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a summary of a specific day
   */
  async summarizeDay(date: string, connectionId: string, agentId: string): Promise<DaySummary> {
    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await this.readCalendar({ start: startOfDay, end: endOfDay }, connectionId, agentId);
    
    const totalEvents = events.length;
    const totalDuration = events.reduce((total, event) => {
      const duration = (event.endTime.getTime() - event.startTime.getTime()) / 60000;
      return total + duration;
    }, 0);

    const eventsByType: Record<string, number> = {};
    const busyHours: TimeSlot[] = [];
    
    events.forEach(event => {
      // Categorize events
      const type = this.categorizeEvent(event);
      eventsByType[type] = (eventsByType[type] || 0) + 1;
      
      // Add to busy hours
      busyHours.push({
        start: event.startTime.toTimeString().slice(0, 5),
        end: event.endTime.toTimeString().slice(0, 5)
      });
    });

    // Calculate free hours (simplified)
    const freeHours: TimeSlot[] = this.calculateFreeHours(busyHours, date);
    
    // Find upcoming deadlines (events with keywords like "deadline", "due", etc.)
    const upcomingDeadlines = events.filter(event => 
      event.title.toLowerCase().includes('deadline') ||
      event.title.toLowerCase().includes('due') ||
      event.description?.toLowerCase().includes('deadline') ||
      event.description?.toLowerCase().includes('due')
    );

    // Generate AI summary
    const summary = this.generateDaySummary(events, totalDuration);

    return {
      date,
      totalEvents,
      totalDuration,
      eventsByType,
      busyHours,
      freeHours,
      upcomingDeadlines,
      summary
    };
  }

  // Helper methods
  private async getCalendarClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  private convertToCalendarEvent(googleEvent: any): CalendarEvent {
    return {
      id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      startTime: new Date(googleEvent.start?.dateTime || googleEvent.start?.date),
      endTime: new Date(googleEvent.end?.dateTime || googleEvent.end?.date),
      location: googleEvent.location,
      attendees: googleEvent.attendees?.map((attendee: any) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus || 'needsAction',
        optional: attendee.optional || false
      })),
      organizer: googleEvent.organizer ? {
        email: googleEvent.organizer.email,
        displayName: googleEvent.organizer.displayName,
        responseStatus: 'accepted'
      } : undefined,
      isAllDay: !!googleEvent.start?.date,
      status: googleEvent.status || 'confirmed',
      visibility: googleEvent.visibility || 'default',
      recurrence: googleEvent.recurrence,
      reminders: googleEvent.reminders?.overrides?.map((reminder: any) => ({
        method: reminder.method,
        minutes: reminder.minutes
      })),
      calendarId: 'primary',
      htmlLink: googleEvent.htmlLink
    };
  }

  private categorizeEvent(event: CalendarEvent): string {
    const title = event.title.toLowerCase();
    const description = event.description?.toLowerCase() || '';
    
    if (title.includes('meeting') || title.includes('call') || title.includes('sync')) {
      return 'Meeting';
    }
    if (title.includes('interview') || title.includes('candidate')) {
      return 'Interview';
    }
    if (title.includes('deadline') || title.includes('due')) {
      return 'Deadline';
    }
    if (title.includes('break') || title.includes('lunch') || title.includes('personal')) {
      return 'Personal';
    }
    if (title.includes('training') || title.includes('workshop') || title.includes('learning')) {
      return 'Training';
    }
    
    return 'Other';
  }

  private calculateFreeHours(busyHours: TimeSlot[], date: string): TimeSlot[] {
    // Simplified implementation - in reality, this would be more sophisticated
    const workingStart = '09:00';
    const workingEnd = '17:00';
    
    if (busyHours.length === 0) {
      return [{ start: workingStart, end: workingEnd }];
    }
    
    // For now, return a simple free slot if there are gaps
    // This would need more sophisticated logic for real implementation
    return [{ start: '12:00', end: '13:00' }]; // Lunch break as example
  }

  private generateDaySummary(events: CalendarEvent[], totalDuration: number): string {
    if (events.length === 0) {
      return 'You have a free day with no scheduled events.';
    }
    
    const hours = Math.floor(totalDuration / 60);
    const minutes = totalDuration % 60;
    
    let summary = `You have ${events.length} event${events.length > 1 ? 's' : ''} scheduled`;
    if (hours > 0) {
      summary += `, totaling ${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) {
        summary += ` and ${minutes} minutes`;
      }
    } else if (minutes > 0) {
      summary += `, totaling ${minutes} minutes`;
    }
    
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    
    summary += `. Your day starts with "${firstEvent.title}" at ${firstEvent.startTime.toTimeString().slice(0, 5)}`;
    
    if (events.length > 1) {
      summary += ` and ends with "${lastEvent.title}" at ${lastEvent.endTime.toTimeString().slice(0, 5)}`;
    }
    
    return summary + '.';
  }
} 