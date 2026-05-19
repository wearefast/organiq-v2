import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DlqService } from './dlq.service';

@ApiTags('admin')
@Controller('admin/dlq')
export class DlqController {
  constructor(
    private readonly dlqService: DlqService,
    @InjectQueue('workflow-steps') private readonly queue: Queue,
  ) {}

  @Get()
  async listUnresolved() {
    return this.dlqService.listUnresolved();
  }

  @Post(':id/replay')
  async replay(@Param('id') id: string) {
    const entry = await this.dlqService.getById(id);
    if (!entry) throw new NotFoundException('DLQ entry not found');

    // Re-enqueue the job with the original data
    const jobData = entry.jobData as Record<string, unknown>;
    await this.queue.add(entry.stepKey, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    // Mark as resolved
    await this.dlqService.resolve(id);

    return { status: 'replayed', id };
  }

  @Post(':id/dismiss')
  async dismiss(@Param('id') id: string) {
    const entry = await this.dlqService.getById(id);
    if (!entry) throw new NotFoundException('DLQ entry not found');

    await this.dlqService.resolve(id);

    return { status: 'dismissed', id };
  }
}
