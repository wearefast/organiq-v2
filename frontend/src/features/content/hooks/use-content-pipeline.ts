'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import * as workflowApi from '@/features/workflow/services/workflow.service';
import { useWorkflowWs, type StepEvent } from '@/features/workflow/hooks/use-workflow-ws';
import type { StepStatus } from '@/features/workflow/types';

export interface PipelineStep {
  key: string;
  label: string;
  tabPath: string;
  status: StepStatus | null;
  artifactData: unknown;
}

const CONTENT_STEP_DEFS: Array<{ key: string; label: string; tabPath: string }> = [
  { key: 'topical-map', label: 'Topical Map', tabPath: 'topical-map' },
  { key: 'content-brief', label: 'Brief', tabPath: 'brief' },
  { key: 'content-article', label: 'Article', tabPath: 'articles' },
  { key: 'content-images', label: 'Images', tabPath: 'assets' },
];

export function useContentPipeline(projectId: string) {
  const { getToken } = useAuth();
  const [runId, setRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(
    CONTENT_STEP_DEFS.map((s) => ({ ...s, status: null, artifactData: null })),
  );
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken()
      .then(setToken)
      .catch(() => {});
  }, [getToken]);

  const refresh = useCallback(async () => {
    try {
      const runs = await workflowApi.listRuns(projectId);
      if (!runs.length) {
        setLoading(false);
        return;
      }
      const latest = runs[0];
      setRunId(latest.id);
      const detail = await workflowApi.getRun(latest.id);
      setSteps(
        CONTENT_STEP_DEFS.map((stepDef) => {
          const step = detail.steps?.find((s) => s.stepKey === stepDef.key);
          return {
            ...stepDef,
            status: (step?.status as StepStatus) ?? null,
            artifactData: step?.artifacts?.[0]?.data ?? null,
          };
        }),
      );
    } catch (e) {
      console.error('[useContentPipeline]', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleWsEvent = useCallback(
    (event: StepEvent) => {
      const keys = CONTENT_STEP_DEFS.map((s) => s.key);
      if ('stepKey' in event && keys.includes((event as { stepKey: string }).stepKey)) {
        refresh();
      }
    },
    [refresh],
  );

  useWorkflowWs({ workflowRunId: runId, token, onEvent: handleWsEvent });

  return { steps, loading, runId };
}
