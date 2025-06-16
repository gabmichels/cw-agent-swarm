# Multi-Tenant Social Media Setup Guide

## 🏗️ **Scalable SaaS Architecture**

This guide shows you how to build a **multi-tenant social media system** where:
- ✅ **Each company connects their own accounts** (not yours)
- ✅ **Agents post using company tokens** (appears as the company)
- ✅ **Secure tenant isolation** (Company A can't access Company B's accounts)
- ✅ **Multiple accounts per company** (personal, company, product accounts)
- ✅ **Automatic token refresh** (handles expired tokens)

## 🎯 **What You Need to Do**

### **Step 1: Register ONE Twitter App (5 minutes)**

1. **Go to**: [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. **Create App**:
   - **Name**: "YourSaaS Social Media Integration"
   - **Description**: "Social media management platform for businesses"
   - **Website**: `https://yoursaas.com`
   - **Use case**: "Making a bot or automated system"
3. **OAuth 2.0 Settings**:
   - **Callback URL**: `http://localhost:3000/api/social-media/callback/twitter`
   - **Permissions**: Read and Write
4. **Copy**: Client ID and Client Secret

### **Step 2: Add to Environment**

```bash
# Your ONE Twitter app serves ALL customers
TWITTER_CLIENT_ID=your_twitter_app_client_id
TWITTER_CLIENT_SECRET=your_twitter_app_client_secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
SOCIAL_MEDIA_ENCRYPTION_KEY=your_32_character_encryption_key
```

### **Step 3: How It Works**

```
Your Customer (Company A):
1. Clicks "Connect Twitter" in your app
2. Gets redirected to Twitter OAuth (using YOUR app)
3. Authorizes YOUR app to post on their behalf
4. You store THEIR tokens securely
5. When agents post → Uses THEIR tokens → Appears as THEM

Your Customer (Company B):
1. Same process, different tokens
2. Company B can't see Company A's accounts
3. Agents post as Company B using Company B's tokens
```

## 🔄 **The Flow**

### **Customer Connects Account**

```typescript
// Customer clicks "Connect Twitter"
POST /api/social-media/connect
{
  "provider": "twitter",
  "tenantId": "company_a_id",
  "userId": "user_123",
  "accountType": "company"
}

// Response: OAuth URL
{
  "authUrl": "https://twitter.com/i/oauth2/authorize?client_id=YOUR_APP&..."
}

// Customer authorizes → Callback
GET /api/social-media/callback/twitter?code=abc123&state=xyz789

// You store their tokens encrypted in database
```

### **Agent Posts on Their Behalf**

```typescript
// Agent wants to post
const result = await socialMediaTool.post({
  tenantId: "company_a_id",
  agentId: "agent_456", 
  content: "Exciting product update!",
  platforms: ["twitter"]
});

// System:
// 1. Gets Company A's Twitter token
// 2. Posts using Company A's token
// 3. Post appears as @companyA, not your app
```

## 🗃️ **Database Schema**

```sql
-- Store each company's social media tokens
CREATE TABLE tenant_social_connections (
  id VARCHAR(26) PRIMARY KEY,
  tenant_id VARCHAR(26) NOT NULL,       -- Company A, Company B, etc.
  user_id VARCHAR(26) NOT NULL,         -- User who connected it
  platform VARCHAR(20) NOT NULL,       -- 'twitter', 'linkedin'
  account_username VARCHAR(100),        -- @companyA
  account_type VARCHAR(20),             -- 'personal', 'company', 'product'
  encrypted_access_token TEXT NOT NULL, -- Company's token (encrypted)
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Control which agents can use which accounts
CREATE TABLE agent_social_permissions (
  id VARCHAR(26) PRIMARY KEY,
  agent_id VARCHAR(26) NOT NULL,
  connection_id VARCHAR(26) NOT NULL,   -- Links to tenant_social_connections
  capabilities JSON NOT NULL,           -- ['POST_CREATE', 'ANALYTICS_READ']
  granted_by VARCHAR(26) NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

## 💻 **Frontend: Connection Modal**

```typescript
// In your settings page
function SocialMediaSettings() {
  const connectTwitter = async () => {
    const response = await fetch('/api/social-media/connect', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'twitter',
        tenantId: currentCompany.id,
        userId: currentUser.id,
        accountType: 'company'
      })
    });
    
    const { authUrl } = await response.json();
    window.location.href = authUrl; // Redirect to Twitter
  };

  return (
    <div>
      <h3>Connect Social Media</h3>
      <button onClick={connectTwitter}>
        Connect Company Twitter
      </button>
    </div>
  );
}
```

## 🤖 **Agent Integration**

```typescript
// Agent tool for posting
export class SocialMediaAgentTool {
  async post(params: {
    tenantId: string;
    agentId: string;
    content: string;
    platforms: string[];
  }) {
    const results = [];
    
    for (const platform of params.platforms) {
      // Get company's token for this platform
      const connection = await this.getConnection(params.tenantId, platform);
      
      if (!connection) {
        results.push({ platform, error: 'Not connected' });
        continue;
      }
      
      // Check agent has permission
      const hasPermission = await this.checkPermission(params.agentId, connection.id);
      if (!hasPermission) {
        results.push({ platform, error: 'No permission' });
        continue;
      }
      
      // Post using company's token
      const provider = this.getProvider(platform);
      const post = await provider.createPost(
        params.tenantId,
        connection.accountId,
        { content: params.content }
      );
      
      results.push({
        platform,
        success: true,
        url: post.url,
        account: connection.accountUsername
      });
    }
    
    return results;
  }
}
```

## 🎉 **The Result**

### **For Your Customers**

```
Company A Admin: "Connect our @companyA Twitter account"
→ OAuth flow → Account connected

Company A User: "Agent, post about our new feature"
→ Agent posts using @companyA token → Appears as @companyA

Company B Admin: "Connect our @companyB Twitter account"  
→ Different OAuth flow → Different account connected

Company B User: "Agent, post our announcement"
→ Agent posts using @companyB token → Appears as @companyB
```

### **Benefits**

- ✅ **Scalable**: One Twitter app serves unlimited customers
- ✅ **Secure**: Company A can't access Company B's accounts
- ✅ **Authentic**: Posts appear as the company, not your app
- ✅ **Flexible**: Multiple account types per company
- ✅ **Automated**: Token refresh, error handling

## 🚀 **Quick Start Checklist**

- [ ] **Create Twitter developer app** (5 minutes)
- [ ] **Add credentials to `.env`** (1 minute)
- [ ] **Set up database tables** (2 minutes)
- [ ] **Add connection modal to settings** (10 minutes)
- [ ] **Test OAuth flow** (5 minutes)
- [ ] **Integrate with agents** (15 minutes)

**Total setup time**: ~40 minutes for a scalable multi-tenant system!

This approach scales to thousands of companies, each with their own social media accounts, all posting authentically through your platform.
