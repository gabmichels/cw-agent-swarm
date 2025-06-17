// Core RPA Framework exports
export * from './types/RPATypes';
export * from './core/RPADomainService';
export * from './core/RPAServiceRegistry';
export * from './core/RPAWorkflowManager';

// Infrastructure exports
export * from './infrastructure/BrowserPool';

// Social Media Domain exports
export * from './domains/social-media/SocialMediaRPAService';
export * from './domains/social-media/workflows/TwitterCreatePostWorkflow';

// Convenience function to initialize the RPA system
export { initializeRPASystem } from './RPASystemInitializer'; 