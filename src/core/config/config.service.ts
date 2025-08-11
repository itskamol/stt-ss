import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
    constructor(private readonly configService: NestConfigService) {}

    get nodeEnv(): string {
        return this.configService.get<string>('NODE_ENV', 'development');
    }

    get port(): number {
        return this.configService.get<number>('PORT', 3000);
    }

    get databaseUrl(): string {
        const url = this.configService.get<string>('DATABASE_URL');
        if (!url) {
            throw new Error('DATABASE_URL is required but not provided in environment variables');
        }
        return url;
    }

    get redisUrl(): string {
        const url = this.configService.get<string>('REDIS_URL');
        if (!url) {
            throw new Error('REDIS_URL is required but not provided in environment variables');
        }
        return url;
    }

    get jwtSecret(): string {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is required but not provided in environment variables');
        }
        if (secret.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long for security');
        }
        return secret;
    }

    get jwtExpirationTime(): string {
        return this.configService.get<string>('JWT_EXPIRATION_TIME', '15m');
    }

    get refreshTokenSecret(): string {
        const secret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
        if (!secret) {
            throw new Error(
                'REFRESH_TOKEN_SECRET is required but not provided in environment variables'
            );
        }
        if (secret.length < 32) {
            throw new Error(
                'REFRESH_TOKEN_SECRET must be at least 32 characters long for security'
            );
        }
        return secret;
    }

    get refreshTokenExpirationTime(): string {
        return this.configService.get<string>('REFRESH_TOKEN_EXPIRATION_TIME', '7d');
    }

    get s3Endpoint(): string {
        return this.configService.get<string>('S3_ENDPOINT');
    }

    get s3AccessKey(): string {
        return this.configService.get<string>('S3_ACCESS_KEY');
    }

    get s3SecretKey(): string {
        return this.configService.get<string>('S3_SECRET_KEY');
    }

    get s3BucketName(): string {
        return this.configService.get<string>('S3_BUCKET_NAME');
    }

    get logLevel(): string {
        return this.configService.get<string>('LOG_LEVEL', 'info');
    }

    get isDevelopment(): boolean {
        return this.nodeEnv === 'development';
    }

    get isProduction(): boolean {
        return this.nodeEnv === 'production';
    }

    get isTest(): boolean {
        return this.nodeEnv === 'test';
    }

    get isDocker(): boolean {
        return this.nodeEnv === 'docker';
    }

    /**
     * Validate required environment variables are set
     * Call this method in app bootstrap to ensure all required vars are present
     */
    validateConfig(): void {
        const requiredVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

        const missing = requiredVars.filter(varName => {
            const value = this.configService.get<string>(varName);
            return !value || value.trim() === '';
        });

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missing.join(', ')}\n` +
                    `Please check your environment configuration files in config/environments/`
            );
        }

        // Validate JWT secrets length
        try {
            this.jwtSecret; // This will throw if too short
            this.refreshTokenSecret; // This will throw if too short
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
    }
}
