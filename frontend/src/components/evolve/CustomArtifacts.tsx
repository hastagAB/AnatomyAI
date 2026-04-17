import { useState, useRef, useEffect } from 'react';
import {
  FileSearch,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Trash2,
  Clock,
  Plus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store/useStore';

interface Artifact {
  id: string;
  title: string;
  prompt: string;
  content: string;
  createdAt: number;
}

const PRESET_PROMPTS = [
  {
    title: 'Framework & OSS Audit',
    prompt:
      'Analyze all frameworks, libraries, and open-source projects used in this architecture. For each one: what it does, why it was chosen, its maturity level, license type, and any risks. Present as a summary table.',
  },
  {
    title: 'Build vs Buy Analysis',
    prompt:
      'For each custom-built component in this architecture, analyze whether we should build it ourselves or use an open-source/commercial alternative. Consider: development effort, maintenance cost, feature parity, community support, and time-to-ship. Give a clear recommendation for each.',
  },
  {
    title: 'Security Posture Review',
    prompt:
      'Review the security posture of this architecture. Identify: authentication/authorization gaps, data encryption at rest and in transit, API security, dependency vulnerabilities, secrets management, and compliance considerations. Rate overall security maturity.',
  },
  {
    title: 'Scalability Assessment',
    prompt:
      'Assess the scalability characteristics of this architecture. Identify bottlenecks, single points of failure, and components that won\'t scale horizontally. Recommend specific changes with effort estimates.',
  },
  {
    title: 'Cost Optimization',
    prompt:
      'Analyze the infrastructure and technology choices for cost optimization opportunities. Consider: over-provisioned resources, expensive managed services that could be replaced, licensing costs, and operational overhead. Estimate potential savings.',
  },
  {
    title: 'Tech Debt Inventory',
    prompt:
      'Identify all forms of technical debt in this architecture: deprecated technologies, missing abstractions, tight coupling, lack of observability, missing tests, and documentation gaps. Prioritize by business impact and effort to fix.',
  },
];

export function CustomArtifacts() {
  const { projectId, analysis } = useStore();
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    const saved = localStorage.getItem('anatomy_artifacts');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Persist artifacts
  useEffect(() => {
    localStorage.setItem('anatomy_artifacts', JSON.stringify(artifacts));
  }, [artifacts]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (contentRef.current && generating) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  const handleGenerate = async () => {
    if (!projectId || !prompt.trim()) return;

    setGenerating(true);
    setStreamContent('');
    setActiveArtifact(null);

    try {
      const res = await fetch('http://localhost:8000/api/artifacts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          prompt: prompt.trim(),
          title: title.trim() || prompt.trim().slice(0, 60),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Generation failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') && !line.startsWith('data:')) continue;
          const jsonStr = line.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'chunk') {
              fullContent += event.content;
              setStreamContent(fullContent);
            } else if (event.type === 'complete') {
              const artifact: Artifact = {
                id: crypto.randomUUID(),
                title: event.title || title || prompt.slice(0, 60),
                prompt,
                content: event.content,
                createdAt: Date.now(),
              };
              setArtifacts((prev) => [artifact, ...prev]);
              setActiveArtifact(artifact);
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      console.error('Artifact generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreset = (preset: { title: string; prompt: string }) => {
    setTitle(preset.title);
    setPrompt(preset.prompt);
  };

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    if (activeArtifact?.id === id) {
      setActiveArtifact(null);
      setStreamContent('');
    }
  };

  const displayContent = activeArtifact?.content || streamContent;

  return (
    <div className="space-y-4">
      {/* Preset prompts */}
      <div>
        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
          Quick Analysis Presets
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_PROMPTS.map((preset) => (
            <button
              key={preset.title}
              onClick={() => handlePreset(preset)}
              disabled={generating}
              className="text-left px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/20 transition-all text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
            >
              <span className="font-medium text-gray-300">{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
          Your Analysis Request
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/30 transition-colors"
          disabled={generating}
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything about your architecture...&#10;&#10;Examples:&#10;• What open-source projects should we adopt to ship faster?&#10;• Summarize all frameworks and their purposes&#10;• Compare our tech choices against industry best practices&#10;• What components can we replace with managed services?"
          rows={4}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/30 focus:bg-white/[0.04] transition-all resize-none"
          disabled={generating}
        />
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || !analysis || generating}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Analysis
            </>
          )}
        </button>
      </div>

      {/* Generated content */}
      {displayContent && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-gray-300">
                {activeArtifact?.title || title || 'Analysis Result'}
              </span>
              {generating && (
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  streaming...
                </span>
              )}
            </div>
            <button
              onClick={() => handleCopy(displayContent)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div
            ref={contentRef}
            className="p-5 max-h-[500px] overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-400 prose-li:text-gray-400 prose-strong:text-gray-200 prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1 prose-code:rounded prose-table:text-gray-400 prose-th:text-gray-300 prose-th:border-white/10 prose-td:border-white/10"
          >
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Saved artifacts list */}
      {artifacts.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Saved Analyses ({artifacts.length})</span>
            <button
              onClick={() => {
                setActiveArtifact(null);
                setStreamContent('');
                setPrompt('');
                setTitle('');
              }}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors normal-case tracking-normal font-medium"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
          <div className="space-y-1">
            {artifacts.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  activeArtifact?.id === a.id
                    ? 'border-indigo-500/20 bg-indigo-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveArtifact(a);
                    setStreamContent('');
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-medium text-gray-300 truncate">{a.title}</div>
                  <div className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(a.createdAt).toLocaleDateString()} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
