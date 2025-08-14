import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';

export interface CardInfo {
    id: string;
    cardNo: string;
    userId: string;
    cardType: 'normal' | 'super' | 'guest' | 'patrol';
    validFrom: Date;
    validTo: Date;
    isActive: boolean;
}

export interface AddCardRequest {
    cardNo: string;
    userId: string;
    cardType?: 'normal' | 'super' | 'guest' | 'patrol';
    validFrom?: Date;
    validTo?: Date;
    employeeNo?: string;
}

@Injectable()
export class HikvisionCardManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService
    ) {}

    /**
     * Add card to device
     */
    async addCard(device: any, request: AddCardRequest): Promise<CardInfo> {
        try {
            this.logger.debug('Adding card', {
                deviceId: device.id,
                cardNo: request.cardNo,
                userId: request.userId,
                module: 'hikvision-card-manager',
            });

            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/CardInfo/Record',
                data: {
                    CardInfo: {
                        employeeNo: request.employeeNo || request.userId,
                        cardNo: request.cardNo,
                        cardType: request.cardType || 'normal',
                        leaderCard: request.cardType === 'super' ? 'true' : 'false',
                        userType: 'normal',
                        Valid: {
                            enable: true,
                            beginTime: request.validFrom?.toISOString() || new Date().toISOString(),
                            endTime:
                                request.validTo?.toISOString() ||
                                new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                            timeType: 'local',
                        },
                    },
                },
            });

            return {
                id: response.data.employeeNo,
                cardNo: request.cardNo,
                userId: request.userId,
                cardType: request.cardType || 'normal',
                validFrom: request.validFrom || new Date(),
                validTo: request.validTo || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                isActive: true,
            };
        } catch (error) {
            this.logger.error('Failed to add card', error.message, {
                deviceId: device.id,
                cardNo: request.cardNo,
                userId: request.userId,
                module: 'hikvision-card-manager',
            });
            throw error;
        }
    }

    /**
     * Delete card from device
     */
    async deleteCard(device: any, cardNo: string): Promise<void> {
        try {
            await this.httpClient.request<any>(device, {
                method: 'DELETE',
                url: `/ISAPI/AccessControl/CardInfo/Delete?cardNo=${cardNo}`,
            });

            this.logger.debug('Card deleted', {
                deviceId: device.id,
                cardNo,
                module: 'hikvision-card-manager',
            });
        } catch (error) {
            this.logger.error('Failed to delete card', error.message, {
                deviceId: device.id,
                cardNo,
                module: 'hikvision-card-manager',
            });
            throw error;
        }
    }

    /**
     * Get cards from device
     */
    async getCards(device: any, userId?: string): Promise<CardInfo[]> {
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
                    },
                },
            });

            return (
                response.data.CardInfoSearch?.CardInfo?.map((card: any) => ({
                    id: card.employeeNo,
                    cardNo: card.cardNo,
                    userId: card.employeeNo,
                    cardType: card.cardType,
                    validFrom: new Date(card.Valid.beginTime),
                    validTo: new Date(card.Valid.endTime),
                    isActive: card.Valid.enable,
                })) || []
            );
        } catch (error) {
            this.logger.error('Failed to get cards', error.message, {
                deviceId: device.id,
                userId,
                module: 'hikvision-card-manager',
            });
            throw error;
        }
    }

    /**
     * Update card information
     */
    async updateCard(
        device: any,
        cardNo: string,
        updates: Partial<AddCardRequest>
    ): Promise<CardInfo> {
        try {
            // Get existing card info first
            const existingCards = await this.getCards(device);
            const existingCard = existingCards.find(c => c.cardNo === cardNo);

            if (!existingCard) {
                throw new Error(`Card ${cardNo} not found`);
            }

            // Delete old card
            await this.deleteCard(device, cardNo);

            // Add updated card
            return await this.addCard(device, {
                cardNo,
                userId: existingCard.userId,
                cardType: updates.cardType || existingCard.cardType,
                validFrom: updates.validFrom || existingCard.validFrom,
                validTo: updates.validTo || existingCard.validTo,
                employeeNo: updates.employeeNo,
            });
        } catch (error) {
            this.logger.error('Failed to update card', error.message, {
                deviceId: device.id,
                cardNo,
                module: 'hikvision-card-manager',
            });
            throw error;
        }
    }

    /**
     * Block/Unblock card
     */
    async setCardStatus(device: any, cardNo: string, isActive: boolean): Promise<void> {
        try {
            const cards = await this.getCards(device);
            const card = cards.find(c => c.cardNo === cardNo);

            if (!card) {
                throw new Error(`Card ${cardNo} not found`);
            }

            await this.httpClient.request<any>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/CardInfo/Modify',
                data: {
                    CardInfo: {
                        employeeNo: card.userId,
                        cardNo: cardNo,
                        cardType: card.cardType,
                        Valid: {
                            enable: isActive,
                            beginTime: card.validFrom.toISOString(),
                            endTime: card.validTo.toISOString(),
                            timeType: 'local',
                        },
                    },
                },
            });

            this.logger.debug('Card status updated', {
                deviceId: device.id,
                cardNo,
                isActive,
                module: 'hikvision-card-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update card status', error.message, {
                deviceId: device.id,
                cardNo,
                isActive,
                module: 'hikvision-card-manager',
            });
            throw error;
        }
    }
}
