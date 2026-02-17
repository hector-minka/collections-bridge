import { ValidationPipe, VersioningType, HttpException, HttpStatus, Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: true,
  });

  // Configure body parser limits
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for Swagger UI
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Logger
  app.useLogger(app.get(Logger));

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Changed to false to see what extra fields are being sent
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Log validation errors in detail
        const logger = new NestLogger('ValidationPipe');
        logger.error('=== VALIDATION ERRORS ===');
        logger.error(`Errors: ${JSON.stringify(errors, null, 2)}`);
        logger.error('=== END VALIDATION ERRORS ===');
        return new HttpException(
          {
            reason: 'ApiBodyMalformed',
            detail: errors
              .map((error) => {
                const constraints = error.constraints
                  ? Object.values(error.constraints).join(', ')
                  : 'Validation failed';
                return `${error.property}: ${constraints}`;
              })
              .join('; '),
            custom: {
              validationErrors: errors,
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Minka Collections Bridge API')
    .setDescription(
      `## Overview

This service provides a bridge for collections operations in the Minka Ledger. It handles anchor creation, signing, and forwarding to the ledger.

## Features

- ✅ Anchor creation and management
- ✅ Cryptographic signing with Ed25519
- ✅ JWT authentication for ledger requests
- ✅ TypeScript with NestJS framework
- ✅ Comprehensive security features (Helmet, CORS, Rate Limiting)
- ✅ Input validation and error handling
- ✅ Structured logging with Pino
- ✅ Health checks and monitoring
- ✅ Swagger/OpenAPI documentation

## Crypto Utilities

This bridge includes a complete set of cryptographic utilities:

- **Hash Generation**: SHA-256 hashes with RFC 8785 compatible JSON serialization
- **Signature Digests**: Double-hashed signature digests with custom metadata
- **Signature Results**: Ed25519 signatures for ledger requests
- **JWT Signing**: JWT tokens for ledger authentication
- **Key Management**: Import Ed25519 keys from raw base64 format

See the \`crypto-utils\` directory for detailed documentation.
`,
    )
    .setVersion('1.0.0')
    .setContact('Minka Support', 'https://minka.io', 'support@minka.io')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth()
    .addTag('collections', 'Collections - Manage collection operations')
    .addServer('http://localhost:3000', 'Local development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 3,
    },
    customSiteTitle: 'Minka Collections Bridge API',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api/docs`);
}

bootstrap();
