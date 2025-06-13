import {
  SpreadsheetInfo,
  CreateSpreadsheetParams,
  UpdateCellsParams,
  DataAnalysisParams,
  DataAnalysisResult,
  RangeData,
  SpreadsheetSearchCriteria,
  BudgetTemplate
} from '../SheetsCapabilities';

/**
 * Abstract interface for spreadsheet capabilities across all workspace providers
 * This ensures consistent functionality regardless of the underlying provider (Google, Microsoft, Zoho)
 */
export interface ISheetsCapabilities {
  /**
   * Create a new spreadsheet
   */
  createSpreadsheet(params: CreateSpreadsheetParams, connectionId: string, agentId: string): Promise<SpreadsheetInfo>;

  /**
   * Get spreadsheet information and metadata
   */
  getSpreadsheet(spreadsheetId: string, connectionId: string, agentId: string): Promise<SpreadsheetInfo>;

  /**
   * Read data from a specific range in a spreadsheet
   */
  readRange(spreadsheetId: string, range: string, connectionId: string, agentId: string): Promise<RangeData>;

  /**
   * Update cells in a spreadsheet
   */
  updateCells(params: UpdateCellsParams, connectionId: string, agentId: string): Promise<void>;

  /**
   * Append data to a spreadsheet
   */
  appendData(spreadsheetId: string, range: string, values: any[][], connectionId: string, agentId: string): Promise<void>;

  /**
   * Search for spreadsheets
   */
  searchSpreadsheets(criteria: SpreadsheetSearchCriteria, connectionId: string, agentId: string): Promise<SpreadsheetInfo[]>;

  /**
   * Analyze data in a spreadsheet
   */
  analyzeData(params: DataAnalysisParams, connectionId: string, agentId: string): Promise<DataAnalysisResult>;

  /**
   * Create a pre-configured expense tracker spreadsheet
   */
  createExpenseTracker(title: string, categories: string[], connectionId: string, agentId: string): Promise<SpreadsheetInfo>;

  /**
   * Create a budget planning template
   */
  createBudgetTemplate(title: string, template: BudgetTemplate, connectionId: string, agentId: string): Promise<SpreadsheetInfo>;
} 