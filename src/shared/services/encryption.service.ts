import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-cbc';
    private readonly key: Buffer;

    constructor(private readonly configService: ConfigService) {
        const keyHex = this.configService.get<string>('SECRET_ENCRYPTION_KEY');

        if (!keyHex) {
            throw new Error(
                'Encryption key not configured. Please set SECRET_ENCRYPTION_KEY environment variable.'
            );
        }

        this.key = Buffer.from(keyHex, 'hex');

        if (this.key.length !== 32) {
            throw new Error('SECRET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
        }
    }

    /**
     * Encrypt a plain text string using a unique IV for each operation.
     * The IV is prepended to the encrypted text.
     */
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16); // Generate a new random IV
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Prepend the IV to the encrypted data, separated by a colon
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt an encrypted string that has the IV prepended.
     */
    decrypt(encryptedText: string): string {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted text format. Expected iv:encryptedText.');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encryptedData = parts[1];

            if (iv.length !== 16) {
                throw new Error('Invalid IV length.');
            }

            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            // It's better to throw a generic error than to expose details
            // about why the decryption failed (e.g., incorrect padding, bad key).
            throw new Error('Failed to decrypt data.');
        }
    }

    /**
     * Generate a random encryption key (for setup purposes)
     */
    static generateKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate a random IV (for setup purposes)
     */
    static generateIV(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
