// Adapter Module
export { AdapterModule } from './adapter.module';

// Interfaces
export * from './interfaces';

// Factories
export * from './factories';

// Implementations
export {
    HikvisionAdapter,
    HikvisionHttpClient,
    HikvisionFaceManager,
    HikvisionCardManager,
    HikvisionUserManager,
    HikvisionNFCManager,
    HikvisionConfigurationManager,
    // New ISAPI Managers
    HikvisionPersonManager,
    HikvisionFaceLibraryManager,
    HikvisionFingerprintManager,
    HikvisionEventHostManager,
    HikvisionScheduleManager,
    HikvisionSystemManager,
    StubDeviceAdapter,
} from './implementations/device';

export { StubMatchingAdapter } from './implementations/biometric';

export { StubStorageAdapter } from './implementations/storage';

export { StubNotificationAdapter } from './implementations/notification';
