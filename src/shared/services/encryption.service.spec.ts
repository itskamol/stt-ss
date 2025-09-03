import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@/core/config/config.service';

describe('EncryptionService', () => {
    let service: EncryptionService;
    let configService: jest.Mocked<ConfigService>;

    const mockKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

    beforeEach(async () => {
        const mockConfigService = {
            get: jest.fn((key: string) => {
                if (key === 'SECRET_ENCRYPTION_KEY') {
                    return mockKey;
                }
                return undefined;
            }),
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

    describe('encrypt and decrypt', () => {
        it('should correctly encrypt and decrypt a string', () => {
            const plainText = 'This is a secret message!';
            const encrypted = service.encrypt(plainText);
            const decrypted = service.decrypt(encrypted);

            expect(encrypted).not.toBe(plainText);
            expect(decrypted).toBe(plainText);
        });

        it('should produce different ciphertexts for the same input due to random IVs', () => {
            const plainText = 'This message should encrypt differently each time.';
            const encrypted1 = service.encrypt(plainText);
            const encrypted2 = service.encrypt(plainText);

            expect(encrypted1).not.toBe(encrypted2);
            expect(service.decrypt(encrypted1)).toBe(plainText);
            expect(service.decrypt(encrypted2)).toBe(plainText);
        });

        it('should handle encrypting and decrypting an empty string', () => {
            const encrypted = service.encrypt('');
            const decrypted = service.decrypt(encrypted);
            expect(decrypted).toBe('');
        });

        it('should throw a generic error for malformed encrypted text', () => {
            const malformedText = 'this:is:not:valid';
            expect(() => service.decrypt(malformedText)).toThrow('Failed to decrypt data.');
        });

        it('should throw a generic error for encrypted text with invalid IV length', () => {
            const malformedText = 'shortiv:someencrypteddata';
            expect(() => service.decrypt(malformedText)).toThrow('Failed to decrypt data.');
        });

        it('should throw a generic error for text that is not hex', () => {
            const malformedText = 'not-hex:not-hex-either';
            expect(() => service.decrypt(malformedText)).toThrow('Failed to decrypt data.');
        });
    });

    describe('static methods', () => {
        it('should generate a valid 32-byte (64 hex chars) encryption key', () => {
            const key = EncryptionService.generateKey();
            expect(key).toHaveLength(64);
            expect(Buffer.from(key, 'hex').length).toBe(32);
        });

        it('should generate a valid 16-byte (32 hex chars) IV', () => {
            const iv = EncryptionService.generateIV();
            expect(iv).toHaveLength(32);
            expect(Buffer.from(iv, 'hex').length).toBe(16);
        });
    });
});
