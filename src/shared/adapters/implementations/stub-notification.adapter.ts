import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../core/logger/logger.service';
import {
    BulkNotificationResult,
    EmailOptions,
    INotificationAdapter,
    NotificationResult,
    NotificationTemplate,
    PushNotificationOptions,
    SmsOptions,
} from '../notification.adapter';

@Injectable()
export class StubNotificationAdapter implements INotificationAdapter {
    private templates: Map<string, NotificationTemplate> = new Map();

    constructor(private readonly logger: LoggerService) {
        // Initialize with some default templates
        this.initializeDefaultTemplates();
    }

    async sendEmail(options: EmailOptions): Promise<NotificationResult> {
        this.logger.log('Sending email (stub)', {
            to: options.to,
            subject: options.subject,
            templateId: options.templateId,
        });

        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // Mock success with 95% probability
        const success = Math.random() > 0.05;

        return {
            success,
            messageId: success
                ? `email-${Date.now()}-${Math.random().toString(36).substring(7)}`
                : undefined,
            error: success ? undefined : 'Mock email delivery failure',
            deliveredAt: success ? new Date() : undefined,
        };
    }

    async sendBulkEmails(emails: EmailOptions[]): Promise<BulkNotificationResult> {
        this.logger.log('Sending bulk emails (stub)', { count: emails.length });

        const results = await Promise.all(emails.map(email => this.sendEmail(email)));

        const totalSent = results.filter(r => r.success).length;
        const totalFailed = results.length - totalSent;

        return {
            totalSent,
            totalFailed,
            results,
        };
    }

    async sendSms(options: SmsOptions): Promise<NotificationResult> {
        this.logger.log('Sending SMS (stub)', {
            to: options.to,
            templateId: options.templateId,
        });

        // Simulate SMS sending delay
        await new Promise(resolve => setTimeout(resolve, 150));

        // Mock success with 98% probability
        const success = Math.random() > 0.02;

        return {
            success,
            messageId: success
                ? `sms-${Date.now()}-${Math.random().toString(36).substring(7)}`
                : undefined,
            error: success ? undefined : 'Mock SMS delivery failure',
            deliveredAt: success ? new Date() : undefined,
        };
    }

    async sendBulkSms(messages: SmsOptions[]): Promise<BulkNotificationResult> {
        this.logger.log('Sending bulk SMS (stub)', { count: messages.length });

        const results = await Promise.all(messages.map(sms => this.sendSms(sms)));

        const totalSent = results.filter(r => r.success).length;
        const totalFailed = results.length - totalSent;

        return {
            totalSent,
            totalFailed,
            results,
        };
    }

    async sendPushNotification(options: PushNotificationOptions): Promise<NotificationResult> {
        this.logger.log('Sending push notification (stub)', {
            to: options.to,
            title: options.title,
        });

        // Simulate push notification delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock success with 90% probability
        const success = Math.random() > 0.1;

        return {
            success,
            messageId: success
                ? `push-${Date.now()}-${Math.random().toString(36).substring(7)}`
                : undefined,
            error: success ? undefined : 'Mock push notification delivery failure',
            deliveredAt: success ? new Date() : undefined,
        };
    }

    async sendBulkPushNotifications(
        notifications: PushNotificationOptions[]
    ): Promise<BulkNotificationResult> {
        this.logger.log('Sending bulk push notifications (stub)', { count: notifications.length });

        const results = await Promise.all(
            notifications.map(notification => this.sendPushNotification(notification))
        );

        const totalSent = results.filter(r => r.success).length;
        const totalFailed = results.length - totalSent;

        return {
            totalSent,
            totalFailed,
            results,
        };
    }

    async verifyEmail(email: string): Promise<boolean> {
        this.logger.log('Verifying email (stub)', { email });

        // Mock verification: valid if contains @ and a domain
        return email.includes('@') && email.includes('.');
    }

    async verifyPhoneNumber(phoneNumber: string): Promise<boolean> {
        this.logger.log('Verifying phone number (stub)', { phoneNumber });

        // Mock verification: valid if starts with + and has at least 10 digits
        return /^\+\d{10,}$/.test(phoneNumber);
    }

    async getDeliveryStatus(messageId: string): Promise<{
        status: 'pending' | 'delivered' | 'failed' | 'bounced';
        deliveredAt?: Date;
        error?: string;
    }> {
        this.logger.log('Getting delivery status (stub)', { messageId });

        // Mock different statuses based on messageId
        if (messageId.includes('failed')) {
            return { status: 'failed', error: 'Mock delivery failure' };
        }
        if (messageId.includes('bounced')) {
            return { status: 'bounced', error: 'Mock bounce' };
        }
        if (messageId.includes('pending')) {
            return { status: 'pending' };
        }

        return {
            status: 'delivered',
            deliveredAt: new Date(Date.now() - Math.random() * 3600000), // Random time in last hour
        };
    }

    async createTemplate(
        template: Omit<NotificationTemplate, 'id'>
    ): Promise<NotificationTemplate> {
        this.logger.log('Creating template (stub)', { name: template.name, type: template.type });

        const newTemplate: NotificationTemplate = {
            ...template,
            id: `template-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        };

        this.templates.set(newTemplate.id, newTemplate);
        return newTemplate;
    }

    async getTemplate(templateId: string): Promise<NotificationTemplate> {
        this.logger.log('Getting template (stub)', { templateId });

        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        return template;
    }

    async listTemplates(type?: 'email' | 'sms' | 'push'): Promise<NotificationTemplate[]> {
        this.logger.log('Listing templates (stub)', { type });

        const allTemplates = Array.from(this.templates.values());

        if (type) {
            return allTemplates.filter(template => template.type === type);
        }

        return allTemplates;
    }

    async deleteTemplate(templateId: string): Promise<void> {
        this.logger.log('Deleting template (stub)', { templateId });

        if (!this.templates.has(templateId)) {
            throw new Error(`Template not found: ${templateId}`);
        }

        this.templates.delete(templateId);
    }

    private initializeDefaultTemplates() {
        const defaultTemplates: NotificationTemplate[] = [
            {
                id: 'welcome-email',
                name: 'Welcome Email',
                type: 'email',
                subject: 'Welcome to {{organizationName}}',
                content: 'Hello {{userName}}, welcome to our system!',
                variables: ['organizationName', 'userName'],
            },
            {
                id: 'access-denied-sms',
                name: 'Access Denied SMS',
                type: 'sms',
                content: 'Access denied at {{location}} on {{timestamp}}',
                variables: ['location', 'timestamp'],
            },
            {
                id: 'attendance-reminder-push',
                name: 'Attendance Reminder Push',
                type: 'push',
                content: "Don't forget to check in at {{branchName}}",
                variables: ['branchName'],
            },
        ];

        defaultTemplates.forEach(template => {
            this.templates.set(template.id, template);
        });
    }
}
