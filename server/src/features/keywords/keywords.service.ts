import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { keywordProjects, keywords } from '../../db/schema';
import { CreateKeywordProjectDto } from './dto/create-keyword-project.dto';

@Injectable()
export class KeywordsService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('keyword-queue') private readonly keywordQueue: Queue,
  ) {}

  async createProject(userId: string, dto: CreateKeywordProjectDto) {
    const [project] = await this.database.db
      .insert(keywordProjects)
      .values({
        userId,
        name: dto.name,
        websiteUrl: dto.websiteUrl,
        seedKeywords: dto.seedKeywords,
      })
      .returning();
    return project;
  }

  async findAllProjects(userId: string) {
    return this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.userId, userId))
      .orderBy(desc(keywordProjects.createdAt));
  }

  async getProject(id: string) {
    const [project] = await this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, id));
    if (!project) throw new NotFoundException('Keyword project not found');

    const kws = await this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.projectId, id))
      .orderBy(desc(keywords.searchVolume));

    return { ...project, keywords: kws };
  }

  async getKeywords(projectId: string) {
    return this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(keywords.searchVolume));
  }

  async triggerDiscovery(projectId: string) {
    await this.keywordQueue.add('keyword-discover', {
      projectId,
      action: 'discover',
    });
    return { message: 'Keyword discovery started' };
  }

  async triggerGapAnalysis(projectId: string) {
    await this.keywordQueue.add('keyword-gap', {
      projectId,
      action: 'gap-analysis',
    });
    return { message: 'Content gap analysis started' };
  }
}
