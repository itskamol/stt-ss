import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { DeviceEventProcessor } from './device-event.processor';
import { LoggerService } from '../../logger/logger.service';
import { EmployeeRepository } from '../../../modules/employee/employee.repository';
import { AttendanceService } from '../../../modules/attendance/attendance.service';
import { IMatchingAdapter } from '../../../shared/adapters/matching.adapter';
import { DeviceEventData } from '../queue.producer';

describe('DeviceEventProcessor', () => {
    let processor: DeviceEventProcessor;
    let loggerService: jest.Mocked<LoggerService>;
    let employeeRepository: jest.Mocked<EmployeeRepository>;
    let attendanceService: jest.Mocked<AttendanceService>;
    let matchingAdapter: jest.Mocked<IMatchingAdapter>;

    const mockDeviceEventData: DeviceEventData = {
        deviceId: 'device-123',
        eventType: 'access_attempt',
        timestamp: new Date(),
        rawData: {
            eventType: 'access_attempt',
            cardId: 'CARD-123',
            timestamp: new Date().toISOString(),
        },
        organizationId: 'org-123',
        branchId: 'branch-123',
    };

    const mockEmployee = {
        id: 'emp-123',
        organizationId: 'org-123',
        branchId: 'branch-123',
        departmentId: 'dept-123',
        firstName: 'John',
        lastName: 'Doe',
        employeeCode: 'EMP001',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const mockEmployeeRepository = {
            findById: jest.fn(),
            findByEmployeeCode: jest.fn(),
            findMany: jest.fn(),
        };

        const mockAttendanceService = {
            createAttendanceRecord: jest.fn(),
            getLastAttendanceForEmployee: jest.fn(),
        };

        const mockMatchingAdapter = {
            matchBiometric: jest.fn(),
            enrollBiometric: jest.fn(),
            healthCheck: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceEventProcessor,
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
                {
                    provide: EmployeeRepository,
                    useValue: mockEmployeeRepository,
                },
                {
                    provide: AttendanceService,
                    useValue: mockAttendanceService,
                },
                {
                    provide: 'IMatchingAdapter',
                    useValue: mockMatchingAdapter,
                },
            ],
        }).compile();

        processor = module.get<DeviceEventProcessor>(DeviceEventProcessor);
        loggerService = module.get(LoggerService);
        employeeRepository = module.get(EmployeeRepository);
        attendanceService = module.get(AttendanceService);
        matchingAdapter = module.get('IMatchingAdapter');
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    describe('processRawDeviceEvent', () => {
        const createMockJob = (data: DeviceEventData): Job<DeviceEventData> =>
            ({
                id: 'job-123',
                name: 'process-raw-device-event',
                data,
                opts: { attempts: 3 },
                attemptsMade: 1,
                updateProgress: jest.fn(),
            }) as any;

        it('should process event with direct employee ID successfully', async () => {
            const eventData = {
                ...mockDeviceEventData,
                rawData: {
                    ...mockDeviceEventData.rawData,
                    employeeId: 'emp-123',
                },
            };

            const job = createMockJob(eventData);

            employeeRepository.findById.mockResolvedValue(mockEmployee);
            attendanceService.getLastAttendanceForEmployee.mockResolvedValue(null);
            attendanceService.createAttendanceRecord.mockResolvedValue({
                id: 'attendance-123',
                employeeId: 'emp-123',
                eventType: 'CHECK_IN',
                timestamp: new Date(),
                organizationId: 'org-123',
                branchId: 'branch-123',
                createdAt: new Date(),
            } as any);

            const result = await (processor as any).execute(job);

            expect(result).toEqual({
                eventId: 'job-123',
                employeeId: 'emp-123',
                attendanceId: 'attendance-123',
                eventType: 'CHECK_IN',
                processingTime: expect.any(Number),
            });

            expect(employeeRepository.findById).toHaveBeenCalledWith('emp-123', {
                organizationId: 'org-123',
                branchIds: ['branch-123'],
            });

            expect(attendanceService.createAttendanceRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    employeeId: 'emp-123',
                    eventType: 'CHECK_IN',
                    organizationId: 'org-123',
                    branchId: 'branch-123',
                }),
                expect.any(Object)
            );
        });

        it('should process event with biometric identification', async () => {
            const eventData = {
                ...mockDeviceEventData,
                rawData: {
                    ...mockDeviceEventData.rawData,
                    biometricData: 'encoded-biometric-data',
                },
            };

            const job = createMockJob(eventData);

            matchingAdapter.matchBiometric.mockResolvedValue({
                matched: true,
                userId: 'emp-123',
                confidence: 85,
                processingTime: 150,
            });

            attendanceService.getLastAttendanceForEmployee.mockResolvedValue(null);
            attendanceService.createAttendanceRecord.mockResolvedValue({
                id: 'attendance-456',
                employeeId: 'emp-123',
                eventType: 'CHECK_IN',
                timestamp: new Date(),
                organizationId: 'org-123',
                branchId: 'branch-123',
                createdAt: new Date(),
            } as any);

            const result = await (processor as any).execute(job);

            expect(result.employeeId).toBe('emp-123');
            expect(result.eventType).toBe('CHECK_IN');
            expect(result.attendanceId).toBe('attendance-456');

            expect(matchingAdapter.matchBiometric).toHaveBeenCalledWith({
                template: 'encoded-biometric-data',
                type: 'fingerprint',
                organizationId: 'org-123',
                branchId: 'branch-123',
                threshold: 75,
            });
        });

        it('should handle access denied for unknown employee', async () => {
            const eventData = {
                ...mockDeviceEventData,
                rawData: {
                    ...mockDeviceEventData.rawData,
                    cardId: 'UNKNOWN-CARD',
                },
            };

            const job = createMockJob(eventData);

            const result = await (processor as any).execute(job);

            expect(result).toEqual({
                eventId: 'job-123',
                employeeId: undefined,
                attendanceId: undefined,
                eventType: 'ACCESS_DENIED',
                processingTime: expect.any(Number),
            });

            expect(attendanceService.createAttendanceRecord).not.toHaveBeenCalled();
        });

        it('should determine CHECK_OUT when last event was CHECK_IN', async () => {
            const eventData = {
                ...mockDeviceEventData,
                rawData: {
                    ...mockDeviceEventData.rawData,
                    employeeId: 'emp-123',
                },
            };

            const job = createMockJob(eventData);

            employeeRepository.findById.mockResolvedValue(mockEmployee);
            attendanceService.getLastAttendanceForEmployee.mockResolvedValue({
                id: 'last-attendance',
                eventType: 'CHECK_IN',
                timestamp: new Date(Date.now() - 3600000), // 1 hour ago
                employeeId: 'emp-123',
                organizationId: 'org-123',
                branchId: 'branch-123',
                createdAt: new Date(),
            } as any);

            attendanceService.createAttendanceRecord.mockResolvedValue({
                id: 'attendance-checkout',
                employeeId: 'emp-123',
                eventType: 'CHECK_OUT',
                timestamp: new Date(),
                organizationId: 'org-123',
                branchId: 'branch-123',
                createdAt: new Date(),
            } as any);

            const result = await (processor as any).execute(job);

            expect(result.eventType).toBe('CHECK_OUT');
            expect(attendanceService.createAttendanceRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'CHECK_OUT',
                }),
                expect.any(Object)
            );
        });

        it('should handle biometric matching failure gracefully', async () => {
            const eventData = {
                ...mockDeviceEventData,
                rawData: {
                    ...mockDeviceEventData.rawData,
                    biometricData: 'invalid-biometric-data',
                },
            };

            const job = createMockJob(eventData);

            matchingAdapter.matchBiometric.mockRejectedValue(
                new Error('Matching service unavailable')
            );

            const result = await (processor as any).execute(job);

            expect(result.eventType).toBe('ACCESS_DENIED');
            expect(loggerService.warn).toHaveBeenCalledWith(
                'Biometric identification failed',
                expect.objectContaining({
                    error: 'Matching service unavailable',
                    deviceId: 'device-123',
                })
            );
        });
    });

    describe('processBiometricMatching', () => {
        it('should process biometric matching job successfully', async () => {
            const job = {
                id: 'biometric-job-123',
                name: 'process-biometric-matching',
                data: {
                    ...mockDeviceEventData,
                    rawData: {
                        biometricData: 'encoded-biometric-data',
                    },
                },
            } as Job<DeviceEventData>;

            matchingAdapter.matchBiometric.mockResolvedValue({
                matched: true,
                userId: 'emp-123',
                confidence: 92,
                processingTime: 120,
            });

            const result = await (processor as any).processBiometricMatching(job);

            expect(result).toEqual({
                matched: true,
                employeeId: 'emp-123',
                confidence: 92,
                processingTime: 120,
            });
        });

        it('should throw error when no biometric data provided', async () => {
            const job = {
                id: 'biometric-job-456',
                name: 'process-biometric-matching',
                data: {
                    ...mockDeviceEventData,
                    rawData: {},
                },
            } as Job<DeviceEventData>;

            await expect((processor as any).processBiometricMatching(job)).rejects.toThrow(
                'No biometric data provided for matching'
            );
        });
    });

    describe('processAttendanceCalculation', () => {
        it('should process attendance calculation job', async () => {
            const job = {
                id: 'calc-job-123',
                name: 'process-attendance-calculation',
                data: {
                    ...mockDeviceEventData,
                    rawData: {
                        employeeId: 'emp-123',
                    },
                },
            } as Job<DeviceEventData>;

            const result = await (processor as any).processAttendanceCalculation(job);

            expect(result).toEqual({
                employeeId: 'emp-123',
                date: mockDeviceEventData.timestamp,
                totalHours: 8,
                overtime: 0,
                calculated: true,
            });

            expect(loggerService.log).toHaveBeenCalledWith(
                'Processing attendance calculation',
                expect.objectContaining({
                    jobId: 'calc-job-123',
                    employeeId: 'emp-123',
                })
            );
        });
    });

    describe('event handlers', () => {
        it('should log successful completion', () => {
            const job = { id: 'job-123', data: mockDeviceEventData } as Job<DeviceEventData>;
            const result = {
                eventId: 'job-123',
                employeeId: 'emp-123',
                attendanceId: 'attendance-123',
                eventType: 'CHECK_IN' as const,
                processingTime: 250,
            };

            processor.onCompleted(job, result);

            expect(loggerService.log).toHaveBeenCalledWith(
                'Device event processed successfully',
                expect.objectContaining({
                    jobId: 'job-123',
                    eventType: 'CHECK_IN',
                    employeeId: 'emp-123',
                    processingTime: 250,
                })
            );
        });

        it('should log processing failures', () => {
            const job = {
                id: 'job-456',
                data: mockDeviceEventData,
                attemptsMade: 2,
                opts: { attempts: 3 },
            } as Job<DeviceEventData>;
            const error = new Error('Processing failed');

            processor.onFailed(job, error);

            expect(loggerService.error).toHaveBeenCalledWith(
                'Device event processing failed',
                error.message,
                expect.objectContaining({
                    jobId: 'job-456',
                    deviceId: 'device-123',
                    eventType: 'access_attempt',
                    attemptsMade: 2,
                    attemptsTotal: 3,
                })
            );
        });

        it('should log stalled jobs', () => {
            processor.onStalled('stalled-job-789');

            expect(loggerService.warn).toHaveBeenCalledWith('Device event processing stalled', {
                jobId: 'stalled-job-789',
            });
        });
    });
});
