import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { LoggerService } from '@/core/logger';
import { DeviceRepository } from '../device.repository';
import { DataScope } from '@/shared/interfaces';
import { DeviceSyncEmployeesDto } from '@/shared/dto';
import { CredentialType } from '@prisma/client';

@Injectable()
export class EmployeeSyncService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
        private readonly deviceRepository: DeviceRepository
    ) {}

    /**
     * Sync employees to a device
     */
    async syncEmployeesToDevice(
        deviceId: string,
        syncDto: DeviceSyncEmployeesDto,
        scope: DataScope,
        syncedByUserId: string,
        correlationId?: string
    ) {
        const device = await this.deviceRepository.findById(deviceId, scope);
        if (!device) {
            throw new Error('Device not found');
        }

        if (!device.isActive) {
            throw new Error('Cannot sync employees to inactive device');
        }

        try {
            // Get employees to sync with their credentials
            let employeesToSync: Array<{
                id: string;
                employeeCode: string;
                firstName: string;
                lastName: string;
                email?: string;
                photoKey?: string;
                credentials?: Array<{
                    id: string;
                    type: CredentialType;
                    value: string;
                    metadata?: any;
                    isActive: boolean;
                }>;
            }> = [];

            if (syncDto.employeeIds && syncDto.employeeIds.length > 0) {
                // Sync specific employees
                employeesToSync = await this.getEmployeesWithCredentialsByIds(syncDto.employeeIds, scope);
            } else if (syncDto.departmentId) {
                // Sync all employees in a department
                employeesToSync = await this.getEmployeesWithCredentialsByDepartment(syncDto.departmentId, scope);
            } else if (syncDto.branchId) {
                // Sync all employees in a branch
                employeesToSync = await this.getEmployeesWithCredentialsByBranch(syncDto.branchId, scope);
            } else {
                // Sync all employees in the organization
                employeesToSync = await this.getEmployeesWithCredentialsByOrganization(scope.organizationId);
            }

            // Get currently synced employees for this device
            const currentlySynced = await this.prisma.employeeDeviceSync.findMany({
                where: {
                    deviceId,
                    organizationId: scope.organizationId,
                },
            });

            const currentlySyncedIds = currentlySynced.map(sync => sync.employeeId);
            const newEmployeeIds = employeesToSync.map(emp => emp.id);

            // Determine which employees to add, update, or remove
            const employeesToAdd = newEmployeeIds.filter(id => !currentlySyncedIds.includes(id));
            const employeesToRemove = syncDto.removeMissing
                ? currentlySyncedIds.filter(id => !newEmployeeIds.includes(id))
                : [];
            const employeesToUpdate = newEmployeeIds.filter(id => currentlySyncedIds.includes(id));

            // Process sync operations
            const results = await this.processSyncOperations({
                deviceId,
                employeesToAdd,
                employeesToUpdate,
                employeesToRemove,
                forceSync: syncDto.forceSync,
                organizationId: scope.organizationId,
            });

            // Log the sync operation
            this.logger.logUserAction(syncedByUserId, 'DEVICE_EMPLOYEE_SYNC_COMPLETED', {
                deviceId,
                deviceName: device.name,
                totalEmployees: employeesToSync.length,
                added: results.added,
                updated: results.updated,
                removed: results.removed,
                failed: results.failed,
                forceSync: syncDto.forceSync,
                organizationId: scope.organizationId,
            });

            return {
                deviceId,
                deviceName: device.name,
                totalEmployees: employeesToSync.length,
                employeesWithCredentials: employeesToSync.map(emp => ({
                    id: emp.id,
                    employeeCode: emp.employeeCode,
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    email: emp.email,
                    photoKey: emp.photoKey,
                    credentials: (emp as any).EmployeeCredential || [],
                })),
                ...results,
                syncedAt: new Date(),
                status: 'COMPLETED',
                message: 'Employee sync with credentials completed successfully',
            };
        } catch (error) {
            this.logger.error('Employee sync failed', error, {
                deviceId,
                organizationId: scope.organizationId,
            });

            throw error;
        }
    }

    /**
     * Get sync status for a device
     */
    async getSyncStatus(deviceId: string, scope: DataScope) {
        const device = await this.deviceRepository.findById(deviceId, scope);
        if (!device) {
            throw new Error('Device not found');
        }

        const syncRecords = await this.prisma.employeeDeviceSync.findMany({
            where: {
                deviceId,
                organizationId: scope.organizationId,
            },
            orderBy: { updatedAt: 'desc' },
        });

        const stats = await this.prisma.employeeDeviceSync.groupBy({
            by: ['syncStatus'],
            where: {
                deviceId,
                organizationId: scope.organizationId,
            },
            _count: {
                syncStatus: true,
            },
        });

        const statusCounts = stats.reduce(
            (acc, stat) => {
                acc[stat.syncStatus] = stat._count.syncStatus;
                return acc;
            },
            {} as Record<string, number>
        );

        return {
            deviceId,
            deviceName: device.name,
            totalSynced: syncRecords.length,
            statusCounts,
            recentSyncs: syncRecords.slice(0, 10), // Last 10 sync operations
        };
    }

    /**
     * Get employees with credentials by IDs
     */
    private async getEmployeesWithCredentialsByIds(employeeIds: string[], scope: DataScope) {
        return this.prisma.employee.findMany({
            where: {
                id: {
                    in: employeeIds,
                },
                organizationId: scope.organizationId,
                ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                isActive: true,
            },
            include: {
                EmployeeCredential: {
                    where: {
                        isActive: true,
                    },
                    select: {
                        id: true,
                        type: true,
                        value: true,
                        metadata: true,
                        isActive: true,
                    },
                },
            },
        });
    }

    /**
     * Get employees with credentials by department
     */
    private async getEmployeesWithCredentialsByDepartment(departmentId: string, scope: DataScope) {
        return this.prisma.employee.findMany({
            where: {
                departmentId,
                organizationId: scope.organizationId,
                ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                isActive: true,
            },
            include: {
                EmployeeCredential: {
                    where: {
                        isActive: true,
                    },
                    select: {
                        id: true,
                        type: true,
                        value: true,
                        metadata: true,
                        isActive: true,
                    },
                },
            },
        });
    }

    /**
     * Get employees with credentials by branch
     */
    private async getEmployeesWithCredentialsByBranch(branchId: string, scope: DataScope) {
        return this.prisma.employee.findMany({
            where: {
                branchId,
                organizationId: scope.organizationId,
                ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                isActive: true,
            },
            include: {
                EmployeeCredential: {
                    where: {
                        isActive: true,
                    },
                    select: {
                        id: true,
                        type: true,
                        value: true,
                        metadata: true,
                        isActive: true,
                    },
                },
            },
        });
    }

    /**
     * Get employees with credentials by organization
     */
    private async getEmployeesWithCredentialsByOrganization(organizationId: string) {
        return this.prisma.employee.findMany({
            where: {
                organizationId,
                isActive: true,
            },
            include: {
                EmployeeCredential: {
                    where: {
                        isActive: true,
                    },
                    select: {
                        id: true,
                        type: true,
                        value: true,
                        metadata: true,
                        isActive: true,
                    },
                },
            },
        });
    }

    /**
     * Process sync operations
     */
    private async processSyncOperations(params: {
        deviceId: string;
        employeesToAdd: string[];
        employeesToUpdate: string[];
        employeesToRemove: string[];
        forceSync: boolean;
        organizationId: string;
    }) {
        const {
            deviceId,
            employeesToAdd,
            employeesToUpdate,
            employeesToRemove,
            forceSync,
            organizationId,
        } = params;

        const results = {
            added: 0,
            updated: 0,
            removed: 0,
            failed: 0,
        };

        // Add new employees
        for (const employeeId of employeesToAdd) {
            try {
                await this.prisma.employeeDeviceSync.create({
                    data: {
                        deviceId,
                        employeeId,
                        organizationId,
                        syncStatus: 'SYNCED',
                        syncType: 'ADD',
                        syncAttempted: new Date(),
                        syncedAt: new Date(),
                    },
                });
                results.added++;
            } catch (error) {
                await this.prisma.employeeDeviceSync.create({
                    data: {
                        deviceId,
                        employeeId,
                        organizationId,
                        syncStatus: 'FAILED',
                        syncType: 'ADD',
                        syncAttempted: new Date(),
                        errorMessage: error.message,
                    },
                });
                results.failed++;
            }
        }

        // Update existing employees (only if forceSync or if they've been modified)
        if (forceSync) {
            for (const employeeId of employeesToUpdate) {
                try {
                    await this.prisma.employeeDeviceSync.updateMany({
                        where: {
                            deviceId,
                            employeeId,
                            organizationId,
                        },
                        data: {
                            syncStatus: 'SYNCED',
                            syncType: 'UPDATE',
                            syncAttempted: new Date(),
                            syncedAt: new Date(),
                            errorMessage: null,
                        },
                    });
                    results.updated++;
                } catch (error) {
                    await this.prisma.employeeDeviceSync.updateMany({
                        where: {
                            deviceId,
                            employeeId,
                            organizationId,
                        },
                        data: {
                            syncStatus: 'FAILED',
                            syncType: 'UPDATE',
                            syncAttempted: new Date(),
                            errorMessage: error.message,
                        },
                    });
                    results.failed++;
                }
            }
        }

        // Remove employees (if specified)
        for (const employeeId of employeesToRemove) {
            try {
                await this.prisma.employeeDeviceSync.deleteMany({
                    where: {
                        deviceId,
                        employeeId,
                        organizationId,
                    },
                });
                results.removed++;
            } catch {
                results.failed++;
            }
        }

        return results;
    }

    /**
     * Get sync history for an employee
     */
    async getEmployeeSyncHistory(employeeId: string, scope: DataScope) {
        return this.prisma.employeeDeviceSync.findMany({
            where: {
                employeeId,
                organizationId: scope.organizationId,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    /**
     * Retry failed syncs for a device
     */
    async retryFailedSyncs(deviceId: string, scope: DataScope, retriedByUserId: string) {
        const failedSyncs = await this.prisma.employeeDeviceSync.findMany({
            where: {
                deviceId,
                organizationId: scope.organizationId,
                syncStatus: 'FAILED',
            },
        });

        const retryResults = {
            total: failedSyncs.length,
            successful: 0,
            failed: 0,
        };

        for (const sync of failedSyncs) {
            try {
                await this.prisma.employeeDeviceSync.update({
                    where: { id: sync.id },
                    data: {
                        syncStatus: 'SYNCED',
                        syncType: sync.syncType,
                        syncAttempted: new Date(),
                        syncedAt: new Date(),
                        errorMessage: null,
                    },
                });
                retryResults.successful++;
            } catch (error) {
                await this.prisma.employeeDeviceSync.update({
                    where: { id: sync.id },
                    data: {
                        syncStatus: 'FAILED',
                        syncAttempted: new Date(),
                        errorMessage: error.message,
                    },
                });
                retryResults.failed++;
            }
        }

        // Log the retry operation
        this.logger.logUserAction(retriedByUserId, 'DEVICE_EMPLOYEE_SYNC_RETRY', {
            deviceId,
            ...retryResults,

            organizationId: scope.organizationId,
        });

        return retryResults;
    }

    /**
     * Get employees with specific credential type for device sync
     */
    async getEmployeesWithCredentialType(
        deviceId: string,
        credentialType: CredentialType,
        scope: DataScope
    ) {
        const device = await this.deviceRepository.findById(deviceId, scope);
        if (!device) {
            throw new Error('Device not found');
        }

        const employees = await this.prisma.employee.findMany({
            where: {
                organizationId: scope.organizationId,
                ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                isActive: true,
                EmployeeCredential: {
                    some: {
                        type: credentialType,
                        isActive: true,
                    },
                },
            },
            include: {
                EmployeeCredential: {
                    where: {
                        type: credentialType,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        type: true,
                        value: true,
                        metadata: true,
                        isActive: true,
                    },
                },
            },
        });

        return {
            deviceId,
            deviceName: device.name,
            credentialType,
            totalEmployees: employees.length,
            employees: employees.map(emp => ({
                id: emp.id,
                employeeCode: emp.employeeCode,
                firstName: emp.firstName,
                lastName: emp.lastName,
                email: emp.email,
                photoKey: emp.photoKey,
                credentials: (emp as any).EmployeeCredential,
            })),
        };
    }

    /**
     * Sync only employees with face credentials to device
     */
    async syncEmployeesWithFaceCredentials(
        deviceId: string,
        scope: DataScope,
        syncedByUserId: string
    ) {
        const device = await this.deviceRepository.findById(deviceId, scope);
        if (!device) {
            throw new Error('Device not found');
        }

        if (!device.isActive) {
            throw new Error('Cannot sync employees to inactive device');
        }

        try {
            // Get employees with face credentials
            const employeesWithFace = await this.prisma.employee.findMany({
                where: {
                    organizationId: scope.organizationId,
                    ...(scope.branchIds && { branchId: { in: scope.branchIds } }),
                    isActive: true,
                    EmployeeCredential: {
                        some: {
                            type: CredentialType.FACE,
                            isActive: true,
                        },
                    },
                },
                include: {
                    EmployeeCredential: {
                        where: {
                            type: CredentialType.FACE,
                            isActive: true,
                        },
                    },
                },
            });

            // Process sync for each employee
            const results = {
                added: 0,
                updated: 0,
                failed: 0,
            };

            for (const employee of employeesWithFace) {
                try {
                    // Check if employee is already synced
                    const existingSync = await this.prisma.employeeDeviceSync.findFirst({
                        where: {
                            deviceId,
                            employeeId: employee.id,
                            organizationId: scope.organizationId,
                        },
                    });

                    if (existingSync) {
                        // Update existing sync
                        await this.prisma.employeeDeviceSync.update({
                            where: { id: existingSync.id },
                            data: {
                                syncStatus: 'SYNCED',
                                syncType: 'UPDATE',
                                syncAttempted: new Date(),
                                syncedAt: new Date(),
                                errorMessage: null,
                            },
                        });
                        results.updated++;
                    } else {
                        // Create new sync record
                        await this.prisma.employeeDeviceSync.create({
                            data: {
                                deviceId,
                                employeeId: employee.id,
                                organizationId: scope.organizationId,
                                syncStatus: 'SYNCED',
                                syncType: 'ADD',
                                syncAttempted: new Date(),
                                syncedAt: new Date(),
                            },
                        });
                        results.added++;
                    }
                } catch (error) {
                    // Handle sync failure
                    const existingSync = await this.prisma.employeeDeviceSync.findFirst({
                        where: {
                            deviceId,
                            employeeId: employee.id,
                            organizationId: scope.organizationId,
                        },
                    });

                    if (existingSync) {
                        await this.prisma.employeeDeviceSync.update({
                            where: { id: existingSync.id },
                            data: {
                                syncStatus: 'FAILED',
                                syncAttempted: new Date(),
                                errorMessage: error.message,
                            },
                        });
                    } else {
                        await this.prisma.employeeDeviceSync.create({
                            data: {
                                deviceId,
                                employeeId: employee.id,
                                organizationId: scope.organizationId,
                                syncStatus: 'FAILED',
                                syncType: 'ADD',
                                syncAttempted: new Date(),
                                errorMessage: error.message,
                            },
                        });
                    }
                    results.failed++;
                }
            }

            // Log the sync operation
            this.logger.logUserAction(syncedByUserId, 'DEVICE_FACE_CREDENTIAL_SYNC_COMPLETED', {
                deviceId,
                deviceName: device.name,
                totalEmployees: employeesWithFace.length,
                ...results,
                organizationId: scope.organizationId,
            });

            return {
                deviceId,
                deviceName: device.name,
                credentialType: CredentialType.FACE,
                totalEmployees: employeesWithFace.length,
                employeesWithFaceCredentials: employeesWithFace.map(emp => ({
                    id: emp.id,
                    employeeCode: emp.employeeCode,
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    email: emp.email,
                    photoKey: emp.photoKey,
                    faceCredentials: (emp as any).EmployeeCredential,
                })),
                ...results,
                syncedAt: new Date(),
                status: 'COMPLETED',
                message: 'Face credential sync completed successfully',
            };
        } catch (error) {
            this.logger.error('Face credential sync failed', error, {
                deviceId,
                organizationId: scope.organizationId,
            });

            throw error;
        }
    }
}
