import { create } from 'zustand';
import type {
  UploadedDocument,
  AnalysisResult,
  DiagramData,
  ProjectPlan,
  ChatMessage,
  ViewMode,
  DiagramType,
  SearchResult,
  Refinement,
  AnalysisVersion,
  AnalysisDiff,
  ClarifyResult,
  BuildArtifacts,
  OrchestratorEvent,
  CheckpointData,
  IntegrationAdvice,
} from '../types';

interface AnalysisProgress {
  phase: 'extract' | 'synthesize' | 'deepen' | 'complete';
  current?: number;
  total?: number;
  docs?: string[];
  status?: string;
  pass?: number;
  actionable_errors?: number;
  validation_score?: number;
}

interface AppState {
  // Project
  projectId: string | null;
  projectName: string;
  documents: UploadedDocument[];
  
  // Views
  currentView: ViewMode;
  chatOpen: boolean;
  darkMode: boolean;
  
  // Data
  analysis: AnalysisResult | null;
  currentDiagram: DiagramData | null;
  currentDiagramType: DiagramType;
  diagramCache: Record<string, DiagramData>;
  plan: ProjectPlan | null;
  chatMessages: ChatMessage[];
  
  // Loading states
  uploading: boolean;
  analyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  generatingDiagram: boolean;
  generatingPlan: boolean;
  chatLoading: boolean;

  // Evolve
  searchResults: SearchResult[];
  searchLoading: boolean;
  refining: boolean;
  refineProgress: string | null;
  refinements: Refinement[];
  analysisVersions: AnalysisVersion[];
  analysisDiff: AnalysisDiff | null;
  evolveModalOpen: boolean;
  evolveContext: string;
  showCascadePrompt: boolean;

  // Integration Advisor
  integrationAdvice: IntegrationAdvice | null;
  advisorLoading: boolean;
  advisorProgress: string | null;

  // Live logs
  analysisLogs: { ts: number; level: string; msg: string }[];
  showLogViewer: boolean;

  // Clarify
  clarifyResult: ClarifyResult | null;
  clarifying: boolean;
  resolving: boolean;
  autoResolving: boolean;

  // Build artifacts
  buildArtifacts: BuildArtifacts | null;
  generatingArtifacts: boolean;

  // Diagram layout
  diagramLayoutDirection: 'TB' | 'LR';
  diagramLayoutKey: number;

  // Orchestrator / Autopilot
  orchestratorRunning: boolean;
  orchestratorEvents: OrchestratorEvent[];
  orchestratorCheckpoint: CheckpointData | null;

  // Actions
  setProjectId: (id: string) => void;
  setProjectName: (name: string) => void;
  setDocuments: (docs: UploadedDocument[]) => void;
  setCurrentView: (view: ViewMode) => void;
  toggleChat: () => void;
  toggleDarkMode: () => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  setCurrentDiagram: (diagram: DiagramData) => void;
  setCurrentDiagramType: (type: DiagramType) => void;
  setDiagramCache: (cache: Record<string, DiagramData>) => void;
  cacheDiagram: (type: string, diagram: DiagramData) => void;
  setPlan: (plan: ProjectPlan) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  appendToLastMessage: (text: string) => void;
  setUploading: (v: boolean) => void;
  setAnalyzing: (v: boolean) => void;
  setAnalysisProgress: (p: AnalysisProgress | null) => void;
  setGeneratingDiagram: (v: boolean) => void;
  setGeneratingPlan: (v: boolean) => void;
  setChatLoading: (v: boolean) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchLoading: (v: boolean) => void;
  setRefining: (v: boolean) => void;
  setRefineProgress: (p: string | null) => void;
  setRefinements: (r: Refinement[]) => void;
  setAnalysisVersions: (v: AnalysisVersion[]) => void;
  setAnalysisDiff: (d: AnalysisDiff | null) => void;
  setEvolveModalOpen: (v: boolean) => void;
  setEvolveContext: (ctx: string) => void;
  openEvolveWithContext: (ctx: string) => void;
  setShowCascadePrompt: (v: boolean) => void;
  addAnalysisLog: (entry: { ts: number; level: string; msg: string }) => void;
  clearAnalysisLogs: () => void;
  setShowLogViewer: (v: boolean) => void;
  setClarifyResult: (r: ClarifyResult | null) => void;
  setClarifying: (v: boolean) => void;
  setResolving: (v: boolean) => void;
  setAutoResolving: (v: boolean) => void;
  setBuildArtifacts: (a: BuildArtifacts | null) => void;
  setGeneratingArtifacts: (v: boolean) => void;
  setIntegrationAdvice: (a: IntegrationAdvice | null) => void;
  setAdvisorLoading: (v: boolean) => void;
  setAdvisorProgress: (p: string | null) => void;
  setDiagramLayoutDirection: (d: 'TB' | 'LR') => void;
  triggerRelayout: () => void;
  setOrchestratorRunning: (v: boolean) => void;
  addOrchestratorEvent: (e: OrchestratorEvent) => void;
  clearOrchestratorEvents: () => void;
  setOrchestratorCheckpoint: (c: CheckpointData | null) => void;
}

export const useStore = create<AppState>((set) => ({
  projectId: null,
  projectName: 'Untitled Project',
  documents: [],
  currentView: 'upload',
  chatOpen: false,
  darkMode: true,
  analysis: null,
  currentDiagram: null,
  currentDiagramType: 'system_context',
  diagramCache: {},
  plan: null,
  chatMessages: [],
  uploading: false,
  analyzing: false,
  analysisProgress: null,
  generatingDiagram: false,
  generatingPlan: false,
  chatLoading: false,
  searchResults: [],
  searchLoading: false,
  refining: false,
  refineProgress: null,
  refinements: [],
  analysisVersions: [],
  analysisDiff: null,
  evolveModalOpen: false,
  evolveContext: '',
  showCascadePrompt: false,
  analysisLogs: [],
  showLogViewer: false,
  clarifyResult: null,
  clarifying: false,
  resolving: false,
  autoResolving: false,
  buildArtifacts: null,
  generatingArtifacts: false,
  integrationAdvice: null,
  advisorLoading: false,
  advisorProgress: null,
  diagramLayoutDirection: 'TB',
  diagramLayoutKey: 0,
  orchestratorRunning: false,
  orchestratorEvents: [],
  orchestratorCheckpoint: null,

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setDocuments: (docs) => set({ documents: docs }),
  setCurrentView: (view) => set((s) => {
    const pid = s.projectId;
    if (pid) localStorage.setItem(`anatomy_view_${pid}`, view);
    return { currentView: view };
  }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  setAnalysis: (analysis) => set({ analysis }),
  setCurrentDiagram: (diagram) => set({ currentDiagram: diagram }),
  setCurrentDiagramType: (type) => set({ currentDiagramType: type }),
  setDiagramCache: (cache) => set({ diagramCache: cache }),
  cacheDiagram: (type, diagram) => set((s) => ({ diagramCache: { ...s.diagramCache, [type]: diagram } })),
  setPlan: (plan) => set({ plan }),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) => set((s) => ({ chatMessages: [...s.chatMessages, message] })),
  appendToLastMessage: (text) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + text,
        };
      }
      return { chatMessages: msgs };
    }),
  setUploading: (v) => set({ uploading: v }),
  setAnalyzing: (v) => set({ analyzing: v }),
  setAnalysisProgress: (p) => set({ analysisProgress: p }),
  setGeneratingDiagram: (v) => set({ generatingDiagram: v }),
  setGeneratingPlan: (v) => set({ generatingPlan: v }),
  setChatLoading: (v) => set({ chatLoading: v }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchLoading: (v) => set({ searchLoading: v }),
  setRefining: (v) => set({ refining: v }),
  setRefineProgress: (p) => set({ refineProgress: p }),
  setRefinements: (r) => set({ refinements: r }),
  setAnalysisVersions: (v) => set({ analysisVersions: v }),
  setAnalysisDiff: (d) => set({ analysisDiff: d }),
  setEvolveModalOpen: (v) => set({ evolveModalOpen: v }),
  setEvolveContext: (ctx) => set({ evolveContext: ctx }),
  openEvolveWithContext: (ctx) => set({ evolveContext: ctx, currentView: 'evolve' }),
  setShowCascadePrompt: (v) => set({ showCascadePrompt: v }),
  addAnalysisLog: (entry) => set((s) => ({ analysisLogs: [...s.analysisLogs, entry].slice(-500) })),
  clearAnalysisLogs: () => set({ analysisLogs: [] }),
  setShowLogViewer: (v) => set({ showLogViewer: v }),
  setClarifyResult: (r) => set({ clarifyResult: r }),
  setClarifying: (v) => set({ clarifying: v }),
  setResolving: (v) => set({ resolving: v }),
  setAutoResolving: (v) => set({ autoResolving: v }),
  setBuildArtifacts: (a) => set({ buildArtifacts: a }),
  setGeneratingArtifacts: (v) => set({ generatingArtifacts: v }),
  setIntegrationAdvice: (a) => set({ integrationAdvice: a }),
  setAdvisorLoading: (v) => set({ advisorLoading: v }),
  setAdvisorProgress: (p) => set({ advisorProgress: p }),
  setDiagramLayoutDirection: (d) => set((s) => ({ diagramLayoutDirection: d, diagramLayoutKey: s.diagramLayoutKey + 1 })),
  triggerRelayout: () => set((s) => ({ diagramLayoutKey: s.diagramLayoutKey + 1 })),
  setOrchestratorRunning: (v) => set({ orchestratorRunning: v }),
  addOrchestratorEvent: (e) => set((s) => ({ orchestratorEvents: [...s.orchestratorEvents, e] })),
  clearOrchestratorEvents: () => set({ orchestratorEvents: [], orchestratorCheckpoint: null }),
  setOrchestratorCheckpoint: (c) => set({ orchestratorCheckpoint: c }),
}));
