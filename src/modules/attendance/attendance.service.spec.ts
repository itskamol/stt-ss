import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { CreateAttendanceDto } from '../../shared/dto';
import { DataScope } from '../../shared/interfaces';

describe('AttendanceService', () => {
    let service: AttendanceService;
    let attendanceRepository: jest.Mocked<AttendanceRepository>;
    let loggerService: jest.Mocked<LoggerService>;

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
    };

    beforeEach(async () => {
        const mockAttendanceRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            findLastAttendanceForEmployee: jest.fn(),
            delete: jest.fn(),
            getAttendanceStats: jest.fn(),
            getAttendanceByDateRange: jest.fn(),
        };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AttendanceService,
                {
                    provide: AttendanceRepository,
                    useValue: mockAttendanceRepository,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<AttendanceService>(AttendanceService);
        attendanceRepository = module.get(AttendanceRepository);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createAttendanceRecord', () => {
        it('should create an attendance record successfully', async () => {
            const createDto: CreateAttendanceDto = {
                employeeId: 'emp-123',
                deviceId: 'device-123',
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
                organizationId: 'org-123',
                branchId: 'branch-123',
                metadata: { location: 'main_entrance' },
            };

            attendanceRepository.create.mockResolvedValue(mockAttendanceRecord as any);

            const result = await service.createAttendanceRecord(createDto, mockDataScope);

            expect(attendanceRepository.create).toHaveBeenCalledWith(createDto, mockDataScope);
            expect(loggerService.log).toHaveBeenCalledWith(
                'Attendance record created',
                expect.any(Object)
            );
            expect(result).toEqual(mockAttendanceRecord);
        });

        it('should handle errors and log them', async () => {
            const createDto: CreateAttendanceDto = {
                employeeId: 'emp-123',
                deviceId: 'device-123',
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
                organizationId: 'org-123',
                branchId: 'branch-123',
                metadata: { location: 'main_entrance' },
            };

            const error = new Error('Database error');
            attendanceRepository.create.mockRejectedValue(error);

            await expect(service.createAttendanceRecord(createDto, mockDataScope)).rejects.toThrow(
                'Database error'
            );
            expect(loggerService.error).toHaveBeenCalledWith(
                'Failed to create attendance record',
                error,
                expect.any(Object)
            );
        });
    });

    describe('getLastAttendanceForEmployee', () => {
        it('should return the last attendance record for an employee', async () => {
            const date = new Date('2024-01-15');
            attendanceRepository.findLastAttendanceForEmployee.mockResolvedValue(
                mockAttendanceRecord as any
            );

            const result = await service.getLastAttendanceForEmployee(
                'emp-123',
                date,
                mockDataScope
            );

            expect(attendanceRepository.findLastAttendanceForEmployee).toHaveBeenCalledWith(
                'emp-123',
                date,
                mockDataScope
            );
            expect(result).toEqual(mockAttendanceRecord);
        });
    });

    describe('getAttendanceRecords', () => {
        it('should return attendance records with filters', async () => {
            const filters = {
                employeeId: 'emp-123',
                branchId: 'branch-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            attendanceRepository.findMany.mockResolvedValue([mockAttendanceRecord] as any);

            const result = await service.getAttendanceRecords(filters, mockDataScope);

            expect(attendanceRepository.findMany).toHaveBeenCalledWith(filters, mockDataScope);
            expect(result).toEqual([mockAttendanceRecord]);
        });
    });

    describe('getAttendanceById', () => {
        it('should return attendance record by ID', async () => {
            attendanceRepository.findById.mockResolvedValue(mockAttendanceRecord as any);

            const result = await service.getAttendanceById('attendance-123', mockDataScope);

            expect(attendanceRepository.findById).toHaveBeenCalledWith(
                'attendance-123',
                mockDataScope
            );
            expect(result).toEqual(mockAttendanceRecord);
        });

        it('should throw NotFoundException when record not found', async () => {
            attendanceRepository.findById.mockResolvedValue(null);

            await expect(
                service.getAttendanceById('attendance-123', mockDataScope)
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('getAttendanceSummary', () => {
        it('should calculate attendance summary correctly', async () => {
            const checkInRecord = {
                ...mockAttendanceRecord,
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
            };
            const checkOutRecord = {
                ...mockAttendanceRecord,
                id: 'attendance-124',
                eventType: 'CHECK_OUT',
                timestamp: new Date('2024-01-15T17:00:00Z'),
            };

            attendanceRepository.findMany.mockResolvedValue([checkInRecord, checkOutRecord] as any);

            const result = await service.getAttendanceSummary(
                'emp-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );

            expect(result.employeeId).toBe('emp-123');
            expect(result.totalHours).toBe(8);
            expect(result.presentDays).toBe(1);
            expect(result.dailySummary).toHaveLength(1);
            expect(result.dailySummary[0].status).toBe('present');
            expect(result.dailySummary[0].totalHours).toBe(8);
        });

        it('should handle partial days (check-in without check-out)', async () => {
            const checkInRecord = {
                ...mockAttendanceRecord,
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
            };

            attendanceRepository.findMany.mockResolvedValue([checkInRecord] as any);

            const result = await service.getAttendanceSummary(
                'emp-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );

            expect(result.partialDays).toBe(1);
            expect(result.presentDays).toBe(0);
            expect(result.dailySummary[0].status).toBe('partial');
        });
    });

    describe('deleteAttendanceRecord', () => {
        it('should delete attendance record successfully', async () => {
            attendanceRepository.findById.mockResolvedValue(mockAttendanceRecord as any);
            attendanceRepository.delete.mockResolvedValue(undefined);

            await service.deleteAttendanceRecord('attendance-123', mockDataScope);

            expect(attendanceRepository.findById).toHaveBeenCalledWith(
                'attendance-123',
                mockDataScope
            );
            expect(attendanceRepository.delete).toHaveBeenCalledWith(
                'attendance-123',
                mockDataScope
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'Attendance record deleted',
                expect.any(Object)
            );
        });

        it('should throw NotFoundException when record not found', async () => {
            attendanceRepository.findById.mockResolvedValue(null);

            await expect(
                service.deleteAttendanceRecord('attendance-123', mockDataScope)
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('getAttendanceStats', () => {
        it('should return attendance statistics', async () => {
            const mockStats = {
                totalRecords: 100,
                eventsByType: [
                    { eventType: 'CHECK_IN' as any, count: 50 },
                    { eventType: 'CHECK_OUT' as any, count: 50 },
                ],
                recordsByEmployee: [
                    { employeeId: 'emp-123', employeeName: 'John Doe (EMP001)', count: 20 },
                ],
            };

            attendanceRepository.getAttendanceStats.mockResolvedValue(mockStats);

            const result = await service.getAttendanceStats({}, mockDataScope);

            expect(attendanceRepository.getAttendanceStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result).toEqual(mockStats);
        });
    });

    describe('getDailyAttendanceReport', () => {
        it('should generate daily attendance report', async () => {
            const date = new Date('2024-01-15');
            const checkInRecord = {
                ...mockAttendanceRecord,
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
            };
            const checkOutRecord = {
                ...mockAttendanceRecord,
                id: 'attendance-124',
                eventType: 'CHECK_OUT',
                timestamp: new Date('2024-01-15T17:00:00Z'),
            };

            attendanceRepository.findMany.mockResolvedValue([checkInRecord, checkOutRecord] as any);

            const result = await service.getDailyAttendanceReport(
                date,
                'branch-123',
                mockDataScope
            );

            expect(result.date).toEqual(date);
            expect(result.branchId).toBe('branch-123');
            expect(result.totalEmployees).toBe(1);
            expect(result.presentEmployees).toBe(1);
            expect(result.employeeDetails).toHaveLength(1);
            expect(result.employeeDetails[0].status).toBe('present');
            expect(result.employeeDetails[0].totalHours).toBe(8);
        });

        it('should handle employees with only check-in', async () => {
            const date = new Date('2024-01-15');
            const checkInRecord = {
                ...mockAttendanceRecord,
                eventType: 'CHECK_IN',
                timestamp: new Date('2024-01-15T09:00:00Z'),
            };

            attendanceRepository.findMany.mockResolvedValue([checkInRecord] as any);

            const result = await service.getDailyAttendanceReport(
                date,
                'branch-123',
                mockDataScope
            );

            expect(result.partialEmployees).toBe(1);
            expect(result.employeeDetails[0].status).toBe('partial');
        });
    });

    describe('getWeeklyAttendanceReport', () => {
        it('should generate weekly attendance report', async () => {
            const startDate = new Date('2024-01-15');

            // Mock the getDailyAttendanceReport method
            jest.spyOn(service, 'getDailyAttendanceReport').mockResolvedValue({
                date: new Date('2024-01-15'),
                branchId: 'branch-123',
                totalEmployees: 10,
                presentEmployees: 8,
                partialEmployees: 1,
                absentEmployees: 1,
                totalHours: 64,
                averageHours: 8,
                employeeDetails: [],
            });

            const result = await service.getWeeklyAttendanceReport(
                startDate,
                'branch-123',
                mockDataScope
            );

            expect(result.startDate).toEqual(startDate);
            expect(result.branchId).toBe('branch-123');
            expect(result.dailyReports).toHaveLength(7);
            expect(result.totalHours).toBeGreaterThan(0);
        });
    });

    describe('getMonthlyAttendanceReport', () => {
        it('should generate monthly attendance report', async () => {
            const year = 2024;
            const month = 1;
            const attendanceRecords = [
                {
                    ...mockAttendanceRecord,
                    timestamp: new Date('2024-01-15T09:00:00Z'),
                },
                {
                    ...mockAttendanceRecord,
                    id: 'attendance-124',
                    timestamp: new Date('2024-01-16T09:00:00Z'),
                },
            ];

            attendanceRepository.findMany.mockResolvedValue(attendanceRecords as any);

            const result = await service.getMonthlyAttendanceReport(
                year,
                month,
                'branch-123',
                mockDataScope
            );

            expect(result.year).toBe(year);
            expect(result.month).toBe(month);
            expect(result.branchId).toBe('branch-123');
            expect(result.totalEmployees).toBe(1);
            expect(result.employeeReports).toHaveLength(1);
        });
    });
});
