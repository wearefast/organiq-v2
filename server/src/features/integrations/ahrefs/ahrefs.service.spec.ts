import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AhrefsService } from './ahrefs.service';
import { ApiUsageContextService } from '../../api-usage/api-usage-context.service';
import { ApiUsageService } from '../../api-usage/api-usage.service';

describe('AhrefsService', () => {
  const config = {
    get: (key: string, defaultValue?: string) =>
      key === 'AHREFS_API_KEY' ? 'test-ahrefs-key' : (defaultValue ?? ''),
  } as ConfigService;

  const apiUsageContext = { getContext: () => undefined } as unknown as ApiUsageContextService;
  const apiUsageService = { record: () => undefined } as unknown as ApiUsageService;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the documented SERP overview endpoint and query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ positions: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new AhrefsService(config, apiUsageContext, apiUsageService);
    await service.getSerpOverview('mashreq bank global hq', 'AE');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(requestUrl);

    expect(url.pathname).toBe('/v3/serp-overview/serp-overview');
    expect(url.searchParams.get('keyword')).toBe('mashreq bank global hq');
    expect(url.searchParams.get('country')).toBe('ae');
    expect(url.searchParams.get('top_positions')).toBe('10');
    expect(url.searchParams.get('output')).toBe('json');
    expect(url.searchParams.get('select')).toBe(
      'position,url,title,type,domain_rating,url_rating,traffic,keywords,backlinks,refdomains,page_type,top_keyword,top_keyword_volume,value,update_date',
    );
    expect(options.headers).toEqual({
      Authorization: 'Bearer test-ahrefs-key',
      Accept: 'application/json',
    });
  });
});