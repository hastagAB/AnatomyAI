import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DropZone } from './components/upload/DropZone';
import { AnalysisDashboard } from './components/analysis/AnalysisDashboard';
import { DiagramCanvas } from './components/diagrams/DiagramCanvas';
import { DiagramToolbar } from './components/diagrams/DiagramToolbar';
import { ChatPanel } from './components/chat/ChatPanel';
import { PlanView } from './components/plan/PlanView';
import { ClarifyView } from './components/clarify/ClarifyView';
import { BuildView } from './components/build/BuildView';
import { EvolveWorkspace } from './components/evolve/EvolveWorkspace';
import { AutopilotView } from './components/autopilot/AutopilotView';
import { AnalysisDiffView } from './components/evolve/AnalysisDiffView';
import { CascadePrompt } from './components/evolve/CascadePrompt';
import { LiveLogViewer } from './components/analysis/LiveLogViewer';
import { ProjectPicker } from './components/project/ProjectPicker';
import { useStore } from './store/useStore';
import { useProject } from './hooks/useProject';
import { useLogStream } from './hooks/useLogStream';

function MainContent() {
  const { currentView } = useStore();

  switch (currentView) {
    case 'upload':
      return <DropZone />;
    case 'autopilot':
      return <AutopilotView />;
    case 'analysis':
      return <AnalysisDashboard />;
    case 'diagrams':
      return (
        <div className="flex-1 flex flex-col">
          <div className="relative z-50">
            <DiagramToolbar />
          </div>
          <DiagramCanvas />
        </div>
      );
    case 'clarify':
      return <ClarifyView />;
    case 'plan':
      return <PlanView />;
    case 'build':
      return <BuildView />;
    case 'evolve':
      return <EvolveWorkspace />;
    default:
      return <DropZone />;
  }
}

export default function App() {
  const { projectId } = useStore();
  const { loadProject } = useProject();
  useLogStream(); // persistent SSE connection for all backend logs
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('anatomy_project_id');
    if (savedId) {
      loadProject(savedId)
        .catch(() => {
          localStorage.removeItem('anatomy_project_id');
          setShowPicker(true);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setShowPicker(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-indigo-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
          </div>
          <div className="text-sm text-gray-500 font-medium">Loading project...</div>
        </div>
      </div>
    );
  }

  if (!projectId || showPicker) {
    return <ProjectPicker onClose={() => setShowPicker(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-200">
      <Header onSwitchProject={() => setShowPicker(true)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex overflow-hidden">
          <MainContent />
        </main>
        <ChatPanel />
      </div>
      <AnalysisDiffView />
      <CascadePrompt />
      <LiveLogViewer />
    </div>
  );
}
