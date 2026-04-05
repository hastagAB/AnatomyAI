import {
  Box,
  ArrowRightLeft,
  Database,
  Layers,
  Cpu,
  Shield,
  AlertTriangle,
  BarChart3,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
  Activity,
  Search,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ComponentDetail } from './ComponentDetail';
import type { ValidationReport, QualityReport, Component, Gap } from '../../types';

interface SectionProps<T> {
  title: string;
  icon: typeof Box;
  color: string;
  items: T[];
  renderItem: (item: T, i: number) => React.ReactNode;
}

function Section<T>({ title, icon: Icon, color, items, renderItem }: SectionProps<T>) {
  if (!items.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 hover:shadow-lg hover:shadow-black/20 transition-shadow"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <span className="text-[10px] font-bold text-gray-600 bg-white/[0.03] px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="space-y-2">{items.map((item, i) => renderItem(item, i))}</div>
    </motion.div>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="68" height="68" className="transform -rotate-90">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
        <circle cx="34" cy="34" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute mt-4 text-base font-bold text-white">{score}</div>
      <div className="text-[10px] text-gray-500 font-medium">{label}</div>
    </div>
  );
}

function ValidationPanel({ report }: { report: ValidationReport }) {
  const scoreColor = report.score >= 80 ? '#10b981' : report.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 border border-white/[0.04]"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Structural Validation</h3>
          <p className="text-[10px] text-gray-500">{report.errors.length} errors, {report.warnings.length} warnings</p>
        </div>
        <div className="text-lg font-bold" style={{ color: scoreColor }}>{report.score}</div>
      </div>
      {report.errors.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {report.errors.slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
              <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-mono text-red-400/70">{e.code}</span>
                <p className="text-xs text-gray-400">{e.message}</p>
              </div>
            </div>
          ))}
          {report.errors.length > 8 && (
            <p className="text-[10px] text-gray-600 pl-6">+{report.errors.length - 8} more errors</p>
          )}
        </div>
      )}
      {report.warnings.length > 0 && (
        <div className="space-y-1.5">
          {report.warnings.slice(0, 5).map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-mono text-amber-400/70">{w.code}</span>
                <p className="text-xs text-gray-400">{w.message}</p>
              </div>
            </div>
          ))}
          {report.warnings.length > 5 && (
            <p className="text-[10px] text-gray-600 pl-6">+{report.warnings.length - 5} more warnings</p>
          )}
        </div>
      )}
      {report.errors.length === 0 && report.warnings.length === 0 && (
        <p className="text-xs text-emerald-400/80 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> No structural issues found</p>
      )}
    </motion.div>
  );
}

function QualityPanel({ report }: { report: QualityReport }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 border border-white/[0.04]"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10">
          <Activity className="w-4.5 h-4.5 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Quality Gate</h3>
        </div>
      </div>
      <div className="flex justify-around mb-4 relative">
        <ScoreRing score={report.completeness_score} label="Complete" color="#3b82f6" />
        <ScoreRing score={report.consistency_score} label="Consistent" color="#a855f7" />
        <ScoreRing score={report.specificity_score} label="Specific" color="#10b981" />
        <ScoreRing score={report.overall_score} label="Overall" color="#f59e0b" />
      </div>
      {report.summary && (
        <p className="text-xs text-gray-400 leading-relaxed mb-3">{report.summary}</p>
      )}
      {report.hallucination_flags.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5">Hallucination Flags</div>
          <div className="space-y-1">
            {report.hallucination_flags.map((f, i) => (
              <div key={i} className="text-xs text-red-400/80 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      )}
      {report.recommendations.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Recommendations</div>
          <div className="space-y-1">
            {report.recommendations.slice(0, 5).map((r, i) => (
              <div key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" /> {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function AnalysisDashboard() {
  const { analysis, openEvolveWithContext } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  // Derive unique types/severities for filter dropdowns
  const componentTypes = useMemo(() => {
    if (!analysis) return [];
    return [...new Set(analysis.components.map((c) => c.type))].sort();
  }, [analysis]);

  const gapSeverities = useMemo(() => {
    if (!analysis) return [];
    return [...new Set(analysis.gaps.map((g) => g.severity))].sort();
  }, [analysis]);

  // Filter components
  const filteredComponents = useMemo(() => {
    if (!analysis) return [];
    return analysis.components.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.technology.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [analysis, searchQuery, typeFilter]);

  // Filter gaps
  const filteredGaps = useMemo(() => {
    if (!analysis) return [];
    return analysis.gaps.filter((g) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || g.area.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
      const matchesSeverity = severityFilter === 'all' || g.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [analysis, searchQuery, severityFilter]);

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">Upload documents and run analysis first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-indigo-500/[0.08] via-purple-500/[0.06] to-transparent border border-indigo-500/15 rounded-2xl p-6 mb-6 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Analysis Summary</h2>
          </div>
          <p className="text-sm text-gray-300/90 leading-relaxed">{analysis.summary}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="text-xs text-gray-500">
              <span className="text-indigo-400 font-semibold">{analysis.components.length}</span> components
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-purple-400 font-semibold">{analysis.data_flows.length}</span> data flows
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-emerald-400 font-semibold">{analysis.data_models.length}</span> data models
            </div>
            {analysis.gaps.length > 0 && (
              <div className="text-xs text-gray-500">
                <span className="text-red-400 font-semibold">{analysis.gaps.length}</span> gaps
              </div>
            )}
            <button
              onClick={() => openEvolveWithContext('I want to update the analysis: ')}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
            >
              <Zap className="w-3 h-3" />
              Evolve
            </button>
          </div>
        </div>
      </motion.div>

      {/* Validation & Quality */}
      {(analysis.validation || analysis.quality) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {analysis.validation && <ValidationPanel report={analysis.validation} />}
          {analysis.quality && <QualityPanel report={analysis.quality} />}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components, gaps, tech..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] text-xs text-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500/30"
          >
            <option value="all">All types</option>
            {componentTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {analysis.gaps.length > 0 && (
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.06] text-xs text-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500/30"
            >
              <option value="all">All severities</option>
              {gapSeverities.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title={`Components${filteredComponents.length !== analysis.components.length ? ` (${filteredComponents.length}/${analysis.components.length})` : ''}`}
          icon={Box}
          color="#3b82f6"
          items={filteredComponents}
          renderItem={(item: Component, i: number) => (
            <button
              key={i}
              onClick={() => setSelectedComponent(item)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all group cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{item.name}</div>
                <div className="text-xs text-gray-400">{item.type} {item.technology ? `| ${item.technology}` : ''}</div>
                {item.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</div>}
                {item.source_documents.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.source_documents.slice(0, 3).map((doc, j) => (
                      <span key={j} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/8 text-indigo-400/70 border border-indigo-500/10">
                        <FileText className="w-2 h-2" />
                        {doc.length > 25 ? doc.slice(0, 25) + '…' : doc}
                      </span>
                    ))}
                    {item.source_documents.length > 3 && (
                      <span className="text-[9px] text-gray-600">+{item.source_documents.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          )}
        />

        <Section
          title="Data Flows"
          icon={ArrowRightLeft}
          color="#a855f7"
          items={analysis.data_flows}
          renderItem={(item, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <span className="text-xs font-medium text-purple-400">{String(item.source)}</span>
              <ArrowRightLeft className="w-3 h-3 text-gray-500" />
              <span className="text-xs font-medium text-purple-400">{String(item.target)}</span>
              {item.protocol ? <span className="text-[10px] text-gray-500 ml-auto">{String(item.protocol)}</span> : null}
            </div>
          )}
        />

        <Section
          title="Data Models"
          icon={Database}
          color="#10b981"
          items={analysis.data_models}
          renderItem={(item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="text-sm font-medium text-emerald-400">{String(item.entity)}</div>
              {Array.isArray(item.attributes) && (
                <div className="text-xs text-gray-500 mt-1">
                  {(item.attributes as Array<{name: string}>).map((a) => a.name).join(', ')}
                </div>
              )}
            </div>
          )}
        />

        <Section
          title="Layers"
          icon={Layers}
          color="#f59e0b"
          items={analysis.layers}
          renderItem={(item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="text-sm font-medium text-amber-400">{String(item.name)}</div>
              <div className="text-xs text-gray-500 mt-1">{String(item.description)}</div>
            </div>
          )}
        />

        <Section
          title="Tech Stack"
          icon={Cpu}
          color="#06b6d4"
          items={analysis.tech_stack}
          renderItem={(item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {String(item.category)}
              </span>
              <span className="text-sm text-white">{String(item.technology)}</span>
              <span className="text-xs text-gray-500 ml-auto">{String(item.purpose)}</span>
            </div>
          )}
        />

        <Section
          title="Non-Functional Requirements"
          icon={Shield}
          color="#ec4899"
          items={analysis.nonfunctional_requirements}
          renderItem={(item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  {String(item.category)}
                </span>
                <span className="text-[10px] text-gray-500">{String(item.priority)} priority</span>
              </div>
              <div className="text-xs text-gray-400 mt-1.5">{String(item.description)}</div>
            </div>
          )}
        />

        {filteredGaps.length > 0 && (
          <Section
            title={`Gaps & Ambiguities${filteredGaps.length !== analysis.gaps.length ? ` (${filteredGaps.length}/${analysis.gaps.length})` : ''}`}
            icon={AlertTriangle}
            color="#f43f5e"
            items={filteredGaps}
            renderItem={(item: Gap, i: number) => (
              <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-xs font-medium text-red-400">{item.area}</span>
                  <span className={`text-[10px] ml-auto px-1.5 py-0.5 rounded-full border ${
                    item.severity === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                    item.severity === 'major' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                    'bg-gray-500/15 text-gray-400 border-gray-500/20'
                  }`}>{item.severity}</span>
                </div>
                <div className="text-xs text-gray-400">{item.description}</div>
                {item.suggestion && (
                  <div className="text-xs text-indigo-400 mt-1.5">Suggestion: {item.suggestion}</div>
                )}
                {item.source_documents.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.source_documents.slice(0, 2).map((doc, j) => (
                      <span key={j} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/8 text-indigo-400/70 border border-indigo-500/10">
                        <FileText className="w-2 h-2" /> {doc.length > 25 ? doc.slice(0, 25) + '…' : doc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          />
        )}
      </div>

      {/* Component drill-down modal */}
      <AnimatePresence>
        {selectedComponent && (
          <ComponentDetail
            component={selectedComponent}
            analysis={analysis}
            onClose={() => setSelectedComponent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
