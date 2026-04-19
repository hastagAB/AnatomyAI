import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Brain,
  Wrench,
  PauseCircle,
  ArrowRight,
  SkipForward,
  RotateCcw,
  Sparkles,
  Clock,
  Target,
  Zap,
  PackageOpen,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useOrchestrator } from '../../hooks/useOrchestrator';
import type { OrchestratorEvent, CheckpointData } from '../../types';

/* ── Event Timeline Item ───────────────────────────── */

function TimelineItem({ event, index }: { event: OrchestratorEvent; index: number }) {
  const icon = () => {
    switch (event.type) {
      case 'thinking':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'tool_start':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'tool_result':
        return event.error
          ? <AlertCircle className="w-4 h-4 text-red-400" />
          : <Wrench className="w-4 h-4 text-emerald-400" />;
      case 'checkpoint':
        return <PauseCircle className="w-4 h-4 text-amber-400" />;
      case 'checkpoint_resumed':
        return <ArrowRight className="w-4 h-4 text-green-400" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-gray-400" />;
    }
  };

  const label = () => {
    switch (event.type) {
      case 'thinking':
        return event.thinking ? `Thinking: ${(event.thinking as string).slice(0, 120)}...` : 'Thinking...';
      case 'tool_start':
        return `Running: ${formatToolName(event.tool || '')}`;
      case 'tool_result':
        return `${formatToolName(event.tool || '')} ${event.error ? 'failed' : 'completed'}${event.duration ? ` (${(event.duration as number).toFixed(1)}s)` : ''}`;
      case 'checkpoint':
        return `Checkpoint: ${formatPhase(event.phase || '')}`;
      case 'checkpoint_resumed':
        return `Resumed: ${event.action || 'continue'}`;
      case 'complete':
        return event.message || 'Pipeline complete';
      case 'error':
        return `Error: ${event.message || 'Unknown error'}`;
      case 'cancelled':
        return 'Orchestration cancelled';
      default:
        return event.type;
    }
  };

  const bgClass = event.type === 'checkpoint'
    ? 'bg-amber-500/[0.08] border-amber-500/20'
    : event.type === 'error'
      ? 'bg-red-500/[0.08] border-red-500/20'
      : event.type === 'complete'
        ? 'bg-emerald-500/[0.08] border-emerald-500/20'
        : 'bg-white/[0.02] border-white/[0.06]';

  return (
    <div className="flex gap-3 items-start">
      {/* Timeline dot + connector */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center flex-shrink-0">
          {icon()}
        </div>
        <div className="w-px flex-1 bg-white/[0.06] min-h-[8px]" />
      </div>

      {/* Content */}
      <div className={`flex-1 rounded-xl border px-4 py-3 mb-2 ${bgClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600">#{index + 1}</span>
          <span className="text-sm text-gray-300">{label()}</span>
        </div>
        {event.type === 'tool_result' && event.result && !event.error && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{(event.result as string).slice(0, 200)}</p>
        )}
      </div>
    </div>
  );
}

/* ── Checkpoint Panel ──────────────────────────────── */

function CheckpointPanel({ checkpoint, onResume }: {
  checkpoint: CheckpointData;
  onResume: (action: string, data?: Record<string, unknown>) => void;
}) {
  const phaseLabel = formatPhase(checkpoint.phase);

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.04] p-5">
      <div className="flex items-center gap-2 mb-3">
        <PauseCircle className="w-5 h-5 text-amber-400" />
        <h3 className="text-base font-semibold text-amber-300">Checkpoint: {phaseLabel}</h3>
      </div>

      {checkpoint.summary && (
        <p className="text-sm text-gray-400 mb-4">{checkpoint.summary}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onResume('continue')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> Continue
        </button>
        <button
          onClick={() => onResume('skip')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium transition-colors"
        >
          <SkipForward className="w-4 h-4" /> Skip
        </button>
        <button
          onClick={() => onResume('revise')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Revise
        </button>
      </div>
    </div>
  );
}

/* ── Main AutopilotView ────────────────────────────── */

export function AutopilotView() {
  const { orchestratorRunning, orchestratorEvents, orchestratorCheckpoint } = useStore();
  const { start, resume, cancel } = useOrchestrator();
  const [goal, setGoal] = useState('');
  const [targetScore, setTargetScore] = useState(80);
  const [selectedPreset, setSelectedPreset] = useState<string | null>('converge');
  const scrollRef = useRef<HTMLDivElement>(null);

  const presets = [
    {
      id: 'converge',
      label: 'Converge to Readiness',
      icon: <Target className="w-4 h-4" />,
      description: 'Resolve all gaps and reach target readiness score in one deterministic pass. No looping.',
      buildGoal: (score: number) =>
        `Run validation, then use converge_to_readiness with target_score=${score} to resolve all gaps in one pass. ` +
        `After convergence, call optimize_oss_stack to discover and apply open-source accelerators. ` +
        `Then show me the results. Generate the plan and build artifacts. ` +
        `Do NOT loop — each tool should be called exactly once.`,
    },
    {
      id: 'full',
      label: 'Full Pipeline + OSS',
      icon: <Zap className="w-4 h-4" />,
      description: 'End-to-end: analyze → validate → converge → OSS optimize → plan → artifacts.',
      buildGoal: (score: number) =>
        `Run the full pipeline end-to-end. Analyze documents, validate, then use converge_to_readiness with target_score=${score}. ` +
        `After convergence, call optimize_oss_stack to discover and apply compatible open-source libraries. ` +
        `Then generate the plan and all build artifacts. Pause at key checkpoints for my review.`,
    },
    {
      id: 'oss',
      label: 'OSS Accelerate Only',
      icon: <PackageOpen className="w-4 h-4" />,
      description: 'Scan architecture for open-source reuse opportunities and apply compatible libraries.',
      buildGoal: () =>
        `Call optimize_oss_stack to analyze the current architecture and discover open-source libraries ` +
        `that can replace custom components, fill gaps, or accelerate development. ` +
        `Auto-apply high-confidence suggestions (compatibility ≥ 75%). Show me the results.`,
    },
    {
      id: 'custom',
      label: 'Custom Goal',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Write your own goal for the autopilot.',
      buildGoal: () => goal,
    },
  ];

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [orchestratorEvents.length]);

  const handleStart = () => {
    const preset = presets.find((p) => p.id === selectedPreset);
    const resolvedGoal = preset ? preset.buildGoal(targetScore) : goal || undefined;
    start(resolvedGoal || undefined);
  };

  const handleResume = (action: string, data?: Record<string, unknown>) => {
    resume(action, data);
  };

  const hasEvents = orchestratorEvents.length > 0;
  const isComplete = orchestratorEvents.some(
    (e) => e.type === 'complete' || e.type === 'error' || e.type === 'cancelled',
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Autopilot
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            End-to-end analysis pipeline with human checkpoints
          </p>
        </div>

        {orchestratorRunning && (
          <button
            onClick={cancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            <Square className="w-4 h-4" /> Cancel
          </button>
        )}
      </div>

      {/* Goal input + start */}
      {!orchestratorRunning && !hasEvents && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6">
          {/* Preset selector */}
          <label className="block text-sm font-medium text-gray-400 mb-3">
            Pipeline Mode
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-all ${
                  selectedPreset === preset.id
                    ? 'border-indigo-500/40 bg-indigo-500/[0.08] ring-1 ring-indigo-500/20'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={selectedPreset === preset.id ? 'text-indigo-400' : 'text-gray-500'}>
                    {preset.icon}
                  </span>
                  <span className={`text-sm font-medium ${selectedPreset === preset.id ? 'text-indigo-300' : 'text-gray-300'}`}>
                    {preset.label}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 leading-snug">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>

          {/* Target score slider — shown for converge & full presets */}
          {selectedPreset && selectedPreset !== 'custom' && selectedPreset !== 'oss' && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">
                  Target Readiness Score
                </label>
                <span className="text-lg font-bold text-indigo-400 tabular-nums">{targetScore}</span>
              </div>
              <input
                type="range"
                min={60}
                max={95}
                step={5}
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>60 (Fast)</span>
                <span>75</span>
                <span>80 (Recommended)</span>
                <span>90</span>
                <span>95 (Thorough)</span>
              </div>
            </div>
          )}

          {/* Custom goal textarea — only shown for custom preset */}
          {selectedPreset === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Goal
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Analyze all documents, resolve clarifications automatically, then generate the implementation plan."
                className="w-full rounded-xl bg-gray-900/50 border border-white/[0.08] text-sm text-gray-300 placeholder-gray-600 px-4 py-3 resize-none focus:outline-none focus:border-indigo-500/30 transition-colors"
                rows={3}
              />
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={selectedPreset === 'custom' && !goal.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Play className="w-4 h-4" /> Start Autopilot
          </button>
        </div>
      )}

      {/* Re-run after completion */}
      {!orchestratorRunning && isComplete && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              setGoal('');
              handleStart();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Run Again
          </button>
        </div>
      )}

      {/* Running indicator */}
      {orchestratorRunning && !orchestratorCheckpoint && (
        <div className="flex items-center gap-2 text-sm text-indigo-400 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Pipeline running...</span>
        </div>
      )}

      {/* Checkpoint panel */}
      {orchestratorCheckpoint && (
        <div className="mb-4">
          <CheckpointPanel checkpoint={orchestratorCheckpoint} onResume={handleResume} />
        </div>
      )}

      {/* Event timeline */}
      {hasEvents && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="flex flex-col">
            {orchestratorEvents.map((event, i) => (
              <TimelineItem key={i} event={event} index={i} />
            ))}
          </div>

          {/* Stats at bottom */}
          {isComplete && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5" />
                  {orchestratorEvents.filter((e) => e.type === 'tool_result' && !e.error).length} tools executed
                </span>
                <span className="flex items-center gap-1">
                  <PauseCircle className="w-3.5 h-3.5" />
                  {orchestratorEvents.filter((e) => e.type === 'checkpoint').length} checkpoints
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {orchestratorEvents
                    .filter((e) => e.type === 'tool_result' && typeof e.duration === 'number')
                    .reduce((sum, e) => sum + (e.duration as number), 0)
                    .toFixed(1)}s total tool time
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasEvents && !orchestratorRunning && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-600">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Set a goal and start the autopilot to run the full analysis pipeline.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────── */

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    analysis_review: 'Analysis Review',
    clarify_human: 'Human Clarification',
    plan_review: 'Plan Review',
    quality_gate: 'Quality Gate',
  };
  return labels[phase] || phase;
}
