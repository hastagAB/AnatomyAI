import {
  Upload,
  BarChart3,
  GitBranch,
  ClipboardList,
  Zap,
  FileText,
  Trash2,
  Loader2,
  RotateCcw,
  Sparkles,
  Download,
  HelpCircle,
  Hammer,
  Bot,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import type { ViewMode } from '../../types';

const navItems: { view: ViewMode; label: string; icon: typeof Upload }[] = [
  { view: 'upload', label: 'Documents', icon: Upload },
  { view: 'autopilot', label: 'Autopilot', icon: Bot },
  { view: 'analysis', label: 'Analysis', icon: BarChart3 },
  { view: 'diagrams', label: 'Diagrams', icon: GitBranch },
  { view: 'clarify', label: 'Clarify', icon: HelpCircle },
  { view: 'plan', label: 'Plan', icon: ClipboardList },
  { view: 'build', label: 'Build', icon: Hammer },
  { view: 'evolve', label: 'Evolve', icon: Zap },
];

export function Sidebar() {
  const {
    currentView,
    setCurrentView,
    documents,
    analyzing,
    analysisProgress,
    analysis,
  } = useStore();
  const { removeDocument, analyzeProject, exportProject } = useProject();

  const progressLabel = () => {
    if (!analysisProgress) return 'Analyzing...';
    if (analysisProgress.phase === 'extract') {
      const statusTag = analysisProgress.status === 'cached' ? ' (cached)' 
                       : analysisProgress.status === 'failed' ? ' (failed)' 
                       : '';
      return `Extracting ${analysisProgress.current}/${analysisProgress.total}${statusTag}`;
    }
    if (analysisProgress.phase === 'synthesize') {
      return 'Synthesizing...';
    }
    if (analysisProgress.phase === 'deepen') {
      return `Deepening pass ${analysisProgress.pass ?? ''}...`;
    }
    return 'Finishing...';
  };

  return (
    <aside className="w-64 border-r border-white/[0.06] bg-gray-950/40 backdrop-blur-sm flex flex-col">
      {/* Navigation */}
      <nav className="p-3 space-y-0.5">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentView === view
                ? 'bg-gradient-to-r from-indigo-500/[0.12] to-purple-500/[0.08] text-indigo-300 border border-indigo-500/15 shadow-sm shadow-indigo-500/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-white/[0.04] mx-3" />

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">
          Documents ({documents.length})
        </div>
        <div className="space-y-0.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              <span className="text-[13px] text-gray-400 truncate flex-1">
                {doc.filename}
              </span>
              <button
                onClick={() => removeDocument(doc.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Analyze button */}
      {documents.length > 0 && (
        <div className="p-3 border-t border-white/[0.04]">
          {analyzing && analysisProgress && (
            <div className="mb-3 glass-card rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                  {progressLabel()}
                </span>
                {analysisProgress.phase === 'extract' && analysisProgress.total && (
                  <span className="text-indigo-400 font-medium">{Math.round(((analysisProgress.current || 0) / analysisProgress.total) * 100)}%</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: analysisProgress.phase === 'extract' && analysisProgress.total
                      ? `${((analysisProgress.current || 0) / analysisProgress.total) * 100}%`
                      : analysisProgress.phase === 'synthesize'
                        ? '90%'
                        : '100%',
                  }}
                />
              </div>
              {analysisProgress.docs && (
                <div className="text-[10px] text-gray-600 mt-1.5 truncate">
                  {analysisProgress.docs[0]}{analysisProgress.docs.length > 1 ? ` +${analysisProgress.docs.length - 1}` : ''}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => analyzeProject(false)}
            disabled={analyzing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:from-indigo-400 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progressLabel()}
              </>
            ) : analysis ? (
              'Re-analyze (Resume)'
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Documents
              </>
            )}
          </button>
          {analysis && !analyzing && (
            <button
              onClick={() => analyzeProject(true)}
              className="w-full mt-2 py-2.5 rounded-xl border border-white/[0.06] text-gray-500 text-xs font-medium hover:bg-white/[0.03] hover:text-gray-300 hover:border-white/[0.1] transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Fresh Analysis
            </button>
          )}
          {analysis && !analyzing && (
            <button
              onClick={exportProject}
              className="w-full mt-2 py-2.5 rounded-xl border border-white/[0.06] text-gray-500 text-xs font-medium hover:bg-white/[0.03] hover:text-emerald-400 hover:border-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              Export Project
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
