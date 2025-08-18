import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-cbc';
    private readonly key: Buffer;
    private readonly iv: Buffer;

    constructor(private readonly configService: ConfigService) {
        const keyHex = this.configService.get<string>('SECRET_ENCRYPTION_KEY');
        const ivHex = this.configService.get<string>('SECRET_ENCRYPTION_IV');

        if (!keyHex || !ivHex) {
            throw new Error(
                'Encryption keys not configured. Please set SECRET_ENCRYPTION_KEY and SECRET_ENCRYPTION_IV environment variables.'
            );
        }

        this.key = Buffer.from(keyHex, 'hex');
        this.iv = Buffer.from(ivHex, 'hex');

        if (this.key.length !== 32) {
            throw new Error('SECRET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
        }

        if (this.iv.length !== 16) {
            throw new Error('SECRET_ENCRYPTION_IV must be 16 bytes (32 hex characters)');
        }
    }

    /**
     * Encrypt a plain text string
     */
    encrypt(text: string): string {
        const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
        cipher.setAutoPadding(true);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return encrypted;
    }

    /**
     * Decrypt an encrypted string
     */
    decrypt(encryptedText: string): string {
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
        decipher.setAutoPadding(true);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Encrypt with IV (more secure)
     */
    encryptWithIV(text: string): string {
        const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return encrypted;
    }

    /**
     * Decrypt with IV (more secure)
     */
    decryptWithIV(encryptedText: string): string {
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
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
