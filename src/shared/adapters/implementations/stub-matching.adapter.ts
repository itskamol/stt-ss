import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../core/logger/logger.service';
import {
    BiometricEnrollRequest,
    BiometricEnrollResult,
    BiometricMatchRequest,
    BiometricMatchResult,
    BiometricTemplate,
    IMatchingAdapter,
    MatchingStatistics,
    QualityCheckResult,
} from '../matching.adapter';

@Injectable()
export class StubMatchingAdapter implements IMatchingAdapter {
    private templates: Map<string, BiometricTemplate> = new Map();
    private matchingStats = {
        totalMatches: 0,
        successfulMatches: 0,
        failedMatches: 0,
        totalConfidence: 0,
        totalProcessingTime: 0,
    };

    constructor(private readonly logger: LoggerService) {
        this.initializeMockTemplates();
    }

    async enrollBiometric(request: BiometricEnrollRequest): Promise<BiometricEnrollResult> {
        this.logger.log('Enrolling biometric (stub)', {
            userId: request.userId,
            type: request.type,
            samplesCount: request.samples.length,
        });

        // Simulate enrollment processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check quality of samples
        const qualities = await Promise.all(
            request.samples.map(sample => this.checkQuality(sample, request.type))
        );

        const averageQuality = qualities.reduce((sum, q) => sum + q.quality, 0) / qualities.length;

        if (averageQuality < 60) {
            return {
                success: false,
                quality: averageQuality,
                message: 'Biometric quality too low for enrollment',
            };
        }

        // Create new template
        const templateId = `template-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const template: BiometricTemplate = {
            id: templateId,
            userId: request.userId,
            type: request.type,
            template: this.generateMockTemplate(request.samples),
            quality: averageQuality,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.templates.set(templateId, template);

        return {
            success: true,
            templateId,
            quality: averageQuality,
            message: 'Biometric enrolled successfully',
        };
    }

    async matchBiometric(request: BiometricMatchRequest): Promise<BiometricMatchResult> {
        this.logger.log('Matching biometric (stub)', {
            type: request.type,
            organizationId: request.organizationId,
            threshold: request.threshold,
        });

        const startTime = Date.now();

        // Simulate matching processing delay
        await new Promise(resolve => setTimeout(resolve, 200));

        const processingTime = Date.now() - startTime;

        // Update statistics
        this.matchingStats.totalMatches++;
        this.matchingStats.totalProcessingTime += processingTime;

        // Find matching templates
        const candidateTemplates = Array.from(this.templates.values()).filter(
            template => template.type === request.type
        );

        if (candidateTemplates.length === 0) {
            this.matchingStats.failedMatches++;
            return {
                matched: false,
                confidence: 0,
                processingTime,
            };
        }

        // Simulate matching algorithm
        const bestMatch = candidateTemplates[Math.floor(Math.random() * candidateTemplates.length)];
        const confidence = Math.floor(Math.random() * 40) + 60; // 60-100% confidence

        const threshold = request.threshold || 75;
        const matched = confidence >= threshold;

        if (matched) {
            this.matchingStats.successfulMatches++;
            this.matchingStats.totalConfidence += confidence;
        } else {
            this.matchingStats.failedMatches++;
        }

        return {
            matched,
            userId: matched ? bestMatch.userId : undefined,
            confidence,
            template: matched ? bestMatch : undefined,
            processingTime,
        };
    }

    async verifyBiometric(
        userId: string,
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice',
        threshold?: number
    ): Promise<BiometricMatchResult> {
        this.logger.log('Verifying biometric (stub)', { userId, type, threshold });

        const startTime = Date.now();

        // Simulate verification processing delay
        await new Promise(resolve => setTimeout(resolve, 150));

        const processingTime = Date.now() - startTime;

        // Find user's templates
        const userTemplates = Array.from(this.templates.values()).filter(
            t => t.userId === userId && t.type === type
        );

        if (userTemplates.length === 0) {
            return {
                matched: false,
                confidence: 0,
                processingTime,
            };
        }

        // Simulate verification
        const confidence = Math.floor(Math.random() * 30) + 70; // 70-100% confidence
        const thresholdValue = threshold || 80;
        const matched = confidence >= thresholdValue;

        return {
            matched,
            userId: matched ? userId : undefined,
            confidence,
            template: matched ? userTemplates[0] : undefined,
            processingTime,
        };
    }

    async getUserTemplates(userId: string): Promise<BiometricTemplate[]> {
        this.logger.log('Getting user templates (stub)', { userId });

        return Array.from(this.templates.values()).filter(template => template.userId === userId);
    }

    async deleteTemplate(templateId: string): Promise<void> {
        this.logger.log('Deleting template (stub)', { templateId });

        if (!this.templates.has(templateId)) {
            throw new Error(`Template not found: ${templateId}`);
        }

        this.templates.delete(templateId);
    }

    async deleteUserTemplates(userId: string): Promise<void> {
        this.logger.log('Deleting user templates (stub)', { userId });

        const userTemplates = Array.from(this.templates.entries()).filter(
            ([, template]) => template.userId === userId
        );

        userTemplates.forEach(([templateId]) => {
            this.templates.delete(templateId);
        });
    }

    async updateTemplate(templateId: string, samples: string[]): Promise<BiometricEnrollResult> {
        this.logger.log('Updating template (stub)', { templateId, samplesCount: samples.length });

        const existingTemplate = this.templates.get(templateId);
        if (!existingTemplate) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Simulate update processing delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Check quality of new samples
        const qualities = await Promise.all(
            samples.map(sample => this.checkQuality(sample, existingTemplate.type))
        );

        const averageQuality = qualities.reduce((sum, q) => sum + q.quality, 0) / qualities.length;

        if (averageQuality < 60) {
            return {
                success: false,
                quality: averageQuality,
                message: 'New samples quality too low for update',
            };
        }

        // Update template
        existingTemplate.template = this.generateMockTemplate(samples);
        existingTemplate.quality = averageQuality;
        existingTemplate.updatedAt = new Date();

        return {
            success: true,
            templateId,
            quality: averageQuality,
            message: 'Template updated successfully',
        };
    }

    async checkQuality(
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice'
    ): Promise<QualityCheckResult> {
        this.logger.log('Checking biometric quality (stub)', { type });

        // Simulate quality check delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate mock quality score
        const quality = Math.floor(Math.random() * 100);
        const issues: string[] = [];
        const recommendations: string[] = [];

        if (quality < 30) {
            issues.push('Very low image quality');
            recommendations.push('Ensure good lighting and clean sensor');
        } else if (quality < 50) {
            issues.push('Low image quality');
            recommendations.push('Improve lighting conditions');
        } else if (quality < 70) {
            issues.push('Moderate image quality');
            recommendations.push('Position correctly and hold steady');
        }

        if (type === 'fingerprint' && quality < 80) {
            recommendations.push('Clean finger and sensor surface');
        }

        if (type === 'face' && quality < 75) {
            recommendations.push('Look directly at camera and remove glasses if possible');
        }

        return {
            quality,
            issues,
            recommendations,
            acceptable: quality >= 60,
        };
    }

    async getMatchingStatistics(
        organizationId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<MatchingStatistics> {
        this.logger.log('Getting matching statistics (stub)', {
            organizationId,
            startDate,
            endDate,
        });

        const averageConfidence =
            this.matchingStats.successfulMatches > 0
                ? this.matchingStats.totalConfidence / this.matchingStats.successfulMatches
                : 0;

        const averageProcessingTime =
            this.matchingStats.totalMatches > 0
                ? this.matchingStats.totalProcessingTime / this.matchingStats.totalMatches
                : 0;

        return {
            totalMatches: this.matchingStats.totalMatches,
            successfulMatches: this.matchingStats.successfulMatches,
            failedMatches: this.matchingStats.failedMatches,
            averageConfidence,
            averageProcessingTime,
            lastUpdated: new Date(),
        };
    }

    async bulkEnrollBiometrics(
        requests: BiometricEnrollRequest[]
    ): Promise<BiometricEnrollResult[]> {
        this.logger.log('Bulk enrolling biometrics (stub)', { count: requests.length });

        return Promise.all(requests.map(request => this.enrollBiometric(request)));
    }

    async findSimilarTemplates(
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice',
        threshold?: number
    ): Promise<BiometricTemplate[]> {
        this.logger.log('Finding similar templates (stub)', { type, threshold });

        // Simulate similarity search delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const candidateTemplates = Array.from(this.templates.values()).filter(t => t.type === type);

        // Mock similarity detection - return random subset
        const similarCount = Math.floor(Math.random() * Math.min(3, candidateTemplates.length));
        return candidateTemplates.slice(0, similarCount);
    }

    async getTemplate(templateId: string): Promise<BiometricTemplate> {
        this.logger.log('Getting template (stub)', { templateId });

        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        return template;
    }

    async listTemplates(
        organizationId: string,
        type?: 'fingerprint' | 'face' | 'iris' | 'voice'
    ): Promise<BiometricTemplate[]> {
        this.logger.log('Listing templates (stub)', { organizationId, type });

        const allTemplates = Array.from(this.templates.values());

        if (type) {
            return allTemplates.filter(template => template.type === type);
        }

        return allTemplates;
    }

    async optimizeDatabase(): Promise<{ message: string; duration: number }> {
        this.logger.log('Optimizing matching database (stub)');

        const startTime = Date.now();

        // Simulate optimization delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        const duration = Date.now() - startTime;

        return {
            message: 'Database optimization completed successfully',
            duration,
        };
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        responseTime: number;
        version?: string;
        capabilities: string[];
    }> {
        this.logger.log('Performing health check (stub)');

        const startTime = Date.now();

        // Simulate health check delay
        await new Promise(resolve => setTimeout(resolve, 50));

        const responseTime = Date.now() - startTime;

        return {
            status: 'healthy',
            responseTime,
            version: 'v2.1.0-stub',
            capabilities: [
                'fingerprint_matching',
                'face_matching',
                'iris_matching',
                'voice_matching',
                'quality_check',
                'bulk_operations',
            ],
        };
    }

    private generateMockTemplate(samples: string[]): string {
        // Generate a mock template based on samples
        const combined = samples.join('');
        return Buffer.from(`mock-template-${combined.length}-${Date.now()}`).toString('base64');
    }

    private initializeMockTemplates() {
        const mockTemplates: BiometricTemplate[] = [
            {
                id: 'template-001',
                userId: 'user-001',
                type: 'fingerprint',
                template: 'bW9jay1maW5nZXJwcmludC10ZW1wbGF0ZQ==',
                quality: 85,
                createdAt: new Date(Date.now() - 86400000),
                updatedAt: new Date(Date.now() - 86400000),
            },
            {
                id: 'template-002',
                userId: 'user-001',
                type: 'face',
                template: 'bW9jay1mYWNlLXRlbXBsYXRl',
                quality: 92,
                createdAt: new Date(Date.now() - 172800000),
                updatedAt: new Date(Date.now() - 172800000),
            },
            {
                id: 'template-003',
                userId: 'user-002',
                type: 'fingerprint',
                template: 'bW9jay1maW5nZXJwcmludC10ZW1wbGF0ZS0y',
                quality: 78,
                createdAt: new Date(Date.now() - 259200000),
                updatedAt: new Date(Date.now() - 259200000),
            },
        ];

        mockTemplates.forEach(template => {
            this.templates.set(template.id, template);
        });
    }
}
