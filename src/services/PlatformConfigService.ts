/**
 * Platform Configuration Service
 * 
 * Handles platform mode configuration and validation according to IMPLEMENTATION_GUIDELINES.md
 * Supports personal and organizational platform modes with proper error handling.
 */

/**
 * Platform mode enum - strict typing as per guidelines
 */
export enum PlatformMode {
  PERSONAL = 'personal',
  ORGANIZATIONAL = 'organizational'
}

/**
 * Configuration interface for platform settings
 */
export interface PlatformConfig {
  mode: PlatformMode;
  organizationName?: string; // Only for organizational mode
  personalUserName?: string; // Only for personal mode
  features: PlatformFeatures;
}

/**
 * Feature availability interface
 */
export interface PlatformFeatures {
  departments: boolean;
  hierarchies: boolean;
  reportingRelationships: boolean;
  agentTemplates: boolean;
  agentSpawning: boolean;
  categorization: boolean;
}

/**
 * Platform configuration error class
 */
export class PlatformConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlatformConfigError';
  }
}

/**
 * Platform Configuration Service
 * 
 * Follows dependency injection pattern as per implementation guidelines.
 * Provides mode detection, validation, and feature availability checking.
 */
export class PlatformConfigService {
  private static instance: PlatformConfigService | null = null;
  private config: PlatformConfig | null = null;
  
  private constructor() {
    // Private constructor for singleton pattern
    this.initializeConfig();
  }
  
  /**
   * Get singleton instance of the service
   */
  public static getInstance(): PlatformConfigService {
    if (!PlatformConfigService.instance) {
      PlatformConfigService.instance = new PlatformConfigService();
    }
    return PlatformConfigService.instance;
  }
  
  /**
   * Initialize configuration from environment variables
   * Throws PlatformConfigError if configuration is invalid
   */
  private initializeConfig(): void {
    const platformMode = this.detectPlatformMode();
    const features = this.generateFeatureSet(platformMode);
    
    this.config = {
      mode: platformMode,
      features,
      ...(platformMode === PlatformMode.ORGANIZATIONAL && {
        organizationName: process.env.ORGANIZATION_NAME || 'Organization'
      }),
      ...(platformMode === PlatformMode.PERSONAL && {
        personalUserName: process.env.PERSONAL_USER_NAME || 'User'
      })
    };
    
    this.validateConfig(this.config);
  }
  
  /**
   * Detect platform mode from environment variable
   * Defaults to personal mode if not specified
   */
  private detectPlatformMode(): PlatformMode {
    const envMode = process.env.PLATFORM_MODE?.toLowerCase();
    
    switch (envMode) {
      case 'organizational':
        return PlatformMode.ORGANIZATIONAL;
      case 'personal':
        return PlatformMode.PERSONAL;
      case undefined:
      case '':
        // Default to personal mode
        return PlatformMode.PERSONAL;
      default:
        throw new PlatformConfigError(
          `Invalid PLATFORM_MODE: ${envMode}. Must be 'personal' or 'organizational'`,
          'INVALID_PLATFORM_MODE',
          { providedMode: envMode }
        );
    }
  }
  
  /**
   * Generate feature set based on platform mode
   */
  private generateFeatureSet(mode: PlatformMode): PlatformFeatures {
    if (mode === PlatformMode.PERSONAL) {
      return {
        departments: false,
        hierarchies: false,
        reportingRelationships: false,
        agentTemplates: true,
        agentSpawning: true,
        categorization: true
      };
    } else {
      return {
        departments: true,
        hierarchies: true,
        reportingRelationships: true,
        agentTemplates: true,
        agentSpawning: true,
        categorization: true
      };
    }
  }
  
  /**
   * Validate configuration consistency
   */
  private validateConfig(config: PlatformConfig): void {
    if (config.mode === PlatformMode.ORGANIZATIONAL) {
      if (!config.features.departments || !config.features.hierarchies) {
        throw new PlatformConfigError(
          'Organizational mode must support departments and hierarchies',
          'INVALID_ORGANIZATIONAL_CONFIG',
          { config }
        );
      }
    }
    
    if (config.mode === PlatformMode.PERSONAL) {
      if (config.features.departments || config.features.hierarchies || config.features.reportingRelationships) {
        throw new PlatformConfigError(
          'Personal mode must not support organizational features',
          'INVALID_PERSONAL_CONFIG',
          { config }
        );
      }
    }
  }
  
  /**
   * Get current platform configuration
   */
  public getConfig(): PlatformConfig {
    if (!this.config) {
      throw new PlatformConfigError(
        'Platform configuration not initialized',
        'CONFIG_NOT_INITIALIZED'
      );
    }
    return { ...this.config }; // Return a copy for immutability
  }
  
  /**
   * Get current platform mode
   */
  public getPlatformMode(): PlatformMode {
    return this.getConfig().mode;
  }
  
  /**
   * Check if a specific feature is enabled
   */
  public isFeatureEnabled(feature: keyof PlatformFeatures): boolean {
    return this.getConfig().features[feature];
  }
  
  /**
   * Check if platform is in personal mode
   */
  public isPersonalMode(): boolean {
    return this.getPlatformMode() === PlatformMode.PERSONAL;
  }
  
  /**
   * Check if platform is in organizational mode
   */
  public isOrganizationalMode(): boolean {
    return this.getPlatformMode() === PlatformMode.ORGANIZATIONAL;
  }
  
  /**
   * Validate that a feature is available in current mode
   * Throws error if feature is not available
   */
  public requireFeature(feature: keyof PlatformFeatures): void {
    if (!this.isFeatureEnabled(feature)) {
      throw new PlatformConfigError(
        `Feature '${feature}' is not available in ${this.getPlatformMode()} mode`,
        'FEATURE_NOT_AVAILABLE',
        { feature, mode: this.getPlatformMode() }
      );
    }
  }
  
  /**
   * Get organization name (only in organizational mode)
   */
  public getOrganizationName(): string | null {
    const config = this.getConfig();
    return config.organizationName || null;
  }
  
  /**
   * Get personal user name (only in personal mode)
   */
  public getPersonalUserName(): string | null {
    const config = this.getConfig();
    return config.personalUserName || null;
  }
  
  /**
   * Force reconfiguration (for testing purposes)
   * Should not be used in production
   */
  public reconfigure(): void {
    this.config = null;
    this.initializeConfig();
  }
}

/**
 * Convenience function to get platform config service instance
 */
export function getPlatformConfig(): PlatformConfigService {
  return PlatformConfigService.getInstance();
} 