/**
 * Object Utilities
 * 
 * This module provides utility functions for working with objects.
 */

/**
 * Deep merge objects
 * 
 * @param target Target object
 * @param source Source object to merge into target
 * @returns Merged object
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  // Return source if target is not an object
  if (target === null || typeof target !== 'object') {
    return source as T;
  }
  
  // Create a copy of the target
  const result: Record<string, any> = { ...target };
  
  // If source is not an object, return target
  if (source === null || typeof source !== 'object') {
    return target;
  }
  
  // Merge properties
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = (target as any)[key];
      
      // Deep merge if both values are objects
      if (
        targetValue !== null && 
        typeof targetValue === 'object' &&
        sourceValue !== null && 
        typeof sourceValue === 'object' &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } 
      // Handle arrays (replace rather than merge)
      else if (Array.isArray(sourceValue)) {
        result[key] = [...sourceValue];
      }
      // For other values, source overwrites target
      else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
  }
  
  return result as T;
}

/**
 * Pick specific properties from an object
 * 
 * @param obj Source object
 * @param keys Keys to pick
 * @returns New object with only the picked properties
 */
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific properties from an object
 * 
 * @param obj Source object
 * @param keys Keys to omit
 * @returns New object without the omitted properties
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as Omit<T, K>;
  
  for (const key of keys) {
    delete (result as any)[key];
  }
  
  return result;
} 