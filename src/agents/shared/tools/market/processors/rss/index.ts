/**
 * RSS processor module - Exports for DefaultRssProcessor
 */

import { IRssProcessor } from '../../interfaces/SourceProcessor.interface';
import { DefaultRssProcessor } from './DefaultRssProcessor';

// Export the DefaultRssProcessor class
export { DefaultRssProcessor } from './DefaultRssProcessor';
export type { IRssProcessor } from '../../interfaces/SourceProcessor.interface';

// Factory function to create a new RSS processor
export function createRssProcessor(): IRssProcessor {
  return new DefaultRssProcessor();
}

// Create a singleton instance for convenience
const defaultRssProcessor = new DefaultRssProcessor();
export default defaultRssProcessor; 