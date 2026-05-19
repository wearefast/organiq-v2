import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, gte, lte, desc, sql, sum, avg, count } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../../../shared/database/database.service';
import { gscConnections, gscKeywordData } from '../../../db/schema';

export interface GscTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GscPerformanceSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
}

@Injectable()
export class GscService {
  private readonly logger = new Logger(GscService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @InjectQueue('gsc-sync') private readonly syncQueue: Queue,
  ) {
    this.clientId = this.config.get<string>('GSC_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('GSC_CLIENT_SECRET', '');
    this.redirectUri = this.config.get<string>('GSC_REDIRECT_URI', '');
    // 32-byte key for AES-256-GCM — required if GSC is configured
    const keyHex = this.config.get<string>('GSC_ENCRYPTION_KEY', '');
    if (this.clientId && !keyHex) {
      throw new Error('GSC_ENCRYPTION_KEY is required when GSC_CLIENT_ID is configured. Must be 64 hex chars (32 bytes).');
    }
    this.encryptionKey = keyHex ? Buffer.from(keyHex, 'hex') : Buffer.alloc(32);
  }

  // ─── OAuth Flow ────────────────────────────────────────────

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GscTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token exchange failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(encryptedRefreshToken: string): Promise<GscTokens> {
    const refreshToken = this.decrypt(encryptedRefreshToken);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─── Connection Management ─────────────────────────────────

  async saveConnection(params: {
    projectId: string;
    organizationId: string;
    siteUrl: string;
    tokens: GscTokens;
  }): Promise<string> {
    const [conn] = await this.db.db
      .insert(gscConnections)
      .values({
        projectId: params.projectId,
        organizationId: params.organizationId,
        siteUrl: params.siteUrl,
        encryptedAccessToken: this.encrypt(params.tokens.accessToken),
        encryptedRefreshToken: this.encrypt(params.tokens.refreshToken),
        tokenExpiresAt: params.tokens.expiresAt,
        syncStatus: 'connected',
      })
      .onConflictDoUpdate({
        target: gscConnections.projectId,
        set: {
          siteUrl: params.siteUrl,
          encryptedAccessToken: this.encrypt(params.tokens.accessToken),
          encryptedRefreshToken: this.encrypt(params.tokens.refreshToken),
          tokenExpiresAt: params.tokens.expiresAt,
          syncStatus: 'connected',
          updatedAt: new Date(),
        },
      })
      .returning({ id: gscConnections.id });

    // Enqueue historical sync (last 90 days) on first connect
    const historicalStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    await this.syncQueue.add('historical', {
      projectId: params.projectId,
      connectionId: conn.id,
      startDate: historicalStart,
      endDate: today,
      type: 'historical',
    });

    // Add repeatable daily sync job (runs every day at 04:00 UTC)
    await this.syncQueue.upsertJobScheduler(
      `daily-${params.projectId}`,
      { pattern: '0 4 * * *' },
      {
        name: 'daily',
        data: {
          projectId: params.projectId,
          connectionId: conn.id,
          startDate: '', // Filled by processor: yesterday
          endDate: '',   // Filled by processor: yesterday
          type: 'daily',
        },
      },
    );

    return conn.id;
  }

  async getConnection(projectId: string) {
    return this.db.db.query.gscConnections.findFirst({
      where: eq(gscConnections.projectId, projectId),
    });
  }

  // ─── Search Analytics (Direct Google API) ──────────────────

  async pullSearchAnalytics(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    dimensions?: string[];
  }): Promise<unknown> {
    const conn = await this.getConnection(params.projectId);
    if (!conn) throw new Error('No GSC connection for this project');

    const accessToken = await this.getValidAccessToken(conn);

    const body = {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions ?? ['query', 'page', 'date'],
      rowLimit: 25000,
    };

    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(conn.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GSC API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  // ─── Data Storage ──────────────────────────────────────────

  async storeKeywordData(connectionId: string, projectId: string, rows: Array<Record<string, unknown>>): Promise<number> {
    if (rows.length === 0) return 0;

    const BATCH_SIZE = 500;
    let stored = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = batch.map((row) => ({
        connectionId,
        projectId,
        query: String(row.query ?? (row.keys as string[])?.[0] ?? ''),
        page: (row.page ?? (row.keys as string[])?.[1] ?? '') as string,
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        ctr: String(row.ctr ?? 0),
        position: String(row.position ?? 0),
        date: new Date(String(row.date ?? (row.keys as string[])?.[2] ?? new Date().toISOString())),
        country: (row.country ?? null) as string | null,
        device: (row.device ?? null) as string | null,
      }));

      await this.db.db.insert(gscKeywordData).values(values).onConflictDoNothing();
      stored += values.length;
    }

    // Update last sync timestamp
    await this.db.db
      .update(gscConnections)
      .set({ lastSyncAt: new Date(), syncStatus: 'synced', updatedAt: new Date() })
      .where(eq(gscConnections.id, connectionId));

    return stored;
  }

  // ─── Analysis (Ported from Sidecar) ────────────────────────

  async getPerformanceSummary(projectId: string, startDate: string, endDate: string): Promise<GscPerformanceSummary> {
    const dateFilter = and(
      eq(gscKeywordData.projectId, projectId),
      gte(gscKeywordData.date, new Date(startDate)),
      lte(gscKeywordData.date, new Date(endDate)),
    );

    // Totals — single row, pushed to Postgres
    const [totals] = await this.db.db
      .select({
        totalClicks: sum(gscKeywordData.clicks).mapWith(Number),
        totalImpressions: sum(gscKeywordData.impressions).mapWith(Number),
        avgPosition: avg(gscKeywordData.position).mapWith(Number),
        rowCount: count(),
      })
      .from(gscKeywordData)
      .where(dateFilter);

    const totalClicks = totals?.totalClicks ?? 0;
    const totalImpressions = totals?.totalImpressions ?? 0;
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = totals?.avgPosition ?? 0;

    // Top queries — grouped, sorted, limited in SQL
    const topQueries = await this.db.db
      .select({
        query: gscKeywordData.query,
        clicks: sum(gscKeywordData.clicks).mapWith(Number),
        impressions: sum(gscKeywordData.impressions).mapWith(Number),
        ctr: avg(gscKeywordData.ctr).mapWith(Number),
        position: avg(gscKeywordData.position).mapWith(Number),
      })
      .from(gscKeywordData)
      .where(dateFilter)
      .groupBy(gscKeywordData.query)
      .orderBy(desc(sum(gscKeywordData.clicks)))
      .limit(50);

    // Top pages — grouped, sorted, limited in SQL
    const topPages = await this.db.db
      .select({
        page: gscKeywordData.page,
        clicks: sum(gscKeywordData.clicks).mapWith(Number),
        impressions: sum(gscKeywordData.impressions).mapWith(Number),
        ctr: avg(gscKeywordData.ctr).mapWith(Number),
        position: avg(gscKeywordData.position).mapWith(Number),
      })
      .from(gscKeywordData)
      .where(and(dateFilter, sql`${gscKeywordData.page} IS NOT NULL`))
      .groupBy(gscKeywordData.page)
      .orderBy(desc(sum(gscKeywordData.clicks)))
      .limit(50);

    return {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
      topQueries: topQueries.map((q) => ({
        query: q.query,
        clicks: q.clicks ?? 0,
        impressions: q.impressions ?? 0,
        ctr: q.ctr ?? 0,
        position: q.position ?? 0,
      })),
      topPages: topPages.map((p) => ({
        page: p.page ?? '',
        clicks: p.clicks ?? 0,
        impressions: p.impressions ?? 0,
        ctr: p.ctr ?? 0,
        position: p.position ?? 0,
      })),
    };
  }

  async getKeywords(projectId: string, params: { startDate?: string; endDate?: string; limit?: number }) {
    const conditions = [eq(gscKeywordData.projectId, projectId)];
    if (params.startDate) conditions.push(gte(gscKeywordData.date, new Date(params.startDate)));
    if (params.endDate) conditions.push(lte(gscKeywordData.date, new Date(params.endDate)));

    return this.db.db.query.gscKeywordData.findMany({
      where: and(...conditions),
      orderBy: [desc(gscKeywordData.clicks)],
      limit: Math.min(params.limit ?? 100, 500),
    });
  }

  // ─── Encryption (AES-256-GCM) ─────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted token format');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ─── Helpers ───────────────────────────────────────────────

  /** Sign OAuth state payload with HMAC to prevent CSRF/forgery */
  signState(payload: Record<string, string>): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.encryptionKey).update(data).digest('hex');
    return `${data}.${sig}`;
  }

  /** Verify and decode a signed state. Returns null if signature is invalid. */
  verifyState(signedState: string): Record<string, string> | null {
    const dotIdx = signedState.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const data = signedState.slice(0, dotIdx);
    const sig = signedState.slice(dotIdx + 1);
    const expected = createHmac('sha256', this.encryptionKey).update(data).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    try {
      return JSON.parse(Buffer.from(data, 'base64url').toString());
    } catch {
      return null;
    }
  }

  private async getValidAccessToken(conn: typeof gscConnections.$inferSelect): Promise<string> {
    // If token is still valid (with 5-min buffer), decrypt and return
    if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return this.decrypt(conn.encryptedAccessToken);
    }

    // Token expired — refresh
    this.logger.debug(`Refreshing GSC token for project ${conn.projectId}`);
    const tokens = await this.refreshAccessToken(conn.encryptedRefreshToken);

    // Update stored tokens
    await this.db.db
      .update(gscConnections)
      .set({
        encryptedAccessToken: this.encrypt(tokens.accessToken),
        encryptedRefreshToken: this.encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(gscConnections.id, conn.id));

    return tokens.accessToken;
  }
}
