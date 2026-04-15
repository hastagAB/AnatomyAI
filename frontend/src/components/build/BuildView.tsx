import { useState } from 'react';
import {
  Hammer,
  Download,
  Loader2,
  FileCode,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { motion } from 'framer-motion';

function ArtifactTree({
  artifacts,
  onSelect,
  selected,
}: {
  artifacts: Record<string, string>;
  onSelect: (path: string) => void;
  selected: string | null;
}) {
  // Build a tree structure from flat paths
  const tree: Record<string, string[]> = {};
  Object.keys(artifacts)
    .sort()
    .forEach((path) => {
      const parts = path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(path);
    });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-1">
      {Object.entries(tree).map(([folder, files]) => (
        <div key={folder}>
          <button
            onClick={() => setCollapsed((prev) => ({ ...prev, [folder]: !prev[folder] }))}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            {collapsed[folder] ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <FolderTree className="w-3 h-3 text-indigo-400" />
            {folder}
          </button>
          {!collapsed[folder] &&
            files.map((path) => {
              const fileName = path.split('/').pop();
              return (
                <button
                  key={path}
                  onClick={() => onSelect(path)}
                  className={`w-full text-left pl-8 pr-2 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2 ${
                    selected === path
                      ? 'bg-indigo-500/10 text-indigo-300 border-l-2 border-indigo-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <FileCode className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{fileName}</span>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function ArtifactViewer({ content, path }: { content: string; path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ext = path.split('.').pop() || '';
  const isMarkdown = ext === 'md';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">{path}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {isMarkdown ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-xs text-gray-300 leading-relaxed font-mono bg-transparent p-0">
              {content}
            </pre>
          </div>
        ) : (
          <pre className="text-xs text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

export function BuildView() {
  const { analysis, plan, buildArtifacts, generatingArtifacts } = useStore();
  const { generateBuildArtifacts, downloadBuildArtifacts, generatePlan } = useProject();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { generatingPlan } = useStore();

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
            <Hammer className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">Run analysis first to generate build artifacts</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Generate Build Plan First</h2>
          <p className="text-sm text-gray-400 mb-6">
            A build plan is required before generating IDE artifacts. This takes about a minute.
          </p>
          <button
            onClick={generatePlan}
            disabled={generatingPlan}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-400 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto shadow-lg shadow-indigo-500/20"
          >
            {generatingPlan ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Generate Build Plan
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!buildArtifacts) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <Hammer className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Generate Build Artifacts</h2>
          <p className="text-sm text-gray-400 mb-2 leading-relaxed">
            Generate a complete set of IDE-ready artifacts for vibe coding:
          </p>
          <div className="grid grid-cols-2 gap-2 text-left mb-6 mx-auto max-w-md">
            {[
              'PRD & Requirements',
              'Technical Spec',
              'Implementation Plan',
              'Copilot Instructions',
              'Coding Standards',
              'API Design Guide',
              'Testing Strategy',
              'Security Guide',
              'Database Design',
              'Component Specs',
              'Scaffold Prompt',
              'Agent Config',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                {item}
              </div>
            ))}
          </div>
          <button
            onClick={generateBuildArtifacts}
            disabled={generatingArtifacts}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/20"
          >
            {generatingArtifacts ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Artifacts...
              </>
            ) : (
              <>
                <Hammer className="w-5 h-5" />
                Generate Build Artifacts
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const artifacts = buildArtifacts.artifacts;
  const paths = Object.keys(artifacts).sort();
  const currentContent = selectedPath ? artifacts[selectedPath] : null;

  return (
    <div className="flex-1 flex min-h-0">
      {/* File tree sidebar */}
      <div className="w-64 border-r border-white/[0.06] flex flex-col">
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Artifacts</span>
            </div>
            <span className="text-[10px] text-gray-500">{paths.length} files</span>
          </div>
          <button
            onClick={downloadBuildArtifacts}
            disabled={generatingArtifacts}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:from-emerald-500/30 hover:to-teal-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {generatingArtifacts ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Download ZIP
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <ArtifactTree
            artifacts={artifacts}
            onSelect={setSelectedPath}
            selected={selectedPath}
          />
        </div>
      </div>

      {/* Content viewer */}
      {currentContent && selectedPath ? (
        <ArtifactViewer content={currentContent} path={selectedPath} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <FileCode className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Select a file to preview</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
