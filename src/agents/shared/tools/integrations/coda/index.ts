/**
 * Coda Integration Module
 * 
 * This module provides interfaces and implementations for Coda document management.
 * It exports a singleton instance for backward compatibility with existing code.
 */

// Export interfaces
export * from './CodaIntegration.interface';

// Export implementation
export { DefaultCodaIntegration } from './DefaultCodaIntegration';

// Import for singleton creation
import { DefaultCodaIntegration } from './DefaultCodaIntegration';

/**
 * Singleton instance of the DefaultCodaIntegration for compatibility with
 * existing code that expects a singleton export named codaIntegration
 */
export const codaIntegration = new DefaultCodaIntegration(); 