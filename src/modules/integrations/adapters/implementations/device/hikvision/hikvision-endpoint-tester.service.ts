import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from './utils/hikvision-http.client';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { DeviceConnectionConfig } from '@/modules/device/device-adapter.strategy';
import { Device } from '@prisma/client';

@Injectable()
export class HikvisionEndpointTester {
    constructor(
        private readonly logger: LoggerService,
        private readonly httpClient: HikvisionHttpClient,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    async testAllEndpoints(device: Device) {
        this.logger.log('Starting comprehensive Hikvision endpoint testing', {
            host: device.host,
            port: device.port,
            module: 'hikvision-tester'
        });

        const results = {
            deviceInfo: {},
            system: {},
            network: {},
            accessControl: {},
            authentication: {},
            events: {},
            users: {},
            faces: {},
            cards: {},
            fingerprints: {},
            webhooks: {},
            capabilities: {},
            errors: [] as string[]
        };

        // Test device info endpoints
        await this.testDeviceInfoEndpoints(device, results);
        
        // Test system endpoints
        await this.testSystemEndpoints(device, results);
        
        // Test network endpoints
        await this.testNetworkEndpoints(device, results);
        
        // Test access control endpoints
        await this.testAccessControlEndpoints(device, results);
        
        // Test authentication endpoints
        await this.testAuthenticationEndpoints(device, results);
        
        // Test event endpoints
        await this.testEventEndpoints(device, results);
        
        // Test user management endpoints
        await this.testUserEndpoints(device, results);
        
        // Test face management endpoints
        await this.testFaceEndpoints(device, results);
        
        // Test card management endpoints
        await this.testCardEndpoints(device, results);
        
        // Test fingerprint endpoints
        await this.testFingerprintEndpoints(device, results);
        
        // Test webhook endpoints
        await this.testWebhookEndpoints(device, results);
        
        // Test capability endpoints
        await this.testCapabilityEndpoints(device, results);

        this.logger.log('Endpoint testing completed', {
            totalTests: Object.keys(results).filter(key => key !== 'errors').length,
            errors: results.errors.length,
            module: 'hikvision-tester'
        });

        return results;
    }

    private async testDeviceInfoEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'deviceInfo', url: '/ISAPI/System/deviceInfo' },
            { name: 'deviceInfo_lower', url: '/ISAPI/System/deviceinfo' },
            { name: 'deviceStatus', url: '/ISAPI/System/status' },
            { name: 'deviceInfo_content', url: '/ISAPI/ContentMgmt/System/deviceInfo' },
            { name: 'capabilities', url: '/ISAPI/System/capabilities' },
            { name: 'deviceInfo_system', url: '/ISAPI/system/deviceInfo' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });
                
                // Convert XML to JSON if needed
                let data = response;
                if (typeof data === 'string' && data.includes('<?xml')) {
                    data = await this.xmlJsonService.xmlToJson(data);
                }

                results.deviceInfo[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: this.extractDeviceInfo(data)
                };

                this.logger.debug(`Device info endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.deviceInfo[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Device info ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testSystemEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'systemInfo', url: '/ISAPI/System/info' },
            { name: 'systemTime', url: '/ISAPI/System/time' },
            { name: 'reboot', url: '/ISAPI/System/reboot', method: 'PUT' },
            { name: 'factoryReset', url: '/ISAPI/System/factoryReset', method: 'PUT' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: endpoint.method || 'GET',
                    url: endpoint.url
                });

                results.system[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`System endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.system[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`System ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testNetworkEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'networkInterfaces', url: '/ISAPI/System/Network/interfaces' },
            { name: 'networkInterface1', url: '/ISAPI/System/Network/interfaces/1' },
            { name: 'networkPorts', url: '/ISAPI/System/Network/ports' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.network[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Network endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.network[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Network ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testAccessControlEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'doorInfo', url: '/ISAPI/AccessControl/Door/info' },
            { name: 'doorParam', url: '/ISAPI/AccessControl/Door/param/1' },
            { name: 'remoteControl', url: '/ISAPI/AccessControl/RemoteControl/door/1', method: 'PUT' },
            { name: 'accessControlCapabilities', url: '/ISAPI/AccessControl/capabilities' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: endpoint.method || 'GET',
                    url: endpoint.url,
                    data: endpoint.method === 'PUT' ? { cmd: 'open' } : undefined
                });

                results.accessControl[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Access control endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.accessControl[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Access control ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testAuthenticationEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'authenticationInfo', url: '/ISAPI/AccessControl/Authentication' },
            { name: 'authenticationCapabilities', url: '/ISAPI/AccessControl/Authentication/capabilities' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.authentication[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Authentication endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.authentication[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Authentication ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testEventEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'eventChannels', url: '/ISAPI/Event/channels' },
            { name: 'eventNotificationHosts', url: '/ISAPI/Event/notification/httpHosts' },
            { name: 'eventSubscription', url: '/ISAPI/Event/notification/subscribe' },
            { name: 'eventCapabilities', url: '/ISAPI/Event/capabilities' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.events[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Event endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.events[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Event ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testUserEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'userInfo', url: '/ISAPI/AccessControl/UserInfo' },
            { name: 'userCount', url: '/ISAPI/AccessControl/UserInfo/count' },
            { name: 'userSearch', url: '/ISAPI/AccessControl/UserInfo/search' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.users[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`User endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.users[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`User ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testFaceEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'faceLibrary', url: '/ISAPI/Intelligent/FDLib' },
            { name: 'faceLibraryCount', url: '/ISAPI/Intelligent/FDLib/count' },
            { name: 'faceDetection', url: '/ISAPI/Intelligent/FDLib/FDSetUp' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.faces[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Face endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.faces[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Face ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testCardEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'cardInfo', url: '/ISAPI/AccessControl/CardInfo' },
            { name: 'cardCount', url: '/ISAPI/AccessControl/CardInfo/count' },
            { name: 'cardSearch', url: '/ISAPI/AccessControl/CardInfo/search' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.cards[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Card endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.cards[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Card ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testFingerprintEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'fingerPrint', url: '/ISAPI/AccessControl/FingerPrint' },
            { name: 'fingerPrintCount', url: '/ISAPI/AccessControl/FingerPrint/count' },
            { name: 'fingerPrintTemplate', url: '/ISAPI/AccessControl/FingerPrint/template' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.fingerprints[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Fingerprint endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.fingerprints[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Fingerprint ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testWebhookEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'httpHosts', url: '/ISAPI/Event/notification/httpHosts' },
            { name: 'httpsHosts', url: '/ISAPI/Event/notification/httpsHosts' },
            { name: 'eventNotification', url: '/ISAPI/Event/notification/notificationHosts' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.webhooks[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Webhook endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.webhooks[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Webhook ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private async testCapabilityEndpoints(device: Device, results: any) {
        const endpoints = [
            { name: 'systemCapabilities', url: '/ISAPI/System/capabilities' },
            { name: 'videoInputs', url: '/ISAPI/System/Video/inputs' },
            { name: 'audioInputs', url: '/ISAPI/System/Audio/inputs' },
            { name: 'ptzCapabilities', url: '/ISAPI/PTZ/capabilities' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpClient.request(device, {
                    method: 'GET',
                    url: endpoint.url
                });

                results.capabilities[endpoint.name] = {
                    success: true,
                    status: 'connected',
                    data: response
                };

                this.logger.debug(`Capability endpoint ${endpoint.name} successful`, {
                    url: endpoint.url,
                    module: 'hikvision-tester'
                });

            } catch (error) {
                results.capabilities[endpoint.name] = {
                    success: false,
                    status: 'failed',
                    error: error.message
                };
                results.errors.push(`Capability ${endpoint.name}: ${error.message}`);
            }
        }
    }

    private extractDeviceInfo(data: any): any {
        try {
            const deviceInfo = data.DeviceInfo || data.deviceInfo || data;
            
            return {
                deviceName: deviceInfo.deviceName || deviceInfo.name || 'Unknown',
                deviceId: deviceInfo.deviceID || deviceInfo.deviceId || 'Unknown',
                model: deviceInfo.model || 'Unknown',
                serialNumber: deviceInfo.serialNumber || 'Unknown',
                firmwareVersion: deviceInfo.firmwareVersion || deviceInfo.firmwareReleasedDate || 'Unknown',
                manufacturer: deviceInfo.manufacturer || 'Hikvision',
                macAddress: deviceInfo.macAddress || 'Unknown'
            };
        } catch (error) {
            return { error: 'Failed to extract device info' };
        }
    }
}