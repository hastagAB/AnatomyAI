import { X, ArrowRightLeft, AlertTriangle, Database, Cpu, FileText, Layers as LayersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Component, DataFlow, AnalysisResult } from '../../types';

interface Props {
  component: Component;
  analysis: AnalysisResult;
  onClose: () => void;
}

export function ComponentDetail({ component, analysis, onClose }: Props) {
  // Derive related entities
  const flows = analysis.data_flows.filter(
    (f) => f.source_id === component.id || f.target_id === component.id || f.source === component.name || f.target === component.name,
  );
  const inbound = flows.filter((f) => f.target_id === component.id || f.target === component.name);
  const outbound = flows.filter((f) => f.source_id === component.id || f.source === component.name);

  const gaps = analysis.gaps.filter((g) => g.related_component_ids.includes(component.id));

  const tech = analysis.tech_stack.filter((t) => t.component_ids.includes(component.id));

  const models = analysis.data_models.filter(
    (m) =>
      (m.source_documents?.length > 0 && m.source_documents.some((s) => component.source_documents.includes(s))) ||
      m.entity.toLowerCase().includes(component.name.toLowerCase().split(' ')[0]),
  );

  const layer = analysis.layers.find((l) => l.components.includes(component.id) || l.name === component.layer);

  const nfrs = analysis.nonfunctional_requirements.filter((n) =>
    n.source_documents.some((s) => component.source_documents.includes(s)),
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-gray-900 border border-white/[0.08] rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-white/[0.06] px-6 py-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-blue-400">{component.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{component.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  {component.type}
                </span>
                {component.technology && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {component.technology}
                  </span>
                )}
                {layer && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <LayersIcon className="w-2.5 h-2.5" /> {layer.name}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-gray-500 hover:text-gray-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            {component.description && (
              <p className="text-sm text-gray-300 leading-relaxed">{component.description}</p>
            )}

            {/* Source Documents */}
            {component.source_documents.length > 0 && (
              <div>
                <SectionLabel icon={FileText} label="Source Documents" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {component.source_documents.map((doc, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/8 text-indigo-400 border border-indigo-500/15">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Data Flows */}
            {flows.length > 0 && (
              <div>
                <SectionLabel icon={ArrowRightLeft} label={`Data Flows (${flows.length})`} />
                <div className="space-y-1.5 mt-2">
                  {inbound.map((f, i) => (
                    <FlowRow key={`in-${i}`} flow={f} direction="inbound" componentName={component.name} />
                  ))}
                  {outbound.map((f, i) => (
                    <FlowRow key={`out-${i}`} flow={f} direction="outbound" componentName={component.name} />
                  ))}
                </div>
              </div>
            )}

            {/* Gaps */}
            {gaps.length > 0 && (
              <div>
                <SectionLabel icon={AlertTriangle} label={`Related Gaps (${gaps.length})`} />
                <div className="space-y-1.5 mt-2">
                  {gaps.map((g, i) => (
                    <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="text-xs font-medium text-red-400">{g.area}</span>
                        <SeverityBadge severity={g.severity} />
                      </div>
                      <p className="text-xs text-gray-400">{g.description}</p>
                      {g.suggestion && <p className="text-xs text-indigo-400 mt-1">Suggestion: {g.suggestion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Stack */}
            {tech.length > 0 && (
              <div>
                <SectionLabel icon={Cpu} label={`Technology (${tech.length})`} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {tech.map((t, i) => (
                    <div key={i} className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
                      <span className="text-cyan-400 font-medium">{t.technology}</span>
                      {t.purpose && <span className="text-gray-500 ml-1.5">— {t.purpose}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Models */}
            {models.length > 0 && (
              <div>
                <SectionLabel icon={Database} label={`Data Models (${models.length})`} />
                <div className="space-y-2 mt-2">
                  {models.map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="text-sm font-medium text-emerald-400">{m.entity}</div>
                      {m.attributes.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {m.attributes.map((a) => a.name).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NFRs */}
            {nfrs.length > 0 && (
              <div>
                <SectionLabel icon={AlertTriangle} label={`Non-Functional Requirements (${nfrs.length})`} />
                <div className="space-y-1.5 mt-2">
                  {nfrs.map((n, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-pink-500/5 border border-pink-500/10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">{n.category}</span>
                        <span className="text-[10px] text-gray-500">{n.priority}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{n.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Helpers ─────────────────────────────────────── */

function SectionLabel({ icon: Icon, label }: { icon: typeof ArrowRightLeft; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
  );
}

function FlowRow({ flow, direction, componentName }: { flow: DataFlow; direction: 'inbound' | 'outbound'; componentName: string }) {
  const peer = direction === 'inbound' ? flow.source : flow.target;
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
      {direction === 'inbound' ? (
        <>
          <span className="text-xs text-purple-400 font-medium">{peer}</span>
          <span className="text-gray-600">→</span>
          <span className="text-xs text-white font-medium">{componentName}</span>
        </>
      ) : (
        <>
          <span className="text-xs text-white font-medium">{componentName}</span>
          <span className="text-gray-600">→</span>
          <span className="text-xs text-purple-400 font-medium">{peer}</span>
        </>
      )}
      {flow.protocol && <span className="text-[10px] text-gray-500 ml-auto px-1.5 py-0.5 bg-white/[0.03] rounded">{flow.protocol}</span>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/20',
    major: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    minor: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ml-auto ${colors[severity] ?? colors.minor}`}>
      {severity}
    </span>
  );
}
