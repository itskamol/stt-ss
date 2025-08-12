import { EncryptionUtil } from './encryption.util';

// Mock environment variables for testing
beforeAll(() => {
    process.env.ENCRYPTION_SECRET_KEY = 'test-super-secret-encryption-key-32-chars-long-minimum-for-testing';
    process.env.ENCRYPTION_ALGORITHM = 'aes-256-gcm';
});

describe('EncryptionUtil', () => {
    const testPassword = 'MySecurePassword123!';
    const testData = 'sensitive-information';

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt text successfully', () => {
            const encrypted = EncryptionUtil.encrypt(testData);
            const decrypted = EncryptionUtil.decrypt(encrypted);

            expect(decrypted).toBe(testData);
            expect(encrypted).not.toBe(testData);
        });

        it('should produce different encrypted values for same input', () => {
            const encrypted1 = EncryptionUtil.encrypt(testData);
            const encrypted2 = EncryptionUtil.encrypt(testData);

            expect(encrypted1).not.toBe(encrypted2);
            
            // But both should decrypt to same value
            expect(EncryptionUtil.decrypt(encrypted1)).toBe(testData);
            expect(EncryptionUtil.decrypt(encrypted2)).toBe(testData);
        });

        it('should handle empty strings', () => {
            expect(() => EncryptionUtil.encrypt('')).not.toThrow();
            
            const encrypted = EncryptionUtil.encrypt('');
            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe('');
        });

        it('should handle special characters and unicode', () => {
            const specialText = 'Hello 世界! @#$%^&*()_+-=[]{}|;:,.<>?';
            const encrypted = EncryptionUtil.encrypt(specialText);
            const decrypted = EncryptionUtil.decrypt(encrypted);

            expect(decrypted).toBe(specialText);
        });
    });

    describe('encryptPassword and decryptPassword', () => {
        it('should encrypt and decrypt passwords', () => {
            const encrypted = EncryptionUtil.encryptPassword(testPassword);
            const decrypted = EncryptionUtil.decryptPassword(encrypted);

            expect(decrypted).toBe(testPassword);
            expect(encrypted).not.toBe(testPassword);
        });

        it('should trim whitespace from passwords', () => {
            const passwordWithSpaces = `  ${  testPassword  }  `;
            const encrypted = EncryptionUtil.encryptPassword(passwordWithSpaces);
            const decrypted = EncryptionUtil.decryptPassword(encrypted);

            expect(decrypted).toBe(testPassword);
        });

        it('should throw error for empty password', () => {
            expect(() => EncryptionUtil.encryptPassword('')).toThrow('Password cannot be empty');
            expect(() => EncryptionUtil.encryptPassword('   ')).toThrow('Password cannot be empty');
        });

        it('should throw error for empty encrypted password', () => {
            expect(() => EncryptionUtil.decryptPassword('')).toThrow('Encrypted password cannot be empty');
            expect(() => EncryptionUtil.decryptPassword('   ')).toThrow('Encrypted password cannot be empty');
        });
    });

    describe('generateSecurePassword', () => {
        it('should generate password with default length', () => {
            const password = EncryptionUtil.generateSecurePassword();
            expect(password).toHaveLength(16);
        });

        it('should generate password with custom length', () => {
            const password = EncryptionUtil.generateSecurePassword(24);
            expect(password).toHaveLength(24);
        });

        it('should generate password with required character types', () => {
            const password = EncryptionUtil.generateSecurePassword(20, true);
            
            expect(password).toMatch(/[a-z]/); // lowercase
            expect(password).toMatch(/[A-Z]/); // uppercase
            expect(password).toMatch(/\d/); // numbers
            expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // symbols
        });

        it('should generate password without symbols when requested', () => {
            const password = EncryptionUtil.generateSecurePassword(20, false);
            
            expect(password).toMatch(/[a-z]/); // lowercase
            expect(password).toMatch(/[A-Z]/); // uppercase
            expect(password).toMatch(/\d/); // numbers
            expect(password).not.toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // no symbols
        });

        it('should generate different passwords each time', () => {
            const password1 = EncryptionUtil.generateSecurePassword();
            const password2 = EncryptionUtil.generateSecurePassword();
            
            expect(password1).not.toBe(password2);
        });
    });

    describe('isValidEncryptedFormat', () => {
        it('should validate correct encrypted format', () => {
            const encrypted = EncryptionUtil.encrypt(testData);
            expect(EncryptionUtil.isValidEncryptedFormat(encrypted)).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(EncryptionUtil.isValidEncryptedFormat('invalid')).toBe(false);
            expect(EncryptionUtil.isValidEncryptedFormat('part1')).toBe(false);
            expect(EncryptionUtil.isValidEncryptedFormat('part1:part2:part3')).toBe(false);
            expect(EncryptionUtil.isValidEncryptedFormat('')).toBe(false);
        });

        it('should reject malformed hex strings', () => {
            expect(EncryptionUtil.isValidEncryptedFormat('invalid:hex:data')).toBe(false);
            expect(EncryptionUtil.isValidEncryptedFormat('zz:aa:bb')).toBe(false);
        });
    });

    describe('hash', () => {
        it('should generate consistent hash for same input', () => {
            const hash1 = EncryptionUtil.hash(testData);
            const hash2 = EncryptionUtil.hash(testData);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 produces 64 char hex string
        });

        it('should generate different hashes for different inputs', () => {
            const hash1 = EncryptionUtil.hash('data1');
            const hash2 = EncryptionUtil.hash('data2');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('generateToken', () => {
        it('should generate token with default length', () => {
            const token = EncryptionUtil.generateToken();
            expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
        });

        it('should generate token with custom length', () => {
            const token = EncryptionUtil.generateToken(16);
            expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
        });

        it('should generate different tokens each time', () => {
            const token1 = EncryptionUtil.generateToken();
            const token2 = EncryptionUtil.generateToken();

            expect(token1).not.toBe(token2);
        });

        it('should generate valid hex strings', () => {
            const token = EncryptionUtil.generateToken();
            expect(token).toMatch(/^[0-9a-f]+$/);
        });
    });

    describe('error handling', () => {
        it('should throw error when secret key is not set', () => {
            const originalKey = process.env.ENCRYPTION_SECRET_KEY;
            delete process.env.ENCRYPTION_SECRET_KEY;

            expect(() => EncryptionUtil.encrypt(testData)).toThrow('ENCRYPTION_SECRET_KEY environment variable is not set');

            process.env.ENCRYPTION_SECRET_KEY = originalKey;
        });

        it('should throw error when secret key is too short', () => {
            const originalKey = process.env.ENCRYPTION_SECRET_KEY;
            process.env.ENCRYPTION_SECRET_KEY = 'short';

            expect(() => EncryptionUtil.encrypt(testData)).toThrow('ENCRYPTION_SECRET_KEY must be at least 32 characters long');

            process.env.ENCRYPTION_SECRET_KEY = originalKey;
        });

        it('should throw error for invalid encrypted text format', () => {
            expect(() => EncryptionUtil.decrypt('invalid-format')).toThrow('Invalid encrypted text format');
            expect(() => EncryptionUtil.decrypt('part1:part2:part3')).toThrow('Invalid encrypted text format');
        });

        it('should throw error for corrupted encrypted data', () => {
            const validEncrypted = EncryptionUtil.encrypt(testData);
            const corruptedEncrypted = validEncrypted.replace(/.$/, 'x'); // Change last character

            expect(() => EncryptionUtil.decrypt(corruptedEncrypted)).toThrow('Decryption failed');
        });
    });

    describe('real-world scenarios', () => {
        it('should handle database password encryption workflow', () => {
            // Simulate storing password in database
            const userPassword = 'UserPassword123!';
            const encryptedForDb = EncryptionUtil.encryptPassword(userPassword);
            
            // Simulate retrieving and decrypting from database
            const decryptedFromDb = EncryptionUtil.decryptPassword(encryptedForDb);
            
            expect(decryptedFromDb).toBe(userPassword);
        });

        it('should handle API key encryption', () => {
            const apiKey = 'sk-1234567890abcdef';
            const encrypted = EncryptionUtil.encrypt(apiKey);
            const decrypted = EncryptionUtil.decrypt(encrypted);

            expect(decrypted).toBe(apiKey);
            expect(EncryptionUtil.isValidEncryptedFormat(encrypted)).toBe(true);
        });

        it('should handle configuration data encryption', () => {
            const configData = JSON.stringify({
                dbPassword: 'secret123',
                apiKey: 'key-456',
                webhookSecret: 'webhook-789'
            });

            const encrypted = EncryptionUtil.encrypt(configData);
            const decrypted = EncryptionUtil.decrypt(encrypted);
            const parsedConfig = JSON.parse(decrypted);

            expect(parsedConfig.dbPassword).toBe('secret123');
            expect(parsedConfig.apiKey).toBe('key-456');
            expect(parsedConfig.webhookSecret).toBe('webhook-789');
        });
    });
});