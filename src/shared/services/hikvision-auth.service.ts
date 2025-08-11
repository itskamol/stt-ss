import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HikvisionAuthConfig {
    username: string;
    password: string;
    ipAddress: string;
    port?: number;
    useHttps?: boolean;
    timeout?: number;
}

export interface HikvisionDeviceAuth {
    deviceId: string;
    authToken?: string;
    sessionToken?: string;
    expiresAt?: Date;
    isActive: boolean;
}

export interface HikvisionAuthResult {
    success: boolean;
    authToken?: string;
    sessionToken?: string;
    expiresAt?: Date;
    error?: string;
    deviceInfo?: {
        modelName: string;
        serialNumber: string;
        firmwareVersion: string;
        supportedFeatures: string[];
    };
}

@Injectable()
export class HikvisionAuthService {
    private readonly logger = new Logger(HikvisionAuthService.name);
    private activeAuthSessions: Map<string, HikvisionDeviceAuth> = new Map();

    constructor(private readonly configService: ConfigService) {}

    /**
     * Authenticate with Hikvision device using ISAPI
     */
    async authenticateDevice(config: HikvisionAuthConfig): Promise<HikvisionAuthResult> {
        try {
            const baseUrl = this.buildBaseUrl(config);

            // First, try to get device capabilities
            const capabilitiesUrl = `${baseUrl}/ISAPI/System/capabilities`;
            const authResult = await this.makeAuthenticatedRequest(
                capabilitiesUrl,
                config.username,
                config.password
            );

            if (authResult.success) {
                // Extract device info from capabilities response
                const deviceInfo = this.extractDeviceInfo(authResult.data);

                // Create session token
                const sessionToken = this.generateSessionToken();
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                // Store active session
                const deviceAuth: HikvisionDeviceAuth = {
                    deviceId: config.ipAddress,
                    authToken: authResult.authToken,
                    sessionToken,
                    expiresAt,
                    isActive: true,
                };

                this.activeAuthSessions.set(config.ipAddress, deviceAuth);

                return {
                    success: true,
                    authToken: authResult.authToken,
                    sessionToken,
                    expiresAt,
                    deviceInfo,
                };
            }

            return authResult;
        } catch (error) {
            this.logger.error(
                `Hikvision authentication failed for ${config.ipAddress}`,
                error.stack
            );
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Validate existing session
     */
    async validateSession(deviceId: string, sessionToken: string): Promise<boolean> {
        const session = this.activeAuthSessions.get(deviceId);

        if (!session || !session.isActive) {
            return false;
        }

        if (session.expiresAt && new Date() > session.expiresAt) {
            this.activeAuthSessions.delete(deviceId);
            return false;
        }

        return session.sessionToken === sessionToken;
    }

    /**
     * Refresh authentication token
     */
    async refreshToken(deviceId: string): Promise<HikvisionAuthResult> {
        const session = this.activeAuthSessions.get(deviceId);

        if (!session) {
            return {
                success: false,
                error: 'No active session found',
            };
        }

        // Get device config from database or config service
        const deviceConfig = await this.getDeviceConfig(deviceId);
        if (!deviceConfig) {
            return {
                success: false,
                error: 'Device configuration not found',
            };
        }

        // Re-authenticate
        return this.authenticateDevice(deviceConfig);
    }

    /**
     * Logout and invalidate session
     */
    async logout(deviceId: string): Promise<void> {
        const session = this.activeAuthSessions.get(deviceId);

        if (session) {
            try {
                // Call logout endpoint if available
                const baseUrl = this.buildBaseUrl({ ipAddress: deviceId } as HikvisionAuthConfig);
                const logoutUrl = `${baseUrl}/ISAPI/Security/session/logout`;

                await this.makeAuthenticatedRequest(
                    logoutUrl,
                    '', // credentials should be retrieved securely
                    '',
                    session.authToken
                );
            } catch (error) {
                this.logger.warn(`Logout request failed for ${deviceId}`, error.stack);
            } finally {
                this.activeAuthSessions.delete(deviceId);
            }
        }
    }

    /**
     * Get device status and authentication health
     */
    async getDeviceHealth(deviceId: string): Promise<{
        isConnected: boolean;
        isAuthValid: boolean;
        lastCheck: Date;
        responseTime?: number;
        error?: string;
    }> {
        const session = this.activeAuthSessions.get(deviceId);
        const startTime = Date.now();

        if (!session || !session.isActive) {
            return {
                isConnected: false,
                isAuthValid: false,
                lastCheck: new Date(),
                error: 'No active session',
            };
        }

        try {
            const baseUrl = this.buildBaseUrl({ ipAddress: deviceId } as HikvisionAuthConfig);
            const statusUrl = `${baseUrl}/ISAPI/System/status`;

            const response = await this.makeAuthenticatedRequest(
                statusUrl,
                '',
                '',
                session.authToken
            );

            const responseTime = Date.now() - startTime;

            return {
                isConnected: response.success,
                isAuthValid: response.success,
                lastCheck: new Date(),
                responseTime,
                error: response.error,
            };
        } catch (error) {
            return {
                isConnected: false,
                isAuthValid: false,
                lastCheck: new Date(),
                error: error.message,
            };
        }
    }

    private async makeAuthenticatedRequest(
        url: string,
        username: string,
        password: string,
        existingToken?: string
    ): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Use existing token if available
        if (existingToken) {
            headers['Authorization'] = `Bearer ${existingToken}`;
        } else if (username && password) {
            // Try Basic Auth first
            const credentials = Buffer.from(`${username}:${password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                // Try Digest Auth if Basic fails
                if (username && password && !existingToken) {
                    return this.tryDigestAuth(url, username, password);
                }
                throw new UnauthorizedException('Authentication failed');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.text();

            // Hikvision typically returns XML, try to parse it
            try {
                if (data.trim().startsWith('<')) {
                    return this.parseHikvisionXml(data);
                }
                return JSON.parse(data);
            } catch {
                return { raw: data };
            }
        } catch (error) {
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    private async tryDigestAuth(url: string, username: string, password: string): Promise<any> {
        // Simplified digest authentication implementation
        // In production, use a proper digest auth library
        throw new Error('Digest authentication not implemented yet');
    }

    private buildBaseUrl(config: HikvisionAuthConfig): string {
        const protocol = config.useHttps ? 'https' : 'http';
        const port = config.port || (config.useHttps ? 443 : 80);
        return `${protocol}://${config.ipAddress}:${port}`;
    }

    private generateSessionToken(): string {
        return Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
    }

    private extractDeviceInfo(data: any) {
        // Extract device information from Hikvision response
        return {
            modelName: data.modelName || 'Unknown',
            serialNumber: data.serialNumber || 'Unknown',
            firmwareVersion: data.firmwareVersion || 'Unknown',
            supportedFeatures: data.supportedFeatures || [],
        };
    }

    private parseHikvisionXml(xmlString: string): any {
        // Parse Hikvision XML response
        // This is a simplified parser - use a proper XML parser in production
        const result: any = {};

        // Simple regex-based parsing for demonstration
        const modelMatch = xmlString.match(/<model>(.*?)<\/model>/);
        const serialMatch = xmlString.match(/<serialNumber>(.*?)<\/serialNumber>/);
        const firmwareMatch = xmlString.match(/<firmwareVersion>(.*?)<\/firmwareVersion>/);

        if (modelMatch) result.modelName = modelMatch[1];
        if (serialMatch) result.serialNumber = serialMatch[1];
        if (firmwareMatch) result.firmwareVersion = firmwareMatch[1];

        return result;
    }

    private async getDeviceConfig(deviceId: string): Promise<HikvisionAuthConfig | null> {
        // In a real implementation, this would fetch from database
        // For now, return null to indicate config not found
        return null;
    }
}
