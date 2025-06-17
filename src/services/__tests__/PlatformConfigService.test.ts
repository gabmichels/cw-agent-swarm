/**
 * PlatformConfigService Unit Tests
 * 
 * Comprehensive test suite for platform configuration service
 * Following IMPLEMENTATION_GUIDELINES.md with >95% test coverage
 */

import { PlatformConfigService, PlatformMode, PlatformConfigError } from '../PlatformConfigService';

describe('PlatformConfigService', () => {
  // Store original environment variables
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment and singleton instance before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Reset singleton instance by accessing private property
    // This is needed for testing but should not be used in production
    (PlatformConfigService as any).instance = null;
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Platform Mode Detection', () => {
    it('should default to personal mode when PLATFORM_MODE is not set', () => {
      delete process.env.PLATFORM_MODE;
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.PERSONAL);
      expect(service.isPersonalMode()).toBe(true);
      expect(service.isOrganizationalMode()).toBe(false);
    });
    
    it('should detect personal mode when PLATFORM_MODE=personal', () => {
      process.env.PLATFORM_MODE = 'personal';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.PERSONAL);
      expect(service.isPersonalMode()).toBe(true);
      expect(service.isOrganizationalMode()).toBe(false);
    });
    
    it('should detect organizational mode when PLATFORM_MODE=organizational', () => {
      process.env.PLATFORM_MODE = 'organizational';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.ORGANIZATIONAL);
      expect(service.isPersonalMode()).toBe(false);
      expect(service.isOrganizationalMode()).toBe(true);
    });
    
    it('should handle case-insensitive mode detection', () => {
      process.env.PLATFORM_MODE = 'ORGANIZATIONAL';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.ORGANIZATIONAL);
    });
    
    it('should throw error for invalid platform mode', () => {
      process.env.PLATFORM_MODE = 'invalid_mode';
      
      expect(() => {
        PlatformConfigService.getInstance();
      }).toThrow(PlatformConfigError);
      
      try {
        PlatformConfigService.getInstance();
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformConfigError);
        expect((error as PlatformConfigError).code).toBe('INVALID_PLATFORM_MODE');
        expect((error as PlatformConfigError).context).toEqual({ providedMode: 'invalid_mode' });
      }
    });
    
    it('should default to personal mode for empty string', () => {
      process.env.PLATFORM_MODE = '';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.PERSONAL);
    });
  });
  
  describe('Feature Configuration', () => {
    describe('Personal Mode Features', () => {
      beforeEach(() => {
        process.env.PLATFORM_MODE = 'personal';
      });
      
      it('should disable organizational features in personal mode', () => {
        const service = PlatformConfigService.getInstance();
        
        expect(service.isFeatureEnabled('departments')).toBe(false);
        expect(service.isFeatureEnabled('hierarchies')).toBe(false);
        expect(service.isFeatureEnabled('reportingRelationships')).toBe(false);
      });
      
      it('should enable basic features in personal mode', () => {
        const service = PlatformConfigService.getInstance();
        
        expect(service.isFeatureEnabled('agentTemplates')).toBe(true);
        expect(service.isFeatureEnabled('agentSpawning')).toBe(true);
        expect(service.isFeatureEnabled('categorization')).toBe(true);
      });
    });
    
    describe('Organizational Mode Features', () => {
      beforeEach(() => {
        process.env.PLATFORM_MODE = 'organizational';
      });
      
      it('should enable all features in organizational mode', () => {
        const service = PlatformConfigService.getInstance();
        
        expect(service.isFeatureEnabled('departments')).toBe(true);
        expect(service.isFeatureEnabled('hierarchies')).toBe(true);
        expect(service.isFeatureEnabled('reportingRelationships')).toBe(true);
        expect(service.isFeatureEnabled('agentTemplates')).toBe(true);
        expect(service.isFeatureEnabled('agentSpawning')).toBe(true);
        expect(service.isFeatureEnabled('categorization')).toBe(true);
      });
    });
  });
  
  describe('Feature Requirement Validation', () => {
    it('should throw error when requiring unavailable feature in personal mode', () => {
      process.env.PLATFORM_MODE = 'personal';
      const service = PlatformConfigService.getInstance();
      
      expect(() => {
        service.requireFeature('departments');
      }).toThrow(PlatformConfigError);
      
      try {
        service.requireFeature('departments');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformConfigError);
        expect((error as PlatformConfigError).code).toBe('FEATURE_NOT_AVAILABLE');
        expect((error as PlatformConfigError).context).toEqual({
          feature: 'departments',
          mode: PlatformMode.PERSONAL
        });
      }
    });
    
    it('should not throw error when requiring available feature', () => {
      process.env.PLATFORM_MODE = 'organizational';
      const service = PlatformConfigService.getInstance();
      
      expect(() => {
        service.requireFeature('departments');
      }).not.toThrow();
    });
    
    it('should not throw error for common features in personal mode', () => {
      process.env.PLATFORM_MODE = 'personal';
      const service = PlatformConfigService.getInstance();
      
      expect(() => {
        service.requireFeature('agentTemplates');
      }).not.toThrow();
      
      expect(() => {
        service.requireFeature('categorization');
      }).not.toThrow();
    });
  });
  
  describe('Configuration Retrieval', () => {
    it('should return immutable configuration copy', () => {
      process.env.PLATFORM_MODE = 'organizational';
      process.env.ORGANIZATION_NAME = 'Test Corp';
      
      const service = PlatformConfigService.getInstance();
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object instances
    });
    
    it('should include organization name in organizational mode', () => {
      process.env.PLATFORM_MODE = 'organizational';
      process.env.ORGANIZATION_NAME = 'Test Corporation';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getOrganizationName()).toBe('Test Corporation');
    });
    
    it('should use default organization name if not provided', () => {
      process.env.PLATFORM_MODE = 'organizational';
      delete process.env.ORGANIZATION_NAME;
      
      const service = PlatformConfigService.getInstance();
      expect(service.getOrganizationName()).toBe('Organization');
    });
    
    it('should include personal user name in personal mode', () => {
      process.env.PLATFORM_MODE = 'personal';
      process.env.PERSONAL_USER_NAME = 'John Doe';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPersonalUserName()).toBe('John Doe');
    });
    
    it('should use default user name if not provided in personal mode', () => {
      process.env.PLATFORM_MODE = 'personal';
      delete process.env.PERSONAL_USER_NAME;
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPersonalUserName()).toBe('User');
    });
    
    it('should return null for organization name in personal mode', () => {
      process.env.PLATFORM_MODE = 'personal';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getOrganizationName()).toBeNull();
    });
    
    it('should return null for personal user name in organizational mode', () => {
      process.env.PLATFORM_MODE = 'organizational';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPersonalUserName()).toBeNull();
    });
  });
  
  describe('Configuration Validation', () => {
    it('should validate organizational mode configuration', () => {
      process.env.PLATFORM_MODE = 'organizational';
      
      // Should not throw error for valid organizational configuration
      expect(() => {
        PlatformConfigService.getInstance();
      }).not.toThrow();
    });
    
    it('should validate personal mode configuration', () => {
      process.env.PLATFORM_MODE = 'personal';
      
      // Should not throw error for valid personal configuration
      expect(() => {
        PlatformConfigService.getInstance();
      }).not.toThrow();
    });
  });
  
  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      process.env.PLATFORM_MODE = 'personal';
      
      const service1 = PlatformConfigService.getInstance();
      const service2 = PlatformConfigService.getInstance();
      
      expect(service1).toBe(service2);
    });
    
    it('should allow reconfiguration for testing', () => {
      process.env.PLATFORM_MODE = 'personal';
      const service = PlatformConfigService.getInstance();
      expect(service.isPersonalMode()).toBe(true);
      
      // Change environment and reconfigure
      process.env.PLATFORM_MODE = 'organizational';
      service.reconfigure();
      
      expect(service.isOrganizationalMode()).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should include proper error context for invalid mode', () => {
      process.env.PLATFORM_MODE = 'wrongmode';
      
      try {
        PlatformConfigService.getInstance();
        fail('Expected error was not thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformConfigError);
        expect((error as PlatformConfigError).name).toBe('PlatformConfigError');
        expect((error as PlatformConfigError).code).toBe('INVALID_PLATFORM_MODE');
        expect((error as PlatformConfigError).context).toEqual({ providedMode: 'wrongmode' });
      }
    });
    
    it('should handle configuration initialization errors gracefully', () => {
      // Mock process.env to cause an error during initialization
      const originalEnv = process.env;
      
      Object.defineProperty(process, 'env', {
        get: () => {
          throw new Error('Environment access error');
        },
        configurable: true
      });
      
      try {
        expect(() => {
          PlatformConfigService.getInstance();
        }).toThrow();
      } finally {
        // Restore original environment
        Object.defineProperty(process, 'env', {
          value: originalEnv,
          configurable: true
        });
      }
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle undefined environment variables', () => {
      delete process.env.PLATFORM_MODE;
      delete process.env.ORGANIZATION_NAME;
      delete process.env.PERSONAL_USER_NAME;
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.PERSONAL);
      expect(service.getPersonalUserName()).toBe('User');
    });
    
    it('should handle whitespace-only environment values', () => {
      process.env.PLATFORM_MODE = '  ';
      
      const service = PlatformConfigService.getInstance();
      expect(service.getPlatformMode()).toBe(PlatformMode.PERSONAL);
    });
  });
}); 