export interface UploadedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  documents: UploadedDocument[];
  has_analysis: boolean;
  has_plan: boolean;
  diagram_types: string[];
  created_at: number;
}

export interface DiagramNode {
  id: string;
  type: string;
  label: string;
  description: string;
  technology: string;
  parent: string | null;
  position: { x: number; y: number };
  style: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  description: string;
  animated: boolean;
  style: Record<string, unknown>;
}

export interface DiagramData {
  diagram_type: string;
  title: string;
  description: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface AnalysisResult {
  components: Component[];
  data_flows: DataFlow[];
  data_models: DataModel[];
  layers: Layer[];
  tech_stack: TechStackEntry[];
  nonfunctional_requirements: NFR[];
  gaps: Gap[];
  summary: string;
  validation?: ValidationReport;
  quality?: QualityReport;
}

// ── Typed Architecture Entities ─────────────────────────────────

export interface Component {
  id: string;
  name: string;
  type: string;
  description: string;
  technology: string;
  layer: string;
  source_documents: string[];
}

export interface DataFlow {
  id: string;
  source: string;
  target: string;
  source_id: string;
  target_id: string;
  description: string;
  protocol: string;
  data_format: string;
  source_documents: string[];
}

export interface Attribute {
  name: string;
  type: string;
  required: boolean;
}

export interface DataModelRelationship {
  target: string;
  type: string;
}

export interface DataModel {
  id: string;
  entity: string;
  attributes: Attribute[];
  relationships: DataModelRelationship[];
  source_documents: string[];
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  components: string[];
}

export interface TechStackEntry {
  id: string;
  category: string;
  technology: string;
  purpose: string;
  component_ids: string[];
  source_documents: string[];
}

export interface NFR {
  id: string;
  category: string;
  description: string;
  priority: string;
  target_value: string;
  measurement: string;
  source_documents: string[];
}

export interface Gap {
  id: string;
  area: string;
  description: string;
  severity: string;
  suggestion: string;
  related_component_ids: string[];
  source_documents: string[];
}

// ── Validation & Quality Reports ────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  entity_id: string;
  entity_type: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  entity_id: string;
  entity_type: string;
}

export interface ValidationReport {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

export interface QualityReport {
  completeness_score: number;
  consistency_score: number;
  specificity_score: number;
  overall_score: number;
  hallucination_flags: string[];
  missing_components: string[];
  vague_nfrs: string[];
  recommendations: string[];
  summary: string;
}

export interface ProjectPlan {
  phases: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  dependencies: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  tech_recommendations: Record<string, unknown>[];
  team_suggestions: Record<string, unknown>[];
  gaps: Record<string, unknown>[];
  summary: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface Refinement {
  id: string;
  instructions: string;
  search_results: SearchResult[];
  produced_version: number | null;
  created_at: number;
}

export interface AnalysisVersion {
  version: number;
  source: string;
  summary: string;
  components: number;
  data_flows: number;
  gaps: number;
  tech_stack: number;
  created_at: number;
}

export interface DiffSection {
  added: string[];
  removed: string[];
  unchanged: number;
  total_before: number;
  total_after: number;
}

export interface AnalysisDiff {
  v1: number;
  v2: number;
  components: DiffSection;
  data_flows: DiffSection;
  data_models: DiffSection;
  tech_stack: DiffSection;
  gaps: DiffSection;
  nfrs: DiffSection;
  summary_before: string;
  summary_after: string;
}

export type ViewMode = 'upload' | 'analysis' | 'diagrams' | 'clarify' | 'plan' | 'build' | 'evolve' | 'autopilot';

// ── Orchestrator / Autopilot Types ──────────────────────────────

export interface OrchestratorEvent {
  type: 'thinking' | 'tool_start' | 'tool_result' | 'checkpoint' | 'checkpoint_resumed' | 'complete' | 'error' | 'cancelled';
  tool?: string;
  result?: string;
  thinking?: string;
  call_id?: string;
  duration?: number;
  phase?: string;
  message?: string;
  action?: string;
  error?: boolean;
  [key: string]: unknown;
}

export interface CheckpointData {
  phase: 'analysis_review' | 'clarify_human' | 'plan_review' | 'quality_gate';
  summary?: string;
  data?: Record<string, unknown>;
}

export interface Clarification {
  id: string;
  area: string;
  severity: string;
  title: string;
  description: string;
  question: string;
  default_answer: string;
  expert_rationale: string;
  implementation_hint: string;
  impact: string;
  related_components: string[];
  auto_resolvable: boolean;
}

export interface ClarifyResult {
  clarifications: Clarification[];
  readiness_score: number;
  readiness_summary: string;
  blockers_count: number;
  critical_count: number;
}

export interface BuildArtifacts {
  artifacts: Record<string, string>;
  file_count: number;
}

// ── Integration Advisor Types ───────────────────────────────────

export interface IntegrationSuggestion {
  id: string;
  library_name: string;
  library_url: string;
  description: string;
  license: string;
  category: 'replacement' | 'enhancement' | 'missing_capability' | 'infrastructure';
  target_components: string[];
  replaces_custom: string;
  compatibility_score: number;
  integration_effort: 'low' | 'medium' | 'high';
  maturity: 'experimental' | 'growing' | 'mature' | 'established';
  community_size: 'small' | 'medium' | 'large';
  rationale: string;
  tech_alignment: string[];
  integration_steps: string[];
  risks: string[];
  estimated_savings: string;
}

export interface IntegrationAdvice {
  suggestions: IntegrationSuggestion[];
  summary: string;
  build_vs_buy_ratio: string;
}

export type DiagramType =
  | 'system_context'
  | 'container'
  | 'component'
  | 'hld'
  | 'lld'
  | 'data_flow'
  | 'er_diagram'
  | 'sequence'
  | 'deployment'
  | 'tech_stack'
  | 'runtime_flow';

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  system_context: 'System Context',
  container: 'Container',
  component: 'Component',
  hld: 'High-Level Design',
  lld: 'Low-Level Design',
  data_flow: 'Data Flow',
  er_diagram: 'ER Diagram',
  sequence: 'Sequence',
  deployment: 'Deployment',
  tech_stack: 'Tech Stack',
  runtime_flow: 'Runtime Flow',
};
