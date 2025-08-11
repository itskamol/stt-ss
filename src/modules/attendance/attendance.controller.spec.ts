import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceFiltersDto, CreateAttendanceDto } from '../../shared/dto';
import { DataScope, UserContext } from '../../shared/interfaces';

describe('AttendanceController', () => {
    let controller: AttendanceController;
    let attendanceService: jest.Mocked<AttendanceService>;

    const mockUserContext: UserContext = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        roles: ['ADMIN'],
        permissions: ['attendance:create', 'attendance:read:all'],
    };

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
        const mockAttendanceService = {
            createAttendanceRecord: jest.fn(),
            getAttendanceRecords: jest.fn(),
            getAttendanceById: jest.fn(),
            getAttendanceSummary: jest.fn(),
            deleteAttendanceRecord: jest.fn(),
            getAttendanceStats: jest.fn(),
            getDailyAttendanceReport: jest.fn(),
            getWeeklyAttendanceReport: jest.fn(),
            getMonthlyAttendanceReport: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AttendanceController],
            providers: [
                {
                    provide: AttendanceService,
                    useValue: mockAttendanceService,
                },
            ],
        }).compile();

        controller = module.get<AttendanceController>(AttendanceController);
        attendanceService = module.get(AttendanceService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
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

            attendanceService.createAttendanceRecord.mockResolvedValue(mockAttendanceRecord as any);

            const result = await controller.createAttendanceRecord(
                createDto,
                mockUserContext,
                mockDataScope
            );

            expect(attendanceService.createAttendanceRecord).toHaveBeenCalledWith(
                createDto,
                mockDataScope
            );
            expect(result).toEqual({
                id: mockAttendanceRecord.id,
                organizationId: mockAttendanceRecord.organizationId,
                branchId: mockAttendanceRecord.branchId,
                employeeId: mockAttendanceRecord.employeeId,
                guestId: mockAttendanceRecord.guestId,
                deviceId: mockAttendanceRecord.deviceId,
                eventType: mockAttendanceRecord.eventType,
                timestamp: mockAttendanceRecord.timestamp,
                meta: mockAttendanceRecord.meta,
                createdAt: mockAttendanceRecord.createdAt,
            });
        });
    });

    describe('getAttendanceRecords', () => {
        it('should return paginated attendance records', async () => {
            const attendanceRecords = [mockAttendanceRecord];
            attendanceService.getAttendanceRecords.mockResolvedValue(attendanceRecords as any);

            const result = await controller.getAttendanceRecords(
                mockDataScope,
                { employeeId: 'emp-123' },
                { page: 1, limit: 50 }
            );

            expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    employeeId: 'emp-123',
                }),
                mockDataScope
            );
            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(50);
        });
    });

    describe('getAttendanceStats', () => {
        it('should return attendance statistics', async () => {
            const stats = {
                totalRecords: 100,
                eventsByType: [
                    { eventType: 'CHECK_IN' as any, count: 50 },
                    { eventType: 'CHECK_OUT' as any, count: 50 },
                ],
                recordsByEmployee: [
                    { employeeId: 'emp-123', employeeName: 'John Doe (EMP001)', count: 20 },
                ],
            };

            attendanceService.getAttendanceStats.mockResolvedValue(stats);

            const result = await controller.getAttendanceStats(mockDataScope, {});

            expect(attendanceService.getAttendanceStats).toHaveBeenCalledWith({}, mockDataScope);
            expect(result.totalRecords).toBe(100);
            expect(result.eventsByType).toHaveLength(2);
            expect(result.recordsByEmployee).toHaveLength(1);
        });
    });

    describe('getEmployeeAttendance', () => {
        it('should return attendance records for a specific employee', async () => {
            const attendanceRecords = [mockAttendanceRecord];
            attendanceService.getAttendanceRecords.mockResolvedValue(attendanceRecords as any);

            const result = await controller.getEmployeeAttendance('emp-123', mockDataScope, {});

            expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    employeeId: 'emp-123',
                }),
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].employeeId).toBe('emp-123');
        });
    });

    describe('getEmployeeAttendanceSummary', () => {
        it('should return attendance summary for an employee', async () => {
            const summary = {
                employeeId: 'emp-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                totalHours: 160,
                presentDays: 20,
                partialDays: 2,
                absentDays: 9,
                dailySummary: [
                    {
                        date: '2024-01-15',
                        checkIn: new Date('2024-01-15T09:00:00Z'),
                        checkOut: new Date('2024-01-15T17:00:00Z'),
                        totalHours: 8,
                        status: 'present' as const,
                    },
                ],
            };

            attendanceService.getAttendanceSummary.mockResolvedValue(summary);

            const result = await controller.getEmployeeAttendanceSummary(
                'emp-123',
                '2024-01-01',
                '2024-01-31',
                mockDataScope
            );

            expect(attendanceService.getAttendanceSummary).toHaveBeenCalledWith(
                'emp-123',
                new Date('2024-01-01'),
                new Date('2024-01-31'),
                mockDataScope
            );
            expect(result.totalHours).toBe(160);
            expect(result.presentDays).toBe(20);
        });

        it('should throw error when dates are missing', async () => {
            await expect(
                controller.getEmployeeAttendanceSummary('emp-123', '', '2024-01-31', mockDataScope)
            ).rejects.toThrow('Start date and end date are required');
        });
    });

    describe('getBranchAttendance', () => {
        it('should return attendance records for a specific branch', async () => {
            const attendanceRecords = [mockAttendanceRecord];
            attendanceService.getAttendanceRecords.mockResolvedValue(attendanceRecords as any);

            const result = await controller.getBranchAttendance('branch-123', mockDataScope, {});

            expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    branchId: 'branch-123',
                }),
                mockDataScope
            );
            expect(result).toHaveLength(1);
            expect(result[0].branchId).toBe('branch-123');
        });
    });

    describe('getTodayAttendance', () => {
        it("should return today's attendance records", async () => {
            const attendanceRecords = [mockAttendanceRecord];
            attendanceService.getAttendanceRecords.mockResolvedValue(attendanceRecords as any);

            const result = await controller.getTodayAttendance(mockDataScope, {});

            expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate: expect.any(Date),
                    endDate: expect.any(Date),
                }),
                mockDataScope
            );
            expect(result).toHaveLength(1);
        });
    });

    describe('getLiveAttendance', () => {
        it('should return live attendance status', async () => {
            const checkInRecord = {
                ...mockAttendanceRecord,
                eventType: 'CHECK_IN',
                timestamp: new Date(),
            };

            attendanceService.getAttendanceRecords.mockResolvedValue([checkInRecord] as any);

            const result = await controller.getLiveAttendance(mockDataScope, {});

            expect(result).toHaveProperty('currentlyPresent');
            expect(result).toHaveProperty('recentActivity');
            expect(Array.isArray(result.currentlyPresent)).toBe(true);
            expect(Array.isArray(result.recentActivity)).toBe(true);
        });

        it('should calculate duration correctly', () => {
            const startTime = new Date('2024-01-15T09:00:00Z');
            const endTime = new Date('2024-01-15T11:30:00Z');

            const duration = (controller as any).calculateDuration(startTime, endTime);
            expect(duration).toBe('2h 30m');
        });

        it('should handle minutes-only duration', () => {
            const startTime = new Date('2024-01-15T09:00:00Z');
            const endTime = new Date('2024-01-15T09:45:00Z');

            const duration = (controller as any).calculateDuration(startTime, endTime);
            expect(duration).toBe('45m');
        });
    });

    describe('getAttendanceById', () => {
        it('should return a specific attendance record', async () => {
            attendanceService.getAttendanceById.mockResolvedValue(mockAttendanceRecord as any);

            const result = await controller.getAttendanceById('attendance-123', mockDataScope);

            expect(attendanceService.getAttendanceById).toHaveBeenCalledWith(
                'attendance-123',
                mockDataScope
            );
            expect(result.id).toBe('attendance-123');
        });
    });

    describe('deleteAttendanceRecord', () => {
        it('should delete an attendance record successfully', async () => {
            attendanceService.deleteAttendanceRecord.mockResolvedValue();

            await controller.deleteAttendanceRecord(
                'attendance-123',
                mockUserContext,
                mockDataScope
            );

            expect(attendanceService.deleteAttendanceRecord).toHaveBeenCalledWith(
                'attendance-123',
                mockDataScope
            );
        });
    });

    describe('getDailyAttendanceReport', () => {
        it('should return daily attendance report', async () => {
            const mockReport = {
                date: new Date('2024-01-15'),
                branchId: 'branch-123',
                totalEmployees: 10,
                presentEmployees: 8,
                partialEmployees: 1,
                absentEmployees: 1,
                totalHours: 64,
                averageHours: 8,
                employeeDetails: [],
            };

            attendanceService.getDailyAttendanceReport.mockResolvedValue(mockReport);

            const result = await controller.getDailyAttendanceReport(
                '2024-01-15',
                'branch-123',
                mockDataScope
            );

            expect(attendanceService.getDailyAttendanceReport).toHaveBeenCalledWith(
                new Date('2024-01-15'),
                'branch-123',
                mockDataScope
            );
            expect(result).toEqual(mockReport);
        });

        it('should use current date when no date provided', async () => {
            const mockReport = {
                date: expect.any(Date),
                branchId: undefined,
                totalEmployees: 5,
                presentEmployees: 4,
                partialEmployees: 1,
                absentEmployees: 0,
                totalHours: 32,
                averageHours: 8,
                employeeDetails: [],
            };

            attendanceService.getDailyAttendanceReport.mockResolvedValue(mockReport);

            await controller.getDailyAttendanceReport('', undefined, mockDataScope);

            expect(attendanceService.getDailyAttendanceReport).toHaveBeenCalledWith(
                expect.any(Date),
                undefined,
                mockDataScope
            );
        });
    });

    describe('getWeeklyAttendanceReport', () => {
        it('should return weekly attendance report', async () => {
            const mockReport = {
                startDate: new Date('2024-01-15'),
                endDate: new Date('2024-01-21'),
                branchId: 'branch-123',
                totalHours: 320,
                averageDailyHours: 45.7,
                totalEmployees: 10,
                dailyReports: [],
            };

            attendanceService.getWeeklyAttendanceReport.mockResolvedValue(mockReport);

            const result = await controller.getWeeklyAttendanceReport(
                '2024-01-15',
                'branch-123',
                mockDataScope
            );

            expect(attendanceService.getWeeklyAttendanceReport).toHaveBeenCalledWith(
                new Date('2024-01-15'),
                'branch-123',
                mockDataScope
            );
            expect(result).toEqual(mockReport);
        });

        it('should throw error when start date is missing', async () => {
            await expect(
                controller.getWeeklyAttendanceReport('', 'branch-123', mockDataScope)
            ).rejects.toThrow('Start date is required for weekly report');
        });
    });

    describe('getMonthlyAttendanceReport', () => {
        it('should return monthly attendance report', async () => {
            const mockReport = {
                year: 2024,
                month: 1,
                branchId: 'branch-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                totalEmployees: 10,
                totalHours: 1600,
                averageHoursPerEmployee: 160,
                employeeReports: [],
            };

            attendanceService.getMonthlyAttendanceReport.mockResolvedValue(mockReport);

            const result = await controller.getMonthlyAttendanceReport(
                '2024',
                '1',
                'branch-123',
                mockDataScope
            );

            expect(attendanceService.getMonthlyAttendanceReport).toHaveBeenCalledWith(
                2024,
                1,
                'branch-123',
                mockDataScope
            );
            expect(result).toEqual(mockReport);
        });

        it('should throw error when year or month is missing', async () => {
            await expect(
                controller.getMonthlyAttendanceReport('', '1', 'branch-123', mockDataScope)
            ).rejects.toThrow('Year and month are required for monthly report');

            await expect(
                controller.getMonthlyAttendanceReport('2024', '', 'branch-123', mockDataScope)
            ).rejects.toThrow('Year and month are required for monthly report');
        });
    });
});
