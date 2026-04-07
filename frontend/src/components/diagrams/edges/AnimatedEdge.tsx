import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#c084fc" stopOpacity="1" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: `url(#gradient-${id})`,
          strokeWidth: 2.5,
          ...style,
        }}
      />
      {/* Animated dot */}
      <circle r="3" fill="#c084fc" filter="drop-shadow(0 0 4px #c084fc)">
        <animateMotion dur="4s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {/* Label */}
      {label && (
        <foreignObject
          x={labelX - 75}
          y={labelY - 11}
          width={150}
          height={22}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center">
            <span className="text-[9px] font-medium text-gray-500 bg-gray-950/90 px-1.5 py-0.5 rounded border border-white/5 whitespace-nowrap max-w-[140px] truncate">
              {String(label)}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);
