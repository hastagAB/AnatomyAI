import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';
import { motion, AnimatePresence } from 'framer-motion';

export function ChatPanel() {
  const { chatOpen, toggleChat, chatMessages, chatLoading } = useStore();
  const { sendChat } = useProject();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || chatLoading) return;
    setInput('');
    await sendChat(msg);
  };

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="border-l border-white/[0.06] bg-gray-950/70 backdrop-blur-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="h-12 border-b border-white/[0.06] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white">AI Chat</span>
              <span className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">context-aware</span>
            </div>
            <button
              onClick={toggleChat}
              className="p-1 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-600 text-sm mt-12">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-500/40" />
                </div>
                <p className="font-medium text-gray-500">Ask about your architecture</p>
                <p className="text-xs text-gray-600 mt-1">I have full context of your project</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-100 border border-indigo-500/15'
                      : 'bg-white/[0.03] text-gray-300 border border-white/[0.05]'
                  }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] p-3">
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-indigo-500/30 focus-within:bg-white/[0.04] transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask about the architecture..."
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                disabled={chatLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatLoading}
                className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
