import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/debug/token-refresh/route';
import { TokenRefreshService } from '../../src/services/workspace/TokenRefreshService';
import { logger } from '../../src/lib/logging';

// Mock dependencies
vi.mock('../../src/services/workspace/TokenRefreshService');
vi.mock('../../src/lib/logging');

describe('Debug Token Refresh API', () => {
  let mockTokenRefreshService: Mock;
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock TokenRefreshService
    mockTokenRefreshService = {
      getInstance: vi.fn(),
      getStatus: vi.fn(),
      getHealthSummary: vi.fn(),
      triggerRefresh: vi.fn(),
    };

    (TokenRefreshService.getInstance as Mock).mockReturnValue(mockTokenRefreshService);

    // Mock NextRequest
    mockRequest = {
      url: 'http://localhost:3000/api/debug/token-refresh',
      method: 'GET',
    } as NextRequest;
  });

  describe('GET /api/debug/token-refresh', () => {
    it('should return service status and health summary', async () => {
      const mockStatus = {
        isRunning: true,
        nextCheckIn: 600000, // 10 minutes in ms
      };

      const mockHealthSummary = {
        total: 5,
        active: 4,
        expired: 1,
        expiringWithin1Hour: 2,
        expiringWithin2Hours: 2,
        missingRefreshToken: 1,
      };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockResolvedValue(mockHealthSummary);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        timestamp: expect.any(String),
        service: {
          isRunning: true,
          checkInterval: '10 minutes',
          nextCheckIn: '600 seconds',
        },
        connections: mockHealthSummary,
        summary: {
          healthyConnections: 1, // active - expiringWithin2Hours - missingRefreshToken = 4 - 2 - 1 = 1
          needsAttention: 5, // expiringWithin2Hours + missingRefreshToken + expired = 2 + 1 + 1 = 4
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Token refresh status requested',
        expect.objectContaining({
          isRunning: true,
          totalConnections: 5,
          activeConnections: 4,
          expiredConnections: 1,
        })
      );
    });

    it('should handle service not running', async () => {
      const mockStatus = {
        isRunning: false,
        nextCheckIn: null,
      };

      const mockHealthSummary = {
        total: 0,
        active: 0,
        expired: 0,
        expiringWithin1Hour: 0,
        expiringWithin2Hours: 0,
        missingRefreshToken: 0,
      };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockResolvedValue(mockHealthSummary);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.service).toEqual({
        isRunning: false,
        checkInterval: null,
        nextCheckIn: null,
      });
    });

    it('should handle errors gracefully', async () => {
      mockTokenRefreshService.getStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Failed to get token refresh status',
        message: 'Service error',
        timestamp: expect.any(String),
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting token refresh status',
        expect.objectContaining({
          error: 'Service error'
        })
      );
    });

    it('should handle health summary errors', async () => {
      const mockStatus = {
        isRunning: true,
        nextCheckIn: 600000,
      };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockRejectedValue(new Error('Database error'));

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to get token refresh status');
    });
  });

  describe('POST /api/debug/token-refresh', () => {
    beforeEach(() => {
      mockRequest = {
        url: 'http://localhost:3000/api/debug/token-refresh',
        method: 'POST',
      } as NextRequest;
    });

    it('should trigger manual token refresh successfully', async () => {
      const mockResult = {
        refreshed: 3,
        errors: 0,
      };

      mockTokenRefreshService.triggerRefresh.mockResolvedValue(mockResult);

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        success: true,
        message: 'Token refresh completed',
        result: mockResult,
        timestamp: expect.any(String),
      });

      expect(logger.info).toHaveBeenCalledWith('Manual token refresh triggered via API');
      expect(logger.info).toHaveBeenCalledWith('Manual token refresh completed via API', mockResult);
      expect(mockTokenRefreshService.triggerRefresh).toHaveBeenCalledOnce();
    });

    it('should handle refresh errors', async () => {
      mockTokenRefreshService.triggerRefresh.mockRejectedValue(new Error('Refresh failed'));

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: 'Failed to trigger token refresh',
        message: 'Refresh failed',
        timestamp: expect.any(String),
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error triggering token refresh',
        expect.objectContaining({
          error: 'Refresh failed'
        })
      );
    });

    it('should handle partial refresh results', async () => {
      const mockResult = {
        refreshed: 2,
        errors: 1,
      };

      mockTokenRefreshService.triggerRefresh.mockResolvedValue(mockResult);

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.result).toEqual(mockResult);
    });
  });

  describe('Service Integration', () => {
    it('should use the same TokenRefreshService instance', async () => {
      // Test that both GET and POST use the same service instance
      const mockStatus = { isRunning: true, nextCheckIn: 600000 };
      const mockHealthSummary = { total: 0, active: 0, expired: 0, expiringWithin1Hour: 0, expiringWithin2Hours: 0, missingRefreshToken: 0 };
      const mockResult = { refreshed: 0, errors: 0 };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockResolvedValue(mockHealthSummary);
      mockTokenRefreshService.triggerRefresh.mockResolvedValue(mockResult);

      // Call GET endpoint
      await GET(mockRequest);

      // Call POST endpoint
      const postRequest = { ...mockRequest, method: 'POST' } as NextRequest;
      await POST(postRequest);

      // Both should use the same instance
      expect(TokenRefreshService.getInstance).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Format Validation', () => {
    it('should include proper timestamp format', async () => {
      const mockStatus = { isRunning: true, nextCheckIn: 600000 };
      const mockHealthSummary = { total: 0, active: 0, expired: 0, expiringWithin1Hour: 0, expiringWithin2Hours: 0, missingRefreshToken: 0 };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockResolvedValue(mockHealthSummary);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      // Check timestamp is valid ISO string
      expect(new Date(responseData.timestamp).toISOString()).toBe(responseData.timestamp);
    });

    it('should calculate summary metrics correctly', async () => {
      const mockStatus = { isRunning: true, nextCheckIn: 600000 };
      const mockHealthSummary = {
        total: 10,
        active: 8,
        expired: 2,
        expiringWithin1Hour: 1,
        expiringWithin2Hours: 3,
        missingRefreshToken: 2,
      };

      mockTokenRefreshService.getStatus.mockReturnValue(mockStatus);
      mockTokenRefreshService.getHealthSummary.mockResolvedValue(mockHealthSummary);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(responseData.summary).toEqual({
        healthyConnections: 3, // active - expiringWithin2Hours - missingRefreshToken = 8 - 3 - 2 = 3
        needsAttention: 7, // expiringWithin2Hours + missingRefreshToken + expired = 3 + 2 + 2 = 7
      });
    });
  });
}); 