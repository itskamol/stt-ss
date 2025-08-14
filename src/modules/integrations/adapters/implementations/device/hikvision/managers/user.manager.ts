import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';

export interface DeviceUser {
    id: string;
    employeeNo: string;
    name: string;
    userType: 'normal' | 'admin' | 'operator';
    validFrom: Date;
    validTo: Date;
    isActive: boolean;
    doorRight: string[];
    timeTemplate: string[];
}

export interface AddUserRequest {
    employeeNo: string;
    name: string;
    userType?: 'normal' | 'admin' | 'operator';
    validFrom?: Date;
    validTo?: Date;
    doorRight?: string[];
    timeTemplate?: string[];
}

@Injectable()
export class HikvisionUserManager {
    constructor(
        private readonly httpClient: HikvisionHttpClient,
        private readonly logger: LoggerService,
    ) {}

    /**
     * Add user to device
     */
    async addUser(device: any, request: AddUserRequest): Promise<DeviceUser> {
        try {
            this.logger.debug('Adding user', {
                deviceId: device.id,
                employeeNo: request.employeeNo,
                name: request.name,
                module: 'hikvision-user-manager',
            });

            const response = await this.httpClient.request(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/UserInfo/Record',
                data: {
                    UserInfo: {
                        employeeNo: request.employeeNo,
                        name: request.name,
                        userType: request.userType || 'normal',
                        Valid: {
                            enable: true,
                            beginTime: request.validFrom?.toISOString() || new Date().toISOString(),
                            endTime: request.validTo?.toISOString() || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                            timeType: 'local',
                        },
                        doorRight: request.doorRight?.map(door => ({ doorNo: door })) || [{ doorNo: '1' }],
                        RightPlan: request.timeTemplate?.map(template => ({ 
                            planTemplateNo: template,
                            doorNo: '1'
                        })) || [{ planTemplateNo: '1', doorNo: '1' }],
                    },
                },
            });

            return {
                id: request.employeeNo,
                employeeNo: request.employeeNo,
                name: request.name,
                userType: request.userType || 'normal',
                validFrom: request.validFrom || new Date(),
                validTo: request.validTo || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                isActive: true,
                doorRight: request.doorRight || ['1'],
                timeTemplate: request.timeTemplate || ['1'],
            };
        } catch (error) {
            this.logger.error('Failed to add user', error.message, {
                deviceId: device.id,
                employeeNo: request.employeeNo,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }

    /**
     * Delete user from device
     */
    async deleteUser(device: any, employeeNo: string): Promise<void> {
        try {
            await this.httpClient.request(device, {
                method: 'DELETE',
                url: `/ISAPI/AccessControl/UserInfo/Delete?employeeNo=${employeeNo}`,
            });

            this.logger.debug('User deleted', {
                deviceId: device.id,
                employeeNo,
                module: 'hikvision-user-manager',
            });
        } catch (error) {
            this.logger.error('Failed to delete user', error.message, {
                deviceId: device.id,
                employeeNo,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }

    /**
     * Get users from device
     */
    async getUsers(device: any, employeeNo?: string): Promise<DeviceUser[]> {
        try {
            const response = await this.httpClient.request<any>(device, {
                method: 'POST',
                url: '/ISAPI/AccessControl/UserInfo/Search',
                data: {
                    UserInfoSearchCond: {
                        searchID: '1',
                        searchResultPosition: 0,
                        maxResults: 100,
                        EmployeeNoList: employeeNo ? [{ employeeNo }] : undefined,
                    },
                },
            });

            return response.data.UserInfoSearch?.UserInfo?.map((user: any) => ({
                id: user.employeeNo,
                employeeNo: user.employeeNo,
                name: user.name,
                userType: user.userType,
                validFrom: new Date(user.Valid.beginTime),
                validTo: new Date(user.Valid.endTime),
                isActive: user.Valid.enable,
                doorRight: user.doorRight?.map((door: any) => door.doorNo) || [],
                timeTemplate: user.RightPlan?.map((plan: any) => plan.planTemplateNo) || [],
            })) || [];
        } catch (error) {
            this.logger.error('Failed to get users', error.message, {
                deviceId: device.id,
                employeeNo,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }

    /**
     * Update user information
     */
    async updateUser(device: any, employeeNo: string, updates: Partial<AddUserRequest>): Promise<DeviceUser> {
        try {
            // Get existing user info
            const existingUsers = await this.getUsers(device, employeeNo);
            const existingUser = existingUsers[0];
            
            if (!existingUser) {
                throw new Error(`User ${employeeNo} not found`);
            }

            await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/UserInfo/Modify',
                data: {
                    UserInfo: {
                        employeeNo,
                        name: updates.name || existingUser.name,
                        userType: updates.userType || existingUser.userType,
                        Valid: {
                            enable: true,
                            beginTime: (updates.validFrom || existingUser.validFrom).toISOString(),
                            endTime: (updates.validTo || existingUser.validTo).toISOString(),
                            timeType: 'local',
                        },
                        doorRight: (updates.doorRight || existingUser.doorRight).map(door => ({ doorNo: door })),
                        RightPlan: (updates.timeTemplate || existingUser.timeTemplate).map(template => ({ 
                            planTemplateNo: template,
                            doorNo: '1'
                        })),
                    },
                },
            });

            return {
                ...existingUser,
                ...updates,
                id: employeeNo,
                employeeNo,
            } as DeviceUser;
        } catch (error) {
            this.logger.error('Failed to update user', error.message, {
                deviceId: device.id,
                employeeNo,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }

    /**
     * Set user status (active/inactive)
     */
    async setUserStatus(device: any, employeeNo: string, isActive: boolean): Promise<void> {
        try {
            const users = await this.getUsers(device, employeeNo);
            const user = users[0];
            
            if (!user) {
                throw new Error(`User ${employeeNo} not found`);
            }

            await this.httpClient.request(device, {
                method: 'PUT',
                url: '/ISAPI/AccessControl/UserInfo/Modify',
                data: {
                    UserInfo: {
                        employeeNo,
                        name: user.name,
                        userType: user.userType,
                        Valid: {
                            enable: isActive,
                            beginTime: user.validFrom.toISOString(),
                            endTime: user.validTo.toISOString(),
                            timeType: 'local',
                        },
                        doorRight: user.doorRight.map(door => ({ doorNo: door })),
                        RightPlan: user.timeTemplate.map(template => ({ 
                            planTemplateNo: template,
                            doorNo: '1'
                        })),
                    },
                },
            });

            this.logger.debug('User status updated', {
                deviceId: device.id,
                employeeNo,
                isActive,
                module: 'hikvision-user-manager',
            });
        } catch (error) {
            this.logger.error('Failed to update user status', error.message, {
                deviceId: device.id,
                employeeNo,
                isActive,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }
}