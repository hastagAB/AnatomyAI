import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

const API = 'http://localhost:8000';

export function useLogStream() {
  const projectId = useStore((s) => s.projectId);
  const addAnalysisLog = useStore((s) => s.addAnalysisLog);
  const setShowLogViewer = useStore((s) => s.setShowLogViewer);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Close existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    if (!projectId) return;

    const es = new EventSource(`${API}/api/projects/${projectId}/logs`);
    sourceRef.current = es;

    es.addEventListener('log', (e) => {
      try {
        const entry = JSON.parse(e.data);
        addAnalysisLog(entry);
        // Auto-show log viewer on first real log
        setShowLogViewer(true);
      } catch { /* skip malformed */ }
    });

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [projectId, addAnalysisLog, setShowLogViewer]);
}
