import { ULID } from 'ulid';

// ULID-based identifiers
export type PaymentId = `payment_${ULID}`;
export type BookingId = `booking_${ULID}`;
export type FormId = `form_${ULID}`;
export type ResponseId = `response_${ULID}`;
export type CustomerId = `customer_${ULID}`;
export type ProductId = `product_${ULID}`;

// Core interfaces
export interface BusinessProvider {
  readonly id: string;
  readonly name: string;
  readonly apiEndpoint: string;
  readonly rateLimit: RateLimitConfig;
  readonly capabilities: readonly BusinessCapability[];
}

export interface BusinessCapability {
  readonly type: 'payments' | 'scheduling' | 'forms' | 'invoicing' | 'subscriptions';
  readonly isAvailable: boolean;
  readonly limitations?: readonly string[];
}

export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly requestsPerHour: number;
  readonly requestsPerDay: number;
}

// Payment interfaces (Stripe)
export interface StripePaymentParams {
  readonly paymentId: PaymentId;
  readonly amount: number; // Amount in cents
  readonly currency: string;
  readonly customerId?: CustomerId;
  readonly customerEmail?: string;
  readonly description?: string;
  readonly metadata?: Record<string, string>;
  readonly paymentMethodId?: string;
  readonly confirmationMethod: 'automatic' | 'manual';
  readonly captureMethod: 'automatic' | 'manual';
  readonly setupFutureUsage?: 'on_session' | 'off_session';
}

export interface PaymentResult {
  readonly paymentId: PaymentId;
  readonly stripePaymentIntentId: string;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly customerId?: CustomerId;
  readonly createdAt: Date;
  readonly confirmedAt?: Date;
  readonly failureReason?: string;
  readonly receiptUrl?: string;
  readonly refundable: boolean;
}

export type PaymentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded'
  | 'failed';

export interface RefundParams {
  readonly refundId: string;
  readonly paymentId: PaymentId;
  readonly amount?: number; // Partial refund amount in cents
  readonly reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  readonly metadata?: Record<string, string>;
}

export interface RefundResult {
  readonly refundId: string;
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly currency: string;
  readonly status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  readonly reason?: string;
  readonly createdAt: Date;
  readonly processedAt?: Date;
}

// Scheduling interfaces (Calendly)
export interface CalendlyBookingParams {
  readonly bookingId: BookingId;
  readonly eventTypeUri: string;
  readonly inviteeEmail: string;
  readonly inviteeName: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly timezone: string;
  readonly additionalGuests?: readonly string[];
  readonly customQuestions?: readonly BookingQuestion[];
  readonly rescheduleUrl?: string;
  readonly cancelUrl?: string;
}

export interface BookingQuestion {
  readonly question: string;
  readonly answer: string;
  readonly required: boolean;
}

export interface BookingResult {
  readonly bookingId: BookingId;
  readonly calendlyEventUri: string;
  readonly status: BookingStatus;
  readonly eventType: EventTypeInfo;
  readonly invitee: InviteeInfo;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly timezone: string;
  readonly location?: LocationInfo;
  readonly joinUrl?: string;
  readonly rescheduleUrl: string;
  readonly cancelUrl: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type BookingStatus = 'active' | 'canceled' | 'completed' | 'no_show';

export interface EventTypeInfo {
  readonly uri: string;
  readonly name: string;
  readonly duration: number; // Duration in minutes
  readonly description?: string;
  readonly color: string;
}

export interface InviteeInfo {
  readonly email: string;
  readonly name: string;
  readonly timezone: string;
  readonly customQuestions?: readonly BookingQuestion[];
}

export interface LocationInfo {
  readonly type: 'physical' | 'phone' | 'zoom' | 'google_meet' | 'microsoft_teams' | 'custom';
  readonly location?: string;
  readonly additionalInfo?: string;
}

// Form interfaces (Typeform)
export interface TypeformCreationParams {
  readonly formId: FormId;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly FormField[];
  readonly settings: FormSettings;
  readonly theme?: FormTheme;
  readonly workspace?: string;
}

export interface FormField {
  readonly id: string;
  readonly type: FormFieldType;
  readonly title: string;
  readonly description?: string;
  readonly required: boolean;
  readonly properties?: FormFieldProperties;
  readonly validations?: FormFieldValidations;
}

export type FormFieldType = 
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'yes_no'
  | 'email'
  | 'number'
  | 'date'
  | 'file_upload'
  | 'rating'
  | 'opinion_scale'
  | 'dropdown'
  | 'website'
  | 'phone_number';

export interface FormFieldProperties {
  readonly placeholder?: string;
  readonly choices?: readonly FormChoice[];
  readonly allowMultipleSelection?: boolean;
  readonly allowOtherChoice?: boolean;
  readonly steps?: number;
  readonly startAtOne?: boolean;
  readonly labels?: FormLabels;
}

export interface FormChoice {
  readonly id: string;
  readonly ref: string;
  readonly label: string;
}

export interface FormLabels {
  readonly left?: string;
  readonly right?: string;
  readonly center?: string;
}

export interface FormFieldValidations {
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
}

export interface FormSettings {
  readonly isPublic: boolean;
  readonly isTrialForm: boolean;
  readonly language: string;
  readonly progressBar: 'percentage' | 'proportion' | 'none';
  readonly showProgressBar: boolean;
  readonly showTypeformBranding: boolean;
  readonly meta: FormMeta;
  readonly redirectAfterSubmit?: string;
  readonly googleAnalytics?: string;
  readonly facebookPixel?: string;
  readonly notifications?: FormNotifications;
}

export interface FormMeta {
  readonly allowIndexing: boolean;
  readonly description?: string;
  readonly image?: string;
}

export interface FormNotifications {
  readonly self: FormNotificationSettings;
  readonly respondent: FormNotificationSettings;
}

export interface FormNotificationSettings {
  readonly enabled: boolean;
  readonly recipients?: readonly string[];
  readonly replyTo?: string;
  readonly subject?: string;
  readonly message?: string;
}

export interface FormTheme {
  readonly href: string;
  readonly name: string;
  readonly colors?: FormColors;
  readonly font?: string;
  readonly hasTransparentButton?: boolean;
}

export interface FormColors {
  readonly answer: string;
  readonly background: string;
  readonly button: string;
  readonly question: string;
}

export interface FormResult {
  readonly formId: FormId;
  readonly typeformId: string;
  readonly title: string;
  readonly status: FormStatus;
  readonly publicUrl: string;
  readonly embedUrl: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly responseCount: number;
  readonly completionRate: number;
}

export type FormStatus = 'draft' | 'published' | 'closed' | 'archived';

export interface FormResponse {
  readonly responseId: ResponseId;
  readonly formId: FormId;
  readonly submittedAt: Date;
  readonly landedAt: Date;
  readonly answers: readonly FormAnswer[];
  readonly metadata: ResponseMetadata;
}

export interface FormAnswer {
  readonly fieldId: string;
  readonly fieldType: FormFieldType;
  readonly value: unknown;
  readonly text?: string;
}

export interface ResponseMetadata {
  readonly userAgent: string;
  readonly platform: string;
  readonly referer: string;
  readonly networkId: string;
  readonly browser: string;
}

// Service interfaces
export interface IBusinessOperationsService {
  readonly providers: readonly BusinessProvider[];
  
  // Payment operations
  processPayment(params: StripePaymentParams): Promise<PaymentResult>;
  getPaymentStatus(paymentId: PaymentId): Promise<PaymentResult>;
  refundPayment(params: RefundParams): Promise<RefundResult>;
  
  // Scheduling operations
  scheduleAppointment(params: CalendlyBookingParams): Promise<BookingResult>;
  getBookingStatus(bookingId: BookingId): Promise<BookingResult>;
  cancelBooking(bookingId: BookingId, reason?: string): Promise<void>;
  rescheduleBooking(bookingId: BookingId, newStartTime: Date, newEndTime: Date): Promise<BookingResult>;
  
  // Form operations
  createForm(params: TypeformCreationParams): Promise<FormResult>;
  getForm(formId: FormId): Promise<FormResult>;
  updateForm(formId: FormId, updates: Partial<TypeformCreationParams>): Promise<FormResult>;
  deleteForm(formId: FormId): Promise<void>;
  getFormResponses(formId: FormId, limit?: number, since?: Date): Promise<readonly FormResponse[]>;
  
  // Health and validation
  validateConnections(): Promise<Record<string, boolean>>;
  getHealthStatus(): Promise<Record<string, HealthStatus>>;
}

export interface HealthStatus {
  readonly isHealthy: boolean;
  readonly lastChecked: Date;
  readonly responseTime: number;
  readonly errors?: readonly string[];
  readonly rateLimitStatus: RateLimitStatus;
}

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
  readonly isThrottled: boolean;
}

// Provider-specific configurations
export interface StripeConfig {
  readonly secretKey: string;
  readonly publishableKey: string;
  readonly webhookSecret?: string;
  readonly apiVersion: string;
}

export interface CalendlyConfig {
  readonly accessToken: string;
  readonly organizationUri: string;
  readonly webhookSigningKey?: string;
}

export interface TypeformConfig {
  readonly accessToken: string;
  readonly workspaceId?: string;
} 