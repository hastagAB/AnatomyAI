export const nodeColors: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  service: {
    bg: 'rgba(59, 130, 246, 0.08)',
    border: '#3b82f6',
    text: '#1e40af',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  },
  database: {
    bg: 'rgba(16, 185, 129, 0.08)',
    border: '#10b981',
    text: '#065f46',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  },
  api: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: '#f59e0b',
    text: '#92400e',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  },
  queue: {
    bg: 'rgba(168, 85, 247, 0.08)',
    border: '#a855f7',
    text: '#6b21a8',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
  },
  component: {
    bg: 'rgba(99, 102, 241, 0.08)',
    border: '#6366f1',
    text: '#3730a3',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  actor: {
    bg: 'rgba(236, 72, 153, 0.08)',
    border: '#ec4899',
    text: '#9d174d',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  },
  cloud: {
    bg: 'rgba(6, 182, 212, 0.08)',
    border: '#06b6d4',
    text: '#155e75',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  },
  cache: {
    bg: 'rgba(234, 88, 12, 0.08)',
    border: '#ea580c',
    text: '#9a3412',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
  },
  gateway: {
    bg: 'rgba(20, 184, 166, 0.08)',
    border: '#14b8a6',
    text: '#134e4a',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #10b981 100%)',
  },
  ui: {
    bg: 'rgba(244, 63, 94, 0.08)',
    border: '#f43f5e',
    text: '#9f1239',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
  },
  external: {
    bg: 'rgba(107, 114, 128, 0.08)',
    border: '#6b7280',
    text: '#374151',
    gradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
  },
  group: {
    bg: 'rgba(99, 102, 241, 0.04)',
    border: '#6366f1',
    text: '#4338ca',
    gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
  },
};

export const edgeColors = {
  default: '#94a3b8',
  data: '#3b82f6',
  control: '#8b5cf6',
  event: '#f59e0b',
};
