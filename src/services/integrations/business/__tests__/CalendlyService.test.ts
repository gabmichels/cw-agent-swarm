// CalendlyService test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid } from 'ulid';
import { CalendlyService } from '../CalendlyService';
import {
  CalendlyBookingParams,
  BookingResult,
  BookingId,
  CalendlyConfig
} from '../interfaces/BusinessInterfaces';
import {
  BookingNotFoundError,
  CalendlyError
} from '../errors/BusinessErrors';

// Mock fetch globally
global.fetch = vi.fn();

// Mock the logger
vi.mock('../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('CalendlyService', () => {
  let service: CalendlyService;
  let mockConfig: CalendlyConfig;

  const mockBookingId = `booking_${ulid()}` as BookingId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    mockConfig = {
      accessToken: 'test-access-token',
      organizationUri: 'https://api.calendly.com/organizations/test-org'
    };

    service = new CalendlyService(mockConfig);
  });

  describe('Connection Validation and Health', () => {
    it('should validate connection successfully', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ 
          resource: {
            uri: 'https://api.calendly.com/users/test-user',
            name: 'Test User'
          }
        })
      });

      // Act
      const result = await service.validateConnection();

      // Assert
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.calendly.com/users/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token'
          })
        })
      );
    });

    it('should get health status when healthy', async () => {
      // Arrange
      const mockResponse = {
        ok: true,
        headers: new Map([
          ['X-Rate-Limit-Remaining', '1000'],
          ['X-Rate-Limit-Reset', '1640995200']
        ]),
        json: async () => ({ 
          resource: {
            uri: 'https://api.calendly.com/users/test-user',
            name: 'Test User'
          }
        })
      };

      // Mock headers.get method
      mockResponse.headers.get = vi.fn().mockImplementation((header: string) => {
        const headerMap: Record<string, string> = {
          'X-Rate-Limit-Remaining': '1000',
          'X-Rate-Limit-Reset': '1640995200'
        };
        return headerMap[header] || null;
      });

      (global.fetch as any).mockResolvedValue(mockResponse);

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
