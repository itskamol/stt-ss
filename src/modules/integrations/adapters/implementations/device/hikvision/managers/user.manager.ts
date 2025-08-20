import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { HikvisionHttpClient } from '../utils/hikvision-http.client';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { Device } from '@prisma/client';

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
        private readonly xmlJsonService: XmlJsonService
    ) {}

    /**
     * Add user to device using /ISAPI/Security/users endpoint
     */
    async addUser(device: Device, request: AddUserRequest): Promise<DeviceUser> {
        try {
            this.logger.debug('Adding user', {
                deviceId: device.id,
                employeeNo: request.employeeNo,
                name: request.name,
                module: 'hikvision-user-manager',
            });

            // First, get current users to find the next available ID
            const currentUsers = await this.getSystemUsers(device);
            const nextId = currentUsers.length > 0 
                ? Math.max(...currentUsers.map((u: any) => parseInt(u.id) || 0)) + 1
                : 1;

            const response = await this.httpClient.request(device, {
                method: 'POST',
                url: '/ISAPI/Security/users',
                data: {
                    User: {
                        id: nextId.toString(),
                        userName: request.employeeNo,
                        password: 'temp123!', // Default password, should be changed
                        userLevel: request.userType === 'admin' ? 'Administrator' : 'Operator',
                        enabled: true,
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
    async deleteUser(device: Device, employeeNo: string): Promise<void> {
        try {
            // First, find the user by employeeNo to get the system user ID
            const users = await this.getSystemUsers(device);
            const userToDelete = users.find((u: any) => u.userName === employeeNo);
            
            if (!userToDelete) {
                throw new Error(`User ${employeeNo} not found`);
            }

            await this.httpClient.request(device, {
                method: 'DELETE',
                url: `/ISAPI/Security/users/${userToDelete.id}`,
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
     * Get users from device using /ISAPI/Security/users endpoint
     */
    async getUsers(device: Device, employeeNo?: string): Promise<DeviceUser[]> {
        try {
            const systemUsers = await this.getSystemUsers(device);
            
            if (employeeNo) {
                const user = systemUsers.find((u: any) => u.userName === employeeNo);
                return user ? [this.mapSystemUserToDeviceUser(user)] : [];
            }
            
            return systemUsers.map((user: any) => this.mapSystemUserToDeviceUser(user));
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
     * Get system users using /ISAPI/Security/users endpoint
     */
    private async getSystemUsers(device: Device): Promise<any[]> {
        try {
            const response = await this.httpClient.request<any>(device, {
                method: 'GET',
                url: '/ISAPI/Security/users',
            });

            // Parse XML response
            if (typeof response === 'string' && response.includes('<?xml')) {
                const jsonResponse = await this.xmlJsonService.xmlToJson(response);
                const users = jsonResponse.UserList?.User || [];
                return Array.isArray(users) ? users : [users];
            }

            return response.UserList?.User || [];
        } catch (error) {
            this.logger.error('Failed to get system users', error.message, {
                deviceId: device.id,
                module: 'hikvision-user-manager',
            });
            throw error;
        }
    }

    /**
     * Map system user to device user format
     */
    private mapSystemUserToDeviceUser(systemUser: any): DeviceUser {
        return {
            id: systemUser.userName,
            employeeNo: systemUser.userName,
            name: systemUser.userName,
            userType: systemUser.userLevel === 'Administrator' ? 'admin' : 'normal',
            validFrom: new Date(),
            validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: systemUser.enabled !== false,
            doorRight: ['1'], // Default door access
            timeTemplate: ['1'], // Default template
        };
    }

    /**
     * Update user information
     */
    async updateUser(
        device: Device,
        employeeNo: string,
        updates: Partial<AddUserRequest>
    ): Promise<DeviceUser> {
        try {
            // Get existing user info
            const existingUsers = await this.getSystemUsers(device);
            const existingUser = existingUsers.find((u: any) => u.userName === employeeNo);

            if (!existingUser) {
                throw new Error(`User ${employeeNo} not found`);
            }

            const updatedUser = {
                ...existingUser,
                userName: updates.name || existingUser.userName,
                userLevel: updates.userType === 'admin' ? 'Administrator' : 'Operator',
                enabled: updates.userType !== undefined ? updates.userType !== 'normal' : existingUser.enabled,
            };

            await this.httpClient.request(device, {
                method: 'PUT',
                url: `/ISAPI/Security/users/${existingUser.id}`,
                data: {
                    User: updatedUser,
                },
            });

            return this.mapSystemUserToDeviceUser(updatedUser);
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
    async setUserStatus(device: Device, employeeNo: string, isActive: boolean): Promise<void> {
        try {
            const users = await this.getSystemUsers(device);
            const user = users.find((u: any) => u.userName === employeeNo);

            if (!user) {
                throw new Error(`User ${employeeNo} not found`);
            }

            const updatedUser = {
                ...user,
                enabled: isActive,
            };

            await this.httpClient.request(device, {
                method: 'PUT',
                url: `/ISAPI/Security/users/${user.id}`,
                data: {
                    User: updatedUser,
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
