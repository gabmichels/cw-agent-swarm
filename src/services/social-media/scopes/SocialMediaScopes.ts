// Following IMPLEMENTATION_GUIDELINES.md - centralized scope configuration
import { SocialMediaProvider } from '../database/ISocialMediaDatabase';

// Platform-specific OAuth scopes
const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write', 
  'users.read',
  'follows.read',
  'offline.access'
];

const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social'
];

const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'publish_to_groups'
];

const INSTAGRAM_SCOPES = [
  'user_profile',
  'user_media',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish'
];

const REDDIT_SCOPES = [
  'identity',
  'read',
  'submit',
  'edit',
  'vote',
  'modposts',
  'privatemessages'
];

const TIKTOK_SCOPES = [
  'user.info.basic',
  'video.list',
  'video.upload',
  'video.publish',
  'research.adlib.basic',
  'research.data.basic'
];

// Centralized scope configuration - single source of truth
export const getSocialMediaScopes = (provider: SocialMediaProvider): string[] => {
  switch (provider) {
    case SocialMediaProvider.TWITTER:
      return TWITTER_SCOPES;
    case SocialMediaProvider.LINKEDIN:
      return LINKEDIN_SCOPES;
    case SocialMediaProvider.FACEBOOK:
      return FACEBOOK_SCOPES;
    case SocialMediaProvider.INSTAGRAM:
      return INSTAGRAM_SCOPES;
    case SocialMediaProvider.REDDIT:
      return REDDIT_SCOPES;
    case SocialMediaProvider.TIKTOK:
      return TIKTOK_SCOPES;
    default:
      return [];
  }
};

// Get required scopes for basic functionality
export const getRequiredScopes = (provider: SocialMediaProvider): string[] => {
  switch (provider) {
    case SocialMediaProvider.TWITTER:
      return ['tweet.read', 'tweet.write', 'users.read'];
    case SocialMediaProvider.LINKEDIN:
      return ['profile', 'w_member_social'];
    case SocialMediaProvider.FACEBOOK:
      return ['pages_show_list', 'pages_manage_posts'];
    case SocialMediaProvider.INSTAGRAM:
      return ['user_profile', 'instagram_basic'];
    case SocialMediaProvider.REDDIT:
      return ['identity', 'read', 'submit'];
    case SocialMediaProvider.TIKTOK:
      return ['user.info.basic', 'video.upload'];
    default:
      return [];
  }
};

// Get optional scopes for enhanced functionality
export const getOptionalScopes = (provider: SocialMediaProvider): string[] => {
  const allScopes = getSocialMediaScopes(provider);
  const requiredScopes = getRequiredScopes(provider);
  return allScopes.filter(scope => !requiredScopes.includes(scope));
};

// Scope descriptions for UI display
export const getScopeDescription = (scope: string, provider: SocialMediaProvider): string => {
  const descriptions: Record<string, string> = {
    // Twitter
    'tweet.read': 'Read tweets and user profiles',
    'tweet.write': 'Post tweets and replies',
    'users.read': 'Read user account information',
    'follows.read': 'Read follower and following lists',
    'offline.access': 'Maintain access when offline',
    
    // LinkedIn
    'openid': 'Sign in with LinkedIn',
    'profile': 'Read basic profile information',
    'email': 'Access email address',
    'w_member_social': 'Share content on your behalf',
    
    // Facebook
    'pages_show_list': 'See pages you manage',
    'pages_read_engagement': 'Read page insights and metrics',
    'pages_manage_posts': 'Create and manage page posts',
    'pages_manage_engagement': 'Respond to comments and messages',
    'publish_to_groups': 'Post to groups you admin',
    
    // Instagram
    'user_profile': 'Access basic profile information',
    'user_media': 'Access your media files',
    'instagram_basic': 'Basic Instagram access',
    'instagram_content_publish': 'Publish content to Instagram',
    
    // Reddit
    'identity': 'Access username and basic info',
    'read': 'Read posts and comments',
    'submit': 'Submit posts and comments',
    'edit': 'Edit your posts and comments',
    'vote': 'Vote on posts and comments',
    'modposts': 'Moderate subreddit posts',
    'privatemessages': 'Read and send private messages',
    
    // TikTok
    'user.info.basic': 'Access basic profile information',
    'video.list': 'View your video list',
    'video.upload': 'Upload videos',
    'video.publish': 'Publish videos',
    'research.adlib.basic': 'Basic research access',
    'research.data.basic': 'Basic analytics access'
  };

  return descriptions[scope] || scope;
}; 