import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from './core/config/config.service';
import { CustomValidationException } from './shared/exceptions/validation.exception';
import { LoggerService } from './core/logger';

async function bootstrap() {
    // Create app with our custom logger
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true, // Buffer logs until a logger is attached
    });

    const logger = app.get(LoggerService);
    app.useLogger(logger);

    // Get services
    const configService = app.get(ConfigService);
    const port = configService.port;

    // Global validation pipe with better error formatting
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: errors => new CustomValidationException(errors, logger),
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

    logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch(error => {
    // Use a basic console.error for bootstrap failures
    // as the full logger may not be initialized.
    console.error('Failed to start application:', error);
    process.exit(1);
});
