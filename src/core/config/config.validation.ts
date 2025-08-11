import { IsIn, IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
    @IsIn(['development', 'production', 'test'])
    NODE_ENV: string = 'development';

    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    @Max(65535)
    PORT: number = 3000;

    @IsString()
    DATABASE_URL: string;

    @IsString()
    REDIS_URL: string;

    @IsString()
    JWT_SECRET: string;

    @IsString()
    @IsOptional()
    JWT_EXPIRATION_TIME: string = '15m';

    @IsString()
    REFRESH_TOKEN_SECRET: string;

    @IsString()
    @IsOptional()
    REFRESH_TOKEN_EXPIRATION_TIME: string = '7d';

    @IsUrl({ require_tld: false })
    S3_ENDPOINT: string;

    @IsString()
    S3_ACCESS_KEY: string;

    @IsString()
    S3_SECRET_KEY: string;

    @IsString()
    S3_BUCKET_NAME: string;

    @IsIn(['error', 'warn', 'info', 'debug', 'verbose'])
    @IsOptional()
    LOG_LEVEL: string = 'info';
}

export function validateConfig(config: Record<string, unknown>) {
    // This function can be used with ConfigModule.forRoot({ validate: validateConfig })
    // For now, we'll keep it simple and just return the config
    // In a real implementation, you might want to use class-validator here
    return config;
}
