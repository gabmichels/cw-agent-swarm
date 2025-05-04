/**
 * API utility functions
 */

/**
 * Validate request parameters
 * @param params Parameters to validate
 * @param requiredParams List of required parameter names
 * @returns Validation result with errors if any
 */
export function validateRequestParams(
  params: Record<string, any>,
  requiredParams: string[] = []
) {
  const errors: string[] = [];
  
  // Check for required parameters
  for (const param of requiredParams) {
    if (params[param] === undefined || params[param] === null) {
      errors.push(`Required parameter '${param}' is missing`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    params
  };
}

/**
 * Parse query parameters with type conversion
 * @param url URL object with searchParams
 * @param paramConfig Parameter configuration
 * @returns Parsed parameters object
 */
export function parseQueryParams(
  url: URL,
  paramConfig: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'enum',
    defaultValue?: any,
    enumValues?: string[]
  }>
) {
  const params: Record<string, any> = {};
  
  for (const [key, config] of Object.entries(paramConfig)) {
    const value = url.searchParams.get(key);
    
    if (value === null && config.defaultValue !== undefined) {
      params[key] = config.defaultValue;
      continue;
    }
    
    if (value === null) {
      continue;
    }
    
    switch (config.type) {
      case 'string':
        params[key] = value;
        break;
        
      case 'number':
        params[key] = parseFloat(value);
        break;
        
      case 'boolean':
        params[key] = value === 'true';
        break;
        
      case 'array':
        params[key] = value.split(',').map(v => v.trim());
        break;
        
      case 'enum':
        if (config.enumValues && config.enumValues.includes(value)) {
          params[key] = value;
        } else if (config.defaultValue !== undefined) {
          params[key] = config.defaultValue;
        }
        break;
    }
  }
  
  return params;
} 