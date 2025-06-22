/**
 * Microsoft Outlook Integration Tests
 * 
 * Comprehensive test suite for the Microsoft Outlook integration service
 * following IMPLEMENTATION_GUIDELINES.md testing standards.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { 
  MicrosoftOutlookIntegration,
  OutlookConfig,
  OutlookEmailParams,
  OutlookAuthenticationError,
  OutlookIntegrationError,
  createMicrosoftOutlookIntegration
} from '../MicrosoftOutlookIntegration';
import { WorkflowValidationError } from '../../errors/ExternalWorkflowErrors';

// Mock the logger
vi.mock('../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('MicrosoftOutlookIntegration', () => {
  let outlookIntegration: MicrosoftOutlookIntegration;
  let mockConfig: OutlookConfig;
  let mockHttpClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
      redirectUri: 'https://example.com/callback',
      scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read']
    };

    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    outlookIntegration = new MicrosoftOutlookIntegration(mockConfig, mockHttpClient);
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with valid configuration', () => {
      expect(outlookIntegration).toBeInstanceOf(MicrosoftOutlookIntegration);
    });

    it('should throw WorkflowValidationError for missing required config', () => {
      const invalidConfig = {
        clientId: '',
        clientSecret: 'test-secret',
        tenantId: 'test-tenant',
        redirectUri: 'https://example.com/callback',
        scopes: []
      };

      expect(() => new MicrosoftOutlookIntegration(invalidConfig)).toThrow(WorkflowValidationError);
      expect(() => new MicrosoftOutlookIntegration(invalidConfig)).toThrow('Missing required Outlook configuration');
    });

    it('should create instance using factory function', () => {
      const integration = createMicrosoftOutlookIntegration(mockConfig);
      expect(integration).toBeInstanceOf(MicrosoftOutlookIntegration);
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      } as Response);

      const result = await outlookIntegration.authenticate();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://login.microsoftonline.com/${mockConfig.tenantId}/oauth2/v2.0/token`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
    });

    it('should throw OutlookAuthenticationError for invalid credentials', async () => {
      const mockErrorResponse = {
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockErrorResponse)
      } as Response);

      await expect(outlookIntegration.authenticate()).rejects.toThrow(OutlookAuthenticationError);
      await expect(outlookIntegration.authenticate()).rejects.toThrow('Authentication failed');
    });

    it('should handle network errors during authentication', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(outlookIntegration.authenticate()).rejects.toThrow(OutlookAuthenticationError);
    });
  });

  describe('Connection Testing', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await outlookIntegration.authenticate();
    });

    it('should test connection successfully', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        id: 'test-user-id',
        displayName: 'Test User'
      });

      const result = await outlookIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      );
    });

    it('should return false for failed connection test', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await outlookIntegration.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Email Operations', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await outlookIntegration.authenticate();
    });

    describe('sendEmail', () => {
      const validEmailParams: OutlookEmailParams = {
        to: ['recipient@example.com'],
        subject: 'Test Email',
        body: 'This is a test email',
        bodyType: 'text',
        importance: 'normal'
      };

      it('should send email successfully', async () => {
        const mockResponse = {
          id: 'test-message-id',
          sentDateTime: new Date().toISOString()
        };

        mockHttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await outlookIntegration.sendEmail(validEmailParams);

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.sentDateTime).toBeInstanceOf(Date);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/sendMail',
          expect.objectContaining({
            message: expect.objectContaining({
              subject: validEmailParams.subject,
              body: expect.objectContaining({
                contentType: validEmailParams.bodyType,
                content: validEmailParams.body
              }),
              toRecipients: expect.arrayContaining([
                expect.objectContaining({
                  emailAddress: { address: 'recipient@example.com' }
                })
              ])
            })
          }),
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should validate email parameters', async () => {
        const invalidParams = {
          ...validEmailParams,
          to: [], // Empty recipients
          subject: '', // Empty subject
          body: '' // Empty body
        };

        const result = await outlookIntegration.sendEmail(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Email must have at least one recipient');
      });

      it('should validate email addresses', async () => {
        const invalidParams = {
          ...validEmailParams,
          to: ['invalid-email']
        };

        const result = await outlookIntegration.sendEmail(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid email address');
      });

      it('should handle email sending errors', async () => {
        mockHttpClient.post.mockRejectedValueOnce(new Error('Send failed'));

        const result = await outlookIntegration.sendEmail(validEmailParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Send failed');
      });

      it('should send email with attachments', async () => {
        const emailWithAttachments: OutlookEmailParams = {
          ...validEmailParams,
          attachments: [{
            name: 'test.txt',
            contentType: 'text/plain',
            contentBytes: Buffer.from('test content').toString('base64'),
            size: 12
          }]
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: 'test-message-id',
          sentDateTime: new Date().toISOString()
        });

        const result = await outlookIntegration.sendEmail(emailWithAttachments);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/sendMail',
          expect.objectContaining({
            message: expect.objectContaining({
              attachments: expect.arrayContaining([
                expect.objectContaining({
                  '@odata.type': '#microsoft.graph.fileAttachment',
                  name: 'test.txt',
                  contentType: 'text/plain'
                })
              ])
            })
          }),
          expect.any(Object)
        );
      });

      it('should send email with CC and BCC recipients', async () => {
        const emailWithCcBcc: OutlookEmailParams = {
          ...validEmailParams,
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com']
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: 'test-message-id',
          sentDateTime: new Date().toISOString()
        });

        const result = await outlookIntegration.sendEmail(emailWithCcBcc);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/sendMail',
          expect.objectContaining({
            message: expect.objectContaining({
              ccRecipients: expect.arrayContaining([
                expect.objectContaining({
                  emailAddress: { address: 'cc@example.com' }
                })
              ]),
              bccRecipients: expect.arrayContaining([
                expect.objectContaining({
                  emailAddress: { address: 'bcc@example.com' }
                })
              ])
            })
          }),
          expect.any(Object)
        );
      });
    });

    describe('getInboxMessages', () => {
      it('should retrieve inbox messages successfully', async () => {
        const mockMessages = {
          value: [
            {
              id: 'message-1',
              subject: 'Test Message 1',
              bodyPreview: 'Preview 1',
              from: {
                emailAddress: {
                  name: 'Sender 1',
                  address: 'sender1@example.com'
                }
              },
              sentDateTime: new Date().toISOString(),
              receivedDateTime: new Date().toISOString(),
              hasAttachments: false,
              importance: 'normal',
              isRead: false,
              conversationId: 'conv-1',
              webLink: 'https://outlook.com/message-1'
            }
          ]
        };

        mockHttpClient.get.mockResolvedValueOnce(mockMessages);

        const result = await outlookIntegration.getInboxMessages({ top: 10 });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'message-1',
          subject: 'Test Message 1',
          from: {
            name: 'Sender 1',
            address: 'sender1@example.com'
          }
        });
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should handle query parameters correctly', async () => {
        mockHttpClient.get.mockResolvedValueOnce({ value: [] });

        await outlookIntegration.getInboxMessages({
          top: 5,
          skip: 10,
          filter: "isRead eq false"
        });

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=5&$skip=10&$filter=isRead%20eq%20false',
          expect.any(Object)
        );
      });

      it('should throw OutlookIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('API Error'));

        await expect(outlookIntegration.getInboxMessages()).rejects.toThrow(OutlookIntegrationError);
      });
    });

    describe('getMailFolders', () => {
      it('should retrieve mail folders successfully', async () => {
        const mockFolders = {
          value: [
            {
              id: 'folder-1',
              displayName: 'Inbox',
              childFolderCount: 2,
              unreadItemCount: 5,
              totalItemCount: 100,
              isHidden: false
            }
          ]
        };

        mockHttpClient.get.mockResolvedValueOnce(mockFolders);

        const result = await outlookIntegration.getMailFolders();

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'folder-1',
          displayName: 'Inbox',
          childFolderCount: 2,
          unreadItemCount: 5,
          totalItemCount: 100,
          isHidden: false
        });
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/mailFolders',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw OutlookIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('API Error'));

        await expect(outlookIntegration.getMailFolders()).rejects.toThrow(OutlookIntegrationError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_request',
          error_description: 'The request is missing a required parameter'
        })
      } as Response);

      await expect(outlookIntegration.authenticate()).rejects.toThrow(OutlookAuthenticationError);
    });

    it('should handle rate limiting', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('HTTP 429: Too Many Requests'));

      await expect(outlookIntegration.testConnection()).resolves.toBe(false);
    });

    it('should handle network timeouts', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      await expect(outlookIntegration.testConnection()).resolves.toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should handle token expiration', async () => {
      // Mock initial authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'initial-token',
          expires_in: 1 // Expires in 1 second
        })
      } as Response);

      await outlookIntegration.authenticate();

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Mock re-authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          expires_in: 3600
        })
      } as Response);

      mockHttpClient.get.mockResolvedValueOnce({ id: 'test-user' });

      const result = await outlookIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial auth + re-auth
    });
  });

  describe('Data Mapping', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await outlookIntegration.authenticate();
    });

    it('should map message data correctly', async () => {
      const mockApiMessage = {
        id: 'msg-123',
        subject: 'Test Subject',
        bodyPreview: 'Preview text',
        body: {
          contentType: 'html',
          content: '<p>HTML content</p>'
        },
        from: {
          emailAddress: {
            name: 'John Doe',
            address: 'john@example.com'
          }
        },
        toRecipients: [
          {
            emailAddress: {
              name: 'Jane Doe',
              address: 'jane@example.com'
            }
          }
        ],
        sentDateTime: '2023-12-01T10:00:00Z',
        receivedDateTime: '2023-12-01T10:01:00Z',
        hasAttachments: true,
        importance: 'high',
        isRead: true,
        conversationId: 'conv-123',
        webLink: 'https://outlook.com/msg-123'
      };

      mockHttpClient.get.mockResolvedValueOnce({
        value: [mockApiMessage]
      });

      const result = await outlookIntegration.getInboxMessages();

      expect(result[0]).toMatchObject({
        id: 'msg-123',
        subject: 'Test Subject',
        bodyPreview: 'Preview text',
        body: {
          contentType: 'html',
          content: '<p>HTML content</p>'
        },
        from: {
          name: 'John Doe',
          address: 'john@example.com'
        },
        toRecipients: [
          {
            name: 'Jane Doe',
            address: 'jane@example.com'
          }
        ],
        hasAttachments: true,
        importance: 'high',
        isRead: true,
        conversationId: 'conv-123',
        webLink: 'https://outlook.com/msg-123'
      });
      expect(result[0].sentDateTime).toBeInstanceOf(Date);
      expect(result[0].receivedDateTime).toBeInstanceOf(Date);
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockApiMessage = {
        id: 'msg-123',
        // Missing optional fields
      };

      mockHttpClient.get.mockResolvedValueOnce({
        value: [mockApiMessage]
      });

      const result = await outlookIntegration.getInboxMessages();

      expect(result[0]).toMatchObject({
        id: 'msg-123',
        subject: '',
        bodyPreview: '',
        body: {
          contentType: 'text',
          content: ''
        },
        from: {
          name: '',
          address: ''
        },
        toRecipients: [],
        hasAttachments: false,
        importance: 'normal',
        isRead: false,
        conversationId: '',
        webLink: ''
      });
    });
  });
}); 