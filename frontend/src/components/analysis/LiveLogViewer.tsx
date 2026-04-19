import { useEffect, useRef } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

function levelColor(level: string) {
  switch (level) {
    case 'ERROR':
      return 'text-red-400';
    case 'WARNING':
      return 'text-yellow-400';
    case 'INFO':
      return 'text-emerald-400';
    case 'DEBUG':
      return 'text-gray-500';
    default:
      return 'text-gray-400';
  }
}

function levelBadge(level: string) {
  switch (level) {
    case 'ERROR':
      return 'bg-red-500/20 text-red-400';
    case 'WARNING':
      return 'bg-yellow-500/20 text-yellow-400';
    default:
      return 'bg-white/5 text-gray-500';
  }
}

export function LiveLogViewer() {
  const {
    analysisLogs, showLogViewer, setShowLogViewer, clearAnalysisLogs,
    analyzing, orchestratorRunning,
    refining, generatingDiagram, generatingPlan, chatLoading,
    clarifying, resolving, autoResolving,
    generatingArtifacts, advisorLoading,
  } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [analysisLogs.length]);

  // Auto-open when new logs arrive
  useEffect(() => {
    if (analysisLogs.length > 0 && !showLogViewer) {
      setShowLogViewer(true);
    }
  }, [analysisLogs.length]);

  // Track whether user has scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isAutoScroll.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const isLive = analyzing || orchestratorRunning || refining || generatingDiagram
    || generatingPlan || chatLoading || clarifying || resolving || autoResolving
    || generatingArtifacts || advisorLoading;

  return (
    <div
      className="fixed bottom-0 right-0 z-50 flex flex-col"
      style={{ width: '480px', maxWidth: 'calc(100vw - 280px)' }}
    >
      {/* Always-visible header tab */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-white/[0.08] border-b-0 rounded-t-lg cursor-pointer select-none shadow-lg shadow-black/40"
        onClick={() => setShowLogViewer(!showLogViewer)}
      >
        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold text-gray-300 tracking-wide uppercase">
          Logs
        </span>
        {isLive && (
          <span className="ml-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
          </span>
        )}
        {analysisLogs.length > 0 && (
          <span className="text-[10px] text-gray-500 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
            {analysisLogs.length}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {analysisLogs.length > 0 && (
            <button
              className="p-0.5 hover:bg-white/10 rounded transition-colors"
              onClick={(e) => { e.stopPropagation(); clearAnalysisLogs(); }}
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            </button>
          )}
          {showLogViewer ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          )}
        </span>
      </div>

      {/* Expandable log content */}
      {showLogViewer && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="bg-gray-950 border border-white/[0.08] border-t-0 overflow-y-auto font-mono text-[11px] leading-5 px-3 py-2 shadow-xl shadow-black/50"
          style={{ maxHeight: '220px', minHeight: '60px' }}
        >
          {analysisLogs.length === 0 ? (
            <div className="text-gray-600 text-center py-4 text-xs">
              {isLive ? 'Waiting for logs...' : 'No logs yet. Perform any action to see live output.'}
            </div>
          ) : (
            analysisLogs.map((entry, i) => (
              <div key={i} className="flex gap-2 hover:bg-white/[0.02] px-1 -mx-1 rounded">
                <span className={`shrink-0 ${levelColor(entry.level)}`}>
                  <span className={`inline-block px-1 rounded text-[9px] font-bold ${levelBadge(entry.level)}`}>
                    {entry.level.slice(0, 4)}
                  </span>
                </span>
                <span className="text-gray-400 whitespace-pre-wrap break-all">{entry.msg}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
