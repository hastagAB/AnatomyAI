import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeColors } from '../../../styles/theme';
import {
  Server,
  Database,
  Globe,
  Box,
  User,
  Cloud,
  Zap,
  Shield,
  Monitor,
  HardDrive,
} from 'lucide-react';

const iconMap: Record<string, typeof Server> = {
  service: Server,
  database: Database,
  api: Globe,
  queue: Zap,
  component: Box,
  actor: User,
  cloud: Cloud,
  cache: HardDrive,
  gateway: Shield,
  ui: Monitor,
  external: Globe,
};

interface NodeData {
  label: string;
  description?: string;
  technology?: string;
  nodeType?: string;
  [key: string]: unknown;
}

function ServiceNodeComponent({ data }: NodeProps & { data: NodeData }) {
  const nodeType = (data.nodeType as string) || 'service';
  const colors = nodeColors[nodeType] || nodeColors.service;
  const Icon = iconMap[nodeType] || Box;

  return (
    <div
      className="relative group cursor-grab active:cursor-grabbing"
      style={{ minWidth: 200, maxWidth: 260 }}
    >
      {/* Glass card */}
      <div
        className="rounded-2xl border backdrop-blur-xl p-4 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-2xl"
        style={{
          background: colors.bg,
          borderColor: `${colors.border}40`,
          boxShadow: `0 4px 24px ${colors.border}15, 0 0 0 1px ${colors.border}10`,
        }}
      >
        {/* Icon badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-lg"
          style={{ background: colors.gradient }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Label */}
        <div className="text-sm font-semibold text-white mb-1">{data.label}</div>

        {/* Technology tag */}
        {data.technology && (
          <div
            className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
            style={{
              background: `${colors.border}15`,
              color: colors.border,
            }}
          >
            {data.technology}
          </div>
        )}

        {/* Description tooltip on hover */}
        {data.description && (
          <div className="text-[11px] text-gray-400 mt-2 line-clamp-2 leading-relaxed">
            {data.description}
          </div>
        )}
      </div>

      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"
        style={{ background: colors.gradient }}
      />

      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-3 !h-3" />
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeComponent);
