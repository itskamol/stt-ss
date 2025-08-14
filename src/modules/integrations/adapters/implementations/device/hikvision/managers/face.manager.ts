import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';

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
    ) {}

    /**
     * Add face template to device
     */
    async addFace(device: any, request: AddFaceRequest): Promise<FaceTemplate> {
        try {
            this.logger.debug('Adding face template', {
                deviceId: device.id,
                userId: request.userId,
                module: 'hikvision-face-manager',
            });

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
    async deleteFace(device: any, faceId: string): Promise<void> {
        try {
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
    async getFaces(device: any, userId?: string): Promise<FaceTemplate[]> {
        try {
            const url = userId 
                ? `/ISAPI/Intelligent/FDLib/FaceDataRecord?FDID=${userId}`
                : '/ISAPI/Intelligent/FDLib/FaceDataRecord';

            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url,
            });

            return response.data.FaceDataRecord?.map((face: any) => ({
                id: face.FDID,
                userId: face.FDID,
                faceData: face.faceURL,
                quality: face.faceQuality || 0,
                createdAt: new Date(face.addTime),
            })) || [];
        } catch (error) {
            this.logger.error('Failed to get face templates', error.message, {
                deviceId: device.id,
                userId,
                module: 'hikvision-face-manager',
            });
            throw error;
        }
    }

    /**
     * Search face in device database
     */
    async searchFace(device: any, faceData: string, threshold: number = 80): Promise<FaceSearchResult[]> {
        try {
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

            return response.data.MatchList?.map((match: any) => ({
                userId: match.FDID,
                similarity: match.similarity,
                faceId: match.FDID,
            })) || [];
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
    async updateFace(device: any, faceId: string, faceData: string): Promise<FaceTemplate> {
        try {
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
}