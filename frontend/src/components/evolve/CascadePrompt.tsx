import { RefreshCw, GitBranch, ClipboardList, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';

export function CascadePrompt() {
  const { showCascadePrompt, setShowCascadePrompt, currentDiagramType, generatingDiagram, generatingPlan } = useStore();
  const { generateDiagram, generatePlan } = useProject();
  const [regeneratingDiagram, setRegeneratingDiagram] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);

  if (!showCascadePrompt) return null;

  const handleRegenerateDiagram = async () => {
    setRegeneratingDiagram(true);
    try {
      await generateDiagram(currentDiagramType);
    } finally {
      setRegeneratingDiagram(false);
    }
  };

  const handleRegeneratePlan = async () => {
    setRegeneratingPlan(true);
    try {
      await generatePlan();
    } finally {
      setRegeneratingPlan(false);
    }
  };

  const busy = regeneratingDiagram || regeneratingPlan || generatingDiagram || generatingPlan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
    >
      <div className="bg-gray-900/95 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-4 shadow-2xl shadow-black/40 max-w-lg">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white mb-1">Analysis Evolved</div>
            <div className="text-xs text-gray-400 mb-3">
              Your diagrams and plan may be outdated. Regenerate them from the updated analysis?
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerateDiagram}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-all disabled:opacity-40 border border-indigo-500/20"
              >
                {regeneratingDiagram ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                Regen Diagram
              </button>
              <button
                onClick={handleRegeneratePlan}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-all disabled:opacity-40 border border-purple-500/20"
              >
                {regeneratingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}
                Regen Plan
              </button>
              <button
                onClick={() => setShowCascadePrompt(false)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-500 text-xs hover:text-gray-300 hover:bg-white/[0.04] transition-all"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
