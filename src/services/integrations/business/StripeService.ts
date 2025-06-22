import { ulid } from 'ulid';
import Stripe from 'stripe';
import { 
  StripePaymentParams,
  PaymentResult,
  RefundParams,
  RefundResult,
  HealthStatus,
  StripeConfig,
  PaymentId,
  CustomerId,
  PaymentStatus
} from './interfaces/BusinessInterfaces';
import {
  PaymentError,
  PaymentValidationError,
  PaymentProcessingError,
  PaymentNotFoundError,
  RefundError,
  StripeError,
  BusinessConnectionError,
  BusinessAuthenticationError,
  BusinessRateLimitError
} from './errors/BusinessErrors';
import { logger } from '../../../lib/logging';

export class StripeService {
  private readonly stripe: Stripe;

  constructor(
    private readonly config: StripeConfig
  ) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: config.apiVersion as Stripe.LatestApiVersion,
      typescript: true,
      timeout: 30000,
      maxNetworkRetries: 3
    });
  }

  async processPayment(params: StripePaymentParams): Promise<PaymentResult> {
    try {
      this.validatePaymentParams(params);
      
      logger.info('Creating Stripe payment intent', {
        paymentId: params.paymentId,
        amount: params.amount,
        currency: params.currency
      });

      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: params.amount,
        currency: params.currency,
        payment_method: params.paymentMethodId,
        confirmation_method: params.confirmationMethod,
        capture_method: params.captureMethod,
        description: params.description,
        metadata: {
          paymentId: params.paymentId,
          ...params.metadata
        }
      };

      if (params.customerId) {
        paymentIntentParams.customer = params.customerId;
      }

      if (params.customerEmail && !params.customerId) {
        paymentIntentParams.receipt_email = params.customerEmail;
      }

      if (params.setupFutureUsage) {
        paymentIntentParams.setup_future_usage = params.setupFutureUsage;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

      // Confirm the payment intent
      const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: params.paymentMethodId,
          expand: ['charges.data']
        }
      );

      const result: PaymentResult = {
        paymentId: params.paymentId,
        stripePaymentIntentId: confirmedPaymentIntent.id,
        status: this.mapStripeStatus(confirmedPaymentIntent.status),
        amount: confirmedPaymentIntent.amount,
        currency: confirmedPaymentIntent.currency,
        customerId: confirmedPaymentIntent.customer ? 
          `customer_${confirmedPaymentIntent.customer}` as CustomerId : 
          undefined,
        createdAt: new Date(confirmedPaymentIntent.created * 1000),
        confirmedAt: confirmedPaymentIntent.status === 'succeeded' ? new Date() : undefined,
        receiptUrl: (confirmedPaymentIntent as any).charges?.data?.[0]?.receipt_url || undefined,
        refundable: confirmedPaymentIntent.status === 'succeeded'
      };

      logger.info('Payment processed successfully', {
        paymentId: params.paymentId,
        stripePaymentIntentId: confirmedPaymentIntent.id,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to process payment', {
        paymentId: params.paymentId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentProcessingError(
          params.paymentId,
          error.message,
          error.code,
          { 
            type: error.type,
            decline_code: error.decline_code,
            payment_intent_id: error.payment_intent?.id
          }
        );
      }

      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentProcessingError(
        params.paymentId,
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getPaymentStatus(paymentId: PaymentId): Promise<PaymentResult> {
    try {
      logger.debug('Getting payment status', { paymentId });

      // In a real implementation, we'd need to store the mapping between our paymentId and Stripe's payment intent ID
      // For now, we'll search by metadata
      const paymentIntents = await this.stripe.paymentIntents.list({
        limit: 100,
        expand: ['data.charges']
      });

      const paymentIntent = paymentIntents.data.find((pi: Stripe.PaymentIntent) => 
        pi.metadata.paymentId === paymentId
      );

      if (!paymentIntent) {
        throw new PaymentNotFoundError(paymentId);
      }

      const result: PaymentResult = {
        paymentId,
        stripePaymentIntentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerId: paymentIntent.customer ? 
          `customer_${paymentIntent.customer}` as CustomerId : 
          undefined,
        createdAt: new Date(paymentIntent.created * 1000),
        confirmedAt: paymentIntent.status === 'succeeded' ? new Date() : undefined,
        receiptUrl: (paymentIntent as any).charges?.data?.[0]?.receipt_url || undefined,
        refundable: paymentIntent.status === 'succeeded'
      };

      logger.debug('Payment status retrieved', {
        paymentId,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to get payment status', { 
        paymentId, 
        error: error instanceof Error ? error.message : String(error) 
      });

      if (error instanceof PaymentNotFoundError) {
        throw error;
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw new StripeError(
          error.message,
          error.code,
          error.statusCode,
          { type: error.type }
        );
      }

      throw new PaymentError(
        'Failed to retrieve payment status',
        paymentId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    try {
      logger.info('Processing refund', { 
        paymentId: params.paymentId, 
        amount: params.amount 
      });

      // Get the payment intent first
      const paymentIntents = await this.stripe.paymentIntents.list({
        limit: 100,
        expand: ['data.charges']
      });

      const paymentIntent = paymentIntents.data.find((pi: Stripe.PaymentIntent) => 
        pi.metadata.paymentId === params.paymentId
      );

      if (!paymentIntent) {
        throw new PaymentNotFoundError(params.paymentId);
      }

      // Get the charge to refund
      const charges = (paymentIntent as any).charges?.data || [];
      const chargeToRefund = charges.find((charge: any) => charge.paid);

      if (!chargeToRefund) {
        throw new RefundError(
          params.paymentId,
          'No paid charge found for this payment'
        );
      }

      // Create the refund
      const refund = await this.stripe.refunds.create({
        charge: chargeToRefund.id,
        amount: params.amount,
        reason: params.reason || 'requested_by_customer',
        metadata: {
          paymentId: params.paymentId,
          refundId: params.refundId
        }
      });

      const result: RefundResult = {
        refundId: params.refundId,
        paymentId: params.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
        reason: refund.reason || 'requested_by_customer',
        createdAt: new Date(refund.created * 1000),
        processedAt: refund.status === 'succeeded' ? new Date() : undefined
      };

      logger.info('Refund processed successfully', {
        refundId: params.refundId,
        paymentId: params.paymentId,
        stripeRefundId: refund.id,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to process refund', { 
        refundId: params.refundId,
        paymentId: params.paymentId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof PaymentNotFoundError || error instanceof RefundError) {
        throw error;
      }

      if (error instanceof Stripe.errors.StripeError) {
        throw new RefundError(
          params.paymentId,
          error.message,
          { 
            stripeErrorCode: error.code,
            stripeErrorType: error.type 
          }
        );
      }

      throw new RefundError(
        params.paymentId,
        error instanceof Error ? error.message : 'Unknown error',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.stripe.accounts.retrieve();
      return true;
    } catch (error) {
      logger.error('Stripe connection validation failed', { error });
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.stripe.accounts.retrieve();
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        lastChecked: new Date(),
        responseTime,
        rateLimitStatus: {
          remaining: 1000, // Stripe doesn't expose rate limit info in headers for most endpoints
          resetAt: new Date(Date.now() + 60000),
          isThrottled: false
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      let errors: string[] = [];
      if (error instanceof Stripe.errors.StripeError) {
        errors = [error.message];
      } else {
        errors = [error instanceof Error ? error.message : 'Unknown error'];
      }
      
      return {
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errors,
        rateLimitStatus: {
          remaining: 0,
          resetAt: new Date(Date.now() + 60000),
          isThrottled: true
        }
      };
    }
  }

  private validatePaymentParams(params: StripePaymentParams): void {
    const errors: string[] = [];
    
    if (!params.paymentId?.trim()) {
      errors.push('Payment ID is required');
    }
    
    if (!params.amount || params.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (!params.currency?.trim()) {
      errors.push('Currency is required');
    }
    
    if (params.currency && !this.isValidCurrency(params.currency)) {
      errors.push('Invalid currency code');
    }
    
    if (params.customerEmail && !this.isValidEmail(params.customerEmail)) {
      errors.push('Invalid customer email format');
    }
    
    if (errors.length > 0) {
      throw new PaymentValidationError(errors, params.paymentId);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidCurrency(currency: string): boolean {
    // Stripe supports many currencies - this is a subset of common ones
    const supportedCurrencies = [
      'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek', 'nok', 'dkk',
      'pln', 'czk', 'huf', 'bgn', 'ron', 'hrk', 'ils', 'mxn', 'brl', 'inr',
      'sgd', 'hkd', 'nzd', 'krw', 'thb', 'php', 'myr', 'idr', 'vnd'
    ];
    return supportedCurrencies.includes(currency.toLowerCase());
  }

  private mapStripeStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return 'succeeded';
      case 'processing':
        return 'processing';
      case 'requires_action':
        return 'requires_action';
      case 'requires_confirmation':
        return 'requires_confirmation';
      case 'requires_payment_method':
        return 'requires_payment_method';
      case 'requires_capture':
        return 'requires_capture';
      case 'canceled':
        return 'canceled';
      default:
        return 'failed';
    }
  }
} 