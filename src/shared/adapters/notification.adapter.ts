export interface EmailOptions {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: EmailAttachment[];
    templateId?: string;
    templateData?: Record<string, any>;
}

export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
    encoding?: string;
}

export interface SmsOptions {
    to: string;
    message: string;
    templateId?: string;
    templateData?: Record<string, any>;
}

export interface PushNotificationOptions {
    to: string | string[]; // Device tokens or user IDs
    title: string;
    body: string;
    data?: Record<string, any>;
    badge?: number;
    sound?: string;
    icon?: string;
    clickAction?: string;
}

export interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
    deliveredAt?: Date;
}

export interface BulkNotificationResult {
    totalSent: number;
    totalFailed: number;
    results: NotificationResult[];
}

export interface NotificationTemplate {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'push';
    subject?: string;
    content: string;
    variables: string[];
}

export interface INotificationAdapter {
    /**
     * Send an email notification
     */
    sendEmail(options: EmailOptions): Promise<NotificationResult>;

    /**
     * Send bulk email notifications
     */
    sendBulkEmails(emails: EmailOptions[]): Promise<BulkNotificationResult>;

    /**
     * Send an SMS notification
     */
    sendSms(options: SmsOptions): Promise<NotificationResult>;

    /**
     * Send bulk SMS notifications
     */
    sendBulkSms(messages: SmsOptions[]): Promise<BulkNotificationResult>;

    /**
     * Send a push notification
     */
    sendPushNotification(options: PushNotificationOptions): Promise<NotificationResult>;

    /**
     * Send bulk push notifications
     */
    sendBulkPushNotifications(
        notifications: PushNotificationOptions[]
    ): Promise<BulkNotificationResult>;

    /**
     * Verify email address
     */
    verifyEmail(email: string): Promise<boolean>;

    /**
     * Verify phone number
     */
    verifyPhoneNumber(phoneNumber: string): Promise<boolean>;

    /**
     * Get notification delivery status
     */
    getDeliveryStatus(messageId: string): Promise<{
        status: 'pending' | 'delivered' | 'failed' | 'bounced';
        deliveredAt?: Date;
        error?: string;
    }>;

    /**
     * Create or update notification template
     */
    createTemplate(template: Omit<NotificationTemplate, 'id'>): Promise<NotificationTemplate>;

    /**
     * Get notification template
     */
    getTemplate(templateId: string): Promise<NotificationTemplate>;

    /**
     * List notification templates
     */
    listTemplates(type?: 'email' | 'sms' | 'push'): Promise<NotificationTemplate[]>;

    /**
     * Delete notification template
     */
    deleteTemplate(templateId: string): Promise<void>;
}
