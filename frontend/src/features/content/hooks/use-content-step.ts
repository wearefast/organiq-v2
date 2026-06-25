'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import * as workflowApi from '@/features/workflow/services/workflow.service';
import { useWorkflowWs, type StepEvent } from '@/features/workflow/hooks/use-workflow-ws';
import type { StepStatus } from '@/features/workflow/types';

export interface ContentStepState {
  runId: string | null;
  stepStatus: StepStatus | null;
  artifactData: unknown;
  loading: boolean;
  approving: boolean;
  approve: () => Promise<void>;
}

export function useContentStep(projectId: string, stepKey: string): ContentStepState {
  const { getToken } = useAuth();
  const [runId, setRunId] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatus | null>(null);
  const [artifactData, setArtifactData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setToken).catch(() => {});
  }, [getToken]);

  const refresh = useCallback(async () => {
    try {
      const runs = await workflowApi.listRuns(projectId);
      if (!runs.length) return;
      const latest = runs[0];
      setRunId(latest.id);
      const detail = await workflowApi.getRun(latest.id);
      const step = detail.steps?.find((s) => s.stepKey === stepKey);
      if (step) {
        setStepStatus(step.status);
        setArtifactData(step.artifacts?.[0]?.data ?? null);
      }
    } catch (e) {
      console.error('[useContentStep]', e);
    } finally {
      setLoading(false);
    }
  }, [projectId, stepKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleWsEvent = useCallback(
    (event: StepEvent) => {
      if ('stepKey' in event && event.stepKey === stepKey) {
        refresh();
      }
    },
    [stepKey, refresh],
  );

  useWorkflowWs({ workflowRunId: runId, token, onEvent: handleWsEvent });

  const approve = useCallback(async () => {
    if (!runId) return;
    setApproving(true);
    try {
      await workflowApi.approveStep(runId, stepKey);
      await refresh();
    } finally {
      setApproving(false);
    }
  }, [runId, stepKey, refresh]);

  return { runId, stepStatus, artifactData, loading, approving, approve };
}
