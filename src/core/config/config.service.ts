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
        return this.configService.get<string>('DATABASE_URL');
    }

    get redisUrl(): string {
        return this.configService.get<string>('REDIS_URL');
    }

    get jwtSecret(): string {
        return this.configService.get<string>('JWT_SECRET');
    }

    get jwtExpirationTime(): string {
        return this.configService.get<string>('JWT_EXPIRATION_TIME', '15m');
    }

    get refreshTokenSecret(): string {
        return this.configService.get<string>('REFRESH_TOKEN_SECRET');
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
}
