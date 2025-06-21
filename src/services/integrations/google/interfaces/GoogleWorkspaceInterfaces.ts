/**
 * GoogleWorkspaceInterfaces.ts
 * Comprehensive TypeScript interfaces for Google Workspace integration
 * Following IMPLEMENTATION_GUIDELINES.md principles
 */

import { ulid } from 'ulid';

// Base types
export type GoogleWorkspaceService = 'sheets' | 'drive' | 'calendar' | 'gmail' | 'docs';
export type GoogleDriveFileType = 'folder' | 'document' | 'spreadsheet' | 'presentation' | 'form' | 'drawing' | 'pdf' | 'image' | 'video' | 'audio' | 'archive' | 'other';
export type GoogleCalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type GoogleCalendarAttendeeStatus = 'needsAction' | 'declined' | 'tentative' | 'accepted';
export type GoogleSheetsValueInputOption = 'RAW' | 'USER_ENTERED';
export type GoogleSheetsValueRenderOption = 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';

// Google Sheets interfaces
export interface Spreadsheet {
  readonly spreadsheetId: string;
  readonly properties: SpreadsheetProperties;
  readonly sheets: readonly Sheet[];
  readonly namedRanges?: readonly NamedRange[];
  readonly spreadsheetUrl: string;
}

export interface SpreadsheetProperties {
  readonly title: string;
  readonly locale: string;
  readonly autoRecalc: string;
  readonly timeZone: string;
  readonly defaultFormat?: CellFormat;
}

export interface Sheet {
  readonly properties: SheetProperties;
  readonly data?: readonly GridData[];
  readonly merges?: readonly GridRange[];
  readonly conditionalFormats?: readonly ConditionalFormatRule[];
  readonly filterViews?: readonly FilterView[];
  readonly protectedRanges?: readonly ProtectedRange[];
}

export interface SheetProperties {
  readonly sheetId: number;
  readonly title: string;
  readonly index: number;
  readonly sheetType: 'GRID' | 'OBJECT';
  readonly gridProperties?: GridProperties;
  readonly hidden?: boolean;
  readonly tabColor?: Color;
  readonly rightToLeft?: boolean;
}

export interface GridProperties {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly frozenRowCount?: number;
  readonly frozenColumnCount?: number;
  readonly hideGridlines?: boolean;
}

export interface GridData {
  readonly startRow?: number;
  readonly startColumn?: number;
  readonly rowData?: readonly RowData[];
  readonly rowMetadata?: readonly DimensionProperties[];
  readonly columnMetadata?: readonly DimensionProperties[];
}

export interface RowData {
  readonly values?: readonly CellData[];
}

export interface CellData {
  readonly userEnteredValue?: ExtendedValue;
  readonly effectiveValue?: ExtendedValue;
  readonly formattedValue?: string;
  readonly userEnteredFormat?: CellFormat;
  readonly effectiveFormat?: CellFormat;
  readonly hyperlink?: string;
  readonly note?: string;
  readonly textFormatRuns?: readonly TextFormatRun[];
  readonly dataValidation?: DataValidationRule;
  readonly pivotTable?: PivotTable;
}

export interface ExtendedValue {
  readonly numberValue?: number;
  readonly stringValue?: string;
  readonly boolValue?: boolean;
  readonly formulaValue?: string;
  readonly errorValue?: ErrorValue;
}

export interface CellFormat {
  readonly numberFormat?: NumberFormat;
  readonly backgroundColor?: Color;
  readonly borders?: Borders;
  readonly padding?: Padding;
  readonly horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT';
  readonly verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  readonly wrapStrategy?: 'OVERFLOW_CELL' | 'LEGACY_WRAP' | 'CLIP' | 'WRAP';
  readonly textDirection?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  readonly textFormat?: TextFormat;
  readonly hyperlinkDisplayType?: 'LINKED' | 'PLAIN_TEXT';
  readonly textRotation?: TextRotation;
}

export interface Color {
  readonly red?: number;
  readonly green?: number;
  readonly blue?: number;
  readonly alpha?: number;
}

export interface GridRange {
  readonly sheetId?: number;
  readonly startRowIndex?: number;
  readonly endRowIndex?: number;
  readonly startColumnIndex?: number;
  readonly endColumnIndex?: number;
}

export interface NamedRange {
  readonly namedRangeId?: string;
  readonly name: string;
  readonly range: GridRange;
}

// Google Drive interfaces
export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly parents?: readonly string[];
  readonly size?: string;
  readonly createdTime: string;
  readonly modifiedTime: string;
  readonly webViewLink: string;
  readonly webContentLink?: string;
  readonly iconLink: string;
  readonly thumbnailLink?: string;
  readonly shared: boolean;
  readonly ownedByMe: boolean;
  readonly capabilities: FileCapabilities;
  readonly properties?: Record<string, string>;
  readonly appProperties?: Record<string, string>;
  readonly exportLinks?: Record<string, string>;
}

export interface FileCapabilities {
  readonly canEdit: boolean;
  readonly canShare: boolean;
  readonly canDelete: boolean;
  readonly canDownload: boolean;
  readonly canComment: boolean;
  readonly canCopy: boolean;
  readonly canRename: boolean;
}

export interface DriveFolder extends DriveFile {
  readonly mimeType: 'application/vnd.google-apps.folder';
  readonly children?: readonly DriveFile[];
}

export interface SharingPermissions {
  readonly role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  readonly type: 'user' | 'group' | 'domain' | 'anyone';
  readonly emailAddress?: string;
  readonly domain?: string;
  readonly allowFileDiscovery?: boolean;
  readonly sendNotificationEmail?: boolean;
  readonly emailMessage?: string;
}

export interface SharingResult {
  readonly permissionId: string;
  readonly success: boolean;
  readonly message?: string;
}

// Google Calendar interfaces
export interface CalendarEvent {
  readonly id: string;
  readonly summary: string;
  readonly description?: string;
  readonly location?: string;
  readonly start: EventDateTime;
  readonly end: EventDateTime;
  readonly attendees?: readonly EventAttendee[];
  readonly creator: EventCreator;
  readonly organizer: EventOrganizer;
  readonly status: GoogleCalendarEventStatus;
  readonly htmlLink: string;
  readonly created: string;
  readonly updated: string;
  readonly recurringEventId?: string;
  readonly recurrence?: readonly string[];
  readonly reminders?: EventReminders;
  readonly conferenceData?: ConferenceData;
  readonly visibility?: 'default' | 'public' | 'private' | 'confidential';
  readonly transparency?: 'opaque' | 'transparent';
}

export interface EventDateTime {
  readonly date?: string; // YYYY-MM-DD format for all-day events
  readonly dateTime?: string; // RFC3339 timestamp for timed events
  readonly timeZone?: string;
}

export interface EventAttendee {
  readonly email: string;
  readonly displayName?: string;
  readonly responseStatus: GoogleCalendarAttendeeStatus;
  readonly optional?: boolean;
  readonly organizer?: boolean;
  readonly self?: boolean;
  readonly resource?: boolean;
}

export interface EventCreator {
  readonly email: string;
  readonly displayName?: string;
  readonly self?: boolean;
}

export interface EventOrganizer {
  readonly email: string;
  readonly displayName?: string;
  readonly self?: boolean;
}

export interface EventReminders {
  readonly useDefault: boolean;
  readonly overrides?: readonly EventReminder[];
}

export interface EventReminder {
  readonly method: 'email' | 'popup';
  readonly minutes: number;
}

export interface ConferenceData {
  readonly entryPoints: readonly EntryPoint[];
  readonly conferenceSolution: ConferenceSolution;
  readonly conferenceId: string;
}

export interface EntryPoint {
  readonly entryPointType: 'video' | 'phone' | 'sip' | 'more';
  readonly uri: string;
  readonly label?: string;
  readonly pin?: string;
  readonly accessCode?: string;
  readonly meetingCode?: string;
  readonly passcode?: string;
  readonly password?: string;
}

export interface ConferenceSolution {
  readonly key: ConferenceSolutionKey;
  readonly name: string;
  readonly iconUri: string;
}

export interface ConferenceSolutionKey {
  readonly type: 'eventHangout' | 'eventNamedHangout' | 'hangoutsMeet' | 'addOn';
}

export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
  readonly timeZone?: string;
}

export interface Availability {
  readonly busy: readonly TimeRange[];
  readonly free: readonly TimeRange[];
  readonly tentative: readonly TimeRange[];
  readonly unavailable: readonly TimeRange[];
}

// Request parameter interfaces
export interface CalendarEventParams {
  readonly summary: string;
  readonly description?: string;
  readonly location?: string;
  readonly start: EventDateTime;
  readonly end: EventDateTime;
  readonly attendees?: readonly Omit<EventAttendee, 'responseStatus'>[];
  readonly reminders?: EventReminders;
  readonly conferenceData?: Partial<ConferenceData>;
  readonly visibility?: 'default' | 'public' | 'private' | 'confidential';
  readonly transparency?: 'opaque' | 'transparent';
  readonly recurrence?: readonly string[];
}

export interface SpreadsheetCreationParams {
  readonly title: string;
  readonly locale?: string;
  readonly timeZone?: string;
  readonly sheets?: readonly Partial<SheetProperties>[];
}

export interface DriveFileCreationParams {
  readonly name: string;
  readonly parents?: readonly string[];
  readonly mimeType?: string;
  readonly properties?: Record<string, string>;
  readonly appProperties?: Record<string, string>;
}

export interface SheetsUpdateParams {
  readonly range: string;
  readonly values: readonly (readonly unknown[])[];
  readonly valueInputOption?: GoogleSheetsValueInputOption;
  readonly includeValuesInResponse?: boolean;
  readonly valueRenderOption?: GoogleSheetsValueRenderOption;
}

export interface SheetsReadParams {
  readonly range: string;
  readonly valueRenderOption?: GoogleSheetsValueRenderOption;
  readonly dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
}

// Service response interfaces
export interface GoogleWorkspaceServiceResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: GoogleWorkspaceServiceError;
  readonly requestId: string; // ULID
}

export interface GoogleWorkspaceServiceError {
  readonly id: string; // ULID
  readonly service: GoogleWorkspaceService;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface GoogleWorkspaceHealthStatus {
  readonly services: Record<GoogleWorkspaceService, ServiceHealthStatus>;
  readonly overall: ServiceHealthStatus;
  readonly lastChecked: Date;
}

export interface ServiceHealthStatus {
  readonly isHealthy: boolean;
  readonly responseTime?: number;
  readonly errorCount: number;
  readonly rateLimitStatus: {
    readonly quotaRemaining?: number;
    readonly quotaResetTime?: Date;
  };
}

// Configuration interfaces
export interface GoogleWorkspaceConfig {
  readonly credentials: GoogleCredentials;
  readonly scopes: readonly string[];
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly quotaProject?: string;
}

export interface GoogleCredentials {
  readonly type: 'service_account' | 'oauth2';
  readonly clientEmail?: string;
  readonly privateKey?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly refreshToken?: string;
  readonly accessToken?: string;
}

// Utility interfaces for complex operations
export interface BatchUpdateRequest {
  readonly requests: readonly BatchUpdateRequestItem[];
  readonly includeSpreadsheetInResponse?: boolean;
  readonly responseRanges?: readonly string[];
  readonly responseIncludeGridData?: boolean;
}

export interface BatchUpdateRequestItem {
  readonly updateCells?: UpdateCellsRequest;
  readonly updateSheetProperties?: UpdateSheetPropertiesRequest;
  readonly addSheet?: AddSheetRequest;
  readonly deleteSheet?: DeleteSheetRequest;
  readonly mergeCells?: MergeCellsRequest;
  readonly unmergeCells?: UnmergeCellsRequest;
  readonly updateBorders?: UpdateBordersRequest;
  readonly repeatCell?: RepeatCellRequest;
  readonly autoResize?: AutoResizeDimensionsRequest;
  readonly sortRange?: SortRangeRequest;
  readonly setDataValidation?: SetDataValidationRequest;
  readonly setBasicFilter?: SetBasicFilterRequest;
  readonly clearBasicFilter?: ClearBasicFilterRequest;
}

// Factory functions for type safety
export const createGoogleWorkspaceServiceResponse = <T>(
  success: boolean,
  data?: T,
  error?: GoogleWorkspaceServiceError
): GoogleWorkspaceServiceResponse<T> => ({
  success,
  data,
  error,
  requestId: ulid()
});

export const createGoogleWorkspaceServiceError = (
  service: GoogleWorkspaceService,
  code: string,
  message: string,
  details?: Record<string, unknown>
): GoogleWorkspaceServiceError => ({
  id: ulid(),
  service,
  code,
  message,
  details,
  timestamp: new Date()
});

export const createCalendarEventParams = (
  summary: string,
  start: EventDateTime,
  end: EventDateTime,
  options?: Partial<CalendarEventParams>
): CalendarEventParams => ({
  summary,
  start,
  end,
  ...options
});

export const createSpreadsheetCreationParams = (
  title: string,
  options?: Partial<SpreadsheetCreationParams>
): SpreadsheetCreationParams => ({
  title,
  locale: 'en_US',
  timeZone: 'UTC',
  ...options
});

export const createDriveFileCreationParams = (
  name: string,
  options?: Partial<DriveFileCreationParams>
): DriveFileCreationParams => ({
  name,
  ...options
});

export const createSharingPermissions = (
  role: SharingPermissions['role'],
  type: SharingPermissions['type'],
  options?: Partial<SharingPermissions>
): SharingPermissions => ({
  role,
  type,
  allowFileDiscovery: true,
  sendNotificationEmail: true,
  ...options
});

// Type guards
export const isDriveFolder = (file: DriveFile): file is DriveFolder => {
  return file.mimeType === 'application/vnd.google-apps.folder';
};

export const isAllDayEvent = (event: CalendarEvent): boolean => {
  return !!event.start.date && !event.start.dateTime;
};

export const isTimedEvent = (event: CalendarEvent): boolean => {
  return !!event.start.dateTime && !event.start.date;
};

// Additional utility types for complex operations
export interface UpdateResult {
  readonly updatedRows: number;
  readonly updatedColumns: number;
  readonly updatedCells: number;
  readonly updatedData?: GridData;
}

export interface SearchFilters {
  readonly name?: string;
  readonly mimeType?: string;
  readonly parents?: readonly string[];
  readonly owners?: readonly string[];
  readonly modifiedTime?: {
    readonly after?: Date;
    readonly before?: Date;
  };
  readonly createdTime?: {
    readonly after?: Date;
    readonly before?: Date;
  };
  readonly starred?: boolean;
  readonly trashed?: boolean;
}

// Placeholder interfaces for complex types not fully defined
export interface NumberFormat {
  readonly type: string;
  readonly pattern?: string;
}

export interface Borders {
  readonly top?: Border;
  readonly bottom?: Border;
  readonly left?: Border;
  readonly right?: Border;
}

export interface Border {
  readonly style: string;
  readonly width?: number;
  readonly color?: Color;
}

export interface Padding {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

export interface TextFormat {
  readonly foregroundColor?: Color;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly strikethrough?: boolean;
  readonly underline?: boolean;
}

export interface TextRotation {
  readonly angle?: number;
  readonly vertical?: boolean;
}

export interface TextFormatRun {
  readonly startIndex?: number;
  readonly format?: TextFormat;
}

export interface ErrorValue {
  readonly type: string;
  readonly message?: string;
}

export interface DataValidationRule {
  readonly condition: BooleanCondition;
  readonly inputMessage?: string;
  readonly strict?: boolean;
  readonly showCustomUi?: boolean;
}

export interface BooleanCondition {
  readonly type: string;
  readonly values?: readonly ConditionValue[];
}

export interface ConditionValue {
  readonly relativeDate?: string;
  readonly userEnteredValue?: string;
}

export interface PivotTable {
  readonly source?: GridRange;
  readonly rows?: readonly PivotGroup[];
  readonly columns?: readonly PivotGroup[];
  readonly criteria?: Record<string, PivotFilterCriteria>;
  readonly filterSpecs?: readonly PivotFilterSpec[];
  readonly values?: readonly PivotValue[];
  readonly valueLayout?: string;
}

export interface PivotGroup {
  readonly sourceColumnOffset?: number;
  readonly showTotals?: boolean;
  readonly valueMetadata?: readonly PivotGroupValueMetadata[];
  readonly sortOrder?: string;
  readonly valueBucket?: PivotGroupSortValueBucket;
  readonly repeatHeadings?: boolean;
  readonly label?: string;
  readonly groupRule?: PivotGroupRule;
  readonly groupLimit?: PivotGroupLimit;
}

export interface PivotFilterCriteria {
  readonly visibleValues?: readonly string[];
  readonly condition?: BooleanCondition;
  readonly visibleByDefault?: boolean;
}

export interface PivotFilterSpec {
  readonly filterCriteria?: PivotFilterCriteria;
  readonly columnOffsetIndex?: number;
  readonly dataSourceColumnReference?: DataSourceColumnReference;
}

export interface PivotValue {
  readonly sourceColumnOffset?: number;
  readonly summarizeFunction?: string;
  readonly name?: string;
  readonly calculatedDisplayType?: string;
  readonly formula?: string;
}

export interface PivotGroupValueMetadata {
  readonly value?: ExtendedValue;
  readonly collapsed?: boolean;
}

export interface PivotGroupSortValueBucket {
  readonly valuesIndex?: number;
  readonly buckets?: readonly ExtendedValue[];
}

export interface PivotGroupRule {
  readonly manualRule?: ManualRule;
  readonly histogramRule?: HistogramRule;
  readonly dateTimeRule?: DateTimeRule;
}

export interface PivotGroupLimit {
  readonly countLimit?: number;
  readonly applyOrder?: number;
}

export interface ManualRule {
  readonly groups?: readonly ManualRuleGroup[];
}

export interface ManualRuleGroup {
  readonly groupName?: ExtendedValue;
  readonly items?: readonly ExtendedValue[];
}

export interface HistogramRule {
  readonly interval?: number;
  readonly start?: number;
  readonly end?: number;
}

export interface DateTimeRule {
  readonly type?: string;
}

export interface DataSourceColumnReference {
  readonly name?: string;
}

export interface DimensionProperties {
  readonly hiddenByFilter?: boolean;
  readonly hiddenByUser?: boolean;
  readonly pixelSize?: number;
  readonly developerMetadata?: readonly DeveloperMetadata[];
  readonly dataSourceColumnReference?: DataSourceColumnReference;
}

export interface DeveloperMetadata {
  readonly metadataId?: number;
  readonly metadataKey?: string;
  readonly metadataValue?: string;
  readonly location?: DeveloperMetadataLocation;
  readonly visibility?: string;
}

export interface DeveloperMetadataLocation {
  readonly locationType?: string;
  readonly spreadsheet?: boolean;
  readonly sheetId?: number;
  readonly dimensionRange?: DimensionRange;
}

export interface DimensionRange {
  readonly sheetId?: number;
  readonly dimension?: string;
  readonly startIndex?: number;
  readonly endIndex?: number;
}

export interface ConditionalFormatRule {
  readonly ranges?: readonly GridRange[];
  readonly booleanRule?: BooleanRule;
  readonly gradientRule?: GradientRule;
}

export interface BooleanRule {
  readonly condition?: BooleanCondition;
  readonly format?: CellFormat;
}

export interface GradientRule {
  readonly minpoint?: InterpolationPoint;
  readonly midpoint?: InterpolationPoint;
  readonly maxpoint?: InterpolationPoint;
}

export interface InterpolationPoint {
  readonly color?: Color;
  readonly type?: string;
  readonly value?: string;
}

export interface FilterView {
  readonly filterViewId?: number;
  readonly title?: string;
  readonly range?: GridRange;
  readonly namedRangeId?: string;
  readonly sortSpecs?: readonly SortSpec[];
  readonly criteria?: Record<string, FilterCriteria>;
}

export interface SortSpec {
  readonly dimensionIndex?: number;
  readonly sortOrder?: string;
  readonly foregroundColor?: Color;
  readonly backgroundColor?: Color;
  readonly dataSourceColumnReference?: DataSourceColumnReference;
}

export interface FilterCriteria {
  readonly hiddenValues?: readonly string[];
  readonly condition?: BooleanCondition;
  readonly visibleBackgroundColor?: Color;
  readonly visibleForegroundColor?: Color;
}

export interface ProtectedRange {
  readonly protectedRangeId?: number;
  readonly range?: GridRange;
  readonly namedRangeId?: string;
  readonly description?: string;
  readonly warningOnly?: boolean;
  readonly requestingUserCanEdit?: boolean;
  readonly unprotectedRanges?: readonly GridRange[];
  readonly editors?: Editors;
}

export interface Editors {
  readonly users?: readonly string[];
  readonly groups?: readonly string[];
  readonly domainUsersCanEdit?: boolean;
}

// Complex request types
export interface UpdateCellsRequest {
  readonly rows?: readonly RowData[];
  readonly fields?: string;
  readonly start?: GridCoordinate;
  readonly range?: GridRange;
}

export interface GridCoordinate {
  readonly sheetId?: number;
  readonly rowIndex?: number;
  readonly columnIndex?: number;
}

export interface UpdateSheetPropertiesRequest {
  readonly properties?: SheetProperties;
  readonly fields?: string;
}

export interface AddSheetRequest {
  readonly properties?: SheetProperties;
}

export interface DeleteSheetRequest {
  readonly sheetId?: number;
}

export interface MergeCellsRequest {
  readonly range?: GridRange;
  readonly mergeType?: string;
}

export interface UnmergeCellsRequest {
  readonly range?: GridRange;
}

export interface UpdateBordersRequest {
  readonly range?: GridRange;
  readonly top?: Border;
  readonly bottom?: Border;
  readonly left?: Border;
  readonly right?: Border;
  readonly innerHorizontal?: Border;
  readonly innerVertical?: Border;
}

export interface RepeatCellRequest {
  readonly range?: GridRange;
  readonly cell?: CellData;
  readonly fields?: string;
}

export interface AutoResizeDimensionsRequest {
  readonly dimensions?: DimensionRange;
  readonly dataSourceSheetDimensions?: DataSourceSheetDimensionRange;
}

export interface DataSourceSheetDimensionRange {
  readonly sheetId?: number;
  readonly columnReferences?: readonly DataSourceColumnReference[];
}

export interface SortRangeRequest {
  readonly range?: GridRange;
  readonly sortSpecs?: readonly SortSpec[];
}

export interface SetDataValidationRequest {
  readonly range?: GridRange;
  readonly rule?: DataValidationRule;
}

export interface SetBasicFilterRequest {
  readonly filter?: BasicFilter;
}

export interface BasicFilter {
  readonly range?: GridRange;
  readonly sortSpecs?: readonly SortSpec[];
  readonly criteria?: Record<string, FilterCriteria>;
  readonly filterSpecs?: readonly FilterSpec[];
}

export interface FilterSpec {
  readonly filterCriteria?: FilterCriteria;
  readonly columnIndex?: number;
  readonly dataSourceColumnReference?: DataSourceColumnReference;
}

export interface ClearBasicFilterRequest {
  readonly sheetId?: number;
} 