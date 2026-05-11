import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { leads, audits } from '../../db/schema';
import { CreateLeadDto } from './dto/create-lead.dto';

const LEAD_STATUS_VALUES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']);

@Injectable()
export class LeadsService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  async create(dto: CreateLeadDto) {
    const [audit] = await this.database.db
      .insert(audits)
      .values({ websiteUrl: dto.websiteUrl, status: 'PENDING', countries: dto.countries ?? [] })
      .returning();

    const [lead] = await this.database.db
      .insert(leads)
      .values({
        email: dto.email,
        name: dto.name,
        websiteUrl: dto.websiteUrl,
        businessDetails: { description: dto.businessDescription },
        auditId: audit.id,
        status: 'NEW',
      })
      .returning();

    await this.auditQueue.add('process-audit', {
      auditId: audit.id,
      leadId: lead.id,
      websiteUrl: dto.websiteUrl,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { auditId: audit.id, leadId: lead.id };
  }

  async findAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows = await this.database.db
      .select({
        id: leads.id,
        email: leads.email,
        name: leads.name,
        websiteUrl: leads.websiteUrl,
        businessDetails: leads.businessDetails,
        auditId: leads.auditId,
        score: leads.score,
        status: leads.status,
        createdAt: leads.createdAt,
        auditStatus: audits.status,
        seoScore: audits.seoScore,
      })
      .from(leads)
      .leftJoin(audits, eq(leads.auditId, audits.id))
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);
    return { leads: rows, page, limit };
  }

  async findOne(id: string) {
    const [lead] = await this.database.db
      .select()
      .from(leads)
      .where(eq(leads.id, id));
    return lead;
  }

  async update(id: string, body: { status?: string; notes?: string }) {
    const [existingLead] = await this.database.db
      .select()
      .from(leads)
      .where(eq(leads.id, id));

    if (!existingLead) {
      throw new NotFoundException('Lead not found');
    }

    const nextStatus = typeof body.status === 'string' ? body.status.trim().toUpperCase() : existingLead.status;
    if (!LEAD_STATUS_VALUES.has(nextStatus)) {
      throw new BadRequestException('Invalid lead status');
    }

    const existingBusinessDetails =
      existingLead.businessDetails && typeof existingLead.businessDetails === 'object'
        ? (existingLead.businessDetails as Record<string, unknown>)
        : {};
    const nextNotes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const [updatedLead] = await this.database.db
      .update(leads)
      .set({
        status: nextStatus as 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST',
        businessDetails: {
          ...existingBusinessDetails,
          internalNotes: nextNotes,
        },
      })
      .where(eq(leads.id, id))
      .returning();

    return updatedLead;
  }
}
