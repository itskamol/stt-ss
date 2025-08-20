import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { HikvisionEndpointTester } from './hikvision-endpoint-tester.service';
import { DeviceConnectionConfig } from '@/modules/device/device-adapter.strategy';
import { Device } from '@prisma/client';

@Controller('test/hikvision')
export class HikvisionTestController {
    constructor(private readonly endpointTester: HikvisionEndpointTester) {}

    @Post('test-endpoints')
    async testAllEndpoints(@Body() device: Device) {
        try {
            const results = await this.endpointTester.testAllEndpoints(device);
            
            // Generate a summary report
            const summary = this.generateSummary(results);
            
            return {
                success: true,
                summary,
                detailedResults: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to test endpoints',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('test-endpoints/:host/:port/:username/:password')
    async testWithParams(
        @Param('host') host: string,
        @Param('port') port: string,
        @Param('username') username: string,
        @Param('password') password: string
    ) {
        try {
            const deviceConfig: DeviceConnectionConfig = {
                host,
                port: parseInt(port),
                username,
                password,
                brand: 'Hikvision',
                protocol: 'HTTP',
            };

            const results = await this.endpointTester.testAllEndpoints(deviceConfig as any);
            const summary = this.generateSummary(results);
            
            return {
                success: true,
                summary,
                detailedResults: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to test endpoints',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('test-connection')
    async testConnection(@Body() deviceConfig: Device) {
        try {
            // Test basic connection with multiple endpoints
            const testEndpoints = [
                '/ISAPI/System/deviceInfo',
                '/ISAPI/System/status',
                '/ISAPI/System/deviceinfo'
            ];

            let lastError = null;
            let successfulEndpoint = null;

            for (const endpoint of testEndpoints) {
                try {
                    const result = await this.endpointTester['httpClient'].request(deviceConfig, {
                        method: 'GET',
                        url: endpoint
                    });
                    
                    successfulEndpoint = endpoint;
                    return {
                        success: true,
                        message: 'Connection successful',
                        endpoint: successfulEndpoint,
                        data: result,
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    lastError = error.message;
                    continue;
                }
            }

            throw new Error(`All endpoints failed. Last error: ${lastError}`);
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Connection test failed',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    private generateSummary(results: any): any {
        const categories = [
            'deviceInfo', 'system', 'network', 'accessControl', 
            'authentication', 'events', 'users', 'faces', 
            'cards', 'fingerprints', 'webhooks', 'capabilities'
        ];

        const summary = {
            totalEndpoints: 0,
            successfulEndpoints: 0,
            failedEndpoints: 0,
            categorySummary: {} as any,
            workingEndpoints: [] as string[],
            failedEndpointList: [] as string[],
            overallSuccessRate: 0
        };

        categories.forEach(category => {
            if (results[category] && typeof results[category] === 'object') {
                const endpoints = Object.keys(results[category]);
                summary.totalEndpoints += endpoints.length;
                
                const successful = endpoints.filter(
                    endpoint => results[category][endpoint].success
                ).length;
                
                const failed = endpoints.length - successful;
                
                summary.successfulEndpoints += successful;
                summary.failedEndpoints += failed;
                
                summary.categorySummary[category] = {
                    total: endpoints.length,
                    successful,
                    failed,
                    successRate: Math.round((successful / endpoints.length) * 100)
                };

                // Track working and failed endpoints
                endpoints.forEach(endpoint => {
                    const endpointKey = `${category}.${endpoint}`;
                    if (results[category][endpoint].success) {
                        summary.workingEndpoints.push(endpointKey);
                    } else {
                        summary.failedEndpointList.push(endpointKey);
                    }
                });
            }
        });

        summary.overallSuccessRate = Math.round(
            (summary.successfulEndpoints / summary.totalEndpoints) * 100
        );

        return summary;
    }
}