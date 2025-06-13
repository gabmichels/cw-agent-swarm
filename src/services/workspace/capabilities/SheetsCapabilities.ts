import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceConnection, WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';

// Sheets data types
export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
  createdTime: Date;
  modifiedTime: Date;
  owner: string;
  sheets: SheetInfo[];
  permissions: SpreadsheetPermission[];
}

export interface SheetInfo {
  id: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
  gridProperties?: GridProperties;
}

export interface GridProperties {
  rowCount: number;
  columnCount: number;
  frozenRowCount?: number;
  frozenColumnCount?: number;
}

export interface SpreadsheetPermission {
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  type: 'user' | 'group' | 'domain' | 'anyone';
}

export interface CreateSpreadsheetParams {
  title: string;
  sheets?: CreateSheetParams[];
  shareWith?: SpreadsheetPermission[];
}

export interface CreateSheetParams {
  title: string;
  rowCount?: number;
  columnCount?: number;
  headers?: string[];
}

export interface CellData {
  row: number;
  column: number;
  value: any;
  formattedValue?: string;
  formula?: string;
  note?: string;
}

export interface RangeData {
  range: string; // A1 notation
  values: any[][];
  majorDimension?: 'ROWS' | 'COLUMNS';
}

export interface UpdateCellsParams {
  spreadsheetId: string;
  sheetName?: string;
  range: string;
  values: any[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface SpreadsheetSearchCriteria {
  title?: string;
  owner?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  maxResults?: number;
}

export interface DataAnalysisParams {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  analysisType: 'summary' | 'trends' | 'correlations' | 'pivot';
  groupBy?: string[];
  aggregations?: { column: string; function: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN' }[];
}

export interface DataAnalysisResult {
  summary: string;
  insights: string[];
  data: any;
  charts?: ChartSuggestion[];
}

export interface ChartSuggestion {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  description: string;
  dataRange: string;
}

export interface ExpenseTracker {
  categories: string[];
  totalExpenses: number;
  monthlyBreakdown: { month: string; amount: number }[];
  topCategories: { category: string; amount: number; percentage: number }[];
}

export interface BudgetTemplate {
  income: { source: string; amount: number }[];
  expenses: { category: string; budgeted: number; actual?: number }[];
  savings: { goal: string; target: number; current?: number }[];
}

export class SheetsCapabilities {
  private db: IDatabaseProvider;
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(params: CreateSpreadsheetParams, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_CREATE, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const sheets = await this.getSheetsClient(connection);
    
    try {
      // Create spreadsheet structure
      const spreadsheetBody = {
        properties: {
          title: params.title
        },
        sheets: params.sheets?.map(sheet => ({
          properties: {
            title: sheet.title,
            gridProperties: {
              rowCount: sheet.rowCount || 1000,
              columnCount: sheet.columnCount || 26
            }
          }
        })) || [{
          properties: {
            title: 'Sheet1',
            gridProperties: {
              rowCount: 1000,
              columnCount: 26
            }
          }
        }]
      };

      const response = await sheets.spreadsheets.create({
        requestBody: spreadsheetBody
      });

      const spreadsheet = response.data;

      // Add headers if specified
      if (params.sheets) {
        for (let i = 0; i < params.sheets.length; i++) {
          const sheet = params.sheets[i];
          if (sheet.headers && sheet.headers.length > 0) {
            await this.updateCells({
              spreadsheetId: spreadsheet.spreadsheetId!,
              sheetName: sheet.title,
              range: 'A1',
              values: [sheet.headers],
              valueInputOption: 'USER_ENTERED'
            }, connectionId, agentId);
          }
        }
      }

      // Share with specified users
      if (params.shareWith && params.shareWith.length > 0) {
        await this.shareSpreadsheet(spreadsheet.spreadsheetId!, params.shareWith, connectionId, agentId);
      }

      return this.convertToSpreadsheetInfo(spreadsheet);
    } catch (error) {
      throw new Error(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get spreadsheet information
   */
  async getSpreadsheet(spreadsheetId: string, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const sheets = await this.getSheetsClient(connection);
    
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
      });

      return this.convertToSpreadsheetInfo(response.data);
    } catch (error) {
      throw new Error(`Failed to get spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read data from a range
   */
  async readRange(spreadsheetId: string, range: string, connectionId: string, agentId: string): Promise<RangeData> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const sheets = await this.getSheetsClient(connection);
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        majorDimension: 'ROWS'
      });

      return {
        range: response.data.range || range,
        values: response.data.values || [],
        majorDimension: response.data.majorDimension as 'ROWS' | 'COLUMNS' || 'ROWS'
      };
    } catch (error) {
      throw new Error(`Failed to read range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update cells in a range
   */
  async updateCells(params: UpdateCellsParams, connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const sheets = await this.getSheetsClient(connection);
    
    try {
      const fullRange = params.sheetName ? `${params.sheetName}!${params.range}` : params.range;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: params.spreadsheetId,
        range: fullRange,
        valueInputOption: params.valueInputOption || 'USER_ENTERED',
        requestBody: {
          values: params.values,
          majorDimension: 'ROWS'
        }
      });
    } catch (error) {
      throw new Error(`Failed to update cells: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Append data to a sheet
   */
  async appendData(spreadsheetId: string, range: string, values: any[][], connectionId: string, agentId: string): Promise<void> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_EDIT, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const sheets = await this.getSheetsClient(connection);
    
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
          majorDimension: 'ROWS'
        }
      });
    } catch (error) {
      throw new Error(`Failed to append data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for spreadsheets
   */
  async searchSpreadsheets(criteria: SpreadsheetSearchCriteria, connectionId: string, agentId: string): Promise<SpreadsheetInfo[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const drive = await this.getDriveClient(connection);
    
    try {
      let query = "mimeType='application/vnd.google-apps.spreadsheet'";
      
      if (criteria.title) {
        query += ` and name contains '${criteria.title}'`;
      }
      
      if (criteria.owner) {
        query += ` and '${criteria.owner}' in owners`;
      }
      
      if (criteria.modifiedAfter) {
        query += ` and modifiedTime > '${criteria.modifiedAfter.toISOString()}'`;
      }
      
      if (criteria.modifiedBefore) {
        query += ` and modifiedTime < '${criteria.modifiedBefore.toISOString()}'`;
      }

      const response = await drive.files.list({
        q: query,
        pageSize: criteria.maxResults || 10,
        fields: 'files(id,name,webViewLink,createdTime,modifiedTime,owners)'
      });

      const files = response.data.files || [];
      const spreadsheets: SpreadsheetInfo[] = [];

      for (const file of files) {
        try {
          const spreadsheet = await this.getSpreadsheet(file.id!, connectionId, agentId);
          spreadsheets.push(spreadsheet);
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }

      return spreadsheets;
    } catch (error) {
      throw new Error(`Failed to search spreadsheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze data in a spreadsheet
   */
  async analyzeData(params: DataAnalysisParams, connectionId: string, agentId: string): Promise<DataAnalysisResult> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId, 
      WorkspaceCapabilityType.SPREADSHEET_READ, 
      connectionId
    );
    
    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const range = params.range || 'A:Z';
    const fullRange = params.sheetName ? `${params.sheetName}!${range}` : range;
    
    const data = await this.readRange(params.spreadsheetId, fullRange, connectionId, agentId);
    
    if (!data.values || data.values.length === 0) {
      throw new Error('No data found in the specified range');
    }

    const headers = data.values[0];
    const rows = data.values.slice(1);

    let result: DataAnalysisResult;

    switch (params.analysisType) {
      case 'summary':
        result = this.generateSummaryAnalysis(headers, rows);
        break;
      case 'trends':
        result = this.generateTrendAnalysis(headers, rows);
        break;
      case 'correlations':
        result = this.generateCorrelationAnalysis(headers, rows);
        break;
      case 'pivot':
        result = this.generatePivotAnalysis(headers, rows, params.groupBy, params.aggregations);
        break;
      default:
        throw new Error(`Unsupported analysis type: ${params.analysisType}`);
    }

    return result;
  }

  /**
   * Create an expense tracker spreadsheet
   */
  async createExpenseTracker(title: string, categories: string[], connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Payment Method', 'Notes'];
    
    const sheets = [
      {
        title: 'Expenses',
        headers: headers
      },
      {
        title: 'Categories',
        headers: ['Category', 'Budget', 'Spent', 'Remaining']
      },
      {
        title: 'Summary',
        headers: ['Month', 'Total Expenses', 'Budget', 'Difference']
      }
    ];

    const spreadsheet = await this.createSpreadsheet({
      title,
      sheets
    }, connectionId, agentId);

    // Add category data
    const categoryData = categories.map(cat => [cat, 0, 0, 0]);
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      sheetName: 'Categories',
      range: 'A2',
      values: categoryData
    }, connectionId, agentId);

    return spreadsheet;
  }

  /**
   * Create a budget template
   */
  async createBudgetTemplate(title: string, template: BudgetTemplate, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    const sheets = [
      {
        title: 'Income',
        headers: ['Source', 'Amount', 'Frequency', 'Annual Total']
      },
      {
        title: 'Expenses',
        headers: ['Category', 'Budgeted', 'Actual', 'Difference', 'Percentage']
      },
      {
        title: 'Savings',
        headers: ['Goal', 'Target', 'Current', 'Progress', 'Monthly Required']
      },
      {
        title: 'Dashboard',
        headers: ['Metric', 'Value', 'Status']
      }
    ];

    const spreadsheet = await this.createSpreadsheet({
      title,
      sheets
    }, connectionId, agentId);

    // Add income data
    const incomeData = template.income.map(item => [item.source, item.amount, 'Monthly', `=B2*12`]);
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      sheetName: 'Income',
      range: 'A2',
      values: incomeData
    }, connectionId, agentId);

    // Add expense data
    const expenseData = template.expenses.map(item => [
      item.category, 
      item.budgeted, 
      item.actual || 0, 
      `=C2-B2`, 
      `=B2/SUM(B:B)*100`
    ]);
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      sheetName: 'Expenses',
      range: 'A2',
      values: expenseData
    }, connectionId, agentId);

    // Add savings data
    const savingsData = template.savings.map(item => [
      item.goal,
      item.target,
      item.current || 0,
      `=C2/B2*100`,
      `=(B2-C2)/12`
    ]);
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      sheetName: 'Savings',
      range: 'A2',
      values: savingsData
    }, connectionId, agentId);

    return spreadsheet;
  }

  // Private helper methods
  private async getSheetsClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  private async getDriveClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  private convertToSpreadsheetInfo(googleSpreadsheet: any): SpreadsheetInfo {
    return {
      id: googleSpreadsheet.spreadsheetId,
      title: googleSpreadsheet.properties?.title || 'Untitled',
      url: googleSpreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${googleSpreadsheet.spreadsheetId}`,
      createdTime: new Date(), // Google Sheets API doesn't provide creation time
      modifiedTime: new Date(), // Would need Drive API for accurate times
      owner: 'Unknown', // Would need Drive API for owner info
      sheets: googleSpreadsheet.sheets?.map((sheet: any) => ({
        id: sheet.properties.sheetId,
        title: sheet.properties.title,
        index: sheet.properties.index,
        rowCount: sheet.properties.gridProperties?.rowCount || 0,
        columnCount: sheet.properties.gridProperties?.columnCount || 0,
        gridProperties: sheet.properties.gridProperties
      })) || [],
      permissions: [] // Would need Drive API for permissions
    };
  }

  private async shareSpreadsheet(spreadsheetId: string, permissions: SpreadsheetPermission[], connectionId: string, agentId: string): Promise<void> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) return;

    const drive = await this.getDriveClient(connection);

    for (const permission of permissions) {
      try {
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            role: permission.role,
            type: permission.type,
            emailAddress: permission.email
          }
        });
      } catch (error) {
        // Continue with other permissions if one fails
        console.warn(`Failed to share with ${permission.email}:`, error);
      }
    }
  }

  private generateSummaryAnalysis(headers: any[], rows: any[][]): DataAnalysisResult {
    const numericColumns = this.identifyNumericColumns(headers, rows);
    const insights: string[] = [];
    
    insights.push(`Dataset contains ${rows.length} rows and ${headers.length} columns`);
    insights.push(`Found ${numericColumns.length} numeric columns: ${numericColumns.join(', ')}`);
    
    const summary = `Data summary: ${rows.length} records with ${headers.length} fields. Key numeric fields include ${numericColumns.join(', ')}.`;
    
    return {
      summary,
      insights,
      data: {
        rowCount: rows.length,
        columnCount: headers.length,
        numericColumns,
        headers
      }
    };
  }

  private generateTrendAnalysis(headers: any[], rows: any[][]): DataAnalysisResult {
    const insights: string[] = [];
    const dateColumns = this.identifyDateColumns(headers, rows);
    const numericColumns = this.identifyNumericColumns(headers, rows);
    
    if (dateColumns.length === 0) {
      insights.push('No date columns found for trend analysis');
    } else {
      insights.push(`Found date columns: ${dateColumns.join(', ')}`);
    }
    
    if (numericColumns.length === 0) {
      insights.push('No numeric columns found for trend analysis');
    } else {
      insights.push(`Numeric trends can be analyzed for: ${numericColumns.join(', ')}`);
    }
    
    return {
      summary: 'Trend analysis identifies patterns over time in your data',
      insights,
      data: { dateColumns, numericColumns },
      charts: [{
        type: 'line',
        title: 'Trend Over Time',
        description: 'Shows how values change over time',
        dataRange: 'A:Z'
      }]
    };
  }

  private generateCorrelationAnalysis(headers: any[], rows: any[][]): DataAnalysisResult {
    const numericColumns = this.identifyNumericColumns(headers, rows);
    const insights: string[] = [];
    
    if (numericColumns.length < 2) {
      insights.push('Need at least 2 numeric columns for correlation analysis');
    } else {
      insights.push(`Can analyze correlations between ${numericColumns.length} numeric columns`);
      insights.push('Strong correlations may indicate relationships between variables');
    }
    
    return {
      summary: 'Correlation analysis identifies relationships between numeric variables',
      insights,
      data: { numericColumns },
      charts: [{
        type: 'scatter',
        title: 'Correlation Plot',
        description: 'Shows relationships between variables',
        dataRange: 'A:Z'
      }]
    };
  }

  private generatePivotAnalysis(headers: any[], rows: any[][], groupBy?: string[], aggregations?: any[]): DataAnalysisResult {
    const insights: string[] = [];
    const categoricalColumns = this.identifyCategoricalColumns(headers, rows);
    const numericColumns = this.identifyNumericColumns(headers, rows);
    
    insights.push(`Available grouping columns: ${categoricalColumns.join(', ')}`);
    insights.push(`Available aggregation columns: ${numericColumns.join(', ')}`);
    
    if (groupBy && groupBy.length > 0) {
      insights.push(`Grouping by: ${groupBy.join(', ')}`);
    }
    
    return {
      summary: 'Pivot analysis groups and summarizes data by categories',
      insights,
      data: { categoricalColumns, numericColumns, groupBy, aggregations }
    };
  }

  private identifyNumericColumns(headers: any[], rows: any[][]): string[] {
    const numericColumns: string[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const column = headers[i];
      const sampleValues = rows.slice(0, 10).map(row => row[i]);
      const numericCount = sampleValues.filter(val => !isNaN(Number(val)) && val !== '').length;
      
      if (numericCount > sampleValues.length * 0.7) {
        numericColumns.push(column);
      }
    }
    
    return numericColumns;
  }

  private identifyDateColumns(headers: any[], rows: any[][]): string[] {
    const dateColumns: string[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const column = headers[i];
      if (column.toLowerCase().includes('date') || column.toLowerCase().includes('time')) {
        dateColumns.push(column);
      }
    }
    
    return dateColumns;
  }

  private identifyCategoricalColumns(headers: any[], rows: any[][]): string[] {
    const categoricalColumns: string[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const column = headers[i];
      const uniqueValues = new Set(rows.map(row => row[i]));
      
      // If less than 20% unique values, likely categorical
      if (uniqueValues.size < rows.length * 0.2) {
        categoricalColumns.push(column);
      }
    }
    
    return categoricalColumns;
  }
} 