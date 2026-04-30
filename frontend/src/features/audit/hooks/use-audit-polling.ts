'use client';

import { useState, useEffect, useRef } from 'react';
import { getAuditStatus } from '../services/audit.service';

interface AuditProgress {
  step: string;
  progress: number;
  message: string;
}

interface AuditScores {
  technicalSeo: number;
  contentCoverage: number;
  backlinkAuthority: number;
  aeoGeoReadiness: number;
}

export function useAuditPolling(auditId: string | null) {
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const [scores, setScores] = useState<AuditScores | null>(null);
  const [status, setStatus] = useState<'polling' | 'complete' | 'failed' | 'idle'>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!auditId) return;

    setStatus('polling');

    intervalRef.current = setInterval(async () => {
      try {
        const data = await getAuditStatus(auditId);

        setProgress({
          step: data.step || 'Processing',
          progress: data.progress || 0,
          message: data.message || 'Working on your audit...',
        });

        if (data.status === 'COMPLETE') {
          setScores(data.scores as unknown as AuditScores);
          setStatus('complete');
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (data.status === 'FAILED') {
          setStatus('failed');
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        setStatus('failed');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [auditId]);

  return { progress, scores, status };
}
