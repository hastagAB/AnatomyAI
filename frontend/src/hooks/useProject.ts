import axios from 'axios';
import { useStore } from '../store/useStore';
import type { DiagramType, ViewMode } from '../types';

const api = axios.create({ baseURL: '/api' });

export function useProject() {
  const store = useStore();

  const createProject = async (name: string) => {
    const { data } = await api.post('/projects', null, { params: { name } });
    store.setProjectId(data.id);
    store.setProjectName(data.name);
    localStorage.setItem('anatomy_project_id', data.id);
    return data;
  };

  const loadProject = async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}`);
    store.setProjectId(data.id);
    store.setProjectName(data.name);
    store.setDocuments(data.documents);
    if (data.analysis) {
      store.setAnalysis(data.analysis);
    }
    if (data.plan) {
      store.setPlan(data.plan);
    }
    // Hydrate all persisted diagrams into cache
    if (data.diagrams && Object.keys(data.diagrams).length > 0) {
      store.setDiagramCache(data.diagrams);
      // Load the first available diagram as current
      const firstType = Object.keys(data.diagrams)[0];
      store.setCurrentDiagramType(firstType as DiagramType);
      store.setCurrentDiagram(data.diagrams[firstType]);
    }
    // Hydrate chat history
    if (data.chat_messages && data.chat_messages.length > 0) {
      store.setChatMessages(data.chat_messages);
    }
    // Restore last view or pick best default
    const savedView = localStorage.getItem(`anatomy_view_${data.id}`);
    if (savedView) {
      store.setCurrentView(savedView as ViewMode);
    } else if (data.analysis) {
      store.setCurrentView('analysis');
    } else if (data.documents?.length > 0) {
      store.setCurrentView('upload');
    }
    localStorage.setItem('anatomy_project_id', data.id);
    return data;
  };

  const uploadFiles = async (files: File[]) => {
    if (!store.projectId) return;
    store.setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const { data } = await api.post(`/projects/${store.projectId}/upload`, formData);
      // Reload project to get updated doc list
      await loadProject(store.projectId);
      return data;
    } finally {
      store.setUploading(false);
    }
  };

  const removeDocument = async (docId: string) => {
    if (!store.projectId) return;
    await api.delete(`/projects/${store.projectId}/documents/${docId}`);
    await loadProject(store.projectId);
  };

  const analyzeProject = async (fresh = false) => {
    if (!store.projectId) return;
    store.setAnalyzing(true);
    store.setAnalysisProgress(null);

    const projectId = store.projectId;
    let streamCompleted = false;

    try {
      const url = fresh ? '/api/analyze?fresh=true' : '/api/analyze';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());

                if (parsed.phase) {
                  store.setAnalysisProgress(parsed);
                  if (parsed.phase === 'complete') streamCompleted = true;
                }
                if (parsed.components !== undefined && parsed.summary !== undefined) {
                  store.setAnalysis(parsed);
                  store.setCurrentView('analysis');
                }
                if (parsed.error) {
                  console.error('Analysis error:', parsed.error);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('SSE stream error:', err);
    }

    // If stream dropped before completion, poll the backend for final state
    if (!streamCompleted) {
      try {
        const { data } = await api.get(`/projects/${projectId}/analysis-progress`);
        if (data.has_analysis && data.analysis) {
          store.setAnalysis(data.analysis);
          store.setCurrentView('analysis');
        } else if (data.extracted > 0) {
          store.setAnalysisProgress({
            phase: 'extract',
            current: data.extracted,
            total: data.total_batches,
            status: 'disconnected — click Analyze again to resume',
          });
        }
      } catch {
        // progress endpoint not reachable
      }
    }

    store.setAnalyzing(false);
    store.setAnalysisProgress(null);
  };

  const generateDiagram = async (diagramType: DiagramType, force = false) => {
    if (!store.projectId) return;

    // Use cached version if available (unless forced regeneration)
    const cached = store.diagramCache[diagramType];
    if (cached && !force) {
      store.setCurrentDiagramType(diagramType);
      store.setCurrentDiagram(cached);
      store.setCurrentView('diagrams');
      return cached;
    }

    store.setGeneratingDiagram(true);
    store.setCurrentDiagramType(diagramType);
    try {
      const { data } = await api.post('/diagrams/generate', {
        project_id: store.projectId,
        diagram_type: diagramType,
      });
      store.setCurrentDiagram(data);
      store.cacheDiagram(diagramType, data);
      store.setCurrentView('diagrams');
      return data;
    } finally {
      store.setGeneratingDiagram(false);
    }
  };

  const generatePlan = async () => {
    if (!store.projectId) return;
    store.setGeneratingPlan(true);
    try {
      const { data } = await api.post('/plan/generate', { project_id: store.projectId });
      store.setPlan(data);
      store.setCurrentView('plan');
      return data;
    } finally {
      store.setGeneratingPlan(false);
    }
  };

  const sendChat = async (message: string) => {
    if (!store.projectId) return;
    store.setChatLoading(true);
    store.addChatMessage({ role: 'user', content: message, timestamp: Date.now() / 1000 });
    store.addChatMessage({ role: 'assistant', content: '', timestamp: Date.now() / 1000 });

    try {
      const response = await fetch(`/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: store.projectId, message }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed.text) {
                  store.appendToLastMessage(parsed.text);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }
    } finally {
      store.setChatLoading(false);
    }
  };

  const listProjects = async () => {
    const { data } = await api.get('/projects');
    return data as Array<{
      id: string;
      name: string;
      document_count: number;
      has_analysis: boolean;
      created_at: number;
    }>;
  };

  const webSearch = async (query: string) => {
    store.setSearchLoading(true);
    try {
      const { data } = await api.post('/web-search', { query, max_results: 8 });
      store.setSearchResults(data);
      return data;
    } finally {
      store.setSearchLoading(false);
    }
  };

  const refineAnalysis = async (instructions: string, searchQueries: string[] = []) => {
    if (!store.projectId) return;
    store.setRefining(true);
    store.setRefineProgress(null);

    const projectId = store.projectId;

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          instructions,
          search_queries: searchQueries,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed.phase === 'search') {
                  store.setRefineProgress(`Found ${parsed.results} search results`);
                } else if (parsed.phase === 'refine') {
                  store.setRefineProgress('Evolving analysis...');
                } else if (parsed.phase === 'complete') {
                  store.setRefineProgress(null);
                  store.setShowCascadePrompt(true);
                }
                if (parsed.components !== undefined && parsed.summary !== undefined) {
                  store.setAnalysis(parsed);
                }
                if (parsed.error) {
                  console.error('Refine error:', parsed.error);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Refine stream error:', err);
    }

    store.setRefining(false);
    store.setRefineProgress(null);

    // Reload refinement history + versions
    await loadRefinements(projectId);
    await loadAnalysisVersions(projectId);
  };

  const loadRefinements = async (projectId?: string) => {
    const pid = projectId || store.projectId;
    if (!pid) return;
    try {
      const { data } = await api.get(`/projects/${pid}/refinements`);
      store.setRefinements(data);
    } catch {
      // silent
    }
  };

  const loadAnalysisVersions = async (projectId?: string) => {
    const pid = projectId || store.projectId;
    if (!pid) return;
    try {
      const { data } = await api.get(`/projects/${pid}/analysis-versions`);
      store.setAnalysisVersions(data);
    } catch {
      // silent
    }
  };

  const loadAnalysisByVersion = async (version: number) => {
    if (!store.projectId) return;
    const { data } = await api.get(`/projects/${store.projectId}/analysis/${version}`);
    store.setAnalysis(data);
  };

  const loadAnalysisDiff = async (v1: number, v2: number) => {
    if (!store.projectId) return;
    const { data } = await api.get(`/projects/${store.projectId}/analysis-diff`, {
      params: { v1, v2 },
    });
    store.setAnalysisDiff(data);
  };

  const exportProject = async () => {
    if (!store.projectId) return;
    const response = await fetch(`/api/projects/${store.projectId}/export`);
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="?(.+?)"?$/);
    a.download = match?.[1] || 'anatomy-export.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/projects/import', formData);
    await loadProject(data.id);
    return data;
  };

  const runClarify = async () => {
    if (!store.projectId) return;
    store.setClarifying(true);
    try {
      const { data } = await api.post('/clarify', { project_id: store.projectId });
      store.setClarifyResult(data);
      store.setCurrentView('clarify');
      return data;
    } finally {
      store.setClarifying(false);
    }
  };

  const resolveClarifications = async (resolutions: { id: string; question: string; answer: string }[]) => {
    if (!store.projectId) return;
    store.setResolving(true);
    try {
      const { data } = await api.post('/clarify/resolve', {
        project_id: store.projectId,
        resolutions,
      });
      if (data.analysis) {
        store.setAnalysis(data.analysis);
      }
      // Auto re-run clarify on the updated analysis so user sees improved state
      store.setResolving(false);
      store.setClarifying(true);
      try {
        const { data: newClarify } = await api.post('/clarify', { project_id: store.projectId });
        store.setClarifyResult(newClarify);
      } finally {
        store.setClarifying(false);
      }
      return data;
    } finally {
      store.setResolving(false);
    }
  };

  const autoResolveClarifications = async (items: Record<string, unknown>[]) => {
    if (!store.projectId) return;
    store.setAutoResolving(true);
    try {
      const { data } = await api.post('/clarify/auto-resolve', {
        project_id: store.projectId,
        items,
      });
      return data.resolutions as { id: string; answer: string; rationale: string }[];
    } finally {
      store.setAutoResolving(false);
    }
  };

  const generateBuildArtifacts = async () => {
    if (!store.projectId) return;
    store.setGeneratingArtifacts(true);
    try {
      const { data } = await api.post('/build/generate', { project_id: store.projectId });
      store.setBuildArtifacts(data);
      store.setCurrentView('build');
      return data;
    } finally {
      store.setGeneratingArtifacts(false);
    }
  };

  const downloadBuildArtifacts = async () => {
    if (!store.projectId) return;
    store.setGeneratingArtifacts(true);
    try {
      const response = await fetch('/api/build/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: store.projectId }),
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] || 'build-artifacts.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      store.setGeneratingArtifacts(false);
    }
  };

  const suggestIntegrations = async (focusArea?: string, repoUrls?: string[], skipSearch?: boolean) => {
    if (!store.projectId) return;
    store.setAdvisorLoading(true);
    store.setAdvisorProgress(null);
    store.setIntegrationAdvice(null);

    try {
      const response = await fetch('/api/suggest-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: store.projectId,
          focus_area: focusArea || null,
          repo_urls: repoUrls || [],
          skip_search: skipSearch || false,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed.phase === 'fetching_repos') {
                  if (parsed.status === 'processing') {
                    store.setAdvisorProgress(`Fetching ${parsed.count} GitHub repo(s)...`);
                  } else if (parsed.status === 'done') {
                    store.setAdvisorProgress(`Fetched ${parsed.fetched} repo context(s), searching...`);
                  }
                } else if (parsed.phase === 'searching') {
                  if (parsed.status === 'progress') {
                    store.setAdvisorProgress(`Searching open-source landscape... (${parsed.current}/${parsed.total})`);
                  } else if (parsed.status === 'done') {
                    store.setAdvisorProgress(`Found ${parsed.total_results} relevant projects, analyzing...`);
                  }
                } else if (parsed.phase === 'analyzing') {
                  store.setAdvisorProgress('AI is analyzing compatibility and fit...');
                } else if (parsed.phase === 'complete' && parsed.advice) {
                  store.setIntegrationAdvice(parsed.advice);
                  store.setAdvisorProgress(null);
                } else if (parsed.phase === 'error') {
                  console.error('Integration advisor error:', parsed.error);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Integration advisor stream error:', err);
    }

    store.setAdvisorLoading(false);
    store.setAdvisorProgress(null);
  };

  return {
    createProject,
    loadProject,
    listProjects,
    uploadFiles,
    removeDocument,
    analyzeProject,
    generateDiagram,
    generatePlan,
    sendChat,
    webSearch,
    refineAnalysis,
    loadRefinements,
    loadAnalysisVersions,
    loadAnalysisByVersion,
    loadAnalysisDiff,
    exportProject,
    importProject,
    runClarify,
    resolveClarifications,
    autoResolveClarifications,
    generateBuildArtifacts,
    downloadBuildArtifacts,
    suggestIntegrations,
  };
}
