import { describe, it, expect } from 'vitest';
import { GoogleEmailCapabilities } from '../../src/services/workspace/capabilities/google/GoogleEmailCapabilities';
import { GoogleCalendarCapabilities } from '../../src/services/workspace/capabilities/google/GoogleCalendarCapabilities';
import { GoogleSheetsCapabilities } from '../../src/services/workspace/capabilities/google/GoogleSheetsCapabilities';
import { GoogleDriveCapabilities } from '../../src/services/workspace/capabilities/google/GoogleDriveCapabilities';
import { EmailCapabilities } from '../../src/services/workspace/capabilities/EmailCapabilities';
import { CalendarCapabilities } from '../../src/services/workspace/capabilities/CalendarCapabilities';
import { SheetsCapabilities } from '../../src/services/workspace/capabilities/SheetsCapabilities';
import { DriveCapabilities } from '../../src/services/workspace/capabilities/DriveCapabilities';
import { IEmailCapabilities } from '../../src/services/workspace/capabilities/interfaces/IEmailCapabilities';
import { ICalendarCapabilities } from '../../src/services/workspace/capabilities/interfaces/ICalendarCapabilities';
import { ISheetsCapabilities } from '../../src/services/workspace/capabilities/interfaces/ISheetsCapabilities';
import { IDriveCapabilities } from '../../src/services/workspace/capabilities/interfaces/IDriveCapabilities';

describe('Google Provider Implementations', () => {
  describe('GoogleEmailCapabilities', () => {
    let googleEmail: GoogleEmailCapabilities;

    beforeEach(() => {
      googleEmail = new GoogleEmailCapabilities();
    });

    it('should extend EmailCapabilities', () => {
      expect(googleEmail).toBeInstanceOf(EmailCapabilities);
    });

    it('should implement IEmailCapabilities interface', () => {
      // Check that all required interface methods exist
      expect(typeof googleEmail.readSpecificEmail).toBe('function');
      expect(typeof googleEmail.findImportantEmails).toBe('function');
      expect(typeof googleEmail.searchEmails).toBe('function');
      expect(typeof googleEmail.sendEmail).toBe('function');
      expect(typeof googleEmail.replyToEmail).toBe('function');
      expect(typeof googleEmail.forwardEmail).toBe('function');
      expect(typeof googleEmail.analyzeEmails).toBe('function');
      expect(typeof googleEmail.getEmailsNeedingAttention).toBe('function');
      expect(typeof googleEmail.getActionItems).toBe('function');
      expect(typeof googleEmail.getEmailTrends).toBe('function');
    });

    it('should have correct constructor name', () => {
      expect(googleEmail.constructor.name).toBe('GoogleEmailCapabilities');
    });
  });

  describe('GoogleCalendarCapabilities', () => {
    let googleCalendar: GoogleCalendarCapabilities;

    beforeEach(() => {
      googleCalendar = new GoogleCalendarCapabilities();
    });

    it('should extend CalendarCapabilities', () => {
      expect(googleCalendar).toBeInstanceOf(CalendarCapabilities);
    });

    it('should implement ICalendarCapabilities interface', () => {
      // Check that all required interface methods exist
      expect(typeof googleCalendar.readCalendar).toBe('function');
      expect(typeof googleCalendar.findAvailability).toBe('function');
      expect(typeof googleCalendar.scheduleEvent).toBe('function');
      expect(typeof googleCalendar.summarizeDay).toBe('function');
      expect(typeof googleCalendar.findEvents).toBe('function');
      expect(typeof googleCalendar.editCalendarEntry).toBe('function');
      expect(typeof googleCalendar.deleteCalendarEntry).toBe('function');
    });

    it('should have correct constructor name', () => {
      expect(googleCalendar.constructor.name).toBe('GoogleCalendarCapabilities');
    });
  });

  describe('GoogleSheetsCapabilities', () => {
    let googleSheets: GoogleSheetsCapabilities;

    beforeEach(() => {
      googleSheets = new GoogleSheetsCapabilities();
    });

    it('should extend SheetsCapabilities', () => {
      expect(googleSheets).toBeInstanceOf(SheetsCapabilities);
    });

    it('should implement ISheetsCapabilities interface', () => {
      // Check that all required interface methods exist
      expect(typeof googleSheets.createSpreadsheet).toBe('function');
      expect(typeof googleSheets.readRange).toBe('function');
      expect(typeof googleSheets.updateCells).toBe('function');
      expect(typeof googleSheets.analyzeData).toBe('function');
      expect(typeof googleSheets.createExpenseTracker).toBe('function');
    });

    it('should have correct constructor name', () => {
      expect(googleSheets.constructor.name).toBe('GoogleSheetsCapabilities');
    });
  });

  describe('GoogleDriveCapabilities', () => {
    let googleDrive: GoogleDriveCapabilities;

    beforeEach(() => {
      googleDrive = new GoogleDriveCapabilities();
    });

    it('should extend DriveCapabilities', () => {
      expect(googleDrive).toBeInstanceOf(DriveCapabilities);
    });

    it('should implement IDriveCapabilities interface', () => {
      // Check that all required interface methods exist
      expect(typeof googleDrive.searchFiles).toBe('function');
      expect(typeof googleDrive.getFile).toBe('function');
      expect(typeof googleDrive.createFile).toBe('function');
      expect(typeof googleDrive.shareFile).toBe('function');
      expect(typeof googleDrive.createFolder).toBe('function');
      expect(typeof googleDrive.deleteFile).toBe('function');
      expect(typeof googleDrive.getStorageQuota).toBe('function');
    });

    it('should have correct constructor name', () => {
      expect(googleDrive.constructor.name).toBe('GoogleDriveCapabilities');
    });
  });

  describe('Interface Compliance', () => {
    it('should ensure all Google providers implement their respective interfaces', () => {
      const emailProvider: IEmailCapabilities = new GoogleEmailCapabilities();
      const calendarProvider: ICalendarCapabilities = new GoogleCalendarCapabilities();
      const sheetsProvider: ISheetsCapabilities = new GoogleSheetsCapabilities();
      const driveProvider: IDriveCapabilities = new GoogleDriveCapabilities();

      // If these assignments work without TypeScript errors, the interfaces are properly implemented
      expect(emailProvider).toBeDefined();
      expect(calendarProvider).toBeDefined();
      expect(sheetsProvider).toBeDefined();
      expect(driveProvider).toBeDefined();
    });
  });
}); 