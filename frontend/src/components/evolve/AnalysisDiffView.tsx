import { X, Plus, Minus, Equal, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { motion } from 'framer-motion';
import type { DiffSection } from '../../types';

function DiffSectionCard({
  title,
  color,
  diff,
}: {
  title: string;
  color: string;
  diff: DiffSection;
}) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color }}>{title}</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-gray-500">{diff.total_before}</span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="text-gray-300 font-medium">{diff.total_after}</span>
        </div>
      </div>
      {hasChanges ? (
        <div className="space-y-1">
          {diff.added.map((name, i) => (
            <div key={`a-${i}`} className="flex items-center gap-1.5 text-[11px]">
              <Plus className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-400">{name}</span>
            </div>
          ))}
          {diff.removed.map((name, i) => (
            <div key={`r-${i}`} className="flex items-center gap-1.5 text-[11px]">
              <Minus className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="text-red-400 line-through">{name}</span>
            </div>
          ))}
          {diff.unchanged > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Equal className="w-3 h-3 flex-shrink-0" />
              <span>{diff.unchanged} unchanged</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-gray-600 flex items-center gap-1">
          <Equal className="w-3 h-3" />
          No changes ({diff.unchanged} items)
        </div>
      )}
    </div>
  );
}

export function AnalysisDiffView() {
  const { analysisDiff, setAnalysisDiff } = useStore();

  if (!analysisDiff) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setAnalysisDiff(null)}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border border-white/[0.08] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h3 className="text-base font-bold text-white">
              Version Comparison: v{analysisDiff.v1} → v{analysisDiff.v2}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">What changed between iterations</p>
          </div>
          <button
            onClick={() => setAnalysisDiff(null)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary diff */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Summary</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-600 mb-1">v{analysisDiff.v1}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{analysisDiff.summary_before}</p>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 mb-1">v{analysisDiff.v2}</div>
                <p className="text-xs text-gray-300 leading-relaxed">{analysisDiff.summary_after}</p>
              </div>
            </div>
          </div>

          {/* Section diffs */}
          <div className="grid grid-cols-2 gap-3">
            <DiffSectionCard title="Components" color="#3b82f6" diff={analysisDiff.components} />
            <DiffSectionCard title="Data Flows" color="#a855f7" diff={analysisDiff.data_flows} />
            <DiffSectionCard title="Data Models" color="#10b981" diff={analysisDiff.data_models} />
            <DiffSectionCard title="Tech Stack" color="#06b6d4" diff={analysisDiff.tech_stack} />
            <DiffSectionCard title="Gaps" color="#f43f5e" diff={analysisDiff.gaps} />
            <DiffSectionCard title="Non-Functional Reqs" color="#ec4899" diff={analysisDiff.nfrs} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
