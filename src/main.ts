import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from './core/config/config.service';
import { LoggerService } from './core/logger/logger.service';
import { MinimalLoggerService } from './core/logger/minimal-logger.service';
import { CustomValidationException } from './shared/exceptions/validation.exception';

async function bootstrap() {
    // Create app with minimal logging during startup
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
        logger: false, // Disable default logger during creation
    });

    // Get services
    const configService = app.get(ConfigService);
    const logger = app.get(LoggerService);
    
    // Create minimal logger for NestJS internal use
    const minimalLogger = new MinimalLoggerService(configService);
    app.useLogger(minimalLogger);

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

    const port = configService.port;

    // Global validation pipe with better error formatting
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => new CustomValidationException(errors)
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
