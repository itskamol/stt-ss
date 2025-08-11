import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

/**
 * Get environment file path based on NODE_ENV
 */
function getEnvFilePath(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Environment file mapping
    const envFileMap: Record<string, string> = {
        development: 'config/environments/local.env',
        production: 'config/environments/prod.env',
        staging: 'config/environments/staging.env',
        test: 'config/environments/local.env',
        docker: 'config/environments/dev.env', // Docker development
    };

    const envFile = envFileMap[nodeEnv] || 'config/environments/local.env';

    console.log(`🌍 Loading environment from: ${envFile} (NODE_ENV: ${nodeEnv})`);

    return envFile;
}

@Module({
    imports: [
        NestConfigModule.forRoot({
            isGlobal: true,
            envFilePath: getEnvFilePath(),
            expandVariables: true,
        }),
    ],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
