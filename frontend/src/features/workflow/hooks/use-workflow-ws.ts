'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export type StepEvent =
  | { type: 'step:started'; stepKey: string }
  | { type: 'step:tool-call'; stepKey: string; toolName: string }
  | { type: 'step:completed'; stepKey: string; status: string }
  | { type: 'step:approved'; stepKey: string }
  | { type: 'step:rejected'; stepKey: string }
  | { type: 'step:error'; stepKey: string; error: string }
  | { type: 'workflow:completed'; workflowRunId: string };

interface UseWorkflowWsOptions {
  workflowRunId: string | null;
  token: string | null;
  onEvent?: (event: StepEvent) => void;
}

export function useWorkflowWs({ workflowRunId, token, onEvent }: UseWorkflowWsOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [connected, setConnected] = useState(false);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!workflowRunId || !token) {
      disconnect();
      return;
    }

    const socket = io(`${WS_URL}/workflows`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', { workflowRunId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    const events = [
      'step:started',
      'step:tool-call',
      'step:completed',
      'step:approved',
      'step:rejected',
      'step:error',
      'workflow:completed',
    ] as const;

    for (const eventName of events) {
      socket.on(eventName, (payload: Record<string, string>) => {
        onEventRef.current?.({ type: eventName, ...payload } as StepEvent);
      });
    }

    return () => {
      socket.emit('unsubscribe', { workflowRunId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [workflowRunId, token, disconnect]);

  return { connected, disconnect };
}
