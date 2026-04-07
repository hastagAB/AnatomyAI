import { useState } from 'react';
import { Loader2, Download, Zap, RefreshCw, LayoutGrid, ArrowDown, ArrowRight, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { DIAGRAM_TYPE_LABELS, type DiagramType } from '../../types';
import { exportDiagram } from './DiagramCanvas';

const diagramTypes = Object.entries(DIAGRAM_TYPE_LABELS) as [DiagramType, string][];

export function DiagramToolbar() {
  const {
    currentDiagramType,
    generatingDiagram,
    analysis,
    diagramCache,
    openEvolveWithContext,
    diagramLayoutDirection,
    setDiagramLayoutDirection,
    triggerRelayout,
  } = useStore();
  const { generateDiagram } = useProject();
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'png' | 'svg', pixelRatio: number = 4) => {
    setExporting(true);
    setExportOpen(false);
    try {
      await exportDiagram(format, pixelRatio);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="border-b border-white/[0.06] bg-gray-950/40 backdrop-blur-2xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {diagramTypes.map(([type, label]) => (
            <button
              key={type}
              onClick={() => generateDiagram(type)}
              disabled={generatingDiagram || !analysis}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentDiagramType === type
                  ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm shadow-indigo-500/5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {generatingDiagram && currentDiagramType === type ? (
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              ) : diagramCache[type] ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
              ) : null}
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Layout controls */}
          <div className="flex items-center gap-0.5 bg-gray-900/60 border border-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setDiagramLayoutDirection('TB')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                diagramLayoutDirection === 'TB'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Top-to-Bottom layout"
            >
              <ArrowDown className="w-3 h-3" />
              TB
            </button>
            <button
              onClick={() => setDiagramLayoutDirection('LR')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                diagramLayoutDirection === 'LR'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Left-to-Right layout"
            >
              <ArrowRight className="w-3 h-3" />
              LR
            </button>
          </div>
          <button
            onClick={triggerRelayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all border border-cyan-500/20"
            title="Auto-organize diagram layout"
          >
            <LayoutGrid className="w-3 h-3" />
            Auto Layout
          </button>

          <div className="w-px h-5 bg-white/5" />

          {diagramCache[currentDiagramType] && (
            <button
              onClick={() => generateDiagram(currentDiagramType, true)}
              disabled={generatingDiagram}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5 disabled:opacity-30"
              title="Regenerate this diagram"
            >
              <RefreshCw className={`w-3 h-3 ${generatingDiagram ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          )}
          <button
            onClick={() => openEvolveWithContext('I want to modify the diagram: ')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all border border-amber-500/20"
          >
            <Zap className="w-3 h-3" />
            Evolve
          </button>

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl py-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">PNG</div>
                  <button
                    onClick={() => handleExport('png', 2)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>Standard (2x)</span>
                    <span className="text-gray-600">Fast</span>
                  </button>
                  <button
                    onClick={() => handleExport('png', 4)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>High Quality (4x)</span>
                    <span className="text-emerald-500 text-[10px]">Recommended</span>
                  </button>
                  <button
                    onClick={() => handleExport('png', 6)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>Ultra (6x)</span>
                    <span className="text-gray-600">Print-ready</span>
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">SVG</div>
                  <button
                    onClick={() => handleExport('svg')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>Vector (Scalable)</span>
                    <span className="text-purple-400 text-[10px]">Infinite zoom</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
