import { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Globe,
  Loader2,
  ArrowRight,
  ExternalLink,
  Check,
  Zap,
  Package,
  FileSearch,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { VersionTimeline } from './VersionTimeline';
import { IntegrationAdvisor } from './IntegrationAdvisor';
import { CustomArtifacts } from './CustomArtifacts';
import type { SearchResult } from '../../types';

function SearchResultCard({
  result,
  selected,
  onToggle,
}: {
  result: SearchResult;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? 'border-indigo-500/30 bg-indigo-500/[0.08]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
            selected
              ? 'bg-indigo-500 border-indigo-500'
              : 'border-white/20'
          }`}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200 truncate">{result.title}</div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{result.snippet}</div>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400/60">
            <ExternalLink className="w-2.5 h-2.5" />
            <span className="truncate">{result.url}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function EvolveWorkspace() {
  const { analysis, searchResults, searchLoading, refining, refineProgress, evolveContext, setEvolveContext } = useStore();
  const { webSearch, refineAnalysis } = useProject();

  const [instructions, setInstructions] = useState(evolveContext || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'refine' | 'integrate' | 'analyze'>('refine');

  // Sync evolveContext from store (when opened from another view)
  useEffect(() => {
    if (evolveContext) {
      setInstructions(evolveContext);
      setEvolveContext('');
    }
  }, [evolveContext]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSelectedResults(new Set());
    await webSearch(searchQuery.trim());
  };

  const toggleResult = (idx: number) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleEvolve = async () => {
    if (!instructions.trim()) return;

    // Collect search queries from selected results context
    const searchQueries: string[] = [];
    if (showSearch && searchQuery.trim()) {
      searchQueries.push(searchQuery.trim());
    }

    // Build enhanced instructions with selected search results
    let enhancedInstructions = instructions.trim();
    if (selectedResults.size > 0) {
      const selected = searchResults.filter((_, i) => selectedResults.has(i));
      enhancedInstructions += '\n\nRelevant search findings to incorporate:\n';
      selected.forEach((r, i) => {
        enhancedInstructions += `\n${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.url}\n`;
      });
    }

    await refineAnalysis(enhancedInstructions, searchQueries);
    setInstructions('');
    setSelectedResults(new Set());
  };

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-amber-500/40" />
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Analysis Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Run an analysis first, then use Evolve to refine and update your architecture with new ideas, feedback, or web research.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main evolution panel */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Evolve Architecture</h2>
                <p className="text-xs text-gray-500">Refine your analysis with new ideas, feedback, or web research</p>
              </div>
            </div>
          </div>

          {/* Current analysis summary */}
          <div className="glass-card rounded-xl p-4 border border-white/[0.06]">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Current Analysis</div>
            <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>
            <div className="flex gap-4 mt-3">
              <div className="text-xs text-gray-500">
                <span className="text-indigo-400 font-semibold">{analysis.components.length}</span> components
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-purple-400 font-semibold">{analysis.data_flows.length}</span> flows
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-amber-400 font-semibold">{analysis.gaps.length}</span> gaps
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-emerald-400 font-semibold">{analysis.tech_stack.length}</span> technologies
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('refine')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'refine'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Zap className="w-4 h-4" />
              Refine & Evolve
            </button>
            <button
              onClick={() => setActiveTab('integrate')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'integrate'
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Package className="w-4 h-4" />
              Integrations
              {analysis.tech_stack.some((t) => t.id.startsWith('tech-oss-')) && (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">
                  {analysis.tech_stack.filter((t) => t.id.startsWith('tech-oss-')).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('analyze')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'analyze'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <FileSearch className="w-4 h-4" />
              Custom Analysis
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'refine' ? (
            <>
              {/* Refinement instructions */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">What do you want to change?</div>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe the changes you want to make to the architecture...&#10;&#10;Examples:&#10;• Replace the custom guardrails service with NVIDIA NeMo Guardrails&#10;• Add a Redis caching layer between the API gateway and backend services&#10;• Switch from monolith to microservices architecture&#10;• Use open-source alternatives instead of building custom components"
                  className="w-full h-40 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/30 focus:bg-white/[0.04] transition-all resize-none"
                  disabled={refining}
                />
              </div>

              {/* Web search toggle */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm ${
                    showSearch
                      ? 'border-indigo-500/20 bg-indigo-500/[0.08] text-indigo-300'
                      : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Web Search
                  <span className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                    find alternatives & current info
                  </span>
                </button>

                <AnimatePresence>
                  {showSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        {/* Search input */}
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-indigo-500/30 transition-all">
                            <Search className="w-4 h-4 text-gray-600" />
                            <input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                              placeholder="Search for technologies, frameworks, open-source projects..."
                              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                              disabled={searchLoading}
                            />
                          </div>
                          <button
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() || searchLoading}
                            className="px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all disabled:opacity-30 flex items-center gap-2 text-sm"
                          >
                            {searchLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            Search
                          </button>
                        </div>

                        {/* Search results */}
                        {searchResults.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                Results ({searchResults.length}) — select relevant ones
                              </div>
                              {selectedResults.size > 0 && (
                                <div className="text-[10px] text-indigo-400">
                                  {selectedResults.size} selected
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {searchResults.map((result, i) => (
                                <SearchResultCard
                                  key={i}
                                  result={result}
                                  selected={selectedResults.has(i)}
                                  onToggle={() => toggleResult(i)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Evolve button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEvolve}
                  disabled={!instructions.trim() || refining}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {refining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {refineProgress || 'Evolving...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Evolve Analysis
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Refinement progress */}
              <AnimatePresence>
                {refining && refineProgress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="glass-card rounded-xl p-4 border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-amber-300">{refineProgress}</div>
                        <div className="text-[10px] text-gray-600">
                          AI is incorporating your changes into the analysis...
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : activeTab === 'integrate' ? (
            <IntegrationAdvisor
              onIntegrate={(generatedInstructions) => {
                setInstructions(generatedInstructions);
                setActiveTab('refine');
              }}
            />
          ) : (
            <CustomArtifacts />
          )}
        </div>
      </div>

      {/* Right panel: version timeline */}
      <div className="w-72 border-l border-white/[0.06] bg-gray-950/40 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="text-sm font-semibold text-gray-400">
            Version History
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <VersionTimeline />
        </div>
      </div>
    </div>
  );
}
