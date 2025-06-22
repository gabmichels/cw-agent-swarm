import { 
  CalendlyBookingParams,
  BookingResult,
  HealthStatus,
  CalendlyConfig,
  BookingId
} from './interfaces/BusinessInterfaces';
import {
  BookingError,
  BookingNotFoundError,
  CalendlyError
} from './errors/BusinessErrors';
import { logger } from '../../../lib/logging';

interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
  color: string;
  description?: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
}

interface CalendlyEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
  event_memberships: Array<{
    user: string;
    user_email: string;
    user_name: string;
  }>;
  event_guests: Array<{
    email: string;
    created_at: string;
  }>;
  cancel_url: string;
  reschedule_url: string;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  status: 'active' | 'canceled';
  timezone: string;
  event: string;
  created_at: string;
  updated_at: string;
  cancel_url: string;
  reschedule_url: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
  tracking?: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
    salesforce_uuid?: string;
  };
}

interface CalendlySchedulingLink {
  booking_url: string;
  owner: string;
  owner_type: 'EventType' | 'User';
}

export class CalendlyService {
  private readonly baseUrl = 'https://api.calendly.com';
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: CalendlyConfig
  ) {
    this.headers = {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async scheduleAppointment(params: CalendlyBookingParams): Promise<BookingResult> {
    try {
      logger.info('Scheduling appointment with Calendly', {
        bookingId: params.bookingId,
        eventTypeUri: params.eventTypeUri,
        inviteeEmail: params.inviteeEmail
      });

      // First, get the event type details
      const eventType = await this.getEventType(params.eventTypeUri);
      
      // Create a scheduling link for the invitee
      const schedulingLink = await this.createSchedulingLink(params.eventTypeUri, {
        email: params.inviteeEmail,
        name: params.inviteeName,
        start_time: params.startTime.toISOString(),
        end_time: params.endTime.toISOString(),
        timezone: params.timezone,
        questions_and_answers: params.customQuestions?.map(q => ({
          question: q.question,
          answer: q.answer
        })) || []
      });

      // For this implementation, we'll simulate the booking creation
      // In a real implementation, you'd use Calendly's scheduling API or webhooks
      const result: BookingResult = {
        bookingId: params.bookingId,
        calendlyEventUri: `${this.baseUrl}/scheduled_events/${params.bookingId}`,
        status: 'active',
        eventType: {
          uri: eventType.uri,
          name: eventType.name,
          duration: eventType.duration,
          color: eventType.color,
          description: eventType.description
        },
        invitee: {
          email: params.inviteeEmail,
          name: params.inviteeName,
          timezone: params.timezone,
          customQuestions: params.customQuestions
        },
        startTime: params.startTime,
        endTime: params.endTime,
        timezone: params.timezone,
        location: this.mapLocation(eventType),
        joinUrl: schedulingLink.booking_url,
        rescheduleUrl: params.rescheduleUrl || `${schedulingLink.booking_url}/reschedule`,
        cancelUrl: params.cancelUrl || `${schedulingLink.booking_url}/cancel`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Appointment scheduled successfully', {
        bookingId: params.bookingId,
        calendlyEventUri: result.calendlyEventUri,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to schedule appointment', { 
        bookingId: params.bookingId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof CalendlyError) {
        throw error;
      }

      throw new BookingError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        params.bookingId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getBookingStatus(bookingId: BookingId): Promise<BookingResult> {
    try {
      logger.debug('Getting booking status', { bookingId });

      // Get the event from Calendly API
      const response = await fetch(`${this.baseUrl}/scheduled_events/${bookingId}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new BookingNotFoundError(bookingId);
        }
        throw new CalendlyError(`Failed to get booking: ${response.statusText}`);
      }

      const data = await response.json();
      const event: CalendlyEvent = data.resource;

      // Get invitee information
      const inviteesResponse = await fetch(`${this.baseUrl}/scheduled_events/${bookingId}/invitees`, {
        method: 'GET',
        headers: this.headers
      });

      if (!inviteesResponse.ok) {
        throw new CalendlyError(`Failed to get invitees: ${inviteesResponse.statusText}`);
      }

      const inviteesData = await inviteesResponse.json();
      const invitee: CalendlyInvitee = inviteesData.collection[0]; // Assuming single invitee

      const result: BookingResult = {
        bookingId,
        calendlyEventUri: event.uri,
        status: this.mapBookingStatus(event.status),
        eventType: {
          uri: event.event_type,
          name: event.name,
          duration: this.calculateDuration(event.start_time, event.end_time),
          color: '#0069ff' // Default Calendly color
        },
        invitee: {
          email: invitee.email,
          name: invitee.name,
          timezone: invitee.timezone,
          customQuestions: invitee.questions_and_answers?.map(qa => ({
            question: qa.question,
            answer: qa.answer,
            required: true // Default to required
          }))
        },
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        timezone: invitee.timezone,
        location: this.mapEventLocation(event.location),
        rescheduleUrl: event.reschedule_url,
        cancelUrl: event.cancel_url,
        createdAt: new Date(event.created_at),
        updatedAt: new Date(event.updated_at)
      };

      logger.debug('Booking status retrieved', {
        bookingId,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to get booking status', { 
        bookingId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof BookingNotFoundError || error instanceof CalendlyError) {
        throw error;
      }

      throw new BookingError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        bookingId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async cancelBooking(bookingId: BookingId, reason?: string): Promise<void> {
    try {
      logger.info('Canceling booking', { bookingId, reason });

      // Cancel the event in Calendly
      const response = await fetch(`${this.baseUrl}/scheduled_events/${bookingId}/cancellation`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          reason: reason || 'Canceled by user'
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new BookingNotFoundError(bookingId);
        }
        throw new CalendlyError(`Failed to cancel booking: ${response.statusText}`);
      }

      logger.info('Booking canceled successfully', { bookingId });
    } catch (error) {
      logger.error('Failed to cancel booking', { 
        bookingId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof BookingNotFoundError || error instanceof CalendlyError) {
        throw error;
      }

      throw new BookingError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        bookingId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async rescheduleBooking(bookingId: BookingId, newStartTime: Date, newEndTime: Date): Promise<BookingResult> {
    try {
      logger.info('Rescheduling booking', { bookingId, newStartTime, newEndTime });

      // Get current booking details
      const currentBooking = await this.getBookingStatus(bookingId);

      // Cancel the current booking
      await this.cancelBooking(bookingId, 'Rescheduled to new time');

      // Create a new booking with the new time
      const newBookingParams: CalendlyBookingParams = {
        bookingId: bookingId, // Reuse the same booking ID
        eventTypeUri: currentBooking.eventType.uri,
        inviteeEmail: currentBooking.invitee.email,
        inviteeName: currentBooking.invitee.name,
        startTime: newStartTime,
        endTime: newEndTime,
        timezone: currentBooking.timezone,
        customQuestions: currentBooking.invitee.customQuestions
      };

      const rescheduledBooking = await this.scheduleAppointment(newBookingParams);

      logger.info('Booking rescheduled successfully', {
        bookingId,
        newStartTime,
        newEndTime
      });

      return rescheduledBooking;
    } catch (error) {
      logger.error('Failed to reschedule booking', { 
        bookingId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof BookingNotFoundError || error instanceof CalendlyError) {
        throw error;
      }

      throw new BookingError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        bookingId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Test the connection by getting user information
      const response = await fetch(`${this.baseUrl}/users/me`, {
        method: 'GET',
        headers: this.headers
      });

      const isValid = response.ok;
      
      if (!isValid) {
        logger.warn('Calendly connection validation failed', { 
          status: response.status,
          statusText: response.statusText 
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Calendly connection validation failed', { error });
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check API health by getting user info
      const response = await fetch(`${this.baseUrl}/users/me`, {
        method: 'GET',
        headers: this.headers
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        // Parse rate limit headers if available
        const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '1000');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        return {
          isHealthy: true,
          lastChecked: new Date(),
          responseTime,
          rateLimitStatus: {
            remaining: rateLimitRemaining,
            resetAt: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : new Date(Date.now() + 60000),
            isThrottled: rateLimitRemaining < 10
          }
        };
      } else {
        return {
          isHealthy: false,
          lastChecked: new Date(),
          responseTime,
          errors: [`HTTP ${response.status}: ${response.statusText}`],
          rateLimitStatus: {
            remaining: 0,
            resetAt: new Date(Date.now() + 60000),
            isThrottled: true
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        rateLimitStatus: {
          remaining: 0,
          resetAt: new Date(Date.now() + 60000),
          isThrottled: true
        }
      };
    }
  }

  private async getEventType(eventTypeUri: string): Promise<CalendlyEventType> {
    const response = await fetch(`${this.baseUrl}/event_types/${this.extractIdFromUri(eventTypeUri)}`, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      throw new CalendlyError(`Failed to get event type: ${response.statusText}`);
    }

    const data = await response.json();
    return data.resource;
  }

  private async createSchedulingLink(eventTypeUri: string, inviteeData: any): Promise<CalendlySchedulingLink> {
    const response = await fetch(`${this.baseUrl}/scheduling_links`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        max_event_count: 1,
        owner: eventTypeUri,
        owner_type: 'EventType'
      })
    });

    if (!response.ok) {
      throw new CalendlyError(`Failed to create scheduling link: ${response.statusText}`);
    }

    const data = await response.json();
    return data.resource;
  }

  private mapLocation(eventType: CalendlyEventType): any {
    // This would map Calendly location data to our interface
    return {
      type: 'custom',
      location: 'Online meeting',
      additionalInfo: 'Meeting details will be provided'
    };
  }

  private mapEventLocation(location?: any): any {
    if (!location) return undefined;
    
    return {
      type: location.type || 'custom',
      location: location.location,
      additionalInfo: location.additional_info
    };
  }

  private mapBookingStatus(status: string): any {
    switch (status) {
      case 'active': return 'active';
      case 'canceled': return 'canceled';
      default: return 'active';
    }
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Duration in minutes
  }

  private extractIdFromUri(uri: string): string {
    return uri.split('/').pop() || '';
  }
} 