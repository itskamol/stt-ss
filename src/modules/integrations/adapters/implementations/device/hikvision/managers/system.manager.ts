import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import {
    UserInfo,
    UserList,
    UserCheckResponse,
    CardReaderCfg,
    WiegandCfg,
    FaceCompareCond,
    IdentityTerminal,
    ISAPIResponse,
    ISAPIXMLResponse,
} from '../types';

@Injectable()
export class HikvisionSystemManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    // ==================== User Management ====================

    /**
     * Check user credentials via digest authentication
     */
    async checkUser(device: any): Promise<UserCheckResponse> {
        try {
            this.logger.debug('Checking user credentials', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/Security/userCheck',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('User check completed', {
                deviceId: device.id,
                statusValue: jsonResponse.userCheck?.statusValue,
            });

            return jsonResponse.userCheck;
        } catch (error) {
            this.logger.error('Failed to check user credentials', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get all users
     */
    async getAllUsers(device: any): Promise<UserInfo[]> {
        try {
            this.logger.debug('Getting all users', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/Security/users',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);
            const users = jsonResponse.UserList?.User || [];
            const userArray = Array.isArray(users) ? users : [users];

            this.logger.debug('All users retrieved', {
                deviceId: device.id,
                count: userArray.length,
            });

            return userArray;
        } catch (error) {
            this.logger.error('Failed to get all users', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get single user
     */
    async getUser(device: any, indexID: number): Promise<UserInfo> {
        try {
            this.logger.debug('Getting user', { deviceId: device.id, indexID });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: `/ISAPI/Security/users/${indexID}`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('User retrieved', {
                deviceId: device.id,
                indexID,
                userName: jsonResponse.User?.userName,
            });

            return jsonResponse.User;
        } catch (error) {
            this.logger.error('Failed to get user', error.message, {
                deviceId: device.id,
                indexID,
            });
            throw error;
        }
    }

    /**
     * Set single user
     */
    async setUser(device: any, indexID: number, userInfo: UserInfo): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting user', {
                deviceId: device.id,
                indexID,
                userName: userInfo.userName,
            });

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml({ User: userInfo }, 'User');

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: `/ISAPI/Security/users/${indexID}`,
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('User set successfully', {
                deviceId: device.id,
                indexID,
                userName: userInfo.userName,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set user', error.message, {
                deviceId: device.id,
                indexID,
                userName: userInfo.userName,
            });
            throw error;
        }
    }

    /**
     * Set all users
     */
    async setAllUsers(device: any, users: UserInfo[]): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting all users', { deviceId: device.id, count: users.length });

            const userList: UserList = { User: users };

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml({ UserList: userList }, 'UserList');

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/Security/users',
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('All users set successfully', {
                deviceId: device.id,
                count: users.length,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set all users', error.message, {
                deviceId: device.id,
                count: users.length,
            });
            throw error;
        }
    }

    /**
     * Get user capabilities
     */
    async getUserCapabilities(device: any, indexID: number): Promise<any> {
        try {
            this.logger.debug('Getting user capabilities', { deviceId: device.id, indexID });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: `/ISAPI/Security/users/${indexID}/capabilities`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            return jsonResponse.User;
        } catch (error) {
            this.logger.error('Failed to get user capabilities', error.message, {
                deviceId: device.id,
                indexID,
            });
            throw error;
        }
    }

    // ==================== Card Reader Configuration ====================

    /**
     * Get card reader configuration capabilities
     */
    async getCardReaderCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting card reader capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/CardReaderCfg/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get card reader capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get card reader configuration
     */
    async getCardReaderConfig(device: any, cardReaderID: number): Promise<CardReaderCfg> {
        try {
            this.logger.debug('Getting card reader config', { deviceId: device.id, cardReaderID });

            const response = await this.httpClient.request<{ CardReaderCfg: CardReaderCfg }>(
                device,
                {
                    method: 'GET',
                    url: `/ISAPI/AccessControl/CardReaderCfg/${cardReaderID}?format=json`,
                }
            );

            this.logger.debug('Card reader config retrieved', {
                deviceId: device.id,
                cardReaderID,
            });

            return response.CardReaderCfg;
        } catch (error) {
            this.logger.error('Failed to get card reader config', error.message, {
                deviceId: device.id,
                cardReaderID,
            });
            throw error;
        }
    }

    /**
     * Set card reader configuration
     */
    async setCardReaderConfig(
        device: any,
        cardReaderID: number,
        config: CardReaderCfg
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting card reader config', { deviceId: device.id, cardReaderID });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/CardReaderCfg/${cardReaderID}?format=json`,
                data: { CardReaderCfg: config },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Card reader config set successfully', {
                deviceId: device.id,
                cardReaderID,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set card reader config', error.message, {
                deviceId: device.id,
                cardReaderID,
            });
            throw error;
        }
    }

    // ==================== Wiegand Configuration ====================

    /**
     * Get Wiegand capabilities
     */
    async getWiegandCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting Wiegand capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/WiegandCfg/capabilities',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            return jsonResponse.WiegandCfg;
        } catch (error) {
            this.logger.error('Failed to get Wiegand capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get Wiegand parameters
     */
    async getWiegandConfig(device: any, wiegandID: number): Promise<WiegandCfg> {
        try {
            this.logger.debug('Getting Wiegand config', { deviceId: device.id, wiegandID });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: `/ISAPI/AccessControl/WiegandCfg/wiegandNo/${wiegandID}`,
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Wiegand config retrieved', {
                deviceId: device.id,
                wiegandID,
            });

            return jsonResponse.WiegandCfg;
        } catch (error) {
            this.logger.error('Failed to get Wiegand config', error.message, {
                deviceId: device.id,
                wiegandID,
            });
            throw error;
        }
    }

    /**
     * Set Wiegand parameters
     */
    async setWiegandConfig(
        device: any,
        wiegandID: number,
        config: WiegandCfg
    ): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting Wiegand config', { deviceId: device.id, wiegandID });

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml({ WiegandCfg: config }, 'WiegandCfg');

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/WiegandCfg/wiegandNo/${wiegandID}`,
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Wiegand config set successfully', {
                deviceId: device.id,
                wiegandID,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set Wiegand config', error.message, {
                deviceId: device.id,
                wiegandID,
            });
            throw error;
        }
    }

    // ==================== Face Compare Configuration ====================

    /**
     * Get face compare condition capabilities
     */
    async getFaceCompareCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting face compare capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/FaceCompareCond/capabilities',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            return jsonResponse.FaceCompareCond;
        } catch (error) {
            this.logger.error('Failed to get face compare capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get face compare condition parameters
     */
    async getFaceCompareCondition(device: any): Promise<FaceCompareCond> {
        try {
            this.logger.debug('Getting face compare condition', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/FaceCompareCond',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Face compare condition retrieved', {
                deviceId: device.id,
            });

            return jsonResponse.FaceCompareCond;
        } catch (error) {
            this.logger.error('Failed to get face compare condition', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set face compare condition parameters
     */
    async setFaceCompareCondition(
        device: any,
        condition: FaceCompareCond
    ): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting face compare condition', { deviceId: device.id });

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml(
                { FaceCompareCond: condition },
                'FaceCompareCond'
            );

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/FaceCompareCond',
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Face compare condition set successfully', {
                deviceId: device.id,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set face compare condition', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    // ==================== Identity Terminal Configuration ====================

    /**
     * Get identity terminal capabilities
     */
    async getIdentityTerminalCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting identity terminal capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/IdentityTerminal/capabilities',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            return jsonResponse.IdentityTerminal;
        } catch (error) {
            this.logger.error('Failed to get identity terminal capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get identity terminal parameters
     */
    async getIdentityTerminal(device: any): Promise<IdentityTerminal> {
        try {
            this.logger.debug('Getting identity terminal', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/IdentityTerminal',
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Identity terminal retrieved', {
                deviceId: device.id,
            });

            return jsonResponse.IdentityTerminal;
        } catch (error) {
            this.logger.error('Failed to get identity terminal', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set identity terminal parameters
     */
    async setIdentityTerminal(device: any, terminal: IdentityTerminal): Promise<ISAPIXMLResponse> {
        try {
            this.logger.debug('Setting identity terminal', { deviceId: device.id });

            // Convert to XML format
            const xmlData = this.xmlJsonService.jsonToXml(
                { IdentityTerminal: terminal },
                'IdentityTerminal'
            );

            const response = await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/IdentityTerminal',
                data: xmlData,
                headers: {
                    'Content-Type': 'application/xml',
                },
            });

            // Parse XML response
            const jsonResponse = await this.xmlJsonService.xmlToJson(response as string);

            this.logger.debug('Identity terminal set successfully', {
                deviceId: device.id,
                statusCode: jsonResponse.ResponseStatus?.statusCode,
            });

            return jsonResponse.ResponseStatus;
        } catch (error) {
            this.logger.error('Failed to set identity terminal', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    // ==================== NFC Configuration ====================

    /**
     * Get NFC configuration capabilities
     */
    async getNFCCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting NFC capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Configuration/NFCCfg/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get NFC capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get card verification rule capabilities
     */
    async getCardVerificationRuleCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting card verification rule capabilities', {
                deviceId: device.id,
            });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/CardVerificationRule/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get card verification rule capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Create basic user configuration
     */
    createBasicUser(
        id: number,
        userName: string,
        password: string,
        userLevel: 'Administrator' | 'Operator' | 'Viewer' = 'Operator',
        enabled: boolean = true
    ): UserInfo {
        return {
            id,
            enabled,
            userName,
            password,
            userLevel,
        };
    }

    /**
     * Create basic card reader configuration
     */
    createBasicCardReaderConfig(options: Partial<CardReaderCfg> = {}): CardReaderCfg {
        return {
            enable: true,
            okLedPolarity: 'cathode',
            errorLedPolarity: 'cathode',
            buzzerPolarity: 'cathode',
            swipeInterval: 3,
            pressTimeout: 5,
            enableFailAlarm: false,
            maxReadCardFailNum: 5,
            enableTamperCheck: false,
            offlineCheckTime: 30,
            fingerPrintCheckLevel: 5,
            useLocalController: false,
            localControllerID: 1,
            localControllerReaderID: 1,
            cardReaderChannel: 1,
            fingerPrintImageQuality: 5,
            fingerPrintContrastTimeOut: 10,
            fingerPrintRecogizeInterval: 2,
            fingerPrintMatchFastMode: 1,
            fingerPrintModuleSensitive: 5,
            fingerPrintModuleLightCondition: 'indoor',
            faceMatchThresholdN: 80,
            faceQuality: 50,
            faceRecogizeTimeOut: 10,
            faceRecogizeInterval: 2,
            cardReaderFunction: ['card', 'face', 'fingerPrint'],
            cardReaderDescription: 'Default Card Reader',
            faceImageSensitometry: 50,
            livingBodyDetect: true,
            faceMatchThreshold1: 80,
            buzzerTime: 1000,
            faceMatch1SecurityLevel: 2,
            faceMatchNSecurityLevel: 2,
            envirMode: 'indoor',
            liveDetLevelSet: 'middle',
            liveDetAntiAttackCntLimit: 3,
            enableLiveDetAntiAttack: true,
            supportDelFPByID: true,
            fingerPrintCapacity: 1000,
            fingerPrintNum: 0,
            defaultVerifyMode: 'cardOrFaceOrFp',
            faceRecogizeEnable: 1,
            FPAlgorithmVersion: '1.0',
            cardReaderVersion: '1.0',
            enableReverseCardNo: false,
            independSwipeIntervals: 0,
            maskFaceMatchThresholdN: 70,
            maskFaceMatchThreshold1: 70,
            faceMotionDetLevel: 'meduim',
            showMode: 'normal',
            enableScreenOff: false,
            screenOffTimeout: 30,
            ...options,
        };
    }

    /**
     * Create basic Wiegand configuration
     */
    createBasicWiegandConfig(options: Partial<WiegandCfg> = {}): WiegandCfg {
        return {
            communicateDirection: 'receive',
            wiegandMode: 'wiegand26',
            inputWiegandMode: 'wiegand26',
            signalInterval: 2,
            enable: true,
            pulseDuration: 100,
            facilityCodeEnabled: false,
            facilityCode: 0,
            dataType: 'employeeNo',
            ...options,
        };
    }
}
