import { useState } from 'react';
import {
  Package,
  Loader2,
  ExternalLink,
  Shield,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Star,
  GitBranch,
  Users,
  AlertTriangle,
  CheckCircle2,
  Target,
  Layers,
  Search,
  Link2,
  Plus,
  X,
  PackageCheck,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import type { IntegrationSuggestion } from '../../types';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof Package }> = {
  replacement: { label: 'Replacement', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: GitBranch },
  enhancement: { label: 'Enhancement', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Zap },
  missing_capability: { label: 'New Capability', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: Target },
  infrastructure: { label: 'Infrastructure', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: Layers },
};

const EFFORT_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-emerald-400' },
  medium: { label: 'Medium', color: 'text-amber-400' },
  high: { label: 'High', color: 'text-rose-400' },
};

const MATURITY_CONFIG: Record<string, { label: string; color: string }> = {
  experimental: { label: 'Experimental', color: 'text-rose-400' },
  growing: { label: 'Growing', color: 'text-amber-400' },
  mature: { label: 'Mature', color: 'text-emerald-400' },
  established: { label: 'Established', color: 'text-blue-400' },
};

function CompatibilityMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onIntegrate,
}: {
  suggestion: IntegrationSuggestion;
  onIntegrate: (s: IntegrationSuggestion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.enhancement;
  const effort = EFFORT_CONFIG[suggestion.integration_effort] || EFFORT_CONFIG.medium;
  const maturity = MATURITY_CONFIG[suggestion.maturity] || MATURITY_CONFIG.mature;
  const Icon = cat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl border border-white/[0.06] overflow-hidden hover:border-white/[0.12] transition-all"
    >
      <div className="p-4">
        {/* Header: Name + Category */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${cat.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-white">{suggestion.library_name}</h4>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cat.color}`}>
                  {cat.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{suggestion.description}</p>
            </div>
          </div>
          {suggestion.library_url && (
            <a
              href={suggestion.library_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-indigo-400 transition-colors flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Compatibility + Meta */}
        <div className="mb-3">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Compatibility</div>
          <CompatibilityMeter score={suggestion.compatibility_score} />
        </div>

        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          <span className="flex items-center gap-1 text-gray-500">
            <Zap className="w-3 h-3" />
            Effort: <span className={`font-semibold ${effort.color}`}>{effort.label}</span>
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <Star className="w-3 h-3" />
            <span className={`font-semibold ${maturity.color}`}>{maturity.label}</span>
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <Users className="w-3 h-3" />
            {suggestion.community_size}
          </span>
          {suggestion.license && (
            <span className="flex items-center gap-1 text-gray-500">
              <Shield className="w-3 h-3" />
              {suggestion.license}
            </span>
          )}
        </div>

        {/* Rationale */}
        <div className="mt-3 p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.04]">
          <p className="text-xs text-gray-400 leading-relaxed">{suggestion.rationale}</p>
        </div>

        {/* Target components */}
        {suggestion.target_components.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-600">Targets:</span>
            {suggestion.target_components.map((c) => (
              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Tech alignment */}
        {suggestion.tech_alignment.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-600">Aligns with:</span>
            {suggestion.tech_alignment.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/[0.08] text-indigo-400 border border-indigo-500/20">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less details' : 'Integration steps & risks'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-3">
                {/* Integration steps */}
                {suggestion.integration_steps.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5">Integration Steps</div>
                    <div className="space-y-1">
                      {suggestion.integration_steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500/40 mt-0.5 flex-shrink-0" />
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {suggestion.risks.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5">Risks</div>
                    <div className="space-y-1">
                      {suggestion.risks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                          <AlertTriangle className="w-3 h-3 text-amber-500/40 mt-0.5 flex-shrink-0" />
                          {risk}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estimated savings */}
                {suggestion.estimated_savings && (
                  <div className="p-2 bg-emerald-500/[0.05] rounded-lg border border-emerald-500/10">
                    <div className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mb-0.5">Saves You From Building</div>
                    <p className="text-xs text-emerald-300/80">{suggestion.estimated_savings}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action button */}
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <button
            onClick={() => onIntegrate(suggestion)}
            className="w-full py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowRight className="w-3 h-3" />
            Integrate via Evolve
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function IntegrationAdvisor({
  onIntegrate,
}: {
  onIntegrate: (instructions: string) => void;
}) {
  const { analysis, integrationAdvice, advisorLoading, advisorProgress } = useStore();
  const { suggestIntegrations } = useProject();
  const [focusArea, setFocusArea] = useState('');
  const [repoUrls, setRepoUrls] = useState<string[]>([]);
  const [repoInput, setRepoInput] = useState('');
  const [repoOnly, setRepoOnly] = useState(false);

  const addRepoUrl = () => {
    const url = repoInput.trim();
    if (!url || repoUrls.includes(url)) return;
    if (!url.match(/github\.com\/[^/]+\/[^/\s]+/)) return;
    setRepoUrls((prev) => [...prev, url]);
    setRepoInput('');
  };

  const removeRepoUrl = (idx: number) => {
    setRepoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDiscover = () => {
    suggestIntegrations(
      focusArea.trim() || undefined,
      repoUrls.length > 0 ? repoUrls : undefined,
      repoOnly && repoUrls.length > 0,
    );
  };

  const handleIntegrate = (suggestion: IntegrationSuggestion) => {
    const lines = [
      `Integrate ${suggestion.library_name} into the architecture.`,
    ];
    if (suggestion.replaces_custom) {
      lines.push(`Replace the custom "${suggestion.replaces_custom}" component with ${suggestion.library_name}.`);
    }
    lines.push('');
    lines.push(`Library: ${suggestion.library_name}`);
    if (suggestion.library_url) lines.push(`URL: ${suggestion.library_url}`);
    if (suggestion.license) lines.push(`License: ${suggestion.license}`);
    lines.push('');
    lines.push('Integration steps:');
    suggestion.integration_steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    if (suggestion.risks.length > 0) {
      lines.push('');
      lines.push('Risks to address:');
      suggestion.risks.forEach((risk) => lines.push(`- ${risk}`));
    }

    onIntegrate(lines.join('\n'));
  };

  if (!analysis) return null;

  // Detect OSS libraries applied by autopilot (id starts with "tech-oss-")
  const appliedOss = analysis.tech_stack.filter((t) => t.id.startsWith('tech-oss-'));
  const manualTech = analysis.tech_stack.filter((t) => !t.id.startsWith('tech-oss-'));

  const suggestions = integrationAdvice?.suggestions || [];
  const groupedByCategory = suggestions.reduce<Record<string, IntegrationSuggestion[]>>((acc, s) => {
    const cat = s.category || 'enhancement';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // Sort by compatibility score within groups
  Object.values(groupedByCategory).forEach((group) =>
    group.sort((a, b) => b.compatibility_score - a.compatibility_score)
  );

  const categoryOrder = ['replacement', 'missing_capability', 'enhancement', 'infrastructure'];

  return (
    <div className="space-y-4">
      {/* Applied OSS Stack — from autopilot optimize_oss_stack */}
      {appliedOss.length > 0 && (
        <div className="glass-card rounded-xl p-4 border border-emerald-500/15">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <PackageCheck className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Applied OSS Stack</h3>
                <p className="text-[10px] text-gray-500">
                  {appliedOss.length} open-source {appliedOss.length === 1 ? 'library' : 'libraries'} auto-applied by Autopilot
                </p>
              </div>
            </div>
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 font-medium">
              {appliedOss.length} integrated
            </div>
          </div>

          <div className="grid gap-2">
            {appliedOss.map((tech) => {
              const linkedComponents = tech.component_ids
                .map((cid) => analysis.components.find((c) => c.id === cid)?.name)
                .filter(Boolean);

              return (
                <div
                  key={tech.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/20 transition-all group"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{tech.technology}</span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-500">
                        {tech.category}
                      </span>
                    </div>
                    {tech.purpose && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{tech.purpose}</p>
                    )}
                    {linkedComponents.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[10px] text-gray-600">Targets:</span>
                        {linkedComponents.map((name) => (
                          <span
                            key={name}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onIntegrate(
                        `Remove ${tech.technology} from the tech stack and revert to the custom implementation. ` +
                        `Reason: I want to build this component in-house instead of using the open-source library.`
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Remove and revert to custom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Existing tech stack summary */}
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-4 text-[10px] text-gray-500">
            <span>
              Total tech stack: <span className="text-indigo-400 font-semibold">{analysis.tech_stack.length}</span> entries
            </span>
            <span>
              OSS applied: <span className="text-emerald-400 font-semibold">{appliedOss.length}</span>
            </span>
            <span>
              Original: <span className="text-gray-400 font-semibold">{manualTech.length}</span>
            </span>
          </div>
        </div>
      )}

      {/* Discover Header */}
      <div className="glass-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <Package className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Discover More OSS</h3>
            <p className="text-[10px] text-gray-500">
              {appliedOss.length > 0
                ? 'Search for additional open-source opportunities or paste a GitHub repo URL'
                : 'AI analyzes your architecture and suggests compatible open-source projects to reuse'}
            </p>
          </div>
        </div>

        {/* Focus area input */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-violet-500/30 transition-all">
            <Search className="w-4 h-4 text-gray-600" />
            <input
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
              placeholder="Optional: focus area (e.g., 'guardrails', 'caching', 'auth')..."
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
              disabled={advisorLoading}
            />
          </div>
          <button
            onClick={handleDiscover}
            disabled={advisorLoading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-sm font-semibold hover:from-violet-400 hover:to-fuchsia-500 transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-violet-500/20"
          >
            {advisorLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Discover
              </>
            )}
          </button>
        </div>

        {/* GitHub repo links */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-violet-500/30 transition-all">
              <Link2 className="w-4 h-4 text-gray-600" />
              <input
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRepoUrl()}
                placeholder="Paste GitHub repo URL (e.g., https://github.com/org/project)..."
                className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none"
                disabled={advisorLoading}
              />
            </div>
            <button
              onClick={addRepoUrl}
              disabled={advisorLoading || !repoInput.trim()}
              className="px-3 py-2 rounded-xl border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {repoUrls.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
              {repoUrls.map((url, i) => {
                const short = url.replace(/^https?:\/\/(www\.)?github\.com\//, '');
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-gray-400"
                  >
                    <Link2 className="w-3 h-3 text-gray-500" />
                    {short}
                    <button
                      onClick={() => removeRepoUrl(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      disabled={advisorLoading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none ml-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={repoOnly}
                    onChange={(e) => setRepoOnly(e.target.checked)}
                    disabled={advisorLoading}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] rounded-full bg-white/[0.06] border border-white/[0.08] peer-checked:bg-violet-500/30 peer-checked:border-violet-500/40 transition-all" />
                  <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-gray-500 peer-checked:bg-violet-400 peer-checked:translate-x-[14px] transition-all" />
                </div>
                <span className="text-[10px] text-gray-500 peer-checked:text-violet-400 whitespace-nowrap">Repo context only</span>
              </label>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <AnimatePresence>
          {advisorLoading && advisorProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2 text-xs text-violet-400"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              {advisorProgress}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      {integrationAdvice && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Summary */}
          <div className="glass-card rounded-xl p-4 border border-violet-500/10">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Analysis Summary</div>
            <p className="text-sm text-gray-300 leading-relaxed">{integrationAdvice.summary}</p>
            {integrationAdvice.build_vs_buy_ratio && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Layers className="w-3 h-3 text-violet-400" />
                <span className="text-[11px] text-violet-300 font-medium">{integrationAdvice.build_vs_buy_ratio}</span>
              </div>
            )}
          </div>

          {/* Grouped suggestions */}
          {categoryOrder
            .filter((cat) => groupedByCategory[cat]?.length)
            .map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const items = groupedByCategory[cat];
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {config.label}s
                    </div>
                    <div className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                      {items.length}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {items.map((s) => (
                      <SuggestionCard key={s.id || s.library_name} suggestion={s} onIntegrate={handleIntegrate} />
                    ))}
                  </div>
                </div>
              );
            })}
        </motion.div>
      )}
    </div>
  );
}
