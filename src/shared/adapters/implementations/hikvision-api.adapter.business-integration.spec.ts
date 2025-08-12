import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { setupServer } from 'msw/node';
import { http as rest } from 'msw';

import { DatabaseModule } from '@/core/database/database.module';
import { CacheModule } from '@/core/cache/cache.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { HikvisionAdapterModule } from '../hikvision-adapter.module';
import { HikvisionApiAdapter } from './hikvision-api.adapter';
import { CreateDeviceUserDto, UpdateDeviceUserDto } from '../hikvision.adapter';
import { DeviceType, DeviceStatus } from '@prisma/client';

// Mock business services that would integrate with the adapter
class MockEmployeeService {
    private employees = new Map([
        [
            'EMP001',
            {
                id: 'EMP001',
                name: 'John Doe',
                department: 'Engineering',
                accessLevel: 1,
                isActive: true,
            },
        ],
        [
            'EMP002',
            { id: 'EMP002', name: 'Jane Smith', department: 'HR', accessLevel: 2, isActive: true },
        ],
        [
            'EMP003',
            {
                id: 'EMP003',
                name: 'Bob Johnson',
                department: 'Security',
                accessLevel: 3,
                isActive: false,
            },
        ],
    ]);

    async getEmployee(employeeId: string) {
        return this.employees.get(employeeId) || null;
    }

    async getActiveEmployees() {
        return Array.from(this.employees.values()).filter(emp => emp.isActive);
    }

    async updateEmployeeAccessLevel(employeeId: string, accessLevel: number) {
        const employee = this.employees.get(employeeId);
        if (employee) {
            employee.accessLevel = accessLevel;
            return true;
        }
        return false;
    }

    async deactivateEmployee(employeeId: string) {
        const employee = this.employees.get(employeeId);
        if (employee) {
            employee.isActive = false;
            return true;
        }
        return false;
    }
}

class MockDeviceService {
    private devices = new Map([
        [
            'device-1',
            { id: 'device-1', name: 'Main Entrance', location: 'Building A', isActive: true },
        ],
        [
            'device-2',
            { id: 'device-2', name: 'Server Room', location: 'Building B', isActive: true },
        ],
        [
            'device-3',
            { id: 'device-3', name: 'Executive Floor', location: 'Building A', isActive: false },
        ],
    ]);

    async getActiveDevices() {
        return Array.from(this.devices.values()).filter(device => device.isActive);
    }

    async getDevice(deviceId: string) {
        return this.devices.get(deviceId) || null;
    }

    async updateDeviceStatus(deviceId: string, status: 'online' | 'offline' | 'maintenance') {
        const device = this.devices.get(deviceId);
        if (device) {
            (device as any).status = status;
            return true;
        }
        return false;
    }
}

class MockAuditService {
    private auditLogs: any[] = [];

    async logUserSync(
        deviceId: string,
        employeeId: string,
        action: 'add' | 'update' | 'remove',
        success: boolean
    ) {
        this.auditLogs.push({
            timestamp: new Date(),
            deviceId,
            employeeId,
            action,
            success,
            type: 'user_sync',
        });
    }

    async logDeviceOperation(deviceId: string, operation: string, success: boolean, details?: any) {
        this.auditLogs.push({
            timestamp: new Date(),
            deviceId,
            operation,
            success,
            details,
            type: 'device_operation',
        });
    }

    async getAuditLogs(filters?: any) {
        return this.auditLogs.filter(log => {
            if (filters?.deviceId && log.deviceId !== filters.deviceId) return false;
            if (filters?.type && log.type !== filters.type) return false;
            return true;
        });
    }

    clearLogs() {
        this.auditLogs = [];
    }
}

// Business Integration Service that orchestrates employee-device synchronization
class EmployeeDeviceSyncService {
    constructor(
        private readonly employeeService: MockEmployeeService,
        private readonly deviceService: MockDeviceService,
        private readonly auditService: MockAuditService,
        private readonly deviceAdapter: HikvisionApiAdapter,
        private readonly eventEmitter: EventEmitter2
    ) {}

    /**
     * Synchronize all active employees to all active devices
     */
    async syncAllEmployeesToDevices(): Promise<{
        totalEmployees: number;
        totalDevices: number;
        successfulSyncs: number;
        failedSyncs: number;
        errors: string[];
    }> {
        const employees = await this.employeeService.getActiveEmployees();
        const devices = await this.deviceService.getActiveDevices();
        const errors: string[] = [];
        let successfulSyncs = 0;
        let failedSyncs = 0;

        for (const device of devices) {
            for (const employee of employees) {
                try {
                    const userData: CreateDeviceUserDto = {
                        employeeNo: employee.id,
                        name: employee.name,
                        userType: employee.accessLevel >= 3 ? 'admin' : 'normal',
                    };

                    const success = await this.deviceAdapter.addUser(device.id, userData);

                    await this.auditService.logUserSync(device.id, employee.id, 'add', success);

                    if (success) {
                        successfulSyncs++;
                        this.eventEmitter.emit('employee.synced', {
                            employeeId: employee.id,
                            deviceId: device.id,
                            action: 'add',
                        });
                    } else {
                        failedSyncs++;
                        errors.push(
                            `Failed to sync employee ${employee.id} to device ${device.id}`
                        );
                    }
                } catch (error) {
                    failedSyncs++;
                    const errorMsg = `Error syncing employee ${employee.id} to device ${device.id}: ${error.message}`;
                    errors.push(errorMsg);
                }
            }
        }

        return {
            totalEmployees: employees.length,
            totalDevices: devices.length,
            successfulSyncs,
            failedSyncs,
            errors,
        };
    }
}
