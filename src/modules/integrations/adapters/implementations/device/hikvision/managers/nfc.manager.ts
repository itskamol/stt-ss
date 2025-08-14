import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';

export interface NFCInfo {
    id: string;
    nfcId: string;
    userId: string;
    nfcType: 'mifare' | 'desfire' | 'ntag' | 'other';
    validFrom: Date;
    validTo: Date;
    isActive: boolean;
    accessLevel: number;
}

export interface AddNFCRequest {
    nfcId: string;
    userId: string;
    nfcType?: 'mifare' | 'desfire' | 'ntag' | 'other';
    validFrom?: Date;
    validTo?: Date;
    accessLevel?: number;
    employeeNo?: string;
}

@Injectable()
export class HikvisionNFCManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService
    ) {}

    /**
     * Add NFC tag to device
     */
    async addNFC(device: any, request: AddNFCRequest): Promise<NFCInfo> {
        try {
            this.logger.debug('Adding NFC tag', {
                deviceId: device.id,
                nfcId: request.nfcId,
                userId: request.userId,
                module: 'hikvision-nfc-manager',
            });

            // Hikvision treats NFC similar to cards in most cases
            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/CardInfo/Record',
                data: {
                    CardInfo: {
                        employeeNo: request.employeeNo || request.userId,
                        cardNo: request.nfcId,
                        cardType: 'normal',
                        cardReaderType: 'nfc',
                        userType: 'normal',
                        Valid: {
                            enable: true,
                            beginTime: request.validFrom?.toISOString() || new Date().toISOString(),
                            endTime:
                                request.validTo?.toISOString() ||
                                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                            timeType: 'local',
                        },
                        accessLevel: request.accessLevel || 1,
                    },
                },
            });

            return {
                id: response.data.employeeNo,
                nfcId: request.nfcId,
                userId: request.userId,
                nfcType: request.nfcType || 'mifare',
                validFrom: request.validFrom || new Date(),
                validTo: request.validTo || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                isActive: true,
                accessLevel: request.accessLevel || 1,
            };
        } catch (error) {
            this.logger.error('Failed to add NFC tag', error.message, {
                deviceId: device.id,
                nfcId: request.nfcId,
                userId: request.userId,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Delete NFC tag from device
     */
    async deleteNFC(device: any, nfcId: string): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'DELETE',
                url: `/ISAPI/AccessControl/CardInfo/Delete?cardNo=${nfcId}`,
            });

            this.logger.debug('NFC tag deleted', {
                deviceId: device.id,
                nfcId,
                module: 'hikvision-nfc-manager',
            });
        } catch (error) {
            this.logger.error('Failed to delete NFC tag', error.message, {
                deviceId: device.id,
                nfcId,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Get NFC tags from device
     */
    async getNFCs(device: any, userId?: string): Promise<NFCInfo[]> {
        try {
            const url = userId
                ? `/ISAPI/AccessControl/CardInfo/Search?employeeNo=${userId}`
                : '/ISAPI/AccessControl/CardInfo/Search';

            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url,
                data: {
                    CardInfoSearchCond: {
                        searchID: '1',
                        searchResultPosition: 0,
                        maxResults: 100,
                        cardReaderType: 'nfc', // Filter for NFC only
                    },
                },
            });

            return (
                response.data.CardInfoSearch?.CardInfo?.map((nfc: any) => ({
                    id: nfc.employeeNo,
                    nfcId: nfc.cardNo,
                    userId: nfc.employeeNo,
                    nfcType: this.detectNFCType(nfc.cardNo),
                    validFrom: new Date(nfc.Valid.beginTime),
                    validTo: new Date(nfc.Valid.endTime),
                    isActive: nfc.Valid.enable,
                    accessLevel: nfc.accessLevel || 1,
                })) || []
            );
        } catch (error) {
            this.logger.error('Failed to get NFC tags', error.message, {
                deviceId: device.id,
                userId,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Update NFC tag information
     */
    async updateNFC(device: any, nfcId: string, updates: Partial<AddNFCRequest>): Promise<NFCInfo> {
        try {
            // Get existing NFC info first
            const existingNFCs = await this.getNFCs(device);
            const existingNFC = existingNFCs.find(n => n.nfcId === nfcId);

            if (!existingNFC) {
                throw new Error(`NFC tag ${nfcId} not found`);
            }

            // Delete old NFC
            await this.deleteNFC(device, nfcId);

            // Add updated NFC
            return await this.addNFC(device, {
                nfcId,
                userId: existingNFC.userId,
                nfcType: updates.nfcType || existingNFC.nfcType,
                validFrom: updates.validFrom || existingNFC.validFrom,
                validTo: updates.validTo || existingNFC.validTo,
                accessLevel: updates.accessLevel || existingNFC.accessLevel,
                employeeNo: updates.employeeNo,
            });
        } catch (error) {
            this.logger.error('Failed to update NFC tag', error.message, {
                deviceId: device.id,
                nfcId,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Set NFC tag status (active/inactive)
     */
    async setNFCStatus(device: any, nfcId: string, isActive: boolean): Promise<void> {
        try {
            const nfcs = await this.getNFCs(device);
            const nfc = nfcs.find(n => n.nfcId === nfcId);

            if (!nfc) {
                throw new Error(`NFC tag ${nfcId} not found`);
            }

            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/CardInfo/Modify',
                data: {
                    CardInfo: {
                        employeeNo: nfc.userId,
                        cardNo: nfcId,
                        cardType: 'normal',
                        cardReaderType: 'nfc',
                        Valid: {
                            enable: isActive,
                            beginTime: nfc.validFrom.toISOString(),
                            endTime: nfc.validTo.toISOString(),
                            timeType: 'local',
                        },
                        accessLevel: nfc.accessLevel,
                    },
                },
            });

            this.logger.debug('NFC tag status updated', {
                deviceId: device.id,
                nfcId,
                isActive,
                module: 'hikvision-nfc-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update NFC tag status', error.message, {
                deviceId: device.id,
                nfcId,
                isActive,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Read NFC tag information (when tag is presented to reader)
     */
    async readNFC(
        device: any,
        timeout: number = 30000
    ): Promise<{ nfcId: string; nfcType: string } | null> {
        try {
            this.logger.debug('Starting NFC read operation', {
                deviceId: device.id,
                timeout,
                module: 'hikvision-nfc-manager',
            });

            // Start NFC read mode
            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/RemoteControl/door/1',
                data: {
                    cmd: 'nfcRead',
                    timeout: timeout,
                },
            });

            // Poll for result (simplified - in real implementation you'd use events)
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                try {
                    const response = await this.httpClient.request<any>(device, {
                        method: 'GET',
                        url: '/ISAPI/AccessControl/RemoteControl/door/1/status',
                    });

                    if (response.data.nfcReadResult) {
                        return {
                            nfcId: response.data.nfcReadResult.nfcId,
                            nfcType: this.detectNFCType(response.data.nfcReadResult.nfcId),
                        };
                    }
                } catch (error) {
                    // Continue polling
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return null; // Timeout
        } catch (error) {
            this.logger.error('Failed to read NFC tag', error.message, {
                deviceId: device.id,
                timeout,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }

    /**
     * Detect NFC type based on ID pattern (simplified)
     */
    private detectNFCType(nfcId: string): 'mifare' | 'desfire' | 'ntag' | 'other' {
        // This is a simplified detection based on common patterns
        // In real implementation, you'd use proper NFC type detection

        if (nfcId.length === 8) {
            return 'mifare'; // MIFARE Classic typically has 4-byte UID
        } else if (nfcId.length === 14) {
            return 'desfire'; // MIFARE DESFire typically has 7-byte UID
        } else if (nfcId.length === 14 && nfcId.startsWith('04')) {
            return 'ntag'; // NTAG typically starts with 04
        }

        return 'other';
    }

    /**
     * Get NFC reader status
     */
    async getNFCReaderStatus(device: any): Promise<{
        isOnline: boolean;
        lastActivity: Date | null;
        errorCount: number;
    }> {
        try {
            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/CardReader/status',
            });

            return {
                isOnline: response.data.CardReader?.status === 'online',
                lastActivity: response.data.CardReader?.lastActivity
                    ? new Date(response.data.CardReader.lastActivity)
                    : null,
                errorCount: response.data.CardReader?.errorCount || 0,
            };
        } catch (error) {
            this.logger.error('Failed to get NFC reader status', error.message, {
                deviceId: device.id,
                module: 'hikvision-nfc-manager',
            });
            throw error;
        }
    }
}
