import { PasswordUtil } from './password.util';

describe('PasswordUtil', () => {
    describe('hash', () => {
        it('should hash a password', async () => {
            const password = 'TestPassword123!';
            const hashedPassword = await PasswordUtil.hash(password);

            expect(hashedPassword).toBeDefined();
            expect(hashedPassword).not.toBe(password);
            expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 characters
        });

        it('should generate different hashes for the same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await PasswordUtil.hash(password);
            const hash2 = await PasswordUtil.hash(password);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('compare', () => {
        it('should return true for correct password', async () => {
            const password = 'TestPassword123!';
            const hashedPassword = await PasswordUtil.hash(password);

            const result = await PasswordUtil.compare(password, hashedPassword);

            expect(result).toBe(true);
        });

        it('should return false for incorrect password', async () => {
            const password = 'TestPassword123!';
            const wrongPassword = 'WrongPassword123!';
            const hashedPassword = await PasswordUtil.hash(password);

            const result = await PasswordUtil.compare(wrongPassword, hashedPassword);

            expect(result).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should validate a strong password', () => {
            const password = 'StrongPassword123!';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject password that is too short', () => {
            const password = 'Short1!';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must be at least 8 characters long');
        });

        it('should reject password without lowercase letter', () => {
            const password = 'PASSWORD123!';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        it('should reject password without uppercase letter', () => {
            const password = 'password123!';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        it('should reject password without number', () => {
            const password = 'Password!';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });

        it('should reject password without special character', () => {
            const password = 'Password123';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                'Password must contain at least one special character (@$!%*?&)'
            );
        });

        it('should return multiple errors for weak password', () => {
            const password = 'weak';
            const result = PasswordUtil.validatePassword(password);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });
});
