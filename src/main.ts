import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigService } from './core/config/config.service';
import { LoggerService } from './core/logger/logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // Get services
    const configService = app.get(ConfigService);
    const logger = app.get(LoggerService);

    // Validate environment configuration
    try {
        configService.validateConfig();
        logger.log('Environment configuration validated successfully', {
            environment: configService.nodeEnv,
            module: 'bootstrap',
        });
    } catch (error) {
        logger.error('Environment configuration validation failed', {
            error: error.message,
            module: 'bootstrap',
        });
        process.exit(1);
    }

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

    const config = new DocumentBuilder()
        .setTitle('Sector Staff API')
        .setDescription('API documentation for the Sector Staff application')
        .setVersion('2.1.0')
        .addTag('API')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

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
