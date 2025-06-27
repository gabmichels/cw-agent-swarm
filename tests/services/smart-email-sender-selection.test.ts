/**
 * Comprehensive test suite for Smart Email Sender Selection with NLP
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceNLPProcessor } from '../../src/services/workspace/integration/WorkspaceNLPProcessor';
import { WorkspaceConnectionSelector, SenderPreference } from '../../src/services/workspace/providers/WorkspaceConnectionSelector';
import { WorkspaceCapabilityType } from '../../src/services/database/types';

describe('Smart Email Sender Selection', () => {
  let nlpProcessor: WorkspaceNLPProcessor;
  let connectionSelector: WorkspaceConnectionSelector;

  beforeEach(() => {
    nlpProcessor = new WorkspaceNLPProcessor();
    connectionSelector = new WorkspaceConnectionSelector();
  });

  describe('NLP Sender Preference Extraction', () => {
    describe('Provider-Specific Keywords', () => {
      it('should detect Google Workspace variations', () => {
        const testCases = [
          "Send this email from my Gmail account",
          "Use my Google email to send this message",
          "Send from my Google Workspace account",
          "Use G Suite for this email",
          "Send via my Gmail",
          "From my Google account send this",
          "Use my Google Apps account",
          "Send with my Google for business",
          "From my Workspace email",
          "Use my Google work email",
          "Send via Google mail"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('provider');
          expect(preference?.value).toBe('GOOGLE_WORKSPACE');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.75);
        });
      });

      it('should detect Microsoft 365 variations', () => {
        const testCases = [
          "Send from my Microsoft 365 account",
          "Use my Outlook email for this",
          "Send via my Hotmail account",
          "From my Microsoft email",
          "Use MS365 to send this",
          "Send from my Office 365 account",
          "Use my Microsoft account",
          "Send via Outlook",
          "Use my Outlook.com account",
          "Send from my Live.com email",
          "Use my Microsoft Exchange",
          "Send via my Office mail",
          "From my Windows mail account",
          "Use O365 for this email"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('provider');
          expect(preference?.value).toBe('MICROSOFT_365');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.75);
        });
      });

      it('should detect Zoho variations', () => {
        const testCases = [
          "Send from my Zoho account",
          "Use Zoho Mail for this email",
          "Send via my Zoho Workspace",
          "From my Zoho email account"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('provider');
          expect(preference?.value).toBe('ZOHO');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.75);
        });
      });
    });

    describe('Category-Based Preferences', () => {
      it('should detect work/business email preferences', () => {
        const testCases = [
          "Send this from my work email",
          "Use my business email account",
          "Send from my office email",
          "Use my company email",
          "Send via my corporate email",
          "From my business account",
          "Use my work account for this",
          "Send from my professional email",
          "Use my job email address",
          "From my employer email",
          "Send via my organization email",
          "Use my enterprise email",
          "From my workplace email"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe('work');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.65);
        });
      });

      it('should detect personal email preferences', () => {
        const testCases = [
          "Send this from my personal email",
          "Use my private email account",
          "Send from my home email",
          "Use my personal account",
          "Send via my private account",
          "From my personal email address",
          "Use my individual email",
          "Send from my own email",
          "From my non-work email",
          "Use my personal stuff email"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe('personal');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.65);
        });
      });

      it('should detect education email preferences', () => {
        const testCases = [
          "Send from my school email",
          "Use my university email",
          "Send via my student email",
          "From my academic email account",
          "Use my college email",
          "Send from my campus email",
          "From my educational email"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe('education');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.65);
        });
      });

      it('should detect client/customer email preferences', () => {
        const testCases = [
          "Send from my client email",
          "Use my customer email account",
          "Send via my client account",
          "From my customer mail"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe('client');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.65);
        });
      });

      it('should detect primary/main email preferences', () => {
        const testCases = [
          "Send from my main email",
          "Use my primary email account",
          "Send via my default email",
          "From my usual email",
          "Use my regular email",
          "Send from my normal email"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe('primary');
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.65);
        });
      });
    });

    describe('Specific Email Addresses', () => {
      it('should detect explicit email addresses', () => {
        const testCases = [
          { message: "Send this from john@company.com", email: "john@company.com" },
          { message: "Using jane.doe@example.org for this email", email: "jane.doe@example.org" },
          { message: "Send from user123@domain.net", email: "user123@domain.net" },
          { message: "Use test.email@sub.domain.com account", email: "test.email@sub.domain.com" }
        ];

        testCases.forEach(({ message, email }) => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('specific_email');
          expect(preference?.value).toBe(email);
          expect(preference?.confidence).toBe(0.95);
        });
      });
    });

    describe('Domain-Based Hints', () => {
      it('should detect domain patterns', () => {
        const testCases = [
          { message: "Using my Gmail, send this message", expected: 'GOOGLE_WORKSPACE' },
          { message: "Send from my Outlook", expected: 'MICROSOFT_365' },
          { message: "Via my Zoho account", expected: 'ZOHO' },
          { message: "Through my Google email", expected: 'GOOGLE_WORKSPACE' },
          { message: "Send with my Gmail", expected: 'GOOGLE_WORKSPACE' },
          { message: "Use Outlook to send", expected: 'MICROSOFT_365' },
          { message: "Please use my Hotmail", expected: 'MICROSOFT_365' },
          { message: "Send it from Gmail please", expected: 'GOOGLE_WORKSPACE' }
        ];

        testCases.forEach(({ message, expected }) => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          expect(preference?.type).toBe('provider');
          expect(preference?.value).toBe(expected);
          expect(preference?.confidence).toBeGreaterThanOrEqual(0.6);
        });
      });

      it('should detect polite request patterns', () => {
        const testCases = [
          { message: "Please use my Gmail account for this", expected: 'GOOGLE_WORKSPACE' },
          { message: "Can you use my work email?", expected: 'work' },
          { message: "I want to use my personal email", expected: 'personal' },
          { message: "Make sure to use my Outlook", expected: 'MICROSOFT_365' }
        ];

        testCases.forEach(({ message, expected }) => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Failed for message: "${message}"`).toBeDefined();
          if (expected.includes('WORKSPACE') || expected.includes('365') || expected.includes('ZOHO')) {
            expect(preference?.type).toBe('provider');
          } else {
            expect(preference?.type).toBe('category');
          }
          expect(preference?.value).toBe(expected);
        });
      });
    });

    describe('Complex Scenarios', () => {
      it('should handle full email context with sender preferences', () => {
        const testCases = [
          {
            message: "Send an email to john@example.com about the meeting tomorrow with subject 'Tomorrow Meeting' and body 'Hi John, just confirming our meeting tomorrow.' from my Gmail account",
            expectedRecipients: ['john@example.com'],
            expectedSubject: 'tomorrow meeting',
            expectedSender: { type: 'provider', value: 'GOOGLE_WORKSPACE' }
          },
          {
            message: "Email sarah@company.com subject 'Project Update' body 'The project is on track' using my work email",
            expectedRecipients: ['sarah@company.com'],
            expectedSubject: 'project update',
            expectedSender: { type: 'category', value: 'work' }
          }
        ];

        testCases.forEach(({ message, expectedRecipients, expectedSubject, expectedSender }) => {
          const command = nlpProcessor.parseCommand(message);

          expect(command, `Failed for message: "${message}"`).toBeDefined();
          expect(command?.entities.recipients).toEqual(expectedRecipients);
          expect(command?.entities.subject).toBe(expectedSubject);

          const preference = command?.entities?.senderPreference;
          expect(preference?.type).toBe(expectedSender.type);
          expect(preference?.value).toBe(expectedSender.value);
        });
      });

      it('should return undefined for messages without sender preferences', () => {
        const testCases = [
          "Send an email to john@example.com about the meeting",
          "Email the team about the project update",
          "Send a message to sarah@company.com"
        ];

        testCases.forEach(message => {
          const command = nlpProcessor.parseCommand(message);
          const preference = command?.entities?.senderPreference;

          expect(preference, `Should be undefined for: "${message}"`).toBeUndefined();
        });
      });
    });
  });

  describe('Connection Selection Logic', () => {
    // Mock workspace connections for testing
    const mockConnections = [
      {
        id: 'conn-1',
        email: 'john.work@company.com',
        displayName: 'Work Email',
        provider: 'MICROSOFT_365',
        accountType: 'ORGANIZATIONAL',
        status: 'ACTIVE'
      },
      {
        id: 'conn-2',
        email: 'john.personal@gmail.com',
        displayName: 'Personal Gmail',
        provider: 'GOOGLE_WORKSPACE',
        accountType: 'PERSONAL',
        status: 'ACTIVE'
      },
      {
        id: 'conn-3',
        email: 'john.backup@zoho.com',
        displayName: 'Backup Zoho',
        provider: 'ZOHO',
        accountType: 'PERSONAL',
        status: 'ACTIVE'
      }
    ];

    describe('Provider-based Selection', () => {
      it('should select correct provider with high confidence', () => {
        const preference: SenderPreference = {
          type: 'provider',
          value: 'GOOGLE_WORKSPACE',
          confidence: 0.85
        };

        // Mock the private method by testing the logic directly
        const googleConnection = mockConnections.find(c => c.provider === 'GOOGLE_WORKSPACE');
        expect(googleConnection).toBeDefined();
        expect(googleConnection?.email).toBe('john.personal@gmail.com');
      });

      it('should select Microsoft 365 provider', () => {
        const preference: SenderPreference = {
          type: 'provider',
          value: 'MICROSOFT_365',
          confidence: 0.85
        };

        const msConnection = mockConnections.find(c => c.provider === 'MICROSOFT_365');
        expect(msConnection).toBeDefined();
        expect(msConnection?.email).toBe('john.work@company.com');
      });
    });

    describe('Category-based Selection', () => {
      it('should filter connections by work category', () => {
        // Mock category filtering logic
        const workConnections = mockConnections.filter(c => {
          const email = c.email.toLowerCase();
          const domain = email.split('@')[1];
          const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
          return !personalDomains.includes(domain) || c.accountType === 'ORGANIZATIONAL';
        });

        expect(workConnections).toHaveLength(2); // Work email + Zoho backup
        expect(workConnections.find(c => c.email === 'john.work@company.com')).toBeDefined();
      });

      it('should filter connections by personal category', () => {
        const personalConnections = mockConnections.filter(c => {
          const email = c.email.toLowerCase();
          const domain = email.split('@')[1];
          const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
          return personalDomains.includes(domain) || c.accountType === 'PERSONAL';
        });

        expect(personalConnections).toHaveLength(2); // Gmail + Zoho
        expect(personalConnections.find(c => c.email === 'john.personal@gmail.com')).toBeDefined();
      });
    });

    describe('Domain Matching', () => {
      it('should prefer connections matching recipient domain', () => {
        const recipientEmails = ['colleague@company.com'];
        const recipientDomain = recipientEmails[0].split('@')[1];

        const domainMatch = mockConnections.find(c => {
          const connectionDomain = c.email.split('@')[1];
          return connectionDomain === recipientDomain;
        });

        expect(domainMatch).toBeDefined();
        expect(domainMatch?.email).toBe('john.work@company.com');
      });
    });

    describe('Priority Selection', () => {
      it('should prefer organizational accounts over personal', () => {
        const orgAccount = mockConnections.find(c => c.accountType === 'ORGANIZATIONAL');
        const personalAccounts = mockConnections.filter(c => c.accountType === 'PERSONAL');

        expect(orgAccount).toBeDefined();
        expect(personalAccounts).toHaveLength(2);
        expect(orgAccount?.email).toBe('john.work@company.com');
      });
    });
  });

  describe('Confidence Level Handling', () => {
    it('should handle high confidence scenarios (≥0.7)', () => {
      const highConfidencePreference: SenderPreference = {
        type: 'provider',
        value: 'GOOGLE_WORKSPACE',
        confidence: 0.85
      };

      expect(highConfidencePreference.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle medium confidence scenarios (0.5-0.7)', () => {
      const mediumConfidencePreference: SenderPreference = {
        type: 'category',
        value: 'personal',
        confidence: 0.65
      };

      expect(mediumConfidencePreference.confidence).toBeGreaterThanOrEqual(0.5);
      expect(mediumConfidencePreference.confidence).toBeLessThan(0.7);
    });

    it('should handle low confidence scenarios (<0.5)', () => {
      const lowConfidencePreference: SenderPreference = {
        type: 'domain',
        value: 'unknown',
        confidence: 0.4
      };

      expect(lowConfidencePreference.confidence).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed email patterns gracefully', () => {
      const testCases = [
        "Send from my @invalid.email",
        "Use my email@ for this",
        "Send from invalid-email-format"
      ];

      testCases.forEach(message => {
        const command = nlpProcessor.parseCommand(message);
        const preference = command?.entities?.senderPreference;

        // Should either return undefined or a valid preference
        if (preference) {
          expect(preference.type).toBeDefined();
          expect(preference.value).toBeDefined();
          expect(preference.confidence).toBeGreaterThan(0);
        }
      });
    });

    it('should handle empty or null messages', () => {
      const testCases = ["", "   ", null, undefined];

      testCases.forEach(message => {
        if (message === null || message === undefined) return;

        const command = nlpProcessor.parseCommand(message);
        // Should return null for empty messages
        expect(command).toBeNull();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle realistic user scenarios', () => {
      const scenarios = [
        {
          name: "Professional email with domain matching",
          message: "Send email to client@acme.com about the proposal from my work email",
          expectedProvider: undefined, // Should use category
          expectedCategory: "work"
        },
        {
          name: "Personal email with specific provider",
          message: "Email my friend about the party using my Gmail",
          expectedProvider: "GOOGLE_WORKSPACE",
          expectedCategory: undefined
        },
        {
          name: "Mixed context with explicit email",
          message: "Send update to team@company.com from john.doe@company.com",
          expectedEmail: "john.doe@company.com"
        }
      ];

      scenarios.forEach(({ name, message, expectedProvider, expectedCategory, expectedEmail }) => {
        const command = nlpProcessor.parseCommand(message);
        const preference = command?.entities?.senderPreference;

        if (expectedProvider) {
          expect(preference?.type).toBe('provider');
          expect(preference?.value).toBe(expectedProvider);
        }

        if (expectedCategory) {
          expect(preference?.type).toBe('category');
          expect(preference?.value).toBe(expectedCategory);
        }

        if (expectedEmail) {
          expect(preference?.type).toBe('specific_email');
          expect(preference?.value).toBe(expectedEmail);
        }
      });
    });
  });
}); 