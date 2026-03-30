from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import uuid
import time


class FileType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    DRAWIO = "drawio"
    TXT = "txt"
    MD = "md"
    IMAGE = "image"
    UNKNOWN = "unknown"


class DocumentChunk(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_type: FileType
    content: str
    metadata: dict = Field(default_factory=dict)
    page_number: int | None = None


class UploadedDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_type: FileType
    file_size: int
    chunks: list[DocumentChunk] = []
    uploaded_at: float = Field(default_factory=time.time)


class DiagramType(str, Enum):
    SYSTEM_CONTEXT = "system_context"
    CONTAINER = "container"
    COMPONENT = "component"
    HLD = "hld"
    LLD = "lld"
    DATA_FLOW = "data_flow"
    ER_DIAGRAM = "er_diagram"
    SEQUENCE = "sequence"
    DEPLOYMENT = "deployment"
    TECH_STACK = "tech_stack"
    RUNTIME_FLOW = "runtime_flow"


class DiagramNode(BaseModel):
    id: str
    type: str
    label: str
    description: str = ""
    technology: str = ""
    parent: str | None = None
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    style: dict = Field(default_factory=dict)


class DiagramEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str = ""
    description: str = ""
    animated: bool = False
    style: dict = Field(default_factory=dict)


class DiagramData(BaseModel):
    diagram_type: DiagramType
    title: str
    description: str = ""
    nodes: list[DiagramNode] = []
    edges: list[DiagramEdge] = []


# ── Typed Architecture Entities ─────────────────────────────────────


class ComponentType(str, Enum):
    SERVICE = "service"
    DATABASE = "database"
    API = "api"
    QUEUE = "queue"
    CACHE = "cache"
    GATEWAY = "gateway"
    UI = "ui"
    EXTERNAL = "external"
    ACTOR = "actor"
    STORAGE = "storage"
    FUNCTION = "function"
    OTHER = "other"


class GapSeverity(str, Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"


class NFRCategory(str, Enum):
    SECURITY = "security"
    PERFORMANCE = "performance"
    SCALABILITY = "scalability"
    RELIABILITY = "reliability"
    MAINTAINABILITY = "maintainability"
    OBSERVABILITY = "observability"
    OTHER = "other"


class NFRPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RelationshipType(str, Enum):
    ONE_TO_ONE = "one-to-one"
    ONE_TO_MANY = "one-to-many"
    MANY_TO_MANY = "many-to-many"


class TechCategory(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATABASE = "database"
    INFRASTRUCTURE = "infrastructure"
    DEVOPS = "devops"
    TESTING = "testing"
    OTHER = "other"


def _gen_id() -> str:
    return str(uuid.uuid4())[:8]


class Component(BaseModel):
    id: str = Field(default_factory=_gen_id)
    name: str
    type: str = "service"
    description: str = ""
    technology: str = ""
    layer: str = ""
    source_documents: list[str] = Field(default_factory=list)


class DataFlow(BaseModel):
    id: str = Field(default_factory=_gen_id)
    source: str = ""
    target: str = ""
    source_id: str = ""
    target_id: str = ""
    description: str = ""
    protocol: str = ""
    data_format: str = ""
    source_documents: list[str] = Field(default_factory=list)


class Attribute(BaseModel):
    name: str
    type: str = ""
    required: bool = True


class Relationship(BaseModel):
    target: str
    type: str = "one-to-many"


class DataModel(BaseModel):
    id: str = Field(default_factory=_gen_id)
    entity: str
    attributes: list[Attribute] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    source_documents: list[str] = Field(default_factory=list)


class Layer(BaseModel):
    id: str = Field(default_factory=_gen_id)
    name: str
    description: str = ""
    components: list[str] = Field(default_factory=list)


class TechStackEntry(BaseModel):
    id: str = Field(default_factory=_gen_id)
    category: str = "other"
    technology: str
    purpose: str = ""
    component_ids: list[str] = Field(default_factory=list)
    source_documents: list[str] = Field(default_factory=list)


class NFR(BaseModel):
    id: str = Field(default_factory=_gen_id)
    category: str = "other"
    description: str
    priority: str = "medium"
    target_value: str = ""
    measurement: str = ""
    source_documents: list[str] = Field(default_factory=list)


class Gap(BaseModel):
    id: str = Field(default_factory=_gen_id)
    area: str
    description: str
    severity: str = "major"
    suggestion: str = ""
    related_component_ids: list[str] = Field(default_factory=list)
    source_documents: list[str] = Field(default_factory=list)


# ── Validation Report ───────────────────────────────────────────────


class ValidationError(BaseModel):
    code: str
    message: str
    entity_id: str = ""
    entity_type: str = ""


class ValidationWarning(BaseModel):
    code: str
    message: str
    entity_id: str = ""
    entity_type: str = ""


class ValidationReport(BaseModel):
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationWarning] = Field(default_factory=list)
    score: int = 100


class QualityReport(BaseModel):
    completeness_score: int = 0
    consistency_score: int = 0
    specificity_score: int = 0
    overall_score: int = 0
    hallucination_flags: list[str] = Field(default_factory=list)
    missing_components: list[str] = Field(default_factory=list)
    vague_nfrs: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    summary: str = ""


# ── Analysis Result (typed) ─────────────────────────────────────────


class AnalysisResult(BaseModel):
    components: list[Component] = Field(default_factory=list)
    data_flows: list[DataFlow] = Field(default_factory=list)
    data_models: list[DataModel] = Field(default_factory=list)
    layers: list[Layer] = Field(default_factory=list)
    tech_stack: list[TechStackEntry] = Field(default_factory=list)
    nonfunctional_requirements: list[NFR] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)
    summary: str = ""
    validation: ValidationReport | None = None
    quality: QualityReport | None = None


class PartialExtraction(BaseModel):
    document_name: str
    components: list[Component] = Field(default_factory=list)
    data_flows: list[DataFlow] = Field(default_factory=list)
    data_models: list[DataModel] = Field(default_factory=list)
    tech_stack: list[TechStackEntry] = Field(default_factory=list)
    nonfunctional_requirements: list[NFR] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)
    summary: str = ""


class ProjectPlan(BaseModel):
    phases: list[dict] = []
    tasks: list[dict] = []
    dependencies: list[dict] = []
    risks: list[dict] = []
    tech_recommendations: list[dict] = []
    team_suggestions: list[dict] = []
    gaps: list[dict] = []
    summary: str = ""


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: float = Field(default_factory=time.time)


class ProjectState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Untitled Project"
    documents: list[UploadedDocument] = []
    analysis: AnalysisResult | None = None
    partial_extractions: list[PartialExtraction] = []
    diagrams: dict[str, DiagramData] = {}
    plan: ProjectPlan | None = None
    chat_history: list[ChatMessage] = []
    created_at: float = Field(default_factory=time.time)


class ChatRequest(BaseModel):
    message: str
    project_id: str


class AnalyzeRequest(BaseModel):
    project_id: str


class DiagramRequest(BaseModel):
    project_id: str
    diagram_type: DiagramType


class PlanRequest(BaseModel):
    project_id: str
