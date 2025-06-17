import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';

export interface StateData {
  tenantId: string;
  userId: string;
  platform: string;
  accountType?: string;
  codeVerifier?: string; // For PKCE support
  returnUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Production-ready OAuth state storage using Prisma
 * Replaces file-based storage with proper database persistence
 */
export class PrismaStateStorage {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Store OAuth state in database
   */
  async set(state: string, data: StateData): Promise<void> {
    try {
      // States expire after 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await this.prisma.oAuthState.create({
        data: {
          id: ulid(),
          state,
          tenantId: data.tenantId,
          userId: data.userId,
          platform: data.platform,
          accountType: data.accountType || 'personal',
          codeVerifier: data.codeVerifier,
          returnUrl: data.returnUrl,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          expiresAt
        }
      });

      console.log('OAuth state stored in database:', { state, platform: data.platform });
    } catch (error) {
      console.error('Failed to store OAuth state:', error);
      throw new Error('Failed to store OAuth state');
    }
  }

  /**
   * Retrieve OAuth state from database
   */
  async get(state: string): Promise<StateData | null> {
    try {
      const record = await this.prisma.oAuthState.findUnique({
        where: { state }
      });

      if (!record || new Date() > record.expiresAt) {
        if (record) await this.delete(state);
        return null;
      }

      const stateData: StateData = {
        tenantId: record.tenantId,
        userId: record.userId,
        platform: record.platform,
        accountType: record.accountType,
        codeVerifier: record.codeVerifier || undefined,
        returnUrl: record.returnUrl || undefined,
        metadata: record.metadata ? JSON.parse(record.metadata) : undefined
      };

      console.log('OAuth state retrieved from database:', { state, platform: record.platform });
      return stateData;
    } catch (error) {
      console.error('Failed to retrieve OAuth state:', error);
      return null;
    }
  }

  /**
   * Delete OAuth state from database
   */
  async delete(state: string): Promise<boolean> {
    try {
      const deleted = await this.prisma.oAuthState.delete({
        where: { state }
      });

      console.log('OAuth state deleted from database:', state);
      return true;
    } catch (error) {
      // State might not exist, which is fine
      console.log('OAuth state not found for deletion:', state);
      return false;
    }
  }

  /**
   * Get all active states (for debugging)
   */
  async entries(): Promise<Array<[string, StateData]>> {
    try {
      const records = await this.prisma.oAuthState.findMany({
        where: {
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return records.map(record => [
        record.state,
        {
          tenantId: record.tenantId,
          userId: record.userId,
          platform: record.platform,
          accountType: record.accountType,
          codeVerifier: record.codeVerifier || undefined,
          returnUrl: record.returnUrl || undefined,
          metadata: record.metadata ? JSON.parse(record.metadata) : undefined
        }
      ]);
    } catch (error) {
      console.error('Failed to get OAuth state entries:', error);
      return [];
    }
  }

  /**
   * Count active states
   */
  async size(): Promise<number> {
    try {
      return await this.prisma.oAuthState.count({
        where: {
          expiresAt: {
            gt: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Failed to count OAuth states:', error);
      return 0;
    }
  }

  /**
   * Clean up expired states
   */
  async cleanup(): Promise<number> {
    try {
      const result = await this.prisma.oAuthState.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} expired OAuth states`);
      }

      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired OAuth states:', error);
      return 0;
    }
  }

  /**
   * Disconnect Prisma client
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const prismaStateStorage = new PrismaStateStorage(); 