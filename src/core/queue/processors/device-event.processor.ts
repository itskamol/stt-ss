import { Inject, Injectable } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../../logger/logger.service';
import { BaseJobProcessor } from './base.processor';
import { DeviceEventData } from '../queue.producer';
import { EmployeeRepository } from '../../../modules/employee/employee.repository';
import { AttendanceService } from '../../../modules/attendance/attendance.service';
import { IMatchingAdapter } from '../../../shared/adapters/matching.adapter';
import { DataScope } from '../../../shared/interfaces';

export interface ProcessedEventResult {
    eventId: string;
    employeeId?: string;
    attendanceId?: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT' | 'ACCESS_DENIED' | 'UNKNOWN';
    confidence?: number;
    processingTime: number;
}

@Injectable()
@Processor('events')
export class DeviceEventProcessor extends BaseJobProcessor<DeviceEventData> {
    constructor(
        protected readonly logger: LoggerService,
        private readonly employeeRepository: EmployeeRepository,
        private readonly attendanceService: AttendanceService,
        @Inject('IMatchingAdapter') private readonly matchingAdapter: IMatchingAdapter
    ) {
        super(logger);
    }

    async process(job: Job<DeviceEventData>): Promise<any> {
        switch (job.name) {
            case 'process-raw-device-event':
                return this.processRawDeviceEvent(job);
            case 'process-attendance-calculation':
                return this.processAttendanceCalculation(job);
            case 'process-biometric-matching':
                return this.processBiometricMatching(job);
            default:
                throw new Error(`Unknown job type: ${job.name}`);
        }
    }

    protected async execute(job: Job<DeviceEventData>): Promise<ProcessedEventResult> {
        const { data } = job;
        const startTime = Date.now();

        await this.updateProgress(job, 10, 'Starting event processing');

        // Step 1: Identify the employee
        const employeeId = await this.identifyEmployee(job, data);
        await this.updateProgress(job, 40, 'Employee identification complete');

        // Step 2: Determine event type (CHECK_IN vs CHECK_OUT)
        const eventType = await this.determineEventType(job, data, employeeId);
        await this.updateProgress(job, 60, 'Event type determined');

        // Step 3: Create attendance record if applicable
        let attendanceId: string | undefined;
        if (employeeId && (eventType === 'CHECK_IN' || eventType === 'CHECK_OUT')) {
            attendanceId = await this.createAttendanceRecord(job, data, employeeId, eventType);
            await this.updateProgress(job, 80, 'Attendance record created');
        }

        await this.updateProgress(job, 100, 'Event processing complete');

        const processingTime = Date.now() - startTime;

        return {
            eventId: job.id as string,
            employeeId,
            attendanceId,
            eventType,
            processingTime,
        };
    }

    private async processRawDeviceEvent(job: Job<DeviceEventData>): Promise<ProcessedEventResult> {
        return this.execute(job);
    }

    private async processAttendanceCalculation(job: Job<DeviceEventData>): Promise<any> {
        const { data } = job;

        // This would calculate attendance summaries, overtime, etc.
        this.logger.log('Processing attendance calculation', {
            jobId: job.id,
            employeeId: data.rawData?.employeeId,
            date: data.timestamp,
        });

        // Mock calculation
        return {
            employeeId: data.rawData?.employeeId,
            date: data.timestamp,
            totalHours: 8,
            overtime: 0,
            calculated: true,
        };
    }

    private async processBiometricMatching(job: Job<DeviceEventData>): Promise<any> {
        const { data } = job;

        if (!data.rawData?.biometricData) {
            throw new Error('No biometric data provided for matching');
        }

        try {
            const matchResult = await this.matchingAdapter.matchBiometric({
                template: data.rawData.biometricData,
                type: 'fingerprint', // This would be determined from device type
                organizationId: data.organizationId,
                branchId: data.branchId,
                threshold: 75,
            });

            return {
                matched: matchResult.matched,
                employeeId: matchResult.userId,
                confidence: matchResult.confidence,
                processingTime: matchResult.processingTime,
            };
        } catch (error) {
            this.logger.error('Biometric matching failed', error, {
                jobId: job.id,
                deviceId: data.deviceId,
            });
            throw error;
        }
    }

    private async identifyEmployee(
        job: Job<DeviceEventData>,
        data: DeviceEventData
    ): Promise<string | undefined> {
        const scope: DataScope = {
            organizationId: data.organizationId,
            branchIds: [data.branchId],
        };

        // Try different identification methods
        if (data.rawData?.employeeId) {
            // Direct employee ID
            const employee = await this.employeeRepository.findById(data.rawData.employeeId, scope);
            if (employee) {
                return employee.id;
            }
        }

        if (data.rawData?.cardId) {
            // Card-based identification
            // In a real implementation, you'd have a card-to-employee mapping
            this.logger.log('Card-based identification not implemented', {
                cardId: data.rawData.cardId,
            });
        }

        if (data.rawData?.biometricData) {
            // Biometric identification
            try {
                const matchResult = await this.matchingAdapter.matchBiometric({
                    template: data.rawData.biometricData,
                    type: 'fingerprint',
                    organizationId: data.organizationId,
                    branchId: data.branchId,
                    threshold: 75,
                });

                if (matchResult.matched && matchResult.userId) {
                    return matchResult.userId;
                }
            } catch (error) {
                this.logger.warn('Biometric identification failed', {
                    error: error.message,
                    deviceId: data.deviceId,
                });
            }
        }

        return undefined;
    }

    private async determineEventType(
        job: Job<DeviceEventData>,
        data: DeviceEventData,
        employeeId?: string
    ): Promise<'CHECK_IN' | 'CHECK_OUT' | 'ACCESS_DENIED' | 'UNKNOWN'> {
        if (!employeeId) {
            return 'ACCESS_DENIED';
        }

        // Get the employee's last attendance record for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scope: DataScope = {
            organizationId: data.organizationId,
            branchIds: [data.branchId],
        };

        try {
            const lastAttendance = await this.attendanceService.getLastAttendanceForEmployee(
                employeeId,
                today,
                scope
            );

            if (!lastAttendance) {
                // No attendance today, this is a CHECK_IN
                return 'CHECK_IN';
            }

            // If last event was CHECK_IN, this is CHECK_OUT
            // If last event was CHECK_OUT, this is CHECK_IN
            return lastAttendance.eventType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';
        } catch (error) {
            this.logger.warn('Failed to determine event type', {
                error: error.message,
                employeeId,
                deviceId: data.deviceId,
            });
            return 'UNKNOWN';
        }
    }

    private async createAttendanceRecord(
        job: Job<DeviceEventData>,
        data: DeviceEventData,
        employeeId: string,
        eventType: 'CHECK_IN' | 'CHECK_OUT'
    ): Promise<string> {
        const scope: DataScope = {
            organizationId: data.organizationId,
            branchIds: [data.branchId],
        };

        try {
            const attendance = await this.attendanceService.createAttendanceRecord(
                {
                    employeeId,
                    deviceId: data.deviceId,
                    eventType,
                    timestamp: data.timestamp,
                    organizationId: data.organizationId,
                    branchId: data.branchId,
                    metadata: {
                        rawEventData: data.rawData,
                        processingJobId: job.id,
                    },
                },
                scope
            );

            return attendance.id;
        } catch (error) {
            this.logger.error('Failed to create attendance record', error, {
                employeeId,
                eventType,
                deviceId: data.deviceId,
                jobId: job.id,
            });
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: ProcessedEventResult) {
        this.logger.log('Device event processed successfully', {
            jobId: job.id,
            eventType: result.eventType,
            employeeId: result.employeeId,
            attendanceId: result.attendanceId,
            processingTime: result.processingTime,
        });
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error('Device event processing failed', error.message, {
            jobId: job.id,
            deviceId: job.data.deviceId,
            eventType: job.data.eventType,
            attemptsMade: job.attemptsMade,
            attemptsTotal: job.opts.attempts,
        });
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn('Device event processing stalled', { jobId });
    }
}
