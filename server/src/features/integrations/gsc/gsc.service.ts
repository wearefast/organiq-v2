import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GscService {
  private readonly logger = new Logger(GscService.name);
  private readonly sidecarUrl: string;

  constructor(private readonly config: ConfigService) {
    this.sidecarUrl = this.config.get<string>('PYTHON_SIDECAR_URL', 'http://localhost:8000');
  }

  async getPerformance(domain: string, startDate: string, endDate: string): Promise<unknown> {
    return this.post('/analyze/gsc-performance', { domain, start_date: startDate, end_date: endDate });
  }

  async getTopQueries(domain: string, limit: number = 100): Promise<unknown> {
    return this.post('/analyze/gsc-top-queries', { domain, limit });
  }

  async getTopPages(domain: string, limit: number = 100): Promise<unknown> {
    return this.post('/analyze/gsc-top-pages', { domain, limit });
  }

  private async post(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    this.logger.debug(`GSC Sidecar: POST ${endpoint}`);

    const response = await fetch(`${this.sidecarUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`GSC Sidecar error: ${response.status}`);
      throw new Error(`GSC Sidecar error: ${response.status}`);
    }

    return response.json();
  }
}
