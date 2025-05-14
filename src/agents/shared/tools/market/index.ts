/**
 * Market Scanner module - Singleton pattern for backward compatibility
 * 
 * This file exports the market scanner implementation as a singleton instance
 * to maintain backward compatibility with code that expects a global instance.
 */

import { DefaultMarketScanner } from './DefaultMarketScanner';
import { IMarketScanner, MarketScannerConfig } from './MarketScanner.interface';

// Create a singleton instance
const defaultScanner = new DefaultMarketScanner();

// Initialize the scanner when imported
(async () => {
  try {
    await defaultScanner.initialize();
  } catch (error) {
    console.error('Error initializing market scanner:', error);
  }
})();

// Export the singleton instance as the default export
export default defaultScanner;

// Also export a factory function for creating new instances
export const createMarketScanner = (config?: MarketScannerConfig): IMarketScanner => {
  return new DefaultMarketScanner(config);
};

// Export types and interfaces
export * from './MarketScanner.interface';
export { DefaultMarketScanner } from './DefaultMarketScanner';
export type { ISourceManager } from './interfaces/MarketSource.interface';
export type { ITrendAnalyzer } from './interfaces/TrendAnalysis.interface'; 