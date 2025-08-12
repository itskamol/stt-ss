import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { HikvisionSessionService } from './hikvision-session.service';
import {
    CreateDeviceUserDto,
    DeviceUserInfo,
    HIKVISION_CONFIG,
    HIKVISION_ENDPOINTS,
    HikvisionCreateUserPayload,
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HikvisionUpdateUserPayload,
    HikvisionUserInfoResponse,
    HikvisionUserListResponse,
    HikvisionValidation,
    UpdateDeviceUserDto,
} from '../adapters/hikvision.adapter';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface UserSyncResult {
    deviceId: string;
    totalUsers: number;
    successCount: number;
    failureCount: number;
    errors: Array<{
        userId: string;
        error: string;
    }>;
    duration: number;
}

export interface UserBatchOperation {
    operation: 'add' | 'update' | 'delete';
    userId: string;
    userData?: CreateDeviceUserDto | UpdateDeviceUserDto;
}

export interface UserSearchOptions {
    employeeNoPattern?: string;
    namePattern?: string;
    userType?: 'normal' | 'visitor' | 'admin';
    limit?: number;
    offset?: number;
}

export interface UserListResult {
    users: DeviceUserInfo[];
    totalCount: number;
    hasMore: boolean;
}

@Injectable()
export class HikvisionUserManagementService {
    private readonly logger = new Logger(HikvisionUserManagementService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
        private readonly sessionService: HikvisionSessionService,
    ) {}

    /**
     * Add user to device with comprehensive validation
     */
    async addUser(device: HikvisionDeviceConfig, userData: CreateDeviceUserDto): Promise<boolean> {
        this.logger.log('Adding user to device', { deviceId: device.deviceId, employeeNo: userData.employeeNo });

        const context = this.createErrorContext(device.deviceId, 'addUser', HIKVISION_ENDPOINTS.USER_INFO);

        // Validate input
        const validationErrors = this.validateUserData(userData);
        if (validationErrors.length > 0) {
            throw HikvisionExceptionFactory.fromValidationError(context, validationErrors.join(', '));
        }

        // Check if user already exists
        const existingUser = await this.findUserByEmployeeNo(device, userData.employeeNo);
        if (existingUser) {
            throw HikvisionExceptionFactory.fromValidationError(
                context, 
                `User with employee number ${userData.employeeNo} already exists`
            );
        }

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.USER_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);
            
            const payload: HikvisionCreateUserPayload = {
                UserInfo: {
                    employeeNo: userData.employeeNo,
                    name: userData.name,
                    userType: userData.userType,
                    Valid: {
                        enable: true,
                        beginTime: '2000-01-01T00:00:00',
                        endTime: '2037-12-31T23:59:59',
                    },
                    doorRight: '1',
                    RightPlan: [
                        {
                            doorNo: 1,
                            planTemplateNo: '1',
                        },
                    ],
                },
            };

            await firstValueFrom(
                this.httpService.post(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            this.logger.log('User added successfully', { deviceId: device.deviceId, employeeNo: userData.employeeNo });
            return true;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to add user', { 
                deviceId: device.deviceId, 
                employeeNo: userData.employeeNo, 
                error: exception.message 
            });
            throw exception.toNestException();
        }
    }

    /**
     * Update user on device
     */
    async updateUser(
        device: HikvisionDeviceConfig, 
        employeeNo: string, 
        userData: UpdateDeviceUserDto
    ): Promise<boolean> {
        this.logger.log('Updating user on device', { deviceId: device.deviceId, employeeNo });

        const context = this.createErrorContext(device.deviceId, 'updateUser', HIKVISION_ENDPOINTS.USER_INFO);

        // Validate employee number
        if (!HikvisionValidation.isValidEmployeeNo(employeeNo)) {
            throw HikvisionExceptionFactory.fromValidationError(context, 'Invalid employee number format');
        }

        // Check if user exists
        const existingUser = await this.findUserByEmployeeNo(device, employeeNo);
        if (!existingUser) {
            throw HikvisionExceptionFactory.fromValidationError(
                context, 
                `User with employee number ${employeeNo} not found`
            );
        }

        try {
            const endpoint = `${this.buildEndpoint(device, HIKVISION_ENDPOINTS.USER_INFO)}?format=json&employeeNo=${employeeNo}`;
            const password = this.encryptionService.decrypt(device.encryptedSecret);
            
            const payload: HikvisionUpdateUserPayload = {
                UserInfo: {
                    employeeNo,
                    ...(userData.name && { name: userData.name }),
                    ...(userData.userType && { userType: userData.userType }),
                },
            };

            await firstValueFrom(
                this.httpService.put(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            this.logger.log('User updated successfully', { deviceId: device.deviceId, employeeNo });
            return true;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to update user', { deviceId: device.deviceId, employeeNo, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Delete user from device
     */
    async deleteUser(device: HikvisionDeviceConfig, employeeNo: string): Promise<boolean> {
        this.logger.log('Deleting user from device', { deviceId: device.deviceId, employeeNo });

        const context = this.createErrorContext(device.deviceId, 'deleteUser', HIKVISION_ENDPOINTS.USER_DELETE);

        // Validate employee number
        if (!HikvisionValidation.isValidEmployeeNo(employeeNo)) {
            throw HikvisionExceptionFactory.fromValidationError(context, 'Invalid employee number format');
        }

        try {
            const endpoint = `${this.buildEndpoint(device, HIKVISION_ENDPOINTS.USER_DELETE)}?format=json&employeeNo=${employeeNo}`;
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            await firstValueFrom(
                this.httpService.delete(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            this.logger.log('User deleted successfully', { deviceId: device.deviceId, employeeNo });
            return true;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to delete user', { deviceId: device.deviceId, employeeNo, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Find user by employee number
     */
    async findUserByEmployeeNo(device: HikvisionDeviceConfig, employeeNo: string): Promise<DeviceUserInfo | null> {
        this.logger.debug('Finding user by employee number', { deviceId: device.deviceId, employeeNo });

        const context = this.createErrorContext(device.deviceId, 'findUserByEmployeeNo', HIKVISION_ENDPOINTS.USER_SEARCH);

        try {
            const endpoint = `${this.buildEndpoint(device, HIKVISION_ENDPOINTS.USER_SEARCH)}?format=json&employeeNo=${employeeNo}`;
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            const data = response.data as HikvisionUserInfoResponse;
            if (data.UserInfo) {
                return {
                    employeeNo: data.UserInfo.employeeNo,
                    name: data.UserInfo.name,
                    userType: data.UserInfo.userType,
                };
            }

            return null;

        } catch (error) {
            if (error.response?.status === 404) {
                return null;
            }
            
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to find user', { deviceId: device.deviceId, employeeNo, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Search users with advanced filtering
     */
    async searchUsers(device: HikvisionDeviceConfig, options: UserSearchOptions = {}): Promise<UserListResult> {
        this.logger.log('Searching users on device', { deviceId: device.deviceId, options });

        const context = this.createErrorContext(device.deviceId, 'searchUsers', HIKVISION_ENDPOINTS.USER_SEARCH);

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.USER_SEARCH);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const params: any = {
                format: 'json',
                ...(options.limit && { maxResults: options.limit }),
                ...(options.offset && { searchResultPosition: options.offset }),
            };

            // Add search filters
            if (options.employeeNoPattern) {
                params.employeeNo = options.employeeNoPattern;
            }
            if (options.userType) {
                params.userType = options.userType;
            }

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    params,
                })
            );

            const data = response.data as HikvisionUserListResponse;
            const users: DeviceUserInfo[] = [];

            if (data.UserInfoSearch && data.UserInfoSearch.UserInfo) {
                const userInfoArray = Array.isArray(data.UserInfoSearch.UserInfo) 
                    ? data.UserInfoSearch.UserInfo 
                    : [data.UserInfoSearch.UserInfo];

                for (const userInfo of userInfoArray) {
                    // Apply name filter if specified
                    if (options.namePattern && !userInfo.name.toLowerCase().includes(options.namePattern.toLowerCase())) {
                        continue;
                    }

                    users.push({
                        employeeNo: userInfo.employeeNo,
                        name: userInfo.name,
                        userType: userInfo.userType,
                    });
                }
            }

            return {
                users,
                totalCount: data.UserInfoSearch?.totalMatches || users.length,
                hasMore: (data.UserInfoSearch?.numOfMatches || 0) < (data.UserInfoSearch?.totalMatches || 0),
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to search users', { deviceId: device.deviceId, error: exception.message });
            throw exception.toNestException();
        }
    }

    /**
     * Get all users from device
     */
    async getAllUsers(device: HikvisionDeviceConfig): Promise<DeviceUserInfo[]> {
        this.logger.log('Getting all users from device', { deviceId: device.deviceId });

        const allUsers: DeviceUserInfo[] = [];
        let offset = 0;
        const limit = 100; // Process in batches

        while (true) {
            const result = await this.searchUsers(device, { limit, offset });
            allUsers.push(...result.users);

            if (!result.hasMore || result.users.length === 0) {
                break;
            }

            offset += limit;
        }

        this.logger.log('Retrieved all users from device', { 
            deviceId: device.deviceId, 
            totalUsers: allUsers.length 
        });

        return allUsers;
    }

    /**
     * Batch user operations
     */
    async batchUserOperations(
        device: HikvisionDeviceConfig, 
        operations: UserBatchOperation[]
    ): Promise<UserSyncResult> {
        const startTime = Date.now();
        this.logger.log('Starting batch user operations', { 
            deviceId: device.deviceId, 
            operationCount: operations.length 
        });

        const result: UserSyncResult = {
            deviceId: device.deviceId,
            totalUsers: operations.length,
            successCount: 0,
            failureCount: 0,
            errors: [],
            duration: 0,
        };

        for (const operation of operations) {
            try {
                switch (operation.operation) {
                    case 'add':
                        if (operation.userData) {
                            await this.addUser(device, operation.userData as CreateDeviceUserDto);
                        }
                        break;
                    case 'update':
                        if (operation.userData) {
                            await this.updateUser(device, operation.userId, operation.userData as UpdateDeviceUserDto);
                        }
                        break;
                    case 'delete':
                        await this.deleteUser(device, operation.userId);
                        break;
                }
                result.successCount++;
            } catch (error) {
                result.failureCount++;
                result.errors.push({
                    userId: operation.userId,
                    error: error.message,
                });
                this.logger.warn('Batch operation failed', { 
                    deviceId: device.deviceId, 
                    operation: operation.operation,
                    userId: operation.userId,
                    error: error.message 
                });
            }
        }

        result.duration = Date.now() - startTime;
        
        this.logger.log('Batch user operations completed', { 
            deviceId: device.deviceId,
            successCount: result.successCount,
            failureCount: result.failureCount,
            duration: result.duration 
        });

        return result;
    }

    /**
     * Sync users from external source
     */
    async syncUsersFromSource(
        device: HikvisionDeviceConfig,
        users: Array<{
            userId: string;
            cardId?: string;
            biometricData?: string;
            accessLevel: number;
            name?: string;
            userType?: 'normal' | 'visitor';
        }>
    ): Promise<UserSyncResult> {
        this.logger.log('Syncing users from external source', { 
            deviceId: device.deviceId, 
            userCount: users.length 
        });

        const operations: UserBatchOperation[] = users.map(user => ({
            operation: 'add' as const,
            userId: user.userId,
            userData: {
                employeeNo: user.userId,
                name: user.name || `User ${user.userId}`,
                userType: user.userType || 'normal',
            },
        }));

        return this.batchUserOperations(device, operations);
    }

    /**
     * Clear all users from device
     */
    async clearAllUsers(device: HikvisionDeviceConfig): Promise<UserSyncResult> {
        this.logger.log('Clearing all users from device', { deviceId: device.deviceId });

        // Get all existing users
        const existingUsers = await this.getAllUsers(device);
        
        // Create delete operations for all users
        const operations: UserBatchOperation[] = existingUsers.map(user => ({
            operation: 'delete' as const,
            userId: user.employeeNo,
        }));

        return this.batchUserOperations(device, operations);
    }

    // ==================== Private Methods ====================

    private validateUserData(userData: CreateDeviceUserDto): string[] {
        const errors: string[] = [];

        if (!HikvisionValidation.isValidEmployeeNo(userData.employeeNo)) {
            errors.push('Invalid employee number format');
        }

        if (!userData.name || userData.name.trim().length === 0) {
            errors.push('Name cannot be empty');
        }

        if (userData.name && userData.name.length > 32) {
            errors.push('Name cannot exceed 32 characters');
        }

        if (!HikvisionValidation.isValidUserType(userData.userType)) {
            errors.push('Invalid user type');
        }

        return errors;
    }

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string, endpoint?: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            endpoint,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}