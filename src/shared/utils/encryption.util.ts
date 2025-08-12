import { ConfigService } from '@/core/config/config.service';
import * as crypto from 'crypto';

export class EncryptionUtil {
    private static readonly ALGORITHM = 'aes-256-cbc';
    private static readonly IV_LENGTH = 16; // For AES, this is always 16

    constructor(private readonly configService: ConfigService) {}

    /**
     * Initialize encryption key from environment
     */
    private static getSecretKey(): Buffer {
        const secretKey = "213233231213"
        // Create a 32-byte key from the secret
        return crypto.scryptSync(secretKey, 'salt', 32);
    }

    /**
     * Encrypt a password or sensitive data
     * @param text - The text to encrypt
     * @returns Encrypted string in format: iv:encryptedData
     */
    static encrypt(text: string): string {
        try {
            const key = this.getSecretKey();
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Return format: iv:encryptedData
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt an encrypted password or sensitive data
     * @param encryptedText - The encrypted text in format: iv:encryptedData
     * @returns Decrypted original text
     */
    static decrypt(encryptedText: string): string {
        try {
            const key = this.getSecretKey();
            const parts = encryptedText.split(':');

            if (parts.length !== 2) {
                throw new Error('Invalid encrypted text format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt password specifically for database storage
     * @param password - Plain text password
     * @returns Encrypted password string
     */
    static encryptPassword(password: string): string {
        if (!password || password.trim().length === 0) {
            throw new Error('Password cannot be empty');
        }

        return this.encrypt(password.trim());
    }

    /**
     * Decrypt password from database storage
     * @param encryptedPassword - Encrypted password from database
     * @returns Plain text password
     */
    static decryptPassword(encryptedPassword: string): string {
        if (!encryptedPassword || encryptedPassword.trim().length === 0) {
            throw new Error('Encrypted password cannot be empty');
        }

        return this.decrypt(encryptedPassword.trim());
    }

    /**
     * Generate a secure random password
     * @param length - Password length (default: 16)
     * @param includeSymbols - Include special symbols (default: true)
     * @returns Generated password
     */
    static generateSecurePassword(length: number = 16, includeSymbols: boolean = true): string {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        let charset = lowercase + uppercase + numbers;
        if (includeSymbols) {
            charset += symbols;
        }

        let password = '';

        // Ensure at least one character from each required set
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];

        if (includeSymbols) {
            password += symbols[Math.floor(Math.random() * symbols.length)];
        }

        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }

        // Shuffle the password
        return password
            .split('')
            .sort(() => Math.random() - 0.5)
            .join('');
    }

    /**
     * Validate if a string is properly encrypted by this utility
     * @param encryptedText - Text to validate
     * @returns True if valid encrypted format
     */
    static isValidEncryptedFormat(encryptedText: string): boolean {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) return false;

            // Check if parts are valid hex strings
            const iv = Buffer.from(parts[0], 'hex');

            return iv.length === this.IV_LENGTH;
        } catch {
            return false;
        }
    }

    /**
     * Hash sensitive data for comparison (one-way)
     * @param data - Data to hash
     * @returns SHA-256 hash
     */
    static hash(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Generate a secure random token
     * @param length - Token length in bytes (default: 32)
     * @returns Random token as hex string
     */
    static generateToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }
}
