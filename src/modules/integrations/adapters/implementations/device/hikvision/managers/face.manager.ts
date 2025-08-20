import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { Device } from '@prisma/client';

export interface FaceTemplate {
    id: string;
    userId: string;
    faceData: string;
    quality: number;
    createdAt: Date;
}

export interface AddFaceRequest {
    userId: string;
    faceData: string;
    employeeNo?: string;
}

export interface FaceSearchResult {
    userId: string;
    similarity: number;
    faceId: string;
}

@Injectable()
export class HikvisionFaceManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    /**
     * Add face template to device
     */
    async addFace(device: Device, request: AddFaceRequest): Promise<FaceTemplate> {
        try {
            this.logger.debug('Adding face template', {
                deviceId: device.id,
                userId: request.userId,
                module: 'hikvision-face-manager',
            });

            // First check if face recognition is supported
            const isSupported = await this.checkFaceRecognitionSupport(device);
            if (!isSupported) {
                throw new Error('Face recognition is not supported on this device');
            }

            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url: '/ISAPI/Intelligent/FDLib/FaceDataRecord',
                data: {
                    faceLibType: 'blackFD',
                    FDID: request.userId,
                    faceURL: request.faceData,
                    name: request.employeeNo || request.userId,
                },
            });

            return {
                id: response.data.FDID,
                userId: request.userId,
                faceData: request.faceData,
                quality: response.data.faceQuality || 0,
                createdAt: new Date(),
            };
        } catch (error) {
            this.logger.error('Failed to add face template', error.message, {
                deviceId: device.id,
                userId: request.userId,
                module: 'hikvision-face-manager',
            });
            throw error;
        }
    }

    /**
     * Delete face template from device
     */
    async deleteFace(device: Device, faceId: string): Promise<void> {
        try {
            // First check if face recognition is supported
            const isSupported = await this.checkFaceRecognitionSupport(device);
            if (!isSupported) {
                throw new Error('Face recognition is not supported on this device');
            }

            await this.httpClient.request(device, {
                method: 'DELETE',
                url: `/ISAPI/Intelligent/FDLib/FaceDataRecord?FDID=${faceId}`,
            });

            this.logger.debug('Face template deleted', {
                deviceId: device.id,
                faceId,
                module: 'hikvision-face-manager',
            });
        } catch (error) {
            this.logger.error('Failed to delete face template', error.message, {
                deviceId: device.id,
                faceId,
                module: 'hikvision-face-manager',
            });
            throw error;
        }
    }

    /**
     * Get all face templates from device
     */
    async getFaces(device: Device, userId?: string): Promise<FaceTemplate[]> {
        try {
            // First check if face recognition is supported
            const isSupported = await this.checkFaceRecognitionSupport(device);
            if (!isSupported) {
                this.logger.warn('Face recognition is not supported on this device', {
                    deviceId: device.id,
                    module: 'hikvision-face-manager',
                });
                return [];
            }

            const url = userId
                ? `/ISAPI/Intelligent/FDLib/FaceDataRecord?FDID=${userId}`
                : '/ISAPI/Intelligent/FDLib/FaceDataRecord';

            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url,
            });

            return (
                response.data.FaceDataRecord?.map((face: any) => ({
                    id: face.FDID,
                    userId: face.FDID,
                    faceData: face.faceURL,
                    quality: face.faceQuality || 0,
                    createdAt: new Date(face.addTime),
                })) || []
            );
        } catch (error) {
            this.logger.error('Failed to get face templates', error.message, {
                deviceId: device.id,
                userId,
                module: 'hikvision-face-manager',
            });
            // Return empty array if face recognition is not supported
            if (error.message.includes('notSupport') || error.message.includes('Invalid Operation')) {
                return [];
            }
            throw error;
        }
    }

    /**
     * Search face in device database
     */
    async searchFace(
        device: Device,
        faceData: string,
        threshold: number = 80
    ): Promise<FaceSearchResult[]> {
        try {
            // First check if face recognition is supported
            const isSupported = await this.checkFaceRecognitionSupport(device);
            if (!isSupported) {
                throw new Error('Face recognition is not supported on this device');
            }

            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url: '/ISAPI/Intelligent/FDLib/FDSearch',
                data: {
                    searchResultPosition: 0,
                    maxResults: 10,
                    faceLibType: 'blackFD',
                    FDID: 'search_temp',
                    faceURL: faceData,
                    similarityThreshold: threshold,
                },
            });

            return (
                response.data.MatchList?.map((match: any) => ({
                    userId: match.FDID,
                    similarity: match.similarity,
                    faceId: match.FDID,
                })) || []
            );
        } catch (error) {
            this.logger.error('Failed to search face', error.message, {
                deviceId: device.id,
                threshold,
                module: 'hikvision-face-manager',
            });
            throw error;
        }
    }

    /**
     * Update face template
     */
    async updateFace(device: Device, faceId: string, faceData: string): Promise<FaceTemplate> {
        try {
            // First check if face recognition is supported
            const isSupported = await this.checkFaceRecognitionSupport(device);
            if (!isSupported) {
                throw new Error('Face recognition is not supported on this device');
            }

            // First delete old face
            await this.deleteFace(device, faceId);

            // Then add new face with same ID
            return await this.addFace(device, {
                userId: faceId,
                faceData,
            });
        } catch (error) {
            this.logger.error('Failed to update face template', error.message, {
                deviceId: device.id,
                faceId,
                module: 'hikvision-face-manager',
            });
            throw error;
        }
    }

    /**
     * Check if face recognition is supported on this device
     */
    private async checkFaceRecognitionSupport(device: Device): Promise<boolean> {
        try {
            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/capabilities',
            });

            // Parse XML response
            if (typeof response === 'string' && response.includes('<?xml')) {
                const jsonResponse = await this.xmlJsonService.xmlToJson(response);
                return jsonResponse.AccessControl?.isSupportFaceRecognizeMode === 'true';
            }

            return response.AccessControl?.isSupportFaceRecognizeMode === 'true';
        } catch (error) {
            this.logger.debug('Could not check face recognition support', {
                deviceId: device.id,
                module: 'hikvision-face-manager',
            });
            return false;
        }
    }
}
