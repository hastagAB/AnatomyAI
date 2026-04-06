import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { nodeColors } from '../../../styles/theme';

interface GroupData {
  label: string;
  [key: string]: unknown;
}

function GroupNodeComponent({ data }: NodeProps & { data: GroupData }) {
  const colors = nodeColors.group;

  return (
    <div
      className="rounded-3xl border-2 border-dashed p-6 min-w-[300px] min-h-[200px]"
      style={{
        background: colors.bg,
        borderColor: `${colors.border}30`,
      }}
    >
      <div
        className="text-xs font-bold uppercase tracking-widest mb-4"
        style={{ color: `${colors.border}80` }}
      >
        {data.label}
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
