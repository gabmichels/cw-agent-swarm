/**
 * DateTimeService.test.ts
 * 
 * Unit tests for the DateTimeService
 */

import { DateTimeService, dateTime } from '../../../src/services/datetime/DateTimeService';
import { BasicDateTimeProcessor } from '../../../src/lib/scheduler/implementations/datetime/BasicDateTimeProcessor';

describe('DateTimeService', () => {
  // Reference date for consistent testing
  const referenceDate = new Date('2023-06-15T12:00:00Z');

  describe('Singleton pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = DateTimeService.getInstance();
      const instance2 = DateTimeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should expose a pre-initialized dateTime export', () => {
      expect(dateTime).toBeInstanceOf(DateTimeService);
      expect(dateTime).toBe(DateTimeService.getInstance());
    });
  });

  describe('parse method', () => {
    it('should return the same Date object when passed a Date', () => {
      const date = new Date();
      expect(dateTime.parse(date)).toBe(date);
    });

    it('should parse a timestamp number', () => {
      const timestamp = referenceDate.getTime();
      const result = dateTime.parse(timestamp);
      expect(result?.getTime()).toBe(timestamp);
    });

    it('should parse an ISO date string', () => {
      const isoString = '2023-06-15T12:00:00Z';
      const result = dateTime.parse(isoString);
      expect(result?.toISOString()).toBe(isoString);
    });

    it('should parse natural language expressions', () => {
      // Mock the DateTimeProcessor
      const mockProcessor = {
        parseNaturalLanguage: jest.fn().mockReturnValue(new Date('2023-06-16T12:00:00Z')),
        formatDate: jest.fn(),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const result = dateTime.parse('tomorrow', referenceDate);
      expect(mockProcessor.parseNaturalLanguage).toHaveBeenCalledWith('tomorrow', referenceDate);
      expect(result).toBeInstanceOf(Date);
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });

    it('should return null for invalid date strings', () => {
      const result = dateTime.parse('not a date');
      expect(result).toBeNull();
    });
  });

  describe('format method', () => {
    it('should format a date using the processor', () => {
      // Mock the DateTimeProcessor
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn().mockReturnValue('2023-06-15'),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const result = dateTime.format(referenceDate, 'YYYY-MM-DD');
      expect(mockProcessor.formatDate).toHaveBeenCalledWith(referenceDate, 'YYYY-MM-DD');
      expect(result).toBe('2023-06-15');
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('getRelativeTime method', () => {
    it('should get relative time using the processor', () => {
      // Mock the DateTimeProcessor
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn(),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn().mockReturnValue('1 day ago')
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const pastDate = new Date('2023-06-14T12:00:00Z');
      const result = dateTime.getRelativeTime(pastDate, referenceDate);
      expect(mockProcessor.getHumanReadableInterval).toHaveBeenCalledWith(referenceDate, pastDate);
      expect(result).toBe('1 day ago');
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('hasPassed method', () => {
    it('should check if a date has passed using the processor', () => {
      // Mock the DateTimeProcessor
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn(),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn().mockReturnValue(true),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const pastDate = new Date('2023-06-14T12:00:00Z');
      const result = dateTime.hasPassed(pastDate, referenceDate);
      expect(mockProcessor.hasPassed).toHaveBeenCalledWith(pastDate, referenceDate);
      expect(result).toBe(true);
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('translateVagueTerm method', () => {
    it('should translate vague terms using the processor', () => {
      // Mock the DateTimeProcessor
      const mockResult = { date: new Date(), priority: 10 };
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn(),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn().mockReturnValue(mockResult),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const result = dateTime.translateVagueTerm('urgent', referenceDate);
      expect(mockProcessor.translateVagueTerm).toHaveBeenCalledWith('urgent', referenceDate);
      expect(result).toBe(mockResult);
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('calculateInterval method', () => {
    it('should calculate an interval using the processor', () => {
      // Mock the DateTimeProcessor
      const tomorrow = new Date('2023-06-16T12:00:00Z');
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn(),
        calculateInterval: jest.fn().mockReturnValue(tomorrow),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn(),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const result = dateTime.calculateInterval(referenceDate, '1 day');
      expect(mockProcessor.calculateInterval).toHaveBeenCalledWith(referenceDate, '1 day');
      expect(result).toBe(tomorrow);
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('isSameDay method', () => {
    it('should check if two dates are on the same day using the processor', () => {
      // Mock the DateTimeProcessor
      const mockProcessor = {
        parseNaturalLanguage: jest.fn(),
        formatDate: jest.fn(),
        calculateInterval: jest.fn(),
        hasPassed: jest.fn(),
        translateVagueTerm: jest.fn(),
        generateCronExpression: jest.fn(),
        getNextExecutionFromCron: jest.fn(),
        isSameDay: jest.fn().mockReturnValue(true),
        getHumanReadableInterval: jest.fn()
      };
      
      // Access the private processor and replace it
      const service = DateTimeService.getInstance();
      const originalProcessor = (service as any).processor;
      (service as any).processor = mockProcessor;
      
      const date1 = new Date('2023-06-15T10:00:00Z');
      const date2 = new Date('2023-06-15T14:00:00Z');
      const result = dateTime.isSameDay(date1, date2);
      expect(mockProcessor.isSameDay).toHaveBeenCalledWith(date1, date2);
      expect(result).toBe(true);
      
      // Restore the original processor
      (service as any).processor = originalProcessor;
    });
  });

  describe('getProcessor method', () => {
    it('should return the underlying DateTimeProcessor', () => {
      const processor = dateTime.getProcessor();
      expect(processor).toBeInstanceOf(BasicDateTimeProcessor);
    });
  });
}); 