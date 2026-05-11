import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3001',
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Pulse OS API')
      .setDescription('Agent-led SEO/GEO/AEO Strategy OS')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`🚀 Pulse OS API running on http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📖 Swagger docs at http://localhost:${port}/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap app:', err);
  process.exit(1);
});
