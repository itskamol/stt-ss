import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import {
    AttendanceWeekPlan,
    AttendancePlanTemplate,
    HolidayPlanCfg,
    ISAPIResponse,
} from '../types';

@Injectable()
export class HikvisionScheduleManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService
    ) {}

    // ==================== Week Plan Management ====================

    /**
     * Get week plan capabilities
     */
    async getWeekPlanCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting week plan capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Attendance/weekPlan/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get week plan capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set week attendance schedule parameters
     */
    async setWeekPlan(
        device: any,
        planNo: number,
        weekPlan: AttendanceWeekPlan
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting week plan', { deviceId: device.id, planNo });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/Attendance/weekPlan/${planNo}?format=json`,
                data: { AttendanceWeekPlan: weekPlan },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Week plan set successfully', {
                deviceId: device.id,
                planNo,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set week plan', error.message, {
                deviceId: device.id,
                planNo,
            });
            throw error;
        }
    }

    /**
     * Get week attendance schedule parameters
     */
    async getWeekPlan(device: any, planNo: number): Promise<AttendanceWeekPlan> {
        try {
            this.logger.debug('Getting week plan', { deviceId: device.id, planNo });

            const response = await this.httpClient.request<{
                AttendanceWeekPlan: AttendanceWeekPlan;
            }>(device, {
                method: 'GET',
                url: `/ISAPI/AccessControl/Attendance/weekPlan/${planNo}?format=json`,
            });

            this.logger.debug('Week plan retrieved', {
                deviceId: device.id,
                planNo,
            });

            return response.AttendanceWeekPlan;
        } catch (error) {
            this.logger.error('Failed to get week plan', error.message, {
                deviceId: device.id,
                planNo,
            });
            throw error;
        }
    }

    // ==================== Plan Template Management ====================

    /**
     * Get plan template capabilities
     */
    async getPlanTemplateCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting plan template capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Attendance/planTemplate/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get plan template capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Get list of all attendance schedule templates
     */
    async getAllPlanTemplates(device: any): Promise<AttendancePlanTemplate[]> {
        try {
            this.logger.debug('Getting all plan templates', { deviceId: device.id });

            const response = await this.httpClient.request<{
                AttendancePlanTemplateList: AttendancePlanTemplate[];
            }>(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Attendance/planTemplate?format=json',
            });

            this.logger.debug('Plan templates retrieved', {
                deviceId: device.id,
                count: response.AttendancePlanTemplateList?.length || 0,
            });

            return response.AttendancePlanTemplateList || [];
        } catch (error) {
            this.logger.error('Failed to get all plan templates', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set attendance schedule template parameters
     */
    async setPlanTemplate(
        device: any,
        templateNo: number,
        template: AttendancePlanTemplate
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting plan template', { deviceId: device.id, templateNo });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/Attendance/planTemplate/${templateNo}?format=json`,
                data: { AttendancePlanTemplate: template },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Plan template set successfully', {
                deviceId: device.id,
                templateNo,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set plan template', error.message, {
                deviceId: device.id,
                templateNo,
            });
            throw error;
        }
    }

    /**
     * Get attendance schedule template parameters
     */
    async getPlanTemplate(device: any, templateNo: number): Promise<AttendancePlanTemplate> {
        try {
            this.logger.debug('Getting plan template', { deviceId: device.id, templateNo });

            const response = await this.httpClient.request<{
                AttendancePlanTemplate: AttendancePlanTemplate;
            }>(device, {
                method: 'GET',
                url: `/ISAPI/AccessControl/Attendance/planTemplate/${templateNo}?format=json`,
            });

            this.logger.debug('Plan template retrieved', {
                deviceId: device.id,
                templateNo,
            });

            return response.AttendancePlanTemplate;
        } catch (error) {
            this.logger.error('Failed to get plan template', error.message, {
                deviceId: device.id,
                templateNo,
            });
            throw error;
        }
    }

    // ==================== Holiday Plan Management ====================

    /**
     * Get holiday plan capabilities
     */
    async getHolidayPlanCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting holiday plan capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/VerifyHolidayPlanCfg/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get holiday plan capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set holiday schedule parameters
     */
    async setHolidayPlan(
        device: any,
        holidayPlanID: number,
        holidayPlan: HolidayPlanCfg
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting holiday plan', { deviceId: device.id, holidayPlanID });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/VerifyHolidayPlanCfg/${holidayPlanID}?format=json`,
                data: { VerifyHolidayPlanCfg: holidayPlan },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Holiday plan set successfully', {
                deviceId: device.id,
                holidayPlanID,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set holiday plan', error.message, {
                deviceId: device.id,
                holidayPlanID,
            });
            throw error;
        }
    }

    /**
     * Get holiday schedule parameters
     */
    async getHolidayPlan(device: any, holidayPlanID: number): Promise<HolidayPlanCfg> {
        try {
            this.logger.debug('Getting holiday plan', { deviceId: device.id, holidayPlanID });

            const response = await this.httpClient.request<{
                VerifyHolidayPlanCfg: HolidayPlanCfg;
            }>(device, {
                method: 'GET',
                url: `/ISAPI/AccessControl/VerifyHolidayPlanCfg/${holidayPlanID}?format=json`,
            });

            this.logger.debug('Holiday plan retrieved', {
                deviceId: device.id,
                holidayPlanID,
            });

            return response.VerifyHolidayPlanCfg;
        } catch (error) {
            this.logger.error('Failed to get holiday plan', error.message, {
                deviceId: device.id,
                holidayPlanID,
            });
            throw error;
        }
    }

    // ==================== Attendance Mode Management ====================

    /**
     * Get attendance mode capabilities
     */
    async getAttendanceModeCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting attendance mode capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Configuration/attendanceMode/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get attendance mode capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set attendance mode parameters
     */
    async setAttendanceMode(
        device: any,
        attendanceMode: {
            mode: 'disable' | 'manual' | 'auto' | 'manualAndAuto';
            attendanceStatusTime: number;
            reqAttendanceStatus: boolean;
        }
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting attendance mode', {
                deviceId: device.id,
                mode: attendanceMode.mode,
            });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/Configuration/attendanceMode?format=json',
                data: { AttendanceMode: attendanceMode },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Attendance mode set successfully', {
                deviceId: device.id,
                mode: attendanceMode.mode,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set attendance mode', error.message, {
                deviceId: device.id,
                mode: attendanceMode.mode,
            });
            throw error;
        }
    }

    /**
     * Get attendance mode parameters
     */
    async getAttendanceMode(device: any): Promise<{
        mode: 'disable' | 'manual' | 'auto' | 'manualAndAuto';
        attendanceStatusTime: number;
        reqAttendanceStatus: boolean;
    }> {
        try {
            this.logger.debug('Getting attendance mode', { deviceId: device.id });

            const response = await this.httpClient.request<{
                AttendanceMode: {
                    mode: 'disable' | 'manual' | 'auto' | 'manualAndAuto';
                    attendanceStatusTime: number;
                    reqAttendanceStatus: boolean;
                };
            }>(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/Configuration/attendanceMode?format=json',
            });

            this.logger.debug('Attendance mode retrieved', {
                deviceId: device.id,
                mode: response.AttendanceMode.mode,
            });

            return response.AttendanceMode;
        } catch (error) {
            this.logger.error('Failed to get attendance mode', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    // ==================== Key Configuration Management ====================

    /**
     * Get key attendance capabilities
     */
    async getKeyAttendanceCapabilities(device: any): Promise<any> {
        try {
            this.logger.debug('Getting key attendance capabilities', { deviceId: device.id });

            const response = await this.httpClient.request(device, {
                method: 'GET',
                url: '/ISAPI/AccessControl/keyCfg/attendance/capabilities?format=json',
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to get key attendance capabilities', error.message, {
                deviceId: device.id,
            });
            throw error;
        }
    }

    /**
     * Set key attendance parameters
     */
    async setKeyAttendance(
        device: any,
        keyID: number,
        attendance: {
            enable: boolean;
            attendanceStatus:
                | 'checkIn'
                | 'checkOut'
                | 'breakOut'
                | 'breakIn'
                | 'overtimeIn'
                | 'overtimeOut';
            label: string;
        }
    ): Promise<ISAPIResponse> {
        try {
            this.logger.debug('Setting key attendance', { deviceId: device.id, keyID });

            const response = await this.httpClient.request<ISAPIResponse>(device, {
                method: 'PUT',
                url: `/ISAPI/AccessControl/keyCfg/${keyID}/attendance?format=json`,
                data: { Attendance: attendance },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            this.logger.debug('Key attendance set successfully', {
                deviceId: device.id,
                keyID,
                statusCode: response.statusCode,
            });

            return response;
        } catch (error) {
            this.logger.error('Failed to set key attendance', error.message, {
                deviceId: device.id,
                keyID,
            });
            throw error;
        }
    }

    /**
     * Get key attendance parameters
     */
    async getKeyAttendance(
        device: any,
        keyID: number
    ): Promise<{
        enable: boolean;
        attendanceStatus: string;
        label: string;
    }> {
        try {
            this.logger.debug('Getting key attendance', { deviceId: device.id, keyID });

            const response = await this.httpClient.request<{
                Attendance: {
                    enable: boolean;
                    attendanceStatus: string;
                    label: string;
                };
            }>(device, {
                method: 'GET',
                url: `/ISAPI/AccessControl/keyCfg/${keyID}/attendance?format=json`,
            });

            this.logger.debug('Key attendance retrieved', {
                deviceId: device.id,
                keyID,
            });

            return response.Attendance;
        } catch (error) {
            this.logger.error('Failed to get key attendance', error.message, {
                deviceId: device.id,
                keyID,
            });
            throw error;
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Create a basic week plan configuration
     */
    createBasicWeekPlan(
        timeSegments: Array<{
            week:
                | 'Monday'
                | 'Tuesday'
                | 'Wednesday'
                | 'Thursday'
                | 'Friday'
                | 'Saturday'
                | 'Sunday';
            beginTime: string;
            endTime: string;
            enabled?: boolean;
        }>
    ): AttendanceWeekPlan {
        return {
            enable: true,
            WeekPlanCfg: timeSegments.map((segment, index) => ({
                id: index + 1,
                week: segment.week,
                enable: segment.enabled !== false,
                TimeSegment: {
                    beginTime: segment.beginTime,
                    endTime: segment.endTime,
                },
            })),
        };
    }

    /**
     * Create a basic plan template
     */
    createBasicPlanTemplate(
        templateName: string,
        weekPlanNo: number,
        property: 'check' | 'break' | 'overtime' = 'check',
        holidayGroupNo?: string
    ): AttendancePlanTemplate {
        return {
            enable: true,
            property,
            templateName,
            weekPlanNo,
            holidayGroupNo,
        };
    }

    /**
     * Create a basic holiday plan
     */
    createBasicHolidayPlan(
        beginDate: string,
        endDate: string,
        timeSegments: Array<{
            beginTime: string;
            endTime: string;
            verifyMode?: string;
            enabled?: boolean;
        }>
    ): HolidayPlanCfg {
        return {
            enable: true,
            beginDate,
            endDate,
            HolidayPlanCfg: timeSegments.map((segment, index) => ({
                id: index + 1,
                enable: segment.enabled !== false,
                verifyMode: segment.verifyMode || 'cardAndPw',
                TimeSegment: {
                    beginTime: segment.beginTime,
                    endTime: segment.endTime,
                },
            })),
        };
    }
}
