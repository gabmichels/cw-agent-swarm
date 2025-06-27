import { IEmailCapabilities } from '../interfaces/IEmailCapabilities';
import { EmailCapabilities, EmailMessage, EmailAttachment, SendEmailParams } from '../EmailCapabilities';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { AxiosInstance } from 'axios';
import { FileService } from '../../../../lib/storage/FileService';
import { StorageProvider } from '../../../../lib/storage/StorageService';
import FormData from 'form-data';

// Local interfaces for Zoho-specific functionality
interface EmailResult {
  success: boolean;
  id?: string;
  message: string;
}

interface EmailQuery {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
}

interface Email {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    body: {
      size: number;
      data?: string;
      attachmentId?: string;
    };
    parts?: any[];
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

/**
 * Zoho-specific attachment upload response
 */
interface ZohoAttachmentUploadResponse {
  status: {
    code: number;
    description: string;
  };
  data: Array<{
    storeName: string;
    attachmentName: string;
    attachmentPath: string;
    url?: string; // Only present for inline attachments
  }>;
}

/**
 * Zoho attachment metadata for email sending
 */
interface ZohoAttachmentMetadata {
  storeName: string;
  attachmentName: string;
  attachmentPath: string;
}

/**
 * Zoho Mail Capabilities Implementation
 * Extends the existing EmailCapabilities to implement Zoho-specific functionality
 */
export class ZohoEmailCapabilities extends EmailCapabilities implements IEmailCapabilities {
  private zohoProvider: ZohoWorkspaceProvider;
  private connectionId: string;
  private fileService: FileService;

  constructor(connectionId: string, zohoProvider: ZohoWorkspaceProvider) {
    super();
    this.connectionId = connectionId;
    this.zohoProvider = zohoProvider;

    // Initialize FileService with environment-based configuration
    this.fileService = new FileService({
      storageProvider: (process.env.STORAGE_PROVIDER as StorageProvider) || StorageProvider.LOCAL,
      bucket: process.env.STORAGE_BUCKET || 'email-attachments',
      gcpProjectId: process.env.GCP_PROJECT_ID,
      gcpKeyFilename: process.env.GCP_KEY_FILENAME,
      minioEndpoint: process.env.MINIO_ENDPOINT,
      minioAccessKey: process.env.MINIO_ACCESS_KEY,
      minioSecretKey: process.env.MINIO_SECRET_KEY,
      azureAccountName: process.env.AZURE_ACCOUNT_NAME,
      azureAccountKey: process.env.AZURE_ACCOUNT_KEY
    });
  }

  /**
   * Send email using Zoho Mail API - implements IEmailCapabilities
   */
  async sendEmail(params: SendEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    const result = await this.sendZohoEmail(params);

    // Convert result to EmailMessage format expected by interface
    return {
      id: result.id || 'unknown',
      threadId: result.id || 'unknown',
      from: params.to[0] || '', // Zoho doesn't return full message details
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      date: new Date(),
      isRead: false,
      isImportant: false,
      labels: [],
      attachments: []
    };
  }

  /**
   * Internal Zoho email sending method
   */
  private async sendZohoEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');

      // Get account ID first
      const accountId = await this.getAccountId(client);

      // Handle attachments if present
      let zohoAttachments: ZohoAttachmentMetadata[] = [];
      if (params.attachments && params.attachments.length > 0) {
        try {
          zohoAttachments = await this.uploadAttachments(client, params.attachments);
        } catch (error) {
          console.warn('Failed to upload attachments, sending email without attachments:', error);
        }
      }

      // Build email content for Zoho Mail API
      const emailData: Record<string, any> = {
        fromAddress: await this.getDefaultFromAddress(client, accountId),
        toAddress: Array.isArray(params.to) ? params.to.join(',') : params.to,
        ccAddress: params.cc ? (Array.isArray(params.cc) ? params.cc.join(',') : params.cc) : undefined,
        bccAddress: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc) : undefined,
        subject: params.subject,
        content: params.body || '',
        mailFormat: 'plaintext',
        askReceipt: 'no'
      };

      // Add attachments if any were successfully uploaded
      if (zohoAttachments.length > 0) {
        emailData.attachments = zohoAttachments;
      }

      // Remove undefined fields
      Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined) {
          delete emailData[key];
        }
      });

      console.log('Sending email via Zoho Mail API:', {
        endpoint: `/accounts/${accountId}/messages`,
        hasFromAddress: !!emailData.fromAddress,
        hasToAddress: !!emailData.toAddress,
        hasSubject: !!emailData.subject,
        hasContent: !!emailData.content,
        attachmentCount: zohoAttachments.length
      });

      const response = await client.post(`/accounts/${accountId}/messages`, emailData);

      if (response.data.status?.code === 200 || response.data.data) {
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
      throw new Error(`Failed to send email via Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read emails from Zoho Mail
   */
  async readEmails(query: EmailQuery): Promise<Email[]> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');

      // Get account ID first
      const accountId = await this.getAccountId(client);

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

      console.log('Reading emails from Zoho Mail API:', {
        endpoint: `/accounts/${accountId}/messages/view`,
        params
      });

      // Get messages from Zoho Mail using correct endpoint
      const response = await client.get(`/accounts/${accountId}/messages/view`, { params });

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
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');

      // Get account ID first
      const accountId = await this.getAccountId(client);

      const response = await client.get(`/accounts/${accountId}/messages/${emailId}`);

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
   * Upload attachments to Zoho Mail using proper file retrieval and API
   */
  private async uploadAttachments(client: AxiosInstance, attachments: EmailAttachment[]): Promise<ZohoAttachmentMetadata[]> {
    const accountId = await this.getAccountId(client);
    const uploadedAttachments: ZohoAttachmentMetadata[] = [];

    for (const attachment of attachments) {
      try {
        // Retrieve actual file data using the attachmentId
        const fileBuffer = await this.retrieveFileData(attachment.attachmentId);

        // Upload to Zoho Mail using multipart form data
        const zohoAttachment = await this.uploadSingleAttachment(
          client,
          accountId,
          attachment,
          fileBuffer
        );

        uploadedAttachments.push(zohoAttachment);

        console.log(`Successfully uploaded attachment: ${attachment.filename}`);
      } catch (error) {
        console.error(`Failed to upload attachment ${attachment.filename}:`, error);
        throw new Error(
          `Failed to upload attachment ${attachment.filename}: ${error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return uploadedAttachments;
  }

  /**
   * Retrieve file data from storage using attachmentId
   */
  private async retrieveFileData(attachmentId: string): Promise<Buffer> {
    try {
      return await this.fileService.getFile(attachmentId);
    } catch (error) {
      throw new Error(
        `Failed to retrieve file data for attachment ${attachmentId}: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Upload a single attachment to Zoho Mail API
   */
  private async uploadSingleAttachment(
    client: AxiosInstance,
    accountId: string,
    attachment: EmailAttachment,
    fileBuffer: Buffer
  ): Promise<ZohoAttachmentMetadata> {
    const formData = new FormData();
    formData.append('attach', fileBuffer, {
      filename: attachment.filename,
      contentType: attachment.mimeType
    });

    try {
      const response = await client.post(
        `/accounts/${accountId}/messages/attachments?uploadType=multipart`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      const uploadResponse = response.data as ZohoAttachmentUploadResponse;

      if (uploadResponse.status?.code !== 200) {
        throw new Error(
          uploadResponse.status?.description || 'Failed to upload attachment to Zoho'
        );
      }

      if (!uploadResponse.data || uploadResponse.data.length === 0) {
        throw new Error('No attachment data returned from Zoho API');
      }

      const zohoAttachment = uploadResponse.data[0];
      return {
        storeName: zohoAttachment.storeName,
        attachmentName: zohoAttachment.attachmentName,
        attachmentPath: zohoAttachment.attachmentPath
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to upload attachment to Zoho')) {
        throw error;
      }
      throw new Error(
        `Zoho attachment upload API error: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get account ID for the authenticated user
   */
  private async getAccountId(client: AxiosInstance): Promise<string> {
    try {
      const response = await client.get('/accounts');

      console.log('Zoho accounts response:', {
        status: response.status,
        hasData: !!response.data,
        data: response.data
      });

      // Handle the response format from the official API documentation
      if (response.status === 200 && response.data?.status?.code === 200) {
        const accounts = response.data.data;
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          const accountId = accounts[0].accountId;
          console.log('Retrieved Zoho account ID:', accountId);
          return accountId;
        }
      }

      throw new Error('No accounts found or invalid response format');
    } catch (error: any) {
      console.error('Failed to get account ID:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Get default from address for the account
   */
  private async getDefaultFromAddress(client: AxiosInstance, accountId: string): Promise<string> {
    try {
      const response = await client.get(`/accounts/${accountId}`);

      if (response.data.status?.code === 200 && response.data.data) {
        return response.data.data.primaryEmailAddress || response.data.data.emailAddress || '';
      } else {
        console.warn('Failed to get default from address, using empty string');
        return '';
      }
    } catch (error) {
      console.warn('Failed to get default from address:', error);
      return '';
    }
  }
}
