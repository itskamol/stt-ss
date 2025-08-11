import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { DeviceRepository } from '../device/device.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheService } from '../../core/cache/cache.service';
import { QueueProducer } from '../../core/queue/queue.producer';
import { CreateRawEventDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

@Injectable()
export class EventService {
    constructor(
        private readonly eventRepository: EventRepository,
        private readonly deviceRepository: DeviceRepository,
        private readonly logger: LoggerService,
        private readonly cacheService: CacheService,
        private readonly queueProducer: QueueProducer
    ) {}

    async processRawEvent(
        createRawEventDto: CreateRawEventDto,
        deviceId: string,
        signature: string,
        idempotencyKey: string
    ): Promise<string> {
        // Check idempotency
        const existingEventId = await this.checkIdempotency(idempotencyKey);
        if (existingEventId) {
            const error = new Error('DUPLICATE_EVENT');
            (error as any).existingEventId = existingEventId;
            throw error;
        }

        // Verify device authentication
        await this.verifyDeviceAuthentication(deviceId, signature, createRawEventDto);

        // Get device information
        const device = await this.getDeviceInfo(deviceId);
        if (!device) {
            throw new BadRequestException('Device not found');
        }

        if (device.status !== 'ONLINE') {
            throw new BadRequestException('Device is not online');
        }

        // Create device event log
        const eventLog = await this.eventRepository.createDeviceEventLog({
            deviceId: device.id,
            eventType: createRawEventDto.eventType,
            metadata: createRawEventDto,
            timestamp: createRawEventDto.timestamp
                ? new Date(createRawEventDto.timestamp)
                : new Date(),
            organizationId: device.organizationId,
        });

        // Store idempotency key
        await this.storeIdempotencyKey(idempotencyKey, eventLog.id);

        // Queue event for background processing
        await this.queueProducer.processRawDeviceEvent({
            deviceId: device.id,
            eventType: createRawEventDto.eventType,
            timestamp: eventLog.timestamp,
            rawData: createRawEventDto,
            organizationId: device.organizationId,
            branchId: device.branchId,
            idempotencyKey,
        });

        // Update device last seen
        await this.deviceRepository.updateLastSeen(device.id, new Date());

        return eventLog.id;
    }

    private async checkIdempotency(idempotencyKey: string): Promise<string | null> {
        const cacheKey = `idempotency:${idempotencyKey}`;
        return this.cacheService.get(cacheKey);
    }

    private async storeIdempotencyKey(idempotencyKey: string, eventId: string): Promise<void> {
        const cacheKey = `idempotency:${idempotencyKey}`;
        // Store for 24 hours
        await this.cacheService.set(cacheKey, eventId, 86400);
    }

    private async verifyDeviceAuthentication(
        deviceId: string,
        signature: string,
        eventData: CreateRawEventDto
    ): Promise<void> {
        // In a real implementation, this would verify the device signature
        // using a shared secret or certificate-based authentication

        // For now, we'll do a simple validation
        if (!signature || signature.length < 10) {
            throw new UnauthorizedException('Invalid device signature');
        }

        // Mock signature verification
        const expectedSignature = this.generateMockSignature(deviceId, eventData);
        if (signature !== expectedSignature && !signature.startsWith('dev-')) {
            // Allow dev- prefixed signatures for development
            throw new UnauthorizedException('Device signature verification failed');
        }
    }

    private generateMockSignature(deviceId: string, eventData: CreateRawEventDto): string {
        const crypto = require('crypto');
        const payload = JSON.stringify({
            deviceId,
            eventType: eventData.eventType,
            timestamp: eventData.timestamp,
        });
        return crypto
            .createHash('sha256')
            .update(`${payload}mock-secret`)
            .digest('hex')
            .substring(0, 32);
    }

    private async getDeviceInfo(deviceId: string) {
        // Create a scope that allows access to all organizations for device lookup
        const globalScope: DataScope = {
            organizationId: '', // Will be filled from device
        };

        // First try to find by ID
        let device = await this.deviceRepository.findById(deviceId, globalScope);

        if (!device) {
            // Try to find by MAC address if deviceId looks like a MAC
            if (deviceId.includes(':') || deviceId.includes('-')) {
                device = await this.deviceRepository.findByMacAddress(deviceId, globalScope);
            }
        }

        return device;
    }

    async getEventLogs(
        deviceId?: string,
        eventType?: string,
        startDate?: Date,
        endDate?: Date,
        scope?: DataScope
    ) {
        return this.eventRepository.findEventLogs(
            {
                deviceId,
                eventType,
                startDate,
                endDate,
            },
            scope
        );
    }

    async getEventLogById(id: string, scope: DataScope) {
        return this.eventRepository.findEventLogById(id, scope);
    }

    async getEventStats(deviceId?: string, startDate?: Date, endDate?: Date, scope?: DataScope) {
        return this.eventRepository.getEventStats(
            {
                deviceId,
                startDate,
                endDate,
            },
            scope
        );
    }
}
