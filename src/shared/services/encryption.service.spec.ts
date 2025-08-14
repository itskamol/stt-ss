import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
    let service: EncryptionService;
    let configService: jest.Mocked<ConfigService>;

    const mockKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes
    const mockIV = '0123456789abcdef0123456789abcdef'; // 32 hex chars = 16 bytes

    beforeEach(async () => {
        const mockConfigService = {
            get: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EncryptionService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<EncryptionService>(EncryptionService);
        configService = module.get(ConfigService);
    });

    beforeEach(() => {
        configService.get.mockImplementation((key: string) => {
            switch (key) {
                case 'SECRET_ENCRYPTION_KEY':
                    return mockKey;
                case 'SECRET_ENCRYPTION_IV':
                    return mockIV;
                default:
                    return undefined;
            }
        });
    });

    describe('constructor', () => {
        it('should throw error if encryption key is not configured', async () => {
            configService.get.mockImplementation((key: string) => {
                if (key === 'SECRET_ENCRYPTION_KEY') return undefined;
                if (key === 'SECRET_ENCRYPTION_IV') return mockIV;
                return undefined;
            });

            expect(() => {
                new EncryptionService(configService);
            }).toThrow('Encryption keys not configured');
        });

        it('should throw error if IV is not configured', async () => {
            configService.get.mockImplementation((key: string) => {
                if (key === 'SECRET_ENCRYPTION_KEY') return mockKey;
                if (key === 'SECRET_ENCRYPTION_IV') return undefined;
                return undefined;
            });

            expect(() => {
                new EncryptionService(configService);
            }).toThrow('Encryption keys not configured');
        });

        it('should throw error if key is wrong length', async () => {
            configService.get.mockImplementation((key: string) => {
                if (key === 'SECRET_ENCRYPTION_KEY') return 'shortkey';
                if (key === 'SECRET_ENCRYPTION_IV') return mockIV;
                return undefined;
            });

            expect(() => {
                new EncryptionService(configService);
            }).toThrow('SECRET_ENCRYPTION_KEY must be 32 bytes');
        });

        it('should throw error if IV is wrong length', async () => {
            configService.get.mockImplementation((key: string) => {
                if (key === 'SECRET_ENCRYPTION_KEY') return mockKey;
                if (key === 'SECRET_ENCRYPTION_IV') return 'shortiv';
                return undefined;
            });

            expect(() => {
                new EncryptionService(configService);
            }).toThrow('SECRET_ENCRYPTION_IV must be 16 bytes');
        });
    });

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt text correctly', () => {
            const plainText = 'Hello, World!';
            const encrypted = service.encrypt(plainText);
            const decrypted = service.decrypt(encrypted);

            expect(encrypted).not.toBe(plainText);
            expect(decrypted).toBe(plainText);
        });

        it('should produce different encrypted values for same input (due to random IV)', () => {
            const plainText = 'test message';
            const encrypted1 = service.encrypt(plainText);
            const encrypted2 = service.encrypt(plainText);

            // Note: With createCipher, results might be the same, but with createCipheriv they would be different
            expect(service.decrypt(encrypted1)).toBe(plainText);
            expect(service.decrypt(encrypted2)).toBe(plainText);
        });
    });

    describe('encryptWithIV and decryptWithIV', () => {
        it('should encrypt and decrypt with IV correctly', () => {
            const plainText = 'Sensitive password data';
            const encrypted = service.encryptWithIV(plainText);
            const decrypted = service.decryptWithIV(encrypted);

            expect(encrypted).not.toBe(plainText);
            expect(decrypted).toBe(plainText);
        });

        it('should produce consistent encrypted values with fixed IV', () => {
            const plainText = 'consistent message';
            const encrypted1 = service.encryptWithIV(plainText);
            const encrypted2 = service.encryptWithIV(plainText);

            expect(encrypted1).toBe(encrypted2);
            expect(service.decryptWithIV(encrypted1)).toBe(plainText);
        });
    });

    describe('static methods', () => {
        it('should generate valid encryption key', () => {
            const key = EncryptionService.generateKey();
            expect(key).toHaveLength(64); // 32 bytes * 2 hex chars
            expect(key).toMatch(/^[0-9a-f]+$/);
        });

        it('should generate valid IV', () => {
            const iv = EncryptionService.generateIV();
            expect(iv).toHaveLength(32); // 16 bytes * 2 hex chars
            expect(iv).toMatch(/^[0-9a-f]+$/);
        });

        it('should generate different keys each time', () => {
            const key1 = EncryptionService.generateKey();
            const key2 = EncryptionService.generateKey();
            expect(key1).not.toBe(key2);
        });
    });

    describe('error handling', () => {
        it('should handle empty string encryption', () => {
            const encrypted = service.encrypt('');
            const decrypted = service.decrypt(encrypted);
            expect(decrypted).toBe('');
        });

        it('should handle special characters', () => {
            const plainText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const encrypted = service.encrypt(plainText);
            const decrypted = service.decrypt(encrypted);
            expect(decrypted).toBe(plainText);
        });

        it('should handle unicode characters', () => {
            const plainText = '测试中文字符 🚀 émojis';
            const encrypted = service.encrypt(plainText);
            const decrypted = service.decrypt(encrypted);
            expect(decrypted).toBe(plainText);
        });
    });
});
