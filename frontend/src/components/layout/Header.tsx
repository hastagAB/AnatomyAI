import { Moon, Sun, MessageCircle, FolderOpen, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface HeaderProps {
  onSwitchProject: () => void;
}

export function Header({ onSwitchProject }: HeaderProps) {
  const { projectName, darkMode, toggleDarkMode, chatOpen, toggleChat } = useStore();

  return (
    <header className="h-14 border-b border-white/[0.06] bg-gray-950/60 backdrop-blur-2xl flex items-center justify-between px-5 relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold tracking-tight gradient-text">Anatomy</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/70 bg-indigo-500/10 px-1.5 py-0.5 rounded">AI</span>
        </div>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button
          onClick={onSwitchProject}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors group"
          title="Switch project"
        >
          <FolderOpen className="w-3.5 h-3.5 group-hover:text-indigo-400 transition-colors" />
          <span className="truncate max-w-[200px]">{projectName}</span>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleChat}
          className={`p-2 rounded-lg transition-all ${
            chatOpen
              ? 'bg-indigo-500/20 text-indigo-400 shadow-inner shadow-indigo-500/10'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
          }`}
          title="Toggle chat"
        >
          <MessageCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-all"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>
      </div>
    </header>
  );
}
