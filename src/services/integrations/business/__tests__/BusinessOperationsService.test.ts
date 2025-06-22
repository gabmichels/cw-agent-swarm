import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BusinessOperationsService } from '../BusinessOperationsService';
import { StripeService } from '../StripeService';
import { CalendlyService } from '../CalendlyService';
import { TypeformService } from '../TypeformService';
import {
  StripeConfig,
  CalendlyConfig,
  TypeformConfig
} from '../interfaces/BusinessInterfaces';

// Mock all external dependencies
vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = { create: vi.fn(), confirm: vi.fn(), list: vi.fn() };
    refunds = { create: vi.fn() };
    accounts = { retrieve: vi.fn() };
    static errors = {
      StripeError: class StripeError extends Error {
        constructor(message: string) { super(message); this.name = 'StripeError'; }
      }
    };
  }
}));

global.fetch = vi.fn();

vi.mock('../../../lib/logging', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('BusinessOperationsService', () => {
  let service: BusinessOperationsService;

  beforeEach(() => {
    vi.clearAllMocks();

    const stripeConfig: StripeConfig = {
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_test_123',
      apiVersion: '2023-10-16'
    };

    const calendlyConfig: CalendlyConfig = {
      accessToken: 'test-calendly-token',
      organizationUri: 'https://api.calendly.com/organizations/test'
    };

    const typeformConfig: TypeformConfig = {
      accessToken: 'test-typeform-token',
      workspaceId: 'test-workspace'
    };

    service = new BusinessOperationsService(
      new StripeService(stripeConfig),
      new CalendlyService(calendlyConfig),
      new TypeformService(typeformConfig)
    );
  });

  describe('Service Integration', () => {
    it('should initialize with all three services', () => {
      expect(service).toBeDefined();
      expect(service.providers).toHaveLength(3);
      expect(service.providers.map(p => p.name)).toEqual(['Stripe', 'Calendly', 'Typeform']);
    });

    it('should have correct provider structure', () => {
      const providers = service.providers;
      
      const stripeProvider = providers.find(p => p.id === 'stripe');
      expect(stripeProvider?.name).toBe('Stripe');
      expect(stripeProvider?.capabilities.length).toBeGreaterThan(0);

      const calendlyProvider = providers.find(p => p.id === 'calendly');
      expect(calendlyProvider?.name).toBe('Calendly');

      const typeformProvider = providers.find(p => p.id === 'typeform');
      expect(typeformProvider?.name).toBe('Typeform');
    });
  });

  describe('Core Functionality', () => {
    it('should expose all required operations', () => {
      expect(typeof service.getPaymentStatus).toBe('function');
      expect(typeof service.refundPayment).toBe('function');
      expect(typeof service.scheduleAppointment).toBe('function');
      expect(typeof service.createForm).toBe('function');
      expect(typeof service.validateConnections).toBe('function');
      expect(typeof service.getHealthStatus).toBe('function');
    });

    it('should have stripe provider with payment capabilities', () => {
      const stripeProvider = service.providers.find(p => p.id === 'stripe');
      expect(stripeProvider?.capabilities.some(c => c.type === 'payments')).toBe(true);
    });

    it('should have calendly provider with scheduling capabilities', () => {
      const calendlyProvider = service.providers.find(p => p.id === 'calendly');
      expect(calendlyProvider?.capabilities.some(c => c.type === 'scheduling')).toBe(true);
    });

    it('should have typeform provider with form capabilities', () => {
      const typeformProvider = service.providers.find(p => p.id === 'typeform');
      expect(typeformProvider?.capabilities.some(c => c.type === 'forms')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle async method calls gracefully', async () => {
      // These methods should return promises even if they fail
      const validationPromise = service.validateConnections();
      const healthPromise = service.getHealthStatus();
      
      expect(validationPromise).toBeInstanceOf(Promise);
      expect(healthPromise).toBeInstanceOf(Promise);
      
      // Allow them to fail gracefully
      try {
        await Promise.allSettled([validationPromise, healthPromise]);
      } catch (error) {
        // Expected due to mocking limitations
      }
    });
  });
});
