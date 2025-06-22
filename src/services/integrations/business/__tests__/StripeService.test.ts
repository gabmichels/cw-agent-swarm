// StripeService test file

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';
import { StripeService } from '../StripeService';
import {
  StripePaymentParams,
  PaymentResult,
  RefundParams,
  RefundResult,
  PaymentId,
  StripeConfig
} from '../interfaces/BusinessInterfaces';
import {
  PaymentNotFoundError,
  PaymentValidationError,
  RefundError,
  PaymentProcessingError
} from '../errors/BusinessErrors';

// Mock the logger
vi.mock('../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Simple working Stripe mock
vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = {
      create: vi.fn(),
      confirm: vi.fn(),
      list: vi.fn()
    };
    refunds = {
      create: vi.fn()
    };
    accounts = {
      retrieve: vi.fn()
    };
    
    static errors = {
      StripeError: class StripeError extends Error {
        code: string;
        type: string;
        
        constructor(message: string) {
          super(message);
          this.name = 'StripeError';
          this.code = 'test_error';
          this.type = 'test_type';
        }
      }
    };
  }
}));

describe('StripeService', () => {
  let service: StripeService;
  let mockConfig: StripeConfig;

  const mockPaymentId = `payment_${ulid()}` as PaymentId;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_test_123',
      apiVersion: '2023-10-16'
    };

    service = new StripeService(mockConfig);
  });

  describe('Payment Processing', () => {
    it('should handle payment validation errors', async () => {
      // Arrange - create invalid params that will trigger validation
      const invalidParams: StripePaymentParams = {
        paymentId: '' as PaymentId,
        amount: -100,
        currency: 'invalid',
        customerEmail: 'invalid-email',
        description: 'Test payment',
        confirmationMethod: 'automatic',
        captureMethod: 'automatic'
      };

      // Act & Assert - the service catches PaymentValidationError and re-throws as PaymentProcessingError
      await expect(service.processPayment(invalidParams)).rejects.toThrow(PaymentProcessingError);
    });
  });

  describe('Connection Validation and Health', () => {
    it('should validate connection successfully', async () => {
      // Act
      const result = await service.validateConnection();

      // Assert - this should work with the mocked accounts.retrieve
      expect(result).toBe(true);
    });

    it('should get health status when healthy', async () => {
      // Act
      const result = await service.getHealthStatus();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          isHealthy: true,
          responseTime: expect.any(Number),
          rateLimitStatus: expect.objectContaining({
            remaining: 1000,
            isThrottled: false
          })
        })
      );
    });
  });
});
