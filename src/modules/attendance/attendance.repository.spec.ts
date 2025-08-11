import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceRepository } from './attendance.repository';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateAttendanceDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

describe('AttendanceRepository', () => {
    let repository: AttendanceRepository;
    let prismaService: any;

    const mockDataScope: DataScope = {
        organizationId: 'org-123',
        branchIds: ['branch-123'],
    };

    const mockAttendanceRecord = {
        id: 'attendance-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        employeeId: 'emp-123',
        guestId: null,
        deviceId: 'device-123',
        eventType: 'CHECK_IN',
        timestamp: new Date('2024-01-15T09:00:00Z'),
        meta: { location: 'main_entrance' },
        createdAt: new Date(),
        employee: {
            id: 'emp-123',
            firstName: 'John',
            lastName: 'Doe',
            employeeCode: 'EMP001',
        },
        device: {
            id: 'device-123',
            name: 'Main Entrance Reader',
            type: 'CARD_READER',
        },
    };

    beforeEach(async () => {
        const mockPrismaService = {
            attendance: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                delete: jest.fn(),
                count: jest.fn(),
                groupBy: jest.fn(),
            },
            employee: {
                findMany: jest.fn(),
            },
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AttendanceRepository,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        repository = module.get<AttendanceRepository>(AttendanceRepository);
        prismaService = module.get(PrismaService);
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('create', () => {
        it('should create an attendance record', async () => {
            const createDto: CreateAttendanceDto = {
                employeeId: 'emp-123',
                deviceId: 'device-123',
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
                organizationId: 'org-123',
                branchId: 'branch-123',
                metadata: { location: 'main_entrance' },
            };

            prismaService.attendance.create.mockResolvedValue(mockAttendanceRecord as any);

            const result = await repository.create(createDto, mockDataScope);

            expect(prismaService.attendance.create).toHaveBeenCalledWith({
                data: {
                    organizationId: createDto.organizationId,
                    branchId: createDto.branchId,
                    employeeId: createDto.employeeId,
                    deviceId: createDto.deviceId,
                    eventType: createDto.eventType,
                    timestamp: createDto.timestamp,
                    meta: createDto.metadata,
                },
            });
            expect(result).toEqual(mockAttendanceRecord);
        });
    });

    describe('findById', () => {
        it('should find attendance record by ID', async () => {
            prismaService.attendance.findFirst.mockResolvedValue(mockAttendanceRecord as any);

            const result = await repository.findById('attendance-123', mockDataScope);

            expect(prismaService.attendance.findFirst).toHaveBeenCalledWith({
                where: {
                    id: 'attendance-123',
                    organizationId: mockDataScope.organizationId,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeCode: true,
                        },
                    },
                    device: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                },
            });
            expect(result).toEqual(mockAttendanceRecord);
        });
    });

    describe('findMany', () => {
        it('should find attendance records with filters', async () => {
            const filters = {
                employeeId: 'emp-123',
                branchId: 'branch-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            prismaService.attendance.findMany.mockResolvedValue([mockAttendanceRecord] as any);

            const result = await repository.findMany(filters, mockDataScope);

            expect(prismaService.attendance.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: mockDataScope.organizationId,
                    employeeId: filters.employeeId,
                    branchId: filters.branchId,
                    timestamp: {
                        gte: filters.startDate,
                        lte: filters.endDate,
                    },
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeCode: true,
                        },
                    },
                    device: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                },
                orderBy: { timestamp: 'desc' },
            });
            expect(result).toEqual([mockAttendanceRecord]);
        });

        it('should handle filters without dates', async () => {
            const filters = {
                employeeId: 'emp-123',
            };

            prismaService.attendance.findMany.mockResolvedValue([mockAttendanceRecord] as any);

            await repository.findMany(filters, mockDataScope);

            expect(prismaService.attendance.findMany).toHaveBeenCalledWith({
                where: {
                    organizationId: mockDataScope.organizationId,
                    employeeId: filters.employeeId,
                },
                include: expect.any(Object),
                orderBy: { timestamp: 'desc' },
            });
        });
    });

    describe('findLastAttendanceForEmployee', () => {
        it('should find last attendance for employee on specific date', async () => {
            const employeeId = 'emp-123';
            const date = new Date('2024-01-15');

            prismaService.attendance.findFirst.mockResolvedValue(mockAttendanceRecord as any);

            const result = await repository.findLastAttendanceForEmployee(
                employeeId,
                date,
                mockDataScope
            );

            expect(prismaService.attendance.findFirst).toHaveBeenCalledWith({
                where: {
                    employeeId,
                    timestamp: {
                        gte: date,
                        lte: expect.any(Date), // End of day
                    },
                    organizationId: mockDataScope.organizationId,
                },
                orderBy: { timestamp: 'desc' },
            });
            expect(result).toEqual(mockAttendanceRecord);
        });
    });

    describe('delete', () => {
        it('should delete attendance record', async () => {
            prismaService.attendance.delete.mockResolvedValue(mockAttendanceRecord as any);

            await repository.delete('attendance-123', mockDataScope);

            expect(prismaService.attendance.delete).toHaveBeenCalledWith({
                where: { id: 'attendance-123' },
            });
        });
    });

    describe('getAttendanceStats', () => {
        it('should return attendance statistics', async () => {
            const filters = {
                branchId: 'branch-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            prismaService.attendance.count.mockResolvedValue(100);
            prismaService.attendance.groupBy
                .mockResolvedValueOnce([
                    { eventType: 'CHECK_IN', _count: { id: 50 } },
                    { eventType: 'CHECK_OUT', _count: { id: 50 } },
                ] as any)
                .mockResolvedValueOnce([{ employeeId: 'emp-123', _count: { id: 20 } }] as any);

            prismaService.employee.findMany.mockResolvedValue([
                {
                    id: 'emp-123',
                    firstName: 'John',
                    lastName: 'Doe',
                    employeeCode: 'EMP001',
                },
            ] as any);

            const result = await repository.getAttendanceStats(filters, mockDataScope);

            expect(result.totalRecords).toBe(100);
            expect(result.eventsByType).toHaveLength(2);
            expect(result.recordsByEmployee).toHaveLength(1);
            expect(result.recordsByEmployee[0].employeeName).toBe('John Doe (EMP001)');
        });

        it('should handle empty employee results', async () => {
            const filters = {};

            prismaService.attendance.count.mockResolvedValue(0);
            prismaService.attendance.groupBy
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ employeeId: null, _count: { id: 5 } }] as any);

            prismaService.employee.findMany.mockResolvedValue([]);

            const result = await repository.getAttendanceStats(filters, mockDataScope);

            expect(result.totalRecords).toBe(0);
            expect(result.recordsByEmployee[0].employeeName).toBe('Guest');
        });
    });

    describe('getAttendanceByDateRange', () => {
        it('should return attendance grouped by date', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const mockRecords = [
                { timestamp: new Date('2024-01-15T09:00:00Z') },
                { timestamp: new Date('2024-01-15T17:00:00Z') },
                { timestamp: new Date('2024-01-16T09:00:00Z') },
            ];

            prismaService.attendance.findMany.mockResolvedValue(mockRecords as any);

            const result = await repository.getAttendanceByDateRange(
                startDate,
                endDate,
                mockDataScope
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ date: '2024-01-15', count: 2 });
            expect(result[1]).toEqual({ date: '2024-01-16', count: 1 });
        });
    });
});
