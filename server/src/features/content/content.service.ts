import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { contentPieces } from '../../db/schema';

@Injectable()
export class ContentService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('content-queue') private readonly contentQueue: Queue,
  ) {}

  async findAll(status?: string) {
    const query = this.database.db
      .select()
      .from(contentPieces)
      .orderBy(desc(contentPieces.createdAt));
    return query;
  }

  async findOne(id: string) {
    const [piece] = await this.database.db
      .select()
      .from(contentPieces)
      .where(eq(contentPieces.id, id));
    if (!piece) throw new NotFoundException('Content piece not found');
    return piece;
  }

  async generateBrief(keywordId: string) {
    await this.contentQueue.add('generate-brief', {
      keywordId,
      action: 'generate-brief',
    });
    return { message: 'Brief generation started' };
  }

  async generateArticle(keywordId: string) {
    await this.contentQueue.add('generate-article', {
      keywordId,
      action: 'generate-article',
    });
    return { message: 'Article generation started' };
  }

  async updateStatus(id: string, status: string) {
    const [updated] = await this.database.db
      .update(contentPieces)
      .set({ status: status as any })
      .where(eq(contentPieces.id, id))
      .returning();
    return updated;
  }
}
