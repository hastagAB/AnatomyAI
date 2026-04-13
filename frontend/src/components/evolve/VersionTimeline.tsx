import { useState, useEffect } from 'react';
import {
  History,
  GitBranch,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import type { AnalysisVersion, Refinement } from '../../types';

function VersionCard({
  version,
  refinement,
  isLatest,
  isActive,
  onSelect,
  onCompare,
}: {
  version: AnalysisVersion;
  refinement?: Refinement;
  isLatest: boolean;
  isActive: boolean;
  onSelect: () => void;
  onCompare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(version.created_at * 1000);
  const isEvolve = version.source === 'evolve';

  return (
    <div
      className={`border rounded-xl transition-all ${
        isActive
          ? 'border-indigo-500/30 bg-indigo-500/[0.06]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]'
      }`}
    >
      <button onClick={onSelect} className="w-full text-left p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
            isEvolve
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-indigo-500/20 text-indigo-400'
          }`}>
            {isEvolve ? <Zap className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
          </div>
          <span className="text-xs font-bold text-white">v{version.version}</span>
          {isLatest && (
            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
              LATEST
            </span>
          )}
          <span className="text-[9px] text-gray-600 ml-auto">
            {isEvolve ? 'Evolved' : 'Analyzed'}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 line-clamp-2 mb-1.5">{version.summary}</div>
        <div className="flex gap-3 text-[10px] text-gray-600">
          <span><span className="text-indigo-400">{version.components}</span> comp</span>
          <span><span className="text-purple-400">{version.data_flows}</span> flows</span>
          <span><span className="text-amber-400">{version.gaps}</span> gaps</span>
          <span><span className="text-emerald-400">{version.tech_stack}</span> tech</span>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">
          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </button>

      {/* Refinement details if this version was produced by evolve */}
      {refinement && (
        <div className="border-t border-white/[0.04] px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span className="truncate flex-1">{refinement.instructions}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] text-gray-400 whitespace-pre-wrap">{refinement.instructions}</div>
              {refinement.search_results.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {refinement.search_results.map((sr, i) => (
                    <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                      <a href={sr.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 truncate">
                        {sr.title}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compare button */}
      {!isLatest && (
        <div className="border-t border-white/[0.04] px-3 py-2">
          <button
            onClick={onCompare}
            className="flex items-center gap-1 text-[10px] text-indigo-400/70 hover:text-indigo-400 transition-colors"
          >
            <ArrowLeftRight className="w-3 h-3" />
            Compare with latest
          </button>
        </div>
      )}
    </div>
  );
}

export function VersionTimeline() {
  const { analysisVersions, refinements } = useStore();
  const { loadAnalysisVersions, loadRefinements, loadAnalysisByVersion, loadAnalysisDiff } = useProject();
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  useEffect(() => {
    loadAnalysisVersions();
    loadRefinements();
  }, []);

  useEffect(() => {
    if (analysisVersions.length > 0 && activeVersion === null) {
      setActiveVersion(analysisVersions[0].version);
    }
  }, [analysisVersions]);

  const refinementByVersion = new Map<number, Refinement>();
  for (const r of refinements) {
    if (r.produced_version != null) {
      refinementByVersion.set(r.produced_version, r);
    }
  }

  const handleSelect = (version: number) => {
    setActiveVersion(version);
    loadAnalysisByVersion(version);
  };

  const handleCompare = (version: number) => {
    const latest = analysisVersions[0]?.version;
    if (latest != null) {
      loadAnalysisDiff(version, latest);
    }
  };

  if (analysisVersions.length === 0) {
    return (
      <div className="text-center text-gray-600 text-xs mt-8 px-3">
        <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No iterations yet</p>
        <p className="text-[10px] mt-1">Run analysis to create v1</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 mb-1">
        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
          Iterations ({analysisVersions.length})
        </span>
      </div>
      {analysisVersions.map((v) => (
        <VersionCard
          key={v.version}
          version={v}
          refinement={refinementByVersion.get(v.version)}
          isLatest={v.version === analysisVersions[0]?.version}
          isActive={v.version === activeVersion}
          onSelect={() => handleSelect(v.version)}
          onCompare={() => handleCompare(v.version)}
        />
      ))}
    </div>
  );
}
