import { useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { OrchestratorEvent } from '../types';

const API = 'http://localhost:8000';

export function useOrchestrator() {
  const {
    projectId,
    setOrchestratorRunning,
    addOrchestratorEvent,
    clearOrchestratorEvents,
    setOrchestratorCheckpoint,
    addAnalysisLog,
    clearAnalysisLogs,
    setShowLogViewer,
  } = useStore();

  const abortRef = useRef<AbortController | null>(null);
  const streamAliveRef = useRef(false);

  const start = useCallback(
    async (goal?: string) => {
      if (!projectId) return;

      clearOrchestratorEvents();
      setOrchestratorRunning(true);
      clearAnalysisLogs();
      setShowLogViewer(true);

      const controller = new AbortController();
      abortRef.current = controller;
      streamAliveRef.current = true;

      try {
        const res = await fetch(`${API}/api/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, goal: goal || null }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Failed to start orchestration');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            try {
              const event: OrchestratorEvent = JSON.parse(json);
              addOrchestratorEvent(event);

              // Forward to LiveLogViewer
              const logLevel = event.type === 'error' ? 'ERROR'
                : event.type === 'checkpoint' ? 'WARNING'
                : 'INFO';
              const logMsg = event.type === 'thinking' ? `Thinking: ${(event.thinking as string || '').slice(0, 200)}`
                : event.type === 'tool_start' ? `Running tool: ${event.tool}`
                : event.type === 'tool_result' ? `${event.tool} ${event.error ? 'FAILED' : 'completed'}${event.duration ? ` (${(event.duration as number).toFixed(1)}s)` : ''}${event.result ? ' — ' + (event.result as string).slice(0, 150) : ''}`
                : event.type === 'checkpoint' ? `⏸ Checkpoint: ${event.phase} — ${event.message || 'Waiting for input'}`
                : event.type === 'complete' ? `✓ Pipeline complete${event.message ? ': ' + (event.message as string).slice(0, 200) : ''}`
                : event.type === 'error' ? `✗ Error: ${event.message}`
                : event.type === 'cancelled' ? 'Pipeline cancelled'
                : event.type;
              addAnalysisLog({ ts: Date.now() / 1000, level: logLevel, msg: logMsg });

              if (event.type === 'checkpoint') {
                setOrchestratorCheckpoint({
                  phase: event.phase as 'analysis_review' | 'clarify_human' | 'plan_review' | 'quality_gate',
                  summary: event.message as string | undefined,
                  data: event as Record<string, unknown>,
                });
              }

              if (event.type === 'complete' || event.type === 'error' || event.type === 'cancelled') {
                setOrchestratorRunning(false);
                setOrchestratorCheckpoint(null);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        addOrchestratorEvent({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        streamAliveRef.current = false;
        abortRef.current = null;
        // Only mark as not running if there's no active checkpoint
        // (SSE may have dropped during checkpoint wait — backend is still alive)
        const currentCheckpoint = useStore.getState().orchestratorCheckpoint;
        if (!currentCheckpoint) {
          setOrchestratorRunning(false);
        }
      }
    },
    [projectId, clearOrchestratorEvents, setOrchestratorRunning, addOrchestratorEvent, setOrchestratorCheckpoint, addAnalysisLog, clearAnalysisLogs, setShowLogViewer],
  );

  const resume = useCallback(
    async (action: string, data?: Record<string, unknown>) => {
      if (!projectId) return;

      setOrchestratorCheckpoint(null);
      setOrchestratorRunning(true);

      const res = await fetch(`${API}/api/orchestrate/${projectId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: data || {} }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setOrchestratorRunning(false);
        throw new Error(err.detail || 'Failed to resume');
      }

      // If the SSE stream died during the checkpoint wait, poll for remaining events
      if (!streamAliveRef.current) {
        addAnalysisLog({ ts: Date.now() / 1000, level: 'INFO', msg: 'Reconnecting to orchestration stream...' });
        pollForEvents(projectId);
      }
    },
    [projectId, setOrchestratorCheckpoint, setOrchestratorRunning, addAnalysisLog],
  );

  const pollForEvents = useCallback(
    async (pid: string) => {
      let lastCount = useStore.getState().orchestratorEvents.length;
      const maxPolls = 300; // 5 min at 1s interval

      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const res = await fetch(`${API}/api/orchestrate/${pid}/status`);
          if (!res.ok) break;
          const status = await res.json();

          if (!status.active && status.events.length === 0) break;

          // Process any new events
          const newEvents = (status.events as OrchestratorEvent[]).slice(lastCount);
          for (const event of newEvents) {
            addOrchestratorEvent(event);

            const logLevel = event.type === 'error' ? 'ERROR'
              : event.type === 'checkpoint' ? 'WARNING'
              : 'INFO';
            const logMsg = event.type === 'thinking' ? `Thinking: ${(event.thinking as string || '').slice(0, 200)}`
              : event.type === 'tool_start' ? `Running tool: ${event.tool}`
              : event.type === 'tool_result' ? `${event.tool} ${event.error ? 'FAILED' : 'completed'}${event.duration ? ` (${(event.duration as number).toFixed(1)}s)` : ''}${event.result ? ' — ' + (event.result as string).slice(0, 150) : ''}`
              : event.type === 'checkpoint' ? `⏸ Checkpoint: ${event.phase} — ${event.message || 'Waiting for input'}`
              : event.type === 'complete' ? `✓ Pipeline complete${event.message ? ': ' + (event.message as string).slice(0, 200) : ''}`
              : event.type === 'error' ? `✗ Error: ${event.message}`
              : event.type === 'cancelled' ? 'Pipeline cancelled'
              : event.type;
            addAnalysisLog({ ts: Date.now() / 1000, level: logLevel, msg: logMsg });

            if (event.type === 'checkpoint') {
              setOrchestratorCheckpoint({
                phase: event.phase as 'analysis_review' | 'clarify_human' | 'plan_review' | 'quality_gate',
                summary: event.message as string | undefined,
                data: event as Record<string, unknown>,
              });
            }

            if (event.type === 'complete' || event.type === 'error' || event.type === 'cancelled') {
              setOrchestratorRunning(false);
              setOrchestratorCheckpoint(null);
              return;
            }
          }
          lastCount = status.events.length;

          // If pipeline hit another checkpoint, stop polling — user will resume again
          if (newEvents.some((e) => e.type === 'checkpoint')) return;

          // If pipeline is no longer active, we're done
          if (!status.active) {
            setOrchestratorRunning(false);
            return;
          }
        } catch {
          break;
        }
      }
      setOrchestratorRunning(false);
    },
    [addOrchestratorEvent, addAnalysisLog, setOrchestratorCheckpoint, setOrchestratorRunning],
  );

  const cancel = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (!projectId) return;

    setOrchestratorRunning(false);
    setOrchestratorCheckpoint(null);

    await fetch(`${API}/api/orchestrate/${projectId}/cancel`, {
      method: 'POST',
    }).catch(() => {});
  }, [projectId, setOrchestratorRunning, setOrchestratorCheckpoint]);

  return { start, resume, cancel };
}
