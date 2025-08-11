import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigService } from './core/config/config.service';
import { LoggerService } from './core/logger/logger.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // Get services
    const configService = app.get(ConfigService);
    const logger = app.get(LoggerService);

    // Use custom logger
    app.useLogger(logger);

    const port = configService.port;

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        })
    );

    // Global prefix for all routes
    app.setGlobalPrefix('api/v1');

    // Enable CORS
    app.enableCors();

    await app.listen(port);

    logger.log(`Application started successfully`, {
        port,
        environment: configService.nodeEnv,
        module: 'bootstrap',
    });

    console.log(`Application is running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
});
