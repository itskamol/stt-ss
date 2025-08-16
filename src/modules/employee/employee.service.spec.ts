import { Test, TestingModule } from '@nestjs/testing';
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { LoggerService } from '@/core/logger';
import { DatabaseUtil } from '@/shared/utils';
import { CreateEmployeeDto, UpdateEmployeeDto } from '@/shared/dto';
import { DataScope } from '@/shared/interfaces';
import { IStorageAdapter } from '@/modules/integrations/adapters/interfaces/storage.adapter';
import { PaginationService } from '@/shared/services/pagination.service';
import { EncryptionService } from '@/shared/services/encryption.service';

jest.mock('@/shared/utils/database.util');

describe('EmployeeService', () => {
    let service: EmployeeService;
    let employeeRepository: jest.Mocked<EmployeeRepository>;
    let storageAdapter: jest.Mocked<IStorageAdapter>;

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockEmployee = {
        id: 'emp-123',
        employeeCode: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        position: 'Software Engineer',
        phone: '+1234567890',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmployeeService,
                {
                    provide: EmployeeRepository,
                    useValue: {
                        create: jest.fn(),
                        findById: jest.fn(),
                        findByEmployeeCode: jest.fn(),
                        update: jest.fn(),
                        delete: jest.fn(),
                        count: jest.fn(),
                        findMany: jest.fn(),
                        findManyPaginated: jest.fn(),
                        findByBranch: jest.fn(),
                        findByDepartment: jest.fn(),
                        searchEmployees: jest.fn(),
                    },
                },
                {
                    provide: LoggerService,
                    useValue: {
                        logUserAction: jest.fn(),
                        warn: jest.fn(),
                    },
                },
                {
                    provide: PaginationService,
                    useValue: {
                        paginate: jest.fn(),
                    },
                },
                {
                    provide: 'IStorageAdapter',
                    useValue: {
                        uploadFile: jest.fn(),
                        deleteFile: jest.fn(),
                        downloadFile: jest.fn(),
                    },
                },
                {
                    provide: EncryptionService,
                    useValue: {
                        encrypt: jest.fn(),
                        decrypt: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<EmployeeService>(EmployeeService);
        employeeRepository = module.get(EmployeeRepository);
        storageAdapter = module.get('IStorageAdapter');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createEmployee', () => {
        it('should create an employee successfully', async () => {
            const createDto: CreateEmployeeDto = {
                employeeCode: 'EMP001',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                branchId: 'branch-123',
                departmentId: 'dept-123',
            };
            employeeRepository.findByEmployeeCode.mockResolvedValue(null);
            employeeRepository.create.mockResolvedValue(mockEmployee as any);

            const result = await service.createEmployee(
                createDto,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.create).toHaveBeenCalledWith(createDto, mockDataScope);
            expect(result).toEqual(mockEmployee);
        });

        it('should throw ConflictException if employee code already exists', async () => {
            const createDto: CreateEmployeeDto = {
                employeeCode: 'EMP001',
                firstName: 'John',
                lastName: 'Doe',
                branchId: 'branch-123',
            };
            employeeRepository.findByEmployeeCode.mockResolvedValue(mockEmployee as any);

            await expect(
                service.createEmployee(createDto, mockDataScope, 'user-123')
            ).rejects.toThrow(ConflictException);
        });

        it('should throw BadRequestException for inaccessible branch', async () => {
            const createDto: CreateEmployeeDto = {
                employeeCode: 'EMP001',
                firstName: 'John',
                lastName: 'Doe',
                branchId: 'inaccessible-branch',
            };

            await expect(
                service.createEmployee(createDto, mockDataScope, 'user-123')
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('updateEmployee', () => {
        it('should update an employee successfully', async () => {
            const updateDto: UpdateEmployeeDto = {
                firstName: 'Jane',
                email: 'jane.doe@example.com',
            };
            const updatedEmployee = { ...mockEmployee, ...updateDto };

            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            employeeRepository.findByEmployeeCode.mockResolvedValue(null);
            employeeRepository.update.mockResolvedValue(updatedEmployee as any);

            const result = await service.updateEmployee(
                'emp-123',
                updateDto,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                updateDto,
                mockDataScope
            );
            expect(result.firstName).toBe('Jane');
        });

        it('should throw NotFoundException if employee not found', async () => {
            employeeRepository.findById.mockResolvedValue(null);

            await expect(
                service.updateEmployee('nonexistent', {}, mockDataScope, 'user-123')
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee successfully', async () => {
            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            employeeRepository.delete.mockResolvedValue();

            await service.deleteEmployee('emp-123', mockDataScope, 'user-123');

            expect(employeeRepository.findById).toHaveBeenCalledWith('emp-123', mockDataScope);
            expect(employeeRepository.delete).toHaveBeenCalledWith('emp-123', mockDataScope);
        });
    });

    describe('toggleEmployeeStatus', () => {
        it('should activate an employee successfully', async () => {
            const updatedEmployee = { ...mockEmployee, isActive: true };
            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            employeeRepository.update.mockResolvedValue(updatedEmployee as any);

            const result = await service.toggleEmployeeStatus(
                'emp-123',
                true,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                { isActive: true },
                mockDataScope
            );
            expect(result.isActive).toBe(true);
        });

        it('should deactivate an employee successfully', async () => {
            const updatedEmployee = { ...mockEmployee, isActive: false };
            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            employeeRepository.update.mockResolvedValue(updatedEmployee as any);

            const result = await service.toggleEmployeeStatus(
                'emp-123',
                false,
                mockDataScope,
                'user-123'
            );

            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                { isActive: false },
                mockDataScope
            );
            expect(result.isActive).toBe(false);
        });
    });

    describe('uploadEmployeePhoto', () => {
        it('should upload employee photo successfully', async () => {
            const file = {
                originalname: 'test.jpg',
                mimetype: 'image/jpeg',
                buffer: Buffer.from('test'),
                size: 1024 * 1024,
            } as Express.Multer.File;

            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            storageAdapter.uploadFile.mockResolvedValue({
                url: 'http://example.com/photo.jpg',
                key: 'photo.jpg',
                size: 1024 * 1024
            });

            const result = await service.uploadEmployeePhoto(
                'emp-123',
                file,
                mockDataScope,
                'user-123'
            );

            expect(storageAdapter.uploadFile).toHaveBeenCalled();
            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                { photoKey: expect.any(String) },
                mockDataScope
            );
            expect(result.photoUrl).toBe('http://example.com/photo.jpg');
        });

        it('should throw BadRequestException for invalid file type', async () => {
            const file = {
                mimetype: 'application/pdf',
            } as Express.Multer.File;

            employeeRepository.findById.mockResolvedValue(mockEmployee as any);

            await expect(
                service.uploadEmployeePhoto('emp-123', file, mockDataScope, 'user-123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for file too large', async () => {
            const largeFile = {
                ...mockFile,
                size: 6 * 1024 * 1024, // 6MB
            } as Express.Multer.File;

            employeeRepository.findById.mockResolvedValue(mockEmployee);

            await expect(
                service.uploadEmployeePhoto('emp-123', largeFile, mockDataScope, 'user-123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should delete existing photo when uploading new one', async () => {
            const employeeWithPhoto = {
                ...mockEmployee,
                photoKey: 'employees/org-123/emp-123/old-photo.jpg',
            };

            employeeRepository.findById.mockResolvedValue(employeeWithPhoto);
            storageAdapter.uploadFile.mockResolvedValue({
                key: 'employees/org-123/emp-123/photo.jpg',
                url: 'https://example.com/employees/org-123/emp-123/photo.jpg',
                size: mockFile.size,
            });
            employeeRepository.update.mockResolvedValue({
                ...employeeWithPhoto,
                photoKey: 'employees/org-123/emp-123/photo.jpg',
                position: 'Software Engineer',
            });

            await service.uploadEmployeePhoto('emp-123', mockFile, mockDataScope, 'user-123');

            expect(storageAdapter.deleteFile).toHaveBeenCalledWith('employees/org-123/emp-123/old-photo.jpg');
        });
    });

    describe('deleteEmployeePhoto', () => {
        it('should delete employee photo successfully', async () => {
            employeeRepository.findById.mockResolvedValue(mockEmployee as any);
            storageAdapter.deleteFile.mockResolvedValue();
            employeeRepository.update.mockResolvedValue({
                ...employeeWithPhoto,
                photoKey: null,
                position: 'Software Engineer',
            });

            await service.deleteEmployeePhoto('emp-123', mockDataScope, 'user-123');

            expect(storageAdapter.deleteFile).toHaveBeenCalledWith('photo.jpg');
            expect(employeeRepository.update).toHaveBeenCalledWith(
                'emp-123',
                { photoKey: null },
                mockDataScope
            );
        });

        it('should throw BadRequestException if employee has no photo', async () => {
            const employeeWithoutPhoto = { ...mockEmployee, photoKey: null };
            employeeRepository.findById.mockResolvedValue(employeeWithoutPhoto as any);

            await expect(
                service.deleteEmployeePhoto('emp-123', mockDataScope, 'user-123')
            ).rejects.toThrow(BadRequestException);
        });
    });
});
