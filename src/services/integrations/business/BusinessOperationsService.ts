import { ulid } from 'ulid';
import { 
  IBusinessOperationsService,
  BusinessProvider,
  StripePaymentParams,
  PaymentResult,
  RefundParams,
  RefundResult,
  CalendlyBookingParams,
  BookingResult,
  TypeformCreationParams,
  FormResult,
  FormResponse,
  HealthStatus,
  PaymentId,
  BookingId,
  FormId
} from './interfaces/BusinessInterfaces';
import {
  BusinessOperationsError,
  PaymentNotFoundError,
  BookingNotFoundError,
  FormNotFoundError
} from './errors/BusinessErrors';
import { StripeService } from './StripeService';
import { CalendlyService } from './CalendlyService';
import { TypeformService } from './TypeformService';
import { logger } from '../../../lib/logging';

export class BusinessOperationsService implements IBusinessOperationsService {
  public readonly providers: readonly BusinessProvider[] = [
    {
      id: 'stripe',
      name: 'Stripe',
      apiEndpoint: 'https://api.stripe.com/v1',
      rateLimit: {
        requestsPerMinute: 1000,
        requestsPerHour: 60000,
        requestsPerDay: 1440000
      },
      capabilities: [
        { type: 'payments', isAvailable: true },
        { type: 'subscriptions', isAvailable: true },
        { type: 'invoicing', isAvailable: true }
      ]
    },
    {
      id: 'calendly',
      name: 'Calendly',
      apiEndpoint: 'https://api.calendly.com',
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 3600,
        requestsPerDay: 86400
      },
      capabilities: [
        { type: 'scheduling', isAvailable: true }
      ]
    },
    {
      id: 'typeform',
      name: 'Typeform',
      apiEndpoint: 'https://api.typeform.com',
      rateLimit: {
        requestsPerMinute: 200,
        requestsPerHour: 12000,
        requestsPerDay: 288000
      },
      capabilities: [
        { type: 'forms', isAvailable: true }
      ]
    }
  ];

  constructor(
    private readonly stripeService: StripeService,
    private readonly calendlyService: CalendlyService,
    private readonly typeformService: TypeformService
  ) {}

  // Payment operations
  async processPayment(params: StripePaymentParams): Promise<PaymentResult> {
    try {
      logger.info('Processing payment', { 
        paymentId: params.paymentId,
        amount: params.amount,
        currency: params.currency 
      });

      const result = await this.stripeService.processPayment(params);

      logger.info('Payment processed successfully', {
        paymentId: params.paymentId,
        status: result.status,
        stripePaymentIntentId: result.stripePaymentIntentId
      });

      return result;
    } catch (error) {
      logger.error('Failed to process payment', {
        paymentId: params.paymentId,
        error
      });
      throw error;
    }
  }

  async getPaymentStatus(paymentId: PaymentId): Promise<PaymentResult> {
    try {
      logger.debug('Getting payment status', { paymentId });

      const result = await this.stripeService.getPaymentStatus(paymentId);

      logger.debug('Payment status retrieved', {
        paymentId,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to get payment status', { paymentId, error });
      
      if (error instanceof PaymentNotFoundError) {
        throw error;
      }
      
      throw new BusinessOperationsError(
        'Failed to retrieve payment status',
        'PAYMENT_STATUS_RETRIEVAL_FAILED',
        { paymentId, originalError: error }
      );
    }
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    try {
      logger.info('Processing refund', {
        paymentId: params.paymentId,
        amount: params.amount,
        reason: params.reason
      });

      const result = await this.stripeService.refundPayment(params);

      logger.info('Refund processed successfully', {
        paymentId: params.paymentId,
        refundId: result.refundId,
        amount: result.amount,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to process refund', {
        paymentId: params.paymentId,
        error
      });
      throw error;
    }
  }

  // Scheduling operations
  async scheduleAppointment(params: CalendlyBookingParams): Promise<BookingResult> {
    try {
      logger.info('Scheduling appointment', {
        bookingId: params.bookingId,
        inviteeEmail: params.inviteeEmail,
        startTime: params.startTime.toISOString(),
        endTime: params.endTime.toISOString()
      });

      const result = await this.calendlyService.scheduleAppointment(params);

      logger.info('Appointment scheduled successfully', {
        bookingId: params.bookingId,
        calendlyEventUri: result.calendlyEventUri,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to schedule appointment', {
        bookingId: params.bookingId,
        error
      });
      throw error;
    }
  }

  async getBookingStatus(bookingId: BookingId): Promise<BookingResult> {
    try {
      logger.debug('Getting booking status', { bookingId });

      const result = await this.calendlyService.getBookingStatus(bookingId);

      logger.debug('Booking status retrieved', {
        bookingId,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to get booking status', { bookingId, error });
      
      if (error instanceof BookingNotFoundError) {
        throw error;
      }
      
      throw new BusinessOperationsError(
        'Failed to retrieve booking status',
        'BOOKING_STATUS_RETRIEVAL_FAILED',
        { bookingId, originalError: error }
      );
    }
  }

  async cancelBooking(bookingId: BookingId, reason?: string): Promise<void> {
    try {
      logger.info('Canceling booking', { bookingId, reason });

      await this.calendlyService.cancelBooking(bookingId, reason);

      logger.info('Booking canceled successfully', { bookingId });
    } catch (error) {
      logger.error('Failed to cancel booking', { bookingId, error });
      throw error;
    }
  }

  async rescheduleBooking(bookingId: BookingId, newStartTime: Date, newEndTime: Date): Promise<BookingResult> {
    try {
      logger.info('Rescheduling booking', {
        bookingId,
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString()
      });

      const result = await this.calendlyService.rescheduleBooking(bookingId, newStartTime, newEndTime);

      logger.info('Booking rescheduled successfully', {
        bookingId,
        newStartTime: result.startTime.toISOString(),
        newEndTime: result.endTime.toISOString()
      });

      return result;
    } catch (error) {
      logger.error('Failed to reschedule booking', { bookingId, error });
      throw error;
    }
  }

  // Form operations
  async createForm(params: TypeformCreationParams): Promise<FormResult> {
    try {
      logger.info('Creating form', {
        formId: params.formId,
        title: params.title,
        fieldCount: params.fields.length
      });

      const result = await this.typeformService.createForm(params);

      logger.info('Form created successfully', {
        formId: params.formId,
        typeformId: result.typeformId,
        publicUrl: result.publicUrl
      });

      return result;
    } catch (error) {
      logger.error('Failed to create form', {
        formId: params.formId,
        error
      });
      throw error;
    }
  }

  async getForm(formId: FormId): Promise<FormResult> {
    try {
      logger.debug('Getting form', { formId });

      const result = await this.typeformService.getForm(formId);

      logger.debug('Form retrieved', {
        formId,
        title: result.title,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to get form', { formId, error });
      
      if (error instanceof FormNotFoundError) {
        throw error;
      }
      
      throw new BusinessOperationsError(
        'Failed to retrieve form',
        'FORM_RETRIEVAL_FAILED',
        { formId, originalError: error }
      );
    }
  }

  async updateForm(formId: FormId, updates: Partial<TypeformCreationParams>): Promise<FormResult> {
    try {
      logger.info('Updating form', {
        formId,
        updates: Object.keys(updates)
      });

      const result = await this.typeformService.updateForm(formId, updates);

      logger.info('Form updated successfully', {
        formId,
        title: result.title
      });

      return result;
    } catch (error) {
      logger.error('Failed to update form', { formId, error });
      throw error;
    }
  }

  async deleteForm(formId: FormId): Promise<void> {
    try {
      logger.info('Deleting form', { formId });

      await this.typeformService.deleteForm(formId);

      logger.info('Form deleted successfully', { formId });
    } catch (error) {
      logger.error('Failed to delete form', { formId, error });
      throw error;
    }
  }

  async getFormResponses(formId: FormId, limit?: number, since?: Date): Promise<readonly FormResponse[]> {
    try {
      logger.debug('Getting form responses', {
        formId,
        limit,
        since: since?.toISOString()
      });

      const responses = await this.typeformService.getFormResponses(formId, limit, since);

      logger.debug('Form responses retrieved', {
        formId,
        responseCount: responses.length
      });

      return responses;
    } catch (error) {
      logger.error('Failed to get form responses', { formId, error });
      throw error;
    }
  }

  // Health and validation
  async validateConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    try {
      const [stripeValid, calendlyValid, typeformValid] = await Promise.allSettled([
        this.stripeService.validateConnection(),
        this.calendlyService.validateConnection(),
        this.typeformService.validateConnection()
      ]);

      results.stripe = stripeValid.status === 'fulfilled' ? stripeValid.value : false;
      results.calendly = calendlyValid.status === 'fulfilled' ? calendlyValid.value : false;
      results.typeform = typeformValid.status === 'fulfilled' ? typeformValid.value : false;

      logger.info('Connection validation completed', results);

      return results;
    } catch (error) {
      logger.error('Failed to validate connections', { error });
      throw new BusinessOperationsError(
        'Failed to validate service connections',
        'CONNECTION_VALIDATION_FAILED',
        { originalError: error }
      );
    }
  }

  async getHealthStatus(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};

    try {
      const [stripeHealth, calendlyHealth, typeformHealth] = await Promise.allSettled([
        this.stripeService.getHealthStatus(),
        this.calendlyService.getHealthStatus(),
        this.typeformService.getHealthStatus()
      ]);

      results.stripe = stripeHealth.status === 'fulfilled' 
        ? stripeHealth.value 
        : {
            isHealthy: false,
            lastChecked: new Date(),
            responseTime: 0,
            errors: [stripeHealth.reason?.toString() || 'Unknown error'],
            rateLimitStatus: {
              remaining: 0,
              resetAt: new Date(Date.now() + 60000),
              isThrottled: true
            }
          };

      results.calendly = calendlyHealth.status === 'fulfilled'
        ? calendlyHealth.value
        : {
            isHealthy: false,
            lastChecked: new Date(),
            responseTime: 0,
            errors: [calendlyHealth.reason?.toString() || 'Unknown error'],
            rateLimitStatus: {
              remaining: 0,
              resetAt: new Date(Date.now() + 60000),
              isThrottled: true
            }
          };

      results.typeform = typeformHealth.status === 'fulfilled'
        ? typeformHealth.value
        : {
            isHealthy: false,
            lastChecked: new Date(),
            responseTime: 0,
            errors: [typeformHealth.reason?.toString() || 'Unknown error'],
            rateLimitStatus: {
              remaining: 0,
              resetAt: new Date(Date.now() + 60000),
              isThrottled: true
            }
          };

      logger.info('Health status check completed', {
        stripe: results.stripe.isHealthy,
        calendly: results.calendly.isHealthy,
        typeform: results.typeform.isHealthy
      });

      return results;
    } catch (error) {
      logger.error('Failed to get health status', { error });
      throw new BusinessOperationsError(
        'Failed to retrieve service health status',
        'HEALTH_STATUS_RETRIEVAL_FAILED',
        { originalError: error }
      );
    }
  }

  // Utility methods
  generatePaymentId(): PaymentId {
    return `payment_${ulid()}` as PaymentId;
  }

  generateBookingId(): BookingId {
    return `booking_${ulid()}` as BookingId;
  }

  generateFormId(): FormId {
    return `form_${ulid()}` as FormId;
  }
} 