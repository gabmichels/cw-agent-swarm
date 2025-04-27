import { KnowledgeBootstrapper } from '../../../lib/knowledge/KnowledgeBootstrapper';
import { KnowledgeBootstrapSource } from '../../../lib/knowledge/types';
import { MarketingKnowledgeGraph } from './MarketingKnowledgeGraph';

/**
 * Marketing-specific knowledge bootstrapper
 */
export class MarketingKnowledgeBootstrapper extends KnowledgeBootstrapper {
  constructor(knowledgeGraph: MarketingKnowledgeGraph) {
    super(knowledgeGraph);
  }

  /**
   * Get marketing-specific default knowledge sources
   */
  protected getDefaultSources(): KnowledgeBootstrapSource[] {
    return [
      {
        id: 'source-marketing-basics',
        name: 'Core Marketing Concepts',
        type: 'definition',
        category: 'marketing-fundamentals',
        content: `
Marketing is the activity, set of institutions, and processes for creating, communicating, delivering, and exchanging offerings that have value for customers, clients, partners, and society at large.

The marketing mix (4Ps) consists of:
1. Product: A good or service offered to consumers to satisfy a want or need
2. Price: The amount of money charged for a product or service
3. Place: Activities that make the product available to target consumers
4. Promotion: Activities that communicate the product's merits to target consumers

Key marketing activities include:
- Market Research: Gathering information about target markets, customers, and competitors
- Target Marketing: Identifying specific segments of a market that a business aims to serve
- Product Development: Creating products that meet customer needs
- Branding: Establishing a unique identity for a product or company
- Pricing Strategy: Determining the most appropriate price points
- Distribution Strategy: Getting products to customers efficiently
- Promotion Strategy: Communicating value to target customers
- Digital Marketing: Using online channels to reach and engage customers
- Marketing Analytics: Measuring marketing performance and ROI
        `
      },
      {
        id: 'source-segmentation-targeting-positioning',
        name: 'STP Framework: Segmentation, Targeting, and Positioning',
        type: 'framework',
        category: 'marketing-strategy',
        content: `
The STP framework consists of three steps:

1. Segmentation: Dividing the market into distinct groups of buyers with different needs, characteristics, or behaviors
   - Geographic segmentation: Based on location (countries, regions, cities)
   - Demographic segmentation: Based on variables such as age, gender, income, education, occupation
   - Psychographic segmentation: Based on lifestyle, personality, values, attitudes
   - Behavioral segmentation: Based on knowledge, attitude, use, or response to a product

2. Targeting: Evaluating each segment's attractiveness and selecting one or more segments to enter
   - Criteria for segment evaluation:
     - Segment size and growth potential
     - Segment structural attractiveness (competition, substitutes, buyer/supplier power)
     - Company objectives and resources

3. Positioning: Creating a distinctive place for the product in the minds of target customers
   - Positioning strategies include:
     - Attribute positioning: Based on product features
     - Benefit positioning: Based on benefits delivered
     - Use/application positioning: Based on how the product is used
     - User positioning: Based on the type of user
     - Competitor positioning: Based on comparison with competitors
     - Category positioning: Based on product category
     - Quality/price positioning: Based on quality or price

Effective STP enables companies to deliver more precise marketing messages that resonate with specific customer groups rather than broadcasting generic messages to everyone.
        `
      },
      {
        id: 'source-aida-model',
        name: 'AIDA Model: Attention, Interest, Desire, Action',
        type: 'framework',
        category: 'marketing-communications',
        content: `
The AIDA model describes the cognitive stages a consumer goes through during the buying process:

1. Attention: Capturing the awareness of the consumer
   - Use bold headlines, striking images, contrasting colors, or unusual formats
   - Create intrigue or curiosity
   - Leverage influencers or authoritative voices
   - Use interruption techniques in appropriate contexts

2. Interest: Engaging the consumer by showing relevance and benefits
   - Present key benefits that address consumer needs or pain points
   - Use storytelling to create emotional connection
   - Provide intriguing information or statistics
   - Ask questions that engage the consumer

3. Desire: Creating conviction and preference for your product
   - Demonstrate how the product solves a problem
   - Present social proof through testimonials or reviews
   - Show the product in action (demonstrations)
   - Create urgency or exclusivity
   - Address potential objections

4. Action: Motivating the consumer to take the next step
   - Include clear, compelling calls to action
   - Make the action process simple and frictionless
   - Offer incentives to act now (limited time offers, bonuses)
   - Reduce risk (guarantees, trials, return policies)

The AIDA model provides a framework for crafting marketing communications across different channels, from advertisements to sales presentations, emails, and landing pages. Each stage of content should be designed to move the consumer to the next stage.
        `
      },
      {
        id: 'source-customer-journey',
        name: 'Customer Journey Framework',
        type: 'framework',
        category: 'customer-experience',
        content: `
The Customer Journey framework maps the complete experience a customer has with a brand, from initial awareness through the purchase process and beyond. The typical stages include:

1. Awareness: Customer becomes aware of a need or problem, and discovers your brand
   - Key touchpoints: Advertising, social media, content marketing, word of mouth
   - Metrics: Brand awareness, share of voice, website traffic, social reach

2. Consideration: Customer evaluates your product/service against alternatives
   - Key touchpoints: Website, reviews, comparison content, downloadable resources
   - Metrics: Engagement rate, time on site, download rate, email open rates

3. Purchase: Customer decides to buy and completes transaction
   - Key touchpoints: E-commerce platform, sales team, retail environment, checkout process
   - Metrics: Conversion rate, average order value, cart abandonment, cost per acquisition

4. Retention: Customer uses the product and receives support
   - Key touchpoints: Product experience, onboarding, customer service, billing
   - Metrics: Customer satisfaction, support ticket resolution time, retention rate

5. Advocacy: Customer becomes loyal and refers others
   - Key touchpoints: Loyalty programs, social media, review platforms, referral incentives
   - Metrics: Net Promoter Score, testimonials, referrals, repeat purchase rate

For each stage, companies should:
- Map all relevant touchpoints
- Identify customer goals and pain points
- Design content and experiences to address needs at each stage
- Measure performance with relevant metrics
- Identify and fix gaps or friction points

The Customer Journey approach helps organizations shift from a channel-centric to a customer-centric view, enabling more holistic and effective customer experiences.
        `
      },
      {
        id: 'source-digital-marketing-channels',
        name: 'Digital Marketing Channels Overview',
        type: 'textbook',
        category: 'digital-marketing',
        author: 'Digital Marketing Institute',
        year: 2023,
        content: `
Digital marketing channels are the platforms and methods used to reach and engage with target audiences online. Each channel has unique characteristics, benefits, and best practices:

1. Search Engine Optimization (SEO)
   - Purpose: Improve organic visibility in search results
   - Key tactics: Keyword research, on-page optimization, technical SEO, content creation, link building
   - Metrics: Organic traffic, rankings, click-through rate, conversions

2. Pay-Per-Click Advertising (PPC)
   - Purpose: Generate immediate traffic through paid search results
   - Key platforms: Google Ads, Bing Ads
   - Key tactics: Keyword research, ad copywriting, landing page optimization, bid management
   - Metrics: Click-through rate, cost-per-click, conversion rate, return on ad spend

3. Social Media Marketing
   - Purpose: Build brand awareness, engage with customers, drive traffic
   - Key platforms: Facebook, Instagram, Twitter, LinkedIn, TikTok, Pinterest
   - Key tactics: Content creation, community management, paid social advertising
   - Metrics: Reach, engagement, followers, conversions

4. Content Marketing
   - Purpose: Attract and retain customers through valuable content
   - Key formats: Blog posts, videos, podcasts, infographics, whitepapers, case studies
   - Key tactics: Content strategy, editorial calendar, distribution, repurposing
   - Metrics: Page views, time on page, shares, leads generated

5. Email Marketing
   - Purpose: Nurture leads and maintain customer relationships
   - Key tactics: List building, segmentation, personalization, automation
   - Metrics: Open rate, click-through rate, conversion rate, unsubscribe rate

6. Affiliate Marketing
   - Purpose: Generate sales through third-party promoters
   - Key tactics: Partner recruitment, commission structure, tracking
   - Metrics: Clicks, conversions, return on investment

7. Influencer Marketing
   - Purpose: Leverage trusted personalities to promote products
   - Key tactics: Influencer selection, campaign briefing, content guidelines
   - Metrics: Reach, engagement, sentiment, conversions

8. Mobile Marketing
   - Purpose: Reach consumers on mobile devices
   - Key tactics: Mobile-optimized websites, apps, SMS marketing, location-based marketing
   - Metrics: App downloads, mobile traffic, mobile conversion rate

9. Video Marketing
   - Purpose: Engage audiences with dynamic visual content
   - Key platforms: YouTube, TikTok, Instagram Reels
   - Key tactics: Video strategy, production, optimization
   - Metrics: Views, watch time, engagement, conversions

Effective digital marketing typically involves an integrated approach using multiple channels based on target audience behavior, business objectives, and available resources. The channels should work together cohesively within a broader marketing strategy.
        `
      },
      {
        id: 'source-brand-equity',
        name: 'Brand Equity Framework',
        type: 'framework',
        category: 'branding',
        content: `
Brand equity refers to the value premium that a company generates from a product with a recognizable name compared to a generic equivalent. Companies can create brand equity through:

1. Brand Awareness: The extent to which consumers recognize and recall a brand
   - Strategies:
     - Consistent and distinctive visual identity
     - Memorable advertising campaigns
     - Strategic partnerships and sponsorships
     - Optimized digital presence
   - Measurement: Aided and unaided recall, brand recognition tests

2. Brand Associations: The attributes and benefits that consumers connect with the brand
   - Strategies:
     - Clear brand positioning
     - Consistent messaging across touchpoints
     - Storytelling that reinforces key associations
     - Experience design that delivers on brand promises
   - Measurement: Association mapping, perceptual mapping

3. Perceived Quality: Consumer judgment about a product's overall excellence
   - Strategies:
     - Quality control processes
     - Highlighting expertise and craftsmanship
     - Customer testimonials and social proof
     - Appropriate pricing signals
   - Measurement: Quality ratings, customer satisfaction scores

4. Brand Loyalty: Consumer commitment to repurchase or continue using the brand
   - Strategies:
     - Loyalty programs and rewards
     - Personalized customer experiences
     - Community building
     - Consistent product experiences
   - Measurement: Retention rates, Net Promoter Score, repeat purchase rates

5. Brand Assets: Proprietary elements like logos, packaging, and slogans
   - Strategies:
     - Trademark protection
     - Consistent application of visual identity
     - Distinctive and memorable design elements
     - Brand guidelines and governance
   - Measurement: Recognition of brand assets, distinctiveness ratings

Strong brand equity allows companies to charge premium prices, maintain market share despite competitors, launch new products more easily, and weather market disruptions or negative publicity more effectively.
        `
      },
      {
        id: 'source-marketing-analytics',
        name: 'Marketing Analytics Fundamentals',
        type: 'textbook',
        category: 'analytics',
        author: 'Marketing Analytics Association',
        year: 2022,
        content: `
Marketing analytics involves the measurement, management, and analysis of marketing performance to maximize effectiveness and optimize return on investment. Key concepts include:

1. Marketing Metrics Hierarchy
   - Business Metrics: Revenue, profit, market share, customer lifetime value
   - Marketing Program Metrics: Campaign performance, channel effectiveness, conversion rates
   - Channel-Specific Metrics: Engagement rates, click-through rates, bounce rates
   - Campaign-Specific Metrics: Message performance, creative effectiveness, audience response

2. Attribution Models
   - Last-Click Attribution: Gives 100% credit to the final touchpoint
   - First-Click Attribution: Gives 100% credit to the first touchpoint
   - Linear Attribution: Distributes credit equally across all touchpoints
   - Time-Decay Attribution: Gives more credit to touchpoints closer to conversion
   - Position-Based Attribution: Gives more credit to first and last touchpoints
   - Algorithmic Attribution: Uses machine learning to determine credit distribution
   - Multi-Touch Attribution: Considers all touchpoints in the customer journey

3. Key Performance Indicators (KPIs)
   - Acquisition Metrics: Cost per acquisition, conversion rate, click-through rate
   - Engagement Metrics: Time on site, bounce rate, pages per session
   - Conversion Metrics: Conversion rate, cart abandonment rate, average order value
   - Retention Metrics: Customer lifetime value, repeat purchase rate, churn rate

4. Testing Methodologies
   - A/B Testing: Comparing two versions of a variable
   - Multivariate Testing: Testing multiple variables simultaneously
   - Split Testing: Directing traffic to different experiences
   - Cohort Analysis: Comparing groups of users over time

5. Data Collection and Management
   - First-Party Data: Collected directly from customers
   - Second-Party Data: Another organization's first-party data
   - Third-Party Data: Data from external sources
   - Data Integration: Combining data from multiple sources
   - Data Cleansing: Ensuring data accuracy and consistency

6. Predictive Analytics
   - Customer Segmentation: Grouping customers based on characteristics
   - Propensity Modeling: Predicting likelihood of specific behaviors
   - Churn Prediction: Identifying customers likely to leave
   - Lifetime Value Prediction: Estimating future value of customers
   - Market Basket Analysis: Understanding purchase patterns

Effective marketing analytics requires a clear framework for data collection, analysis, interpretation, and action, with metrics aligned to business objectives and regularly reviewed for strategic adjustments.
        `
      }
    ];
  }
} 