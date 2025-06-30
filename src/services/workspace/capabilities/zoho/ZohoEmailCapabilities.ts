import { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { FileService } from '../../../../lib/storage/FileService';
import { StorageProvider } from '../../../../lib/storage/StorageService';
import { ZohoWorkspaceProvider } from '../../providers/ZohoWorkspaceProvider';
import { EmailAttachment, EmailCapabilities, EmailMessage, EmailSearchCriteria, ForwardEmailParams, ReplyEmailParams, SendEmailParams } from '../EmailCapabilities';
import { IEmailCapabilities } from '../interfaces/IEmailCapabilities';

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
   * Search for emails based on criteria - implements IEmailCapabilities interface
   */
  async searchEmails(criteria: EmailSearchCriteria, connectionId: string, agentId: string): Promise<EmailMessage[]> {
    // Use parent class permission validation
    const validation = await super.searchEmails(criteria, connectionId, agentId).catch(() => ({ length: 0 }));

    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');
      const accountId = await this.getAccountId(client);

      const params: any = {
        limit: criteria.maxResults || 50,
        start: criteria.pageToken ? parseInt(criteria.pageToken) : 0
      };

      // Add search criteria
      if (criteria.query) {
        params.searchKey = criteria.query;
      }

      // Handle folder/label search with INBOX-only default behavior
      if (criteria.labels && criteria.labels.length > 0) {
        // Map common labels to Zoho folder names
        const folderMap: Record<string, string> = {
          'INBOX': 'Inbox',
          'SENT': 'Sent',
          'DRAFT': 'Drafts',
          'SPAM': 'Spam',
          'TRASH': 'Trash'
        };
        params.folder = folderMap[criteria.labels[0]] || criteria.labels[0];
      } else if (!criteria.searchAllFolders) {
        // DEFAULT TO INBOX ONLY - consistent with Gmail behavior
        // This prevents searching across all folders unless explicitly requested
        params.folder = 'Inbox';
      }
      // If searchAllFolders is true, don't set folder param to search all folders

      // Handle unread filter
      if (criteria.isUnread !== undefined) {
        params.status = criteria.isUnread ? 'unread' : 'read';
      }

      // Handle date filters
      if (criteria.after) {
        params.fromDate = criteria.after.toISOString().split('T')[0];
      }
      if (criteria.before) {
        params.toDate = criteria.before.toISOString().split('T')[0];
      }

      console.log('Searching Zoho emails with params:', params);

      // Use search endpoint when searching by sender, otherwise use view endpoint
      let endpoint = `/accounts/${accountId}/messages/view`;
      let finalParams = { ...params };

      // If searching by sender, use search endpoint instead
      // NOTE: Zoho subject search is unreliable and causes 400 errors, so we only search by sender
      if (criteria.from) {
        endpoint = `/accounts/${accountId}/messages/search`;

        // Search across all folders (don't restrict to Inbox) to find emails in any organized folder
        // We'll filter out sent emails in post-processing instead
        finalParams.searchKey = `sender:${criteria.from}`;

        // Remove folder param when using search endpoint to search all folders
        delete finalParams.folder;

        console.log('Using search endpoint for sender-based search (all folders):', {
          endpoint,
          searchKey: finalParams.searchKey,
          fromCriteria: criteria.from,
          subjectWillBeFilteredAfter: !!criteria.subject,
          note: 'Searching all folders, will filter out sent emails in post-processing'
        });
      }

      console.log('Zoho API call:', { endpoint, params: finalParams });

      // Get messages from Zoho Mail
      const response = await client.get(endpoint, { params: finalParams });

      if (response.data.status?.code !== 200) {
        throw new Error(response.data.status?.description || 'Failed to search emails');
      }

      const messages = response.data.data || [];

      // Convert Zoho messages to EmailMessage format
      let emails: EmailMessage[] = await Promise.all(
        messages.map(async (msg: any) => this.convertZohoToEmailMessage(msg))
      );

      // Filter out emails from sent/drafts/spam/trash folders (keep only received emails)
      if (criteria.from) {
        const originalCount = emails.length;
        const excludedFolders = ['sent', 'drafts', 'spam', 'trash', 'outbox', 'scheduled'];

        emails = emails.filter(email => {
          const folder = (email.labels?.[0] || '').toLowerCase();
          const isExcludedFolder = excludedFolders.some(excluded => folder.includes(excluded));

          if (isExcludedFolder) {
            console.log(`Excluding email from ${folder} folder:`, { id: email.id, subject: email.subject });
            return false;
          }
          return true;
        });

        console.log(`Folder post-filter: ${originalCount} -> ${emails.length} emails (excluded sent/drafts/spam/trash folders)`);
      }

      // Apply subject filtering in post-processing if needed
      if (criteria.subject) {
        const originalCount = emails.length;
        emails = emails.filter(email =>
          email.subject && email.subject.toLowerCase().includes(criteria.subject!.toLowerCase())
        );
        console.log(`Subject post-filter: ${originalCount} -> ${emails.length} emails (filtered by "${criteria.subject}")`);
      }

      // Debug logging for searches
      if (criteria.from || criteria.subject) {
        const searchDesc = [];
        if (criteria.from) searchDesc.push(`from: ${criteria.from}`);
        if (criteria.subject) searchDesc.push(`subject: ${criteria.subject}`);

        console.log(`Found ${emails.length} emails matching ${searchDesc.join(' and ')}:`,
          emails.map(e => ({
            id: e.id,
            subject: e.subject,
            from: e.from,
            date: e.date,
            folder: e.labels?.[0]
          }))
        );
      }

      return emails;
    } catch (error) {
      console.error('Zoho email search error:', error);
      throw new Error(`Failed to search emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Zoho message to EmailMessage format
   */
  private convertZohoToEmailMessage(zohoMsg: any): EmailMessage {
    const headers = [
      { name: 'From', value: zohoMsg.fromAddress || zohoMsg.sender || '' },
      { name: 'To', value: zohoMsg.toAddress || zohoMsg.recipient || '' },
      { name: 'Subject', value: zohoMsg.subject || '' },
      { name: 'Date', value: zohoMsg.receivedTime || zohoMsg.sentTime || new Date().toISOString() }
    ];

    if (zohoMsg.ccAddress) {
      headers.push({ name: 'Cc', value: zohoMsg.ccAddress });
    }

    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: zohoMsg.messageId || zohoMsg.mid || '',
      threadId: zohoMsg.conversationId || zohoMsg.cid || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To').split(',').map((email: string) => email.trim()).filter(Boolean),
      cc: getHeader('Cc').split(',').map((email: string) => email.trim()).filter(Boolean),
      body: zohoMsg.content || zohoMsg.summary || '',
      date: new Date(zohoMsg.receivedTime || zohoMsg.sentTime || Date.now()),
      isRead: zohoMsg.status !== 'unread',
      isImportant: zohoMsg.priority === 'high' || zohoMsg.priority === 'urgent',
      labels: [zohoMsg.folder || 'INBOX']
    };
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
      } else {
        // DEFAULT TO INBOX ONLY - consistent with Gmail behavior
        // This prevents searching across all folders unless explicitly requested
        params.folder = 'Inbox';
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
   * Note: For Zoho, we need both emailId and folderId to fetch email details
   */
  async getEmail(emailId: string, folderId?: string): Promise<Email> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');

      // Get account ID first
      const accountId = await this.getAccountId(client);

      // If no folderId provided, try common folders
      const foldersToTry = folderId ? [folderId] : [
        '9000000002014', // Inbox
        '9000000002015', // Sent
        '9000000002016', // Drafts
        '9000000002017', // Spam
        '9000000002018'  // Trash
      ];

      let emailDetails, emailContent, emailHeaders;
      let lastError;

      for (const currentFolderId of foldersToTry) {
        try {
          console.log('Trying to fetch Zoho email:', { accountId, folderId: currentFolderId, emailId });

          // Get email details using the correct Zoho API endpoint
          const detailsResponse = await client.get(`/accounts/${accountId}/folders/${currentFolderId}/messages/${emailId}/details`);

          if (detailsResponse.data.status?.code === 200) {
            emailDetails = detailsResponse.data.data;

            // Get email content separately
            const contentResponse = await client.get(`/accounts/${accountId}/folders/${currentFolderId}/messages/${emailId}/content`);

            if (contentResponse.data.status?.code === 200) {
              emailContent = contentResponse.data.data;

              // Get email headers for reply threading
              try {
                const headersResponse = await client.get(`/accounts/${accountId}/folders/${currentFolderId}/messages/${emailId}/header`);
                emailHeaders = headersResponse.data.data;
              } catch (headerError) {
                console.warn('Failed to get headers, continuing without them:', headerError);
                emailHeaders = { headerContent: {} };
              }

              // Success! Break out of the loop
              console.log('Successfully found email in folder:', currentFolderId);
              break;
            }
          }
        } catch (error) {
          lastError = error;
          console.log(`Email not found in folder ${currentFolderId}, trying next...`);
          continue;
        }
      }

      if (!emailDetails || !emailContent) {
        throw new Error(`Email ${emailId} not found in any folder. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }

      // Combine all the information into a single email object
      const combinedEmail = {
        ...emailDetails,
        content: emailContent.content || '',
        headers: emailHeaders?.headerContent || {}
      };

      return this.convertZohoMessageToEmail(client, combinedEmail);
    } catch (error) {
      console.error('Zoho get email error:', error);
      throw new Error(`Failed to get email from Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Zoho message format to our Email format
   */
  private async convertZohoMessageToEmail(client: AxiosInstance, zohoMsg: any): Promise<Email> {
    // Start with basic headers
    const headers = [
      { name: 'From', value: zohoMsg.fromAddress || zohoMsg.sender || '' },
      { name: 'To', value: zohoMsg.toAddress || zohoMsg.recipient || '' },
      { name: 'Subject', value: zohoMsg.subject || '' },
      { name: 'Date', value: zohoMsg.receivedTime || zohoMsg.sentTime || new Date().toISOString() }
    ];

    // Add CC and BCC if present
    if (zohoMsg.ccAddress) {
      headers.push({ name: 'Cc', value: zohoMsg.ccAddress });
    }
    if (zohoMsg.bccAddress) {
      headers.push({ name: 'Bcc', value: zohoMsg.bccAddress });
    }

    // If we have detailed headers from the API call, parse and add them
    if (zohoMsg.headers) {
      const parsedHeaders = this.parseZohoHeaders(zohoMsg.headers);
      // Add important headers for email threading
      if (parsedHeaders['Message-Id']) {
        headers.push({ name: 'Message-ID', value: parsedHeaders['Message-Id'] });
      }
      if (parsedHeaders['References']) {
        headers.push({ name: 'References', value: parsedHeaders['References'] });
      }
      if (parsedHeaders['In-Reply-To']) {
        headers.push({ name: 'In-Reply-To', value: parsedHeaders['In-Reply-To'] });
      }
    }

    const email: Email = {
      id: zohoMsg.messageId || zohoMsg.mid,
      threadId: zohoMsg.conversationId || zohoMsg.cid,
      labelIds: [zohoMsg.folder || 'INBOX'],
      snippet: zohoMsg.summary || zohoMsg.content?.substring(0, 200) || '',
      payload: {
        partId: '',
        mimeType: zohoMsg.mailFormat === 'html' ? 'text/html' : 'text/plain',
        filename: '',
        headers: headers,
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
   * Parse Zoho headers from raw header string or object format
   */
  private parseZohoHeaders(headers: any): Record<string, string> {
    if (typeof headers === 'string') {
      // Parse raw header string
      const headerMap: Record<string, string> = {};
      const lines = headers.split('\r\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const name = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          headerMap[name] = value;
        }
      }

      return headerMap;
    } else if (typeof headers === 'object' && headers !== null) {
      // Headers are already in object format
      const headerMap: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
          headerMap[key] = value[0] || '';
        } else {
          headerMap[key] = String(value || '');
        }
      }
      return headerMap;
    }

    return {};
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

  /**
   * Reply to an existing email via Zoho Mail API
   * Uses the proper Zoho reply endpoint: POST /accounts/{accountId}/messages/{messageId}
   */
  async replyToEmail(params: ReplyEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');
      const accountId = await this.getAccountId(client);

      // Get the original email to extract reply information
      const originalEmail = await this.getEmail(params.originalEmailId);

      // Extract original email information for reply
      const originalHeaders = originalEmail.payload.headers;
      const getOriginalHeader = (name: string) =>
        originalHeaders.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const originalSubject = getOriginalHeader('Subject');
      const originalFrom = getOriginalHeader('From');

      // Build reply subject (add "Re: " if not already present)
      const replySubject = originalSubject.toLowerCase().startsWith('re:')
        ? originalSubject
        : `Re: ${originalSubject}`;

      // Build reply content
      let replyBody = params.body;
      if (params.includeOriginal) {
        replyBody += '\n\n--- Original Message ---\n';
        replyBody += originalEmail.payload.body.data || '';
      }

      // Build email data for Zoho Reply API - following the exact structure from documentation
      const replyData: Record<string, any> = {
        fromAddress: await this.getDefaultFromAddress(client, accountId),
        toAddress: originalFrom,
        subject: replySubject,
        content: replyBody, // Zoho uses 'content' not 'body'
        action: 'reply', // REQUIRED for Zoho reply endpoint
        mailFormat: params.htmlBody ? 'html' : 'plaintext',
        askReceipt: 'no'
      };

      // Use the proper Zoho reply endpoint: POST /accounts/{accountId}/messages/{messageId}
      const replyEndpoint = `/accounts/${accountId}/messages/${params.originalEmailId}`;

      console.log('Using proper Zoho reply endpoint:', {
        method: 'POST',
        endpoint: replyEndpoint,
        fullURL: `${client.defaults.baseURL}${replyEndpoint}`,
        accountId,
        messageId: params.originalEmailId,
        fromAddress: replyData.fromAddress,
        toAddress: replyData.toAddress,
        subject: replyData.subject,
        action: replyData.action
      });

      console.log('Zoho reply payload:', replyData);

      const response = await client.post(replyEndpoint, replyData);

      console.log('Zoho reply response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      if (response.data.status?.code === 200 || response.data.data) {
        // Convert to EmailMessage format
        return {
          id: response.data.data?.messageId || response.data.messageId || 'reply-' + Date.now(),
          threadId: originalEmail.threadId,
          from: replyData.fromAddress,
          to: [originalFrom],
          subject: replySubject,
          body: replyBody,
          date: new Date(),
          isRead: false,
          isImportant: false,
          labels: ['SENT'],
          attachments: []
        };
      } else {
        throw new Error(response.data.status?.description || 'Failed to send reply');
      }
    } catch (error: any) {
      console.error('Zoho email reply error:', error);

      // Log detailed error response for debugging
      if (error.response) {
        console.error('Zoho reply error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            data: error.config?.data
          }
        });
      }

      throw new Error(`Failed to reply to email via Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forward an existing email via Zoho Mail API
   */
  async forwardEmail(params: ForwardEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    try {
      const client = await this.zohoProvider.getServiceClient(this.connectionId, 'mail');
      const accountId = await this.getAccountId(client);

      // Get the original email to extract forwarding information
      const originalEmail = await this.getEmail(params.originalEmailId);

      // Extract original email information for forward
      const originalHeaders = originalEmail.payload.headers;
      const getOriginalHeader = (name: string) =>
        originalHeaders.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const originalSubject = getOriginalHeader('Subject');
      const originalFrom = getOriginalHeader('From');

      // Build forward subject (add "Fwd: " if not already present)
      const forwardSubject = originalSubject.toLowerCase().startsWith('fwd:') || originalSubject.toLowerCase().startsWith('fw:')
        ? originalSubject
        : `Fwd: ${originalSubject}`;

      // Build forward content
      let forwardBody = params.body || '';
      forwardBody += '\n\n---------- Forwarded message ----------\n';
      forwardBody += `From: ${originalFrom}\n`;
      forwardBody += `Subject: ${originalSubject}\n`;
      forwardBody += `\n${originalEmail.payload.body.data || ''}`;

      // Build email data for Zoho API
      const emailData: Record<string, any> = {
        fromAddress: await this.getDefaultFromAddress(client, accountId),
        toAddress: Array.isArray(params.to) ? params.to.join(',') : params.to,
        ccAddress: params.cc ? (Array.isArray(params.cc) ? params.cc.join(',') : params.cc) : undefined,
        subject: forwardSubject,
        content: forwardBody,
        mailFormat: params.htmlBody ? 'html' : 'plaintext',
        askReceipt: 'no'
      };

      // Remove undefined fields
      Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined) {
          delete emailData[key];
        }
      });

      // Send the forward
      const response = await client.post(`/accounts/${accountId}/messages`, emailData);

      if (response.data.status?.code === 200 || response.data.data) {
        // Convert to EmailMessage format
        return {
          id: response.data.data?.messageId || response.data.messageId || 'unknown',
          threadId: 'forward-' + Date.now(), // New thread for forwards
          from: emailData.fromAddress,
          to: params.to,
          cc: params.cc,
          subject: forwardSubject,
          body: forwardBody,
          date: new Date(),
          isRead: false,
          isImportant: false,
          labels: ['SENT'],
          attachments: []
        };
      } else {
        throw new Error(response.data.status?.description || 'Failed to send forward');
      }
    } catch (error) {
      console.error('Zoho email forward error:', error);
      throw new Error(`Failed to forward email via Zoho Mail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
