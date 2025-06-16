import { ISheetsCapabilities } from '../interfaces/ISheetsCapabilities';
import { 
  SheetsCapabilities,
  SpreadsheetInfo,
  CreateSpreadsheetParams, 
  UpdateCellsParams,
  DataAnalysisParams,
  DataAnalysisResult,
  RangeData,
  SpreadsheetSearchCriteria,
  BudgetTemplate
} from '../SheetsCapabilities';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance } from 'axios';

// Legacy types for backward compatibility
interface UpdateValuesParams {
  spreadsheetId: string;
  range: string;
  values: any[][];
}

interface UpdateValuesResult {
  spreadsheetId: string;
  updatedRange: string;
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
}

interface GetValuesParams {
  spreadsheetId: string;
  range: string;
}

interface GetValuesResult {
  range: string;
  majorDimension: string;
  values: any[][];
}

interface BatchUpdateParams {
  spreadsheetId: string;
  requests: any[];
}

interface BatchUpdateResult {
  spreadsheetId: string;
  replies: any[];
}

/**
 * Zoho Sheet Capabilities Implementation
 * Implements spreadsheet operations using Zoho Sheet API
 */
export class ZohoSheetsCapabilities extends SheetsCapabilities implements ISheetsCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;
  private connectionId: string;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    super();
    this.connectionId = connectionId;
    this.zohoProvider = zohoProvider;
  }

  /**
   * Create a new spreadsheet in Zoho Sheet
   */
  async createSpreadsheet(params: CreateSpreadsheetParams, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const formData = new URLSearchParams();
      formData.append('method', 'workbook.create');
      formData.append('workbook_name', params.title);

      console.log('Creating Zoho spreadsheet with data:', formData.toString());

      const response = await client.post('/api/v2/create', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('Zoho Sheet API response:', response.data);

      if (response.data && (response.data.resource_id || response.data.workbook_id)) {
        const spreadsheetId = response.data.resource_id || response.data.workbook_id;
        return {
          id: spreadsheetId,
          title: params.title,
          url: response.data.open_url || '',
          createdTime: new Date(),
          modifiedTime: new Date(),
          owner: 'current_user',
          sheets: [{
            id: 0,
            title: response.data.worksheet_name || 'Sheet1',
            index: 0,
            rowCount: 1000,
            columnCount: 26,
            gridProperties: {
              rowCount: 1000,
              columnCount: 26
            }
          }],
          permissions: []
        };
      } else {
        throw new Error('No workbook ID returned from Zoho Sheet API');
      }
    } catch (error) {
      console.error('Error creating Zoho spreadsheet:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
      }
      throw new Error(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get spreadsheet information and metadata
   */
  async getSpreadsheet(spreadsheetId: string, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const response = await client.get(`/api/v2/workbooks/${spreadsheetId}`);
      
      return {
        id: spreadsheetId,
        title: response.data.workbook_name || 'Untitled Spreadsheet',
        url: response.data.open_url || '',
        createdTime: new Date(response.data.created_time || Date.now()),
        modifiedTime: new Date(response.data.modified_time || Date.now()),
        owner: response.data.created_by || 'Unknown',
        sheets: response.data.worksheets?.map((sheet: any, index: number) => ({
          id: sheet.worksheet_id || index,
          title: sheet.worksheet_name || `Sheet${index + 1}`,
          index,
          rowCount: sheet.row_count || 1000,
          columnCount: sheet.column_count || 26,
          gridProperties: {
            rowCount: sheet.row_count || 1000,
            columnCount: sheet.column_count || 26
          }
        })) || [],
        permissions: []
      };
    } catch (error) {
      throw new Error(`Failed to get spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read data from a specific range in a spreadsheet
   */
  async readRange(spreadsheetId: string, range: string, connectionId: string, agentId: string): Promise<RangeData> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const response = await client.get(`/api/v2/workbooks/${spreadsheetId}/data`, {
        params: { range }
      });
      
      return {
        range,
        values: response.data.values || [],
        majorDimension: 'ROWS'
      };
    } catch (error) {
      throw new Error(`Failed to read range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update cells in a spreadsheet
   */
  async updateCells(params: UpdateCellsParams, connectionId: string, agentId: string): Promise<void> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const updateData = {
        values: params.values,
        range: params.range
      };

      console.log('Updating Zoho spreadsheet cells:', {
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        valueCount: params.values.length
      });

      await client.put(`/api/v2/workbooks/${params.spreadsheetId}/data`, updateData);
    } catch (error) {
      throw new Error(`Failed to update cells: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Append data to a spreadsheet
   */
  async appendData(spreadsheetId: string, range: string, values: any[][], connectionId: string, agentId: string): Promise<void> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const appendData = {
        values,
        range
      };

      await client.post(`/api/v2/workbooks/${spreadsheetId}/data/append`, appendData);
    } catch (error) {
      throw new Error(`Failed to append data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for spreadsheets
   */
  async searchSpreadsheets(criteria: SpreadsheetSearchCriteria, connectionId: string, agentId: string): Promise<SpreadsheetInfo[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const params: any = {};
      if (criteria.title) params.search = criteria.title;
      if (criteria.maxResults) params.limit = criteria.maxResults;
      
      const response = await client.get('/api/v2/workbooks', { params });
      
      return (response.data.workbooks || []).map((workbook: any) => ({
        id: workbook.resource_id || workbook.workbook_id,
        title: workbook.workbook_name,
        url: workbook.open_url || '',
        createdTime: new Date(workbook.created_time || Date.now()),
        modifiedTime: new Date(workbook.modified_time || Date.now()),
        owner: workbook.created_by || 'Unknown',
        sheets: [],
        permissions: []
      }));
    } catch (error) {
      throw new Error(`Failed to search spreadsheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze data in a spreadsheet
   */
  async analyzeData(params: DataAnalysisParams, connectionId: string, agentId: string): Promise<DataAnalysisResult> {
    // For Zoho, provide a simplified analysis
    try {
      const rangeData = await this.readRange(params.spreadsheetId, params.range || 'A1:Z1000', connectionId, agentId);
      
      return {
        summary: `Data analysis for ${params.analysisType} completed`,
        insights: [
          `Found ${rangeData.values.length} rows of data`,
          `Data contains ${rangeData.values[0]?.length || 0} columns`
        ],
        data: {
          rowCount: rangeData.values.length,
          columnCount: rangeData.values[0]?.length || 0,
          analysisType: params.analysisType
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a pre-configured expense tracker spreadsheet
   */
  async createExpenseTracker(title: string, categories: string[], connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    const spreadsheet = await this.createSpreadsheet({ title }, connectionId, agentId);
    
    // Add expense tracker headers
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      range: 'A1:D1',
      values: [headers]
    }, connectionId, agentId);
    
    return spreadsheet;
  }

  /**
   * Create a budget planning template
   */
  async createBudgetTemplate(title: string, template: BudgetTemplate, connectionId: string, agentId: string): Promise<SpreadsheetInfo> {
    const spreadsheet = await this.createSpreadsheet({ title }, connectionId, agentId);
    
    // Add budget template headers
    const headers = ['Category', 'Budgeted', 'Actual', 'Difference'];
    await this.updateCells({
      spreadsheetId: spreadsheet.id,
      range: 'A1:D1',
      values: [headers]
    }, connectionId, agentId);
    
    return spreadsheet;
  }

  // Legacy methods for backward compatibility
  async updateValues(params: UpdateValuesParams): Promise<UpdateValuesResult> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const updateData = {
        values: params.values,
        range: params.range
      };

      console.log('Updating Zoho spreadsheet values:', {
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        valueCount: params.values.length
      });

      const response = await client.put(
        `/sheet/v2/spreadsheets/${params.spreadsheetId}/data`,
        updateData
      );

      return {
        spreadsheetId: params.spreadsheetId,
        updatedRange: params.range,
        updatedRows: params.values.length,
        updatedColumns: Math.max(...params.values.map(row => row.length)),
        updatedCells: params.values.reduce((total, row) => total + row.length, 0)
      };
    } catch (error) {
      console.error('Zoho update values error:', error);
      throw new Error(`Failed to update values in Zoho Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getValues(params: GetValuesParams): Promise<GetValuesResult> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'sheet');
      
      const queryParams = {
        range: params.range
      };

      console.log('Getting Zoho spreadsheet values:', {
        spreadsheetId: params.spreadsheetId,
        range: params.range
      });

      const response = await client.get(
        `/sheet/v2/spreadsheets/${params.spreadsheetId}/data`,
        { params: queryParams }
      );

      return {
        range: params.range,
        majorDimension: 'ROWS',
        values: response.data.values || []
      };
    } catch (error) {
      console.error('Zoho get values error:', error);
      throw new Error(`Failed to get values from Zoho Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async batchUpdate(params: BatchUpdateParams): Promise<BatchUpdateResult> {
    try {
      // For Zoho, we'll execute updates sequentially since batch operations may not be supported
      const results = [];
      
      for (const request of params.requests) {
        if (request.updateCells) {
          // Handle cell updates
          const updateResult = await this.updateValues({
            spreadsheetId: params.spreadsheetId,
            range: `Sheet1!A1:Z1000`, // Simplified range
            values: [[]] // Simplified values
          });
          results.push(updateResult);
        }
      }

      return {
        spreadsheetId: params.spreadsheetId,
        replies: results
      };
    } catch (error) {
      console.error('Zoho batch update error:', error);
      throw new Error(`Failed to batch update Zoho Sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(connectionId: string, agentId: string): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.zohoProvider.getServiceClient(connectionId, 'sheet');
      
      // Test by trying to list spreadsheets or get user info
      const response = await client.get('/sheet/v2/spreadsheets');
      
      return {
        success: true,
        message: 'Zoho Sheets connection test successful'
      };
    } catch (error) {
      console.error('Zoho Sheets connection test failed:', error);
      return {
        success: false,
        message: `Zoho Sheets connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 