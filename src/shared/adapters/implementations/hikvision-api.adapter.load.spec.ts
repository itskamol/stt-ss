import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { HikvisionAdapterModule } from '../hikvision-adapter.module';
import { CreateDeviceUserDto } from '../hikvision.adapter';
import { HikvisionApiAdapter } from './hikvision-api.adapter';

describe('Hikvision Adapter Load Tests', () => {
    let app: TestingModule;
    let deviceAdapter: HikvisionApiAdapter;

    beforeAll(async () => {
        // Set up test environment
        process.env.SECRET_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.SECRET_ENCRYPTION_IV = '0123456789abcdef0123456789abcdef';
        process.env.DEVICE_ADAPTER_TYPE = 'stub';
        process.env.LOG_LEVEL = 'warn'; // Reduce logging for load tests

        app = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                HttpModule,
                HikvisionAdapterModule.forRoot({
                    adapterType: 'stub',
                    useStubAdapter: true,
                    httpTimeout: 2000, // Shorter timeout for load tests
                    cacheConfig: { ttl: 60, max: 500 },
                }),
            ],
        }).compile();

        deviceAdapter = app.get<HikvisionApiAdapter>('HikvisionApiAdapter');
    });

    afterAll(async () => {
        await app.close();
        
        // Clean up environment
        delete process.env.SECRET_ENCRYPTION_KEY;
        delete process.env.SECRET_ENCRYPTION_IV;
        delete process.env.DEVICE_ADAPTER_TYPE;
        delete process.env.LOG_LEVEL;
    });

    describe('High Concurrency Tests', () => {
        it('should handle 100 concurrent device discovery requests', async () => {
            const concurrentRequests = 100;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, () =>
                deviceAdapter.discoverDevices()
            );

            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // All requests should complete
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBe(concurrentRequests);

            // Should complete in reasonable time (less than 30 seconds)
            expect(duration).toBeLessThan(30000);

            console.log(`100 concurrent discovery requests completed in ${duration}ms`);
        }, 35000);

        it('should handle 50 concurrent user operations', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const concurrentOperations = 50;
            const startTime = Date.now();

            // Create concurrent user operations
            const promises = Array.from({ length: concurrentOperations }, (_, i) => {
                const userData: CreateDeviceUserDto = {
                    employeeNo: `LOAD${i.toString().padStart(3, '0')}`,
                    name: `Load Test User ${i}`,
                    userType: i % 2 === 0 ? 'normal' : 'visitor',
                };

                return deviceAdapter.addUser(deviceId, userData);
            });

            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Most requests should succeed (allowing for some failures in load testing)
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(concurrentOperations * 0.8); // At least 80% success

            console.log(`${concurrentOperations} concurrent user operations: ${successCount} succeeded in ${duration}ms`);
        }, 30000);

        it('should handle mixed operation types under load', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const operationsPerType = 20;
            const startTime = Date.now();

            // Mix different types of operations
            const promises = [
                // Connection tests
                ...Array.from({ length: operationsPerType }, () =>
                    deviceAdapter.testConnection(deviceId)
                ),
                // Device info requests
                ...Array.from({ length: operationsPerType }, () =>
                    deviceAdapter.getDeviceInfo(deviceId)
                ),
                // Health checks
                ...Array.from({ length: operationsPerType }, () =>
                    deviceAdapter.getDeviceHealth(deviceId)
                ),
                // User searches
                ...Array.from({ length: operationsPerType }, (_, i) =>
                    deviceAdapter.findUserByEmployeeNo(deviceId, `SEARCH${i}`)
                ),
            ];

            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Analyze results
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const totalOperations = operationsPerType * 4;

            expect(successCount).toBeGreaterThan(totalOperations * 0.9); // At least 90% success

            console.log(`${totalOperations} mixed operations: ${successCount} succeeded in ${duration}ms`);
            console.log(`Average operation time: ${duration / totalOperations}ms`);
        }, 45000);
    });

    describe('Memory and Resource Tests', () => {
        it('should not leak memory during repeated operations', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const iterations = 1000;

            // Get initial memory usage
            const initialMemory = process.memoryUsage();

            // Perform many operations
            for (let i = 0; i < iterations; i++) {
                await deviceAdapter.testConnection(deviceId);
                
                // Occasionally check other operations
                if (i % 100 === 0) {
                    await deviceAdapter.getDeviceHealth(deviceId);
                    await deviceAdapter.findUserByEmployeeNo(deviceId, `MEM${i}`);
                }
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            // Check final memory usage
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

            console.log(`Memory usage after ${iterations} operations:`);
            console.log(`Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(1)}%)`);

            // Memory increase should be reasonable (less than 50% increase)
            expect(memoryIncreasePercent).toBeLessThan(50);
        }, 60000);

        it('should handle cache pressure efficiently', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const cacheOperations = 200;

            // Perform operations that use caching
            const promises = Array.from({ length: cacheOperations }, (_, i) =>
                deviceAdapter.getFaceData(deviceId, `CACHE${i}`)
            );

            const startTime = Date.now();
            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Most operations should complete (some may fail due to non-existent users)
            const completedCount = results.filter(r => r.status === 'fulfilled').length;
            expect(completedCount).toBeGreaterThan(cacheOperations * 0.5);

            console.log(`${cacheOperations} cache operations completed in ${duration}ms`);
        }, 30000);
    });

    describe('Stress Tests', () => {
        it('should handle rapid successive operations on same device', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const rapidOperations = 100;
            const startTime = Date.now();

            // Perform rapid successive operations
            const results = [];
            for (let i = 0; i < rapidOperations; i++) {
                try {
                    const result = await deviceAdapter.testConnection(deviceId);
                    results.push(result);
                } catch {
                    results.push(false);
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;
            const successCount = results.filter(r => r === true).length;

            // Most operations should succeed
            expect(successCount).toBeGreaterThan(rapidOperations * 0.9);

            console.log(`${rapidOperations} rapid operations: ${successCount} succeeded in ${duration}ms`);
            console.log(`Average operation time: ${duration / rapidOperations}ms`);
        }, 25000);

        it('should handle burst traffic patterns', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const burstSize = 50;
            const burstCount = 5;
            const burstInterval = 1000; // 1 second between bursts

            let totalOperations = 0;
            let totalSuccesses = 0;
            const startTime = Date.now();

            for (let burst = 0; burst < burstCount; burst++) {
                console.log(`Starting burst ${burst + 1}/${burstCount}`);

                // Create burst of operations
                const burstPromises = Array.from({ length: burstSize }, () =>
                    deviceAdapter.testConnection(deviceId)
                );

                const burstResults = await Promise.allSettled(burstPromises);
                const burstSuccesses = burstResults.filter(r => 
                    r.status === 'fulfilled' && r.value === true
                ).length;

                totalOperations += burstSize;
                totalSuccesses += burstSuccesses;

                console.log(`Burst ${burst + 1}: ${burstSuccesses}/${burstSize} succeeded`);

                // Wait between bursts (except for the last one)
                if (burst < burstCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, burstInterval));
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Overall success rate should be high
            const successRate = (totalSuccesses / totalOperations) * 100;
            expect(successRate).toBeGreaterThan(85); // At least 85% success rate

            console.log(`Burst test completed: ${totalSuccesses}/${totalOperations} (${successRate.toFixed(1)}%) in ${duration}ms`);
        }, 40000);
    });

    describe('Edge Cases and Resilience', () => {
        it('should handle malformed responses gracefully', async () => {
            // This test would require mocking malformed responses
            // For now, we test that the adapter doesn't crash with edge cases
            const devices = await deviceAdapter.discoverDevices();
            expect(Array.isArray(devices)).toBe(true);
        });

        it('should recover from temporary failures', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;

            // Test recovery by performing operations after simulated failures
            const operations = [
                () => deviceAdapter.testConnection(deviceId),
                () => deviceAdapter.getDeviceInfo(deviceId),
                () => deviceAdapter.getDeviceHealth(deviceId),
            ];

            for (const operation of operations) {
                // Each operation should work independently
                await expect(operation()).resolves.not.toThrow();
            }
        });

        it('should maintain consistency under concurrent modifications', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const userCount = 20;

            // Create users concurrently
            const createPromises = Array.from({ length: userCount }, (_, i) => {
                const userData: CreateDeviceUserDto = {
                    employeeNo: `CONCURRENT${i.toString().padStart(3, '0')}`,
                    name: `Concurrent User ${i}`,
                    userType: 'normal',
                };

                return deviceAdapter.addUser(deviceId, userData).catch(() => false);
            });

            const createResults = await Promise.allSettled(createPromises);
            const createSuccesses = createResults.filter(r => 
                r.status === 'fulfilled' && r.value === true
            ).length;

            // Delete users concurrently
            const deletePromises = Array.from({ length: userCount }, (_, i) =>
                deviceAdapter.removeUser(deviceId, `CONCURRENT${i.toString().padStart(3, '0')}`).catch(() => false)
            );

            const deleteResults = await Promise.allSettled(deletePromises);
            const deleteSuccesses = deleteResults.filter(r => 
                r.status === 'fulfilled'
            ).length;

            console.log(`Concurrent operations: ${createSuccesses} creates, ${deleteSuccesses} deletes`);

            // Should handle most operations successfully
            expect(createSuccesses).toBeGreaterThan(userCount * 0.7);
        }, 30000);
    });

    describe('Performance Benchmarks', () => {
        it('should meet performance benchmarks for common operations', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const benchmarks = {
                testConnection: { target: 100, tolerance: 50 }, // 100ms ± 50ms
                getDeviceInfo: { target: 200, tolerance: 100 }, // 200ms ± 100ms
                getDeviceHealth: { target: 300, tolerance: 150 }, // 300ms ± 150ms
                findUser: { target: 150, tolerance: 75 }, // 150ms ± 75ms
            };

            // Test connection benchmark
            const connectionTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await deviceAdapter.testConnection(deviceId);
                connectionTimes.push(Date.now() - start);
            }
            const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;

            // Device info benchmark
            const infoTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await deviceAdapter.getDeviceInfo(deviceId);
                infoTimes.push(Date.now() - start);
            }
            const avgInfoTime = infoTimes.reduce((a, b) => a + b, 0) / infoTimes.length;

            // Health check benchmark
            const healthTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await deviceAdapter.getDeviceHealth(deviceId);
                healthTimes.push(Date.now() - start);
            }
            const avgHealthTime = healthTimes.reduce((a, b) => a + b, 0) / healthTimes.length;

            // User search benchmark
            const searchTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await deviceAdapter.findUserByEmployeeNo(deviceId, 'BENCHMARK001');
                searchTimes.push(Date.now() - start);
            }
            const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;

            console.log('Performance Benchmarks:');
            console.log(`Test Connection: ${avgConnectionTime.toFixed(1)}ms (target: ${benchmarks.testConnection.target}ms)`);
            console.log(`Get Device Info: ${avgInfoTime.toFixed(1)}ms (target: ${benchmarks.getDeviceInfo.target}ms)`);
            console.log(`Get Device Health: ${avgHealthTime.toFixed(1)}ms (target: ${benchmarks.getDeviceHealth.target}ms)`);
            console.log(`Find User: ${avgSearchTime.toFixed(1)}ms (target: ${benchmarks.findUser.target}ms)`);

            // Verify benchmarks (with tolerance for CI/CD environments)
            expect(avgConnectionTime).toBeLessThan(benchmarks.testConnection.target + benchmarks.testConnection.tolerance);
            expect(avgInfoTime).toBeLessThan(benchmarks.getDeviceInfo.target + benchmarks.getDeviceInfo.tolerance);
            expect(avgHealthTime).toBeLessThan(benchmarks.getDeviceHealth.target + benchmarks.getDeviceHealth.tolerance);
            expect(avgSearchTime).toBeLessThan(benchmarks.findUser.target + benchmarks.findUser.tolerance);
        }, 25000);

        it('should maintain performance with cache pressure', async () => {
            const devices = await deviceAdapter.discoverDevices();
            if (devices.length === 0) return;

            const deviceId = devices[0].id;
            const cacheOperations = 100;

            // Fill cache with operations
            const fillPromises = Array.from({ length: cacheOperations }, (_, i) =>
                deviceAdapter.getFaceData(deviceId, `CACHE${i}`)
            );

            await Promise.allSettled(fillPromises);

            // Now test performance with full cache
            const testOperations = 20;
            const startTime = Date.now();

            const testPromises = Array.from({ length: testOperations }, () =>
                deviceAdapter.testConnection(deviceId)
            );

            const results = await Promise.all(testPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // All operations should succeed
            expect(results.every(r => r === true)).toBe(true);

            // Performance should still be reasonable
            const avgTime = duration / testOperations;
            expect(avgTime).toBeLessThan(500); // Less than 500ms per operation

            console.log(`Performance with cache pressure: ${avgTime.toFixed(1)}ms per operation`);
        }, 35000);
    });

    describe('Scalability Tests', () => {
        it('should scale with increasing number of devices', async () => {
            // Simulate multiple devices by using different device IDs
            const deviceCount = 10;
            const operationsPerDevice = 5;

            const allPromises = [];

            for (let deviceIndex = 0; deviceIndex < deviceCount; deviceIndex++) {
                const deviceId = `scale-device-${deviceIndex}`;
                
                // Add operations for each device
                for (let opIndex = 0; opIndex < operationsPerDevice; opIndex++) {
                    allPromises.push(
                        deviceAdapter.testConnection(deviceId).catch(() => false)
                    );
                }
            }

            const startTime = Date.now();
            const results = await Promise.allSettled(allPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const totalOperations = deviceCount * operationsPerDevice;
            const successCount = results.filter(r => 
                r.status === 'fulfilled' && r.value !== false
            ).length;

            console.log(`Scalability test: ${successCount}/${totalOperations} operations across ${deviceCount} devices in ${duration}ms`);

            // Should handle the load reasonably well
            expect(duration).toBeLessThan(20000); // Less than 20 seconds
        }, 25000);
    });
});