import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { EncryptionService } from './encryption.service';
import { HikvisionSessionService } from './hikvision-session.service';
import { 
    HikvisionUserManagementService,
    UserSyncResult,
    UserBatchOperation,
    UserSearchOptions,
    UserListResult 
} from './hikvision-user-management.service';
import {
    CreateDeviceUserDto,
    UpdateDeviceUserDto,
    HikvisionDeviceConfig,
    HIKVISION_CONFIG,
} from '../adapters/hikvision.adapter';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('HikvisionUserManagementService', () => {
    let service: HikvisionUserManagementService;
    let httpService: jest.Mocked<HttpService>;
    let encryptionService: jest.Mocked<EncryptionService>;
    let sessionService: jest.Mocked<HikvisionSessionService>;

    const mockDevice: HikvisionDeviceConfig = {
        deviceId: 'test-device-1',
        ipAddress: '192.168.1.100',
        username: 'admin',
        encryptedSecret: 'encrypted-password',
    };

    const mockDecryptedPassword = 'admin123';

    const mockUserData: CreateDeviceUserDto = {
        employeeNo: 'EMP001',
        name: 'John Doe',
        userType: 'normal',
    };

    beforeEach(async () => {
        const mockHttpService = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };

        const mockEncryptionService = {
            decrypt: jest.fn(),
        };

        const mockSessionService = {
            getSecureSession: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HikvisionUserManagementService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: EncryptionService, useValue: mockEncryptionService },
                { provide: HikvisionSessionService, useValue: mockSessionService },
            ],
        }).compile();

        service = module.get<HikvisionUserManagementService>(HikvisionUserManagementService);
        httpService = module.get(HttpService);
        encryptionService = module.get(EncryptionService);
        sessionService = module.get(HikvisionSessionService);

        // Setup default mocks
        encryptionService.decrypt.mockReturnValue(mockDecryptedPassword);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('addUser', () => {
        it('should successfully add user to device', async () => {
            // Mock findUserByEmployeeNo to return null (user doesn't exist)
            httpService.get.mockReturnValueOnce(throwError(() => ({ response: { status: 404 } })) as any);
            // Mock addUser POST request
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.addUser(mockDevice, mockUserData);

            expect(result).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record',
                expect.objectContaining({
                    UserInfo: expect.objectContaining({
                        employeeNo: 'EMP001',
                        name: 'John Doe',
                        userType: 'normal',
                    }),
                }),
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );
        });

        it('should throw error if user already exists', async () => {
            // Mock findUserByEmployeeNo to return existing user
            httpService.get.mockReturnValue(of({
                data: {
                    UserInfo: {
                        employeeNo: 'EMP001',
                        name: 'Existing User',
                        userType: 'normal',
                    },
                },
            }) as any);

            await expect(service.addUser(mockDevice, mockUserData)).rejects.toThrow(BadRequestException);
        });

        it('should validate user data before adding', async () => {
            const invalidUserData = {
                employeeNo: 'invalid@employee#',
                name: '',
                userType: 'invalid' as any,
            };

            await expect(service.addUser(mockDevice, invalidUserData)).rejects.toThrow(BadRequestException);
        });

        it('should handle device communication errors', async () => {
            // Mock findUserByEmployeeNo to return null
            httpService.get.mockReturnValueOnce(throwError(() => ({ response: { status: 404 } })) as any);
            // Mock addUser to fail
            const error = { response: { status: 500, statusText: 'Internal Server Error' } };
            httpService.post.mockReturnValue(throwError(() => error) as any);

            await expect(service.addUser(mockDevice, mockUserData)).rejects.toThrow();
        });
    });

    describe('updateUser', () => {
        const updateData: UpdateDeviceUserDto = {
            name: 'Jane Doe',
            userType: 'visitor',
        };

        it('should successfully update user', async () => {
            // Mock findUserByEmployeeNo to return existing user
            httpService.get.mockReturnValue(of({
                data: {
                    UserInfo: {
                        employeeNo: 'EMP001',
                        name: 'John Doe',
                        userType: 'normal',
                    },
                },
            }) as any);
            // Mock update request
            httpService.put.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.updateUser(mockDevice, 'EMP001', updateData);

            expect(result).toBe(true);
            expect(httpService.put).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record?format=json&employeeNo=EMP001',
                expect.objectContaining({
                    UserInfo: expect.objectContaining({
                        employeeNo: 'EMP001',
                        name: 'Jane Doe',
                        userType: 'visitor',
                    }),
                }),
                expect.any(Object)
            );
        });

        it('should throw error if user does not exist', async () => {
            // Mock findUserByEmployeeNo to return null
            httpService.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })) as any);

            await expect(service.updateUser(mockDevice, 'EMP001', updateData)).rejects.toThrow(BadRequestException);
        });

        it('should validate employee number format', async () => {
            await expect(service.updateUser(mockDevice, 'invalid@employee#', updateData)).rejects.toThrow(BadRequestException);
        });
    });

    describe('deleteUser', () => {
        it('should successfully delete user', async () => {
            httpService.delete.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.deleteUser(mockDevice, 'EMP001');

            expect(result).toBe(true);
            expect(httpService.delete).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Delete?format=json&employeeNo=EMP001',
                expect.objectContaining({
                    auth: { username: 'admin', password: mockDecryptedPassword },
                })
            );
        });

        it('should validate employee number format', async () => {
            await expect(service.deleteUser(mockDevice, 'invalid@employee#')).rejects.toThrow(BadRequestException);
        });

        it('should handle device errors', async () => {
            const error = { response: { status: 404, statusText: 'Not Found' } };
            httpService.delete.mockReturnValue(throwError(() => error) as any);

            await expect(service.deleteUser(mockDevice, 'EMP001')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findUserByEmployeeNo', () => {
        it('should return user info when user exists', async () => {
            const mockResponse = {
                data: {
                    UserInfo: {
                        employeeNo: 'EMP001',
                        name: 'John Doe',
                        userType: 'normal',
                    },
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.findUserByEmployeeNo(mockDevice, 'EMP001');

            expect(result).toEqual({
                employeeNo: 'EMP001',
                name: 'John Doe',
                userType: 'normal',
            });
        });

        it('should return null when user does not exist', async () => {
            const error = { response: { status: 404 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            const result = await service.findUserByEmployeeNo(mockDevice, 'EMP001');

            expect(result).toBeNull();
        });

        it('should throw error for other HTTP errors', async () => {
            const error = { response: { status: 500 } };
            httpService.get.mockReturnValue(throwError(() => error) as any);

            await expect(service.findUserByEmployeeNo(mockDevice, 'EMP001')).rejects.toThrow();
        });
    });

    describe('searchUsers', () => {
        it('should search users with options', async () => {
            const mockResponse = {
                data: {
                    UserInfoSearch: {
                        searchID: 'search-123',
                        responseStatusStrg: 'OK',
                        numOfMatches: 2,
                        totalMatches: 10,
                        UserInfo: [
                            {
                                employeeNo: 'EMP001',
                                name: 'John Doe',
                                userType: 'normal',
                            },
                            {
                                employeeNo: 'EMP002',
                                name: 'Jane Smith',
                                userType: 'visitor',
                            },
                        ],
                    },
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const options: UserSearchOptions = {
                limit: 10,
                offset: 0,
                userType: 'normal',
            };

            const result = await service.searchUsers(mockDevice, options);

            expect(result.users).toHaveLength(2);
            expect(result.totalCount).toBe(10);
            expect(result.hasMore).toBe(true);
            expect(httpService.get).toHaveBeenCalledWith(
                'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Search',
                expect.objectContaining({
                    params: expect.objectContaining({
                        format: 'json',
                        maxResults: 10,
                        searchResultPosition: 0,
                        userType: 'normal',
                    }),
                })
            );
        });

        it('should handle single user response', async () => {
            const mockResponse = {
                data: {
                    UserInfoSearch: {
                        searchID: 'search-123',
                        responseStatusStrg: 'OK',
                        numOfMatches: 1,
                        totalMatches: 1,
                        UserInfo: {
                            employeeNo: 'EMP001',
                            name: 'John Doe',
                            userType: 'normal',
                        },
                    },
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const result = await service.searchUsers(mockDevice);

            expect(result.users).toHaveLength(1);
            expect(result.users[0].employeeNo).toBe('EMP001');
        });

        it('should filter by name pattern', async () => {
            const mockResponse = {
                data: {
                    UserInfoSearch: {
                        searchID: 'search-123',
                        responseStatusStrg: 'OK',
                        numOfMatches: 2,
                        totalMatches: 2,
                        UserInfo: [
                            {
                                employeeNo: 'EMP001',
                                name: 'John Doe',
                                userType: 'normal',
                            },
                            {
                                employeeNo: 'EMP002',
                                name: 'Jane Smith',
                                userType: 'normal',
                            },
                        ],
                    },
                },
            };
            httpService.get.mockReturnValue(of(mockResponse) as any);

            const options: UserSearchOptions = {
                namePattern: 'john',
            };

            const result = await service.searchUsers(mockDevice, options);

            expect(result.users).toHaveLength(1);
            expect(result.users[0].name).toBe('John Doe');
        });
    });

    describe('getAllUsers', () => {
        it('should retrieve all users in batches', async () => {
            // First batch
            const firstBatch = {
                data: {
                    UserInfoSearch: {
                        numOfMatches: 2,
                        totalMatches: 3,
                        UserInfo: [
                            { employeeNo: 'EMP001', name: 'User 1', userType: 'normal' },
                            { employeeNo: 'EMP002', name: 'User 2', userType: 'normal' },
                        ],
                    },
                },
            };

            // Second batch
            const secondBatch = {
                data: {
                    UserInfoSearch: {
                        numOfMatches: 1,
                        totalMatches: 3,
                        UserInfo: [
                            { employeeNo: 'EMP003', name: 'User 3', userType: 'visitor' },
                        ],
                    },
                },
            };

            httpService.get
                .mockReturnValueOnce(of(firstBatch) as any)
                .mockReturnValueOnce(of(secondBatch) as any);

            const result = await service.getAllUsers(mockDevice);

            expect(result).toHaveLength(3);
            expect(result[0].employeeNo).toBe('EMP001');
            expect(result[2].employeeNo).toBe('EMP003');
            expect(httpService.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('batchUserOperations', () => {
        it('should perform batch operations successfully', async () => {
            // Mock responses for different operations
            httpService.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })) as any); // findUser returns null
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any); // add user
            httpService.delete.mockReturnValue(of({ data: { success: true } }) as any); // delete user

            const operations: UserBatchOperation[] = [
                {
                    operation: 'add',
                    userId: 'EMP001',
                    userData: mockUserData,
                },
                {
                    operation: 'delete',
                    userId: 'EMP002',
                },
            ];

            const result = await service.batchUserOperations(mockDevice, operations);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(result.totalUsers).toBe(2);
            expect(result.duration).toBeGreaterThan(0);
        });

        it('should handle partial failures in batch operations', async () => {
            // Mock first operation to succeed, second to fail
            httpService.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })) as any);
            httpService.post
                .mockReturnValueOnce(of({ data: { success: true } }) as any)
                .mockReturnValueOnce(throwError(() => new Error('Device error')) as any);

            const operations: UserBatchOperation[] = [
                {
                    operation: 'add',
                    userId: 'EMP001',
                    userData: mockUserData,
                },
                {
                    operation: 'add',
                    userId: 'EMP002',
                    userData: { ...mockUserData, employeeNo: 'EMP002' },
                },
            ];

            const result = await service.batchUserOperations(mockDevice, operations);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].userId).toBe('EMP002');
        });
    });

    describe('syncUsersFromSource', () => {
        it('should sync users from external source', async () => {
            httpService.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })) as any);
            httpService.post.mockReturnValue(of({ data: { success: true } }) as any);

            const users = [
                {
                    userId: 'EMP001',
                    name: 'John Doe',
                    userType: 'normal' as const,
                    accessLevel: 1,
                },
                {
                    userId: 'EMP002',
                    accessLevel: 2,
                },
            ];

            const result = await service.syncUsersFromSource(mockDevice, users);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(httpService.post).toHaveBeenCalledTimes(2);
        });
    });

    describe('clearAllUsers', () => {
        it('should clear all users from device', async () => {
            // Mock getAllUsers
            const mockUsers = [
                { employeeNo: 'EMP001', name: 'User 1', userType: 'normal' },
                { employeeNo: 'EMP002', name: 'User 2', userType: 'visitor' },
            ];

            httpService.get.mockReturnValue(of({
                data: {
                    UserInfoSearch: {
                        numOfMatches: 2,
                        totalMatches: 2,
                        UserInfo: mockUsers,
                    },
                },
            }) as any);

            // Mock delete operations
            httpService.delete.mockReturnValue(of({ data: { success: true } }) as any);

            const result = await service.clearAllUsers(mockDevice);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(httpService.delete).toHaveBeenCalledTimes(2);
        });
    });

    describe('validation', () => {
        it('should validate user data correctly', async () => {
            const invalidData = {
                employeeNo: '', // Empty
                name: '', // Empty
                userType: 'invalid' as any,
            };

            await expect(service.addUser(mockDevice, invalidData)).rejects.toThrow(BadRequestException);
        });

        it('should validate name length', async () => {
            const longNameData = {
                employeeNo: 'EMP001',
                name: 'A'.repeat(50), // Too long
                userType: 'normal' as const,
            };

            await expect(service.addUser(mockDevice, longNameData)).rejects.toThrow(BadRequestException);
        });
    });
});