# Personal Social Media Setup Guide

## 🎯 **Your Use Case: Personal Account Management**

This guide is specifically for users who want to:
- ✅ **Post as themselves** (not as an app)
- ✅ **Manage multiple accounts** (personal, business, product)
- ✅ **Let agents post on their behalf**
- ✅ **Minimal setup complexity**

## 🚀 **Quick Start (5 Minutes)**

### **Option A: Zapier Integration (Easiest - No OAuth Apps Needed)**

**Perfect if you want to avoid creating Twitter/LinkedIn apps entirely.**

1. **Create Zapier Account** (free tier works)
2. **Set up Zaps for each account**:
   - **Trigger**: Webhook (Zapier will give you a URL)
   - **Action**: Post to Twitter/LinkedIn/etc.
3. **Add webhook URLs to your `.env`**:

```bash
# Zapier Webhooks (No OAuth apps needed!)
ZAPIER_PERSONAL_TWITTER_WEBHOOK=https://hooks.zapier.com/hooks/catch/12345/abcdef/
ZAPIER_COMPANY_TWITTER_WEBHOOK=https://hooks.zapier.com/hooks/catch/12345/ghijkl/
ZAPIER_PERSONAL_LINKEDIN_WEBHOOK=https://hooks.zapier.com/hooks/catch/12345/mnopqr/

# Basic config
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_MASTER_KEY=your_64_character_hex_key_here
```

**That's it!** Your agents can now post through Zapier to your accounts.

### **Option B: Personal OAuth Apps (More Features)**

**Better if you want analytics, reading posts, etc.**

## 📱 **Platform Setup Instructions**

### **1. Twitter/X Setup (Personal App)**

**Time**: 2 minutes | **Review**: Not required for personal use

1. **Go to**: [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. **Create App**:
   - **Name**: "My Personal Assistant" 
   - **Description**: "Personal automation for my social media"
   - **Website**: `http://localhost:3000`
   - **Use case**: Personal use
3. **OAuth 2.0 Settings**:
   - **Type**: Web App
   - **Callback URL**: `http://localhost:3000/api/social-media/callback?provider=twitter`
   - **Website URL**: `http://localhost:3000`
4. **Permissions**: Read and Write
5. **Copy**: Client ID and Client Secret

### **2. LinkedIn Setup (Personal App)**

**Time**: 3 minutes | **Review**: Usually instant approval

1. **Go to**: [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. **Create App**:
   - **Name**: "Personal Social Assistant"
   - **LinkedIn Page**: Your personal company page (create if needed)
   - **Description**: "Personal automation tool"
   - **Logo**: Any image (required)
3. **Add Products**:
   - ✅ "Share on LinkedIn" 
   - ✅ "Sign In with LinkedIn"
4. **OAuth Settings**:
   - **Redirect URL**: `http://localhost:3000/api/social-media/callback?provider=linkedin`
5. **Copy**: Client ID and Client Secret

### **3. Environment Configuration**

Create/update your `.env` file:

```bash
# Twitter Personal App
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# LinkedIn Personal App  
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_MASTER_KEY=generate_64_char_hex_key_with_crypto

# Optional: Additional platforms
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

## 🏢 **Multi-Account Management**

### **Your Account Structure**

Here's how to organize your accounts:

```typescript
// Example account setup
const yourAccounts = [
  // Personal Accounts
  {
    platform: 'twitter',
    username: '@yourname',
    category: 'Personal',
    purpose: 'Personal thoughts, life updates',
    agents: ['personal_assistant', 'content_curator']
  },
  {
    platform: 'linkedin', 
    username: 'Your Name',
    category: 'Personal',
    purpose: 'Professional networking, career',
    agents: ['career_agent', 'networking_agent']
  },
  
  // Business Accounts
  {
    platform: 'twitter',
    username: '@yourcompany',
    category: 'Business', 
    purpose: 'Company updates, marketing',
    agents: ['marketing_agent', 'customer_service_agent']
  },
  {
    platform: 'linkedin',
    username: 'Your Company',
    category: 'Business',
    purpose: 'B2B marketing, recruitment', 
    agents: ['hr_agent', 'sales_agent']
  },
  
  // Product Accounts
  {
    platform: 'twitter',
    username: '@yourproduct',
    category: 'Product',
    purpose: 'Product updates, user engagement',
    agents: ['product_agent', 'support_agent']
  }
];
```

### **Account Categories**

The system automatically organizes accounts into:

- 👤 **Personal**: Your individual accounts
- 🏢 **Business**: Company/organization accounts  
- 📦 **Product**: Specific product accounts
- 🤝 **Client**: Accounts you manage for others

## 🤖 **Agent Configuration**

### **Setting Up Agent Permissions**

When creating/editing agents, you can specify which accounts they can access:

```typescript
// Example agent configurations
const agentConfigs = {
  personal_assistant: {
    name: "Personal Assistant",
    accounts: ["@yourname (Twitter)", "Your Name (LinkedIn)"],
    capabilities: ["POST_CREATE", "POST_SCHEDULE", "ANALYTICS_READ"],
    restrictions: {
      maxPostsPerDay: 3,
      requiresApproval: false,
      businessHoursOnly: false
    }
  },
  
  marketing_agent: {
    name: "Marketing Agent", 
    accounts: ["@yourcompany (Twitter)", "Your Company (LinkedIn)"],
    capabilities: ["POST_CREATE", "POST_SCHEDULE", "ANALYTICS_READ", "COMMENT_CREATE"],
    restrictions: {
      maxPostsPerDay: 10,
      requiresApproval: true,
      businessHoursOnly: true
    }
  },
  
  product_agent: {
    name: "Product Agent",
    accounts: ["@yourproduct (Twitter)", "@yourproduct (Reddit)"],
    capabilities: ["POST_CREATE", "COMMENT_CREATE", "DM_SEND"],
    restrictions: {
      maxPostsPerDay: 5,
      requiresApproval: false,
      contentFilters: ["no_pricing", "no_competitors"]
    }
  }
};
```

## 💬 **Natural Language Usage**

Once set up, you can interact naturally:

### **Personal Posting**
```
You: "I just had a great insight about AI development. Share this on my personal Twitter."

Agent: "I'll post this to your personal Twitter (@yourname). Here's what I'll share:

'Just had a breakthrough insight about AI development: The key isn't just making models smarter, but making them more collaborative with human creativity. The future is human-AI partnership, not replacement. #AI #Innovation'

Should I post this now?"
```

### **Business Posting**
```
You: "We just launched our new feature. Announce this on our company social media."

Agent: "I'll create announcements for your business accounts:

🐦 Twitter (@yourcompany): 
'🚀 Exciting news! We just launched our new AI-powered analytics feature. Get deeper insights into your data with zero setup required. Try it now: [link] #ProductLaunch #Analytics'

💼 LinkedIn (Your Company):
'We're thrilled to announce the launch of our new AI-powered analytics feature. This tool represents months of development focused on making data insights accessible to everyone, regardless of technical background...'

Post to both accounts?"
```

### **Smart Account Selection**
```
You: "Post about our company culture and hiring."

Agent: "This sounds like business content. I'll suggest posting to:
- Your Company LinkedIn (best for hiring content)
- @yourcompany Twitter (for broader reach)

Would you like me to create tailored posts for each platform?"
```

## 🔒 **Security & Privacy**

### **What Gets Stored**
- ✅ **Encrypted OAuth tokens** (AES-256)
- ✅ **Account metadata** (usernames, platform info)
- ✅ **Permission settings** per agent
- ❌ **No passwords** (OAuth only)
- ❌ **No personal data** beyond what you authorize

### **Access Control**
- **Agent-level permissions**: Each agent only accesses authorized accounts
- **Capability restrictions**: Limit what agents can do (post, read, comment, etc.)
- **Time-based limits**: Set posting quotas and schedules
- **Approval workflows**: Require approval for sensitive accounts

### **Data Protection**
- **Local encryption**: All credentials encrypted locally
- **No third-party storage**: Your tokens stay in your database
- **Revocable access**: Disconnect accounts anytime
- **Audit logging**: Track all agent actions

## 🚀 **Getting Started Checklist**

### **Phase 1: Basic Setup (10 minutes)**
- [ ] Choose approach (Zapier or OAuth apps)
- [ ] Set up Twitter account connection
- [ ] Configure `.env` file
- [ ] Test connection in Settings modal

### **Phase 2: Multi-Account (15 minutes)**  
- [ ] Add LinkedIn account
- [ ] Organize accounts by category
- [ ] Set up account purposes and descriptions
- [ ] Test posting to different accounts

### **Phase 3: Agent Integration (10 minutes)**
- [ ] Create/edit agents with social media permissions
- [ ] Test natural language posting
- [ ] Configure posting restrictions and approvals
- [ ] Set up content filters if needed

### **Phase 4: Advanced Features (Optional)**
- [ ] Set up scheduling preferences
- [ ] Configure analytics tracking
- [ ] Add more platforms (Facebook, Instagram, Reddit)
- [ ] Create custom account categories

## 🆘 **Troubleshooting**

### **Common Issues**

**"OAuth callback failed"**
- ✅ Check callback URL matches exactly: `http://localhost:3000/api/social-media/callback?provider=twitter`
- ✅ Verify app is set to "Web App" type
- ✅ Ensure app has correct permissions

**"Client ID is invalid"**
- ✅ Double-check `.env` file has correct credentials
- ✅ Restart your development server after changing `.env`
- ✅ Verify no extra spaces in environment variables

**"Agent can't post to account"**
- ✅ Check agent has permission for that specific account
- ✅ Verify account connection is still active
- ✅ Test account connection in Settings modal

**"Posts not appearing"**
- ✅ Check platform-specific posting limits
- ✅ Verify content meets platform guidelines
- ✅ Look for error messages in agent responses

### **Getting Help**

1. **Check the logs**: Look for error messages in your console
2. **Test connections**: Use the Settings modal to verify account health
3. **Verify permissions**: Ensure agents have the right capabilities
4. **Platform status**: Check if Twitter/LinkedIn are having issues

## 🎉 **You're Ready!**

Once set up, you can:
- **Talk naturally** to your agents about posting
- **Manage multiple accounts** seamlessly  
- **Post as yourself** across platforms
- **Control access** with granular permissions
- **Track performance** with built-in analytics

Your agents will feel like natural extensions of your social media presence, not robotic app postings! 