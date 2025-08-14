import { EncryptionUtil } from './encryption.util';

describe('EncryptionUtil', () => {
    const originalKey = 'a-super-secret-key-that-is-long-enough-for-testing';

    beforeAll(() => {
        process.env.ENCRYPTION_SECRET_KEY = originalKey;
    });

    afterEach(() => {
        // Restore the key after tests that modify it
        process.env.ENCRYPTION_SECRET_KEY = originalKey;
    });

    const testData = 'sensitive-information';

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt text successfully', () => {
            const encrypted = EncryptionUtil.encrypt(testData);
            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe(testData);
            expect(encrypted).not.toBe(testData);
        });

        it('should handle empty strings', () => {
            const encrypted = EncryptionUtil.encrypt('');
            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe('');
        });
    });

    describe('error handling', () => {
        it('should throw error when secret key is not set', () => {
            delete process.env.ENCRYPTION_SECRET_KEY;
            expect(() => EncryptionUtil.encrypt(testData)).toThrow(
                'ENCRYPTION_SECRET_KEY environment variable is not set'
            );
        });

        it('should throw error when secret key is too short', () => {
            process.env.ENCRYPTION_SECRET_KEY = 'short';
            expect(() => EncryptionUtil.encrypt(testData)).toThrow(
                'ENCRYPTION_SECRET_KEY must be at least 32 characters long'
            );
        });

        it('should throw error for invalid encrypted text format', () => {
            expect(() => EncryptionUtil.decrypt('invalid-format')).toThrow(
                'Invalid encrypted text format'
            );
        });
    });

    describe('static helper methods', () => {
        it('should generate a secure random password', () => {
            const password = EncryptionUtil.generateSecurePassword(12);
            expect(password).toHaveLength(12);
            expect(password).toMatch(/[a-z]/);
            expect(password).toMatch(/[A-Z]/);
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
        });

        it('should validate encrypted format correctly', () => {
            const valid = EncryptionUtil.encrypt('test');
            expect(EncryptionUtil.isValidEncryptedFormat(valid)).toBe(true);
            expect(EncryptionUtil.isValidEncryptedFormat('invalid')).toBe(false);
        });

        it('should hash data', () => {
            const hash = EncryptionUtil.hash('my-data');
            expect(hash).toBe('c0b8114a809d94b548e3f098b4b76b1589e8ea6297dc795b1377df2c99055385');
        });

        it('should generate a random token', () => {
            const token = EncryptionUtil.generateToken(16);
            expect(token).toHaveLength(32);
        });
    });
});