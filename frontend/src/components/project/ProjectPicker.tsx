import { useEffect, useState, useRef } from 'react';
import { Plus, FolderOpen, BarChart3, FileText, Sparkles, ArrowRight, Upload } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import { useStore } from '../../store/useStore';

interface Project {
  id: string;
  name: string;
  document_count: number;
  has_analysis: boolean;
  created_at: number;
}

interface ProjectPickerProps {
  onClose: () => void;
}

export function ProjectPicker({ onClose }: ProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const { createProject, loadProject, listProjects, importProject } = useProject();
  const { projectId } = useStore();
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    listProjects()
      .then((data) => {
        const sorted = data
          .filter((p) => p.document_count > 0 || p.has_analysis)
          .sort((a, b) => b.created_at - a.created_at);
        setProjects(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const name = newName.trim() || 'New Project';
    await createProject(name);
    setNewName('');
    onClose();
  };

  const handleSelect = async (id: string) => {
    await loadProject(id);
    onClose();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await importProject(file);
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/[0.07] rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/[0.05] rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/[0.03] rounded-full blur-3xl" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Hero branding */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-indigo-500/25 mb-5">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-extrabold tracking-tight gradient-text">Anatomy</h1>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-md">AI</span>
          </div>
          <p className="text-sm text-gray-500 max-w-sm">
            AI-powered architecture analysis. Upload your project documents, get instant insights, diagrams, and build plans.
          </p>
        </div>

        {/* New project card */}
        <div className="glass-card rounded-2xl p-5 mb-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Start New Project
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Enter project name..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.05] transition-all"
            />
            <button
              onClick={handleCreate}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:from-indigo-400 hover:to-purple-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".zip"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="px-4 py-2.5 rounded-xl border border-white/[0.06] text-gray-400 text-sm font-medium hover:bg-white/[0.03] hover:text-emerald-400 hover:border-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importing...' : 'Import Project (.zip)'}
            </button>
          </div>
        </div>

        {/* Project list */}
        {loading ? (
          <div className="text-gray-600 text-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <span className="text-sm">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-sm text-gray-600">No projects yet. Create one above to get started.</p>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Recent Projects
            </div>
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={`group w-full text-left px-5 py-4 rounded-xl border transition-all ${
                    p.id === projectId
                      ? 'bg-indigo-500/[0.08] border-indigo-500/25 text-white ring-1 ring-indigo-500/20'
                      : 'bg-white/[0.015] border-white/[0.05] text-gray-300 hover:bg-white/[0.04] hover:border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        p.has_analysis
                          ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20'
                          : 'bg-white/[0.04]'
                      }`}>
                        {p.has_analysis ? (
                          <BarChart3 className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <FolderOpen className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-sm">{p.name}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {p.document_count} docs
                          </span>
                          {p.has_analysis && (
                            <span className="flex items-center gap-1 text-emerald-500/80">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Analyzed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">{formatDate(p.created_at)}</span>
                      <ArrowRight className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Back to current project */}
        {projectId && (
          <div className="text-center mt-8">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              Back to current project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
