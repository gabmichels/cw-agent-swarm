import { IEmailCapabilities } from '../interfaces/IEmailCapabilities';
import { EmailCapabilities } from '../EmailCapabilities';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance } from 'axios';
import { 
  SendEmailParams, 
  EmailResult, 
  EmailQuery, 
  Email, 
  EmailMessage,
  EmailAttachment 
} from '../../types/EmailTypes';

/**
 * Zoho Mail Capabilities Implementation
 * Extends the existing EmailCapabilities to implement Zoho-specific functionality
 */
export class ZohoEmailCapabilities extends EmailCapabilities implements IEmailCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    super(connectionId);
    this.zohoProvider = zohoProvider;
  }

  /**
   * Send email using Zoho Mail API
   */
  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      const client = await this.zohoProvider.getAuthenticatedClient(this.connectionId);
      
      // Build email content for Zoho Mail API
      const emailData = {
        fromAddress: params.from || await this.getDefaultFromAddress(client),
        toAddress: Array.isArray(params.to) ? params.to.join(',') : params.to,
        ccAddress: params.cc ? (Array.isArray(params.cc) ? params.cc.join(',') : params.cc) : undefined,
        bccAddress: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc) : undefined,
        subject: params.subject,
        content: params.body || params.html || '',
        mailFormat: params.html ? 'html' : 'plaintext',
        askReceipt: params.requestReadReceipt ? 'yes' : 'no'
      };

      // Handle attachments if present
      if (params.attachments && params.attachments.length > 0) {
        // For Zoho Mail, attachments need to be uploaded first
        const attachmentIds = await this.uploadAttachments(client, params.attachments);
        emailData['attachments'] = attachmentIds.join(',');
      }

      // Send email via Zoho Mail API
      const response = await client.post('/mail/v1/accounts/primary/messages', emailData);

      if (response.data.status?.code === 200) {
        return {
          success: true,
          id: response.data.data?.messageId || response.data.messageId,
          message: 'Email sent successfully via Zoho Mail'
        };
      } else {
        throw new Error(response.data.status?.description || 'Failed to send email');
      }
    } catch (error) {
      console.error('Zoho email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email via Zoho Mail'
      };
    }
  }

  /**
   * Read emails using Zoho Mail API
   */
  async readEmails(query: EmailQuery): Promise<Email[]> {
    try {
      const client = await this.zohoProvider.getAuthenticatedClient(this.connectionId);
      
      // Build query parameters for Zoho Mail API
      const params: any = {
        limit: query.maxResults || 50,
        start: query.pageToken ? parseInt(query.pageToken) : 0
      };

      // Add search criteria
      if (query.q) {
        params.searchKey = query.q;
      }

      if (query.labelIds && query.labelIds.length > 0) {
        // Map common labels to Zoho folder names
        const folderMap: Record<string, string> = {
          'INBOX': 'Inbox',
          'SENT': 'Sent',
          'DRAFT': 'Drafts',
          'SPAM': 'Spam',
          'TRASH': 'Trash'
        };
        params.folder = folderMap[query.labelIds[0]] || query.labelIds[0];
      }

      // Get messages from Zoho Mail
      const response = await client.get('/mail/v1/accounts/primary/messages', { params });

      if (response.data.status?.code !== 200) {
        throw new Error(response.data.status?.description || 'Failed to fetch emails');
      }

      const messages = response.data.data || [];
      
      // Convert Zoho messages to our Email format
      const emails: Email[] = await Promise.all(
        messages.map(async (msg: any) => this.convertZohoMessageToEmail(client, msg))
      );

      return emails;
    } catch (error) {
      console.error('Zoho email read error:', error);
      throw new Error(`Failed to read emails from Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific email by ID
   */
  async getEmail(emailId: string): Promise<Email> {
    try {
      const client = await this.zohoProvider.getAuthenticatedClient(this.connectionId);
      
      const response = await client.get(`/mail/v1/accounts/primary/messages/${emailId}`);

      if (response.data.status?.code !== 200) {
        throw new Error(response.data.status?.description || 'Failed to fetch email');
      }

      return this.convertZohoMessageToEmail(client, response.data.data);
    } catch (error) {
      console.error('Zoho get email error:', error);
      throw new Error(`Failed to get email from Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Zoho message format to our Email format
   */
  private async convertZohoMessageToEmail(client: AxiosInstance, zohoMsg: any): Promise<Email> {
    const email: Email = {
      id: zohoMsg.messageId || zohoMsg.mid,
      threadId: zohoMsg.conversationId || zohoMsg.cid,
      labelIds: [zohoMsg.folder || 'INBOX'],
      snippet: zohoMsg.summary || zohoMsg.content?.substring(0, 200) || '',
      payload: {
        partId: '',
        mimeType: zohoMsg.mailFormat === 'html' ? 'text/html' : 'text/plain',
        filename: '',
        headers: [
          { name: 'From', value: zohoMsg.fromAddress || zohoMsg.sender },
          { name: 'To', value: zohoMsg.toAddress || zohoMsg.recipient },
          { name: 'Subject', value: zohoMsg.subject || '' },
          { name: 'Date', value: zohoMsg.receivedTime || zohoMsg.sentTime || new Date().toISOString() }
        ],
        body: {
          size: zohoMsg.content?.length || 0,
          data: zohoMsg.content || ''
        },
        parts: []
      },
      sizeEstimate: zohoMsg.content?.length || 0,
      historyId: zohoMsg.messageId || zohoMsg.mid,
      internalDate: zohoMsg.receivedTime || zohoMsg.sentTime || new Date().toISOString()
    };

    // Add CC and BCC if present
    if (zohoMsg.ccAddress) {
      email.payload.headers.push({ name: 'Cc', value: zohoMsg.ccAddress });
    }
    if (zohoMsg.bccAddress) {
      email.payload.headers.push({ name: 'Bcc', value: zohoMsg.bccAddress });
    }

    // Handle attachments
    if (zohoMsg.attachments && zohoMsg.attachments.length > 0) {
      email.payload.parts = zohoMsg.attachments.map((att: any) => ({
        partId: att.attachmentId || att.aid,
        mimeType: att.contentType || 'application/octet-stream',
        filename: att.attachmentName || att.name || 'attachment',
        headers: [
          { name: 'Content-Type', value: att.contentType || 'application/octet-stream' },
          { name: 'Content-Disposition', value: `attachment; filename="${att.attachmentName || att.name}"` }
        ],
        body: {
          attachmentId: att.attachmentId || att.aid,
          size: att.size || 0
        }
      }));
    }

    return email;
  }

  /**
   * Upload attachments to Zoho Mail
   */
  private async uploadAttachments(client: AxiosInstance, attachments: EmailAttachment[]): Promise<string[]> {
    const attachmentIds: string[] = [];

    for (const attachment of attachments) {
      try {
        const formData = new FormData();
        
        if (attachment.content) {
          // Handle base64 content
          const buffer = Buffer.from(attachment.content, 'base64');
          formData.append('file', buffer, attachment.filename);
        } else if (attachment.path) {
          // Handle file path (would need fs.createReadStream in real implementation)
          throw new Error('File path attachments not yet implemented for Zoho');
        }

        const uploadResponse = await client.post('/mail/v1/accounts/primary/attachments', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (uploadResponse.data.status?.code === 200) {
          attachmentIds.push(uploadResponse.data.data?.attachmentId);
        }
      } catch (error) {
        console.warn(`Failed to upload attachment ${attachment.filename}:`, error);
      }
    }

    return attachmentIds;
  }

  /**
   * Get default from address for the account
   */
  private async getDefaultFromAddress(client: AxiosInstance): Promise<string> {
    try {
      const response = await client.get('/mail/v1/accounts/primary');
      return response.data.data?.emailAddress || response.data.data?.accountName || '';
    } catch (error) {
      console.warn('Failed to get default from address:', error);
      return '';
    }
  }

  /**
   * Build email content in Zoho Mail format
   */
  buildEmailContent(params: SendEmailParams): string {
    const headers = [
      `From: ${params.from || 'noreply@example.com'}`,
      `To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`,
      `Subject: ${params.subject || '(No Subject)'}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).substr(2, 9)}@zoho-agent>`,
      `MIME-Version: 1.0`
    ];

    if (params.cc) {
      headers.push(`Cc: ${Array.isArray(params.cc) ? params.cc.join(', ') : params.cc}`);
    }

    if (params.bcc) {
      headers.push(`Bcc: ${Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc}`);
    }

    if (params.html) {
      headers.push(`Content-Type: text/html; charset=UTF-8`);
    } else {
      headers.push(`Content-Type: text/plain; charset=UTF-8`);
    }

    const body = params.html || params.body || '';
    
    return headers.join('\r\n') + '\r\n\r\n' + body;
  }
}
