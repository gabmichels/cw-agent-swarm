import { CustomError, StandardErrorCodes } from './CustomError';

/**
 * Error codes specific to API operations
 */
export const ApiErrorCodes = {
  // Standard HTTP error codes
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED', 
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  
  // API-specific error codes
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  MISSING_REQUIRED_PARAMETER: 'MISSING_REQUIRED_PARAMETER',
  INVALID_PARAMETER_VALUE: 'INVALID_PARAMETER_VALUE',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  OPERATION_TIMED_OUT: 'OPERATION_TIMED_OUT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  THIRD_PARTY_API_ERROR: 'THIRD_PARTY_API_ERROR',
  
  // Client errors
  CLIENT_DISCONNECTED: 'CLIENT_DISCONNECTED',
  CLIENT_TIMEOUT: 'CLIENT_TIMEOUT',
  INVALID_REQUEST_FORMAT: 'INVALID_REQUEST_FORMAT',
  
  // Auth errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT'
} as const;

export type ApiErrorCode = typeof ApiErrorCodes[keyof typeof ApiErrorCodes];

/**
 * Map HTTP status codes to API error codes
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  400: ApiErrorCodes.BAD_REQUEST,
  401: ApiErrorCodes.UNAUTHORIZED,
  403: ApiErrorCodes.FORBIDDEN,
  404: ApiErrorCodes.NOT_FOUND,
  405: ApiErrorCodes.METHOD_NOT_ALLOWED,
  409: ApiErrorCodes.CONFLICT,
  410: ApiErrorCodes.GONE,
  422: ApiErrorCodes.UNPROCESSABLE_ENTITY,
  429: ApiErrorCodes.RATE_LIMIT_EXCEEDED,
  500: ApiErrorCodes.INTERNAL_SERVER_ERROR,
  503: ApiErrorCodes.API_UNAVAILABLE
};

/**
 * Map API error codes to HTTP status codes
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ApiErrorCode, number> = {
  [ApiErrorCodes.BAD_REQUEST]: 400,
  [ApiErrorCodes.UNAUTHORIZED]: 401,
  [ApiErrorCodes.FORBIDDEN]: 403,
  [ApiErrorCodes.NOT_FOUND]: 404,
  [ApiErrorCodes.METHOD_NOT_ALLOWED]: 405,
  [ApiErrorCodes.CONFLICT]: 409,
  [ApiErrorCodes.GONE]: 410,
  [ApiErrorCodes.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCodes.TOO_MANY_REQUESTS]: 429,
  [ApiErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  
  [ApiErrorCodes.SCHEMA_VALIDATION_FAILED]: 400,
  [ApiErrorCodes.MISSING_REQUIRED_PARAMETER]: 400,
  [ApiErrorCodes.INVALID_PARAMETER_VALUE]: 400,
  [ApiErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ApiErrorCodes.OPERATION_TIMED_OUT]: 408,
  [ApiErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ApiErrorCodes.API_UNAVAILABLE]: 503,
  [ApiErrorCodes.THIRD_PARTY_API_ERROR]: 502,
  
  [ApiErrorCodes.CLIENT_DISCONNECTED]: 499,
  [ApiErrorCodes.CLIENT_TIMEOUT]: 408,
  [ApiErrorCodes.INVALID_REQUEST_FORMAT]: 400,
  
  [ApiErrorCodes.TOKEN_EXPIRED]: 401,
  [ApiErrorCodes.INVALID_TOKEN]: 401,
  [ApiErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  
  [ApiErrorCodes.DATABASE_ERROR]: 500,
  [ApiErrorCodes.TRANSACTION_FAILED]: 500,
  [ApiErrorCodes.QUERY_TIMEOUT]: 504
};

/**
 * Interface for additional API error details
 */
export interface ApiErrorDetails {
  path?: string;
  method?: string;
  request?: {
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    headers?: Record<string, string>;
    body?: any;
    status?: number;
  };
  validation?: {
    field?: string;
    message?: string;
    constraints?: Record<string, string>;
  }[];
  [key: string]: any;
}

/**
 * Specialized error class for API-related errors
 */
export class ApiError extends CustomError {
  /**
   * HTTP status code associated with this error
   */
  statusCode: number;
  
  /**
   * Create a new API error
   */
  constructor(
    message: string,
    code: ApiErrorCode = ApiErrorCodes.INTERNAL_SERVER_ERROR,
    details?: ApiErrorDetails,
    originalError?: Error
  ) {
    super(message, code, details, originalError);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.statusCode = ERROR_CODE_TO_HTTP_STATUS[code] || 500;
  }

  /**
   * Create an error from an HTTP response
   */
  static fromResponse(
    response: Response,
    responseBody?: any,
    message?: string
  ): ApiError {
    const statusCode = response.status;
    const errorCode = HTTP_STATUS_TO_ERROR_CODE[statusCode] || ApiErrorCodes.INTERNAL_SERVER_ERROR;
    
    const details: ApiErrorDetails = {
      path: response.url,
      response: {
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        body: responseBody
      }
    };
    
    return new ApiError(
      message || `API request failed with status: ${response.status} ${response.statusText}`,
      errorCode,
      details
    );
  }

  /**
   * Create a bad request error
   */
  static badRequest(message: string, details?: ApiErrorDetails): ApiError {
    return new ApiError(message, ApiErrorCodes.BAD_REQUEST, details);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message: string, details?: ApiErrorDetails): ApiError {
    return new ApiError(message, ApiErrorCodes.UNAUTHORIZED, details);
  }

  /**
   * Create a not found error
   */
  static notFound(message: string, details?: ApiErrorDetails): ApiError {
    return new ApiError(message, ApiErrorCodes.NOT_FOUND, details);
  }

  /**
   * Create a validation error with field validation details
   */
  static validation(message: string, validationErrors?: Record<string, string>, details?: ApiErrorDetails): ApiError {
    const fullDetails: ApiErrorDetails = { ...details };
    
    if (validationErrors) {
      fullDetails.validation = Object.entries(validationErrors).map(([field, message]) => ({
        field,
        message,
        constraints: { error: message }
      }));
    }
    
    return new ApiError(message, ApiErrorCodes.SCHEMA_VALIDATION_FAILED, fullDetails);
  }

  /**
   * Create a rate limit exceeded error
   */
  static rateLimit(message: string, resetTime?: Date, details?: ApiErrorDetails): ApiError {
    return new ApiError(
      message,
      ApiErrorCodes.RATE_LIMIT_EXCEEDED,
      { 
        ...details,
        resetTime: resetTime?.toISOString()
      }
    );
  }
} 