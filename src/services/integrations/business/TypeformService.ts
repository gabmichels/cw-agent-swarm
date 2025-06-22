import { 
  TypeformCreationParams,
  FormResult,
  FormResponse,
  HealthStatus,
  TypeformConfig,
  FormId,
  FormField,
  FormSettings,
  FormTheme
} from './interfaces/BusinessInterfaces';
import {
  FormError,
  FormNotFoundError,
  TypeformError
} from './errors/BusinessErrors';
import { logger } from '../../../lib/logging';

interface TypeformForm {
  id: string;
  title: string;
  language: string;
  fields: TypeformField[];
  hidden: string[];
  settings: TypeformSettings;
  theme: TypeformThemeData;
  workspace: {
    href: string;
  };
  _links: {
    display: string;
  };
  created_at: string;
  last_updated_at: string;
  published_at?: string;
}

interface TypeformField {
  id: string;
  title: string;
  ref: string;
  type: string;
  required: boolean;
  properties?: {
    description?: string;
    choices?: Array<{
      id: string;
      ref: string;
      label: string;
    }>;
    allow_multiple_selection?: boolean;
    allow_other_choice?: boolean;
    vertical_alignment?: boolean;
    randomize?: boolean;
    alphabetical_order?: boolean;
    hide_marks?: boolean;
    button_text?: string;
    steps?: number;
    shape?: string;
    labels?: {
      left?: string;
      right?: string;
      center?: string;
    };
    start_at_one?: boolean;
  };
  validations?: {
    required?: boolean;
    max_length?: number;
    min_length?: number;
    min_value?: number;
    max_value?: number;
  };
}

interface TypeformSettings {
  language: string;
  progress_bar: string;
  meta: {
    allow_indexing: boolean;
    description?: string;
    image?: {
      href: string;
    };
  };
  hide_navigation?: boolean;
  is_public: boolean;
  is_trial: boolean;
  show_progress_bar: boolean;
  show_typeform_branding: boolean;
  are_uploads_public?: boolean;
  show_time_to_complete?: boolean;
  show_number_of_submissions?: boolean;
  show_cookie_consent?: boolean;
  show_question_number?: boolean;
  show_key_hint_on_choices?: boolean;
  autosave_enabled?: boolean;
  free_form_navigation?: boolean;
  use_lead_qualification?: boolean;
  pro_subdomain_enabled?: boolean;
  capabilities?: {
    e2e_encryption?: {
      enabled: boolean;
      modifiable: boolean;
    };
  };
  notifications?: {
    self: {
      enabled: boolean;
      recipients?: string[];
      reply_to?: string;
      subject?: string;
      message?: string;
    };
    respondent: {
      enabled: boolean;
      recipients?: string[];
      reply_to?: string;
      subject?: string;
      message?: string;
    };
  };
  redirect_after_submit_url?: string;
  google_analytics?: string;
  facebook_pixel?: string;
  google_tag_manager?: string;
}

interface TypeformThemeData {
  href: string;
  name?: string;
  visibility?: string;
  colors?: {
    answer: string;
    background: string;
    button: string;
    question: string;
  };
  font?: string;
  has_transparent_button?: boolean;
}

interface TypeformResponseItem {
  form_id: string;
  token: string;
  landed_at: string;
  submitted_at: string;
  metadata: {
    user_agent: string;
    platform: string;
    referer: string;
    network_id: string;
    browser: string;
  };
  hidden: Record<string, string>;
  calculated: {
    score: number;
  };
  answers: Array<{
    field: {
      id: string;
      type: string;
      ref: string;
    };
    type: string;
    text?: string;
    email?: string;
    url?: string;
    number?: number;
    boolean?: boolean;
    choice?: {
      id: string;
      label: string;
      ref: string;
    };
    choices?: {
      ids: string[];
      labels: string[];
      refs: string[];
    };
    date?: string;
    file_url?: string;
    payment?: {
      amount: string;
      last4: string;
      name: string;
    };
  }>;
}

export class TypeformService {
  private readonly baseUrl = 'https://api.typeform.com';
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: TypeformConfig
  ) {
    this.headers = {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async createForm(params: TypeformCreationParams): Promise<FormResult> {
    try {
      logger.info('Creating form with Typeform', {
        formId: params.formId,
        title: params.title,
        fieldCount: params.fields.length
      });

      // Create the form using Typeform API
      const formData = {
        title: params.title,
        type: 'form',
        workspace: params.workspace ? { href: params.workspace } : undefined,
        settings: this.mapSettingsToTypeform(params.settings),
        theme: params.theme ? this.mapThemeToTypeform(params.theme) : undefined,
        fields: params.fields.map(field => this.mapFieldToTypeform(field))
      };

      const response = await fetch(`${this.baseUrl}/forms`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TypeformError(`Failed to create form: ${response.statusText}`, errorData);
      }

      const createdForm: TypeformForm = await response.json();

      const result: FormResult = {
        formId: params.formId,
        typeformId: createdForm.id,
        title: createdForm.title,
        status: createdForm.published_at ? 'published' : 'draft',
        publicUrl: createdForm._links.display,
        embedUrl: `https://embed.typeform.com/to/${createdForm.id}`,
        createdAt: new Date(createdForm.created_at),
        updatedAt: new Date(createdForm.last_updated_at),
        responseCount: 0, // New form has no responses
        completionRate: 0 // New form has no completion data
      };

      logger.info('Form created successfully', {
        formId: params.formId,
        typeformId: createdForm.id,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to create form', { 
        formId: params.formId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof TypeformError) {
        throw error;
      }

      throw new FormError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        params.formId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getForm(formId: FormId): Promise<FormResult> {
    try {
      logger.debug('Getting form', { formId });

      // First, we need to find the Typeform ID associated with our formId
      // In a real implementation, you'd store this mapping in a database
      // For now, we'll assume the formId contains the Typeform ID or use it directly
      const typeformId = this.extractTypeformId(formId);

      const response = await fetch(`${this.baseUrl}/forms/${typeformId}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new FormNotFoundError(formId);
        }
        throw new TypeformError(`Failed to get form: ${response.statusText}`);
      }

      const form: TypeformForm = await response.json();

      // Get response statistics
      const stats = await this.getFormStatistics(typeformId);

      const result: FormResult = {
        formId,
        typeformId: form.id,
        title: form.title,
        status: form.published_at ? 'published' : 'draft',
        publicUrl: form._links.display,
        embedUrl: `https://embed.typeform.com/to/${form.id}`,
        createdAt: new Date(form.created_at),
        updatedAt: new Date(form.last_updated_at),
        responseCount: stats.responseCount,
        completionRate: stats.completionRate
      };

      logger.debug('Form retrieved successfully', {
        formId,
        typeformId: form.id,
        status: result.status,
        responseCount: result.responseCount
      });

      return result;
    } catch (error) {
      logger.error('Failed to get form', { 
        formId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof FormNotFoundError || error instanceof TypeformError) {
        throw error;
      }

      throw new FormError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        formId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async updateForm(formId: FormId, updates: Partial<TypeformCreationParams>): Promise<FormResult> {
    try {
      logger.info('Updating form', { formId, updates: Object.keys(updates) });

      const typeformId = this.extractTypeformId(formId);

      // Build the update payload
      const updateData: any = {};
      
      if (updates.title) {
        updateData.title = updates.title;
      }
      
      if (updates.settings) {
        updateData.settings = this.mapSettingsToTypeform(updates.settings);
      }
      
      if (updates.theme) {
        updateData.theme = this.mapThemeToTypeform(updates.theme);
      }
      
      if (updates.fields) {
        updateData.fields = updates.fields.map(field => this.mapFieldToTypeform(field));
      }

      const response = await fetch(`${this.baseUrl}/forms/${typeformId}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new FormNotFoundError(formId);
        }
        throw new TypeformError(`Failed to update form: ${response.statusText}`);
      }

      const updatedForm: TypeformForm = await response.json();

      const result: FormResult = {
        formId,
        typeformId: updatedForm.id,
        title: updatedForm.title,
        status: updatedForm.published_at ? 'published' : 'draft',
        publicUrl: updatedForm._links.display,
        embedUrl: `https://embed.typeform.com/to/${updatedForm.id}`,
        createdAt: new Date(updatedForm.created_at),
        updatedAt: new Date(updatedForm.last_updated_at),
        responseCount: 0, // Would need separate API call for accurate count
        completionRate: 0
      };

      logger.info('Form updated successfully', {
        formId,
        typeformId: updatedForm.id,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Failed to update form', { 
        formId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof FormNotFoundError || error instanceof TypeformError) {
        throw error;
      }

      throw new FormError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        formId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteForm(formId: FormId): Promise<void> {
    try {
      logger.info('Deleting form', { formId });

      const typeformId = this.extractTypeformId(formId);

      const response = await fetch(`${this.baseUrl}/forms/${typeformId}`, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new FormNotFoundError(formId);
        }
        throw new TypeformError(`Failed to delete form: ${response.statusText}`);
      }

      logger.info('Form deleted successfully', { formId, typeformId });
    } catch (error) {
      logger.error('Failed to delete form', { 
        formId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof FormNotFoundError || error instanceof TypeformError) {
        throw error;
      }

      throw new FormError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        formId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getFormResponses(formId: FormId, limit: number = 25, since?: Date): Promise<readonly FormResponse[]> {
    try {
      logger.debug('Getting form responses', { formId, limit, since });

      const typeformId = this.extractTypeformId(formId);

      // Build query parameters
      const params = new URLSearchParams({
        page_size: limit.toString()
      });

      if (since) {
        params.append('since', since.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/forms/${typeformId}/responses?${params}`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new FormNotFoundError(formId);
        }
        throw new TypeformError(`Failed to get form responses: ${response.statusText}`);
      }

      const data = await response.json();
      const responses: TypeformResponseItem[] = data.items || [];

      const formResponses: FormResponse[] = responses.map(response => ({
        responseId: `response_${response.token}` as any,
        formId,
        submittedAt: new Date(response.submitted_at),
        landedAt: new Date(response.landed_at),
        answers: response.answers.map(answer => ({
          fieldId: answer.field.id,
          fieldType: this.mapTypeformFieldType(answer.field.type),
          value: this.extractAnswerValue(answer),
          text: answer.text
        })),
        metadata: {
          userAgent: response.metadata.user_agent,
          platform: response.metadata.platform,
          referer: response.metadata.referer,
          networkId: response.metadata.network_id,
          browser: response.metadata.browser
        }
      }));

      logger.debug('Form responses retrieved', {
        formId,
        responseCount: formResponses.length
      });

      return formResponses;
    } catch (error) {
      logger.error('Failed to get form responses', { 
        formId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof FormNotFoundError || error instanceof TypeformError) {
        throw error;
      }

      throw new FormError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        formId,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Test the connection by getting user information
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers: this.headers
      });

      const isValid = response.ok;
      
      if (!isValid) {
        logger.warn('Typeform connection validation failed', { 
          status: response.status,
          statusText: response.statusText 
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Typeform connection validation failed', { error });
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check API health by getting user info
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        headers: this.headers
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        // Parse rate limit headers if available
        const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '1000');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        return {
          isHealthy: true,
          lastChecked: new Date(),
          responseTime,
          rateLimitStatus: {
            remaining: rateLimitRemaining,
            resetAt: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : new Date(Date.now() + 60000),
            isThrottled: rateLimitRemaining < 10
          }
        };
      } else {
        return {
          isHealthy: false,
          lastChecked: new Date(),
          responseTime,
          errors: [`HTTP ${response.status}: ${response.statusText}`],
          rateLimitStatus: {
            remaining: 0,
            resetAt: new Date(Date.now() + 60000),
            isThrottled: true
          }
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        rateLimitStatus: {
          remaining: 0,
          resetAt: new Date(Date.now() + 60000),
          isThrottled: true
        }
      };
    }
  }

  private async getFormStatistics(typeformId: string): Promise<{ responseCount: number; completionRate: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/forms/${typeformId}/insights/summary`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        return { responseCount: 0, completionRate: 0 };
      }

      const data = await response.json();
      return {
        responseCount: data.total_responses || 0,
        completionRate: data.completion_rate || 0
      };
    } catch (error) {
      return { responseCount: 0, completionRate: 0 };
    }
  }

  private extractTypeformId(formId: FormId): string {
    // In a real implementation, you'd look up the Typeform ID from a database
    // For now, we'll extract it from the formId or use a placeholder
    const parts = formId.split('_');
    return parts.length > 1 ? parts[1] : 'placeholder_id';
  }

  private mapSettingsToTypeform(settings: FormSettings): TypeformSettings {
    return {
      language: settings.language,
      progress_bar: settings.progressBar,
      meta: {
        allow_indexing: settings.meta.allowIndexing,
        description: settings.meta.description,
        image: settings.meta.image ? { href: settings.meta.image } : undefined
      },
      is_public: settings.isPublic,
      is_trial: settings.isTrialForm,
      show_progress_bar: settings.showProgressBar,
      show_typeform_branding: settings.showTypeformBranding,
      redirect_after_submit_url: settings.redirectAfterSubmit,
      google_analytics: settings.googleAnalytics,
      facebook_pixel: settings.facebookPixel,
      notifications: settings.notifications ? {
        self: {
          enabled: settings.notifications.self.enabled,
          recipients: settings.notifications.self.recipients ? [...settings.notifications.self.recipients] : undefined,
          reply_to: settings.notifications.self.replyTo,
          subject: settings.notifications.self.subject,
          message: settings.notifications.self.message
        },
        respondent: {
          enabled: settings.notifications.respondent.enabled,
          recipients: settings.notifications.respondent.recipients ? [...settings.notifications.respondent.recipients] : undefined,
          reply_to: settings.notifications.respondent.replyTo,
          subject: settings.notifications.respondent.subject,
          message: settings.notifications.respondent.message
        }
      } : undefined
    };
  }

  private mapThemeToTypeform(theme: FormTheme): TypeformThemeData {
    return {
      href: theme.href,
      name: theme.name,
      colors: theme.colors,
      font: theme.font,
      has_transparent_button: theme.hasTransparentButton
    };
  }

  private mapFieldToTypeform(field: FormField): TypeformField {
    return {
      id: field.id,
      title: field.title,
      ref: field.id,
      type: field.type,
      required: field.required,
      properties: field.properties ? {
        description: field.properties.placeholder,
        choices: field.properties.choices?.map(choice => ({
          id: choice.id,
          ref: choice.ref,
          label: choice.label
        })),
        allow_multiple_selection: field.properties.allowMultipleSelection,
        allow_other_choice: field.properties.allowOtherChoice,
        steps: field.properties.steps,
        start_at_one: field.properties.startAtOne,
        labels: field.properties.labels
      } : undefined,
      validations: field.validations
    };
  }

  private mapTypeformFieldType(typeformType: string): any {
    const typeMap: Record<string, string> = {
      'short_text': 'short_text',
      'long_text': 'long_text',
      'multiple_choice': 'multiple_choice',
      'yes_no': 'yes_no',
      'email': 'email',
      'number': 'number',
      'date': 'date',
      'file_upload': 'file_upload',
      'rating': 'rating',
      'opinion_scale': 'opinion_scale',
      'dropdown': 'dropdown',
      'website': 'website',
      'phone_number': 'phone_number'
    };
    
    return typeMap[typeformType] || typeformType;
  }

  private extractAnswerValue(answer: any): unknown {
    if (answer.text !== undefined) return answer.text;
    if (answer.email !== undefined) return answer.email;
    if (answer.url !== undefined) return answer.url;
    if (answer.number !== undefined) return answer.number;
    if (answer.boolean !== undefined) return answer.boolean;
    if (answer.choice !== undefined) return answer.choice.label;
    if (answer.choices !== undefined) return answer.choices.labels;
    if (answer.date !== undefined) return answer.date;
    if (answer.file_url !== undefined) return answer.file_url;
    if (answer.payment !== undefined) return answer.payment;
    
    return null;
  }
} 