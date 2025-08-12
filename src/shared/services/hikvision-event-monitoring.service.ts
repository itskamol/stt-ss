import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, interval } from 'rxjs';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { EventType } from '@prisma/client';

import { EncryptionService } from './encryption.service';
import {
    HIKVISION_CONFIG,
    HikvisionDeviceConfig,
    HikvisionErrorContext,
} from '../adapters/hikvision.adapter';
import { DeviceEvent } from '../adapters/device.adapter';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface EventSubscriptionOptions {
    eventTypes?: HikvisionEventType[];
    pollingInterval?: number; // milliseconds
    useWebSocket?: boolean;
    maxRetries?: number;
    retryDelay?: number;
}

export interface EventMonitoringStats {
    deviceId: string;
    subscriptionStartTime: Date;
    totalEventsReceived: number;
    eventsByType: Record<string, number>;
    lastEventTime?: Date;
    connectionStatus: 'connected' | 'disconnected' | 'error';
    reconnectAttempts: number;
    lastError?: string;
}

export type HikvisionEventType = 
    | 'ACCESS_GRANTED'
    | 'ACCESS_DENIED'
    | 'DOOR_OPEN'
    | 'DOOR_CLOSE'
    | 'ALARM'
    | 'TAMPER'
    | 'CARD_SCAN'
    | 'FINGERPRINT_SCAN'
    | 'FACE_RECOGNITION'
    | 'NETWORK_ERROR';

export interface HikvisionRawEvent {
    eventType: string;
    eventTime: string;
    deviceID: string;
    channelID?: number;
    employeeNoString?: string;
    cardNo?: string;
    faceID?: string;
    fingerprintID?: string;
    doorID?: number;
    alarmType?: string;
    description?: string;
    pictureURL?: string;
    videoURL?: string;
    additionalData?: Record<string, any>;
}

@Injectable()
export class HikvisionEventMonitoringService extends EventEmitter {
    private readonly logger = new Logger(HikvisionEventMonitoringService.name);
    private readonly subscriptions = new Map<string, EventSubscription>();
    private readonly monitoringStats = new Map<string, EventMonitoringStats>();

    constructor(
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
    ) {
        super();
    }

    /**
     * Subscribe to device events
     */
    async subscribeToEvents(
        device: HikvisionDeviceConfig,
        callback: (event: DeviceEvent) => void,
        options: EventSubscriptionOptions = {}
    ): Promise<void> {
        const {
            eventTypes = Object.values(EventType),
            pollingInterval = 5000,
            useWebSocket = true,
            maxRetries = 5,
            retryDelay = 2000,
        } = options;

        this.logger.log('Subscribing to device events', { 
            deviceId: device.deviceId, 
            eventTypes,
            useWebSocket 
        });

        // Check if already subscribed
        if (this.subscriptions.has(device.deviceId)) {
            this.logger.warn('Device already has active subscription', { deviceId: device.deviceId });
            await this.unsubscribeFromEvents(device.deviceId);
        }

        // Initialize monitoring stats
        this.monitoringStats.set(device.deviceId, {
            deviceId: device.deviceId,
            subscriptionStartTime: new Date(),
            totalEventsReceived: 0,
            eventsByType: {},
            connectionStatus: 'disconnected',
            reconnectAttempts: 0,
        });

        try {
            let subscription: EventSubscription;

            if (useWebSocket) {
                subscription = await this.createWebSocketSubscription(
                    device, 
                    callback, 
                    eventTypes, 
                    maxRetries, 
                    retryDelay
                );
            } else {
                subscription = await this.createPollingSubscription(
                    device, 
                    callback, 
                    eventTypes, 
                    pollingInterval, 
                    maxRetries, 
                    retryDelay
                );
            }

            this.subscriptions.set(device.deviceId, subscription);
            this.updateConnectionStatus(device.deviceId, 'connected');

            this.logger.log('Event subscription established', { 
                deviceId: device.deviceId,
                method: useWebSocket ? 'websocket' : 'polling' 
            });

        } catch (error) {
            this.updateConnectionStatus(device.deviceId, 'error', error.message);
            const context = this.createErrorContext(device.deviceId, 'subscribeToEvents');
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to subscribe to events', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });
            throw exception.toNestException();
        }
    }

    /**
     * Unsubscribe from device events
     */
    async unsubscribeFromEvents(deviceId: string): Promise<void> {
        this.logger.log('Unsubscribing from device events', { deviceId });

        const subscription = this.subscriptions.get(deviceId);
        if (subscription) {
            await subscription.cleanup();
            this.subscriptions.delete(deviceId);
        }

        this.updateConnectionStatus(deviceId, 'disconnected');
        this.logger.log('Unsubscribed from device events', { deviceId });
    }

    /**
     * Get event monitoring statistics
     */
    getMonitoringStats(deviceId: string): EventMonitoringStats | null {
        return this.monitoringStats.get(deviceId) || null;
    }

    /**
     * Get all monitoring statistics
     */
    getAllMonitoringStats(): EventMonitoringStats[] {
        return Array.from(this.monitoringStats.values());
    }

    /**
     * Check if device has active subscription
     */
    hasActiveSubscription(deviceId: string): boolean {
        return this.subscriptions.has(deviceId);
    }

    /**
     * Get active subscriptions count
     */
    getActiveSubscriptionsCount(): number {
        return this.subscriptions.size;
    }

    /**
     * Cleanup all subscriptions
     */
    async cleanup(): Promise<void> {
        this.logger.log('Cleaning up all event subscriptions');

        const cleanupPromises = Array.from(this.subscriptions.keys()).map(deviceId =>
            this.unsubscribeFromEvents(deviceId)
        );

        await Promise.allSettled(cleanupPromises);
        this.monitoringStats.clear();

        this.logger.log('All event subscriptions cleaned up');
    }

    // ==================== Private Methods ====================

    private async createWebSocketSubscription(
        device: HikvisionDeviceConfig,
        callback: (event: DeviceEvent) => void,
        eventTypes: HikvisionEventType[],
        maxRetries: number,
        retryDelay: number
    ): Promise<EventSubscription> {
        const wsUrl = this.buildWebSocketUrl(device);
        const password = this.encryptionService.decrypt(device.encryptedSecret);
        
        let ws: WebSocket;
        let reconnectAttempts = 0;
        let reconnectTimer: NodeJS.Timeout;

        const connect = () => {
            return new Promise<WebSocket>((resolve, reject) => {
                ws = new WebSocket(wsUrl, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${device.username}:${password}`).toString('base64')}`,
                    },
                });

                ws.on('open', () => {
                    this.logger.debug('WebSocket connection established', { deviceId: device.deviceId });
                    reconnectAttempts = 0;
                    resolve(ws);
                });

                ws.on('message', (data: Buffer) => {
                    try {
                        const rawEvent = this.parseWebSocketMessage(data);
                        if (this.shouldProcessEvent(rawEvent, eventTypes)) {
                            const deviceEvent = this.convertToDeviceEvent(device.deviceId, rawEvent);
                            this.updateEventStats(device.deviceId, deviceEvent.eventType);
                            callback(deviceEvent);
                        }
                    } catch (error) {
                        this.logger.warn('Failed to parse WebSocket message', { 
                            deviceId: device.deviceId, 
                            error: error.message 
                        });
                    }
                });

                ws.on('error', (error) => {
                    this.logger.error('WebSocket error', { deviceId: device.deviceId, error: error.message });
                    this.updateConnectionStatus(device.deviceId, 'error', error.message);
                    reject(error);
                });

                ws.on('close', () => {
                    this.logger.debug('WebSocket connection closed', { deviceId: device.deviceId });
                    this.updateConnectionStatus(device.deviceId, 'disconnected');
                    
                    // Attempt reconnection
                    if (reconnectAttempts < maxRetries) {
                        reconnectAttempts++;
                        this.logger.log('Attempting WebSocket reconnection', { 
                            deviceId: device.deviceId, 
                            attempt: reconnectAttempts 
                        });
                        
                        reconnectTimer = setTimeout(() => {
                            connect().catch(() => {
                                // Reconnection failed, will try again or give up
                            });
                        }, retryDelay * reconnectAttempts);
                    } else {
                        this.logger.error('Max WebSocket reconnection attempts reached', { 
                            deviceId: device.deviceId 
                        });
                        this.updateConnectionStatus(device.deviceId, 'error', 'Max reconnection attempts reached');
                    }
                });
            });
        };

        await connect();

        return {
            type: 'websocket',
            cleanup: async () => {
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                }
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            },
        };
    }

    private async createPollingSubscription(
        device: HikvisionDeviceConfig,
        callback: (event: DeviceEvent) => void,
        eventTypes: HikvisionEventType[],
        pollingInterval: number,
        maxRetries: number,
        retryDelay: number
    ): Promise<EventSubscription> {
        let lastEventTime = new Date();
        let retryCount = 0;
        
        const pollEvents = async () => {
            try {
                const events = await this.pollDeviceEvents(device, lastEventTime, eventTypes);
                
                for (const rawEvent of events) {
                    const deviceEvent = this.convertToDeviceEvent(device.deviceId, rawEvent);
                    this.updateEventStats(device.deviceId, deviceEvent.eventType);
                    callback(deviceEvent);
                    
                    // Update last event time
                    if (deviceEvent.timestamp > lastEventTime) {
                        lastEventTime = deviceEvent.timestamp;
                    }
                }

                retryCount = 0; // Reset retry count on success
                this.updateConnectionStatus(device.deviceId, 'connected');

            } catch (error) {
                retryCount++;
                this.logger.warn('Event polling failed', { 
                    deviceId: device.deviceId, 
                    retryCount,
                    error: error.message 
                });

                if (retryCount >= maxRetries) {
                    this.logger.error('Max polling retry attempts reached', { deviceId: device.deviceId });
                    this.updateConnectionStatus(device.deviceId, 'error', 'Max retry attempts reached');
                    return; // Stop polling
                }

                this.updateConnectionStatus(device.deviceId, 'error', error.message);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        };

        // Start polling
        const pollingSubscription = interval(pollingInterval).subscribe(() => {
            pollEvents();
        });

        // Initial poll
        pollEvents();

        return {
            type: 'polling',
            cleanup: async () => {
                pollingSubscription.unsubscribe();
            },
        };
    }

    private async pollDeviceEvents(
        device: HikvisionDeviceConfig,
        since: Date,
        eventTypes: HikvisionEventType[]
    ): Promise<HikvisionRawEvent[]> {
        const endpoint = this.buildEndpoint(device, '/ISAPI/Event/notification/alertStream');
        const password = this.encryptionService.decrypt(device.encryptedSecret);

        const params = {
            format: 'json',
            startTime: since.toISOString(),
            eventTypes: eventTypes.join(','),
        };

        const response = await firstValueFrom(
            this.httpService.get(endpoint, {
                auth: { username: device.username, password },
                timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                params,
            })
        );

        return this.parsePollingResponse(response.data);
    }

    private parseWebSocketMessage(data: Buffer): HikvisionRawEvent {
        // Parse Hikvision WebSocket message format
        const message = data.toString('utf8');
        
        try {
            // Hikvision typically sends XML or JSON messages
            if (message.startsWith('<')) {
                // XML format
                return this.parseXmlEvent(message);
            } else {
                // JSON format
                return JSON.parse(message);
            }
        } catch (error) {
            throw new Error(`Failed to parse WebSocket message: ${error.message}`);
        }
    }

    private parseXmlEvent(xmlMessage: string): HikvisionRawEvent {
        // Basic XML parsing for Hikvision events
        // In a real implementation, you'd use a proper XML parser
        const eventType = this.extractXmlValue(xmlMessage, 'eventType') || 'unknown';
        const eventTime = this.extractXmlValue(xmlMessage, 'dateTime') || new Date().toISOString();
        const deviceID = this.extractXmlValue(xmlMessage, 'deviceID') || '';
        
        return {
            eventType,
            eventTime,
            deviceID,
            employeeNoString: this.extractXmlValue(xmlMessage, 'employeeNoString'),
            cardNo: this.extractXmlValue(xmlMessage, 'cardNo'),
            doorID: parseInt(this.extractXmlValue(xmlMessage, 'doorID') || '0'),
            description: this.extractXmlValue(xmlMessage, 'description'),
        };
    }

    private extractXmlValue(xml: string, tagName: string): string | undefined {
        const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : undefined;
    }

    private parsePollingResponse(data: any): HikvisionRawEvent[] {
        // Parse polling response format
        if (Array.isArray(data)) {
            return data;
        } else if (data.events && Array.isArray(data.events)) {
            return data.events;
        } else if (data.EventNotificationAlert) {
            return Array.isArray(data.EventNotificationAlert) 
                ? data.EventNotificationAlert 
                : [data.EventNotificationAlert];
        }
        
        return [];
    }

    private shouldProcessEvent(rawEvent: HikvisionRawEvent, eventTypes: HikvisionEventType[]): boolean {
        const mappedType = this.mapToHikvisionEventType(rawEvent.eventType);
        return eventTypes.includes(mappedType);
    }

    private mapToHikvisionEventType(hikvisionEventType: string): HikvisionEventType {
        // Map Hikvision raw event types to our HikvisionEventType enum
        const typeMap: Record<string, HikvisionEventType> = {
            'accessControllerEvent': 'ACCESS_GRANTED',
            'accessDenied': 'ACCESS_DENIED',
            'doorOpen': 'DOOR_OPEN',
            'doorClose': 'DOOR_CLOSE',
            'motionDetection': 'DOOR_OPEN',
            'faceDetection': 'FACE_RECOGNITION',
            'cardReader': 'CARD_SCAN',
            'fingerPrint': 'FINGERPRINT_SCAN',
            'deviceOnline': 'NETWORK_ERROR',
            'deviceOffline': 'NETWORK_ERROR',
            'alarm': 'ALARM',
        };

        return typeMap[hikvisionEventType] || 'NETWORK_ERROR';
    }

    private mapHikvisionEventType(hikvisionEventType: string): EventType {
        // Map Hikvision event types to our standard types
        const typeMap: Record<string, EventType> = {
            'accessControllerEvent': EventType.ACCESS_GRANTED,
            'accessDenied': EventType.ACCESS_DENIED,
            'doorOpen': EventType.DOOR_OPEN,
            'doorClose': EventType.DOOR_CLOSE,
            'motionDetection': EventType.DOOR_OPEN,
            'faceDetection': EventType.FACE_RECOGNITION,
            'cardReader': EventType.CARD_SCAN,
            'fingerPrint': EventType.FINGERPRINT_SCAN,
            'deviceOnline': EventType.NETWORK_ERROR,
            'deviceOffline': EventType.NETWORK_ERROR,
            'alarm': EventType.ALARM,
        };

        return typeMap[hikvisionEventType] || EventType.NETWORK_ERROR;
    }

    private convertToDeviceEvent(deviceId: string, rawEvent: HikvisionRawEvent): DeviceEvent {
        return {
            deviceId,
            eventType: this.mapHikvisionEventType(rawEvent.eventType),
            timestamp: new Date(rawEvent.eventTime),
            userId: rawEvent.employeeNoString,
            cardId: rawEvent.cardNo,
            biometricId: rawEvent.faceID || rawEvent.fingerprintID,
            data: {
                channelID: rawEvent.channelID,
                doorID: rawEvent.doorID,
                alarmType: rawEvent.alarmType,
                description: rawEvent.description,
                pictureURL: rawEvent.pictureURL,
                videoURL: rawEvent.videoURL,
                ...rawEvent.additionalData,
            },
        };
    }

    private updateEventStats(deviceId: string, eventType: string): void {
        const stats = this.monitoringStats.get(deviceId);
        if (stats) {
            stats.totalEventsReceived++;
            stats.eventsByType[eventType] = (stats.eventsByType[eventType] || 0) + 1;
            stats.lastEventTime = new Date();
        }
    }

    private updateConnectionStatus(deviceId: string, status: 'connected' | 'disconnected' | 'error', error?: string): void {
        const stats = this.monitoringStats.get(deviceId);
        if (stats) {
            stats.connectionStatus = status;
            if (error) {
                stats.lastError = error;
            }
            if (status === 'error') {
                stats.reconnectAttempts++;
            }
        }
    }

    private buildWebSocketUrl(device: HikvisionDeviceConfig): string {
        const protocol = device.useHttps ? 'wss' : 'ws';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}/ISAPI/Event/notification/alertStream`;
    }

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}

interface EventSubscription {
    type: 'websocket' | 'polling';
    cleanup: () => Promise<void>;
}