import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';
import { sql } from 'drizzle-orm';

describe('HealthController', () => {
  let controller: HealthController;
  let dbService: { db: { execute: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    dbService = {
      db: {
        execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: dbService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return ok when database is healthy', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(dbService.db.execute).toHaveBeenCalledOnce();
  });

  it('should return degraded when database is down', async () => {
    dbService.db.execute.mockRejectedValueOnce(new Error('connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('error');
  });
});
