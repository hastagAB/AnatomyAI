import {
  Clock,
  AlertTriangle,
  Lightbulb,
  Users,
  ChevronRight,
  Circle,
  Loader2,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { motion } from 'framer-motion';


export function PlanView() {
  const { plan, analysis, generatingPlan, openEvolveWithContext } = useStore();
  const { generatePlan } = useProject();

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
            <Lightbulb className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">Run analysis first to generate a build plan</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={generatePlan}
          disabled={generatingPlan}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-400 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          {generatingPlan ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Plan...
            </>
          ) : (
            <>
              <Lightbulb className="w-5 h-5" />
              Generate Build Plan
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-indigo-500/[0.08] via-purple-500/[0.06] to-transparent border border-indigo-500/15 rounded-2xl p-6 mb-6 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Build Plan</h2>
            <button
              onClick={() => openEvolveWithContext('I want to update the build plan: ')}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all border border-amber-500/20"
            >
              <Zap className="w-3 h-3" />
              Evolve
            </button>
          </div>
          <p className="text-sm text-gray-300/90 leading-relaxed">{plan.summary}</p>
        </div>
      </motion.div>

      <div className="space-y-6 mb-8">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          Phases & Tasks
        </h3>
        {plan.phases.map((phase, pi) => (
          <motion.div
            key={pi}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: pi * 0.1 }}
            className="glass-card rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-black/20 transition-shadow"
          >
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.04]">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600"
              >
                {pi + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{String(phase.name)}</div>
                <div className="text-xs text-gray-500">{String(phase.description)}</div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {plan.tasks
                .filter((t) => t.phase_id === phase.id)
                .map((task, ti) => (
                  <div key={ti} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <Circle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{String(task.name)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{String(task.description)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        ))}
      </div>

      {plan.risks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Risks
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {plan.risks.map((risk, i) => (
              <div key={i} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <div className="text-sm text-white mb-1">{String(risk.description)}</div>
                {risk.mitigation ? (
                  <div className="text-xs text-emerald-400 mt-2">
                    <ChevronRight className="w-3 h-3 inline" /> {String(risk.mitigation)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.tech_recommendations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
            Tech Recommendations
          </h3>
          <div className="space-y-3">
            {plan.tech_recommendations.map((rec, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {String(rec.area)}
                </span>
                <div className="text-sm text-white mt-2">{String(rec.recommendation)}</div>
                <div className="text-xs text-gray-500 mt-1">{String(rec.rationale)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.gaps.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Blocking Gaps
          </h3>
          <div className="space-y-2">
            {plan.gaps.map((gap, i) => (
              <div key={i} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                <span className="text-xs font-medium text-red-400">{String(gap.area)}</span>
                <div className="text-xs text-gray-400 mt-1">{String(gap.description)}</div>
                {gap.suggestion ? (
                  <div className="text-xs text-indigo-400 mt-1">Suggestion: {String(gap.suggestion)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.team_suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-purple-400" />
            Team Suggestions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plan.team_suggestions.map((team, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-sm font-medium text-white">{String(team.role)}</div>
                <div className="text-xs text-gray-500 mt-1">{String(team.responsibilities)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
