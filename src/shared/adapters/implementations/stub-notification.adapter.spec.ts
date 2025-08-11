import { Test, TestingModule } from '@nestjs/testing';
import { StubNotificationAdapter } from './stub-notification.adapter';
import { LoggerService } from '../../../core/logger/logger.service';
import { EmailOptions, PushNotificationOptions, SmsOptions } from '../notification.adapter';

describe('StubNotificationAdapter', () => {
    let adapter: StubNotificationAdapter;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StubNotificationAdapter,
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        adapter = module.get<StubNotificationAdapter>(StubNotificationAdapter);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(adapter).toBeDefined();
    });

    describe('sendEmail', () => {
        it('should send email successfully', async () => {
            const emailOptions: EmailOptions = {
                to: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test message</p>',
            };

            const result = await adapter.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();
            expect(result.deliveredAt).toBeInstanceOf(Date);
            expect(loggerService.log).toHaveBeenCalledWith(
                'Sending email (stub)',
                expect.objectContaining({
                    to: emailOptions.to,
                    subject: emailOptions.subject,
                })
            );
        });

        it('should handle email sending failure', async () => {
            // Mock Math.random to force failure
            const originalRandom = Math.random;
            Math.random = jest.fn().mockReturnValue(0.01); // Force failure

            const emailOptions: EmailOptions = {
                to: 'test@example.com',
                subject: 'Test Subject',
                text: 'Test message',
            };

            const result = await adapter.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Mock email delivery failure');
            expect(result.messageId).toBeUndefined();

            Math.random = originalRandom;
        });
    });

    describe('sendBulkEmails', () => {
        it('should send multiple emails', async () => {
            const emails: EmailOptions[] = [
                { to: 'user1@example.com', subject: 'Subject 1', text: 'Message 1' },
                { to: 'user2@example.com', subject: 'Subject 2', text: 'Message 2' },
            ];

            const result = await adapter.sendBulkEmails(emails);

            expect(result.totalSent).toBeGreaterThanOrEqual(0);
            expect(result.totalFailed).toBeGreaterThanOrEqual(0);
            expect(result.totalSent + result.totalFailed).toBe(emails.length);
            expect(result.results).toHaveLength(emails.length);
        });
    });

    describe('sendSms', () => {
        it('should send SMS successfully', async () => {
            const smsOptions: SmsOptions = {
                to: '+1234567890',
                message: 'Test SMS message',
            };

            const result = await adapter.sendSms(smsOptions);

            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();
            expect(loggerService.log).toHaveBeenCalledWith(
                'Sending SMS (stub)',
                expect.objectContaining({
                    to: smsOptions.to,
                })
            );
        });
    });

    describe('sendPushNotification', () => {
        it('should send push notification successfully', async () => {
            const pushOptions: PushNotificationOptions = {
                to: 'device-token-123',
                title: 'Test Notification',
                body: 'Test notification body',
            };

            const result = await adapter.sendPushNotification(pushOptions);

            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();
            expect(loggerService.log).toHaveBeenCalledWith(
                'Sending push notification (stub)',
                expect.objectContaining({
                    to: pushOptions.to,
                    title: pushOptions.title,
                })
            );
        });
    });

    describe('verifyEmail', () => {
        it('should verify valid email addresses', async () => {
            const validEmail = 'test@example.com';
            const result = await adapter.verifyEmail(validEmail);
            expect(result).toBe(true);
        });

        it('should reject invalid email addresses', async () => {
            const invalidEmail = 'invalid-email';
            const result = await adapter.verifyEmail(invalidEmail);
            expect(result).toBe(false);
        });
    });

    describe('verifyPhoneNumber', () => {
        it('should verify valid phone numbers', async () => {
            const validPhone = '+1234567890';
            const result = await adapter.verifyPhoneNumber(validPhone);
            expect(result).toBe(true);
        });

        it('should reject invalid phone numbers', async () => {
            const invalidPhone = '123456';
            const result = await adapter.verifyPhoneNumber(invalidPhone);
            expect(result).toBe(false);
        });
    });

    describe('getDeliveryStatus', () => {
        it('should return delivered status for normal messages', async () => {
            const messageId = 'normal-message-123';
            const status = await adapter.getDeliveryStatus(messageId);

            expect(status.status).toBe('delivered');
            expect(status.deliveredAt).toBeInstanceOf(Date);
        });

        it('should return failed status for failed messages', async () => {
            const messageId = 'failed-message-123';
            const status = await adapter.getDeliveryStatus(messageId);

            expect(status.status).toBe('failed');
            expect(status.error).toBe('Mock delivery failure');
        });

        it('should return bounced status for bounced messages', async () => {
            const messageId = 'bounced-message-123';
            const status = await adapter.getDeliveryStatus(messageId);

            expect(status.status).toBe('bounced');
            expect(status.error).toBe('Mock bounce');
        });

        it('should return pending status for pending messages', async () => {
            const messageId = 'pending-message-123';
            const status = await adapter.getDeliveryStatus(messageId);

            expect(status.status).toBe('pending');
        });
    });

    describe('template management', () => {
        it('should create a new template', async () => {
            const templateData = {
                name: 'Test Template',
                type: 'email' as const,
                subject: 'Test Subject',
                content: 'Hello {{name}}',
                variables: ['name'],
            };

            const template = await adapter.createTemplate(templateData);

            expect(template.id).toBeDefined();
            expect(template.name).toBe(templateData.name);
            expect(template.type).toBe(templateData.type);
        });

        it('should get an existing template', async () => {
            const template = await adapter.getTemplate('welcome-email');

            expect(template.id).toBe('welcome-email');
            expect(template.name).toBe('Welcome Email');
            expect(template.type).toBe('email');
        });

        it('should throw error for non-existing template', async () => {
            await expect(adapter.getTemplate('non-existing')).rejects.toThrow(
                'Template not found: non-existing'
            );
        });

        it('should list all templates', async () => {
            const templates = await adapter.listTemplates();

            expect(templates.length).toBeGreaterThan(0);
            expect(templates[0]).toHaveProperty('id');
            expect(templates[0]).toHaveProperty('name');
            expect(templates[0]).toHaveProperty('type');
        });

        it('should list templates by type', async () => {
            const emailTemplates = await adapter.listTemplates('email');
            const smsTemplates = await adapter.listTemplates('sms');

            expect(emailTemplates.every(t => t.type === 'email')).toBe(true);
            expect(smsTemplates.every(t => t.type === 'sms')).toBe(true);
        });

        it('should delete a template', async () => {
            // First create a template
            const templateData = {
                name: 'Temp Template',
                type: 'email' as const,
                content: 'Temporary content',
                variables: [],
            };
            const template = await adapter.createTemplate(templateData);

            // Then delete it
            await adapter.deleteTemplate(template.id);

            // Verify it's deleted
            await expect(adapter.getTemplate(template.id)).rejects.toThrow(
                `Template not found: ${template.id}`
            );
        });
    });
});
