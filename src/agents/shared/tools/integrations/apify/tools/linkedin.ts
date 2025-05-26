/**
 * LinkedIn Tools - Company, profile, and job scraping tools
 */

import { z } from 'zod';
import { logger } from '../../../../../../lib/logging';
import { IApifyManager } from '../ApifyManager.interface';
import { ToolDefinition } from '../types';

export function createLinkedInTools(apifyManager: IApifyManager): Record<string, ToolDefinition> {
  return {
    'linkedin-company-scraper': {
      name: 'linkedin-company-scraper',
      description: 'Scrape LinkedIn company pages for business information, employee counts, and recent updates.',
      costEstimate: 'high',
      usageLimit: 10,
      schema: z.object({
        companyUrls: z.array(z.string().url()).min(1).max(3).describe('Array of LinkedIn company page URLs to scrape'),
        includeEmployees: z.boolean().optional().describe('Whether to include employee information (increases cost)'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { companyUrls: string[]; includeEmployees?: boolean; dryRun?: boolean }): Promise<string> {
        try {
          const result = await apifyManager.runApifyActor({
            actorId: 'apify/linkedin-company-scraper',
            input: {
              startUrls: args.companyUrls.map(url => ({ url })),
              includeEmployees: args.includeEmployees || false
            },
            label: `LinkedIn company scraping: ${args.companyUrls.length} companies`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape LinkedIn companies: ${result.error || 'Unknown error'}`;
          }

          const companies = result.output;
          let summary = `Successfully scraped ${companies.length} LinkedIn companies:\n\n`;

          companies.forEach((company: any, index: number) => {
            summary += `[${index + 1}] ${company.name || 'Unknown Company'}\n`;
            summary += `   Industry: ${company.industry || 'N/A'}\n`;
            summary += `   Size: ${company.companySize || 'N/A'} employees\n`;
            summary += `   Headquarters: ${company.headquarters || 'N/A'}\n`;
            summary += `   Founded: ${company.founded || 'N/A'}\n`;
            summary += `   Followers: ${company.followersCount || 'N/A'}\n`;
            summary += `   Description: ${(company.description || 'No description').substring(0, 150)}${company.description && company.description.length > 150 ? '...' : ''}\n`;
            summary += `   Website: ${company.website || 'N/A'}\n\n`;
          });

          return summary;
        } catch (error) {
          logger.error('Error in linkedin-company-scraper tool:', error);
          return `Error scraping LinkedIn companies: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'linkedin-profile-scraper': {
      name: 'linkedin-profile-scraper',
      description: 'Scrape LinkedIn profile data including name, headline, experience, education, skills, and company information',
      costEstimate: 'high',
      usageLimit: 8,
      schema: z.object({
        profileUrls: z.array(z.string().url()).describe('Array of LinkedIn profile URLs to scrape'),
        includeExperience: z.boolean().optional().describe('Whether to include detailed work experience'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { profileUrls: string[]; includeExperience?: boolean; dryRun?: boolean }): Promise<string> {
        try {
          if (args.profileUrls.length > 2) {
            return `I need your permission to scrape ${args.profileUrls.length} LinkedIn profiles, which exceeds our default limit of 2 to prevent excessive API usage and respect LinkedIn's terms. This may incur higher costs.\n\nTo approve, please reply with: "approve ${args.profileUrls.length} for linkedin profile scraping" or modify your request to stay within limits.`;
          }

          const result = await apifyManager.runApifyActor({
            actorId: 'harvestapi/linkedin-profile-scraper',
            input: {
              profileUrls: args.profileUrls,
              proxyConfiguration: {
                useApifyProxy: true
              }
            },
            label: `LinkedIn profile scraping: ${args.profileUrls.length} profiles`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape LinkedIn profiles: ${result.error || 'Unknown error'}`;
          }

          const profiles = result.output;
          let summary = `Successfully scraped ${profiles.length} LinkedIn profiles:\n\n`;

          profiles.forEach((profile: any, index: number) => {
            summary += `[${index + 1}] ${profile.fullName || 'Unknown Name'}\n`;
            summary += `   Title: ${profile.headline || 'N/A'}\n`;
            summary += `   Location: ${profile.location || 'N/A'}\n`;
            summary += `   Connections: ${profile.connectionsCount || 'N/A'}\n`;
            summary += `   Current Company: ${profile.currentCompany || 'N/A'}\n`;
            summary += `   Summary: ${(profile.summary || 'No summary').substring(0, 150)}${profile.summary && profile.summary.length > 150 ? '...' : ''}\n`;
            
            if (profile.experience && profile.experience.length > 0) {
              summary += `   Experience: ${profile.experience.length} positions found\n`;
              profile.experience.slice(0, 2).forEach((exp: any, expIndex: number) => {
                summary += `     [${expIndex + 1}] ${exp.title || 'Unknown'} at ${exp.company || 'Unknown'}\n`;
              });
            }
            summary += '\n';
          });

          return summary;
        } catch (error) {
          logger.error('Error in linkedin-profile-scraper tool:', error);
          return `Error scraping LinkedIn profiles: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    },

    'linkedin-jobs-scraper': {
      name: 'linkedin-jobs-scraper',
      description: 'Scrape LinkedIn job listings by keywords, location, and other filters for market research.',
      costEstimate: 'medium',
      usageLimit: 12,
      schema: z.object({
        keywords: z.string().min(1).describe('Job search keywords'),
        location: z.string().optional().describe('Job location (city, state, country)'),
        limit: z.number().min(1).max(50).optional().describe('Maximum number of job listings to scrape'),
        experienceLevel: z.enum(['entry', 'associate', 'mid', 'senior', 'director', 'executive']).optional().describe('Experience level filter'),
        dryRun: z.boolean().optional().describe('Whether to skip the actual API call')
      }),
      async func(args: { keywords: string; location?: string; limit?: number; experienceLevel?: string; dryRun?: boolean }): Promise<string> {
        try {
          const limit = Math.min(args.limit || 25, 50);

          const result = await apifyManager.runApifyActor({
            actorId: 'apify/linkedin-jobs-scraper',
            input: {
              keywords: args.keywords,
              location: args.location || '',
              maxItems: limit,
              experienceLevel: args.experienceLevel
            },
            label: `LinkedIn jobs scraping: ${args.keywords}`,
            dryRun: args.dryRun || false
          });

          if (!result.success || !result.output) {
            return `Failed to scrape LinkedIn jobs: ${result.error || 'Unknown error'}`;
          }

          const jobs = result.output;
          let summary = `Successfully scraped ${jobs.length} LinkedIn job listings for "${args.keywords}":\n\n`;

          jobs.slice(0, 8).forEach((job: any, index: number) => {
            summary += `[${index + 1}] ${job.title || 'Unknown Title'}\n`;
            summary += `   Company: ${job.company || 'Unknown'}\n`;
            summary += `   Location: ${job.location || 'N/A'}\n`;
            summary += `   Experience: ${job.experienceLevel || 'N/A'}\n`;
            summary += `   Posted: ${job.postedAt || 'N/A'}\n`;
            summary += `   Salary: ${job.salary || 'Not specified'}\n`;
            summary += `   URL: ${job.url || 'N/A'}\n\n`;
          });

          if (jobs.length > 8) {
            summary += `... and ${jobs.length - 8} more job listings`;
          }

          return summary;
        } catch (error) {
          logger.error('Error in linkedin-jobs-scraper tool:', error);
          return `Error scraping LinkedIn jobs: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  };
} 