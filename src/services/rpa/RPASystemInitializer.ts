import { Logger } from './types/RPATypes';
import { RPAServiceRegistry, getRPARegistry } from './core/RPAServiceRegistry';
import { SocialMediaRPAService, createSocialMediaRPAConfig } from './domains/social-media/SocialMediaRPAService';

/**
 * Initialize the RPA system with all domain services
 * @param logger - Logger instance for the system
 * @returns The initialized RPA registry
 */
export async function initializeRPASystem(logger: Logger): Promise<RPAServiceRegistry> {
  logger.info('Initializing RPA system');

  try {
    // Get or create the global registry
    const registry = getRPARegistry(logger);

    // Initialize social media domain service
    const socialMediaConfig = createSocialMediaRPAConfig();
    const socialMediaService = new SocialMediaRPAService(socialMediaConfig, logger);

    // Register the social media service
    registry.register('social-media', socialMediaService);

    logger.info('RPA system initialized successfully', {
      domains: registry.getRegisteredDomains(),
      totalWorkflows: registry.getStats().totalWorkflows
    });

    return registry;

  } catch (error) {
    logger.error('Failed to initialize RPA system', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Shutdown the RPA system and cleanup resources
 * @param logger - Logger instance
 */
export async function shutdownRPASystem(logger: Logger): Promise<void> {
  logger.info('Shutting down RPA system');

  try {
    const registry = getRPARegistry();
    await registry.cleanup();
    
    logger.info('RPA system shutdown completed');
  } catch (error) {
    logger.error('Error during RPA system shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 