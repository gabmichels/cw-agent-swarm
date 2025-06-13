import { IDatabaseProvider } from './IDatabaseProvider';
import { PrismaDatabaseProvider } from './PrismaDatabaseProvider';

/**
 * Database service factory for managing database providers
 */
export class DatabaseService {
  private static instance: IDatabaseProvider | null = null;

  /**
   * Get the current database provider instance
   */
  static getInstance(): IDatabaseProvider {
    if (!this.instance) {
      // For now, we default to Prisma, but this can be configured
      this.instance = new PrismaDatabaseProvider();
    }
    return this.instance;
  }

  /**
   * Initialize the database connection
   */
  static async initialize(): Promise<void> {
    const provider = this.getInstance();
    await provider.initialize();
  }

  /**
   * Close the database connection
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }

  /**
   * Set a custom database provider (useful for testing)
   */
  static setProvider(provider: IDatabaseProvider): void {
    this.instance = provider;
  }
} 