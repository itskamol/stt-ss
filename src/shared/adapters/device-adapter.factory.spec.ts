import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { DeviceAdapterFactory, AdapterType } from './device-adapter.factory';
import { HikvisionApiAdapter } from './implementations/hikvision-api.adapter';
import { StubDeviceAdapter } from './implementations/stub-device.adapter';

describe('DeviceAdapterFactory', () => {
    let factory: DeviceAdapterFactory;
    let configService: jest.Mocked<ConfigService>;
    let hikvisionAdapter: jest.Mocked<HikvisionApiAdapter>;
    let stubAdapter: jest.Mocked<StubDeviceAdapter>;

    beforeEach(async () => {
        const mockConfigService = {
            get: jest.fn(),
        };

        const mockHikvisionAdapter = {
            discoverDevices: jest.fn(),
        };

        const mockStubAdapter = {
            discoverDevices: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceAdapterFactory,
                { provide: ConfigService, useValue: mockConfigService },
                { provide: HikvisionApiAdapter, useValue: mockHikvisionAdapter },
                { provide: StubDeviceAdapter, useValue: mockStubAdapter },
            ],
        }).compile();

        factory = module.get<DeviceAdapterFactory>(DeviceAdapterFactory);
        configService = module.get(ConfigService);
        hikvisionAdapter = module.get(HikvisionApiAdapter);
        stubAdapter = module.get(StubDeviceAdapter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createAdapter', () => {
        it('should create Hikvision adapter', () => {
            const adapter = factory.createAdapter('hikvision');
            expect(adapter).toBe(hikvisionAdapter);
        });

        it('should create stub adapter', () => {
            const adapter = factory.createAdapter('stub');
            expect(adapter).toBe(stubAdapter);
        });

        it('should fallback to stub for unsupported types', () => {
            const adapter = factory.createAdapter('zkteco');
            expect(adapter).toBe(stubAdapter);
        });

        it('should fallback to stub for unknown types', () => {
            const adapter = factory.createAdapter('unknown' as AdapterType);
            expect(adapter).toBe(stubAdapter);
        });
    });

    describe('createAdapterFromConfig', () => {
        it('should create adapter based on environment config', () => {
            configService.get.mockReturnValue('hikvision');

            const adapter = factory.createAdapterFromConfig();
            expect(adapter).toBe(hikvisionAdapter);
            expect(configService.get).toHaveBeenCalledWith('DEVICE_ADAPTER_TYPE', 'hikvision');
        });

        it('should fallback to hikvision for unsupported config', () => {
            configService.get.mockReturnValue('unsupported');

            const adapter = factory.createAdapterFromConfig();
            expect(adapter).toBe(hikvisionAdapter);
        });
    });

    describe('createAdapterWithFailover', () => {
        it('should return first healthy adapter', async () => {
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);
            stubAdapter.discoverDevices.mockResolvedValue([]);

            const adapter = await factory.createAdapterWithFailover(['hikvision', 'stub']);
            expect(adapter).toBe(hikvisionAdapter);
        });

        it('should failover to second adapter if first is unhealthy', async () => {
            hikvisionAdapter.discoverDevices.mockRejectedValue(new Error('Connection failed'));
            stubAdapter.discoverDevices.mockResolvedValue([]);

            const adapter = await factory.createAdapterWithFailover(['hikvision', 'stub']);
            expect(adapter).toBe(stubAdapter);
        });

        it('should fallback to stub if all adapters fail', async () => {
            hikvisionAdapter.discoverDevices.mockRejectedValue(new Error('Connection failed'));

            const adapter = await factory.createAdapterWithFailover(['hikvision']);
            expect(adapter).toBe(stubAdapter);
        });
    });

    describe('adapter type utilities', () => {
        it('should return available adapter types', () => {
            const types = factory.getAvailableAdapterTypes();
            expect(types).toEqual(['hikvision', 'stub', 'zkteco', 'dahua']);
        });

        it('should return supported adapter types', () => {
            const types = factory.getSupportedAdapterTypes();
            expect(types).toEqual(['hikvision', 'stub']);
        });

        it('should check if adapter type is supported', () => {
            expect(factory.isAdapterTypeSupported('hikvision')).toBe(true);
            expect(factory.isAdapterTypeSupported('stub')).toBe(true);
            expect(factory.isAdapterTypeSupported('zkteco')).toBe(false);
        });
    });

    describe('health monitoring', () => {
        it('should track adapter health status', async () => {
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);

            await factory.createAdapterWithFailover(['hikvision']);

            const healthStatus = factory.getAdapterHealthStatus('hikvision');
            expect(healthStatus).toBeDefined();
            expect(healthStatus!.healthy).toBe(true);
            expect(healthStatus!.type).toBe('hikvision');
            expect(healthStatus!.lastCheck).toBeInstanceOf(Date);
        });

        it('should track unhealthy adapter status', async () => {
            hikvisionAdapter.discoverDevices.mockRejectedValue(new Error('Connection failed'));

            await factory.createAdapterWithFailover(['hikvision']);

            const healthStatus = factory.getAdapterHealthStatus('hikvision');
            expect(healthStatus).toBeDefined();
            expect(healthStatus!.healthy).toBe(false);
            expect(healthStatus!.error).toBe('Connection failed');
        });

        it('should perform health check on all adapters', async () => {
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);
            stubAdapter.discoverDevices.mockResolvedValue([]);

            const healthStatuses = await factory.performHealthCheckOnAllAdapters();

            expect(healthStatuses).toHaveLength(2);
            expect(healthStatuses.find(s => s.type === 'hikvision')?.healthy).toBe(true);
            expect(healthStatuses.find(s => s.type === 'stub')?.healthy).toBe(true);
        });

        it('should return all health statuses', async () => {
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);
            stubAdapter.discoverDevices.mockResolvedValue([]);

            await factory.performHealthCheckOnAllAdapters();

            const allStatuses = factory.getAllAdapterHealthStatuses();
            expect(allStatuses).toHaveLength(2);
        });

        it('should return null for non-existent health status', () => {
            const healthStatus = factory.getAdapterHealthStatus('zkteco');
            expect(healthStatus).toBeNull();
        });
    });

    describe('getRecommendedAdapterType', () => {
        it('should recommend configured type if healthy', async () => {
            configService.get.mockReturnValue('hikvision');
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);

            const recommendedType = await factory.getRecommendedAdapterType();
            expect(recommendedType).toBe('hikvision');
        });

        it('should recommend alternative if configured type is unhealthy', async () => {
            configService.get.mockReturnValue('hikvision');
            hikvisionAdapter.discoverDevices.mockRejectedValue(new Error('Connection failed'));
            stubAdapter.discoverDevices.mockResolvedValue([]);

            const recommendedType = await factory.getRecommendedAdapterType();
            expect(recommendedType).toBe('stub');
        });

        it('should recommend stub as ultimate fallback', async () => {
            configService.get.mockReturnValue('hikvision');
            hikvisionAdapter.discoverDevices.mockRejectedValue(new Error('Connection failed'));
            stubAdapter.discoverDevices.mockRejectedValue(new Error('Stub failed'));

            const recommendedType = await factory.getRecommendedAdapterType();
            expect(recommendedType).toBe('stub');
        });

        it('should prefer non-stub adapters when multiple are healthy', async () => {
            configService.get.mockReturnValue('stub');
            hikvisionAdapter.discoverDevices.mockResolvedValue([]);
            stubAdapter.discoverDevices.mockResolvedValue([]);

            const recommendedType = await factory.getRecommendedAdapterType();
            expect(recommendedType).toBe('hikvision'); // Should prefer non-stub
        });
    });

    describe('health check timeout', () => {
        it('should timeout health checks after 5 seconds', async () => {
            // Mock a slow response
            hikvisionAdapter.discoverDevices.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 6000))
            );

            const startTime = Date.now();
            await factory.createAdapterWithFailover(['hikvision']);
            const endTime = Date.now();

            // Should complete in less than 6 seconds due to timeout
            expect(endTime - startTime).toBeLessThan(6000);

            const healthStatus = factory.getAdapterHealthStatus('hikvision');
            expect(healthStatus?.healthy).toBe(false);
            expect(healthStatus?.error).toBe('Health check timeout');
        });
    });
});