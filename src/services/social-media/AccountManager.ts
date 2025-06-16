import { ulid } from 'ulid';
import { 
  SocialMediaConnection, 
  SocialMediaProvider,
  SocialMediaConnectionStatus 
} from './database/ISocialMediaDatabase';

export interface AccountCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface ManagedAccount {
  id: string;
  connection: SocialMediaConnection;
  category: AccountCategory;
  purpose: string;
  isActive: boolean;
  lastUsed: Date;
  postingSchedule?: {
    timezone: string;
    preferredTimes: string[];
    maxPostsPerDay: number;
  };
}

export class AccountManager {
  private accounts = new Map<string, ManagedAccount>();
  private categories = new Map<string, AccountCategory>();

  constructor() {
    this.initializeDefaultCategories();
  }

  private initializeDefaultCategories() {
    const defaultCategories: AccountCategory[] = [
      {
        id: 'personal',
        name: 'Personal',
        description: 'Your personal social media accounts',
        color: '#3B82F6',
        icon: '👤'
      },
      {
        id: 'business',
        name: 'Business',
        description: 'Company and business accounts',
        color: '#10B981',
        icon: '🏢'
      },
      {
        id: 'product',
        name: 'Product',
        description: 'Specific product or service accounts',
        color: '#8B5CF6',
        icon: '📦'
      },
      {
        id: 'client',
        name: 'Client',
        description: 'Client or customer accounts you manage',
        color: '#F59E0B',
        icon: '🤝'
      }
    ];

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  // Account Management
  addAccount(
    connection: SocialMediaConnection, 
    categoryId: string, 
    purpose: string,
    postingSchedule?: ManagedAccount['postingSchedule']
  ): ManagedAccount {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const managedAccount: ManagedAccount = {
      id: ulid(),
      connection,
      category,
      purpose,
      isActive: true,
      lastUsed: new Date(),
      postingSchedule
    };

    this.accounts.set(managedAccount.id, managedAccount);
    return managedAccount;
  }

  getAccountsByCategory(categoryId: string): ManagedAccount[] {
    return Array.from(this.accounts.values())
      .filter(account => account.category.id === categoryId && account.isActive);
  }

  getAccountsByPlatform(platform: SocialMediaProvider): ManagedAccount[] {
    return Array.from(this.accounts.values())
      .filter(account => account.connection.provider === platform && account.isActive);
  }

  getAccountsForAgent(agentId: string): ManagedAccount[] {
    // This would integrate with the permission system
    // For now, return all active accounts
    return Array.from(this.accounts.values())
      .filter(account => account.isActive);
  }

  // Account Organization
  createCustomCategory(name: string, description: string, color: string, icon: string): AccountCategory {
    const category: AccountCategory = {
      id: ulid(),
      name,
      description,
      color,
      icon
    };

    this.categories.set(category.id, category);
    return category;
  }

  getCategories(): AccountCategory[] {
    return Array.from(this.categories.values());
  }

  // Account Usage Tracking
  recordAccountUsage(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (account) {
      account.lastUsed = new Date();
    }
  }

  // Smart Account Selection
  suggestAccountForContent(content: string, platform?: SocialMediaProvider): ManagedAccount[] {
    let candidates = Array.from(this.accounts.values())
      .filter(account => account.isActive);

    if (platform) {
      candidates = candidates.filter(account => account.connection.provider === platform);
    }

    // Simple content-based suggestions
    const contentLower = content.toLowerCase();
    
    // Business content indicators
    if (contentLower.includes('company') || contentLower.includes('business') || 
        contentLower.includes('product') || contentLower.includes('service')) {
      return candidates.filter(account => 
        account.category.id === 'business' || account.category.id === 'product'
      );
    }

    // Personal content indicators
    if (contentLower.includes('personal') || contentLower.includes('my ') || 
        contentLower.includes('i ') || contentLower.includes('me ')) {
      return candidates.filter(account => account.category.id === 'personal');
    }

    // Return all candidates if no clear match
    return candidates;
  }

  // Account Health Monitoring
  getAccountHealth(): {
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byPlatform: Record<string, number>;
    recentlyUsed: number;
  } {
    const accounts = Array.from(this.accounts.values());
    const active = accounts.filter(a => a.isActive);
    const recentlyUsed = accounts.filter(a => 
      a.lastUsed > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const byCategory: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    active.forEach(account => {
      byCategory[account.category.name] = (byCategory[account.category.name] || 0) + 1;
      byPlatform[account.connection.provider] = (byPlatform[account.connection.provider] || 0) + 1;
    });

    return {
      total: accounts.length,
      active: active.length,
      byCategory,
      byPlatform,
      recentlyUsed: recentlyUsed.length
    };
  }

  // Example Account Configurations
  static getExampleConfigurations(): Array<{
    name: string;
    accounts: Array<{
      platform: SocialMediaProvider;
      username: string;
      category: string;
      purpose: string;
    }>;
  }> {
    return [
      {
        name: "Personal Creator Setup",
        accounts: [
          {
            platform: SocialMediaProvider.TWITTER,
            username: "@yourname",
            category: "personal",
            purpose: "Personal thoughts and updates"
          },
          {
            platform: SocialMediaProvider.LINKEDIN,
            username: "Your Name",
            category: "personal",
            purpose: "Professional networking and career updates"
          }
        ]
      },
      {
        name: "Business Owner Setup",
        accounts: [
          {
            platform: SocialMediaProvider.TWITTER,
            username: "@yourname",
            category: "personal",
            purpose: "Personal brand and thought leadership"
          },
          {
            platform: SocialMediaProvider.TWITTER,
            username: "@yourcompany",
            category: "business",
            purpose: "Company announcements and marketing"
          },
          {
            platform: SocialMediaProvider.LINKEDIN,
            username: "Your Company",
            category: "business",
            purpose: "B2B marketing and recruitment"
          }
        ]
      },
      {
        name: "Product Manager Setup",
        accounts: [
          {
            platform: SocialMediaProvider.TWITTER,
            username: "@yourproduct",
            category: "product",
            purpose: "Product updates and user engagement"
          },
          {
            platform: SocialMediaProvider.REDDIT,
            username: "u/yourproduct",
            category: "product",
            purpose: "Community engagement and support"
          }
        ]
      }
    ];
  }
} 