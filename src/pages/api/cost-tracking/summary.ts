import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getCostTrackingManager } from '../../../services/cost-tracking/CostTrackingManager';
import { CostCategory } from '../../../services/cost-tracking/interfaces/CostTrackingInterfaces';
import { logger } from '../../../lib/logging';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const costManager = getCostTrackingManager(prisma);
    
    // Parse query parameters
    const {
      startDate,
      endDate,
      categories,
      services,
      departmentId,
      initiatedBy,
      format = 'json'
    } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate are required',
        example: '?startDate=2024-01-01&endDate=2024-01-31'
      });
    }

    // Parse dates
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }

    // Parse categories if provided
    let categoryFilter: CostCategory[] | undefined;
    if (categories) {
      const categoryArray = Array.isArray(categories) ? categories : [categories];
      categoryFilter = categoryArray.filter(cat => 
        Object.values(CostCategory).includes(cat as CostCategory)
      ) as CostCategory[];
    }

    // Parse services if provided
    let serviceFilter: string[] | undefined;
    if (services) {
      serviceFilter = Array.isArray(services) ? services as string[] : [services as string];
    }

    // Get cost summary
    const summary = await costManager.getCostSummary({
      startDate: start,
      endDate: end,
      categories: categoryFilter,
      services: serviceFilter,
      departmentId: departmentId as string | undefined,
      initiatedBy: initiatedBy as string | undefined
    });

    // Handle different response formats
    if (format === 'csv') {
      const csvData = convertSummaryToCsv(summary);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cost-summary.csv');
      return res.send(csvData);
    }

    // Return JSON response
    res.status(200).json({
      success: true,
      data: summary,
      metadata: {
        requestedPeriod: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        filters: {
          categories: categoryFilter,
          services: serviceFilter,
          departmentId,
          initiatedBy
        },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cost summary API error', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function convertSummaryToCsv(summary: any): string {
  const headers = ['Metric', 'Value'];
  const rows = [headers.join(',')];

  // Add summary metrics
  rows.push(`Total Cost USD,${summary.totalCostUsd.toFixed(4)}`);
  rows.push(`Total Operations,${summary.totalOperations}`);
  rows.push(`Average Cost Per Operation,${summary.averageCostPerOperation.toFixed(4)}`);
  rows.push('');

  // Add category breakdown
  rows.push('Cost by Category');
  for (const [category, cost] of Object.entries(summary.byCategory)) {
    rows.push(`${category},${(cost as number).toFixed(4)}`);
  }
  rows.push('');

  // Add service breakdown
  rows.push('Cost by Service');
  for (const [service, cost] of Object.entries(summary.byService)) {
    rows.push(`${service},${(cost as number).toFixed(4)}`);
  }

  return rows.join('\n');
} 