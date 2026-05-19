'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchGscStatus,
  fetchGscKeywords,
  fetchGscSummary,
  type GscStatus,
  type GscKeyword,
  type GscPerformanceSummary,
} from '../services/gsc.service';

export function useGscStatus(projectId: string) {
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGscStatus(projectId)
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, [projectId]);

  return { status, loading };
}

export function useGscKeywords(projectId: string, params?: { startDate?: string; endDate?: string; limit?: number }) {
  const [keywords, setKeywords] = useState<GscKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGscKeywords(projectId, params);
      setKeywords(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, params?.startDate, params?.endDate, params?.limit]);

  useEffect(() => { load(); }, [load]);

  return { keywords, loading, error, refresh: load };
}

export function useGscSummary(projectId: string, params?: { startDate?: string; endDate?: string }) {
  const [summary, setSummary] = useState<GscPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGscSummary(projectId, params);
      setSummary(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, params?.startDate, params?.endDate]);

  useEffect(() => { load(); }, [load]);

  return { summary, loading, error, refresh: load };
}
