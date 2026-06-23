import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'path';
import { AppModule } from './app.module';

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5433/pulse_v2';
  const isRds = connectionString.includes('rds.amazonaws.com');
  const ssl = isRds ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString, ssl });
  const db = drizzle(pool);
  const migrationsFolder = path.join(__dirname, '..', 'drizzle');
  console.log(`Running migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log('Migrations complete.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  // HTTP security headers — applied before all other middleware
  app.use(helmet({
    // Allow same-origin iframes for internal tooling if needed; deny others
    frameguard: { action: 'deny' },
    // contentSecurityPolicy is disabled here since this is an API server,
    // not a web app serving HTML. The frontend (Vercel/Next.js) has its own CSP.
    contentSecurityPolicy: false,
  }));

  app.enableShutdownHooks();

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3001',
  ].filter((origin): origin is string => Boolean(origin));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, same-origin)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allow known frontend origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: false,
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

runMigrations()
  .catch((err) => {
    console.error('Migrations failed (non-fatal, continuing startup):', err);
  })
  .then(() => bootstrap())
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

