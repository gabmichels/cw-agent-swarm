import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';
import { WorkflowExecutionError } from '../../../types/workflow';

// === Parameter Parser Interface ===

export interface IWorkflowParameterParser {
  // Parameter Processing
  parseParameters(rawInput: string, workflowId: string): Promise<ParsedParameters>;
  validateParameters(parameters: Record<string, unknown>, schema?: ParameterSchema): Promise<ValidationResult>;
  suggestParameters(workflowId: string, context?: ParameterContext): Promise<ParameterSuggestion[]>;

  // Type Conversion
  convertValue(value: unknown, targetType: ParameterType): unknown;
  extractParametersFromText(text: string): Record<string, unknown>;
}

// === Supporting Types ===

export interface ParsedParameters {
  readonly parsed: Record<string, unknown>;
  readonly suggestions: ParameterSuggestion[];
  readonly warnings: string[];
  readonly confidence: number;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: string[];
  readonly normalizedParameters: Record<string, unknown>;
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly severity: 'error' | 'warning';
}

export interface ParameterSchema {
  readonly fields: Record<string, FieldSchema>;
  readonly required: string[];
  readonly optional: string[];
}

export interface FieldSchema {
  readonly type: ParameterType;
  readonly description?: string;
  readonly defaultValue?: unknown;
  readonly validation?: FieldValidation;
  readonly suggestions?: string[];
}

export interface FieldValidation {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly allowedValues?: unknown[];
}

export interface ParameterSuggestion {
  readonly field: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly reason: string;
}

export interface ParameterContext {
  readonly userId?: string;
  readonly previousExecutions?: Record<string, unknown>[];
  readonly userPreferences?: Record<string, unknown>;
  readonly availableIntegrations?: string[];
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'url'
  | 'date'
  | 'json'
  | 'array'
  | 'object';

// === Parameter Parser Implementation ===

export class WorkflowParameterParser implements IWorkflowParameterParser {
  private readonly serviceName = 'WorkflowParameterParser';
  private readonly logger = logger;

  // Common parameter patterns for extraction
  private readonly parameterPatterns = new Map<string, RegExp>([
    ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
    ['url', /https?:\/\/[^\s]+/g],
    ['phone', /\+?[\d\s\-\(\)]{10,}/g],
    ['date', /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g],
    ['number', /\b\d+(\.\d+)?\b/g],
    ['boolean', /\b(true|false|yes|no|on|off)\b/gi]
  ]);

  constructor() { }

  // === Parameter Processing ===

  async parseParameters(rawInput: string, workflowId: string): Promise<ParsedParameters> {
    const parseId = ulid();

    this.logger.debug(`[${this.serviceName}] Parsing parameters`, {
      parseId,
      workflowId,
      inputLength: rawInput.length
    });

    try {
      // 1. Try to parse as JSON first
      let parsed: Record<string, unknown> = {};
      let confidence = 0.5;
      const warnings: string[] = [];

      try {
        parsed = JSON.parse(rawInput);
        confidence = 0.9;
        this.logger.debug(`[${this.serviceName}] Successfully parsed as JSON`, { parseId });
      } catch {
        // 2. If not JSON, extract parameters from natural language
        parsed = this.extractParametersFromText(rawInput);
        confidence = 0.6;
        warnings.push('Parameters extracted from natural language - please verify accuracy');
        this.logger.debug(`[${this.serviceName}] Extracted from natural language`, { parseId });
      }

      // 3. Generate suggestions based on workflow
      const suggestions = await this.suggestParameters(workflowId, {
        previousExecutions: []
      });

      // 4. Apply suggestions to fill missing common parameters
      const enhancedParsed = this.applyParameterSuggestions(parsed, suggestions);

      const result: ParsedParameters = {
        parsed: enhancedParsed,
        suggestions,
        warnings,
        confidence
      };

      this.logger.debug(`[${this.serviceName}] Parameter parsing completed`, {
        parseId,
        parametersCount: Object.keys(enhancedParsed).length,
        confidence,
        warningsCount: warnings.length
      });

      return result;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to parse parameters`, {
        parseId,
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to parse workflow parameters',
        undefined,
        { workflowId, rawInput: rawInput.substring(0, 100), originalError: error }
      );
    }
  }

  async validateParameters(
    parameters: Record<string, unknown>,
    schema?: ParameterSchema
  ): Promise<ValidationResult> {
    const validationId = ulid();

    this.logger.debug(`[${this.serviceName}] Validating parameters`, {
      validationId,
      parametersCount: Object.keys(parameters).length,
      hasSchema: !!schema
    });

    try {
      const errors: ValidationError[] = [];
      const warnings: string[] = [];
      const normalizedParameters: Record<string, unknown> = { ...parameters };

      if (schema) {
        // 1. Check required fields
        for (const requiredField of schema.required) {
          if (!(requiredField in parameters) || parameters[requiredField] == null) {
            errors.push({
              field: requiredField,
              message: `Required field '${requiredField}' is missing`,
              code: 'REQUIRED_FIELD_MISSING',
              severity: 'error'
            });
          }
        }

        // 2. Validate field types and constraints
        for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
          const value = parameters[fieldName];

          if (value != null) {
            const fieldValidation = this.validateField(fieldName, value, fieldSchema);
            errors.push(...fieldValidation.errors);
            warnings.push(...fieldValidation.warnings);

            if (fieldValidation.normalizedValue !== undefined) {
              normalizedParameters[fieldName] = fieldValidation.normalizedValue;
            }
          }
        }

        // 3. Check for unexpected fields
        for (const fieldName of Object.keys(parameters)) {
          if (!(fieldName in schema.fields)) {
            warnings.push(`Unexpected field '${fieldName}' - will be passed as-is`);
          }
        }
      } else {
        // 4. Basic validation without schema
        for (const [fieldName, value] of Object.entries(parameters)) {
          const basicValidation = this.performBasicValidation(fieldName, value);
          warnings.push(...basicValidation.warnings);

          if (basicValidation.normalizedValue !== undefined) {
            normalizedParameters[fieldName] = basicValidation.normalizedValue;
          }
        }
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        normalizedParameters
      };

      this.logger.debug(`[${this.serviceName}] Parameter validation completed`, {
        validationId,
        isValid: result.isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return result;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to validate parameters`, {
        validationId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to validate workflow parameters',
        undefined,
        { parameters, originalError: error }
      );
    }
  }

  async suggestParameters(
    workflowId: string,
    context: ParameterContext = {}
  ): Promise<ParameterSuggestion[]> {
    this.logger.debug(`[${this.serviceName}] Generating parameter suggestions`, {
      workflowId,
      hasContext: Object.keys(context).length > 0
    });

    try {
      const suggestions: ParameterSuggestion[] = [];

      // 1. Common workflow parameter suggestions based on workflow type
      const workflowType = this.inferWorkflowType(workflowId);

      switch (workflowType) {
        case 'email':
          suggestions.push(
            {
              field: 'to',
              value: context.userPreferences?.defaultEmail || 'user@example.com',
              confidence: 0.7,
              reason: 'Common email workflow parameter'
            },
            {
              field: 'subject',
              value: 'Notification from Workflow',
              confidence: 0.6,
              reason: 'Default email subject'
            }
          );
          break;

        case 'notification':
          suggestions.push(
            {
              field: 'channel',
              value: '#general',
              confidence: 0.6,
              reason: 'Common notification channel'
            },
            {
              field: 'message',
              value: 'Workflow notification',
              confidence: 0.5,
              reason: 'Default notification message'
            }
          );
          break;

        case 'data-sync':
          suggestions.push(
            {
              field: 'source',
              value: 'database',
              confidence: 0.5,
              reason: 'Common data source'
            },
            {
              field: 'target',
              value: 'api',
              confidence: 0.5,
              reason: 'Common data target'
            }
          );
          break;
      }

      // 2. User-specific suggestions based on previous executions
      if (context.previousExecutions && context.previousExecutions.length > 0) {
        const commonParams = this.extractCommonParameters(context.previousExecutions);

        for (const [field, value] of Object.entries(commonParams)) {
          suggestions.push({
            field,
            value,
            confidence: 0.8,
            reason: 'Previously used value'
          });
        }
      }

      this.logger.debug(`[${this.serviceName}] Generated ${suggestions.length} parameter suggestions`, {
        workflowId,
        workflowType
      });

      return suggestions;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to generate parameter suggestions`, {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // === Type Conversion ===

  convertValue(value: unknown, targetType: ParameterType): unknown {
    if (value == null) return value;

    try {
      switch (targetType) {
        case 'string':
          return String(value);

        case 'number':
          const num = Number(value);
          if (isNaN(num)) throw new Error(`Cannot convert '${value}' to number`);
          return num;

        case 'boolean':
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', 'yes', 'on', '1'].includes(lower)) return true;
            if (['false', 'no', 'off', '0'].includes(lower)) return false;
          }
          throw new Error(`Cannot convert '${value}' to boolean`);

        case 'email':
          const email = String(value);
          if (!this.parameterPatterns.get('email')?.test(email)) {
            throw new Error(`Invalid email format: ${email}`);
          }
          return email;

        case 'url':
          const url = String(value);
          if (!this.parameterPatterns.get('url')?.test(url)) {
            throw new Error(`Invalid URL format: ${url}`);
          }
          return url;

        case 'date':
          if (value instanceof Date) return value;
          const date = new Date(String(value));
          if (isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
          return date;

        case 'json':
          if (typeof value === 'object') return value;
          return JSON.parse(String(value));

        case 'array':
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) return parsed;
            } catch {
              // If not JSON, split by comma
              return value.split(',').map(item => item.trim());
            }
          }
          throw new Error(`Cannot convert '${value}' to array`);

        case 'object':
          if (typeof value === 'object' && !Array.isArray(value)) return value;
          if (typeof value === 'string') return JSON.parse(value);
          throw new Error(`Cannot convert '${value}' to object`);

        default:
          return value;
      }
    } catch (error) {
      this.logger.warn(`[${this.serviceName}] Type conversion failed`, {
        value,
        targetType,
        error: error instanceof Error ? error.message : String(error)
      });
      return value; // Return original value if conversion fails
    }
  }

  extractParametersFromText(text: string): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};

    // Extract common patterns
    for (const [type, pattern] of this.parameterPatterns.entries()) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        if (matches.length === 1) {
          extracted[type] = matches[0];
        } else {
          extracted[`${type}s`] = matches;
        }
      }
    }

    // Extract key-value pairs (e.g., "to: user@example.com", "subject: Hello")
    const kvPattern = /(\w+):\s*([^,\n]+)/g;
    let match;
    while ((match = kvPattern.exec(text)) !== null) {
      const [, key, value] = match;
      extracted[key.toLowerCase()] = value.trim();
    }

    // Extract quoted strings as potential values
    const quotedPattern = /"([^"]+)"|'([^']+)'/g;
    const quotedValues: string[] = [];
    while ((match = quotedPattern.exec(text)) !== null) {
      quotedValues.push(match[1] || match[2]);
    }

    if (quotedValues.length > 0) {
      extracted['quoted_values'] = quotedValues;
    }

    return extracted;
  }

  // === Private Helper Methods ===

  private validateField(
    fieldName: string,
    value: unknown,
    schema: FieldSchema
  ): { errors: ValidationError[]; warnings: string[]; normalizedValue?: unknown } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let normalizedValue: unknown = undefined;

    try {
      // Type conversion
      normalizedValue = this.convertValue(value, schema.type);

      // Validation constraints
      if (schema.validation) {
        const validation = schema.validation;

        if (validation.pattern && typeof normalizedValue === 'string') {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(normalizedValue)) {
            errors.push({
              field: fieldName,
              message: `Value does not match required pattern: ${validation.pattern}`,
              code: 'PATTERN_MISMATCH',
              severity: 'error'
            });
          }
        }

        if (validation.minLength && typeof normalizedValue === 'string') {
          if (normalizedValue.length < validation.minLength) {
            errors.push({
              field: fieldName,
              message: `Value too short. Minimum length: ${validation.minLength}`,
              code: 'MIN_LENGTH',
              severity: 'error'
            });
          }
        }

        if (validation.maxLength && typeof normalizedValue === 'string') {
          if (normalizedValue.length > validation.maxLength) {
            errors.push({
              field: fieldName,
              message: `Value too long. Maximum length: ${validation.maxLength}`,
              code: 'MAX_LENGTH',
              severity: 'error'
            });
          }
        }

        if (validation.allowedValues && !validation.allowedValues.includes(normalizedValue)) {
          errors.push({
            field: fieldName,
            message: `Invalid value. Allowed values: ${validation.allowedValues.join(', ')}`,
            code: 'INVALID_VALUE',
            severity: 'error'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: fieldName,
        message: `Type conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        code: 'TYPE_CONVERSION_ERROR',
        severity: 'error'
      });
    }

    return { errors, warnings, normalizedValue };
  }

  private performBasicValidation(
    fieldName: string,
    value: unknown
  ): { warnings: string[]; normalizedValue?: unknown } {
    const warnings: string[] = [];
    let normalizedValue: unknown = undefined;

    // Basic type detection and warnings
    if (typeof value === 'string') {
      if (fieldName.toLowerCase().includes('email') && !this.parameterPatterns.get('email')?.test(value)) {
        warnings.push(`Field '${fieldName}' might not be a valid email address`);
      }

      if (fieldName.toLowerCase().includes('url') && !this.parameterPatterns.get('url')?.test(value)) {
        warnings.push(`Field '${fieldName}' might not be a valid URL`);
      }

      // Try to convert obvious numbers
      if (fieldName.toLowerCase().includes('count') || fieldName.toLowerCase().includes('number')) {
        const num = Number(value);
        if (!isNaN(num)) {
          normalizedValue = num;
          warnings.push(`Converted '${fieldName}' to number`);
        }
      }
    }

    return { warnings, normalizedValue };
  }

  private inferWorkflowType(workflowId: string): string {
    const id = workflowId.toLowerCase();

    if (id.includes('email') || id.includes('mail')) return 'email';
    if (id.includes('notification') || id.includes('notify') || id.includes('alert')) return 'notification';
    if (id.includes('sync') || id.includes('data') || id.includes('transfer')) return 'data-sync';
    if (id.includes('slack') || id.includes('teams') || id.includes('discord')) return 'messaging';
    if (id.includes('webhook') || id.includes('http') || id.includes('api')) return 'webhook';

    return 'general';
  }

  private extractCommonParameters(executions: Record<string, unknown>[]): Record<string, unknown> {
    const paramCounts = new Map<string, Map<unknown, number>>();

    // Count parameter values across executions
    for (const execution of executions) {
      for (const [key, value] of Object.entries(execution)) {
        if (!paramCounts.has(key)) {
          paramCounts.set(key, new Map());
        }
        const valueCounts = paramCounts.get(key)!;
        valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
      }
    }

    // Extract most common values
    const commonParams: Record<string, unknown> = {};
    for (const [key, valueCounts] of paramCounts.entries()) {
      let mostCommonValue: unknown = null;
      let maxCount = 0;

      for (const [value, count] of valueCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonValue = value;
        }
      }

      // Only suggest if used in at least 50% of executions
      if (maxCount >= executions.length * 0.5) {
        commonParams[key] = mostCommonValue;
      }
    }

    return commonParams;
  }

  private applyParameterSuggestions(
    parsed: Record<string, unknown>,
    suggestions: ParameterSuggestion[]
  ): Record<string, unknown> {
    const enhanced = { ...parsed };

    for (const suggestion of suggestions) {
      // Only apply suggestions for missing parameters with high confidence
      if (!(suggestion.field in enhanced) && suggestion.confidence >= 0.7) {
        enhanced[suggestion.field] = suggestion.value;
      }
    }

    return enhanced;
  }
} 