import { useState } from 'react';
import {
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  ChevronDown,
  ChevronRight,
  Gauge,
  Send,
  Wand2,
  Lightbulb,
  Code2,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Hammer,
  Rocket,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { motion, AnimatePresence } from 'framer-motion';
import type { Clarification } from '../../types';

const severityColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  blocker: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', glow: 'shadow-red-500/5' },
  critical: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', glow: 'shadow-orange-500/5' },
  important: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/5' },
  'nice-to-have': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', glow: 'shadow-blue-500/5' },
};

function ClarificationCard({
  item,
  answer,
  rationale,
  onAnswer,
  expanded,
  onToggle,
  onAutoResolve,
  autoResolving,
}: {
  item: Clarification;
  answer: string;
  rationale: string;
  onAnswer: (val: string) => void;
  expanded: boolean;
  onToggle: () => void;
  onAutoResolve: () => void;
  autoResolving: boolean;
}) {
  const colors = severityColors[item.severity] || severityColors.important;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${colors.border} overflow-hidden shadow-lg ${colors.glow}`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {item.severity}
            </span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">{item.area}</span>
            {item.auto_resolvable && !answer && (
              <span className="text-[10px] text-emerald-500/80 uppercase tracking-wider flex items-center gap-0.5">
                <Wand2 className="w-2.5 h-2.5" /> auto-resolvable
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-white">{item.title}</div>
        </div>
        {answer ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        ) : null}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3 ml-7">
              <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>

              {/* Question */}
              <div className={`p-3 rounded-lg ${colors.bg}`}>
                <div className="text-xs font-medium text-gray-300 mb-1">Question:</div>
                <div className={`text-sm ${colors.text}`}>{item.question}</div>
              </div>

              {/* Expert recommendation */}
              <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <div className="text-xs font-medium text-indigo-400 mb-1.5 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> Expert Recommendation
                </div>
                <div className="text-xs text-gray-300 leading-relaxed">{item.default_answer}</div>
                {item.expert_rationale && (
                  <div className="text-[11px] text-gray-500 mt-2 italic border-t border-indigo-500/10 pt-2">
                    {item.expert_rationale}
                  </div>
                )}
              </div>

              {/* Implementation hint */}
              {item.implementation_hint && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1">
                    <Code2 className="w-3 h-3" /> Implementation Guidance
                  </div>
                  <div className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{item.implementation_hint}</div>
                </div>
              )}

              {/* Impact warning */}
              {item.impact && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Impact if unresolved
                  </div>
                  <div className="text-xs text-gray-400">{item.impact}</div>
                </div>
              )}

              {/* Related components */}
              {item.related_components?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.related_components.map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06]">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* AI auto-resolved rationale */}
              {rationale && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <div className="text-xs font-medium text-purple-400 mb-1 flex items-center gap-1">
                    <Wand2 className="w-3 h-3" /> AI Resolution Rationale
                  </div>
                  <div className="text-xs text-gray-400">{rationale}</div>
                </div>
              )}

              {/* Answer input */}
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1.5">
                  {answer ? 'Resolution:' : 'Your Answer:'}
                </div>
                <textarea
                  value={answer}
                  onChange={(e) => onAnswer(e.target.value)}
                  placeholder="Enter your answer or use the buttons below..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 resize-none"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  {!answer && (
                    <>
                      <button
                        onClick={() => onAnswer(item.default_answer)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors flex items-center gap-1"
                      >
                        <Lightbulb className="w-3 h-3" />
                        Use expert default
                      </button>
                      <button
                        onClick={onAutoResolve}
                        disabled={autoResolving}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {autoResolving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        AI resolve this
                      </button>
                    </>
                  )}
                  {answer && (
                    <button
                      onClick={() => onAnswer('')}
                      className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ClarifyView() {
  const { analysis, clarifyResult, clarifying, resolving, autoResolving, setCurrentView } = useStore();
  const { runClarify, resolveClarifications, autoResolveClarifications } = useProject();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [itemResolving, setItemResolving] = useState<string | null>(null);

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
            <HelpCircle className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">Run analysis first to identify gaps</p>
        </div>
      </div>
    );
  }

  if (!clarifyResult) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Pre-Build Clarification</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Before building, Anatomy will identify every gap, ambiguity, and undefined behavior in your architecture.
            Resolve them all — manually or let AI auto-resolve with expert-level decisions.
          </p>
          <button
            onClick={runClarify}
            disabled={clarifying}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto shadow-lg shadow-amber-500/20"
          >
            {clarifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Gaps...
              </>
            ) : (
              <>
                <HelpCircle className="w-5 h-5" />
                Run Clarification Check
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const items = clarifyResult.clarifications || [];
  const filtered = filter === 'all' ? items : items.filter((c) => c.severity === filter);
  const answeredCount = items.filter((c) => answers[c.id]).length;
  const unansweredItems = items.filter((c) => !answers[c.id]);

  const handleSubmit = async () => {
    const resolutions = items
      .filter((c) => answers[c.id])
      .map((c) => ({
        id: c.id,
        question: c.question,
        answer: answers[c.id],
      }));
    await resolveClarifications(resolutions);
    setAnswers({});
    setRationales({});
  };

  const acceptAllDefaults = () => {
    const newAnswers: Record<string, string> = { ...answers };
    items.forEach((c) => {
      if (!newAnswers[c.id]) {
        newAnswers[c.id] = c.default_answer;
      }
    });
    setAnswers(newAnswers);
  };

  const handleAutoResolveAll = async () => {
    const toResolve = unansweredItems.map((c) => ({
      id: c.id,
      title: c.title,
      question: c.question,
      area: c.area,
      severity: c.severity,
      default_answer: c.default_answer,
    }));
    const resolved = await autoResolveClarifications(toResolve);
    if (resolved) {
      const newAnswers: Record<string, string> = { ...answers };
      const newRationales: Record<string, string> = { ...rationales };
      resolved.forEach((r: { id: string; answer: string; rationale: string }) => {
        newAnswers[r.id] = r.answer;
        if (r.rationale) newRationales[r.id] = r.rationale;
      });
      setAnswers(newAnswers);
      setRationales(newRationales);
    }
  };

  const handleAutoResolveSingle = async (item: Clarification) => {
    setItemResolving(item.id);
    try {
      const resolved = await autoResolveClarifications([{
        id: item.id,
        title: item.title,
        question: item.question,
        area: item.area,
        severity: item.severity,
        default_answer: item.default_answer,
      }]);
      if (resolved && resolved.length > 0) {
        const r = resolved[0];
        setAnswers((prev) => ({ ...prev, [r.id]: r.answer }));
        if (r.rationale) {
          setRationales((prev) => ({ ...prev, [r.id]: r.rationale }));
        }
      }
    } finally {
      setItemResolving(null);
    }
  };

  // Prefer computed (deterministic) readiness over LLM-generated score
  const readinessScore = clarifyResult.computed_readiness ?? clarifyResult.readiness_score;
  const scoreColor =
    readinessScore >= 80 ? 'text-emerald-400' :
    readinessScore >= 50 ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Readiness header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-amber-500/[0.08] via-orange-500/[0.06] to-transparent border border-amber-500/15 rounded-2xl p-6 mb-6 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-500/5 to-transparent rounded-full blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Build Readiness</h2>
            </div>
            <p className="text-sm text-gray-300/90 leading-relaxed mb-3">{clarifyResult.readiness_summary}</p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-red-400">{clarifyResult.blockers_count} blockers</span>
              <span className="text-orange-400">{clarifyResult.critical_count} critical</span>
              <span className="text-gray-500">{items.length} total items</span>
              <span className="text-emerald-400">{answeredCount}/{items.length} resolved</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-black ${scoreColor}`}>{readinessScore}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Readiness</div>
          </div>
        </div>
      </motion.div>

      {/* Ready gate — show when architecture is ready to proceed */}
      {readinessScore >= 80 && clarifyResult.blockers_count === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.06] to-transparent border border-emerald-500/20 rounded-2xl p-5 mb-6 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-300">Architecture is Ready</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  No blockers remaining{clarifyResult.critical_count === 0 ? ' and no critical issues' : ''}.
                  {items.length > 0 ? ` ${items.length} optional items remain — you can safely proceed.` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('plan')}
                className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Go to Plan
              </button>
              <button
                onClick={() => setCurrentView('build')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Hammer className="w-3.5 h-3.5" />
                Go to Build
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Filters */}
        {['all', 'blocker', 'critical', 'important', 'nice-to-have'].map((f) => {
          const count = f === 'all' ? items.length : items.filter((c) => c.severity === f).length;
          if (count === 0 && f !== 'all') return null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
        <div className="flex-1" />

        {/* Bulk action buttons */}
        {unansweredItems.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={acceptAllDefaults}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 border border-indigo-500/15"
            >
              <Lightbulb className="w-3 h-3" />
              Accept all defaults
            </button>
            <button
              onClick={handleAutoResolveAll}
              disabled={autoResolving}
              className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 hover:from-purple-500/30 hover:to-fuchsia-500/30 transition-all flex items-center gap-1.5 border border-purple-500/20 disabled:opacity-50 shadow-lg shadow-purple-500/5"
            >
              {autoResolving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {autoResolving
                ? `AI resolving ${unansweredItems.length} items...`
                : `AI Auto-Resolve All (${unansweredItems.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Clarification cards */}
      <div className="space-y-2 mb-24">
        {filtered.map((item) => (
          <ClarificationCard
            key={item.id}
            item={item}
            answer={answers[item.id] || ''}
            rationale={rationales[item.id] || ''}
            onAnswer={(val) => setAnswers((prev) => ({ ...prev, [item.id]: val }))}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onAutoResolve={() => handleAutoResolveSingle(item)}
            autoResolving={itemResolving === item.id}
          />
        ))}
      </div>

      {/* Sticky bottom bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-64 right-0 bg-gray-950/90 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 z-20">
          <div className="flex items-center justify-between max-w-full">
            <div className="text-sm text-gray-400 flex items-center gap-3">
              {answeredCount === items.length ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  All {items.length} items resolved — ready to apply!
                </span>
              ) : (
                <span>{items.length - answeredCount} of {items.length} items remaining</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  runClarify();
                  setAnswers({});
                  setRationales({});
                }}
                disabled={clarifying}
                className="px-4 py-2.5 rounded-xl border border-white/[0.06] text-gray-400 text-xs font-medium hover:bg-white/[0.03] transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Re-check
              </button>
              <button
                onClick={handleSubmit}
                disabled={resolving || answeredCount === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {resolving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying to Architecture...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Apply {answeredCount} Resolutions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
